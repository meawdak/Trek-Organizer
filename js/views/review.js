import { getTrek, getSettings, loadStore, saveStore, saveTrek } from '../store.js';
import { escapeHtml } from '../model.js';
import { renderBottomTabBar } from '../ui.js';
import { runChecks } from '../checks.js';
import { checkOllama, reviewPlan } from '../ai.js';

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
      if (aiReview.result.raw) {
        resultsHtml = `
          <section class="review-group-card" aria-labelledby="heading-gemma-notes">
            <h2 id="heading-gemma-notes" class="review-group-title">Gemma's notes</h2>
            <pre class="review-raw-notes">${escapeHtml(aiReview.result.raw)}</pre>
          </section>
        `;
      } else {
        const missingItems = aiReview.result.missing || [];
        const unclearItems = aiReview.result.unclear || [];
        const considerItems = aiReview.result.consider || [];

        const isAllEmpty = missingItems.length === 0 && unclearItems.length === 0 && considerItems.length === 0;

        if (isAllEmpty) {
          resultsHtml = `
            <div class="review-empty-advisory" role="status">
              <p>Gemma didn't produce useful suggestions this time. Small models (like gemma3:1b) often struggle with this; gemma3:4b gives better results if your laptop has 8 GB of memory or more. The Plan Check on the Dashboard still covers the essentials.</p>
            </div>
          `;
        } else {
          const groups = [
            { key: 'missing', title: 'Missing', items: missingItems },
            { key: 'unclear', title: 'Unclear or contradictory', items: unclearItems },
            { key: 'consider', title: 'Worth considering', items: considerItems },
          ];

          resultsHtml = `
            <div class="review-groups-container">
              ${groups
                .map(
                  (g) => `
                  <section class="review-group-card" aria-labelledby="heading-review-${g.key}">
                    <h2 id="heading-review-${g.key}" class="review-group-title">${escapeHtml(g.title)}</h2>
                    ${
                      g.items.length > 0
                        ? `
                      <ul class="review-items-list">
                        ${g.items
                          .map(
                            (item) => `
                          <li class="review-item">
                            <span class="chip-suggestion">Suggestion — check this yourself</span>
                            <span class="review-item-text">${escapeHtml(item)}</span>
                          </li>
                        `
                          )
                          .join('')}
                      </ul>
                    `
                        : '<p class="review-empty-group">Nothing here.</p>'
                    }
                  </section>
                `
                )
                .join('')}
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
          <a href="#/" class="back-link">← Treks</a>
          <h1>${escapeHtml(trekName)}</h1>
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
            statusMsg.textContent = `Gemma took longer than ${timeoutMin} minutes and was stopped. Laptops with little memory can be slow — try again (the second run is usually faster), close other apps, or use a smaller model in Settings.`;
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
