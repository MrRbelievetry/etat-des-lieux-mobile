export type InspectionType = 'entry' | 'exit';
export type CaseStatus = 'draft' | 'finalized';
export type ElementCondition =
  | 'neuf'
  | 'très bon état'
  | 'bon état'
  | 'état d’usage'
  | 'état moyen'
  | 'mauvais état'
  | 'hors service'
  | 'absent'
  | 'non testé'
  | 'non concerné';
export type Evolution =
  | 'identique'
  | 'amélioration'
  | 'usure apparente'
  | 'dégradation apparente'
  | 'élément remplacé'
  | 'élément manquant'
  | 'non comparable';
export type ElementCategory =
  | 'surface'
  | 'ouverture'
  | 'electricite'
  | 'plomberie'
  | 'chauffage'
  | 'ventilation'
  | 'mobilier'
  | 'electromenager'
  | 'autre';
export type FunctionStatus = 'fonctionne' | 'anomalie constatée' | 'non testé' | 'test impossible' | 'non concerné';
export type ElementPresenceStatus = 'included' | 'absent' | 'hidden';

export interface Person {
  id: string;
  civility: string;
  firstName: string;
  lastName: string;
  address?: string;
  phone: string;
  email: string;
  newAddress?: string;
}

export interface Lessor extends Person {
  address: string;
}

export interface Agent {
  name: string;
  address: string;
  role: string;
  phone: string;
  email: string;
}

export interface Photo {
  id: string;
  roomId?: string;
  elementId?: string;
  caption: string;
  createdAt: string;
  order: number;
  dataUrl: string;
  hash?: string;
  rotation: 0 | 90 | 180 | 270;
  originalBytes?: number;
  compressedBytes?: number;
  width?: number;
  height?: number;
}

export interface Meter {
  id: string;
  kind: string;
  number: string;
  location: string;
  index: string;
  unit: string;
  peakHours: string;
  offPeakHours: string;
  observation: string;
  photos: Photo[];
}

export interface AccessKey {
  id: string;
  label: string;
  delivered: number;
  returned: number;
  condition: string;
  observation: string;
}

export interface RoomElement {
  id: string;
  label: string;
  condition: ElementCondition;
  description: string;
  tested: 'oui' | 'non' | 'non concerné';
  isTestable?: boolean;
  category?: ElementCategory;
  functionStatus?: FunctionStatus;
  presenceStatus?: ElementPresenceStatus;
  brand?: string;
  model?: string;
  serialNumber?: string;
  color?: string;
  exteriorCondition?: ElementCondition | '';
  interiorCondition?: ElementCondition | '';
  cleanliness?: string;
  accessories?: string;
  defectDescription?: string;
  observation: string;
  photos: Photo[];
  entryCondition?: ElementCondition;
  exitCondition?: ElementCondition;
  exitObservation?: string;
  evolution?: Evolution;
}

export interface Room {
  id: string;
  name: string;
  included?: boolean;
  generalCondition: ElementCondition;
  cleanliness: string;
  observations: string;
  photos: Photo[];
  elements: RoomElement[];
}

export interface Signature {
  id: string;
  personId: string;
  name: string;
  role: string;
  acceptedRead: boolean;
  refused: boolean;
  refusalReason: string;
  observation: string;
  imageDataUrl?: string;
  signedAt?: string;
}

export interface InspectionCase {
  id: string;
  version: number;
  status: CaseStatus;
  type: InspectionType;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  pdfDataUrl?: string;
  pdfHash?: string;
  title: string;
  date: string;
  time: string;
  address: string;
  building: string;
  floor: string;
  door: string;
  housingType: string;
  furnished: boolean;
  surface: string;
  roomCount: string;
  dependencies: string;
  leaseReference: string;
  leaseStartDate: string;
  lessor: Lessor;
  tenants: Person[];
  agent?: Agent;
  meters: Meter[];
  keys: AccessKey[];
  rooms: Room[];
  observations: {
    lessor: string;
    tenant: string;
    disagreement: string;
    reservations: string;
    untested: string;
    plannedWorks: string;
    extra: string;
  };
  signatures: Signature[];
  sourceCaseId?: string;
  propertyId?: string;
  propertyUpdatedAt?: string;
  lastStep?: number;
  lastSavedAt?: string;
  mainPhotoDataUrl?: string;
  lessorLogoDataUrl?: string;
}

export interface PropertyRecord {
  id: string;
  address: string;
  housingType: string;
  furnished: boolean;
  surface: string;
  roomCount: string;
  dependencies: string;
  lessor: Lessor;
  mainPhotoDataUrl?: string;
  createdAt: string;
  updatedAt: string;
}
