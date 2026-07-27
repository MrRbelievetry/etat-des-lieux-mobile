import jsPDF from 'jspdf';
import { sha256DataUrl } from './crypto';
import type { InspectionCase, Photo } from './types';

const legalNotice = `Le présent état des lieux a pour objet de décrire le logement, ses annexes et ses équipements à la date indiquée. Il a été établi entre les personnes identifiées dans le document ou leurs représentants.

Les photographies numérotées et expressément rattachées aux descriptions font partie du présent dossier.

Les indications relatives au fonctionnement d’un équipement correspondent uniquement aux essais effectivement réalisés lors de l’état des lieux. Une mention “non testé” ou “non vérifié” ne permet pas de conclure à son bon ou à son mauvais fonctionnement.

Chaque partie reconnaît avoir eu la possibilité de consulter le document, ses observations et ses photographies, puis de formuler des remarques avant de signer.

La signature manuscrite apposée sur écran matérialise la participation du signataire à l’établissement du document et sa prise de connaissance des constatations qui y figurent. Elle ne constitue pas une signature électronique qualifiée.

Toute modification apportée après la finalisation doit faire l’objet d’une nouvelle version du document et de nouvelles signatures.

Chaque partie doit conserver un exemplaire identique du présent état des lieux.`;

const dataNotice = `Les données recueillies sont utilisées uniquement pour créer, conserver et transmettre le présent état des lieux. Elles sont accessibles aux parties concernées et peuvent être conservées pendant la durée nécessaire à la gestion de la relation locative et d’un éventuel litige.`;

function text(doc: jsPDF, content: string, x: number, y: number, width = 180): number {
  const lines = doc.splitTextToSize(content || '-', width);
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

function ensurePage(doc: jsPDF, y: number, title?: string): number {
  if (y < 270) return y;
  doc.addPage();
  if (title) doc.text(title, 15, 18);
  return 28;
}

function addFooter(doc: jsPDF, item: InspectionCase): void {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`${item.address || 'Adresse non renseignée'} - ${item.id} - v${item.version}`, 15, 288);
    doc.text(`Page ${i} sur ${pages}`, 174, 288);
    doc.setTextColor(20);
  }
}

function addPhoto(doc: jsPDF, photo: Photo, y: number, count: number): number {
  y = ensurePage(doc, y + 5);
  doc.setFontSize(9);
  doc.text(`Photo ${count} - ${photo.caption || 'Sans légende'}${photo.hash ? ` - SHA-256 ${photo.hash.slice(0, 12)}...` : ''}`, 15, y);
  try {
    doc.addImage(photo.dataUrl, 'JPEG', 15, y + 4, 78, 58, undefined, 'FAST', photo.rotation);
  } catch {
    doc.text('Image non intégrable au PDF par le navigateur.', 15, y + 9);
  }
  return y + 68;
}

export async function generateInspectionPdf(item: InspectionCase): Promise<{ dataUrl: string; hash: string }> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setFont('helvetica');
  doc.setFontSize(22);
  doc.text(item.type === 'entry' ? 'État des lieux d’entrée' : 'État des lieux de sortie', 15, 28);
  doc.setFontSize(11);
  let y = 44;
  y = text(doc, `Adresse : ${item.address}`, 15, y);
  y = text(doc, `Date et heure : ${item.date} à ${item.time}`, 15, y);
  y = text(doc, `Bailleur : ${item.lessor.firstName} ${item.lessor.lastName}`, 15, y);
  y = text(doc, `Locataire(s) : ${item.tenants.map((tenant) => `${tenant.firstName} ${tenant.lastName}`).join(', ')}`, 15, y);
  y = text(doc, `Dossier : ${item.id} - version ${item.version}`, 15, y);

  doc.addPage();
  doc.setFontSize(16);
  doc.text('Informations générales', 15, 20);
  doc.setFontSize(10);
  y = 32;
  y = text(doc, `Logement : ${item.housingType}, ${item.furnished ? 'meublé' : 'vide'}, surface ${item.surface || '-'} m², ${item.roomCount || '-'} pièce(s).`, 15, y);
  y = text(doc, `Bâtiment : ${item.building || '-'} ; étage : ${item.floor || '-'} ; porte : ${item.door || '-'}.`, 15, y);
  y = text(doc, `Dépendances : ${item.dependencies || '-'}. Bail : ${item.leaseReference || '-'} ; prise d’effet : ${item.leaseStartDate || '-'}.`, 15, y);
  y = text(doc, `Bailleur : ${item.lessor.civility} ${item.lessor.firstName} ${item.lessor.lastName}, ${item.lessor.address}, ${item.lessor.phone}, ${item.lessor.email}.`, 15, y);
  item.tenants.forEach((tenant) => { y = text(doc, `Locataire : ${tenant.civility} ${tenant.firstName} ${tenant.lastName}, ${tenant.phone}, ${tenant.email}${tenant.newAddress ? `, nouvelle adresse : ${tenant.newAddress}` : ''}.`, 15, y); });
  if (item.agent) y = text(doc, `Mandataire : ${item.agent.name}, ${item.agent.role}, ${item.agent.address}, ${item.agent.phone}, ${item.agent.email}.`, 15, y);

  y = ensurePage(doc, y + 8, 'Compteurs');
  doc.setFontSize(16);
  doc.text('Compteurs', 15, y);
  doc.setFontSize(9);
  y += 10;
  let photoCount = 1;
  item.meters.forEach((meter) => {
    y = ensurePage(doc, y);
    y = text(doc, `${meter.kind} - N° ${meter.number || '-'} - ${meter.location || '-'} - index ${meter.index || '-'} ${meter.unit || ''} - HP ${meter.peakHours || '-'} - HC ${meter.offPeakHours || '-'} - ${meter.observation || '-'}`, 15, y, 180);
    meter.photos.forEach((photo) => { y = addPhoto(doc, photo, y, photoCount); photoCount += 1; });
  });

  y = ensurePage(doc, y + 6, 'Clés');
  doc.setFontSize(16);
  doc.text('Clés et moyens d’accès', 15, y);
  doc.setFontSize(9);
  y += 10;
  item.keys.forEach((key) => {
    y = ensurePage(doc, y);
    y = text(doc, `${key.label} - remis : ${key.delivered} - restitué : ${key.returned} - état : ${key.condition} - ${key.observation || '-'}`, 15, y);
  });

  y = ensurePage(doc, y + 8, 'Pièces');
  doc.setFontSize(16);
  doc.text('Pièces', 15, y);
  doc.setFontSize(9);
  y += 10;
  item.rooms.forEach((room) => {
    y = ensurePage(doc, y + 4, room.name);
    doc.setFontSize(13);
    doc.text(room.name, 15, y);
    doc.setFontSize(9);
    y += 7;
    y = text(doc, `État général : ${room.generalCondition}. Propreté : ${room.cleanliness}. Observations : ${room.observations || '-'}`, 15, y);
    room.photos.forEach((photo) => { y = addPhoto(doc, photo, y, photoCount); photoCount += 1; });
    room.elements.forEach((element) => {
      y = ensurePage(doc, y);
      y = text(doc, `${element.label} - état : ${element.condition} - fonctionnement testé : ${element.tested} - description : ${element.description || '-'} - observations : ${element.observation || '-'}`, 17, y, 176);
      if (item.type === 'exit') y = text(doc, `Sortie : ${element.exitCondition || '-'} ; évolution : ${element.evolution || '-'} ; observations : ${element.exitObservation || '-'}`, 17, y, 176);
      element.photos.forEach((photo) => { y = addPhoto(doc, photo, y, photoCount); photoCount += 1; });
    });
  });

  doc.addPage();
  doc.setFontSize(16);
  doc.text('Synthèse des anomalies', 15, 20);
  doc.setFontSize(9);
  y = 32;
  item.rooms.flatMap((room) => room.elements.map((element) => ({ room, element })))
    .filter(({ element }) => ['état moyen', 'mauvais état', 'hors service', 'absent'].includes(element.condition))
    .forEach(({ room, element }) => { y = text(doc, `${room.name} - ${element.label} - ${element.condition} - ${element.description || element.observation || '-'}`, 15, ensurePage(doc, y)); });

  y = ensurePage(doc, y + 8, 'Observations finales');
  doc.setFontSize(16);
  doc.text('Observations finales', 15, y);
  doc.setFontSize(9);
  y += 10;
  Object.entries(item.observations).forEach(([label, value]) => { y = text(doc, `${label} : ${value || '-'}`, 15, ensurePage(doc, y)); });

  y = ensurePage(doc, y + 8, 'Signatures');
  doc.setFontSize(16);
  doc.text('Signatures', 15, y);
  doc.setFontSize(9);
  y += 10;
  item.signatures.forEach((signature) => {
    y = ensurePage(doc, y);
    y = text(doc, `${signature.role} - ${signature.name || '-'} - ${signature.refused ? `Refus de signer : ${signature.refusalReason || '-'}` : 'Signature manuscrite apposée sur écran après consultation du document.'} ${signature.signedAt || ''}`, 15, y);
    if (signature.imageDataUrl) {
      try {
        doc.addImage(signature.imageDataUrl, 'PNG', 15, y, 70, 26);
      } catch {
        doc.text('Signature non intégrable au PDF par le navigateur.', 15, y + 5);
      }
    }
    y += signature.imageDataUrl ? 32 : 5;
  });

  y = ensurePage(doc, y + 6, 'Mentions');
  doc.setFontSize(16);
  doc.text('Mentions et données', 15, y);
  doc.setFontSize(9);
  y = text(doc, legalNotice, 15, y + 10, 180);
  y = text(doc, dataNotice, 15, ensurePage(doc, y + 5), 180);
  y = text(doc, `Finalisation : ${item.finalizedAt || 'en cours'} - Empreinte SHA-256 indiquée dans le dossier finalisé.`, 15, ensurePage(doc, y + 5));

  addFooter(doc, item);
  const dataUrl = doc.output('datauristring');
  const hash = await sha256DataUrl(dataUrl);
  return { dataUrl, hash };
}
