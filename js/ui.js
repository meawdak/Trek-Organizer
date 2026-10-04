import { STATUSES, STATUS_LABELS, WATER_STATUSES, WATER_STATUS_LABELS, escapeHtml } from './model.js';

// Inline SVG for the compact trash delete icon button (Part A & B).
export const TRASH_ICON_SVG = `<svg class="icon-trash" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`;

// Formats an ISO date string (YYYY-MM-DD) to DD/MM/YYYY, returning an empty string if invalid.
export function formatDate(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return '';
  const match = isoDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${day}/${month}/${year}`;
}

// Formats an ISO date string (YYYY-MM-DD) to DD/MM (day and month only), returning an empty string if invalid.
export function formatDayMonth(isoDateStr) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return '';
  const match = isoDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, , month, day] = match;
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${day}/${month}`;
}

// Formats an ISO datetime string (YYYY-MM-DDTHH:mm or YYYY-MM-DD) to DD/MM/YYYY, HH:mm or DD/MM/YYYY · Time not set, returning an empty string if invalid.
export function formatDateTime(isoDateTimeStr) {
  if (!isoDateTimeStr || typeof isoDateTimeStr !== 'string') return '';
  const trimmed = isoDateTimeStr.trim();
  const matchDateTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (matchDateTime) {
    const [, year, month, day, hours, minutes] = matchDateTime;
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const h = parseInt(hours, 10);
    const min = parseInt(minutes, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59) return '';
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  }
  const matchDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (matchDate) {
    const [, year, month, day] = matchDate;
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return '';
    return `${day}/${month}/${year} · Time not set`;
  }
  return '';
}

// Splits an ISO date or datetime string into separate date and time parts.
export function splitIsoDateTime(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return { date: '', time: '' };
  const trimmed = isoStr.trim();
  if (trimmed.includes('T')) {
    const [datePart, timePart] = trimmed.split('T');
    return {
      date: datePart ? datePart.slice(0, 10) : '',
      time: timePart ? timePart.slice(0, 5) : '',
    };
  }
  return {
    date: trimmed.slice(0, 10),
    time: '',
  };
}

// Combines separate date and time input values into ISO datetime or date-only format.
export function combineDateAndTime(dateVal, timeVal) {
  const d = (dateVal || '').trim();
  const t = (timeVal || '').trim();
  if (!d) return '';
  if (!t) return d;
  return `${d}T${t}`;
}

// Adds a specified number of calendar days to an ISO date (YYYY-MM-DD) and returns the new ISO date string.
export function addDaysToIsoDate(isoDateStr, daysToAdd) {
  if (!isoDateStr || typeof isoDateStr !== 'string') return '';
  const parts = isoDateStr.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '';
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  d.setUTCDate(d.getUTCDate() + Number(daysToAdd));
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Renders an HTML select dropdown for statuses styled with a status chip class.
export function renderStatusSelect({ id = '', name = 'status', value = 'unknown', className = '' } = {}) {
  const safeVal = Object.values(STATUSES).includes(value) ? value : STATUSES.UNKNOWN;
  return `
    <select
      ${id ? `id="${escapeHtml(id)}"` : ''}
      name="${escapeHtml(name)}"
      class="status-select chip chip-${safeVal} ${escapeHtml(className)}"
      aria-label="Status"
    >
      <option value="${STATUSES.CONFIRMED}" ${safeVal === STATUSES.CONFIRMED ? 'selected' : ''}>${STATUS_LABELS[STATUSES.CONFIRMED]}</option>
      <option value="${STATUSES.PLANNED}" ${safeVal === STATUSES.PLANNED ? 'selected' : ''}>${STATUS_LABELS[STATUSES.PLANNED]}</option>
      <option value="${STATUSES.UNKNOWN}" ${safeVal === STATUSES.UNKNOWN ? 'selected' : ''}>${STATUS_LABELS[STATUSES.UNKNOWN]}</option>
      <option value="${STATUSES.NOT_NEEDED}" ${safeVal === STATUSES.NOT_NEEDED ? 'selected' : ''}>${STATUS_LABELS[STATUSES.NOT_NEEDED]}</option>
    </select>
  `;
}

// Renders an HTML select dropdown for water statuses styled with a water chip class.
export function renderWaterStatusSelect({ id = '', name = 'waterStatus', value = 'unknown', className = '' } = {}) {
  const safeVal = Object.values(WATER_STATUSES).includes(value) ? value : WATER_STATUSES.UNKNOWN;
  return `
    <select
      ${id ? `id="${escapeHtml(id)}"` : ''}
      name="${escapeHtml(name)}"
      class="status-select chip chip-water-${safeVal} ${escapeHtml(className)}"
      aria-label="Water Status"
    >
      <option value="${WATER_STATUSES.CONFIRMED}" ${safeVal === WATER_STATUSES.CONFIRMED ? 'selected' : ''}>Confirmed</option>
      <option value="${WATER_STATUSES.REPORTED}" ${safeVal === WATER_STATUSES.REPORTED ? 'selected' : ''}>Reported</option>
      <option value="${WATER_STATUSES.UNKNOWN}" ${safeVal === WATER_STATUSES.UNKNOWN ? 'selected' : ''}>Unknown</option>
      <option value="${WATER_STATUSES.CARRYING}" ${safeVal === WATER_STATUSES.CARRYING ? 'selected' : ''}>Carrying all</option>
    </select>
  `;
}

// Binds change event on a status or water-status select to dynamically update its chip class.
export function bindStatusSelect(selectEl) {
  if (!selectEl) return;
  selectEl.addEventListener('change', () => {
    const val = selectEl.value;
    if (selectEl.name === 'waterStatus') {
      selectEl.classList.remove('chip-water-confirmed', 'chip-water-reported', 'chip-water-unknown', 'chip-water-carrying');
      selectEl.classList.add(`chip-water-${val}`);
    } else {
      selectEl.classList.remove('chip-confirmed', 'chip-planned', 'chip-unknown', 'chip-not_needed', 'chip-not-needed');
      selectEl.classList.add(`chip-${val}`);
    }
  });
}

// Renders a read-only status chip badge.
export function renderStatusChip(status = 'unknown') {
  const safeVal = Object.values(STATUSES).includes(status) ? status : STATUSES.UNKNOWN;
  const label = STATUS_LABELS[safeVal] || 'Unknown';
  return `<span class="chip chip-${safeVal}">${escapeHtml(label)}</span>`;
}

// Renders a read-only water status chip badge with colored background and text label.
export function renderWaterStatusChip(waterStatus = 'unknown') {
  const safeVal = Object.values(WATER_STATUSES).includes(waterStatus) ? waterStatus : WATER_STATUSES.UNKNOWN;
  const label = WATER_STATUS_LABELS[safeVal] || 'Unknown';
  return `<span class="chip chip-water-${safeVal}">${escapeHtml(label)}</span>`;
}

// Renders a readiness chip badge for Ready, Ready with warnings, or Not ready.
export function renderReadinessChip(readiness = 'not_ready') {
  const safeVal = ['ready', 'ready_with_warnings', 'not_ready'].includes(readiness) ? readiness : 'not_ready';
  const labels = {
    ready: 'Ready',
    ready_with_warnings: 'Ready with warnings',
    not_ready: 'Not ready',
  };
  return `<span class="chip chip-readiness-${safeVal}">${escapeHtml(labels[safeVal])}</span>`;
}

// Renders an "Own tent" grey chip badge.
export function renderOwnTentChip() {
  return '<span class="chip chip-not_needed">Own tent</span>';
}

export const TABS = Object.freeze([
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'plan', label: 'Plan' },
  { key: 'today', label: 'Today' },
  { key: 'review', label: 'Gemma' },
]);

// Renders the bottom navigation tab bar for trek pages with four tabs: Dashboard, Plan, Today, Review.
export function renderBottomTabBar(trekId, activeTabKey) {
  return `
    <nav class="bottom-tab-bar" aria-label="Trek Navigation">
      <div class="tab-bar-container">
        ${TABS.map((tab) => {
          const isActive = tab.key === activeTabKey;
          const activeClass = isActive ? 'active' : '';
          const ariaCurrent = isActive ? ' aria-current="page"' : '';
          return `
            <a
              href="#/trek/${encodeURIComponent(trekId)}/${tab.key}"
              class="tab-item ${activeClass}"${ariaCurrent}
            >
              ${tab.label}
            </a>
          `;
        }).join('')}
      </div>
    </nav>
  `;
}

// Mounts a generic collapsible card list editor with Add, Delete, and header tap-to-toggle.
export function mountListEditor(container, options) {
  const {
    items = [],
    emptyHint = '',
    addLabel = '+ Add',
    getItemTitle = (item) => item.name || 'Untitled',
    getItemSubtitle = () => '',
    getItemChips = null,
    renderCollapsedPrefix = null,
    renderCollapsedActions = null,
    onBindCollapsed = null,
    onAfterDelete = null,
    renderItemFields = () => '',
    readItemFields = () => {},
    isItemEmpty = null,
    createDefaultItem = () => ({ id: crypto.randomUUID(), status: 'unknown' }),
    onUpdate = () => {},
  } = options;

  const expandedIds = new Set();

  function cleanupEmptyItems() {
    if (!isItemEmpty) return false;
    let removedAny = false;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!expandedIds.has(it.id) && isItemEmpty(it, i)) {
        items.splice(i, 1);
        expandedIds.delete(it.id);
        removedAny = true;
      }
    }
    if (removedAny) {
      if (onAfterDelete) {
        onAfterDelete(items);
      }
      onUpdate();
    }
    return removedAny;
  }

  // When leaving the section / hash changes, read fields of any open cards and clean up empty ones
  const cleanupOnLeave = () => {
    expandedIds.forEach((id) => {
      const cardEl = container.querySelector(`[data-id="${id}"]`);
      const item = items.find((it) => it.id === id);
      if (cardEl && item) {
        readItemFields(cardEl, item);
      }
    });
    expandedIds.clear();
    cleanupEmptyItems();
  };
  window.addEventListener('hashchange', cleanupOnLeave, { once: true });

  function render() {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'list-editor';

    // Empty state hint
    if (items.length === 0 && emptyHint) {
      const hintEl = document.createElement('div');
      hintEl.className = 'list-editor-empty-hint';
      hintEl.textContent = emptyHint;
      wrapper.appendChild(hintEl);
    }

    // List of cards
    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'list-card';
      card.dataset.id = item.id;

      const isExpanded = expandedIds.has(item.id);
      const title = getItemTitle(item, index) || 'Untitled';
      const subtitle = getItemSubtitle(item, index);
      const chipsHtml = getItemChips
        ? getItemChips(item, index)
        : (item.status ? renderStatusChip(item.status) : '');
      const actionsFn = renderCollapsedActions || renderCollapsedPrefix;
      const actionsHtml = (!isExpanded && actionsFn) ? actionsFn(item, index) : '';

      card.innerHTML = `
        <div
          class="list-card-header ${isExpanded ? 'expanded' : ''}"
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded}"
          aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${escapeHtml(title)}"
        >
          <div class="list-card-header-top">
            <span class="list-card-toggle-icon" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
            <span class="list-card-title">${escapeHtml(title)}</span>
            ${
              !isExpanded
                ? `<div class="list-card-header-actions">
                    ${actionsHtml}
                    <button
                      type="button"
                      class="btn-icon-delete btn-delete-collapsed"
                      aria-label="Delete ${escapeHtml(title)}"
                    >
                      ${TRASH_ICON_SVG}
                    </button>
                  </div>`
                : ''
            }
          </div>
          ${
            !isExpanded && (subtitle || chipsHtml)
              ? `<div class="list-card-header-bottom">
                  ${subtitle ? `<span class="list-card-subtitle">${escapeHtml(subtitle)}</span>` : ''}
                  ${chipsHtml ? `<span class="list-card-chips">${chipsHtml}</span>` : ''}
                </div>`
              : ''
          }
        </div>
        ${
          isExpanded
            ? `<div class="list-card-body">
                ${renderItemFields(item, index)}
                <div class="list-card-footer-buttons">
                  <button type="button" class="btn btn-primary btn-done" aria-label="Done editing ${escapeHtml(title)}">Done</button>
                  <button type="button" class="btn btn-danger btn-delete btn-delete-expanded" aria-label="Delete ${escapeHtml(title)}">Delete</button>
                </div>
              </div>`
            : ''
        }
      `;

      const headerEl = card.querySelector('.list-card-header');
      const btnDeleteCollapsed = card.querySelector('.btn-delete-collapsed');
      const btnDone = card.querySelector('.btn-done');
      const btnDeleteExpanded = card.querySelector('.btn-delete-expanded');

      const collapseCurrentCard = () => {
        readItemFields(card, item);
        expandedIds.delete(item.id);
        cleanupEmptyItems();
        onUpdate();
        render();
      };

      const expandCurrentCard = () => {
        expandedIds.add(item.id);
        render();
      };

      const handleDelete = () => {
        if (isExpanded) {
          readItemFields(card, item);
        }
        const isEmpty = isItemEmpty ? isItemEmpty(item, index) : false;
        if (!isEmpty) {
          if (!window.confirm(`Delete "${title}"?`)) {
            return;
          }
        }
        const idx = items.findIndex((it) => it.id === item.id);
        if (idx >= 0) {
          items.splice(idx, 1);
          expandedIds.delete(item.id);
          if (onAfterDelete) {
            onAfterDelete(items);
          }
          onUpdate();
          render();
        }
      };

      // Header click toggles between expanded and collapsed
      headerEl.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select, textarea, label, a, .list-card-header-actions, .gear-packed-wrapper, .btn-icon-delete')) {
          return;
        }
        if (isExpanded) {
          collapseCurrentCard();
        } else {
          expandCurrentCard();
        }
      });

      headerEl.addEventListener('keydown', (e) => {
        if (e.target === headerEl && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          if (isExpanded) {
            collapseCurrentCard();
          } else {
            expandCurrentCard();
          }
        }
      });

      if (btnDeleteCollapsed) {
        btnDeleteCollapsed.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDelete();
        });
      }

      if (btnDone) {
        btnDone.addEventListener('click', (e) => {
          e.stopPropagation();
          collapseCurrentCard();
        });
      }

      if (btnDeleteExpanded) {
        btnDeleteExpanded.addEventListener('click', (e) => {
          e.stopPropagation();
          handleDelete();
        });
      }

      if (!isExpanded && onBindCollapsed) {
        onBindCollapsed(card, item, render);
      }

      if (isExpanded) {
        // Bind status selects inside the card
        card.querySelectorAll('.status-select').forEach((sel) => {
          bindStatusSelect(sel);
        });

        // Listen for input and change to auto-save
        card.querySelectorAll('input, select, textarea').forEach((field) => {
          const handler = () => {
            readItemFields(card, item);
            onUpdate();
          };
          field.addEventListener('input', handler);
          field.addEventListener('change', handler);
        });
      }

      wrapper.appendChild(card);
    });

    function triggerAdd() {
      // Read fields of any currently expanded card
      expandedIds.forEach((id) => {
        const cardEl = container.querySelector(`[data-id="${id}"]`);
        const item = items.find((it) => it.id === id);
        if (cardEl && item) {
          readItemFields(cardEl, item);
        }
      });

      // Collapse all other cards
      expandedIds.clear();

      // Clean up empty cards
      cleanupEmptyItems();

      const newItem = createDefaultItem();
      items.push(newItem);
      expandedIds.add(newItem.id);
      onUpdate();
      render();

      // Focus first input of the new card
      setTimeout(() => {
        const newCard = container.querySelector(`[data-id="${newItem.id}"]`);
        if (newCard) {
          const firstInput = newCard.querySelector('input:not([readonly]):not([disabled]), select, textarea');
          if (firstInput) firstInput.focus();
        }
      }, 50);

      return newItem;
    }

    // Add button
    if (addLabel) {
      const btnAdd = document.createElement('button');
      btnAdd.type = 'button';
      btnAdd.className = 'btn btn-add btn-block btn-add-item';
      btnAdd.textContent = addLabel;
      btnAdd.addEventListener('click', triggerAdd);
      wrapper.appendChild(btnAdd);
    }

    container.appendChild(wrapper);
  }

  render();

  return {
    addItem: () => {
      // Read fields of any currently expanded card
      expandedIds.forEach((id) => {
        const cardEl = container.querySelector(`[data-id="${id}"]`);
        const item = items.find((it) => it.id === id);
        if (cardEl && item) {
          readItemFields(cardEl, item);
        }
      });

      // Collapse all other cards
      expandedIds.clear();

      // Clean up empty cards
      cleanupEmptyItems();

      const newItem = createDefaultItem();
      items.push(newItem);
      expandedIds.add(newItem.id);
      onUpdate();
      render();

      setTimeout(() => {
        const newCard = container.querySelector(`[data-id="${newItem.id}"]`);
        if (newCard) {
          const firstInput = newCard.querySelector('input:not([readonly]):not([disabled]), select, textarea');
          if (firstInput) firstInput.focus();
        }
      }, 50);

      return newItem;
    },
    render,
    expandedIds,
  };
}

// Triggers a browser file download of an object serialized as JSON.
export function downloadJsonFile(filename, data) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


