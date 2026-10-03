import { createEmptyTrek, escapeHtml } from '../model.js';
import { getTreks, saveTrek, deleteTrek } from '../store.js';
import { formatDate, renderReadinessChip, TRASH_ICON_SVG } from '../ui.js';
import { runChecks } from '../checks.js';

// Formats the display dates for a trek: trip dates if both are set, otherwise trekking dates.
function formatTrekDates(overview) {
  const tripStart = formatDate(overview?.tripStartDate);
  const tripEnd = formatDate(overview?.tripEndDate);
  if (tripStart && tripEnd) {
    return `${tripStart} – ${tripEnd}`;
  }
  const formattedStart = formatDate(overview?.startDate);
  const formattedEnd = formatDate(overview?.endDate);
  if (formattedStart && formattedEnd) {
    return `${formattedStart} – ${formattedEnd}`;
  }
  if (formattedStart) {
    return `${formattedStart} – (end date not set)`;
  }
  return 'Dates not set';
}

// Renders the Home view with trek list, inline new trek form, and settings link.
export function renderHome(container) {
  const treks = getTreks();

  const trekCardsHtml = treks.length === 0
    ? `<div class="empty-state">
         <p>No treks yet. Create your first one.</p>
       </div>`
    : `<div class="trek-list" role="list">
         ${treks
           .map((trek) => {
             const dates = formatTrekDates(trek.overview);
             const name = trek.overview.name || 'Untitled Trek';
             const checkResults = runChecks(trek);
             return `
               <div class="trek-card" role="listitem">
                 <a href="#/trek/${encodeURIComponent(trek.id)}/dashboard" class="trek-card-main">
                   <div class="trek-card-header">
                     <h2 class="trek-card-title">${escapeHtml(name)}</h2>
                     ${renderReadinessChip(checkResults.readiness)}
                   </div>
                   <p class="trek-card-dates">${escapeHtml(dates)}</p>
                 </a>
                 <div class="trek-card-actions">
                   <button
                     type="button"
                     class="btn-icon-delete btn-card-delete"
                     data-trek-id="${escapeHtml(trek.id)}"
                     data-trek-name="${escapeHtml(name)}"
                     aria-label="Delete trek &quot;${escapeHtml(name)}&quot;"
                   >
                     ${TRASH_ICON_SVG}
                   </button>
                 </div>
               </div>
             `;
           })
           .join('')}
       </div>`;

  container.innerHTML = `
    <header class="home-header">
      <h1 class="app-title">Trek Organizer</h1>
      <a href="#/settings" class="settings-link" aria-label="Settings">Settings</a>
    </header>

    <div class="home-actions">
      <button type="button" id="btn-show-new-trek" class="btn btn-add btn-block">+ New trek</button>

      <form id="form-new-trek" class="inline-form" hidden>
        <label for="trek-name-input" class="form-label">Trek name</label>
        <input
          type="text"
          id="trek-name-input"
          class="text-input"
          placeholder="e.g. Rupin Pass"
          autocomplete="off"
        />
        <div id="new-trek-error" class="form-error" role="alert" hidden></div>
        <div class="form-buttons-row">
          <button type="submit" class="btn btn-primary">Create</button>
          <button type="button" id="btn-cancel-new-trek" class="btn btn-secondary">Cancel</button>
        </div>
      </form>
    </div>

    ${trekCardsHtml}
  `;

  // Attach event handlers
  const btnShowNewTrek = container.querySelector('#btn-show-new-trek');
  const formNewTrek = container.querySelector('#form-new-trek');
  const btnCancelNewTrek = container.querySelector('#btn-cancel-new-trek');
  const inputTrekName = container.querySelector('#trek-name-input');
  const errorElement = container.querySelector('#new-trek-error');

  btnShowNewTrek.addEventListener('click', () => {
    btnShowNewTrek.hidden = true;
    formNewTrek.hidden = false;
    errorElement.hidden = true;
    errorElement.textContent = '';
    inputTrekName.value = '';
    inputTrekName.focus();
  });

  btnCancelNewTrek.addEventListener('click', () => {
    formNewTrek.hidden = true;
    btnShowNewTrek.hidden = false;
    errorElement.hidden = true;
    errorElement.textContent = '';
    inputTrekName.value = '';
  });

  formNewTrek.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = inputTrekName.value.trim();

    if (!name) {
      errorElement.textContent = 'Please enter a trek name.';
      errorElement.hidden = false;
      inputTrekName.focus();
      return;
    }

    try {
      const newTrek = createEmptyTrek(name);
      saveTrek(newTrek);
      window.location.hash = `#/trek/${newTrek.id}/plan`;
    } catch (err) {
      console.error('Failed to create and save new trek:', err);
      errorElement.textContent = 'Unable to save trek. Please try again.';
      errorElement.hidden = false;
    }
  });

  // Handle Delete trek button on cards (A4)
  container.querySelectorAll('.btn-card-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const trekId = btn.getAttribute('data-trek-id');
      const trekName = btn.getAttribute('data-trek-name') || 'Untitled Trek';
      if (
        window.confirm(
          `Delete "${trekName}"? This cannot be undone. Export a backup first if you might need it.`
        )
      ) {
        deleteTrek(trekId);
        renderHome(container);
      }
    });
  });
}

