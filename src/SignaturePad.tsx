import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import type { Signature } from './types';

interface Props {
  signature: Signature;
  onChange: (signature: Signature) => void;
  readonly?: boolean;
}

export function SignaturePad({ signature, onChange, readonly }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = 190 * devicePixelRatio;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(devicePixelRatio, devicePixelRatio);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, rect.width, 190);
    context.strokeStyle = '#111827';
    context.lineWidth = 2.2;
    context.lineCap = 'round';
    if (signature.imageDataUrl) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, rect.width, 190);
      image.src = signature.imageDataUrl;
    }
  }, [signature.imageDataUrl]);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    onChange({ ...signature, imageDataUrl: undefined, signedAt: undefined });
  }

  function save() {
    if (!signature.acceptedRead || readonly) return;
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    onChange({ ...signature, imageDataUrl: dataUrl, signedAt: new Date().toISOString(), refused: false });
  }

  return (
    <section className="signatureCard">
      <h3>{signature.role} - {signature.name || 'Nom à renseigner'}</h3>
      <label className="check">
        <input disabled={readonly} type="checkbox" checked={signature.acceptedRead} onChange={(event) => onChange({ ...signature, acceptedRead: event.target.checked })} />
        Je reconnais avoir pris connaissance de l’intégralité du présent état des lieux, de ses observations, photographies et annexes avant de signer.
      </label>
      <label className="check">
        <input disabled={readonly} type="checkbox" checked={signature.refused} onChange={(event) => onChange({ ...signature, refused: event.target.checked, imageDataUrl: undefined })} />
        La partie refuse de signer
      </label>
      {signature.refused ? (
        <div className="grid two">
          <input disabled={readonly} value={signature.refusalReason} placeholder="Motif éventuel" onChange={(event) => onChange({ ...signature, refusalReason: event.target.value })} />
          <input disabled={readonly} value={signature.observation} placeholder="Observation" onChange={(event) => onChange({ ...signature, observation: event.target.value })} />
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="signatureCanvas"
            aria-label={`Zone de signature ${signature.role}`}
            onPointerDown={(event) => {
              if (readonly) return;
              setDrawing(true);
              event.currentTarget.setPointerCapture(event.pointerId);
              const context = event.currentTarget.getContext('2d');
              const p = point(event);
              context?.beginPath();
              context?.moveTo(p.x, p.y);
            }}
            onPointerMove={(event) => {
              if (!drawing || readonly) return;
              const context = event.currentTarget.getContext('2d');
              const p = point(event);
              context?.lineTo(p.x, p.y);
              context?.stroke();
            }}
            onPointerUp={() => setDrawing(false)}
          />
          {!readonly && (
            <div className="photoActions">
              <button type="button" className="button secondary" onClick={clear}><Eraser size={18} /> Effacer</button>
              <button type="button" className="button primary" disabled={!signature.acceptedRead} onClick={save}><PenLine size={18} /> Valider la signature</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
