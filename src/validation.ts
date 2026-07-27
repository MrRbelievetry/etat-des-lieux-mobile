import type { InspectionCase } from './types';

const seriousStates = new Set(['état moyen', 'mauvais état', 'hors service']);

export interface ValidationIssue {
  section: string;
  message: string;
}

export function validateCase(item: InspectionCase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!item.address.trim()) issues.push({ section: 'general', message: 'Adresse du logement manquante.' });
  if (!item.lessor.lastName.trim()) issues.push({ section: 'parties', message: 'Nom du bailleur manquant.' });
  if (item.tenants.some((tenant) => !tenant.lastName.trim())) issues.push({ section: 'parties', message: 'Au moins un locataire n’a pas de nom.' });
  item.meters.forEach((meter) => {
    if (!meter.index.trim()) issues.push({ section: 'meters', message: `Compteur ${meter.kind} sans index.` });
  });
  item.rooms.forEach((room) => {
    if (!room.observations.trim()) issues.push({ section: 'rooms', message: `${room.name} n’a pas d’observation générale.` });
    room.photos.filter((photo) => !photo.caption.trim()).forEach(() => issues.push({ section: 'rooms', message: `${room.name} contient une photo sans légende.` }));
    room.elements.forEach((element) => {
      if (seriousStates.has(element.condition) && !element.description.trim()) {
        issues.push({ section: 'rooms', message: `${room.name} - ${element.label} nécessite une description précise.` });
      }
      element.photos.filter((photo) => !photo.caption.trim()).forEach(() => issues.push({ section: 'rooms', message: `${room.name} - ${element.label} contient une photo sans légende.` }));
    });
  });
  item.signatures.forEach((signature) => {
    if (!signature.refused && !signature.imageDataUrl) issues.push({ section: 'signatures', message: `Signature manquante : ${signature.role}.` });
  });
  return issues;
}
