import { includedRooms, visibleElements } from './constants';
import type { InspectionCase, Meter } from './types';

const seriousStates = new Set(['état moyen', 'mauvais état', 'hors service']);

export interface ValidationIssue {
  section: string;
  message: string;
}

function hasName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim().length > 0;
}

function filledMeterFields(meter: Meter) {
  return [meter.number, meter.location, meter.index, meter.unit, meter.peakHours, meter.offPeakHours, meter.observation].filter((value) => value.trim()).length;
}

export function validateCase(item: InspectionCase): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!item.address.trim()) issues.push({ section: 'general', message: 'Adresse du logement manquante.' });
  if (!item.lessor.lastName.trim()) issues.push({ section: 'parties', message: 'Nom du bailleur manquant.' });

  const namedTenants = item.tenants.filter(hasName);
  if (!namedTenants.length) issues.push({ section: 'parties', message: 'Au moins un locataire doit être renseigné.' });
  item.tenants.filter((tenant) => !hasName(tenant) && (tenant.phone.trim() || tenant.email.trim())).forEach(() => {
    issues.push({ section: 'parties', message: 'Un locataire partiellement renseigné n’a pas de nom.' });
  });

  item.meters.forEach((meter) => {
    const filled = filledMeterFields(meter);
    if (filled > 0 && !meter.index.trim() && !meter.observation.trim()) {
      issues.push({ section: 'meters', message: `Compteur ${meter.kind} partiellement renseigné : ajoutez l’index ou une observation.` });
    }
  });

  includedRooms(item.rooms).forEach((room) => {
    room.photos.filter((photo) => !photo.caption.trim()).forEach(() => issues.push({ section: 'rooms', message: `${room.name} contient une photo sans légende.` }));
    visibleElements(room.elements).forEach((element) => {
      if (element.presenceStatus === 'absent') return;
      if (seriousStates.has(element.condition) && !element.description.trim()) {
        issues.push({ section: 'rooms', message: `${room.name} - ${element.label} nécessite une description précise.` });
      }
      if (element.functionStatus === 'anomalie constatée' && !element.defectDescription?.trim() && !element.description.trim()) {
        issues.push({ section: 'rooms', message: `${room.name} - ${element.label} a une anomalie de fonctionnement sans description.` });
      }
      if (element.category === 'electromenager' && !element.exteriorCondition && !element.interiorCondition) {
        issues.push({ section: 'rooms', message: `${room.name} - ${element.label} : renseignez au moins l’état extérieur ou intérieur.` });
      }
      element.photos.filter((photo) => !photo.caption.trim()).forEach(() => issues.push({ section: 'rooms', message: `${room.name} - ${element.label} contient une photo sans légende.` }));
    });
  });

  item.signatures.filter((signature) => signature.name.trim()).forEach((signature) => {
    if (!signature.refused && !signature.imageDataUrl) issues.push({ section: 'signatures', message: `Signature manquante : ${signature.role}.` });
  });
  return issues;
}
