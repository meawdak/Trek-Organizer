// Constants for all allowed values in TECH_SPECt.md §3
export const STATUSES = Object.freeze({
  CONFIRMED: 'confirmed',
  PLANNED: 'planned',
  UNKNOWN: 'unknown',
  NOT_NEEDED: 'not_needed',
});

export const STATUS_LABELS = Object.freeze({
  [STATUSES.CONFIRMED]: 'Confirmed',
  [STATUSES.PLANNED]: 'Planned',
  [STATUSES.UNKNOWN]: 'Unknown',
  [STATUSES.NOT_NEEDED]: 'Not needed',
});

export const WATER_STATUSES = Object.freeze({
  CONFIRMED: 'confirmed',
  REPORTED: 'reported',
  UNKNOWN: 'unknown',
  CARRYING: 'carrying',
});

export const WATER_STATUS_LABELS = Object.freeze({
  [WATER_STATUSES.CONFIRMED]: 'Confirmed',
  [WATER_STATUSES.REPORTED]: 'Reported',
  [WATER_STATUSES.UNKNOWN]: 'Unknown',
  [WATER_STATUSES.CARRYING]: 'Carrying all',
});

export const DIRECTIONS = Object.freeze({
  TO: 'to',
  RETURN: 'return',
});

export const SOURCES = Object.freeze({
  HAVE: 'have',
  BORROW: 'borrow',
  BUY: 'buy',
});

export const DIFFICULTIES = Object.freeze({
  EASY: 'easy',
  MODERATE: 'moderate',
  HARD: 'hard',
  NOT_SURE: 'not_sure',
});

export const STAY_TYPES = Object.freeze({
  TENT: 'tent',
  HOMESTAY: 'homestay',
  HUT: 'hut',
  LODGE: 'lodge',
  OTHER: 'other',
});

export const TRAVEL_MODES = Object.freeze({
  TRAIN: 'train',
  BUS: 'bus',
  SHARED_JEEP: 'shared_jeep',
  TAXI: 'taxi',
  FLIGHT: 'flight',
  OTHER: 'other',
});

export const READINESS = Object.freeze({
  READY: 'ready',
  READY_WITH_WARNINGS: 'ready_with_warnings',
  NOT_READY: 'not_ready',
});

// Creates a new empty trek object matching the shape in TECH_SPECt.md §3.
export function createEmptyTrek(name = '') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    overview: {
      name: name.trim(),
      region: '',
      startDate: '',
      endDate: '',
      groupSize: null,
      difficulty: DIFFICULTIES.NOT_SURE,
      maxAltitudeM: null,
      budget: null,
      routeLink: '',
      notes: '',
    },
    permits: [],
    travel: [],
    stays: [],
    noOffTrailStays: false,
    days: [],
    gear: [],
    food: {
      items: [],
      resupply: '',
    },
    safety: {
      contacts: [],
      trustedPerson: {
        name: '',
        phone: '',
        hasItinerary: false,
        expectedReturn: '',
      },
      nearestHelp: '',
      network: '',
    },
    aiReview: null,
  };
}

// Escapes special HTML characters in user text to prevent XSS.
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
