import type { AnalysisResult, SavedOfflineTrip, TripPlan } from "./types";

const DB_NAME = "bluejury-offline";
const STORE_NAME = "trips";
const DB_VERSION = 1;
const ACTIVE_TRIP_ID = "active-trip" as const;

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline trip storage is unavailable."));
  });
}

export async function persistOfflineTrip(plan: TripPlan, decision: AnalysisResult, activeZoneId: string | null, now = new Date()): Promise<SavedOfflineTrip> {
  const saved: SavedOfflineTrip = { schemaVersion: 1, id: ACTIVE_TRIP_ID, savedAt: now.toISOString(), plan: structuredClone(plan), decision: structuredClone(decision), activeZoneId };
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(saved);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Trip could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Trip save was interrupted."));
  });
  db.close();
  return saved;
}

export async function retrieveOfflineTrip(): Promise<SavedOfflineTrip | null> {
  const db = await database();
  const value = await new Promise<SavedOfflineTrip | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_TRIP_ID);
    request.onsuccess = () => resolve(request.result as SavedOfflineTrip | undefined);
    request.onerror = () => reject(request.error ?? new Error("Saved trip could not be read."));
  });
  db.close();
  return value?.schemaVersion === 1 ? value : null;
}

export async function removeOfflineTrip(): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(ACTIVE_TRIP_ID);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Saved trip could not be removed."));
  });
  db.close();
}
