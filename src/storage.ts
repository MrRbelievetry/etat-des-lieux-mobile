import { openDB } from 'idb';
import { withElementDefaults } from './constants';
import type { InspectionCase } from './types';

const DB_NAME = 'etat-des-lieux-local';
const STORE = 'cases';

async function db() {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE, { keyPath: 'id' });
    }
  });
}

export async function listCases(): Promise<InspectionCase[]> {
  const database = await db();
  const cases = await database.getAll(STORE);
  return cases.map(migrateCase).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveCase(item: InspectionCase): Promise<void> {
  const database = await db();
  await database.put(STORE, migrateCase({ ...item, updatedAt: new Date().toISOString(), lastSavedAt: new Date().toISOString() }));
}

export async function deleteCase(id: string): Promise<void> {
  const database = await db();
  await database.delete(STORE, id);
}

export async function getCase(id: string): Promise<InspectionCase | undefined> {
  const database = await db();
  const item = await database.get(STORE, id);
  return item ? migrateCase(item) : undefined;
}

export function migrateCase(item: InspectionCase): InspectionCase {
  const propertyId = item.propertyId || `property-${(item.address || item.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || item.id}`;
  return {
    ...item,
    propertyId,
    rooms: item.rooms.map((room) => ({
      ...room,
      included: room.included !== false,
      elements: room.elements.map(withElementDefaults)
    }))
  };
}

export function exportCaseJson(item: InspectionCase): string {
  return JSON.stringify(item, null, 2);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function downloadText(text: string, filename: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
