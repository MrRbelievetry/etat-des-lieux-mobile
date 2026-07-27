import type { AccessKey, ElementCondition, Meter, Room, RoomElement } from './types';

export const conditionOptions: ElementCondition[] = [
  'neuf',
  'très bon état',
  'bon état',
  'état d’usage',
  'état moyen',
  'mauvais état',
  'hors service',
  'absent',
  'non testé',
  'non concerné'
];

export const roomNames = [
  'Entrée',
  'Séjour',
  'Cuisine',
  'Chambre',
  'Salle de bains',
  'Salle d’eau',
  'WC',
  'Couloir',
  'Bureau',
  'Dressing',
  'Cellier',
  'Buanderie',
  'Garage',
  'Cave',
  'Balcon',
  'Terrasse',
  'Jardin',
  'Autre'
];

export const elementNames = [
  'Sol',
  'Murs',
  'Plafond',
  'Plinthes',
  'Portes',
  'Poignées',
  'Serrures',
  'Fenêtres',
  'Vitrages',
  'Volets',
  'Stores',
  'Prises électriques',
  'Interrupteurs',
  'Luminaires',
  'Chauffage',
  'Ventilation',
  'Placards',
  'Mobilier',
  'Plomberie',
  'Sanitaires',
  'Électroménager',
  'Autre équipement'
];

export const meterKinds = ['Électricité', 'Eau froide', 'Eau chaude', 'Gaz', 'Chauffage', 'Autre compteur'];
export const keyKinds = ['Clé de porte d’entrée', 'Clé de boîte aux lettres', 'Clé de portail', 'Clé de cave', 'Clé de garage', 'Badge', 'Bip', 'Télécommande', 'Autre'];

export function makeElement(label: string): RoomElement {
  return {
    id: crypto.randomUUID(),
    label,
    condition: 'bon état',
    description: '',
    tested: 'non',
    observation: '',
    photos: [],
    evolution: 'identique'
  };
}

export function makeRoom(name: string): Room {
  return {
    id: crypto.randomUUID(),
    name,
    generalCondition: 'bon état',
    cleanliness: 'Correcte',
    observations: '',
    photos: [],
    elements: elementNames.slice(0, 10).map(makeElement)
  };
}

export function makeMeter(kind: string): Meter {
  return {
    id: crypto.randomUUID(),
    kind,
    number: '',
    location: '',
    index: '',
    unit: '',
    peakHours: '',
    offPeakHours: '',
    observation: '',
    photos: []
  };
}

export function makeKey(label: string): AccessKey {
  return {
    id: crypto.randomUUID(),
    label,
    delivered: 0,
    returned: 0,
    condition: 'Bon état',
    observation: ''
  };
}
