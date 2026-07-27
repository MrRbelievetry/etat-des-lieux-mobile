import { Camera, ImagePlus, RotateCw, Trash2 } from 'lucide-react';
import { sha256DataUrl } from './crypto';
import type { Photo } from './types';

interface Props {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  roomId?: string;
  elementId?: string;
  readonly?: boolean;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(canvas.toDataURL('image/jpeg', quality));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    }, 'image/jpeg', quality);
  });
}

export async function compressImageFile(file: File): Promise<{ dataUrl: string; width?: number; height?: number; compressedBytes?: number }> {
  const original = await fileToDataUrl(file);
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });
  image.src = original;

  try {
    await loaded;
  } catch {
    return { dataUrl: original, compressedBytes: file.size };
  }

  const maxSide = 900;
  const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return { dataUrl: original, width, height, compressedBytes: file.size };
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.5;
  let dataUrl = await canvasToJpeg(canvas, quality);
  while (dataUrl.length > 68000 && quality > 0.28) {
    quality -= 0.06;
    dataUrl = await canvasToJpeg(canvas, quality);
  }
  return { dataUrl, width, height, compressedBytes: Math.round((dataUrl.length * 3) / 4) };
}

export function PhotoInput({ photos, onChange, roomId, elementId, readonly }: Props) {
  async function addFiles(files: FileList | null) {
    if (!files || readonly) return;
    const accepted = [...files].filter((file) => file.type.startsWith('image/') && file.size <= 12 * 1024 * 1024);
    const next = await Promise.all(accepted.map(async (file, index) => {
      const compressed = await compressImageFile(file);
      return {
        id: crypto.randomUUID(),
        roomId,
        elementId,
        caption: '',
        createdAt: new Date().toISOString(),
        order: photos.length + index + 1,
        dataUrl: compressed.dataUrl,
        hash: await sha256DataUrl(compressed.dataUrl),
        rotation: 0 as const,
        originalBytes: file.size,
        compressedBytes: compressed.compressedBytes,
        width: compressed.width,
        height: compressed.height
      };
    }));
    onChange([...photos, ...next]);
  }

  return (
    <div className="photoBlock">
      {!readonly && (
        <div className="photoActions">
          <label className="button primary">
            <Camera size={18} /> Prendre une photo
            <input aria-label="Prendre une photo" type="file" accept="image/*" capture="environment" hidden onChange={(event) => void addFiles(event.currentTarget.files)} />
          </label>
          <label className="button secondary">
            <ImagePlus size={18} /> Importer depuis la galerie
            <input aria-label="Importer depuis la galerie" type="file" accept="image/*" multiple hidden onChange={(event) => void addFiles(event.currentTarget.files)} />
          </label>
        </div>
      )}
      <div className="photos">
        {photos.map((photo, index) => (
          <figure className="photo" key={photo.id}>
            <button className="imageButton" type="button" onClick={() => window.open(photo.dataUrl, '_blank')} aria-label="Voir l’image en plein écran">
              <img src={photo.dataUrl} alt={photo.caption || `Photo ${index + 1}`} style={{ rotate: `${photo.rotation}deg` }} />
            </button>
            <figcaption>Photo {index + 1}</figcaption>
            <input disabled={readonly} value={photo.caption} placeholder="Légende précise" onChange={(event) => onChange(photos.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))} />
            {!readonly && (
              <div className="miniActions">
                <button type="button" title="Pivoter" onClick={() => onChange(photos.map((item) => item.id === photo.id ? { ...item, rotation: ((item.rotation + 90) % 360) as Photo['rotation'] } : item))}><RotateCw size={16} /></button>
                <button type="button" title="Monter" disabled={index === 0} onClick={() => {
                  const copy = [...photos];
                  [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
                  onChange(copy.map((item, order) => ({ ...item, order })));
                }}>↑</button>
                <button type="button" title="Descendre" disabled={index === photos.length - 1} onClick={() => {
                  const copy = [...photos];
                  [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]];
                  onChange(copy.map((item, order) => ({ ...item, order })));
                }}>↓</button>
                <button type="button" title="Supprimer" onClick={() => onChange(photos.filter((item) => item.id !== photo.id))}><Trash2 size={16} /></button>
              </div>
            )}
          </figure>
        ))}
      </div>
      <p className="hint">Sur mobile compatible, “Prendre une photo” demande la caméra arrière au moment utile. En cas de refus, utilisez l’import depuis la galerie.</p>
      <p className="hint">Les images sont automatiquement redimensionnées et compressées pour produire un PDF léger, sans filtre visuel.</p>
    </div>
  );
}
