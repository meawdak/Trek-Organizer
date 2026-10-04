import { getTrek, getSettings, loadStore, saveStore, saveTrek } from '../store.js';
import { escapeHtml } from '../model.js';
import { renderBottomTabBar } from '../ui.js';
import { runChecks } from '../checks.js';
import { checkOllama, reviewPlan, buildGearCheckTitle, normalizeText } from '../ai.js';

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

// Renders the review screen with Gemma AI plan evaluation and local Ollama status checks.
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
  let currentAbortController = null;

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

        ${renderBottomTabBar(trekId, 'review')}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const btnReview = container.querySelector('#btn-review-plan');
    const btnCancel = container.querySelector('#btn-cancel-review');
    const actionArea = container.querySelector('#review-action-area');
    const runningArea = container.querySelector('#review-running-area');
    const runningText = container.querySelector('#review-running-text');
    const statusMsg = container.querySelector('#review-status-msg');

    // Wire "Add to Gear" buttons
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
          category: 'gemma',
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

    // Wire "Add to my notes" buttons
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

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        if (currentAbortController) {
          currentAbortController.abort();
        }
      });
    }

    if (btnReview) {
      btnReview.addEventListener('click', async () => {
        statusMsg.hidden = true;
        statusMsg.className = 'review-status-msg';
        statusMsg.textContent = '';

        // 1. Pre-check Ollama reachability and installed model
        const currentSettings = getSettings();
        const check = await checkOllama(currentSettings);

        if (!check.ok) {
          statusMsg.textContent =
            "Gemma isn't reachable. Start Ollama on this laptop and try again. The Plan Check on the Dashboard still works without it.";
          statusMsg.classList.add('error');
          statusMsg.hidden = false;
          return;
        }

        if (!check.modelInstalled) {
          statusMsg.textContent = `The model "${currentSettings.model}" isn't installed. Run "ollama pull ${currentSettings.model}" in a terminal, or change the model in Settings.`;
          statusMsg.classList.add('error');
          statusMsg.hidden = false;
          return;
        }

        // 2. Transition to running state and start elapsed timer
        actionArea.hidden = true;
        runningArea.hidden = false;

        const startTime = Date.now();
        const updateElapsed = () => {
          const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
          const m = Math.floor(elapsedSec / 60);
          const s = String(elapsedSec % 60).padStart(2, '0');
          if (runningText) {
            runningText.textContent = `Gemma is reading your plan… ${m}:${s}`;
          }
        };
        updateElapsed();
        const elapsedInterval = setInterval(updateElapsed, 1000);

        currentAbortController = new AbortController();

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
            currentAbortController.signal
          );

          // 3. Save review result to trek
          latestTrek.aiReview = {
            at: '',
            model: currentSettings.model || 'gemma3:4b',
            result,
            droppedCount: typeof droppedCount === 'number' ? droppedCount : 0,
          };

          const savedTrek = saveTrek(latestTrek);
          // Set aiReview.at equal to savedTrek.updatedAt so saving the review itself does not count as a plan change
          savedTrek.aiReview.at = savedTrek.updatedAt;

          const store = loadStore();
          const trekIndex = store.treks.findIndex((t) => t.id === savedTrek.id);
          if (trekIndex >= 0) {
            store.treks[trekIndex].aiReview.at = savedTrek.updatedAt;
            saveStore(store);
          }

          // Re-render view with new results
          renderView();
        } catch (err) {
          actionArea.hidden = false;
          runningArea.hidden = true;

          if (err?.code === 'cancelled' || currentAbortController?.signal.aborted) {
            statusMsg.textContent = 'Review cancelled.';
            statusMsg.className = 'review-status-msg info';
            statusMsg.hidden = false;
          } else if (err?.code === 'timeout') {
            const timeoutSec = currentSettings.reviewTimeoutSec || 300;
            const timeoutMin = Math.round(timeoutSec / 60);
            const minUnit = timeoutMin === 1 ? '1 minute' : `${timeoutMin} minutes`;
            statusMsg.textContent = `Gemma took longer than ${minUnit} and was stopped. Laptops with little memory can be slow — try again (the second run is usually faster), close other apps, or use a smaller model in Settings.`;
            statusMsg.className = 'review-status-msg error';
            statusMsg.hidden = false;
          } else if (err?.code === 'network') {
            statusMsg.textContent =
              'Gemma stopped responding during the review. Check that Ollama is still running and try again.';
            statusMsg.className = 'review-status-msg error';
            statusMsg.hidden = false;
          } else {
            console.error('Review failed:', err);
            statusMsg.textContent =
              "Gemma isn't reachable. Start Ollama on this laptop and try again. The Plan Check on the Dashboard still works without it.";
            statusMsg.className = 'review-status-msg error';
            statusMsg.hidden = false;
          }
        } finally {
          clearInterval(elapsedInterval);
          currentAbortController = null;
        }
      });
    }
  }

  renderView();
}
