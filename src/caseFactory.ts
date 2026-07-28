import { keyKinds, makeKey, makeMeter, makeRoom, meterKinds, withElementDefaults } from './constants';
import type { InspectionCase, InspectionType, Signature } from './types';

const today = new Date();
const date = today.toISOString().slice(0, 10);
const time = today.toTimeString().slice(0, 5);

export function blankCase(type: InspectionType = 'entry'): InspectionCase {
  const lessorId = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const propertyId = crypto.randomUUID();
  const id = `EDL-${date.replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const signatures: Signature[] = [
    { id: crypto.randomUUID(), personId: lessorId, name: '', role: 'Bailleur', acceptedRead: false, refused: false, refusalReason: '', observation: '' },
    { id: crypto.randomUUID(), personId: tenantId, name: '', role: 'Locataire', acceptedRead: false, refused: false, refusalReason: '', observation: '' }
  ];

  return {
    id,
    version: 1,
    status: 'draft',
    type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    propertyId,
    title: type === 'entry' ? 'État des lieux d’entrée' : 'État des lieux de sortie',
    date,
    time,
    address: '',
    building: '',
    floor: '',
    door: '',
    housingType: 'Appartement',
    furnished: false,
    surface: '',
    roomCount: '',
    dependencies: '',
    leaseReference: '',
    leaseStartDate: '',
    lessor: { id: lessorId, civility: 'M.', firstName: '', lastName: '', address: '', phone: '', email: '' },
    tenants: [{ id: tenantId, civility: 'M.', firstName: '', lastName: '', phone: '', email: '', newAddress: '' }],
    agent: undefined,
    meters: meterKinds.map(makeMeter),
    keys: keyKinds.slice(0, 6).map(makeKey),
    rooms: ['Entrée', 'Séjour', 'Cuisine', 'Chambre', 'Salle de bains', 'WC'].map(makeRoom),
    observations: { lessor: '', tenant: '', disagreement: '', reservations: '', untested: '', plannedWorks: '', extra: '' },
    lastStep: 0,
    signatures
  };
}

export function demoCase(): InspectionCase {
  const draft = blankCase('entry');
  draft.address = '12 rue Exemple, 75000 Ville-Fictive';
  draft.surface = '62';
  draft.roomCount = '3';
  draft.lessor = { ...draft.lessor, firstName: 'Camille', lastName: 'Propriétaire-Test', address: '1 avenue Démo, 75000 Ville-Fictive', phone: '0100000000', email: 'camille.proprietaire@example.test' };
  draft.tenants[0] = { ...draft.tenants[0], firstName: 'Alex', lastName: 'Locataire-Test', phone: '0200000000', email: 'alex.locataire@example.test' };
  draft.rooms[1].elements[1].condition = 'état moyen';
  draft.rooms[1].elements[1].description = 'Deux trous d’environ 5 mm sur le mur côté fenêtre, à environ 1 mètre du sol.';
  const kitchen = draft.rooms.find((room) => room.name === 'Cuisine');
  const fridge = kitchen?.elements.find((element) => element.label === 'Réfrigérateur');
  if (fridge) {
    fridge.brand = 'Marque Démo';
    fridge.model = 'Froid 2000';
    fridge.color = 'Blanc';
    fridge.exteriorCondition = 'bon état';
    fridge.interiorCondition = 'bon état';
    fridge.cleanliness = 'Propre';
    fridge.functionStatus = 'fonctionne';
    fridge.presenceStatus = 'included';
  }
  draft.observations.lessor = 'Dossier fictif fourni pour tester l’application.';
  return draft;
}

export function duplicateCase(source: InspectionCase, type = source.type): InspectionCase {
  const copy = structuredClone(source);
  copy.id = `EDL-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  copy.version = source.status === 'finalized' ? source.version + 1 : source.version;
  copy.status = 'draft';
  copy.type = type;
  copy.sourceCaseId = source.id;
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = new Date().toISOString();
  copy.finalizedAt = undefined;
  copy.pdfDataUrl = undefined;
  copy.pdfHash = undefined;
  copy.rooms = copy.rooms.map((room) => ({ ...room, included: room.included !== false, elements: room.elements.map(withElementDefaults) }));
  copy.signatures = copy.signatures.map((signature) => ({ ...signature, id: crypto.randomUUID(), acceptedRead: false, refused: false, imageDataUrl: undefined, signedAt: undefined }));
  return copy;
}
