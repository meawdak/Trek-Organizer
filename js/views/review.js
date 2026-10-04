import { getTrek, getSettings, loadStore, saveStore, saveTrek } from '../store.js';
import {
  escapeHtml,
  GEAR_CATEGORIES,
  normalizeGearCategory,
  CONTACT_ROLE_LABELS,
  DIRECTION_LABELS,
} from '../model.js';
import { formatDate, combineDateAndTime, renderBottomTabBar } from '../ui.js';
import { runChecks } from '../checks.js';
import {
  checkOllama,
  reviewPlan,
  extractFromNotes,
  buildGearCheckTitle,
  normalizeText,
} from '../ai.js';

// Formats an ISO timestamp to local readable DD/MM/YYYY, HH:mm format.
function formatReviewTimestamp(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}

// Formats travel mode for readable display.
function formatTravelMode(mode) {
  if (!mode) return 'Travel';
  if (mode === 'jeep' || mode === 'shared_jeep') return 'Shared jeep';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

// Checks if an extracted item already exists in the trek plan.
export function checkAlreadyInPlan(sectionKey, item, trek) {
  if (!trek || !item) return false;
  if (sectionKey === 'travel') {
    const fromNorm = normalizeText(item.from || '');
    const toNorm = normalizeText(item.to || '');
    return (trek.travel || []).some(
      (t) => normalizeText(t.from || '') === fromNorm && normalizeText(t.to || '') === toNorm
    );
  }
  if (sectionKey === 'stays') {
    const nameNorm = normalizeText(item.name || '');
    return (trek.stays || []).some((s) => normalizeText(s.name || '') === nameNorm);
  }
  if (sectionKey === 'gear') {
    const itemNorm = normalizeText(item.item || '');
    return (trek.gear || []).some((g) => normalizeText(g.item || '') === itemNorm);
  }
  if (sectionKey === 'food') {
    const itemNorm = normalizeText(item.item || '');
    return (trek.food?.items || []).some((f) => normalizeText(f.item || '') === itemNorm);
  }
  if (sectionKey === 'contacts') {
    const nameNorm = normalizeText(item.name || '');
    const phoneDigits = String(item.phone || '').replace(/\D/g, '');
    return (trek.safety?.contacts || []).some((c) => {
      if (nameNorm && normalizeText(c.name || '') === nameNorm) return true;
      if (phoneDigits && String(c.phone || '').replace(/\D/g, '') === phoneDigits) return true;
      return false;
    });
  }
  if (sectionKey === 'permits') {
    const nameNorm = normalizeText(item.name || '');
    return (trek.permits || []).some((p) => normalizeText(p.name || '') === nameNorm);
  }
  if (sectionKey === 'other') {
    const noteText = (typeof item === 'string' ? item : '').trim();
    return (trek.overview?.notes || '').includes(noteText);
  }
  return false;
}

// Appends a question to overview.notes under "Questions to answer:" heading, creating the heading if not present.
export function appendQuestionToNotes(existingNotes = '', question = '') {
  const qText = (question || '').trim();
  if (!qText) return existingNotes || '';
  const qLine = `- ${qText}`;
  const existing = (existingNotes || '').trim();

  if (!existing) {
    return `Questions to answer:\n${qLine}`;
  }

  const heading = 'Questions to answer:';
  const headingLower = heading.toLowerCase();
  const existingLower = existing.toLowerCase();

  const headingIndex = existingLower.indexOf(headingLower);
  if (headingIndex === -1) {
    return `${existing}\n\n${heading}\n${qLine}`;
  }

  // If question is already present in notes, avoid duplicate appending
  if (existing.includes(qText)) {
    return existing;
  }

  const afterHeading = existing.slice(headingIndex + heading.length);
  const nextSectionIndex = afterHeading.indexOf('\n\n');
  if (nextSectionIndex !== -1) {
    const insertPos = headingIndex + heading.length + nextSectionIndex;
    return `${existing.slice(0, insertPos)}\n${qLine}${existing.slice(insertPos)}`;
  }

  return `${existing}\n${qLine}`;
}

// Renders the review screen with "Sort my notes" and Gemma AI plan evaluation.
export function renderReview(container, trekId) {
  const trek = getTrek(trekId);

  if (!trek) {
    container.innerHTML = `
      <div class="page-container">
        <header class="page-header">
          <a href="#/" class="back-link">← Treks</a>
          <h1>Trek Not Found</h1>
        </header>
        <div class="placeholder-card">
          <p class="placeholder-message">The requested trek could not be found.</p>
        </div>
      </div>
    `;
    return;
  }

  const trekName = trek.overview?.name || 'Untitled Trek';
  const settings = getSettings();
  let currentReviewAbortController = null;
  let currentNotesAbortController = null;

  // In-memory state for "Sort my notes"
  const notesState = {
    text: '',
    extracted: null, // { travel: [], stays: [], gear: [], food: [], contacts: [], permits: [], other: [] }
    droppedCount: 0,
    itemStatuses: new Map(), // key -> 'added' | 'skipped'
    travelDirections: new Map(), // key -> 'to' | 'during' | 'return'
  };

  function renderExtractedResultsHtml(currentTrek) {
    if (!notesState.extracted) return '';

    const {
      travel = [],
      stays = [],
      gear = [],
      food = [],
      contacts = [],
      permits = [],
      other = [],
    } = notesState.extracted;

    const totalExtracted =
      travel.length +
      stays.length +
      gear.length +
      food.length +
      contacts.length +
      permits.length +
      other.length;

    if (totalExtracted === 0) {
      return `
        <div class="notes-empty-note" role="status">
          <p>Gemma didn't find anything to add. Try pasting more specific text.</p>
        </div>
      `;
    }

    const sectionsHtml = [];

    // Helper to render action buttons or status badge
    const renderCardActions = (key, section, idx, isAddDisabled = false) => {
      const status = notesState.itemStatuses.get(key);
      if (status === 'added') {
        return `<span class="extracted-status-badge badge-added">Added ✓</span>`;
      }
      if (status === 'skipped') {
        return `<span class="extracted-status-badge badge-skipped">Skipped</span>`;
      }
      return `
        <div class="extracted-item-actions">
          <button
            type="button"
            class="btn btn-add btn-sm btn-extract-add"
            data-key="${escapeHtml(key)}"
            data-section="${escapeHtml(section)}"
            data-index="${idx}"
            ${isAddDisabled ? 'disabled' : ''}
          >
            Add
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm btn-extract-skip"
            data-key="${escapeHtml(key)}"
            data-section="${escapeHtml(section)}"
            data-index="${idx}"
          >
            Skip
          </button>
        </div>
      `;
    };

    // 1. Travel
    if (travel.length > 0) {
      const items = travel.map((t, idx) => {
        const key = `travel-${idx}`;
        const isSimilar = checkAlreadyInPlan('travel', t, currentTrek);
        const currentDir = notesState.travelDirections.get(key) || t.direction;
        const isDirectionUnknown = !currentDir || currentDir === 'unknown';

        const route = [t.from, t.to].filter(Boolean).join(' → ') || 'Route unknown';
        const modeTitle = formatTravelMode(t.mode);

        const depParts = [];
        if (t.date) depParts.push(formatDate(t.date));
        if (t.time) depParts.push(t.time);
        const depStr = depParts.join(', ');

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(modeTitle)}: ${escapeHtml(route)}</div>
              ${
                depStr
                  ? `
                <div class="extracted-field-row">
                  <span class="extracted-field-value">Departs: ${escapeHtml(depStr)}</span>
                  ${t.dateCheck ? `<span class="badge-check-date">Check this date</span>` : ''}
                </div>
              `
                  : ''
              }
              ${
                t.bookingRef
                  ? `<div class="extracted-field-row"><span class="extracted-field-sub">Ref: ${escapeHtml(t.bookingRef)}</span></div>`
                  : ''
              }
              ${
                isDirectionUnknown
                  ? `
                <div class="direction-select-wrapper">
                  <label for="dir-select-${idx}" class="direction-label">Direction:</label>
                  <select id="dir-select-${idx}" class="travel-dir-select text-select-sm" data-key="${escapeHtml(key)}">
                    <option value="">Choose direction...</option>
                    <option value="to" ${currentDir === 'to' ? 'selected' : ''}>Approach</option>
                    <option value="during" ${currentDir === 'during' ? 'selected' : ''}>During trek</option>
                    <option value="return" ${currentDir === 'return' ? 'selected' : ''}>Return</option>
                  </select>
                </div>
              `
                  : `
                <div class="extracted-field-sub">Direction: ${escapeHtml(DIRECTION_LABELS[currentDir] || currentDir)}</div>
              `
              }
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'travel', idx, isDirectionUnknown)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="travel">
          <h4 class="extracted-section-title">Travel</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    // 2. Stays
    if (stays.length > 0) {
      const items = stays.map((s, idx) => {
        const key = `stays-${idx}`;
        const isSimilar = checkAlreadyInPlan('stays', s, currentTrek);
        const namePlace = [s.name, s.place].filter(Boolean).join(', ') || 'Stay';
        const nightsText = s.nights ? `${s.nights} night${s.nights > 1 ? 's' : ''}` : '';

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(namePlace)}</div>
              ${
                s.checkIn
                  ? `
                <div class="extracted-field-row">
                  <span class="extracted-field-value">Check-in: ${escapeHtml(formatDate(s.checkIn))}</span>
                  ${s.checkInCheck ? `<span class="badge-check-date">Check this date</span>` : ''}
                </div>
              `
                  : ''
              }
              ${nightsText ? `<div class="extracted-field-sub">${escapeHtml(nightsText)}</div>` : ''}
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'stays', idx, false)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="stays">
          <h4 class="extracted-section-title">Stays</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    // 3. Gear
    if (gear.length > 0) {
      const items = gear.map((g, idx) => {
        const key = `gear-${idx}`;
        const isSimilar = checkAlreadyInPlan('gear', g, currentTrek);
        const catLabel = GEAR_CATEGORIES[normalizeGearCategory(g.category)] || 'Other';

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(g.item)}</div>
              <div class="extracted-field-sub">Category: ${escapeHtml(catLabel)}</div>
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'gear', idx, false)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="gear">
          <h4 class="extracted-section-title">Gear</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    // 4. Food
    if (food.length > 0) {
      const items = food.map((f, idx) => {
        const key = `food-${idx}`;
        const isSimilar = checkAlreadyInPlan('food', f, currentTrek);

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(f.item)}</div>
              ${f.quantity ? `<div class="extracted-field-sub">Quantity: ${escapeHtml(f.quantity)}</div>` : ''}
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'food', idx, false)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="food">
          <h4 class="extracted-section-title">Food & ration</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    // 5. Contacts
    if (contacts.length > 0) {
      const items = contacts.map((c, idx) => {
        const key = `contacts-${idx}`;
        const isSimilar = checkAlreadyInPlan('contacts', c, currentTrek);
        const roleLabel = CONTACT_ROLE_LABELS[c.role] || c.role || 'Other';

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(c.name)} (${escapeHtml(roleLabel)})</div>
              ${c.phone ? `<div class="extracted-field-sub">Phone: ${escapeHtml(c.phone)}</div>` : ''}
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'contacts', idx, false)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="contacts">
          <h4 class="extracted-section-title">Emergency contacts</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    // 6. Permits
    if (permits.length > 0) {
      const items = permits.map((p, idx) => {
        const key = `permits-${idx}`;
        const isSimilar = checkAlreadyInPlan('permits', p, currentTrek);

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(p.name)}</div>
              ${p.authority ? `<div class="extracted-field-sub">Authority: ${escapeHtml(p.authority)}</div>` : ''}
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'permits', idx, false)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="permits">
          <h4 class="extracted-section-title">Permits</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    // 7. Other notes
    if (other.length > 0) {
      const items = other.map((o, idx) => {
        const key = `other-${idx}`;
        const isSimilar = checkAlreadyInPlan('other', o, currentTrek);

        return `
          <li class="extracted-item-card" data-item-key="${escapeHtml(key)}">
            <div class="extracted-item-main">
              <div class="extracted-item-title">${escapeHtml(o)}</div>
              ${isSimilar ? `<div class="review-already-exists">Already in your plan?</div>` : ''}
            </div>
            ${renderCardActions(key, 'other', idx, false)}
          </li>
        `;
      });

      sectionsHtml.push(`
        <div class="extracted-section" data-section="other">
          <h4 class="extracted-section-title">Other notes</h4>
          <ul class="extracted-items-list">${items.join('')}</ul>
        </div>
      `);
    }

    return `
      <div class="extracted-results-wrapper">
        <div class="extracted-header-row">
          <h3 class="extracted-main-heading">Extracted suggestions</h3>
          <button type="button" id="btn-add-all-remaining" class="btn btn-secondary btn-sm">Add all remaining</button>
        </div>

        ${
          notesState.droppedCount > 0
            ? `<p class="notes-dropped-note">Some details weren't found word-for-word in your text and were left out.</p>`
            : ''
        }

        ${sectionsHtml.join('')}
      </div>
    `;
  }

  function renderView() {
    const currentTrek = getTrek(trekId) || trek;
    const aiReview = currentTrek.aiReview;

    const hasPlanChanged = Boolean(
      aiReview &&
      aiReview.at &&
      currentTrek.updatedAt &&
      new Date(currentTrek.updatedAt) > new Date(aiReview.at)
    );

    const formattedReviewedAt = aiReview?.at ? formatReviewTimestamp(aiReview.at) : '';
    const reviewModel = aiReview?.model || settings.model || 'gemma3:4b';

    let resultsHtml = '';
    if (aiReview && aiReview.result) {
      const res = aiReview.result;
      const isOldReview = Boolean(
        !Array.isArray(res.gear_gaps) &&
        !Array.isArray(res.questions) &&
        (Array.isArray(res.missing) || Array.isArray(res.unclear) || Array.isArray(res.consider))
      );

      if (isOldReview) {
        resultsHtml = `
          <div class="review-old-version-advisory" role="status">
            <p>This review was made with an older version. Run it again.</p>
          </div>
        `;
      } else if (res.raw) {
        resultsHtml = `
          <section class="review-group-card" aria-labelledby="heading-gemma-notes">
            <h2 id="heading-gemma-notes" class="review-group-title">Gemma's notes</h2>
            <pre class="review-raw-notes">${escapeHtml(res.raw)}</pre>
          </section>
        `;
      } else {
        const gearGaps = Array.isArray(res.gear_gaps) ? res.gear_gaps : [];
        const questions = Array.isArray(res.questions) ? res.questions : [];
        const isAllEmpty = gearGaps.length === 0 && questions.length === 0;

        if (isAllEmpty) {
          resultsHtml = `
            <div class="review-empty-advisory" role="status">
              <p>Gemma didn't produce useful suggestions this time. Small models (like gemma3:1b) often struggle with this; gemma3:4b gives better results if your laptop has 8 GB of memory or more. The Plan Check on the Dashboard still covers the essentials.</p>
            </div>
          `;
        } else {
          const card1Title = buildGearCheckTitle(currentTrek);

          const existingGearNames = (currentTrek.gear || []).map((g) =>
            normalizeText(g?.item || '')
          );
          const existingNotes = currentTrek.overview?.notes || '';

          const card1Html = `
            <section class="review-group-card" aria-labelledby="heading-gear-gaps">
              <h2 id="heading-gear-gaps" class="review-group-title">${escapeHtml(card1Title)}</h2>
              ${
                gearGaps.length > 0
                  ? `
                <ul class="review-items-list">
                  ${gearGaps
                    .map((gap, idx) => {
                      const itemNorm = normalizeText(gap.item || '');
                      const isAdded = existingGearNames.includes(itemNorm);
                      return `
                    <li class="review-action-item">
                      <div class="review-item-main">
                        <span class="chip-suggestion">Suggestion — check this yourself</span>
                        <div class="review-gear-gap-content">
                          <strong class="review-gear-gap-item">${escapeHtml(gap.item)}</strong>
                          ${gap.reason ? `<span class="review-gear-gap-reason">${escapeHtml(gap.reason)}</span>` : ''}
                        </div>
                      </div>
                      <div class="review-item-action">
                        <button
                          type="button"
                          class="btn btn-secondary btn-review-add-gear"
                          data-index="${idx}"
                          data-item="${escapeHtml(gap.item)}"
                          ${isAdded ? 'disabled' : ''}
                        >
                          ${isAdded ? 'Added ✓' : 'Add to Gear'}
                        </button>
                      </div>
                    </li>
                  `;
                    })
                    .join('')}
                </ul>
              `
                  : '<p class="review-empty-group">Nothing to add here.</p>'
              }
            </section>
          `;

          const card2Html = `
            <section class="review-group-card" aria-labelledby="heading-questions">
              <h2 id="heading-questions" class="review-group-title">Questions worth answering</h2>
              ${
                questions.length > 0
                  ? `
                <ul class="review-items-list">
                  ${questions
                    .map((q, idx) => {
                      const isAdded = existingNotes.includes(q.trim());
                      return `
                    <li class="review-action-item">
                      <div class="review-item-main">
                        <span class="chip-suggestion">Suggestion — check this yourself</span>
                        <div class="review-question-text">${escapeHtml(q)}</div>
                      </div>
                      <div class="review-item-action">
                        <button
                          type="button"
                          class="btn btn-secondary btn-review-add-note"
                          data-index="${idx}"
                          data-question="${escapeHtml(q)}"
                          ${isAdded ? 'disabled' : ''}
                        >
                          ${isAdded ? 'Added ✓' : 'Add to my notes'}
                        </button>
                      </div>
                    </li>
                  `;
                    })
                    .join('')}
                </ul>
              `
                  : '<p class="review-empty-group">Nothing to add here.</p>'
              }
            </section>
          `;

          resultsHtml = `
            <div class="review-groups-container">
              ${card1Html}
              ${card2Html}
            </div>
            ${
              aiReview.droppedCount > 0
                ? `<p class="review-dropped-note">Some low-quality suggestions were hidden.</p>`
                : ''
            }
          `;
        }
      }
    }

    container.innerHTML = `
      <div class="page-container review-page">
        <header class="page-header">
          <a href="#/trek/${encodeURIComponent(trek.id)}/dashboard" class="back-link">← ${escapeHtml(trekName)}</a>
          <h1 class="page-title">Gemma — plan check</h1>
        </header>

        <p class="review-intro">Gemma runs on this laptop through Ollama. Your plan is not sent to the internet.</p>

        <!-- 1. "Sort my notes" Card (Above Plan Check) -->
        <section class="review-group-card sort-notes-card" aria-labelledby="heading-sort-notes">
          <h2 id="heading-sort-notes" class="review-group-title">Sort my notes</h2>
          <p class="sort-notes-hint">
            Paste booking messages, WhatsApp tips or your own notes. Gemma pulls out travel, stays, gear, food, contacts and permits for you to add. Your notes are processed on this laptop only.
          </p>

          <div class="sort-notes-input-area">
            <textarea
              id="sort-notes-textarea"
              class="sort-notes-textarea"
              maxlength="4000"
              rows="5"
              placeholder="Paste booking messages, WhatsApp tips or your own notes here..."
            >${escapeHtml(notesState.text)}</textarea>
            <div class="sort-notes-meta-row">
              <span id="sort-notes-counter" class="sort-notes-counter">${notesState.text.length} / 4000</span>
            </div>
          </div>

          <div id="sort-notes-action-area" class="review-action-area">
            <div class="review-buttons-row">
              <button type="button" id="btn-sort-notes" class="btn btn-primary">Sort into my plan</button>
            </div>
            <div id="sort-notes-status-msg" class="review-status-msg" role="status" hidden></div>
          </div>

          <div id="sort-notes-running-area" class="review-running-area" hidden>
            <div class="review-running-box">
              <div class="review-spinner" aria-hidden="true"></div>
              <p id="sort-notes-running-text" class="review-running-text">Gemma is reading your notes… 0:00</p>
              <button type="button" id="btn-cancel-sort" class="btn btn-secondary">Cancel</button>
            </div>
          </div>

          <div id="sort-notes-results-container" class="sort-notes-results-container">
            ${renderExtractedResultsHtml(currentTrek)}
          </div>
        </section>

        <!-- 2. "Plan check" Section -->
        <div class="review-plan-check-section">
          <div class="review-section-header">
            <h2 class="review-section-title">Plan check</h2>
          </div>

          <div id="review-action-area" class="review-action-area">
            <div class="review-buttons-row">
              <button type="button" id="btn-review-plan" class="btn btn-primary">Review my plan</button>
            </div>
            <div id="review-status-msg" class="review-status-msg" role="status" hidden></div>
          </div>

          <div id="review-running-area" class="review-running-area" hidden>
            <div class="review-running-box">
              <div class="review-spinner" aria-hidden="true"></div>
              <p id="review-running-text" class="review-running-text">Gemma is reading your plan… 0:00</p>
              <button type="button" id="btn-cancel-review" class="btn btn-secondary">Cancel</button>
            </div>
          </div>

          ${
            aiReview
              ? `
            <div class="review-results-wrapper">
              <div class="review-meta-bar">
                <span class="review-meta-text">Reviewed ${escapeHtml(formattedReviewedAt)} with ${escapeHtml(reviewModel)}</span>
              </div>

              ${
                hasPlanChanged
                  ? `
                <div class="review-stale-banner" role="status">
                  Your plan has changed since this review. Run it again for up-to-date suggestions.
                </div>
              `
                  : ''
              }

              ${resultsHtml}
            </div>
          `
              : ''
          }
        </div>

        ${renderBottomTabBar(trekId, 'review')}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // ─── Sort My Notes Handlers ───
    const textarea = container.querySelector('#sort-notes-textarea');
    const charCounter = container.querySelector('#sort-notes-counter');
    const btnSort = container.querySelector('#btn-sort-notes');
    const btnCancelSort = container.querySelector('#btn-cancel-sort');
    const sortActionArea = container.querySelector('#sort-notes-action-area');
    const sortRunningArea = container.querySelector('#sort-notes-running-area');
    const sortRunningText = container.querySelector('#sort-notes-running-text');
    const sortStatusMsg = container.querySelector('#sort-notes-status-msg');

    if (textarea && charCounter) {
      textarea.addEventListener('input', () => {
        notesState.text = textarea.value;
        charCounter.textContent = `${textarea.value.length} / 4000`;
      });
    }

    if (btnCancelSort) {
      btnCancelSort.addEventListener('click', () => {
        if (currentNotesAbortController) {
          currentNotesAbortController.abort();
        }
      });
    }

    if (btnSort) {
      btnSort.addEventListener('click', async () => {
        const rawText = (textarea?.value || '').trim();
        if (!rawText) {
          if (sortStatusMsg) {
            sortStatusMsg.textContent = 'Please paste some notes or messages first.';
            sortStatusMsg.className = 'review-status-msg error';
            sortStatusMsg.hidden = false;
          }
          return;
        }

        sortStatusMsg.hidden = true;
        sortStatusMsg.className = 'review-status-msg';
        sortStatusMsg.textContent = '';

        // Pre-check Ollama reachability & model
        const currentSettings = getSettings();
        const check = await checkOllama(currentSettings);

        if (!check.ok) {
          sortStatusMsg.textContent =
            "Gemma isn't reachable. Start Ollama on this laptop and try again. The Plan Check on the Dashboard still works without it.";
          sortStatusMsg.classList.add('error');
          sortStatusMsg.hidden = false;
          return;
        }

        if (!check.modelInstalled) {
          sortStatusMsg.textContent = `The model "${currentSettings.model}" isn't installed. Run "ollama pull ${currentSettings.model}" in a terminal, or change the model in Settings.`;
          sortStatusMsg.classList.add('error');
          sortStatusMsg.hidden = false;
          return;
        }

        // Start running state
        sortActionArea.hidden = true;
        sortRunningArea.hidden = false;

        const startTime = Date.now();
        const updateSortElapsed = () => {
          const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
          const m = Math.floor(elapsedSec / 60);
          const s = String(elapsedSec % 60).padStart(2, '0');
          if (sortRunningText) {
            sortRunningText.textContent = `Gemma is reading your notes… ${m}:${s}`;
          }
        };
        updateSortElapsed();
        const sortInterval = setInterval(updateSortElapsed, 1000);

        currentNotesAbortController = new AbortController();

        try {
          const latestTrek = getTrek(trekId);
          if (!latestTrek) {
            throw new Error('Trek not found');
          }

          const { result, droppedCount } = await extractFromNotes(
            rawText,
            latestTrek,
            currentSettings,
            currentNotesAbortController.signal
          );

          notesState.extracted = result;
          notesState.droppedCount = droppedCount;
          notesState.itemStatuses = new Map();
          notesState.travelDirections = new Map();

          // Pre-populate travel directions if already known
          (result.travel || []).forEach((t, idx) => {
            if (t.direction && t.direction !== 'unknown') {
              notesState.travelDirections.set(`travel-${idx}`, t.direction);
            }
          });

          renderView();
        } catch (err) {
          sortActionArea.hidden = false;
          sortRunningArea.hidden = true;

          if (err?.code === 'cancelled' || currentNotesAbortController?.signal.aborted) {
            sortStatusMsg.textContent = 'Notes sorting cancelled.';
            sortStatusMsg.className = 'review-status-msg info';
            sortStatusMsg.hidden = false;
          } else if (err?.code === 'timeout') {
            const timeoutSec = currentSettings.reviewTimeoutSec || 300;
            const timeoutMin = Math.round(timeoutSec / 60);
            const minUnit = timeoutMin === 1 ? '1 minute' : `${timeoutMin} minutes`;
            sortStatusMsg.textContent = `Gemma took longer than ${minUnit} and was stopped. Laptops with little memory can be slow — try again (the second run is usually faster), close other apps, or use a smaller model in Settings.`;
            sortStatusMsg.className = 'review-status-msg error';
            sortStatusMsg.hidden = false;
          } else if (err?.code === 'network') {
            sortStatusMsg.textContent =
              'Gemma stopped responding during notes extraction. Check that Ollama is still running and try again.';
            sortStatusMsg.className = 'review-status-msg error';
            sortStatusMsg.hidden = false;
          } else {
            console.error('extractFromNotes failed:', err);
            sortStatusMsg.textContent =
              "Gemma isn't reachable. Start Ollama on this laptop and try again. The Plan Check on the Dashboard still works without it.";
            sortStatusMsg.className = 'review-status-msg error';
            sortStatusMsg.hidden = false;
          }
        } finally {
          clearInterval(sortInterval);
          currentNotesAbortController = null;
        }
      });
    }

    // Direction dropdown change handler
    container.querySelectorAll('.travel-dir-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const key = sel.getAttribute('data-key');
        const chosenDir = e.target.value;
        notesState.travelDirections.set(key, chosenDir);
        const cardEl = container.querySelector(`[data-item-key="${key}"]`);
        const addBtn = cardEl?.querySelector('.btn-extract-add');
        if (addBtn) {
          addBtn.disabled = !chosenDir || chosenDir === 'unknown';
        }
      });
    });

    // Helper to add single item to trek plan
    const addItemToPlan = (section, idx, key) => {
      const currentTrek = getTrek(trekId);
      if (!currentTrek || !notesState.extracted) return;
      const itemsList = notesState.extracted[section] || [];
      const item = itemsList[idx];
      if (!item) return;

      if (section === 'travel') {
        const dir = notesState.travelDirections.get(key) || item.direction;
        if (!dir || dir === 'unknown') return;
        let mode = item.mode || 'other';
        if (mode === 'jeep') mode = 'shared_jeep';
        currentTrek.travel.push({
          id: crypto.randomUUID(),
          direction: dir,
          mode: mode,
          from: item.from || '',
          to: item.to || '',
          departAt: combineDateAndTime(item.date, item.time),
          bookingRef: item.bookingRef || '',
          status: 'unknown',
          notes: '',
        });
      } else if (section === 'stays') {
        currentTrek.stays.push({
          id: crypto.randomUUID(),
          name: item.name || '',
          place: item.place || '',
          checkIn: item.checkIn || '',
          nights: Number(item.nights) > 0 ? Number(item.nights) : 1,
          status: 'unknown',
          bookingRef: '',
          notes: '',
        });
      } else if (section === 'gear') {
        currentTrek.gear.push({
          id: crypto.randomUUID(),
          item: item.item || '',
          category: normalizeGearCategory(item.category, item.item),
          source: 'have',
          packed: false,
        });
      } else if (section === 'food') {
        if (!currentTrek.food) currentTrek.food = { items: [], resupply: '' };
        if (!Array.isArray(currentTrek.food.items)) currentTrek.food.items = [];
        currentTrek.food.items.push({
          id: crypto.randomUUID(),
          item: item.item || '',
          quantity: item.quantity || '',
          day: '',
          meal: 'dinner',
          packed: false,
        });
      } else if (section === 'contacts') {
        if (!currentTrek.safety) currentTrek.safety = { contacts: [], trustedPerson: {}, essentials: {} };
        if (!Array.isArray(currentTrek.safety.contacts)) currentTrek.safety.contacts = [];
        currentTrek.safety.contacts.push({
          id: crypto.randomUUID(),
          name: item.name || '',
          phone: item.phone || '',
          role: item.role || 'other',
          relation: '',
        });
      } else if (section === 'permits') {
        currentTrek.permits.push({
          id: crypto.randomUUID(),
          name: item.name || '',
          authority: item.authority || '',
          status: 'unknown',
          cost: '',
          notes: '',
        });
      } else if (section === 'other') {
        if (!currentTrek.overview) currentTrek.overview = {};
        const existingNotes = (currentTrek.overview.notes || '').trim();
        const noteLine = String(item).trim();
        currentTrek.overview.notes = existingNotes ? `${existingNotes}\n- ${noteLine}` : `- ${noteLine}`;
      }

      const savedTrek = saveTrek(currentTrek);
      if (savedTrek.aiReview) {
        savedTrek.aiReview.at = savedTrek.updatedAt;
        const store = loadStore();
        const tIdx = store.treks.findIndex((t) => t.id === savedTrek.id);
        if (tIdx >= 0) {
          store.treks[tIdx].aiReview.at = savedTrek.updatedAt;
          saveStore(store);
        }
      }

      notesState.itemStatuses.set(key, 'added');
      const cardEl = container.querySelector(`[data-item-key="${key}"]`);
      if (cardEl) {
        const actionsEl = cardEl.querySelector('.extracted-item-actions');
        if (actionsEl) {
          actionsEl.innerHTML = `<span class="extracted-status-badge badge-added">Added ✓</span>`;
        }
      }
    };

    // Single item "Add"
    container.querySelectorAll('.btn-extract-add').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        const section = btn.getAttribute('data-section');
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        addItemToPlan(section, idx, key);
      });
    });

    // Single item "Skip"
    container.querySelectorAll('.btn-extract-skip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        notesState.itemStatuses.set(key, 'skipped');
        const cardEl = container.querySelector(`[data-item-key="${key}"]`);
        if (cardEl) {
          const actionsEl = cardEl.querySelector('.extracted-item-actions');
          if (actionsEl) {
            actionsEl.innerHTML = `<span class="extracted-status-badge badge-skipped">Skipped</span>`;
          }
        }
      });
    });

    // "Add all remaining" button
    const btnAddAll = container.querySelector('#btn-add-all-remaining');
    if (btnAddAll) {
      btnAddAll.addEventListener('click', () => {
        const currentTrek = getTrek(trekId);
        if (!currentTrek || !notesState.extracted) return;
        let anyAdded = false;

        // 1. Travel
        (notesState.extracted.travel || []).forEach((t, idx) => {
          const key = `travel-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          const dir = notesState.travelDirections.get(key) || t.direction;
          if (!dir || dir === 'unknown') return; // Skips unknown direction!
          let mode = t.mode || 'other';
          if (mode === 'jeep') mode = 'shared_jeep';
          currentTrek.travel.push({
            id: crypto.randomUUID(),
            direction: dir,
            mode: mode,
            from: t.from || '',
            to: t.to || '',
            departAt: combineDateAndTime(t.date, t.time),
            bookingRef: t.bookingRef || '',
            status: 'unknown',
            notes: '',
          });
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        // 2. Stays
        (notesState.extracted.stays || []).forEach((s, idx) => {
          const key = `stays-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          currentTrek.stays.push({
            id: crypto.randomUUID(),
            name: s.name || '',
            place: s.place || '',
            checkIn: s.checkIn || '',
            nights: Number(s.nights) > 0 ? Number(s.nights) : 1,
            status: 'unknown',
            bookingRef: '',
            notes: '',
          });
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        // 3. Gear
        (notesState.extracted.gear || []).forEach((g, idx) => {
          const key = `gear-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          currentTrek.gear.push({
            id: crypto.randomUUID(),
            item: g.item || '',
            category: normalizeGearCategory(g.category, g.item),
            source: 'have',
            packed: false,
          });
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        // 4. Food
        if (!currentTrek.food) currentTrek.food = { items: [], resupply: '' };
        if (!Array.isArray(currentTrek.food.items)) currentTrek.food.items = [];
        (notesState.extracted.food || []).forEach((f, idx) => {
          const key = `food-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          currentTrek.food.items.push({
            id: crypto.randomUUID(),
            item: f.item || '',
            quantity: f.quantity || '',
            day: '',
            meal: 'dinner',
            packed: false,
          });
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        // 5. Contacts
        if (!currentTrek.safety) currentTrek.safety = { contacts: [], trustedPerson: {}, essentials: {} };
        if (!Array.isArray(currentTrek.safety.contacts)) currentTrek.safety.contacts = [];
        (notesState.extracted.contacts || []).forEach((c, idx) => {
          const key = `contacts-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          currentTrek.safety.contacts.push({
            id: crypto.randomUUID(),
            name: c.name || '',
            phone: c.phone || '',
            role: c.role || 'other',
            relation: '',
          });
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        // 6. Permits
        (notesState.extracted.permits || []).forEach((p, idx) => {
          const key = `permits-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          currentTrek.permits.push({
            id: crypto.randomUUID(),
            name: p.name || '',
            authority: p.authority || '',
            status: 'unknown',
            cost: '',
            notes: '',
          });
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        // 7. Other
        (notesState.extracted.other || []).forEach((o, idx) => {
          const key = `other-${idx}`;
          if (notesState.itemStatuses.has(key)) return;
          if (!currentTrek.overview) currentTrek.overview = {};
          const existingNotes = (currentTrek.overview.notes || '').trim();
          const noteLine = String(o).trim();
          currentTrek.overview.notes = existingNotes ? `${existingNotes}\n- ${noteLine}` : `- ${noteLine}`;
          notesState.itemStatuses.set(key, 'added');
          anyAdded = true;
        });

        if (anyAdded) {
          const savedTrek = saveTrek(currentTrek);
          if (savedTrek.aiReview) {
            savedTrek.aiReview.at = savedTrek.updatedAt;
            const store = loadStore();
            const tIdx = store.treks.findIndex((t) => t.id === savedTrek.id);
            if (tIdx >= 0) {
              store.treks[tIdx].aiReview.at = savedTrek.updatedAt;
              saveStore(store);
            }
          }
        }

        // Update DOM for all items that were newly added
        notesState.itemStatuses.forEach((st, k) => {
          if (st === 'added') {
            const cardEl = container.querySelector(`[data-item-key="${k}"]`);
            if (cardEl) {
              const actEl = cardEl.querySelector('.extracted-item-actions');
              if (actEl) {
                actEl.innerHTML = `<span class="extracted-status-badge badge-added">Added ✓</span>`;
              }
            }
          }
        });
      });
    }

    // ─── Plan Check Handlers ───
    const btnReview = container.querySelector('#btn-review-plan');
    const btnCancelReview = container.querySelector('#btn-cancel-review');
    const reviewActionArea = container.querySelector('#review-action-area');
    const reviewRunningArea = container.querySelector('#review-running-area');
    const reviewRunningText = container.querySelector('#review-running-text');
    const reviewStatusMsg = container.querySelector('#review-status-msg');

    // Wire "Add to Gear" buttons on plan check Card 1
    const addGearBtns = container.querySelectorAll('.btn-review-add-gear');
    addGearBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemName = btn.getAttribute('data-item');
        if (!itemName) return;
        const currentTrek = getTrek(trekId);
        if (!currentTrek) return;

        if (!Array.isArray(currentTrek.gear)) {
          currentTrek.gear = [];
        }

        currentTrek.gear.push({
          id: crypto.randomUUID(),
          item: itemName,
          category: normalizeGearCategory(itemName, itemName),
          source: 'buy',
          packed: false,
        });

        const savedTrek = saveTrek(currentTrek);
        if (savedTrek.aiReview) {
          savedTrek.aiReview.at = savedTrek.updatedAt;
          const store = loadStore();
          const tIdx = store.treks.findIndex((t) => t.id === savedTrek.id);
          if (tIdx >= 0) {
            store.treks[tIdx].aiReview.at = savedTrek.updatedAt;
            saveStore(store);
          }
        }

        btn.disabled = true;
        btn.textContent = 'Added ✓';
      });
    });

    // Wire "Add to my notes" buttons on plan check Card 2
    const addNoteBtns = container.querySelectorAll('.btn-review-add-note');
    addNoteBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const questionText = btn.getAttribute('data-question');
        if (!questionText) return;
        const currentTrek = getTrek(trekId);
        if (!currentTrek) return;

        if (!currentTrek.overview) {
          currentTrek.overview = {};
        }

        currentTrek.overview.notes = appendQuestionToNotes(
          currentTrek.overview.notes,
          questionText
        );

        const savedTrek = saveTrek(currentTrek);
        if (savedTrek.aiReview) {
          savedTrek.aiReview.at = savedTrek.updatedAt;
          const store = loadStore();
          const tIdx = store.treks.findIndex((t) => t.id === savedTrek.id);
          if (tIdx >= 0) {
            store.treks[tIdx].aiReview.at = savedTrek.updatedAt;
            saveStore(store);
          }
        }

        btn.disabled = true;
        btn.textContent = 'Added ✓';
      });
    });

    if (btnCancelReview) {
      btnCancelReview.addEventListener('click', () => {
        if (currentReviewAbortController) {
          currentReviewAbortController.abort();
        }
      });
    }

    if (btnReview) {
      btnReview.addEventListener('click', async () => {
        reviewStatusMsg.hidden = true;
        reviewStatusMsg.className = 'review-status-msg';
        reviewStatusMsg.textContent = '';

        // 1. Pre-check Ollama reachability and installed model
        const currentSettings = getSettings();
        const check = await checkOllama(currentSettings);

        if (!check.ok) {
          reviewStatusMsg.textContent =
            "Gemma isn't reachable. Start Ollama on this laptop and try again. The Plan Check on the Dashboard still works without it.";
          reviewStatusMsg.classList.add('error');
          reviewStatusMsg.hidden = false;
          return;
        }

        if (!check.modelInstalled) {
          reviewStatusMsg.textContent = `The model "${currentSettings.model}" isn't installed. Run "ollama pull ${currentSettings.model}" in a terminal, or change the model in Settings.`;
          reviewStatusMsg.classList.add('error');
          reviewStatusMsg.hidden = false;
          return;
        }

        // 2. Transition to running state and start elapsed timer
        reviewActionArea.hidden = true;
        reviewRunningArea.hidden = false;

        const startTime = Date.now();
        const updateElapsed = () => {
          const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
          const m = Math.floor(elapsedSec / 60);
          const s = String(elapsedSec % 60).padStart(2, '0');
          if (reviewRunningText) {
            reviewRunningText.textContent = `Gemma is reading your plan… ${m}:${s}`;
          }
        };
        updateElapsed();
        const elapsedInterval = setInterval(updateElapsed, 1000);

        currentReviewAbortController = new AbortController();

        try {
          const latestTrek = getTrek(trekId);
          if (!latestTrek) {
            throw new Error('Trek not found');
          }
          const ruleResults = runChecks(latestTrek);
          const { result, droppedCount } = await reviewPlan(
            latestTrek,
            ruleResults,
            currentSettings,
            currentReviewAbortController.signal
          );

          // 3. Save review result to trek
          latestTrek.aiReview = {
            at: '',
            model: currentSettings.model || 'gemma3:4b',
            result,
            droppedCount: typeof droppedCount === 'number' ? droppedCount : 0,
          };

          const savedTrek = saveTrek(latestTrek);
          savedTrek.aiReview.at = savedTrek.updatedAt;

          const store = loadStore();
          const trekIndex = store.treks.findIndex((t) => t.id === savedTrek.id);
          if (trekIndex >= 0) {
            store.treks[trekIndex].aiReview.at = savedTrek.updatedAt;
            saveStore(store);
          }

          renderView();
        } catch (err) {
          reviewActionArea.hidden = false;
          reviewRunningArea.hidden = true;

          if (err?.code === 'cancelled' || currentReviewAbortController?.signal.aborted) {
            reviewStatusMsg.textContent = 'Review cancelled.';
            reviewStatusMsg.className = 'review-status-msg info';
            reviewStatusMsg.hidden = false;
          } else if (err?.code === 'timeout') {
            const timeoutSec = currentSettings.reviewTimeoutSec || 300;
            const timeoutMin = Math.round(timeoutSec / 60);
            const minUnit = timeoutMin === 1 ? '1 minute' : `${timeoutMin} minutes`;
            reviewStatusMsg.textContent = `Gemma took longer than ${minUnit} and was stopped. Laptops with little memory can be slow — try again (the second run is usually faster), close other apps, or use a smaller model in Settings.`;
            reviewStatusMsg.className = 'review-status-msg error';
            reviewStatusMsg.hidden = false;
          } else if (err?.code === 'network') {
            reviewStatusMsg.textContent =
              'Gemma stopped responding during the review. Check that Ollama is still running and try again.';
            reviewStatusMsg.className = 'review-status-msg error';
            reviewStatusMsg.hidden = false;
          } else {
            console.error('Review failed:', err);
            reviewStatusMsg.textContent =
              "Gemma isn't reachable. Start Ollama on this laptop and try again. The Plan Check on the Dashboard still works without it.";
            reviewStatusMsg.className = 'review-status-msg error';
            reviewStatusMsg.hidden = false;
          }
        } finally {
          clearInterval(elapsedInterval);
          currentReviewAbortController = null;
        }
      });
    }
  }

  renderView();
}
