import { formatDate, formatDateTime } from './ui.js';

// Capitalizes and formats travel mode for display in timeline titles.
function formatMode(mode) {
  if (!mode) return 'Travel';
  if (mode === 'shared_jeep') return 'Shared jeep';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

// Formats a YYYY-MM-DD date into "Day, DD/MM/YYYY" using UTC calendar date math.
function formatTimelineDateLabel(isoDate) {
  if (!isoDate) return 'Not yet dated';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return formatDate(isoDate) || 'Not yet dated';
  }
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = weekdays[d.getUTCDay()];
  const formatted = formatDate(isoDate);
  return `${weekday}, ${formatted}`;
}

// Builds sorted timeline entries and date groups from travel, stays, and trek days.
export function buildTimeline(trek) {
  if (!trek) return [];

  const rawEntries = [];
  let entryIndex = 0;

  // 1. Travel legs (at departAt)
  if (Array.isArray(trek.travel)) {
    trek.travel.forEach((leg) => {
      const isoDate = leg.departAt && leg.departAt.length >= 10 ? leg.departAt.slice(0, 10) : null;
      const time = leg.departAt && leg.departAt.includes('T') ? leg.departAt.slice(11, 16) : null;
      let defaultSortTime = '12:00';
      if (leg.direction === 'to') {
        defaultSortTime = '05:00';
      } else if (leg.direction === 'during') {
        defaultSortTime = '12:00';
      } else if (leg.direction === 'return') {
        defaultSortTime = '20:00';
      }
      const sortTime = time || defaultSortTime;

      const modeTitle = formatMode(leg.mode);
      const fromTo = leg.from && leg.to
        ? `${leg.from} → ${leg.to}`
        : (leg.from ? `From ${leg.from}` : (leg.to ? `To ${leg.to}` : 'No route entered'));
      const title = `${modeTitle}: ${fromTo}`;

      const subtitleParts = [];
      if (time) {
        subtitleParts.push(`Departs ${time}`);
      } else if (isoDate) {
        subtitleParts.push(`Departs ${formatDateTime(leg.departAt)}`);
      }
      if (leg.arriveAt) {
        subtitleParts.push(`Arrives ${formatDateTime(leg.arriveAt)}`);
      }

      rawEntries.push({
        type: 'travel',
        mode: leg.mode,
        date: isoDate,
        time,
        sortTime,
        title,
        subtitle: subtitleParts.join(' · '),
        status: leg.status || 'unknown',
        isOwnTent: false,
        waterStatus: null,
        section: 'travel',
        originalIndex: entryIndex++,
      });
    });
  }

  // 2. Off-trail stays (at checkIn)
  if (Array.isArray(trek.stays)) {
    trek.stays.forEach((stay) => {
      const isoDate = stay.checkIn || null;
      const sortTime = '18:00';

      const namePlace = [stay.name, stay.place].filter(Boolean).join(', ') || 'No name entered';
      const nightsCount = stay.nights != null ? stay.nights : 1;
      const nightsStr = `(${nightsCount} night${nightsCount > 1 ? 's' : ''})`;
      const title = `Stay: ${namePlace} ${nightsStr}`;

      rawEntries.push({
        type: 'stay',
        mode: null,
        date: isoDate,
        time: null,
        sortTime,
        title,
        subtitle: stay.notes || '',
        status: stay.status || 'unknown',
        isOwnTent: false,
        waterStatus: null,
        section: 'stays',
        originalIndex: entryIndex++,
      });
    });
  }

  // 3. Trek days (at date)
  if (Array.isArray(trek.days)) {
    trek.days.forEach((day) => {
      const isoDate = day.date || null;
      const sortTime = '07:00';

      const fromTo = day.from && day.to
        ? `${day.from} → ${day.to}`
        : (day.from ? `From ${day.from}` : (day.to ? `To ${day.to}` : 'No route entered'));
      const title = `Day ${day.dayNumber}: ${fromTo}`;

      const isOwnTent = day.stayType === 'camping_own_tent' || day.stayType === 'tent';

      const subtitleParts = [];
      if (day.distanceKm != null && day.distanceKm !== '') {
        subtitleParts.push(`${day.distanceKm} km`);
      }
      if (day.hours != null && day.hours !== '') {
        subtitleParts.push(`${day.hours} hrs`);
      }
      if (!isOwnTent && day.stayName) {
        subtitleParts.push(day.stayName);
      }
      if (day.water) {
        subtitleParts.push(`Water: ${day.water}`);
      }

      rawEntries.push({
        type: 'day',
        mode: null,
        date: isoDate,
        time: null,
        sortTime,
        title,
        subtitle: subtitleParts.join(' · '),
        status: isOwnTent ? null : (day.stayStatus || 'unknown'),
        isOwnTent,
        waterStatus: day.waterStatus || 'unknown',
        section: 'days',
        originalIndex: entryIndex++,
      });
    });
  }

  // Separate dated vs undated
  const datedEntries = rawEntries.filter((e) => e.date !== null);
  const undatedEntries = rawEntries.filter((e) => e.date === null);

  // Sort dated entries: primary date, secondary sortTime, tertiary insertion order
  datedEntries.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;

    const timeCmp = a.sortTime.localeCompare(b.sortTime);
    if (timeCmp !== 0) return timeCmp;

    return a.originalIndex - b.originalIndex;
  });

  // Group by date
  const groups = [];
  let currentGroup = null;

  datedEntries.forEach((entry) => {
    const { originalIndex, sortTime, mode, ...cleanEntry } = entry;
    if (!currentGroup || currentGroup.date !== entry.date) {
      currentGroup = {
        date: entry.date,
        label: formatTimelineDateLabel(entry.date),
        entries: [],
      };
      groups.push(currentGroup);
    }
    currentGroup.entries.push(cleanEntry);
  });

  // Undated group at the end if any
  if (undatedEntries.length > 0) {
    groups.push({
      date: null,
      label: 'Not yet dated',
      entries: undatedEntries.map(({ originalIndex, sortTime, mode, ...cleanEntry }) => cleanEntry),
    });
  }

  return groups;
}
