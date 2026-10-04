import { STATUSES, STAY_TYPES, READINESS } from './model.js';
import { formatDate, formatDateTime, formatDayMonth } from './ui.js';

const PLAN_SECTION_KEYS = [
  'overview',
  'permits',
  'travel',
  'stays',
  'days',
  'gear',
  'food',
  'safety',
];

// Returns the device's current date in local YYYY-MM-DD format.
export function getLocalTodayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Calculates calendar day difference between two YYYY-MM-DD dates in UTC without timezone shifts.
export function daysBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const p1 = startIso.split('-').map(Number);
  const p2 = endIso.split('-').map(Number);
  if (p1.length !== 3 || p2.length !== 3) return null;
  const t1 = Date.UTC(p1[0], p1[1] - 1, p1[2]);
  const t2 = Date.UTC(p2[0], p2[1] - 1, p2[2]);
  return Math.round((t2 - t1) / 86400000);
}

// Determines whether a specific planner section is complete according to UX_SPEC.md §2.2.
export function isSectionComplete(trek, sectionKey) {
  if (!trek) return false;

  switch (sectionKey) {
    case 'overview':
      return Boolean(
        trek.overview?.name?.trim() &&
        trek.overview?.startDate &&
        trek.overview?.endDate
      );

    case 'permits':
      return Boolean(
        trek.noPermitsRequired ||
        (Array.isArray(trek.permits) && trek.permits.length > 0)
      );

    case 'travel':
      return Boolean(
        Array.isArray(trek.travel) &&
        trek.travel.some((leg) => leg.direction === 'to') &&
        trek.travel.some((leg) => leg.direction === 'return')
      );

    case 'stays':
      return Boolean(
        trek.noOffTrailStays ||
        (Array.isArray(trek.stays) && trek.stays.length > 0)
      );

    case 'days':
      return Boolean(Array.isArray(trek.days) && trek.days.length > 0);

    case 'gear':
      return Boolean(Array.isArray(trek.gear) && trek.gear.length > 0);

    case 'food':
      return Boolean(Array.isArray(trek.food?.items) && trek.food.items.length > 0);

    case 'safety':
      return Boolean(
        Array.isArray(trek.safety?.contacts) &&
        trek.safety.contacts.length > 0 &&
        trek.safety?.trustedPerson?.name?.trim()
      );

    default:
      return false;
  }
}

// Runs all deterministic rule-based checks on a trek plan according to TECH_SPEC.md §4.
export function runChecks(trek, todayIso = getLocalTodayIso()) {
  const critical = [];
  const warnings = [];

  if (!trek) {
    return {
      critical: [{ id: 'critical-no-trek', level: 'critical', message: 'Trek data is missing.', section: 'overview' }],
      warnings: [],
      completeness: { done: 0, total: 8 },
      readiness: READINESS.NOT_READY,
    };
  }

  // --- CRITICAL CHECKS ---

  // 1. Trek start or end date missing
  if (!trek.overview?.startDate || !trek.overview?.endDate) {
    critical.push({
      id: 'critical-dates-missing',
      level: 'critical',
      message: 'Trek start or end date is missing.',
      section: 'overview',
    });
  }

  // 2. No travel leg with direction 'to'
  if (!Array.isArray(trek.travel) || !trek.travel.some((l) => l.direction === 'to')) {
    critical.push({
      id: 'critical-no-travel-to',
      level: 'critical',
      message: 'No travel to trailhead recorded.',
      section: 'travel',
    });
  }

  // 3. No travel leg with direction 'return'
  if (!Array.isArray(trek.travel) || !trek.travel.some((l) => l.direction === 'return')) {
    critical.push({
      id: 'critical-no-travel-return',
      level: 'critical',
      message: 'No return travel recorded.',
      section: 'travel',
    });
  }

  // 4. No trek days entered
  if (!Array.isArray(trek.days) || trek.days.length === 0) {
    critical.push({
      id: 'critical-no-days',
      level: 'critical',
      message: 'No trek days entered.',
      section: 'days',
    });
  } else {
    // 5. A trek day has no stay name, or stay status is 'unknown' (or camping_own_tent has no campsite 'to' location)
    trek.days.forEach((day) => {
      const isOwnTent = day.stayType === STAY_TYPES.CAMPING_OWN_TENT || day.stayType === 'tent';
      if (isOwnTent) {
        if (!day.to || !day.to.trim()) {
          critical.push({
            id: `critical-day-campsite-${day.id}`,
            level: 'critical',
            message: `Day ${day.dayNumber} has no campsite location (the 'To' field is empty).`,
            section: 'days',
          });
        }
      } else {
        const stayNameMissing = !day.stayName || !day.stayName.trim();
        const stayUnknown = !day.stayStatus || day.stayStatus === STATUSES.UNKNOWN;
        if (stayNameMissing || stayUnknown) {
          critical.push({
            id: `critical-day-stay-${day.id}`,
            level: 'critical',
            message: `Day ${day.dayNumber} has no confirmed stay.`,
            section: 'days',
          });
        }
      }
    });

    // 6. A trek day has water status 'unknown'
    trek.days.forEach((day) => {
      if (!day.waterStatus || day.waterStatus === 'unknown') {
        critical.push({
          id: `critical-day-water-${day.id}`,
          level: 'critical',
          message: `Water on Day ${day.dayNumber} is unknown.`,
          section: 'days',
        });
      }
    });
  }

  // 7. No emergency contact
  if (!Array.isArray(trek.safety?.contacts) || trek.safety.contacts.length === 0) {
    critical.push({
      id: 'critical-no-emergency-contacts',
      level: 'critical',
      message: 'No emergency contacts recorded.',
      section: 'safety',
    });
  }

  // 8. Trusted person name missing
  if (!trek.safety?.trustedPerson?.name || !trek.safety.trustedPerson.name.trim()) {
    critical.push({
      id: 'critical-no-trusted-person',
      level: 'critical',
      message: 'Trusted person name is missing.',
      section: 'safety',
    });
  }

// Formats a travel leg route as '(From → To)' or '(no route entered)'.
function formatLegRoute(leg) {
  const from = (leg?.from || '').trim();
  const to = (leg?.to || '').trim();
  if (from && to) return `(${from} → ${to})`;
  if (from) return `(${from} → )`;
  if (to) return `(→ ${to})`;
  return '(no route entered)';
}

  // --- WARNING CHECKS ---

  // 1. Number of trek days != days from start date to end date (inclusive)
  if (trek.overview?.startDate && trek.overview?.endDate && Array.isArray(trek.days) && trek.days.length > 0) {
    const diff = daysBetween(trek.overview.startDate, trek.overview.endDate);
    if (diff != null && diff >= 0) {
      const daysCovered = diff + 1;
      if (trek.days.length !== daysCovered) {
        const startFormatted = formatDate(trek.overview.startDate);
        const endFormatted = formatDate(trek.overview.endDate);
        warnings.push({
          id: 'warning-day-count-mismatch',
          level: 'warning',
          message: `Your trekking days in Overview (${startFormatted} to ${endFormatted}) cover ${daysCovered} days, but you've added ${trek.days.length} trek days. Either add the missing days or change the first/last trekking day in Overview.`,
          section: 'days',
        });
      }
    }
  }

  // 2. Last 'to' leg arrives (or departs) after trek start date
  if (trek.overview?.startDate && Array.isArray(trek.travel)) {
    const toLegs = trek.travel
      .filter((l) => l.direction === 'to' && (l.arriveAt || l.departAt))
      .sort((a, b) => {
        const dateA = a.arriveAt || a.departAt;
        const dateB = b.arriveAt || b.departAt;
        return dateA.localeCompare(dateB);
      });
    if (toLegs.length > 0) {
      const lastToLeg = toLegs[toLegs.length - 1];
      const toPlace = lastToLeg.to?.trim() || '(no route entered)';
      const startFormatted = formatDate(trek.overview.startDate);
      if (lastToLeg.arriveAt) {
        const arrivalDate = lastToLeg.arriveAt.slice(0, 10);
        if (arrivalDate > trek.overview.startDate) {
          const timeStr = formatDateTime(lastToLeg.arriveAt);
          warnings.push({
            id: 'warning-travel-to-late',
            level: 'warning',
            message: `You arrive at ${toPlace} on ${timeStr}, but your first trekking day is ${startFormatted}. You can't start walking before you arrive — check either date.`,
            section: 'travel',
          });
        }
      } else if (lastToLeg.departAt) {
        const departureDate = lastToLeg.departAt.slice(0, 10);
        if (departureDate > trek.overview.startDate) {
          const timeStr = formatDateTime(lastToLeg.departAt);
          warnings.push({
            id: 'warning-travel-to-late',
            level: 'warning',
            message: `You arrive at ${toPlace} on ${timeStr}, but your first trekking day is ${startFormatted}. You can't start walking before you arrive — check either date.`,
            section: 'travel',
          });
        }
      }
    }
  }

  // 3. First 'return' leg departs before the last trek day's date
  if (Array.isArray(trek.travel)) {
    const validDayDates = Array.isArray(trek.days)
      ? trek.days.map((d) => d.date).filter(Boolean).sort()
      : [];
    const lastTrekDayDate = validDayDates.length > 0
      ? validDayDates[validDayDates.length - 1]
      : (trek.overview?.endDate || null);

    if (lastTrekDayDate) {
      const returnLegs = trek.travel
        .filter((l) => l.direction === 'return' && (l.departAt || l.arriveAt))
        .sort((a, b) => {
          const dateA = a.departAt || a.arriveAt;
          const dateB = b.departAt || b.arriveAt;
          return dateA.localeCompare(dateB);
        });
      if (returnLegs.length > 0) {
        const firstReturnLeg = returnLegs[0];
        const fromPlace = firstReturnLeg.from?.trim() || '(no route entered)';
        const lastDayFormatted = formatDate(lastTrekDayDate);
        if (firstReturnLeg.departAt) {
          const departureDate = firstReturnLeg.departAt.slice(0, 10);
          if (departureDate < lastTrekDayDate) {
            const timeStr = formatDateTime(firstReturnLeg.departAt);
            warnings.push({
              id: 'warning-travel-return-early',
              level: 'warning',
              message: `Your return from ${fromPlace} leaves on ${timeStr}, but your last trekking day is ${lastDayFormatted}. Check either date.`,
              section: 'travel',
            });
          }
        } else if (firstReturnLeg.arriveAt) {
          const arrivalDate = firstReturnLeg.arriveAt.slice(0, 10);
          if (arrivalDate < lastTrekDayDate) {
            const timeStr = formatDateTime(firstReturnLeg.arriveAt);
            warnings.push({
              id: 'warning-travel-return-early',
              level: 'warning',
              message: `Your return from ${fromPlace} leaves on ${timeStr}, but your last trekking day is ${lastDayFormatted}. Check either date.`,
              section: 'travel',
            });
          }
        }
      }
    }
  }

  // 4. Any permit, travel leg or stay with status unknown or planned
  if (!trek.noPermitsRequired && Array.isArray(trek.permits)) {
    trek.permits.forEach((p, idx) => {
      if (p.status === STATUSES.UNKNOWN || p.status === STATUSES.PLANNED) {
        const permitDesc = p.name && p.name.trim() ? `"${p.name.trim()}"` : `${idx + 1} (no name entered)`;
        warnings.push({
          id: `warning-permit-status-${p.id}`,
          level: 'warning',
          message: `Permit ${permitDesc} is not confirmed.`,
          section: 'permits',
        });
      }
    });
  }

  if (Array.isArray(trek.travel)) {
    trek.travel.forEach((l, idx) => {
      if (l.status === STATUSES.UNKNOWN || l.status === STATUSES.PLANNED) {
        const legDesc = l.from && l.to
          ? `"${l.from} → ${l.to}"`
          : (l.from ? `${idx + 1} (from ${l.from})` : (l.to ? `${idx + 1} (to ${l.to})` : `${idx + 1} (no route entered)`));
        warnings.push({
          id: `warning-travel-status-${l.id}`,
          level: 'warning',
          message: `Travel leg ${legDesc} is not confirmed.`,
          section: 'travel',
        });
      }
    });
  }

  if (!trek.noOffTrailStays && Array.isArray(trek.stays)) {
    trek.stays.forEach((s, idx) => {
      if (s.status === STATUSES.UNKNOWN || s.status === STATUSES.PLANNED) {
        const stayDesc = s.name && s.name.trim()
          ? `"${s.name.trim()}"`
          : (s.place && s.place.trim() ? `${idx + 1} in ${s.place.trim()}` : `${idx + 1} (no name entered)`);
        warnings.push({
          id: `warning-stay-status-${s.id}`,
          level: 'warning',
          message: `Stay ${stayDesc} is not confirmed.`,
          section: 'stays',
        });
      }
    });
  }

  // 5. No permits recorded and noPermitsRequired is false
  if (!trek.noPermitsRequired && (!Array.isArray(trek.permits) || trek.permits.length === 0)) {
    warnings.push({
      id: 'warning-no-permits',
      level: 'warning',
      message: 'Permit requirement not recorded. Has it been checked?',
      section: 'permits',
    });
  }

  // 6. No food items
  if (!trek.food || !Array.isArray(trek.food.items) || trek.food.items.length === 0) {
    warnings.push({
      id: 'warning-no-food',
      level: 'warning',
      message: 'No food items recorded.',
      section: 'food',
    });
  }

  // 7. Trusted person doesn't have the itinerary
  if (trek.safety?.trustedPerson?.name?.trim() && !trek.safety.trustedPerson.hasItinerary) {
    warnings.push({
      id: 'warning-tp-no-itinerary',
      level: 'warning',
      message: 'Trusted person does not have a copy of the itinerary.',
      section: 'safety',
    });
  }

  // 7b. First-aid kit isn't marked as packed in Safety
  if (!trek.safety?.essentials?.firstAid) {
    warnings.push({
      id: 'warning-safety-no-first-aid',
      level: 'warning',
      message: "First-aid kit isn't marked as packed in Safety.",
      section: 'safety',
    });
  }

  // 7c. Home contact is set but no alert time
  if (trek.safety?.trustedPerson?.name?.trim() && !trek.safety?.trustedPerson?.alertBy) {
    warnings.push({
      id: 'warning-safety-no-alert-time',
      level: 'warning',
      message: "No 'raise the alarm' time is set for your home contact.",
      section: 'safety',
    });
  }

  // 8. Gear or food items not yet packed (only shown within 3 days of the trek start date)
  if (trek.overview?.startDate) {
    const daysUntilStart = daysBetween(todayIso, trek.overview.startDate);
    if (daysUntilStart !== null && daysUntilStart <= 3) {
      const unpackedGear = Array.isArray(trek.gear) ? trek.gear.filter((g) => !g.packed).length : 0;
      const unpackedFood = trek.food && Array.isArray(trek.food.items) ? trek.food.items.filter((f) => !f.packed).length : 0;

      if (unpackedGear > 0) {
        warnings.push({
          id: 'warning-gear-unpacked',
          level: 'warning',
          message: `You have ${unpackedGear} gear item${unpackedGear === 1 ? '' : 's'} not yet packed.`,
          section: 'gear',
        });
      }
      if (unpackedFood > 0) {
        warnings.push({
          id: 'warning-food-unpacked',
          level: 'warning',
          message: `You have ${unpackedFood} food item${unpackedFood === 1 ? '' : 's'} not yet packed.`,
          section: 'food',
        });
      }
    }
  }

  // Trip end date before trip start date
  if (trek.overview?.tripStartDate && trek.overview?.tripEndDate) {
    if (trek.overview.tripEndDate < trek.overview.tripStartDate) {
      warnings.push({
        id: 'warning-trip-dates-reversed',
        level: 'warning',
        message: 'Trip end date is before trip start date.',
        section: 'overview',
      });
    }
  }

  // 9. First trekking day before trip start, or last trekking day after trip end
  if (
    trek.overview?.tripStartDate &&
    trek.overview?.tripEndDate &&
    trek.overview?.startDate &&
    trek.overview?.endDate
  ) {
    const tripStart = trek.overview.tripStartDate;
    const tripEnd = trek.overview.tripEndDate;
    const trekStart = trek.overview.startDate;
    const trekEnd = trek.overview.endDate;

    if (trekStart < tripStart || trekEnd > tripEnd) {
      const trekDatesStr = `${formatDayMonth(trekStart)}–${formatDayMonth(trekEnd)}`;
      const tripDatesStr = `${formatDayMonth(tripStart)}–${formatDayMonth(tripEnd)}`;
      warnings.push({
        id: 'warning-trek-outside-trip-dates',
        level: 'warning',
        message: `Your trekking days (${trekDatesStr}) fall outside your trip dates (${tripDatesStr}). Check the dates in Overview.`,
        section: 'overview',
      });
    }
  }

  // 10. Travel leg departure date before trip start or after trip end
  if (trek.overview?.tripStartDate && trek.overview?.tripEndDate && Array.isArray(trek.travel)) {
    const tripStart = trek.overview.tripStartDate;
    const tripEnd = trek.overview.tripEndDate;
    const tripDatesStr = `${formatDayMonth(tripStart)}–${formatDayMonth(tripEnd)}`;

    trek.travel.forEach((leg) => {
      const depDate = leg.departAt && leg.departAt.length >= 10 ? leg.departAt.slice(0, 10) : null;
      if (depDate && (depDate < tripStart || depDate > tripEnd)) {
        const routeDesc = formatLegRoute(leg);
        const legDateStr = formatDate(depDate);
        warnings.push({
          id: `warning-travel-outside-trip-${leg.id}`,
          level: 'warning',
          message: `Travel leg ${routeDesc} on ${legDateStr} is outside your trip dates (${tripDatesStr}).`,
          section: 'travel',
        });
      }
    });
  }

  // Completeness
  let doneCount = 0;
  PLAN_SECTION_KEYS.forEach((key) => {
    if (isSectionComplete(trek, key)) {
      doneCount++;
    }
  });

  // Readiness per TECH_SPEC.md §4
  let readiness = READINESS.READY;
  if (critical.length > 0) {
    readiness = READINESS.NOT_READY;
  } else if (warnings.length > 0) {
    readiness = READINESS.READY_WITH_WARNINGS;
  }

  return {
    critical,
    warnings,
    completeness: { done: doneCount, total: 8 },
    readiness,
  };
}
