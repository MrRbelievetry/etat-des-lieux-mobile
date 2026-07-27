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

export function PhotoInput({ photos, onChange, roomId, elementId, readonly }: Props) {
  async function addFiles(files: FileList | null) {
    if (!files || readonly) return;
    const accepted = [...files].filter((file) => file.type.startsWith('image/') && file.size <= 12 * 1024 * 1024);
    const next = await Promise.all(accepted.map(async (file, index) => {
      const dataUrl = await fileToDataUrl(file);
      return {
        id: crypto.randomUUID(),
        roomId,
        elementId,
        caption: '',
        createdAt: new Date().toISOString(),
        order: photos.length + index + 1,
        dataUrl,
        hash: await sha256DataUrl(dataUrl),
        rotation: 0 as const
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
    </div>
  );
}
