import jsPDF from 'jspdf';
import { includedRooms, visibleElements, withElementDefaults } from './constants';
import { sha256DataUrl } from './crypto';
import type { AccessKey, InspectionCase, Meter, Photo, Room, RoomElement, Signature } from './types';

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

export function isKeyFilled(key: AccessKey): boolean {
  return key.delivered > 0 || key.returned > 0 || Boolean(key.observation.trim());
}

export function pdfRooms(item: InspectionCase): Room[] {
  return includedRooms(item.rooms);
}

function pdfElements(room: Room): RoomElement[] {
  return visibleElements(room.elements);
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

function fitImage(photo: Photo, maxWidth: number, maxHeight: number) {
  const ratio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  const width = ratio >= maxWidth / maxHeight ? maxWidth : maxHeight * ratio;
  const height = ratio >= maxWidth / maxHeight ? maxWidth / ratio : maxHeight;
  return { width, height };
}

function addPhoto(doc: jsPDF, item: InspectionCase, photo: Photo, label: string, y: number, index: number): number {
  y = ensurePage(doc, item, y + 42, label);
  const top = y - 38;
  try {
    const size = fitImage(photo, 58, 34);
    doc.addImage(photo.dataUrl, 'JPEG', page.left + 2, top, size.width, size.height, undefined, 'FAST', photo.rotation);
  } catch {
    doc.text('Image non intégrable', page.left + 2, top + 16);
  }
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(compact([`Photo ${index}`, photo.caption]).join(' - '), 108), page.left + 66, top + 6);
  doc.setFontSize(9);
  return y + 3;
}

function collectPhotos(item: InspectionCase): Array<{ photo: Photo; label: string }> {
  const photos: Array<{ photo: Photo; label: string }> = [];
  item.meters.filter(isMeterFilled).forEach((meter) => meter.photos.forEach((photo) => photos.push({ photo, label: `Compteur - ${meter.kind}` })));
  pdfRooms(item).forEach((room) => {
    room.photos.forEach((photo) => photos.push({ photo, label: room.name }));
    pdfElements(room).forEach((element) => element.photos.forEach((photo) => photos.push({ photo, label: `${room.name} - ${element.label}` })));
  });
  return photos;
}

export function buildElementLines(rawElement: RoomElement, type: InspectionCase['type']): string[] {
  const element = withElementDefaults(rawElement);
  if (element.presenceStatus === 'hidden') return [];
  if (element.presenceStatus === 'absent') return [`${element.label} — Absent lors de l’état des lieux`];

  const lines = [
    labeledLine(element.label, [
      `état : ${element.condition}`,
      element.description && `description : ${element.description}`,
      element.observation && `observation : ${element.observation}`
    ])
  ];

  if (element.isTestable && element.functionStatus && element.functionStatus !== 'non concerné') {
    lines.push(labeledLine('Fonctionnement', [element.functionStatus, element.defectDescription && `défaut : ${element.defectDescription}`]));
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

function addCoverCard(doc: jsPDF, title: string, lines: string[], x: number, y: number, width: number, height: number) {
  doc.setDrawColor(214, 220, 226);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, height, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, x + 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  lines.slice(0, 5).forEach((line, index) => doc.text(doc.splitTextToSize(line, width - 10), x + 5, y + 16 + index * 6));
}

function addCoverPage(doc: jsPDF, item: InspectionCase) {
  doc.setFillColor(24, 43, 58);
  doc.rect(0, 0, 210, 58, 'F');
  doc.setFillColor(231, 237, 242);
  doc.rect(0, 58, 210, 239, 'F');
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text(item.type === 'entry' ? "ÉTAT DES LIEUX D'ENTRÉE" : 'ÉTAT DES LIEUX DE SORTIE', page.left, 28);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Document comprenant constatations, photographies et signatures', page.left, 40);

  if (item.lessorLogoDataUrl) {
    try {
      doc.addImage(item.lessorLogoDataUrl, 'PNG', 164, 18, 28, 18, undefined, 'FAST');
    } catch {
      doc.setDrawColor(255);
      doc.roundedRect(164, 18, 28, 18, 2, 2);
    }
  }

  doc.setTextColor(25, 34, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(doc.splitTextToSize(item.address || 'Adresse non renseignée', 120), page.left, 76);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Le ${formatFrenchDate(item.date)}${item.time ? ` à ${item.time}` : ''}`, page.left, 92);

  const mainPhoto = item.mainPhotoDataUrl || pdfRooms(item).flatMap((room) => room.photos)[0]?.dataUrl;
  if (mainPhoto) {
    try {
      doc.addImage(mainPhoto, 'JPEG', 132, 68, 58, 38, undefined, 'FAST');
    } catch {
      doc.setFillColor(238, 242, 246);
      doc.roundedRect(132, 68, 58, 38, 2, 2, 'F');
    }
  } else {
    doc.setFillColor(238, 242, 246);
    doc.roundedRect(132, 68, 58, 38, 2, 2, 'F');
    doc.setFontSize(8);
    doc.text('Photo principale facultative', 140, 88);
  }

  addCoverCard(doc, 'Logement', compact([item.housingType, item.furnished ? 'Logement meublé' : 'Logement vide', item.surface && `${item.surface} m²`, item.roomCount && `${item.roomCount} pièce(s)`]), page.left, 120, 54, 42);
  addCoverCard(doc, 'Bailleur', compact([personName(item.lessor), item.lessor.phone, item.lessor.email]), 78, 120, 54, 42);
  addCoverCard(doc, 'Locataire(s)', item.tenants.filter(isTenantNamed).map(personName), 142, 120, 54, 42);
  addCoverCard(doc, 'Dossier', [`Identifiant : ${item.id}`, `Version : ${item.version}`, item.status === 'finalized' ? 'Statut : finalisé' : 'Statut : brouillon'], page.left, 176, 182, 34);

  doc.setTextColor(95);
  doc.setFontSize(8);
  doc.text('Les compteurs, clés, équipements, photographies détaillées et empreintes techniques figurent dans les pages suivantes.', page.left, 232);
  doc.setTextColor(25);
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
  addCoverPage(doc, item);
  doc.addPage();
  addHeader(doc, item, 'Informations générales');
  doc.setFontSize(10);
  let y = page.top + 8;

  y = section(doc, item, 'Logement et parties', y);
  y = writeText(doc, item, labeledLine('Description', [item.housingType, item.furnished ? 'meublé' : 'vide', item.surface && `${item.surface} m²`, item.roomCount && `${item.roomCount} pièce(s)`]), page.left, y);
  y = writeText(doc, item, labeledLine('Situation', [item.building && `bâtiment ${item.building}`, item.floor && `étage ${item.floor}`, item.door && `porte ${item.door}`, item.dependencies && `dépendances : ${item.dependencies}`]), page.left, y);
  y = writeText(doc, item, labeledLine('Bailleur', [personName(item.lessor), item.lessor.address, item.lessor.phone, item.lessor.email]), page.left, y);
  item.tenants.filter(isTenantNamed).forEach((tenant) => {
    y = writeText(doc, item, labeledLine('Locataire', [personName(tenant), tenant.phone, tenant.email, item.type === 'exit' && tenant.newAddress && `nouvelle adresse : ${tenant.newAddress}`]), page.left, y);
  });

  const meters = item.meters.filter(isMeterFilled);
  if (meters.length) {
    y = section(doc, item, 'Compteurs', y);
    meters.forEach((meter) => {
      y = writeText(doc, item, labeledLine(meter.kind, [meter.number && `n° ${meter.number}`, meter.location, meter.index && `index ${meter.index}${meter.unit ? ` ${meter.unit}` : ''}`, meter.peakHours && `HP ${meter.peakHours}`, meter.offPeakHours && `HC ${meter.offPeakHours}`, meter.observation]), page.left, y);
      meter.photos.forEach((photo, index) => { y = addPhoto(doc, item, photo, meter.kind, y, index + 1); });
    });
  }

  const keys = item.keys.filter(isKeyFilled);
  if (keys.length) {
    y = section(doc, item, "Clés et moyens d'accès", y);
    keys.forEach((key) => {
      y = writeText(doc, item, labeledLine(key.label, [`remis : ${key.delivered}`, `restitué : ${key.returned}`, key.observation]), page.left, y);
    });
  }

  y = section(doc, item, 'Pièces et éléments', y);
  let photoIndex = 1;
  pdfRooms(item).forEach((room) => {
    y = ensurePage(doc, item, y + 12, room.name);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(room.name, page.left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    y += 6;
    y = writeText(doc, item, labeledLine('État général', [room.generalCondition, room.cleanliness && `propreté : ${room.cleanliness}`, room.observations]), page.left, y, page.right - page.left, room.name);
    room.photos.forEach((photo) => { y = addPhoto(doc, item, photo, room.name, y, photoIndex); photoIndex += 1; });
    pdfElements(room).forEach((element) => {
      buildElementLines(element, item.type).forEach((line) => {
        y = writeText(doc, item, line, page.left + 3, y, page.right - page.left - 3, room.name);
      });
      element.photos.forEach((photo) => { y = addPhoto(doc, item, photo, element.label, y, photoIndex); photoIndex += 1; });
    });
  });

  const anomalies = pdfRooms(item).flatMap((room) => pdfElements(room).map((element) => ({ room, element }))).filter(({ element }) => seriousStates.has(element.condition) || element.functionStatus === 'anomalie constatée' || element.presenceStatus === 'absent');
  if (anomalies.length) {
    y = section(doc, item, 'Synthèse des anomalies', y);
    anomalies.forEach(({ room, element }) => {
      y = writeText(doc, item, `${room.name} - ${element.label} : ${compact([element.presenceStatus === 'absent' ? 'Absent lors de l’état des lieux' : element.condition, element.description, element.observation, element.defectDescription]).join(' ; ')}`, page.left, y);
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
    photos.forEach(({ photo, label }, index) => {
      const size = photo.compressedBytes ? `${Math.round(photo.compressedBytes / 1024)} ko` : '';
      y = writeText(doc, item, compact([`Photo ${index + 1}`, label, photo.caption, size, photo.hash && `SHA-256 ${photo.hash}`]).join(' - '), page.left, y, page.right - page.left, 'Annexe d’intégrité');
    });
  }

  addFooter(doc, item);
  const dataUrl = doc.output('datauristring');
  const hash = await sha256DataUrl(dataUrl);
  return { dataUrl, hash };
}
