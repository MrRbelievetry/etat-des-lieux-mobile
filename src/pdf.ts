import jsPDF from 'jspdf';
import { withElementDefaults } from './constants';
import { sha256DataUrl } from './crypto';
import type { InspectionCase, Meter, Photo, RoomElement, Signature } from './types';

const page = { left: 14, right: 196, top: 16, bottom: 282 };
const seriousStates = new Set(['état moyen', 'mauvais état', 'hors service', 'absent']);

const legalNotice = `Le présent état des lieux décrit le logement, ses annexes et ses équipements à la date indiquée. Les photographies numérotées et rattachées aux constatations font partie du dossier.

Les indications relatives au fonctionnement concernent uniquement les équipements effectivement testables et les essais réalisés pendant l'état des lieux. Les éléments de surface, revêtements, murs, sols ou plafonds ne font pas l'objet d'un essai de fonctionnement.

Chaque partie reconnaît avoir pu consulter le document, ses observations et ses photographies avant signature. La signature manuscrite apposée sur écran matérialise la prise de connaissance du document ; elle ne constitue pas une signature électronique qualifiée.

Toute modification après finalisation doit faire l'objet d'une nouvelle version du document. Chaque partie doit conserver un exemplaire identique du présent état des lieux.`;

function compact(values: Array<string | undefined | null | false>): string[] {
  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

function personName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

export function isTenantNamed(tenant: { firstName: string; lastName: string }) {
  return Boolean(personName(tenant));
}

export function formatFrenchDate(value: string, fallback = 'Non renseignée'): string {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatFrenchDateTime(value?: string): string {
  if (!value) return 'Non finalisé';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

export function isMeterFilled(meter: Meter): boolean {
  return compact([meter.number, meter.location, meter.index, meter.unit, meter.peakHours, meter.offPeakHours, meter.observation]).length > 0 || meter.photos.length > 0;
}

function addHeader(doc: jsPDF, item: InspectionCase, title: string) {
  doc.setFillColor(25, 34, 42);
  doc.rect(0, 0, 210, 12, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title, page.left, 8);
  doc.setFont('helvetica', 'normal');
  doc.text(item.id, 168, 8);
  doc.setTextColor(25);
}

function ensurePage(doc: jsPDF, item: InspectionCase, y: number, title: string): number {
  if (y <= page.bottom) return y;
  doc.addPage();
  addHeader(doc, item, title);
  return page.top + 6;
}

function writeText(doc: jsPDF, item: InspectionCase, text: string, x: number, y: number, width = page.right - x, title = ''): number {
  const clean = text.trim();
  if (!clean) return y;
  const lines = doc.splitTextToSize(clean, width);
  y = ensurePage(doc, item, y + lines.length * 4.6, title);
  doc.text(lines, x, y - (lines.length - 1) * 4.6);
  return y + 4.6;
}

function section(doc: jsPDF, item: InspectionCase, title: string, y: number): number {
  y = ensurePage(doc, item, y + 14, title);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, page.left, y);
  doc.setDrawColor(210);
  doc.line(page.left, y + 2, page.right, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  return y + 8;
}

function labeledLine(label: string, values: Array<string | undefined | null | false>) {
  const body = compact(values).join(' ; ');
  return body ? `${label} : ${body}` : '';
}

function collectPhotos(item: InspectionCase): Array<{ photo: Photo; label: string }> {
  const photos: Array<{ photo: Photo; label: string }> = [];
  item.meters.forEach((meter) => meter.photos.forEach((photo) => photos.push({ photo, label: `Compteur - ${meter.kind}` })));
  item.rooms.forEach((room) => {
    room.photos.forEach((photo) => photos.push({ photo, label: room.name }));
    room.elements.forEach((element) => element.photos.forEach((photo) => photos.push({ photo, label: `${room.name} - ${element.label}` })));
  });
  return photos;
}

export function buildElementLines(rawElement: RoomElement, type: InspectionCase['type']): string[] {
  const element = withElementDefaults(rawElement);
  const lines = [
    labeledLine(element.label, [
      `état : ${element.condition}`,
      element.description && `description : ${element.description}`,
      element.observation && `observation : ${element.observation}`
    ])
  ];

  if (element.isTestable) {
    lines.push(labeledLine('Fonctionnement', [element.functionStatus || 'non testé', element.defectDescription && `défaut : ${element.defectDescription}`]));
  }

  if (element.category === 'electromenager') {
    lines.push(labeledLine('Appareil', [
      element.brand && `marque : ${element.brand}`,
      element.model && `modèle : ${element.model}`,
      element.serialNumber && `n° série : ${element.serialNumber}`,
      element.color && `couleur : ${element.color}`,
      element.exteriorCondition && `extérieur : ${element.exteriorCondition}`,
      element.interiorCondition && `intérieur : ${element.interiorCondition}`,
      element.cleanliness && `propreté : ${element.cleanliness}`,
      element.accessories && `accessoires : ${element.accessories}`
    ]));
  }

  if (type === 'exit') {
    lines.push(labeledLine('Sortie', [
      element.exitCondition && `état : ${element.exitCondition}`,
      element.evolution && `évolution : ${element.evolution}`,
      element.exitObservation && `observation : ${element.exitObservation}`
    ]));
  }

  return lines.filter(Boolean);
}

function addPhotoGrid(doc: jsPDF, item: InspectionCase, y: number, title: string): number {
  const photos = collectPhotos(item);
  if (!photos.length) return y;
  y = section(doc, item, title, y);
  const columns = 3;
  const gap = 5;
  const cellWidth = (page.right - page.left - gap * (columns - 1)) / columns;
  const imageHeight = 34;
  let index = 0;

  photos.forEach(({ photo, label }, photoIndex) => {
    if (index % columns === 0) y = ensurePage(doc, item, y + imageHeight + 13, title);
    const column = index % columns;
    const x = page.left + column * (cellWidth + gap);
    const top = y - imageHeight - 7;
    doc.setDrawColor(225);
    doc.roundedRect(x, top, cellWidth, imageHeight + 9, 1.5, 1.5);
    try {
      const ratio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
      const drawWidth = ratio >= cellWidth / imageHeight ? cellWidth : imageHeight * ratio;
      const drawHeight = ratio >= cellWidth / imageHeight ? cellWidth / ratio : imageHeight;
      const imageX = x + (cellWidth - drawWidth) / 2;
      const imageY = top + (imageHeight - drawHeight) / 2;
      doc.addImage(photo.dataUrl, 'JPEG', imageX, imageY, drawWidth, drawHeight, undefined, 'FAST', photo.rotation);
    } catch {
      doc.text('Image non intégrable', x + 2, top + 18);
    }
    doc.setFontSize(7);
    const caption = compact([`Photo ${photoIndex + 1}`, label, photo.caption]).join(' - ');
    doc.text(doc.splitTextToSize(caption, cellWidth - 4).slice(0, 2), x + 2, top + imageHeight + 4);
    doc.setFontSize(9);
    index += 1;
  });
  return y + 6;
}

function addSignatureCard(doc: jsPDF, item: InspectionCase, signature: Signature, x: number, y: number): void {
  doc.setDrawColor(215);
  doc.roundedRect(x, y, 86, 36, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.text(signature.role, x + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(signature.name || 'Nom non renseigné', x + 4, y + 12);
  if (signature.refused) {
    doc.text(doc.splitTextToSize(`Refus de signer : ${signature.refusalReason || 'motif non renseigné'}`, 78), x + 4, y + 19);
    return;
  }
  if (signature.imageDataUrl) {
    try {
      doc.addImage(signature.imageDataUrl, 'PNG', x + 4, y + 15, 54, 16);
    } catch {
      doc.text('Signature non intégrable', x + 4, y + 22);
    }
  } else {
    doc.text('Signature manquante', x + 4, y + 22);
  }
  if (signature.signedAt) doc.text(formatFrenchDateTime(signature.signedAt), x + 4, y + 34);
}

function addFooter(doc: jsPDF, item: InspectionCase): void {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(95);
    doc.text(`${item.address || 'Adresse non renseignée'} - version ${item.version}`, page.left, 290);
    doc.text(`Page ${i} sur ${pages}`, 174, 290);
    doc.setTextColor(25);
  }
}

export async function generateInspectionPdf(item: InspectionCase): Promise<{ dataUrl: string; hash: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setFont('helvetica', 'normal');
  addHeader(doc, item, 'État des lieux');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(item.type === 'entry' ? "État des lieux d'entrée" : 'État des lieux de sortie', page.left, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = 43;
  y = writeText(doc, item, labeledLine('Adresse', [item.address || 'Non renseignée']), page.left, y);
  y = writeText(doc, item, labeledLine('Date et heure', [formatFrenchDate(item.date), item.time]), page.left, y);
  y = writeText(doc, item, labeledLine('Dossier', [item.id, `version ${item.version}`, item.status === 'finalized' ? 'finalisé' : 'brouillon']), page.left, y);

  y = section(doc, item, 'Logement', y);
  y = writeText(doc, item, labeledLine('Description', [item.housingType, item.furnished ? 'meublé' : 'vide', item.surface && `${item.surface} m²`, item.roomCount && `${item.roomCount} pièce(s)`]), page.left, y);
  y = writeText(doc, item, labeledLine('Situation', [item.building && `bâtiment ${item.building}`, item.floor && `étage ${item.floor}`, item.door && `porte ${item.door}`]), page.left, y);
  y = writeText(doc, item, labeledLine('Bail', [item.leaseReference, item.leaseStartDate && `prise d'effet : ${formatFrenchDate(item.leaseStartDate)}`, item.dependencies && `dépendances : ${item.dependencies}`]), page.left, y);

  y = section(doc, item, 'Parties', y);
  y = writeText(doc, item, labeledLine('Bailleur', [personName(item.lessor), item.lessor.address, item.lessor.phone, item.lessor.email]), page.left, y);
  item.tenants.filter(isTenantNamed).forEach((tenant) => {
    y = writeText(doc, item, labeledLine('Locataire', [personName(tenant), tenant.phone, tenant.email, item.type === 'exit' && tenant.newAddress && `nouvelle adresse : ${tenant.newAddress}`]), page.left, y);
  });
  if (item.agent && compact([item.agent.name, item.agent.role, item.agent.address, item.agent.phone, item.agent.email]).length) {
    y = writeText(doc, item, labeledLine('Mandataire', [item.agent.name, item.agent.role, item.agent.address, item.agent.phone, item.agent.email]), page.left, y);
  }

  const meters = item.meters.filter(isMeterFilled);
  if (meters.length) {
    y = section(doc, item, 'Compteurs', y);
    meters.forEach((meter) => {
      y = writeText(doc, item, labeledLine(meter.kind, [meter.number && `n° ${meter.number}`, meter.location, meter.index && `index ${meter.index}${meter.unit ? ` ${meter.unit}` : ''}`, meter.peakHours && `HP ${meter.peakHours}`, meter.offPeakHours && `HC ${meter.offPeakHours}`, meter.observation]), page.left, y);
    });
  }

  const keys = item.keys.filter((key) => key.delivered || key.returned || key.observation || key.condition);
  if (keys.length) {
    y = section(doc, item, "Clés et moyens d'accès", y);
    keys.forEach((key) => {
      y = writeText(doc, item, labeledLine(key.label, [`remis : ${key.delivered}`, `restitué : ${key.returned}`, key.condition && `état : ${key.condition}`, key.observation]), page.left, y);
    });
  }

  y = section(doc, item, 'Pièces et éléments', y);
  item.rooms.forEach((room) => {
    y = ensurePage(doc, item, y + 12, room.name);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(room.name, page.left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 6;
    y = writeText(doc, item, labeledLine('État général', [room.generalCondition, room.cleanliness && `propreté : ${room.cleanliness}`, room.observations]), page.left, y, page.right - page.left, room.name);
    room.elements.forEach((element) => {
      buildElementLines(element, item.type).forEach((line) => {
        y = writeText(doc, item, line, page.left + 3, y, page.right - page.left - 3, room.name);
      });
    });
  });

  const anomalies = item.rooms.flatMap((room) => room.elements.map((element) => ({ room, element: withElementDefaults(element) }))).filter(({ element }) => seriousStates.has(element.condition) || element.functionStatus === 'anomalie constatée');
  if (anomalies.length) {
    y = section(doc, item, 'Synthèse des anomalies', y);
    anomalies.forEach(({ room, element }) => {
      y = writeText(doc, item, `${room.name} - ${element.label} : ${compact([element.condition, element.description, element.observation, element.defectDescription]).join(' ; ')}`, page.left, y);
    });
  }

  const observations = [
    ['Bailleur', item.observations.lessor],
    ['Locataire', item.observations.tenant],
    ['Désaccord', item.observations.disagreement],
    ['Réserves', item.observations.reservations],
    ['Équipements non testés', item.observations.untested],
    ['Travaux prévus', item.observations.plannedWorks],
    ['Complément', item.observations.extra]
  ].filter(([, value]) => value.trim());
  if (observations.length) {
    y = section(doc, item, 'Observations finales', y);
    observations.forEach(([label, value]) => {
      y = writeText(doc, item, `${label} : ${value}`, page.left, y);
    });
  }

  y = addPhotoGrid(doc, item, y, 'Photographies');

  const signatures = item.signatures.filter((signature) => signature.name.trim() || signature.imageDataUrl || signature.refused);
  if (signatures.length) {
    y = section(doc, item, 'Signatures', y);
    signatures.forEach((signature, index) => {
      if (index % 2 === 0) y = ensurePage(doc, item, y + 42, 'Signatures');
      addSignatureCard(doc, item, signature, index % 2 === 0 ? page.left : 110, y - 38);
    });
    y += signatures.length % 2 === 0 ? 0 : 38;
  }

  y = section(doc, item, 'Mentions', y);
  y = writeText(doc, item, legalNotice, page.left, y);
  y = writeText(doc, item, `Finalisation : ${formatFrenchDateTime(item.finalizedAt)}.`, page.left, y + 3);

  const photos = collectPhotos(item);
  if (photos.length) {
    doc.addPage();
    addHeader(doc, item, 'Annexe d’intégrité');
    y = page.top + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Annexe d’intégrité des photographies', page.left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += 8;
    photos.forEach(({ photo }, index) => {
      const size = photo.compressedBytes ? `${Math.round(photo.compressedBytes / 1024)} ko` : '';
      y = writeText(doc, item, compact([`Photo ${index + 1}`, photo.caption, size, photo.hash && `SHA-256 ${photo.hash}`]).join(' - '), page.left, y, page.right - page.left, 'Annexe d’intégrité');
    });
  }

  addFooter(doc, item);
  const dataUrl = doc.output('datauristring');
  const hash = await sha256DataUrl(dataUrl);
  return { dataUrl, hash };
}
