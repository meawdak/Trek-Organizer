import { normalizeTrek } from './model.js';

export const STORAGE_KEY = 'trekOrganizer.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  ollamaUrl: 'http://localhost:11434',
  model: 'gemma3:4b',
  reviewTimeoutSec: 300,
});

// Creates a fresh top-level store object according to the schema.
function createDefaultStore() {
  return {
    schemaVersion: 1,
    settings: { ...DEFAULT_SETTINGS },
    treks: [],
  };
}

// Loads the entire store from localStorage, resetting to default and logging on corruption.
export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultStore();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.treks)) {
      console.error('Invalid store format in localStorage. Resetting to empty store.');
      return createDefaultStore();
    }
    const rawSettings = parsed.settings || {};
    return {
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
      settings: {
        ...DEFAULT_SETTINGS,
        ...rawSettings,
        reviewTimeoutSec:
          typeof rawSettings.reviewTimeoutSec === 'number'
            ? rawSettings.reviewTimeoutSec
            : DEFAULT_SETTINGS.reviewTimeoutSec,
      },
      treks: parsed.treks.map(normalizeTrek),
    };
  } catch (err) {
    console.error('Failed to load store from localStorage:', err);
    return createDefaultStore();
  }
}

// Persists the store object to localStorage.
export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    console.error('Failed to save store to localStorage:', err);
    return false;
  }
}

// Returns the array of all stored treks.
export function getTreks() {
  const store = loadStore();
  return store.treks;
}

// Retrieves a single trek by ID, or null if not found.
export function getTrek(id) {
  const treks = getTreks();
  return treks.find((trek) => trek.id === id) || null;
}

// Saves or updates a trek, updating its updatedAt timestamp.
export function saveTrek(trek) {
  const store = loadStore();
  const updatedTrek = {
    ...trek,
    updatedAt: new Date().toISOString(),
  };
  const index = store.treks.findIndex((t) => t.id === updatedTrek.id);
  if (index >= 0) {
    store.treks[index] = updatedTrek;
  } else {
    store.treks.push(updatedTrek);
  }
  saveStore(store);
  return updatedTrek;
}

// Deletes a trek by ID from storage.
export function deleteTrek(id) {
  const store = loadStore();
  const initialLength = store.treks.length;
  store.treks = store.treks.filter((t) => t.id !== id);
  if (store.treks.length !== initialLength) {
    saveStore(store);
    return true;
  }
  return false;
}

// Retrieves current settings from the store.
export function getSettings() {
  const store = loadStore();
  return store.settings;
}

// Saves updated settings into the store.
export function saveSettings(settings) {
  const store = loadStore();
  store.settings = { ...store.settings, ...settings };
  saveStore(store);
  return store.settings;
}

// Exports all treks in the store minus settings, matching the backup schema.
export function exportData() {
  const store = loadStore();
  return {
    schemaVersion: store.schemaVersion || 1,
    exportedAt: new Date().toISOString(),
    treks: store.treks.map(normalizeTrek),
  };
}

// Imports treks from backup data with validation, normalization, and conflict resolution.
export function importData(data, { onConflict } = {}) {
  if (
    !data ||
    typeof data !== 'object' ||
    typeof data.schemaVersion !== 'number' ||
    !Array.isArray(data.treks)
  ) {
    throw new Error('Invalid backup data structure.');
  }

  const allValidTrekObjects = data.treks.every(
    (t) => t && typeof t === 'object' && typeof t.id === 'string' && t.id.length > 0
  );
  if (!allValidTrekObjects) {
    throw new Error('Invalid treks array in backup data.');
  }

  const store = loadStore();
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  for (const rawTrek of data.treks) {
    const trek = normalizeTrek(rawTrek);
    const existingIndex = store.treks.findIndex((t) => t.id === trek.id);

    if (existingIndex >= 0) {
      const existingTrek = store.treks[existingIndex];
      const decision = onConflict ? onConflict(existingTrek) : 'replace';
      if (decision === 'replace') {
        store.treks[existingIndex] = trek;
        replaced++;
      } else {
        skipped++;
      }
    } else {
      store.treks.push(trek);
      added++;
    }
  }

  if (added > 0 || replaced > 0) {
    saveStore(store);
  }

  return { added, replaced, skipped };
}

