import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { blankCase, duplicateCase } from './caseFactory';
import { makeElement, makeRoom } from './constants';
import { buildElementLines, formatFrenchDate, generateInspectionPdf, isMeterFilled, isTenantNamed } from './pdf';
import { validateCase } from './validation';

Object.defineProperty(window, 'open', { value: vi.fn(), writable: true });
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  scale: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  drawImage: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'round'
}) as any);
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,c2lnbmF0dXJl');

afterEach(() => {
  cleanup();
});

describe('application état des lieux', () => {
  it('crée un dossier et sauvegarde un brouillon reprenable', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvel état des lieux d’entrée/ }));
    await user.type(screen.getByLabelText('Adresse complète'), '10 rue Test, 75000 Exemple');
    await waitFor(() => expect(screen.getByText(/brouillon sauvegardé automatiquement/i)).toBeInTheDocument());
    await user.click(screen.getByText('← Accueil'));
    expect(await screen.findByText('10 rue Test, 75000 Exemple')).toBeInTheDocument();
  });

  it('ajoute une pièce et un élément', () => {
    const item = blankCase('entry');
    item.rooms = [];
    const next = duplicateCase({ ...item, rooms: [] });
    next.rooms.push({ ...blankCase().rooms[0], name: 'Bureau de test' });
    next.rooms[0].elements.push({ ...blankCase().rooms[0].elements[0], label: 'Étagère test' });
    expect(next.rooms[0].elements.some((element) => element.label === 'Étagère test')).toBe(true);
  });

  it('expose un bouton caméra séparé de la galerie', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvel état des lieux d’entrée/ }));
    await user.click(screen.getByRole('button', { name: /Pièces/ }));
    expect(screen.getAllByLabelText('Prendre une photo')[0]).toHaveAttribute('capture', 'environment');
    expect(screen.getAllByLabelText('Importer depuis la galerie')[0]).toHaveAttribute('multiple');
  });

  it('ajoute une photo rattachée à une pièce', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvel état des lieux d’entrée/ }));
    await user.click(screen.getByRole('button', { name: /Pièces/ }));
    const file = new File(['photo'], 'mur.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getAllByLabelText('Prendre une photo')[0], file);
    expect(await screen.findByText('Photo 1')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Légende précise'), 'Mur côté fenêtre');
    expect(screen.getByDisplayValue('Mur côté fenêtre')).toBeInTheDocument();
  });

  it('affiche le fonctionnement seulement pour les équipements testables', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvel état des lieux d’entrée/ }));
    await user.click(screen.getByRole('button', { name: /Pièces/ }));
    expect(screen.getAllByRole('combobox', { name: 'Fonctionnement' }).length).toBeGreaterThan(0);
  });

  it('prévoit les appareils complets dans la cuisine', () => {
    const kitchen = makeRoom('Cuisine');
    expect(kitchen.elements.some((element) => element.label === 'Réfrigérateur')).toBe(true);
    expect(kitchen.elements.some((element) => element.label === 'Four')).toBe(true);
    expect(kitchen.elements.find((element) => element.label === 'Four')?.isTestable).toBe(true);
  });

  it('génère un PDF avec photos, signatures et empreinte', async () => {
    const item = blankCase('entry');
    item.address = '99 avenue PDF, 75000 Exemple';
    item.rooms[0].photos.push({
      id: 'photo-test',
      roomId: item.rooms[0].id,
      caption: 'Photo test',
      createdAt: new Date().toISOString(),
      order: 1,
      dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==',
      rotation: 0,
      compressedBytes: 32000,
      width: 900,
      height: 650
    });
    item.signatures[0].acceptedRead = true;
    item.signatures[0].imageDataUrl = 'data:image/png;base64,c2lnbmF0dXJl';
    const result = await generateInspectionPdf(item);
    expect(result.dataUrl).toContain('data:application/pdf');
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('prépare des lignes PDF sans champs vides ni fonctionnement sur les surfaces', () => {
    const wall = makeElement('Murs');
    const oven = makeElement('Four');
    expect(buildElementLines(wall, 'entry').join('\n')).not.toContain('Fonctionnement');
    expect(buildElementLines(wall, 'entry').join('\n')).not.toContain('description : -');
    expect(buildElementLines(oven, 'entry').join('\n')).toContain('Fonctionnement');
  });

  it('filtre locataires vides, compteurs vides et dates françaises', () => {
    const item = blankCase('entry');
    expect(isTenantNamed(item.tenants[0])).toBe(false);
    expect(isMeterFilled(item.meters[0])).toBe(false);
    expect(formatFrenchDate('2026-07-27')).toContain('2026');
  });

  it('signale les appareils sans état intérieur ou extérieur', () => {
    const item = blankCase('entry');
    const kitchen = makeRoom('Cuisine');
    kitchen.elements = [makeElement('Réfrigérateur')];
    item.rooms = [kitchen];
    expect(validateCase(item).some((issue) => issue.message.includes('état extérieur ou intérieur'))).toBe(true);
  });

  it('permet signature tactile, effacement et nouvelle signature', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Nouvel état des lieux d’entrée/ }));
    await user.click(screen.getByRole('button', { name: /Parties/ }));
    await user.type(screen.getAllByLabelText('Nom')[0], 'Bailleur Test');
    await user.click(screen.getByRole('button', { name: /Signatures/ }));
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getAllByText('Valider la signature')[0]);
    await user.click(screen.getAllByText('Effacer')[0]);
    await user.click(screen.getAllByText('Valider la signature')[0]);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalled();
  });

  it('duplique un état des lieux d’entrée et crée une nouvelle version', () => {
    const item = blankCase('entry');
    item.status = 'finalized';
    item.pdfHash = 'abc';
    const copy = duplicateCase(item, 'exit');
    expect(copy.type).toBe('exit');
    expect(copy.sourceCaseId).toBe(item.id);
    expect(copy.version).toBe(2);
    expect(copy.pdfHash).toBeUndefined();
    expect(copy.signatures.every((signature) => !signature.imageDataUrl)).toBe(true);
  });

  it('prévoit le fonctionnement responsive et hors connexion', () => {
    render(<App />);
    expect(screen.getAllByText(/Stockage local sur cet appareil/)[0]).toBeInTheDocument();
    expect(document.querySelector('.steps')).toBeNull();
  });
});
