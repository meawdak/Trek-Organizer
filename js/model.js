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
  DURING: 'during',
  RETURN: 'return',
});

export const DIRECTION_LABELS = Object.freeze({
  [DIRECTIONS.TO]: 'Approach to trailhead',
  [DIRECTIONS.DURING]: 'During trek',
  [DIRECTIONS.RETURN]: 'Return',
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
  CAMPING_OWN_TENT: 'camping_own_tent',
  CAMPING_BOOKED: 'camping_booked',
  HOMESTAY: 'homestay',
  HUT: 'hut',
  LODGE: 'lodge',
  BOOKED_CAMP: 'booked_camp',
  OTHER: 'other',
});

export const STAY_TYPE_LABELS = Object.freeze({
  [STAY_TYPES.CAMPING_OWN_TENT]: 'Camping (own tent)',
  [STAY_TYPES.CAMPING_BOOKED]: 'Camping (booked/rented tent)',
  [STAY_TYPES.HOMESTAY]: 'Homestay',
  [STAY_TYPES.HUT]: 'Hut',
  [STAY_TYPES.LODGE]: 'Lodge',
  [STAY_TYPES.BOOKED_CAMP]: 'Booked camp',
  [STAY_TYPES.OTHER]: 'Other',
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

export const CONTACT_ROLES = Object.freeze({
  FAMILY: 'family',
  LOCAL_HELP: 'local_help',
  GUIDE: 'guide',
  OTHER: 'other',
});

export const CONTACT_ROLE_LABELS = Object.freeze({
  [CONTACT_ROLES.FAMILY]: 'Family / friend',
  [CONTACT_ROLES.LOCAL_HELP]: 'Local help (forest office, police, hospital)',
  [CONTACT_ROLES.GUIDE]: 'Guide / porter',
  [CONTACT_ROLES.OTHER]: 'Other',
});

export const DEFAULT_ESSENTIALS = Object.freeze({
  firstAid: false,
  medicines: false,
  headlamp: false,
  powerBank: false,
  offlineMap: false,
  whistle: false,
});

export const MEAL_TYPES = Object.freeze({
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACKS: 'snacks',
});

export const MEAL_TYPE_LABELS = Object.freeze({
  [MEAL_TYPES.BREAKFAST]: 'Breakfast',
  [MEAL_TYPES.LUNCH]: 'Lunch',
  [MEAL_TYPES.DINNER]: 'Dinner',
  [MEAL_TYPES.SNACKS]: 'Snacks & other',
});

export const GEAR_CATEGORIES = Object.freeze({
  shelter: 'Shelter',
  sleep: 'Sleep system',
  clothing: 'Clothing',
  footwear: 'Footwear',
  cooking: 'Cooking',
  water: 'Water',
  navigation: 'Navigation',
  lighting_power: 'Lighting & power',
  first_aid: 'First aid',
  toiletries: 'Toiletries',
  documents: 'Documents & money',
  other: 'Other',
});

const GEAR_CATEGORY_KEYWORDS = [
  { key: 'shelter', patterns: [/\bshelter/i, /\btent/i, /\btarp/i, /\bbivy/i, /\bcamp/i] },
  { key: 'sleep', patterns: [/\bsleep/i, /\bquilt/i, /\bmat\b/i, /\bmats\b/i, /\bpad/i, /\bmattress/i, /\bblanket/i, /\bliner/i] },
  { key: 'clothing', patterns: [/\bcloth/i, /\bapparel/i, /\bjacket/i, /\bpant/i, /\btrousers/i, /\bfleece/i, /\blayer/i, /\bshirt/i, /\btshirt/i, /\bglove/i, /\bmitten/i, /\bsock/i, /\bhat/i, /\bcap\b/i, /\bbeanie/i, /\braincoat/i, /\bponcho/i, /\bthermal/i, /\bwear\b/i, /\bbalaclava/i, /\bbuff\b/i] },
  { key: 'footwear', patterns: [/\bfoot/i, /\bshoe/i, /\bboot/i, /\bgaiter/i, /\bcrampon/i, /\bmicrospike/i, /\bsandal/i] },
  { key: 'cooking', patterns: [/\bcook/i, /\bstove/i, /\bfuel/i, /\bgas\b/i, /\bpot\b/i, /\bpots\b/i, /\bpan\b/i, /\bpans\b/i, /\bkitchen/i, /\bcutlery/i, /\bspork/i, /\butensil/i, /\blighter/i, /\bmatch(es)?\b/i, /\bburner/i, /\bkettle/i] },
  { key: 'water', patterns: [/\bwater/i, /\bhydrat/i, /\bbottle/i, /\bfilter/i, /\bpurif/i, /\bbladder/i, /\baquaguard/i, /\bhalogen/i] },
  { key: 'navigation', patterns: [/\bnav/i, /\bmap\b/i, /\bmaps\b/i, /\bcompass/i, /\bgps/i] },
  { key: 'lighting_power', patterns: [/\blight/i, /\btorch/i, /\bheadlamp/i, /\blamp/i, /\bpower/i, /\bbatter/i, /\bcharger/i, /\bpowerbank/i, /\bcable/i, /\belectronic/i] },
  { key: 'first_aid', patterns: [/\bfirst[\s_-]?aid/i, /\bmedic/i, /\bbandage/i, /\bgauze/i, /\bplaster/i, /\bantiseptic/i, /\bors\b/i, /\bdressing/i, /\btweezer/i] },
  { key: 'toiletries', patterns: [/\btoiletr/i, /\bhygiene/i, /\bsoap/i, /\btowel/i, /\btooth/i, /brush/i, /paste/i, /\bsunscreen/i, /\bsanitiz/i, /\bwipes?\b/i, /\btissue/i, /\blip[\s_-]?balm/i] },
  { key: 'documents', patterns: [/\bdoc/i, /\bmoney/i, /\bcash\b/i, /\bid\b/i, /\bcard/i, /\bpermit/i, /\bpassport/i, /\bticket/i, /\bwallet/i, /\binsurance/i] },
];

// Normalizes a free-text, AI-generated, or legacy gear category into a standard GEAR_CATEGORIES key.
// Maps unknown categories or AI items by closest case-insensitive name match or keyword match, falling back to 'other'.
export function normalizeGearCategory(cat, itemName = '') {
  const catStr = typeof cat === 'string' ? cat.trim() : '';
  const itemStr = typeof itemName === 'string' ? itemName.trim() : '';

  if (catStr) {
    const trimmed = catStr.toLowerCase();
    const cleanTrimmed = trimmed.replace(/[_-]/g, ' ');
    for (const [key, label] of Object.entries(GEAR_CATEGORIES)) {
      const cleanKey = key.replace(/[_-]/g, ' ').toLowerCase();
      const cleanLabel = label.replace(/[_-]/g, ' ').toLowerCase();
      if (
        trimmed === key.toLowerCase() ||
        cleanTrimmed === cleanKey ||
        cleanTrimmed === cleanLabel ||
        (key === 'lighting_power' && (trimmed === 'lighting' || trimmed === 'power' || cleanTrimmed === 'lighting and power')) ||
        (key === 'documents' && (trimmed === 'documents' || trimmed === 'money' || cleanTrimmed === 'documents and money'))
      ) {
        return key;
      }
    }

    // If not a legacy Gemma label, try keyword match on category text
    if (trimmed !== 'gemma' && trimmed !== 'suggested by gemma') {
      for (const entry of GEAR_CATEGORY_KEYWORDS) {
        if (entry.patterns.some((pat) => pat.test(trimmed))) {
          return entry.key;
        }
      }
    }
  }

  // If category was 'gemma', 'suggested by gemma', empty, or unknown, try matching itemName
  if (itemStr) {
    for (const entry of GEAR_CATEGORY_KEYWORDS) {
      if (entry.patterns.some((pat) => pat.test(itemStr))) {
        return entry.key;
      }
    }
  }

  return 'other';
}

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
      tripStartDate: '',
      tripEndDate: '',
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
    noPermitsRequired: false,
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
        alertBy: '',
        checkInPlan: '',
        instructions: '',
      },
      essentials: {
        firstAid: false,
        medicines: false,
        headlamp: false,
        powerBank: false,
        offlineMap: false,
        whistle: false,
      },
      medicines: '',
      emergencyNumber: '112',
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

// Normalizes a trek object by filling missing fields with defaults and migrating legacy schemas.
export function normalizeTrek(trek) {
  const empty = createEmptyTrek();
  if (!trek || typeof trek !== 'object') {
    return empty;
  }

  const id = typeof trek.id === 'string' && trek.id.length > 0 ? trek.id : empty.id;
  const createdAt = trek.createdAt || empty.createdAt;
  const updatedAt = trek.updatedAt || empty.updatedAt;

  const overview = {
    name: typeof trek.overview?.name === 'string' ? trek.overview.name : empty.overview.name,
    region: typeof trek.overview?.region === 'string' ? trek.overview.region : empty.overview.region,
    tripStartDate: typeof trek.overview?.tripStartDate === 'string' ? trek.overview.tripStartDate : '',
    tripEndDate: typeof trek.overview?.tripEndDate === 'string' ? trek.overview.tripEndDate : '',
    startDate: typeof trek.overview?.startDate === 'string' ? trek.overview.startDate : '',
    endDate: typeof trek.overview?.endDate === 'string' ? trek.overview.endDate : '',
    groupSize: typeof trek.overview?.groupSize === 'number' ? trek.overview.groupSize : null,
    difficulty: trek.overview?.difficulty || DIFFICULTIES.NOT_SURE,
    maxAltitudeM: typeof trek.overview?.maxAltitudeM === 'number' ? trek.overview.maxAltitudeM : null,
    budget: typeof trek.overview?.budget === 'number' ? trek.overview.budget : null,
    routeLink: typeof trek.overview?.routeLink === 'string' ? trek.overview.routeLink : '',
    notes: typeof trek.overview?.notes === 'string' ? trek.overview.notes : '',
  };

  const permits = Array.isArray(trek.permits)
    ? trek.permits.map((p) => ({
        id: p?.id || crypto.randomUUID(),
        name: p?.name ?? '',
        authority: p?.authority ?? '',
        status: p?.status ?? STATUSES.UNKNOWN,
        notes: p?.notes ?? '',
      }))
    : [];

  const noPermitsRequired = Boolean(trek.noPermitsRequired);

  const travel = Array.isArray(trek.travel)
    ? trek.travel.map((t) => ({
        id: t?.id || crypto.randomUUID(),
        direction: t?.direction ?? DIRECTIONS.TO,
        mode: t?.mode ?? TRAVEL_MODES.TRAIN,
        from: t?.from ?? '',
        to: t?.to ?? '',
        departAt: t?.departAt ?? '',
        arriveAt: t?.arriveAt ?? '',
        bookingRef: t?.bookingRef ?? '',
        status: t?.status ?? STATUSES.UNKNOWN,
        notes: t?.notes ?? '',
      }))
    : [];

  const stays = Array.isArray(trek.stays)
    ? trek.stays.map((s) => ({
        id: s?.id || crypto.randomUUID(),
        name: s?.name ?? '',
        place: s?.place ?? '',
        checkIn: s?.checkIn ?? '',
        nights: typeof s?.nights === 'number' ? s.nights : parseInt(s?.nights, 10) || 1,
        status: s?.status ?? STATUSES.UNKNOWN,
        notes: s?.notes ?? '',
      }))
    : [];

  const noOffTrailStays = Boolean(trek.noOffTrailStays);

  const days = Array.isArray(trek.days)
    ? trek.days.map((d, idx) => {
        let stayType = d?.stayType || STAY_TYPES.CAMPING_OWN_TENT;
        if (stayType === 'tent') {
          stayType = STAY_TYPES.CAMPING_OWN_TENT;
        }
        return {
          id: d?.id || crypto.randomUUID(),
          dayNumber: typeof d?.dayNumber === 'number' ? d.dayNumber : idx + 1,
          date: d?.date ?? '',
          from: d?.from ?? '',
          to: d?.to ?? '',
          distanceKm: typeof d?.distanceKm === 'number' ? d.distanceKm : null,
          hours: typeof d?.hours === 'number' ? d.hours : null,
          stayType,
          stayName: d?.stayName ?? '',
          stayStatus: d?.stayStatus ?? STATUSES.UNKNOWN,
          water: d?.water ?? '',
          waterStatus: d?.waterStatus ?? WATER_STATUSES.UNKNOWN,
          notes: d?.notes ?? '',
        };
      })
    : [];

  const gear = Array.isArray(trek.gear)
    ? trek.gear.map((g) => ({
        id: g?.id || crypto.randomUUID(),
        item: g?.item ?? '',
        category: normalizeGearCategory(g?.category, g?.item),
        source: g?.source ?? SOURCES.HAVE,
        packed: Boolean(g?.packed),
      }))
    : [];

  const foodItems = Array.isArray(trek.food?.items)
    ? trek.food.items.map((f) => ({
        id: f?.id || crypto.randomUUID(),
        day: f?.day ?? '',
        meal: f?.meal ?? MEAL_TYPES.DINNER,
        item: f?.item ?? '',
        quantity: f?.quantity ?? '',
        packed: Boolean(f?.packed),
      }))
    : [];

  const food = {
    items: foodItems,
    resupply: trek.food?.resupply ?? '',
  };

  const contacts = Array.isArray(trek.safety?.contacts)
    ? trek.safety.contacts.map((c) => ({
        id: c?.id || crypto.randomUUID(),
        name: c?.name ?? '',
        role: c?.role ?? CONTACT_ROLES.FAMILY,
        relation: c?.relation ?? '',
        phone: c?.phone ?? '',
      }))
    : [];

  const trustedPerson = {
    name: trek.safety?.trustedPerson?.name ?? '',
    phone: trek.safety?.trustedPerson?.phone ?? '',
    hasItinerary: Boolean(trek.safety?.trustedPerson?.hasItinerary),
    expectedReturn: trek.safety?.trustedPerson?.expectedReturn ?? '',
    alertBy: trek.safety?.trustedPerson?.alertBy ?? '',
    checkInPlan: trek.safety?.trustedPerson?.checkInPlan ?? '',
    instructions: trek.safety?.trustedPerson?.instructions ?? '',
  };

  const rawEssentials = trek.safety?.essentials || {};
  const essentials = {
    firstAid: Boolean(rawEssentials.firstAid),
    medicines: Boolean(rawEssentials.medicines),
    headlamp: Boolean(rawEssentials.headlamp),
    powerBank: Boolean(rawEssentials.powerBank),
    offlineMap: Boolean(rawEssentials.offlineMap),
    whistle: Boolean(rawEssentials.whistle),
  };

  const emergencyNumber =
    typeof trek.safety?.emergencyNumber === 'string' && trek.safety.emergencyNumber.trim()
      ? trek.safety.emergencyNumber.trim()
      : '112';

  const safety = {
    contacts,
    trustedPerson,
    essentials,
    medicines: typeof trek.safety?.medicines === 'string' ? trek.safety.medicines : '',
    emergencyNumber,
    nearestHelp: trek.safety?.nearestHelp ?? '',
    network: trek.safety?.network ?? '',
  };

  const aiReview = trek.aiReview ?? null;

  return {
    id,
    createdAt,
    updatedAt,
    overview,
    permits,
    noPermitsRequired,
    travel,
    stays,
    noOffTrailStays,
    days,
    gear,
    food,
    safety,
    aiReview,
  };
}

