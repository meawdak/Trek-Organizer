import { formatDate, formatDateTime } from './ui.js';
import { STAY_TYPE_LABELS, GEAR_CATEGORIES } from './model.js';

export const SYSTEM_PROMPT = `You help a self-supported trekker check their own plan. You do NOT plan the trek and you do NOT invent facts about the route, water, permits, transport, stays or phone numbers.
Task 1 — gear_gaps: compare the gear list with the trek conditions (month, altitude, number of days, camping or not). List gear or clothing that is clearly expected for these conditions but missing from the list. Never suggest medicines or drugs. Never suggest an item that is already in the gear list.
Task 2 — questions: ask short questions the trekker should be able to answer before leaving, about backup plans and decisions (for example what to do if transport fails, weather turns bad, or a campsite is unusable). Each question must end with a question mark and refer to something specific in the plan.
Return ONLY JSON:
{"gear_gaps": [{"item": "short item name", "reason": "one sentence linking it to the conditions"}], "questions": ["question?"]}
At most 5 gear_gaps and 5 questions. Use empty lists if nothing is useful.`;

// Builds a compact plain-text summary of filled-in plan fields grouped by section.
export function buildPlanSummary(trek) {
  if (!trek || typeof trek !== 'object') {
    return 'No plan details available.';
  }

  const sections = [];

  // 1. Overview
  const ov = trek.overview || {};
  const ovLines = [];
  if (ov.name?.trim()) ovLines.push(`Name: ${ov.name.trim()}`);
  if (ov.region?.trim()) ovLines.push(`Region: ${ov.region.trim()}`);
  if (ov.tripStartDate || ov.tripEndDate) {
    const s = formatDate(ov.tripStartDate) || 'not set';
    const e = formatDate(ov.tripEndDate) || 'not set';
    ovLines.push(`Trip dates: ${s} to ${e}`);
  }
  if (ov.startDate || ov.endDate) {
    const s = formatDate(ov.startDate) || 'not set';
    const e = formatDate(ov.endDate) || 'not set';
    ovLines.push(`Trekking dates: ${s} to ${e}`);
  }
  if (ov.groupSize !== null && ov.groupSize !== undefined && ov.groupSize !== '') {
    ovLines.push(`Group size: ${ov.groupSize}`);
  }
  if (ov.difficulty && ov.difficulty !== 'not_sure') {
    ovLines.push(`Difficulty: ${ov.difficulty}`);
  }
  if (ov.maxAltitudeM !== null && ov.maxAltitudeM !== undefined && ov.maxAltitudeM !== '') {
    ovLines.push(`Max altitude: ${ov.maxAltitudeM} m`);
  }
  if (ov.budget !== null && ov.budget !== undefined && ov.budget !== '') {
    ovLines.push(`Budget: ₹${ov.budget}`);
  }
  if (ov.routeLink?.trim()) ovLines.push(`Route link: ${ov.routeLink.trim()}`);
  if (ov.notes?.trim()) ovLines.push(`Notes: ${ov.notes.trim()}`);

  sections.push(`Overview:\n${ovLines.length > 0 ? ovLines.map((l) => `- ${l}`).join('\n') : 'none recorded'}`);

  // 2. Permits
  if (trek.noPermitsRequired) {
    sections.push('Permits:\n- No permits required (confirmed by trekker)');
  } else if (Array.isArray(trek.permits) && trek.permits.length > 0) {
    const permitLines = trek.permits
      .map((p) => {
        const parts = [];
        if (p.name?.trim()) parts.push(p.name.trim());
        if (p.authority?.trim()) parts.push(`authority: ${p.authority.trim()}`);
        parts.push(`status: ${p.status || 'unknown'}`);
        if (p.notes?.trim()) parts.push(`notes: ${p.notes.trim()}`);
        return parts.length > 1 || p.name?.trim() ? parts.join(', ') : null;
      })
      .filter(Boolean);

    sections.push(`Permits:\n${permitLines.length > 0 ? permitLines.map((l) => `- ${l}`).join('\n') : 'none recorded'}`);
  } else {
    sections.push('Permits:\nnone recorded');
  }

  // 3. Travel: approach/during/return
  const travelLegs = Array.isArray(trek.travel) ? trek.travel : [];
  const approachLegs = travelLegs.filter((l) => l.direction === 'to');
  const duringLegs = travelLegs.filter((l) => l.direction === 'during');
  const returnLegs = travelLegs.filter((l) => l.direction === 'return');

  function formatLeg(leg) {
    const parts = [];
    if (leg.mode) parts.push(`mode: ${leg.mode}`);
    if (leg.from?.trim() || leg.to?.trim()) {
      parts.push(`route: ${leg.from?.trim() || 'unknown'} to ${leg.to?.trim() || 'unknown'}`);
    }
    if (leg.departAt) parts.push(`depart: ${formatDateTime(leg.departAt)}`);
    if (leg.arriveAt) parts.push(`arrive: ${formatDateTime(leg.arriveAt)}`);
    if (leg.bookingRef?.trim()) parts.push(`booking ref: ${leg.bookingRef.trim()}`);
    parts.push(`status: ${leg.status || 'unknown'}`);
    if (leg.notes?.trim()) parts.push(`notes: ${leg.notes.trim()}`);
    return parts.join(', ');
  }

  const travelLines = [];
  travelLines.push('Approach to trailhead:');
  if (approachLegs.length > 0) {
    approachLegs.forEach((l) => travelLines.push(`  - ${formatLeg(l)}`));
  } else {
    travelLines.push('  none recorded');
  }

  travelLines.push('During trek:');
  if (duringLegs.length > 0) {
    duringLegs.forEach((l) => travelLines.push(`  - ${formatLeg(l)}`));
  } else {
    travelLines.push('  none recorded');
  }

  travelLines.push('Return:');
  if (returnLegs.length > 0) {
    returnLegs.forEach((l) => travelLines.push(`  - ${formatLeg(l)}`));
  } else {
    travelLines.push('  none recorded');
  }

  sections.push(`Travel:\n${travelLines.join('\n')}`);

  // 4. Stays
  if (trek.noOffTrailStays) {
    sections.push('Stays:\n- No off-trail stays required (confirmed by trekker)');
  } else if (Array.isArray(trek.stays) && trek.stays.length > 0) {
    const stayLines = trek.stays
      .map((s) => {
        const parts = [];
        if (s.name?.trim()) parts.push(s.name.trim());
        if (s.place?.trim()) parts.push(`place: ${s.place.trim()}`);
        if (s.checkIn) parts.push(`check-in: ${formatDate(s.checkIn)}`);
        if (s.nights) parts.push(`nights: ${s.nights}`);
        parts.push(`status: ${s.status || 'unknown'}`);
        if (s.notes?.trim()) parts.push(`notes: ${s.notes.trim()}`);
        return parts.join(', ');
      })
      .filter(Boolean);

    sections.push(`Stays:\n${stayLines.length > 0 ? stayLines.map((l) => `- ${l}`).join('\n') : 'none recorded'}`);
  } else {
    sections.push('Stays:\nnone recorded');
  }

  // 5. Trek days
  if (Array.isArray(trek.days) && trek.days.length > 0) {
    const dayLines = trek.days.map((d) => {
      const parts = [];
      const dayNum = d.dayNumber ? `Day ${d.dayNumber}` : 'Day';
      const dateStr = d.date ? ` (${formatDate(d.date)})` : '';
      let header = `${dayNum}${dateStr}`;
      if (d.from?.trim() || d.to?.trim()) {
        header += `: ${d.from?.trim() || 'unknown'} to ${d.to?.trim() || 'unknown'}`;
      }
      parts.push(header);

      const details = [];
      if (d.distanceKm !== null && d.distanceKm !== undefined && d.distanceKm !== '') {
        details.push(`${d.distanceKm} km`);
      }
      if (d.hours !== null && d.hours !== undefined && d.hours !== '') {
        details.push(`${d.hours} hrs`);
      }

      const stayTypeLabel = STAY_TYPE_LABELS[d.stayType] || d.stayType || 'Camping';
      let stayDesc = `stay: ${stayTypeLabel}`;
      if (d.stayType !== 'camping_own_tent') {
        if (d.stayName?.trim()) stayDesc += ` (${d.stayName.trim()})`;
        stayDesc += ` status: ${d.stayStatus || 'unknown'}`;
      }
      details.push(stayDesc);

      let waterDesc = `water: status: ${d.waterStatus || 'unknown'}`;
      if (d.water?.trim()) waterDesc += ` (${d.water.trim()})`;
      details.push(waterDesc);

      if (d.notes?.trim()) details.push(`notes: ${d.notes.trim()}`);

      return `${parts.join('')} — ${details.join(', ')}`;
    });

    sections.push(`Trek days:\n${dayLines.map((l) => `- ${l}`).join('\n')}`);
  } else {
    sections.push('Trek days:\nnone recorded');
  }

  // 6. Gear
  if (Array.isArray(trek.gear) && trek.gear.length > 0) {
    const packedCount = trek.gear.filter((g) => g.packed).length;
    const gearLines = trek.gear.map((g) => {
      const parts = [g.item?.trim() || 'Item'];
      const catLabel = GEAR_CATEGORIES[g.category] || g.category;
      if (catLabel?.trim()) parts.push(`category: ${catLabel.trim()}`);
      if (g.source) parts.push(`source: ${g.source}`);
      parts.push(g.packed ? 'status: packed' : 'status: not packed');
      return parts.join(', ');
    });

    sections.push(`Gear (${packedCount}/${trek.gear.length} packed):\n${gearLines.map((l) => `- ${l}`).join('\n')}`);
  } else {
    sections.push('Gear:\nnone recorded');
  }

  // 7. Food
  const foodItems = Array.isArray(trek.food?.items) ? trek.food.items : [];
  const resupply = trek.food?.resupply?.trim();
  if (foodItems.length > 0 || resupply) {
    const foodLines = [];
    if (foodItems.length > 0) {
      const packedCount = foodItems.filter((f) => f.packed).length;
      foodLines.push(`Items (${packedCount}/${foodItems.length} packed):`);
      foodItems.forEach((f) => {
        const parts = [f.item?.trim() || 'Food item'];
        if (f.day) parts.push(`day: ${f.day}`);
        if (f.meal) parts.push(`meal: ${f.meal}`);
        if (f.quantity?.trim()) parts.push(`qty: ${f.quantity.trim()}`);
        parts.push(f.packed ? 'status: packed' : 'status: not packed');
        foodLines.push(`  - ${parts.join(', ')}`);
      });
    }
    if (resupply) {
      foodLines.push(`Resupply points: ${resupply}`);
    }
    sections.push(`Food:\n${foodLines.join('\n')}`);
  } else {
    sections.push('Food:\nnone recorded');
  }

  // 8. Safety
  const sf = trek.safety || {};
  const contacts = Array.isArray(sf.contacts) ? sf.contacts : [];
  const tp = sf.trustedPerson || {};
  const safetyLines = [];

  if (contacts.length > 0) {
    safetyLines.push('Emergency contacts:');
    contacts.forEach((c) => {
      const parts = [];
      if (c.name?.trim()) parts.push(c.name.trim());
      if (c.relation?.trim()) parts.push(`relation: ${c.relation.trim()}`);
      if (c.phone?.trim()) parts.push(`phone: ${c.phone.trim()}`);
      safetyLines.push(`  - ${parts.join(', ')}`);
    });
  }

  if (tp.name?.trim() || tp.phone?.trim() || tp.expectedReturn) {
    const tpParts = [];
    if (tp.name?.trim()) tpParts.push(`name: ${tp.name.trim()}`);
    if (tp.phone?.trim()) tpParts.push(`phone: ${tp.phone.trim()}`);
    tpParts.push(`has itinerary: ${tp.hasItinerary ? 'yes' : 'no'}`);
    if (tp.expectedReturn) tpParts.push(`expected return: ${formatDate(tp.expectedReturn)}`);
    safetyLines.push(`Trusted person: ${tpParts.join(', ')}`);
  }

  if (sf.nearestHelp?.trim()) {
    safetyLines.push(`Nearest help / road head: ${sf.nearestHelp.trim()}`);
  }
  if (sf.network?.trim()) {
    safetyLines.push(`Mobile network notes: ${sf.network.trim()}`);
  }
  if (sf.medicines?.trim()) {
    safetyLines.push(`Medicines: ${sf.medicines.trim()}`);
  }

  sections.push(`Safety:\n${safetyLines.length > 0 ? safetyLines.join('\n') : 'none recorded'}`);

  return sections.join('\n\n');
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Extracts and formats month or month range (e.g. "November" or "October–November") from ISO date strings.
export function formatMonths(startDateStr, endDateStr) {
  if (!startDateStr && !endDateStr) return '';
  const getMonthName = (dStr) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      return MONTH_NAMES[m - 1] || '';
    }
    return '';
  };
  const m1 = getMonthName(startDateStr);
  const m2 = getMonthName(endDateStr);
  if (m1 && m2) {
    return m1 === m2 ? m1 : `${m1}–${m2}`;
  }
  return m1 || m2;
}

// Builds the Card 1 title from trek conditions, e.g. "Gear check — November, up to 3,600 m, own tent".
export function buildGearCheckTitle(trek) {
  if (!trek || typeof trek !== 'object') return 'Gear check';
  const parts = [];
  const months =
    formatMonths(trek.overview?.startDate, trek.overview?.endDate) ||
    formatMonths(trek.overview?.tripStartDate, trek.overview?.tripEndDate);
  if (months) parts.push(months);

  if (trek.overview?.maxAltitudeM) {
    const formattedAlt = Number(trek.overview.maxAltitudeM).toLocaleString();
    parts.push(`up to ${formattedAlt} m`);
  }

  const staySet = new Set((trek.days || []).map((d) => d.stayType).filter(Boolean));
  if (staySet.has('camping_own_tent')) {
    parts.push('own tent');
  } else if (staySet.has('homestay')) {
    parts.push('homestay');
  } else if (staySet.has('camping_booked') || staySet.has('booked_camp')) {
    parts.push('camps');
  } else if (staySet.has('lodge') || staySet.has('hut')) {
    parts.push('lodge');
  }

  if (parts.length > 0) {
    return `Gear check — ${parts.join(', ')}`;
  }
  return 'Gear check';
}

// Builds a short text block summarizing conditions, gear, food count, and essentials for Gemma review.
export function buildConditions(trek) {
  if (!trek || typeof trek !== 'object') return '';

  const months =
    formatMonths(trek.overview?.startDate, trek.overview?.endDate) ||
    formatMonths(trek.overview?.tripStartDate, trek.overview?.tripEndDate) ||
    'not set';

  const numDays = Array.isArray(trek.days) ? trek.days.length : 0;
  const maxAlt = trek.overview?.maxAltitudeM ? `max altitude: ${Number(trek.overview.maxAltitudeM).toLocaleString()} m` : null;
  const groupSize = trek.overview?.groupSize ? `group size: ${trek.overview.groupSize}` : null;

  const stayCounts = {};
  (trek.days || []).forEach((d) => {
    const st = d.stayType || 'other';
    stayCounts[st] = (stayCounts[st] || 0) + 1;
  });
  const STAY_FRIENDLY_NAMES = {
    camping_own_tent: 'own tent',
    camping_booked: 'booked tent',
    homestay: 'homestay',
    hut: 'hut',
    lodge: 'lodge',
    booked_camp: 'booked camp',
    other: 'other stay',
  };
  const stayParts = Object.entries(stayCounts).map(([st, cnt]) => {
    const name = STAY_FRIENDLY_NAMES[st] || STAY_TYPE_LABELS[st] || st;
    return `${name} on ${cnt} night${cnt === 1 ? '' : 's'}`;
  });
  const staySummary = stayParts.length > 0 ? stayParts.join(', ') : 'none recorded';

  const diff = trek.overview?.difficulty && trek.overview.difficulty !== 'not_sure'
    ? `difficulty: ${trek.overview.difficulty}`
    : null;

  const condParts = [
    `Month(s): ${months}`,
    `Trekking days: ${numDays}`,
    maxAlt,
    groupSize,
    `Stays: ${staySummary}`,
    diff,
  ].filter(Boolean);

  const gearLines = Array.isArray(trek.gear) && trek.gear.length > 0
    ? trek.gear.map((g) => {
        const name = g.item?.trim() || 'Untitled';
        const catLabel = GEAR_CATEGORIES[g.category] || g.category || 'Other';
        return `- ${name} (${catLabel})`;
      })
    : ['none recorded'];

  const foodCount = Array.isArray(trek.food?.items) ? trek.food.items.length : 0;

  const ESSENTIAL_LABELS = {
    firstAid: 'First-aid kit',
    medicines: 'Personal medicines',
    headlamp: 'Headlamp',
    powerBank: 'Power bank',
    offlineMap: 'Offline map',
    whistle: 'Whistle',
  };
  const tickedEssentials = Object.entries(trek.safety?.essentials || {})
    .filter(([_, val]) => Boolean(val))
    .map(([k]) => ESSENTIAL_LABELS[k] || k);
  const essentialsText = tickedEssentials.length > 0 ? tickedEssentials.join(', ') : 'none marked';

  return [
    'Trek conditions:',
    condParts.map((c) => `- ${c}`).join('\n'),
    '',
    'Gear list:',
    gearLines.join('\n'),
    '',
    `Food item count: ${foodCount}`,
    `Carrying essentials: ${essentialsText}`,
  ].join('\n');
}

// Checks if Ollama is reachable and whether the configured model is installed.
export async function checkOllama(settings) {
  const ollamaUrl = (settings?.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const targetModel = (settings?.model || 'gemma3:4b').trim().toLowerCase();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { ok: false, modelInstalled: false };
    }

    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];

    const modelInstalled = models.some((m) => {
      const name = (m.name || '').toLowerCase();
      const model = (m.model || '').toLowerCase();
      return (
        name === targetModel ||
        name === `${targetModel}:latest` ||
        (targetModel.includes(':') ? name === targetModel : name.split(':')[0] === targetModel) ||
        model === targetModel ||
        model === `${targetModel}:latest`
      );
    });

    return { ok: true, modelInstalled };
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('checkOllama failed:', err);
    return { ok: false, modelInstalled: false };
  }
}

// Normalizes a string by lowercasing, stripping punctuation, and collapsing whitespace.
export function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MEDICINE_REGEX = /\b(medicines?|medications?|tablets?|pills?|drugs?|doses?|capsules?)\b/i;

// Filters raw Gemma review output: validates gear_gaps and questions, drops invalid/medicine/duplicate/copied items.
export function filterSuggestions(parsed, trek, planSummary, conditions) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      result: { raw: typeof parsed === 'string' ? parsed : '' },
      droppedCount: 0,
    };
  }

  let droppedCount = 0;
  const filteredGaps = [];
  const seenGaps = new Set();

  const existingGearNames = Array.isArray(trek?.gear)
    ? trek.gear.map((g) => (g.item || '').trim().toLowerCase()).filter(Boolean)
    : [];

  const rawGaps = Array.isArray(parsed.gear_gaps) ? parsed.gear_gaps : [];
  for (const gap of rawGaps) {
    if (!gap || typeof gap !== 'object' || Array.isArray(gap)) {
      droppedCount++;
      continue;
    }

    const item = typeof gap.item === 'string' ? gap.item.trim() : '';
    const reason = typeof gap.reason === 'string' ? gap.reason.trim() : '';

    if (!item || !reason) {
      droppedCount++;
      continue;
    }

    // item must be 1–5 words
    const itemWords = item.split(/\s+/).filter(Boolean);
    if (itemWords.length < 1 || itemWords.length > 5) {
      droppedCount++;
      continue;
    }

    // reason must be 6–30 words
    const reasonWords = reason.split(/\s+/).filter(Boolean);
    if (reasonWords.length < 6 || reasonWords.length > 30) {
      droppedCount++;
      continue;
    }

    const itemLower = item.toLowerCase();

    // Drop if name matches an existing gear item (case-insensitive; either name contains the other)
    const matchesExisting = existingGearNames.some(
      (ext) => itemLower.includes(ext) || ext.includes(itemLower)
    );
    if (matchesExisting) {
      droppedCount++;
      continue;
    }

    // Drop if item or reason mentions medicine, medication, tablet, pill, drug, dose or capsule
    if (MEDICINE_REGEX.test(item) || MEDICINE_REGEX.test(reason)) {
      droppedCount++;
      continue;
    }

    // Drop duplicates
    if (seenGaps.has(itemLower)) {
      droppedCount++;
      continue;
    }

    // Max 5 gear_gaps
    if (filteredGaps.length >= 5) {
      droppedCount++;
      continue;
    }

    seenGaps.add(itemLower);
    filteredGaps.push({ item, reason });
  }

  // Questions
  const filteredQuestions = [];
  const seenQuestions = new Set();
  const normalizedTextPool = normalizeText(`${planSummary || ''} ${conditions || ''}`);

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  for (const q of rawQuestions) {
    if (typeof q !== 'string') {
      droppedCount++;
      continue;
    }

    const trimmed = q.trim();
    if (!trimmed) {
      droppedCount++;
      continue;
    }

    // Must end with ?
    if (!trimmed.endsWith('?')) {
      droppedCount++;
      continue;
    }

    // 6–30 words
    const qWords = trimmed.split(/\s+/).filter(Boolean);
    if (qWords.length < 6 || qWords.length > 30) {
      droppedCount++;
      continue;
    }

    const normQ = normalizeText(trimmed);
    if (!normQ) {
      droppedCount++;
      continue;
    }

    // Drop duplicates
    if (seenQuestions.has(normQ)) {
      droppedCount++;
      continue;
    }

    // Drop any that just copy plan text
    if (normalizedTextPool && normalizedTextPool.includes(normQ)) {
      droppedCount++;
      continue;
    }

    // Max 5 questions
    if (filteredQuestions.length >= 5) {
      droppedCount++;
      continue;
    }

    seenQuestions.add(normQ);
    filteredQuestions.push(trimmed);
  }

  return {
    result: {
      gear_gaps: filteredGaps,
      questions: filteredQuestions,
    },
    droppedCount,
  };
}

// Requests an AI plan review from Ollama via POST /api/chat with configurable timeout, cancellation, and junk filter.
export async function reviewPlan(trek, ruleResults, settings, signal) {
  const ollamaUrl = (settings?.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const model = settings?.model || 'gemma3:4b';
  const timeoutSec = typeof settings?.reviewTimeoutSec === 'number' ? settings.reviewTimeoutSec : 300;

  const conditions = buildConditions(trek);
  const planSummary = buildPlanSummary(trek);

  const ruleIssues = [
    ...(ruleResults?.critical || []),
    ...(ruleResults?.warnings || []),
  ];

  const ruleSection =
    ruleIssues.length > 0
      ? ruleIssues.map((issue) => `- [${issue.level}] ${issue.message}`).join('\n')
      : 'none';

  const userContent = `${conditions}\n\n${planSummary}\n\nrule_check_results:\n${ruleSection}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    const err = new Error(`Review timed out after ${timeoutSec}s`);
    err.code = 'timeout';
    controller.abort(err);
  }, timeoutSec * 1000);

  const onCallerAbort = () => {
    const err = new Error('Review cancelled');
    err.code = 'cancelled';
    controller.abort(err);
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeoutId);
      const cancelErr = new Error('Review cancelled');
      cancelErr.code = 'cancelled';
      throw cancelErr;
    }
    signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let replyText = '';
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        keep_alive: '10m',
        options: {
          temperature: 0.2,
          num_ctx: 4096,
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = new Error(`Ollama request failed with HTTP ${res.status}`);
      err.code = 'network';
      throw err;
    }

    const data = await res.json();
    replyText = data?.message?.content || '';
  } catch (err) {
    if (signal?.aborted || err.code === 'cancelled' || controller.signal.reason?.code === 'cancelled') {
      const cancelErr = new Error('Review cancelled');
      cancelErr.code = 'cancelled';
      throw cancelErr;
    }
    if (err.code === 'timeout' || controller.signal.reason?.code === 'timeout') {
      const timeoutErr = new Error(`Review timed out after ${timeoutSec}s`);
      timeoutErr.code = 'timeout';
      throw timeoutErr;
    }
    console.error('reviewPlan request failed:', err);
    const netErr = new Error('Gemma stopped responding during the review.');
    netErr.code = 'network';
    throw netErr;
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onCallerAbort);
    }
  }

  let parsed = null;
  try {
    parsed = JSON.parse(replyText);
  } catch (err) {
    console.error('Failed to parse Ollama JSON reply:', err);
    return {
      result: { raw: replyText.trim() },
      droppedCount: 0,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      result: { raw: replyText.trim() },
      droppedCount: 0,
    };
  }

  return filterSuggestions(parsed, trek, planSummary, conditions);
}
