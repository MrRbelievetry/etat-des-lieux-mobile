import type { AccessKey, ElementCategory, ElementCondition, ElementPresenceStatus, FunctionStatus, Meter, Room, RoomElement } from './types';

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

export const functionStatusOptions: FunctionStatus[] = ['fonctionne', 'anomalie constatée', 'non testé', 'test impossible', 'non concerné'];
export const presenceStatusOptions: Array<{ value: ElementPresenceStatus; label: string }> = [
  { value: 'included', label: 'Inclus' },
  { value: 'absent', label: 'Absent constaté' },
  { value: 'hidden', label: 'Masqué' }
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

export const applianceNames = [
  'Réfrigérateur',
  'Congélateur',
  'Réfrigérateur-congélateur',
  'Four',
  'Four à micro-ondes',
  'Plaque de cuisson',
  'Cuisinière',
  'Hotte aspirante',
  'Lave-vaisselle',
  'Lave-linge',
  'Sèche-linge',
  'Cave à vin',
  'Machine à café intégrée',
  'Autre appareil'
];

const testableWords = [
  'serrure',
  'porte',
  'fenêtre',
  'fenetres',
  'volet',
  'store',
  'prise',
  'interrupteur',
  'luminaire',
  'éclairage',
  'chauffage',
  'radiateur',
  'thermostat',
  'ventilation',
  'robinet',
  'chasse',
  'évacuation',
  'chauffe-eau',
  'chaudière',
  'interphone',
  'sonnette',
  'motorisation',
  'télécommande',
  'électroménager',
  'four',
  'hotte',
  'plaque',
  'lave-',
  'réfrigérateur',
  'congélateur',
  'sèche-linge'
];

const categoryRules: Array<[ElementCategory, string[]]> = [
  ['surface', ['sol', 'mur', 'plafond', 'plinthe', 'peinture', 'papier peint', 'faïence', 'carrelage', 'joint']],
  ['ouverture', ['porte', 'fenêtre', 'vitrage', 'volet', 'store', 'judas']],
  ['electricite', ['prise', 'interrupteur', 'luminaire', 'éclairage', 'tableau électrique', 'sonnette', 'interphone']],
  ['plomberie', ['robinet', 'évier', 'lavabo', 'vasque', 'douche', 'baignoire', 'bonde', 'évacuation', 'chasse', 'wc', 'cuvette']],
  ['chauffage', ['chauffage', 'radiateur', 'sèche-serviettes', 'thermostat']],
  ['ventilation', ['ventilation', 'vmc']],
  ['mobilier', ['placard', 'meuble', 'tiroir', 'étagère', 'mobilier', 'plan de travail']],
  ['electromenager', applianceNames.map((name) => name.toLowerCase()).concat(['électroménager', 'hotte'])]
];

export const roomTemplates: Record<string, string[]> = {
  Entrée: ['Porte d’entrée', 'Serrure', 'Poignée', 'Judas', 'Interphone', 'Sonnette', 'Placard', 'Tableau électrique', 'Sol', 'Murs', 'Plafond', 'Éclairage'],
  Séjour: ['Sol', 'Murs', 'Plafond', 'Plinthes', 'Portes', 'Fenêtres', 'Vitrages', 'Volets ou stores', 'Prises', 'Interrupteurs', 'Luminaires', 'Chauffage', 'Placards', 'Ventilation'],
  Chambre: ['Sol', 'Murs', 'Plafond', 'Plinthes', 'Portes', 'Fenêtres', 'Vitrages', 'Volets ou stores', 'Prises', 'Interrupteurs', 'Luminaires', 'Chauffage', 'Placards', 'Ventilation'],
  Cuisine: [
    'Éléments généraux',
    'Meubles hauts',
    'Meubles bas',
    'Tiroirs',
    'Plan de travail',
    'Crédence',
    'Évier',
    'Robinetterie',
    'Joints',
    'Plomberie',
    'Prises',
    'Éclairage',
    'Ventilation',
    ...applianceNames
  ],
  'Salle de bains': ['Lavabo ou vasque', 'Meuble vasque', 'Miroir', 'Baignoire', 'Douche', 'Paroi', 'Robinetterie', 'Pommeau', 'Flexible', 'Joints silicone', 'Faïence', 'Bonde', 'Évacuation', 'Ventilation', 'Sèche-serviettes', 'Prises', 'Éclairage'],
  'Salle d’eau': ['Lavabo ou vasque', 'Meuble vasque', 'Miroir', 'Douche', 'Paroi', 'Robinetterie', 'Pommeau', 'Flexible', 'Joints silicone', 'Faïence', 'Bonde', 'Évacuation', 'Ventilation', 'Sèche-serviettes', 'Prises', 'Éclairage'],
  WC: ['Cuvette', 'Abattant', 'Chasse d’eau', 'Réservoir', 'Robinet d’arrêt', 'Lavabo éventuel', 'Ventilation', 'Sol', 'Murs', 'Plafond', 'Porte', 'Éclairage'],
  Garage: ['Porte', 'Motorisation', 'Télécommande', 'Sol', 'Murs', 'Plafond', 'Prises', 'Éclairage', 'Point d’eau', 'Étagères', 'Équipements présents']
};

export const meterKinds = ['Électricité', 'Eau froide', 'Eau chaude', 'Gaz', 'Chauffage', 'Autre compteur'];
export const keyKinds = ['Clé de porte d’entrée', 'Clé de boîte aux lettres', 'Clé de portail', 'Clé de cave', 'Clé de garage', 'Badge', 'Bip', 'Télécommande', 'Autre'];

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function inferElementCategory(label: string): ElementCategory {
  const normalized = normalize(label);
  return categoryRules.find(([, words]) => words.some((word) => normalized.includes(normalize(word))))?.[0] ?? 'autre';
}

export function inferIsTestable(label: string): boolean {
  const normalized = normalize(label);
  if (['sol', 'mur', 'murs', 'plafond', 'plinthes', 'peinture', 'papier peint', 'faience', 'carrelage', 'vitrage'].some((word) => normalized === word || normalized.includes(word))) {
    return false;
  }
  return testableWords.some((word) => normalized.includes(normalize(word)));
}

export function withElementDefaults(element: RoomElement): RoomElement {
  const category = element.category ?? inferElementCategory(element.label);
  const isTestable = element.isTestable ?? inferIsTestable(element.label);
  const hasExistingData = elementHasData(element);
  const defaultPresenceStatus: ElementPresenceStatus = hasExistingData || category !== 'electromenager' ? 'included' : 'hidden';
  return {
    ...element,
    category,
    isTestable,
    presenceStatus: element.presenceStatus ?? defaultPresenceStatus,
    functionStatus: isTestable ? element.functionStatus ?? (element.tested === 'oui' ? 'fonctionne' : element.tested === 'non concerné' ? 'non concerné' : 'non testé') : undefined
  };
}

export function elementHasData(element: RoomElement): boolean {
  return Boolean(
    element.description?.trim()
    || element.observation?.trim()
    || element.photos?.length
    || element.brand?.trim()
    || element.model?.trim()
    || element.serialNumber?.trim()
    || element.color?.trim()
    || element.exteriorCondition
    || element.interiorCondition
    || element.cleanliness?.trim()
    || element.accessories?.trim()
    || element.defectDescription?.trim()
    || element.exitObservation?.trim()
    || element.condition === 'absent'
    || element.condition === 'état moyen'
    || element.condition === 'mauvais état'
    || element.condition === 'hors service'
  );
}

export function roomHasData(room: Room): boolean {
  return Boolean(room.observations.trim() || room.photos.length || room.elements.some(elementHasData));
}

export function includedRooms(rooms: Room[]): Room[] {
  return rooms.filter((room) => room.included !== false);
}

export function visibleElements(elements: RoomElement[]): RoomElement[] {
  return elements.map(withElementDefaults).filter((element) => element.presenceStatus !== 'hidden');
}

export function makeElement(label: string): RoomElement {
  return withElementDefaults({
    id: crypto.randomUUID(),
    label,
    condition: 'bon état',
    description: '',
    tested: 'non',
    observation: '',
    photos: [],
    evolution: 'identique',
    exteriorCondition: '',
    interiorCondition: '',
    cleanliness: '',
    accessories: '',
    defectDescription: ''
  });
}

export function makeRoom(name: string): Room {
  const template = roomTemplates[name] ?? ['Sol', 'Murs', 'Plafond', 'Portes', 'Fenêtres', 'Prises', 'Éclairage', 'Autre équipement'];
  return {
    id: crypto.randomUUID(),
    name,
    included: true,
    generalCondition: 'bon état',
    cleanliness: 'Correcte',
    observations: '',
    photos: [],
    elements: template.map(makeElement)
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
