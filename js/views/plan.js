import { getTrek, saveTrek, deleteTrek } from '../store.js';
import {
  escapeHtml,
  normalizeTrek,
  DIFFICULTIES,
  DIRECTIONS,
  DIRECTION_LABELS,
  TRAVEL_MODES,
  STAY_TYPES,
  STAY_TYPE_LABELS,
  SOURCES,
  CONTACT_ROLES,
  CONTACT_ROLE_LABELS,
  GEAR_CATEGORIES,
  normalizeGearCategory,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
} from '../model.js';
import { sharePlan } from '../share.js';
import { isSectionComplete } from '../checks.js';
import {
  formatDate,
  formatDateTime,
  splitIsoDateTime,
  combineDateAndTime,
  addDaysToIsoDate,
  renderStatusSelect,
  renderWaterStatusSelect,
  renderStatusChip,
  renderWaterStatusChip,
  renderOwnTentChip,
  renderBottomTabBar,
  mountListEditor,
  downloadJsonFile,
  TRASH_ICON_SVG,
} from '../ui.js';

/**
 * Creates and returns a collapsible section group DOM element.
 * Reuses the existing section header component with smooth 0.2s arrow rotation.
 */
function createCollapsibleSectionGroup({
  key,
  title,
  countText,
  hasWarning = false,
  warningTooltip = 'Has unresolved items or warnings',
  isOpen = false,
  addLabel = '+ Add',
  onToggle,
  onAdd,
  renderBody,
}) {
  const group = document.createElement('div');
  group.className = 'collapsible-section-group gear-section-group';
  group.dataset.sectionKey = key;

  const header = document.createElement('div');
  header.className = 'collapsible-section-header gear-section-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  header.setAttribute('aria-label', `${isOpen ? 'Collapse' : 'Expand'} ${title} section`);

  const tooltip = warningTooltip || 'Has unresolved items or warnings';

  header.innerHTML = `
    <div class="collapsible-section-header-left gear-section-header-left">
      <span class="collapsible-section-toggle-icon gear-section-toggle-icon" aria-hidden="true">▸</span>
      <span class="collapsible-section-title gear-section-title">${escapeHtml(title)}</span>
      <span class="collapsible-section-count gear-section-count">${escapeHtml(countText)}</span>
      ${hasWarning ? `<span class="collapsible-section-warning gear-section-warning" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">⚠</span>` : ''}
    </div>
    <div class="collapsible-section-header-right gear-section-header-right">
      <button type="button" class="btn btn-add btn-sm btn-collapsible-section-add btn-gear-section-add" data-key="${escapeHtml(key)}" aria-label="Add item to ${escapeHtml(title)}">${escapeHtml(addLabel)}</button>
    </div>
  `;

  header.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (onToggle) onToggle();
  });

  header.addEventListener('keydown', (e) => {
    if (e.target === header && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (onToggle) onToggle();
    }
  });

  const btnAdd = header.querySelector('.btn-collapsible-section-add');
  btnAdd.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onAdd) onAdd();
  });

  group.appendChild(header);

  if (isOpen && renderBody) {
    const body = document.createElement('div');
    body.className = 'collapsible-section-body gear-section-body';
    renderBody(body);
    group.appendChild(body);
  }

  return group;
}

export const PLAN_SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'permits', label: 'Permits' },
  { key: 'travel', label: 'Travel' },
  { key: 'stays', label: 'Stays' },
  { key: 'days', label: 'Trek days' },
  { key: 'gear', label: 'Gear' },
  { key: 'food', label: 'Food & ration' },
  { key: 'safety', label: 'Safety' },
];

// Renders Overview form fields.
function renderOverviewForm(overview) {
  return `
    <div class="form-group">
      <label for="field-name" class="form-label">Trek name</label>
      <input type="text" id="field-name" name="name" class="text-input" value="${escapeHtml(overview.name || '')}" placeholder="e.g. Rupin Pass" />
    </div>

    <div class="form-group">
      <label for="field-region" class="form-label">Region</label>
      <input type="text" id="field-region" name="region" class="text-input" value="${escapeHtml(overview.region || '')}" placeholder="e.g. Garhwal, Uttarakhand" />
    </div>

    <div class="form-group-section form-group-section-first">
      <div class="form-section-title">Trip dates</div>
      <div class="form-section-hint">The whole journey, including travel.</div>
      <div class="form-row form-row-dates">
        <div class="form-group">
          <label for="field-trip-start-date" class="form-label">Trip starts (leave home)</label>
          <input type="date" id="field-trip-start-date" name="tripStartDate" class="text-input" value="${escapeHtml(overview.tripStartDate || '')}" />
        </div>
        <div class="form-group">
          <label for="field-trip-end-date" class="form-label">Trip ends (back home)</label>
          <input type="date" id="field-trip-end-date" name="tripEndDate" class="text-input" value="${escapeHtml(overview.tripEndDate || '')}" />
        </div>
      </div>
    </div>

    <div class="form-group-section">
      <div class="form-section-title">Trekking dates</div>
      <div class="form-section-hint">Only the walking days.</div>
      <div class="form-row form-row-dates">
        <div class="form-group">
          <label for="field-start-date" class="form-label">First trekking day</label>
          <input type="date" id="field-start-date" name="startDate" class="text-input" value="${escapeHtml(overview.startDate || '')}" />
        </div>
        <div class="form-group">
          <label for="field-end-date" class="form-label">Last trekking day</label>
          <input type="date" id="field-end-date" name="endDate" class="text-input" value="${escapeHtml(overview.endDate || '')}" />
        </div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="field-group-size" class="form-label">Group size</label>
        <input type="number" id="field-group-size" name="groupSize" min="1" class="text-input" value="${overview.groupSize != null ? escapeHtml(String(overview.groupSize)) : ''}" placeholder="1" />
      </div>
      <div class="form-group">
        <label for="field-difficulty" class="form-label">Difficulty</label>
        <select id="field-difficulty" name="difficulty" class="text-input">
          <option value="${DIFFICULTIES.NOT_SURE}" ${overview.difficulty === DIFFICULTIES.NOT_SURE ? 'selected' : ''}>Not sure</option>
          <option value="${DIFFICULTIES.EASY}" ${overview.difficulty === DIFFICULTIES.EASY ? 'selected' : ''}>Easy</option>
          <option value="${DIFFICULTIES.MODERATE}" ${overview.difficulty === DIFFICULTIES.MODERATE ? 'selected' : ''}>Moderate</option>
          <option value="${DIFFICULTIES.HARD}" ${overview.difficulty === DIFFICULTIES.HARD ? 'selected' : ''}>Hard</option>
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="field-max-altitude" class="form-label">Max altitude (m)</label>
        <input type="number" id="field-max-altitude" name="maxAltitudeM" class="text-input" value="${overview.maxAltitudeM != null ? escapeHtml(String(overview.maxAltitudeM)) : ''}" placeholder="e.g. 4650" />
      </div>
      <div class="form-group">
        <label for="field-budget" class="form-label">Budget (₹)</label>
        <input type="number" id="field-budget" name="budget" class="text-input" value="${overview.budget != null ? escapeHtml(String(overview.budget)) : ''}" placeholder="e.g. 15000" />
      </div>
    </div>

    <div class="form-group">
      <label for="field-route-link" class="form-label">Route link</label>
      <input type="url" id="field-route-link" name="routeLink" class="text-input" value="${escapeHtml(overview.routeLink || '')}" placeholder="https://..." />
    </div>

    <div class="form-group">
      <label for="field-notes" class="form-label">Notes</label>
      <textarea id="field-notes" name="notes" class="text-input" rows="3" placeholder="Overview notes, trailheads, etc.">${escapeHtml(overview.notes || '')}</textarea>
    </div>

    <div class="overview-export-zone">
      <button type="button" id="btn-export-trek" class="btn btn-secondary btn-block">Export this trek</button>
    </div>

    <div class="danger-zone">
      <button type="button" id="btn-delete-trek" class="btn btn-danger btn-block">Delete trek</button>
    </div>
  `;
}

// Binds auto-save and deletion handlers for the Overview section.
function bindOverviewEvents(sectionContainer, trek, onSave) {
  const formFields = sectionContainer.querySelectorAll('input, select, textarea');
  formFields.forEach((field) => {
    const handler = () => {
      const name = field.name;
      let val = field.value;

      if (name === 'groupSize' || name === 'maxAltitudeM' || name === 'budget') {
        trek.overview[name] = val.trim() === '' ? null : Number(val);
      } else {
        trek.overview[name] = val;
      }
      onSave();
    };
    field.addEventListener('input', handler);
    field.addEventListener('change', handler);
  });

  const btnExport = sectionContainer.querySelector('#btn-export-trek');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      try {
        const normalized = normalizeTrek(trek);
        const rawName = trek.overview?.name || 'untitled-trek';
        const slug =
          rawName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'trek';
        const todayIso = new Date().toISOString().slice(0, 10);
        const filename = `trek-${slug}-${todayIso}.json`;
        const exportPayload = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          treks: [normalized],
        };
        downloadJsonFile(filename, exportPayload);
      } catch (err) {
        console.error('Failed to export single trek:', err);
      }
    });
  }

  const btnDelete = sectionContainer.querySelector('#btn-delete-trek');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      if (window.confirm('Are you sure you want to delete this trek? This cannot be undone.')) {
        deleteTrek(trek.id);
        window.location.hash = '#/';
      }
    });
  }
}

// Renders and binds the Permits list section with the no permits required checkbox.
function renderPermitsSection(container, trek, onSave) {
  if (!Array.isArray(trek.permits)) {
    trek.permits = [];
  }
  trek.noPermitsRequired = Boolean(trek.noPermitsRequired);

  // In-memory UI state: starts collapsed by default
  const openSections = new Set();
  let permitsEditor = null;

  function render() {
    container.innerHTML = `
      <div class="form-group permits-checkbox-group">
        <label class="checkbox-label" for="no-permits-required">
          <input type="checkbox" id="no-permits-required" ${trek.noPermitsRequired ? 'checked' : ''} />
          <span>No permits required (I've checked)</span>
        </label>
      </div>
      <div id="permits-groups-container" class="collapsible-sections-wrapper"></div>
    `;

    const checkbox = container.querySelector('#no-permits-required');
    checkbox.addEventListener('change', () => {
      trek.noPermitsRequired = checkbox.checked;
      onSave();
      render();
    });

    const groupsContainer = container.querySelector('#permits-groups-container');
    const count = trek.permits.length;
    const hasWarning = trek.permits.some((p) => p.status !== 'confirmed') || (!trek.noPermitsRequired && count === 0);
    const isOpen = openSections.has('permits');

    const groupEl = createCollapsibleSectionGroup({
      key: 'permits',
      title: 'Permits',
      countText: `(${count})`,
      hasWarning,
      isOpen,
      addLabel: '+ Add',
      onToggle: () => {
        if (openSections.has('permits')) {
          openSections.delete('permits');
          permitsEditor = null;
        } else {
          openSections.add('permits');
        }
        render();
      },
      onAdd: () => {
        if (!openSections.has('permits')) {
          openSections.add('permits');
          render();
        }
        if (permitsEditor) {
          permitsEditor.addItem();
        }
      },
      renderBody: (bodyEl) => {
        permitsEditor = mountListEditor(bodyEl, {
          items: trek.permits,
          emptyHint: 'No permits recorded. Has the requirement been checked?',
          addLabel: '',
          getItemTitle: (permit, idx) => (permit.name && permit.name.trim() ? permit.name.trim() : `Permit ${idx + 1} (no name entered)`),
          getItemSubtitle: (permit) => permit.authority || '',
          createDefaultItem: () => ({
            id: crypto.randomUUID(),
            name: '',
            authority: '',
            status: 'unknown',
            notes: '',
          }),
          isItemEmpty: (permit) =>
            !permit.name?.trim() &&
            !permit.authority?.trim() &&
            !permit.notes?.trim() &&
            (permit.status === 'unknown' || !permit.status),
          renderItemFields: (permit) => `
            <div class="form-group">
              <label class="form-label">Permit name</label>
              <input type="text" name="name" class="text-input" value="${escapeHtml(permit.name || '')}" placeholder="e.g. Forest Entry Permit" />
            </div>
            <div class="form-group">
              <label class="form-label">Where/who issues it</label>
              <input type="text" name="authority" class="text-input" value="${escapeHtml(permit.authority || '')}" placeholder="e.g. DFO Office or Online Portal" />
            </div>
            <div class="form-group">
              <label class="form-label">Status</label>
              ${renderStatusSelect({ name: 'status', value: permit.status })}
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea name="notes" class="text-input" rows="2" placeholder="Fee, documents needed, etc.">${escapeHtml(permit.notes || '')}</textarea>
            </div>
          `,
          readItemFields: (cardEl, permit) => {
            permit.name = cardEl.querySelector('[name="name"]')?.value || '';
            permit.authority = cardEl.querySelector('[name="authority"]')?.value || '';
            permit.status = cardEl.querySelector('[name="status"]')?.value || 'unknown';
            permit.notes = cardEl.querySelector('[name="notes"]')?.value || '';
          },
          onUpdate: () => {
            onSave();
            const countSpan = groupEl.querySelector('.collapsible-section-count');
            if (countSpan) countSpan.textContent = `(${trek.permits.length})`;
            const warnSpan = groupEl.querySelector('.collapsible-section-warning');
            const stillWarn = trek.permits.some((p) => p.status !== 'confirmed') || (!trek.noPermitsRequired && trek.permits.length === 0);
            if (warnSpan) warnSpan.hidden = !stillWarn;
          },
        });
      },
    });

    groupsContainer.appendChild(groupEl);
  }

  render();
}

// Helper to format travel mode name for card title
function formatTravelMode(mode) {
  if (!mode) return 'Travel';
  if (mode === 'shared_jeep') return 'Shared jeep';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

// Renders and binds the Travel legs list section with three collapsible groups.
function renderTravelSection(container, trek, onSave) {
  if (!Array.isArray(trek.travel)) {
    trek.travel = [];
  }

  // Separate legs into groups, mapping legacy unknown to 'to'
  const toLegs = trek.travel.filter((l) => l.direction === DIRECTIONS.TO);
  const duringLegs = trek.travel.filter((l) => l.direction === DIRECTIONS.DURING);
  const returnLegs = trek.travel.filter((l) => l.direction === DIRECTIONS.RETURN);
  trek.travel.forEach((l) => {
    if (l.direction !== DIRECTIONS.TO && l.direction !== DIRECTIONS.DURING && l.direction !== DIRECTIONS.RETURN) {
      l.direction = DIRECTIONS.TO;
      toLegs.push(l);
    }
  });

  const syncTravel = () => {
    trek.travel = [...toLegs, ...duringLegs, ...returnLegs];
    onSave();
  };

  // In-memory UI state: all groups start collapsed by default
  const openSections = new Set();
  const travelEditors = new Map();

  const groups = [
    {
      direction: DIRECTIONS.TO,
      title: 'Approach to trailhead',
      emptyHint: 'No approach travel added yet.',
      defaultMode: TRAVEL_MODES.TRAIN,
    },
    {
      direction: DIRECTIONS.DURING,
      title: 'During trek',
      emptyHint: 'No travel during the trek (optional).',
      defaultMode: TRAVEL_MODES.SHARED_JEEP,
    },
    {
      direction: DIRECTIONS.RETURN,
      title: 'Return',
      emptyHint: 'No return travel added yet.',
      defaultMode: TRAVEL_MODES.TRAIN,
    },
  ];

  function render() {
    container.innerHTML = `
      <div class="travel-groups collapsible-sections-wrapper"></div>
    `;

    const groupsWrapper = container.querySelector('.travel-groups');

    groups.forEach(({ direction, title, emptyHint, defaultMode }) => {
      const legsList = direction === DIRECTIONS.TO
        ? toLegs
        : (direction === DIRECTIONS.DURING ? duringLegs : returnLegs);

      const count = legsList.length;
      const countText = `(${count})`;
      const hasWarning = legsList.some((l) => l.status !== 'confirmed') || (direction !== DIRECTIONS.DURING && count === 0);
      const isOpen = openSections.has(direction);

      const groupEl = createCollapsibleSectionGroup({
        key: direction,
        title,
        countText,
        hasWarning,
        isOpen,
        addLabel: '+ Add',
        onToggle: () => {
          if (openSections.has(direction)) {
            openSections.delete(direction);
            travelEditors.delete(direction);
          } else {
            openSections.add(direction);
          }
          render();
        },
        onAdd: () => {
          if (!openSections.has(direction)) {
            openSections.add(direction);
            render();
          }
          const ed = travelEditors.get(direction);
          if (ed) {
            ed.addItem();
          }
        },
        renderBody: (bodyEl) => {
          const editor = mountListEditor(bodyEl, {
            items: legsList,
            emptyHint,
            addLabel: '',
            getItemTitle: (leg, idx) => {
              const fromTo = leg.from && leg.to
                ? `${leg.from} → ${leg.to}`
                : (leg.from ? `From ${leg.from}` : (leg.to ? `To ${leg.to}` : `Leg ${idx + 1} (no route entered)`));
              return `${formatTravelMode(leg.mode)}: ${fromTo}`;
            },
            getItemSubtitle: (leg) => {
              const parts = [];
              if (leg.departAt) parts.push(`Departs: ${formatDateTime(leg.departAt)}`);
              if (leg.arriveAt) parts.push(`Arrives: ${formatDateTime(leg.arriveAt)}`);
              return parts.join(' • ');
            },
            createDefaultItem: () => ({
              id: crypto.randomUUID(),
              direction,
              mode: defaultMode,
              from: '',
              to: '',
              departAt: '',
              arriveAt: '',
              bookingRef: '',
              status: 'unknown',
              notes: '',
            }),
            isItemEmpty: (leg) =>
              !leg.from?.trim() &&
              !leg.to?.trim() &&
              !leg.departAt?.trim() &&
              !leg.arriveAt?.trim() &&
              !leg.bookingRef?.trim() &&
              !leg.notes?.trim() &&
              (leg.status === 'unknown' || !leg.status),
            onAfterDelete: () => {
              syncTravel();
              const countSpan = groupEl.querySelector('.collapsible-section-count');
              if (countSpan) countSpan.textContent = `(${legsList.length})`;
              const warnSpan = groupEl.querySelector('.collapsible-section-warning');
              const stillWarn = legsList.some((l) => l.status !== 'confirmed') || (direction !== DIRECTIONS.DURING && legsList.length === 0);
              if (warnSpan) warnSpan.hidden = !stillWarn;
            },
            renderItemFields: (leg) => {
              const depart = splitIsoDateTime(leg.departAt);
              const arrive = splitIsoDateTime(leg.arriveAt);
              return `
              <div class="form-group">
                <label class="form-label">Mode</label>
                <select name="mode" class="text-input">
                  <option value="${TRAVEL_MODES.TRAIN}" ${leg.mode === TRAVEL_MODES.TRAIN ? 'selected' : ''}>Train</option>
                  <option value="${TRAVEL_MODES.BUS}" ${leg.mode === TRAVEL_MODES.BUS ? 'selected' : ''}>Bus</option>
                  <option value="${TRAVEL_MODES.SHARED_JEEP}" ${leg.mode === TRAVEL_MODES.SHARED_JEEP ? 'selected' : ''}>Shared jeep</option>
                  <option value="${TRAVEL_MODES.TAXI}" ${leg.mode === TRAVEL_MODES.TAXI ? 'selected' : ''}>Taxi</option>
                  <option value="${TRAVEL_MODES.FLIGHT}" ${leg.mode === TRAVEL_MODES.FLIGHT ? 'selected' : ''}>Flight</option>
                  <option value="${TRAVEL_MODES.OTHER}" ${leg.mode === TRAVEL_MODES.OTHER ? 'selected' : ''}>Other</option>
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">From</label>
                  <input type="text" name="from" class="text-input" value="${escapeHtml(leg.from || '')}" placeholder="Departure place" />
                </div>
                <div class="form-group">
                  <label class="form-label">To</label>
                  <input type="text" name="to" class="text-input" value="${escapeHtml(leg.to || '')}" placeholder="Arrival place" />
                </div>
              </div>

              <div class="form-row form-row-datetime">
                <div class="form-group form-group-date">
                  <label class="form-label">Departure date</label>
                  <input type="date" name="departDate" class="text-input" value="${escapeHtml(depart.date)}" />
                </div>
                <div class="form-group form-group-time">
                  <label class="form-label">Time (optional)</label>
                  <input type="time" name="departTime" class="text-input" value="${escapeHtml(depart.time)}" />
                </div>
              </div>

              <div class="form-row form-row-datetime">
                <div class="form-group form-group-date">
                  <label class="form-label">Arrival date</label>
                  <input type="date" name="arriveDate" class="text-input" value="${escapeHtml(arrive.date)}" />
                </div>
                <div class="form-group form-group-time">
                  <label class="form-label">Time (optional)</label>
                  <input type="time" name="arriveTime" class="text-input" value="${escapeHtml(arrive.time)}" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Booking ref</label>
                  <input type="text" name="bookingRef" class="text-input" value="${escapeHtml(leg.bookingRef || '')}" placeholder="PNR / Ticket #" />
                </div>
                <div class="form-group">
                  <label class="form-label">Status</label>
                  ${renderStatusSelect({ name: 'status', value: leg.status })}
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea name="notes" class="text-input" rows="2" placeholder="Coach/seat number, pickup point, etc.">${escapeHtml(leg.notes || '')}</textarea>
              </div>
            `;
            },
            readItemFields: (cardEl, leg) => {
              leg.direction = direction;
              leg.mode = cardEl.querySelector('[name="mode"]')?.value || defaultMode;
              leg.from = cardEl.querySelector('[name="from"]')?.value || '';
              leg.to = cardEl.querySelector('[name="to"]')?.value || '';

              const departDate = cardEl.querySelector('[name="departDate"]')?.value || '';
              const departTime = cardEl.querySelector('[name="departTime"]')?.value || '';
              leg.departAt = combineDateAndTime(departDate, departTime);

              const arriveDate = cardEl.querySelector('[name="arriveDate"]')?.value || '';
              const arriveTime = cardEl.querySelector('[name="arriveTime"]')?.value || '';
              leg.arriveAt = combineDateAndTime(arriveDate, arriveTime);

              leg.bookingRef = cardEl.querySelector('[name="bookingRef"]')?.value || '';
              leg.status = cardEl.querySelector('[name="status"]')?.value || 'unknown';
              leg.notes = cardEl.querySelector('[name="notes"]')?.value || '';
            },
            onUpdate: () => {
              syncTravel();
              const countSpan = groupEl.querySelector('.collapsible-section-count');
              if (countSpan) countSpan.textContent = `(${legsList.length})`;
              const warnSpan = groupEl.querySelector('.collapsible-section-warning');
              const stillWarn = legsList.some((l) => l.status !== 'confirmed') || (direction !== DIRECTIONS.DURING && legsList.length === 0);
              if (warnSpan) warnSpan.hidden = !stillWarn;
            },
          });
          travelEditors.set(direction, editor);
        },
      });

      groupsWrapper.appendChild(groupEl);
    });
  }

  render();
}

// Renders and binds the Stays list section with the no off-trail stays checkbox.
function renderStaysSection(container, trek, onSave) {
  if (!Array.isArray(trek.stays)) {
    trek.stays = [];
  }

  // In-memory UI state: starts collapsed by default
  const openSections = new Set();
  let staysEditor = null;

  function render() {
    container.innerHTML = `
      <div class="form-group stays-checkbox-group">
        <label class="checkbox-label" for="no-off-trail-stays">
          <input type="checkbox" id="no-off-trail-stays" ${trek.noOffTrailStays ? 'checked' : ''} />
          <span>No off-trail stays</span>
        </label>
      </div>
      <div id="stays-groups-container" class="collapsible-sections-wrapper"></div>
    `;

    const checkbox = container.querySelector('#no-off-trail-stays');
    checkbox.addEventListener('change', () => {
      trek.noOffTrailStays = checkbox.checked;
      onSave();
      render();
    });

    const groupsContainer = container.querySelector('#stays-groups-container');
    const count = trek.stays.length;
    const hasWarning = trek.stays.some((s) => s.status !== 'confirmed') || (!trek.noOffTrailStays && count === 0);
    const isOpen = openSections.has('stays');

    const groupEl = createCollapsibleSectionGroup({
      key: 'stays',
      title: 'Off-trail stays',
      countText: `(${count})`,
      hasWarning,
      isOpen,
      addLabel: '+ Add',
      onToggle: () => {
        if (openSections.has('stays')) {
          openSections.delete('stays');
          staysEditor = null;
        } else {
          openSections.add('stays');
        }
        render();
      },
      onAdd: () => {
        if (!openSections.has('stays')) {
          openSections.add('stays');
          render();
        }
        if (staysEditor) {
          staysEditor.addItem();
        }
      },
      renderBody: (bodyEl) => {
        staysEditor = mountListEditor(bodyEl, {
          items: trek.stays,
          emptyHint: 'No off-trail stays recorded.',
          addLabel: '',
          getItemTitle: (stay, idx) =>
            stay.name && stay.name.trim()
              ? stay.name.trim()
              : (stay.place && stay.place.trim() ? `Stay in ${stay.place.trim()}` : `Stay ${idx + 1} (no name entered)`),
          getItemSubtitle: (stay) => {
            const parts = [];
            if (stay.place) parts.push(stay.place);
            if (stay.checkIn) parts.push(`Check-in: ${formatDate(stay.checkIn)}`);
            if (stay.nights) parts.push(`${stay.nights} night${stay.nights > 1 ? 's' : ''}`);
            return parts.join(' • ');
          },
          createDefaultItem: () => ({
            id: crypto.randomUUID(),
            name: '',
            place: '',
            checkIn: '',
            nights: 1,
            status: 'unknown',
            notes: '',
          }),
          isItemEmpty: (stay) =>
            !stay.name?.trim() &&
            !stay.place?.trim() &&
            !stay.checkIn?.trim() &&
            !stay.notes?.trim() &&
            (stay.status === 'unknown' || !stay.status),
          renderItemFields: (stay) => `
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Stay name</label>
                <input type="text" name="name" class="text-input" value="${escapeHtml(stay.name || '')}" placeholder="Hotel / Homestay name" />
              </div>
              <div class="form-group">
                <label class="form-label">Place</label>
                <input type="text" name="place" class="text-input" value="${escapeHtml(stay.place || '')}" placeholder="Town / Village" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Check-in date</label>
                <input type="date" name="checkIn" class="text-input" value="${escapeHtml(stay.checkIn || '')}" />
              </div>
              <div class="form-group">
                <label class="form-label">Nights</label>
                <input type="number" name="nights" min="1" class="text-input" value="${stay.nights != null ? escapeHtml(String(stay.nights)) : '1'}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Status</label>
              ${renderStatusSelect({ name: 'status', value: stay.status })}
            </div>

            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea name="notes" class="text-input" rows="2" placeholder="Booking details, contact phone, etc.">${escapeHtml(stay.notes || '')}</textarea>
            </div>
          `,
          readItemFields: (cardEl, stay) => {
            stay.name = cardEl.querySelector('[name="name"]')?.value || '';
            stay.place = cardEl.querySelector('[name="place"]')?.value || '';
            stay.checkIn = cardEl.querySelector('[name="checkIn"]')?.value || '';
            const nightsVal = cardEl.querySelector('[name="nights"]')?.value;
            stay.nights = nightsVal ? parseInt(nightsVal, 10) : 1;
            stay.status = cardEl.querySelector('[name="status"]')?.value || 'unknown';
            stay.notes = cardEl.querySelector('[name="notes"]')?.value || '';
          },
          onUpdate: () => {
            onSave();
            const countSpan = groupEl.querySelector('.collapsible-section-count');
            if (countSpan) countSpan.textContent = `(${trek.stays.length})`;
            const warnSpan = groupEl.querySelector('.collapsible-section-warning');
            const stillWarn = trek.stays.some((s) => s.status !== 'confirmed') || (!trek.noOffTrailStays && trek.stays.length === 0);
            if (warnSpan) warnSpan.hidden = !stillWarn;
          },
        });
      },
    });

    groupsContainer.appendChild(groupEl);
  }

  render();
}

// Renders and binds the Trek days list section with auto day-numbering and prefilled date.
function renderDaysSection(container, trek, onSave) {
  if (!Array.isArray(trek.days)) {
    trek.days = [];
  }

  mountListEditor(container, {
    items: trek.days,
    emptyHint: 'No trek days recorded yet.',
    addLabel: '+ Add day',
    getItemTitle: (day) => {
      const dateStr = formatDate(day.date) || 'Date not set';
      const routeStr = day.from && day.to
        ? `${day.from} → ${day.to}`
        : (day.from ? `From ${day.from}` : (day.to ? `To ${day.to}` : 'No route entered'));
      return `Day ${day.dayNumber} · ${dateStr} · ${routeStr}`;
    },
    getItemSubtitle: (day) => {
      const parts = [];
      if (day.distanceKm != null && day.distanceKm !== '') parts.push(`${day.distanceKm} km`);
      if (day.hours != null && day.hours !== '') parts.push(`${day.hours} hrs`);
      const isOwnTent = day.stayType === STAY_TYPES.CAMPING_OWN_TENT || day.stayType === 'tent';
      if (!isOwnTent && day.stayName) parts.push(day.stayName);
      return parts.join(' • ');
    },
    getItemChips: (day) => {
      const isOwnTent = day.stayType === STAY_TYPES.CAMPING_OWN_TENT || day.stayType === 'tent';
      return `
        ${isOwnTent ? renderOwnTentChip() : renderStatusChip(day.stayStatus)}
        ${renderWaterStatusChip(day.waterStatus)}
      `;
    },
    onAfterDelete: (items) => {
      items.forEach((day, idx) => {
        day.dayNumber = idx + 1;
      });
    },
    createDefaultItem: () => {
      const dayNumber = trek.days.length + 1;
      const prefilledDate = trek.overview.startDate
        ? addDaysToIsoDate(trek.overview.startDate, dayNumber - 1)
        : '';
      return {
        id: crypto.randomUUID(),
        dayNumber,
        date: prefilledDate,
        from: '',
        to: '',
        distanceKm: null,
        hours: null,
        stayType: STAY_TYPES.CAMPING_OWN_TENT,
        stayName: '',
        stayStatus: 'unknown',
        water: '',
        waterStatus: 'unknown',
        notes: '',
      };
    },
    isItemEmpty: (day) => {
      const expectedPrefillDate = trek.overview.startDate
        ? addDaysToIsoDate(trek.overview.startDate, day.dayNumber - 1)
        : '';
      const isDatePrefilledOrEmpty = !day.date || day.date === expectedPrefillDate;
      const isStayTypeDefault = day.stayType === STAY_TYPES.CAMPING_OWN_TENT || day.stayType === 'tent' || !day.stayType;
      const isStatusDefault = (day.stayStatus === 'unknown' || !day.stayStatus) && (day.waterStatus === 'unknown' || !day.waterStatus);
      const areUserFieldsEmpty =
        !day.from?.trim() &&
        !day.to?.trim() &&
        (day.distanceKm === null || day.distanceKm === '' || isNaN(day.distanceKm)) &&
        (day.hours === null || day.hours === '' || isNaN(day.hours)) &&
        !day.stayName?.trim() &&
        !day.water?.trim() &&
        !day.notes?.trim();
      return isDatePrefilledOrEmpty && isStayTypeDefault && isStatusDefault && areUserFieldsEmpty;
    },
    renderItemFields: (day) => {
      const effectiveStayType = (day.stayType === 'tent' || !day.stayType) ? STAY_TYPES.CAMPING_OWN_TENT : day.stayType;
      const isCamping = effectiveStayType === STAY_TYPES.CAMPING_OWN_TENT;
      return `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Day number</label>
            <input type="number" name="dayNumber" class="text-input" value="${day.dayNumber}" readonly disabled />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" name="date" class="text-input" value="${escapeHtml(day.date || '')}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">From</label>
            <input type="text" name="from" class="text-input" value="${escapeHtml(day.from || '')}" placeholder="Start point / Camp" />
          </div>
          <div class="form-group">
            <label class="form-label">To</label>
            <input type="text" name="to" class="text-input" value="${escapeHtml(day.to || '')}" placeholder="Destination / Camp" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Distance (km)</label>
            <input type="number" step="any" min="0" name="distanceKm" class="text-input" value="${day.distanceKm != null ? escapeHtml(String(day.distanceKm)) : ''}" placeholder="e.g. 10" />
          </div>
          <div class="form-group">
            <label class="form-label">Expected hours</label>
            <input type="number" step="any" min="0" name="hours" class="text-input" value="${day.hours != null ? escapeHtml(String(day.hours)) : ''}" placeholder="e.g. 6" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Stay type</label>
            <select name="stayType" class="text-input stay-type-select">
              <option value="${STAY_TYPES.CAMPING_OWN_TENT}" ${effectiveStayType === STAY_TYPES.CAMPING_OWN_TENT ? 'selected' : ''}>Camping (own tent)</option>
              <option value="${STAY_TYPES.CAMPING_BOOKED}" ${effectiveStayType === STAY_TYPES.CAMPING_BOOKED ? 'selected' : ''}>Camping (booked/rented tent)</option>
              <option value="${STAY_TYPES.HOMESTAY}" ${effectiveStayType === STAY_TYPES.HOMESTAY ? 'selected' : ''}>Homestay</option>
              <option value="${STAY_TYPES.HUT}" ${effectiveStayType === STAY_TYPES.HUT ? 'selected' : ''}>Hut</option>
              <option value="${STAY_TYPES.LODGE}" ${effectiveStayType === STAY_TYPES.LODGE ? 'selected' : ''}>Lodge</option>
              <option value="${STAY_TYPES.BOOKED_CAMP}" ${effectiveStayType === STAY_TYPES.BOOKED_CAMP ? 'selected' : ''}>Booked camp</option>
              <option value="${STAY_TYPES.OTHER}" ${effectiveStayType === STAY_TYPES.OTHER ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group stay-name-group" style="${isCamping ? 'display: none;' : ''}">
            <label class="form-label">Stay name</label>
            <input type="text" name="stayName" class="text-input" value="${escapeHtml(day.stayName || '')}" placeholder="Camp / Lodge name" />
          </div>
        </div>

        <div class="form-group stay-status-group" style="${isCamping ? 'display: none;' : ''}">
          <label class="form-label">Stay status</label>
          ${renderStatusSelect({ name: 'stayStatus', value: day.stayStatus })}
        </div>

        <div class="stay-hint" style="${isCamping ? '' : 'display: none;'} margin-top: -6px; margin-bottom: 12px; font-size: 0.875rem; color: var(--text-secondary);">
          Campsite = this day's 'To' location.
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Water notes</label>
            <input type="text" name="water" class="text-input" value="${escapeHtml(day.water || '')}" placeholder="Streams, glacial springs, etc." />
          </div>
          <div class="form-group">
            <label class="form-label">Water status</label>
            ${renderWaterStatusSelect({ name: 'waterStatus', value: day.waterStatus })}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea name="notes" class="text-input" rows="2" placeholder="Trail terrain, altitude gain, warnings...">${escapeHtml(day.notes || '')}</textarea>
        </div>
      `;
    },
    readItemFields: (cardEl, day) => {
      day.date = cardEl.querySelector('[name="date"]')?.value || '';
      day.from = cardEl.querySelector('[name="from"]')?.value || '';
      day.to = cardEl.querySelector('[name="to"]')?.value || '';
      const dist = cardEl.querySelector('[name="distanceKm"]')?.value;
      day.distanceKm = dist && dist.trim() !== '' ? Number(dist) : null;
      const hrs = cardEl.querySelector('[name="hours"]')?.value;
      day.hours = hrs && hrs.trim() !== '' ? Number(hrs) : null;

      const stayTypeSel = cardEl.querySelector('[name="stayType"]');
      day.stayType = stayTypeSel?.value || STAY_TYPES.CAMPING_OWN_TENT;
      day.stayName = cardEl.querySelector('[name="stayName"]')?.value || '';
      day.stayStatus = cardEl.querySelector('[name="stayStatus"]')?.value || 'unknown';
      day.water = cardEl.querySelector('[name="water"]')?.value || '';
      day.waterStatus = cardEl.querySelector('[name="waterStatus"]')?.value || 'unknown';
      day.notes = cardEl.querySelector('[name="notes"]')?.value || '';

      const isCamping = day.stayType === STAY_TYPES.CAMPING_OWN_TENT || day.stayType === 'tent';
      const stayNameGrp = cardEl.querySelector('.stay-name-group');
      const stayStatusGrp = cardEl.querySelector('.stay-status-group');
      const stayHint = cardEl.querySelector('.stay-hint');
      if (stayNameGrp && stayStatusGrp && stayHint) {
        stayNameGrp.style.display = isCamping ? 'none' : '';
        stayStatusGrp.style.display = isCamping ? 'none' : '';
        stayHint.style.display = isCamping ? '' : 'none';
      }
    },
    onUpdate: onSave,
  });
}

export const COMMON_FIRST_AID_SUPPLIES = Object.freeze([
  'Adhesive bandages',
  'Sterile gauze pads',
  'Crepe bandage',
  'Medical tape',
  'Blister plasters',
  'Antiseptic wipes',
  'Small scissors',
  'Tweezers',
  'Disposable gloves',
  'ORS sachets',
]);

// Renders and binds the Gear list section with grouped category headings, counters, and collapse/expand toggles.
function renderGearSection(container, trek, onSave) {
  if (!Array.isArray(trek.gear)) {
    trek.gear = [];
  }

  // Ensure all existing items have a normalized category key
  trek.gear.forEach((g) => {
    g.category = normalizeGearCategory(g.category, g.item);
  });

  // In-memory UI state: all sections start collapsed by default
  const openSections = new Set();
  const expandedCardIds = new Set();   // tracks gear item ids currently in edit mode
  let isAddingTopItem = false;
  let suppliesNote = { text: '', hidden: true };

  const isGearItemEmpty = (g) =>
    !g.item?.trim() &&
    (g.source === SOURCES.HAVE || !g.source) &&
    !g.packed;

  const readCardFields = (cardEl, item) => {
    if (!cardEl || !item) return;
    item.item = cardEl.querySelector('[name="item"]')?.value || '';
    item.category = normalizeGearCategory(cardEl.querySelector('[name="category"]')?.value || item.category, item.item);
    item.source = cardEl.querySelector('[name="source"]')?.value || SOURCES.HAVE;
    item.packed = Boolean(cardEl.querySelector('[name="packed"]')?.checked);
  };

  const readAllExpandedCards = () => {
    expandedCardIds.forEach((id) => {
      const cardEl = container.querySelector(`[data-id="${id}"]`);
      const item = trek.gear.find((g) => g.id === id);
      if (cardEl && item) {
        readCardFields(cardEl, item);
      }
    });
  };

  const cleanupEmptyItems = () => {
    for (let i = trek.gear.length - 1; i >= 0; i--) {
      if (!expandedCardIds.has(trek.gear[i].id) && isGearItemEmpty(trek.gear[i])) {
        trek.gear.splice(i, 1);
      }
    }
  };

  const cleanupOnLeave = () => {
    readAllExpandedCards();
    cleanupEmptyItems();
    onSave();
  };
  window.addEventListener('hashchange', cleanupOnLeave, { once: true });

  const addCommonSupplies = () => {
    readAllExpandedCards();
    cleanupEmptyItems();
    isAddingTopItem = false;
    const existingNames = new Set(trek.gear.map((g) => (g.item || '').trim().toLowerCase()));
    let addedCount = 0;
    for (const supply of COMMON_FIRST_AID_SUPPLIES) {
      if (!existingNames.has(supply.toLowerCase())) {
        trek.gear.push({
          id: crypto.randomUUID(),
          item: supply,
          category: 'first_aid',
          source: SOURCES.HAVE,
          packed: false,
        });
        existingNames.add(supply.toLowerCase());
        addedCount++;
      }
    }

    if (addedCount > 0) {
      suppliesNote = {
        text: `Added ${addedCount} first-aid items to Gear. Edit or remove any you don't need.`,
        hidden: false,
      };
    } else {
      suppliesNote = {
        text: 'All common first-aid items are already in Gear.',
        hidden: false,
      };
    }

    openSections.add('first_aid'); // ensure first_aid section is expanded
    onSave();
    render();
  };

  function render() {
    container.innerHTML = '';

    // Overall counter at top
    const totalCount = trek.gear.length;
    const packedCount = trek.gear.filter((g) => g.packed).length;

    const counterBox = document.createElement('div');
    counterBox.id = 'gear-counter-box';
    counterBox.className = 'gear-counter-container';
    counterBox.textContent = `${packedCount} of ${totalCount} packed`;
    container.appendChild(counterBox);

    const isFirstAidEmpty = !trek.gear.some((g) => normalizeGearCategory(g.category, g.item) === 'first_aid');

    // Top actions area: "+ Add item" button or form
    const topActionsArea = document.createElement('div');
    topActionsArea.className = 'gear-top-actions-area';

    if (isAddingTopItem) {
      const topAddCard = document.createElement('div');
      topAddCard.className = 'list-card gear-top-add-card';

      const catOptionsHtml = Object.entries(GEAR_CATEGORIES)
        .map(([k, label]) => `<option value="${k}" ${k === 'other' ? 'selected' : ''}>${escapeHtml(label)}</option>`)
        .join('');

      topAddCard.innerHTML = `
        <div class="list-card-body">
          <div class="form-group">
            <label class="form-label" for="gear-top-item-input">Item</label>
            <input type="text" id="gear-top-item-input" name="item" class="text-input" placeholder="e.g. Sleeping bag" autofocus />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="gear-top-category-select">Category</label>
              <select id="gear-top-category-select" name="category" class="text-input" required>
                ${catOptionsHtml}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="gear-top-source-select">Source</label>
              <select id="gear-top-source-select" name="source" class="text-input">
                <option value="${SOURCES.HAVE}" selected>Have</option>
                <option value="${SOURCES.BORROW}">Borrow</option>
                <option value="${SOURCES.BUY}">Buy</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label" for="gear-top-packed-cb">
              <input type="checkbox" id="gear-top-packed-cb" name="packed" />
              <span>Packed</span>
            </label>
          </div>

          <div class="list-card-footer-buttons">
            <button type="button" class="btn btn-secondary btn-cancel-top-add">Cancel</button>
            <button type="button" class="btn btn-primary btn-done-top-add">Done</button>
          </div>
        </div>
      `;

      const itemInput = topAddCard.querySelector('#gear-top-item-input');
      const catSelect = topAddCard.querySelector('#gear-top-category-select');
      const srcSelect = topAddCard.querySelector('#gear-top-source-select');
      const packedCb = topAddCard.querySelector('#gear-top-packed-cb');
      const btnCancel = topAddCard.querySelector('.btn-cancel-top-add');
      const btnDone = topAddCard.querySelector('.btn-done-top-add');

      const saveTopItem = () => {
        const name = (itemInput?.value || '').trim();
        if (!name) {
          isAddingTopItem = false;
          render();
          return;
        }

        const chosenCat = normalizeGearCategory(catSelect?.value || 'other', name);
        const newItem = {
          id: crypto.randomUUID(),
          item: name,
          category: chosenCat,
          source: srcSelect?.value || SOURCES.HAVE,
          packed: Boolean(packedCb?.checked),
        };
        trek.gear.push(newItem);
        openSections.add(chosenCat);
        isAddingTopItem = false;
        onSave();
        render();
      };

      btnCancel.addEventListener('click', (e) => {
        e.stopPropagation();
        isAddingTopItem = false;
        render();
      });

      btnDone.addEventListener('click', (e) => {
        e.stopPropagation();
        saveTopItem();
      });

      itemInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveTopItem();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          isAddingTopItem = false;
          render();
        }
      });

      topActionsArea.appendChild(topAddCard);

      setTimeout(() => {
        itemInput?.focus();
      }, 50);
    } else {
      const btnAddTop = document.createElement('button');
      btnAddTop.type = 'button';
      btnAddTop.id = 'btn-gear-add-top';
      btnAddTop.className = 'btn btn-add btn-block btn-gear-add-top';
      btnAddTop.textContent = '+ Add item';
      btnAddTop.addEventListener('click', () => {
        readAllExpandedCards();
        cleanupEmptyItems();
        expandedCardIds.clear();
        isAddingTopItem = true;
        render();
      });
      topActionsArea.appendChild(btnAddTop);

      // If First aid is empty, show small button below "+ Add item"
      if (isFirstAidEmpty) {
        const helperWrap = document.createElement('div');
        helperWrap.className = 'gear-first-aid-top-wrap';
        helperWrap.innerHTML = `
          <button type="button" id="btn-add-first-aid-top" class="btn btn-secondary btn-first-aid-top">Add common first-aid supplies</button>
          <div id="gear-supplies-note" class="gear-supplies-note" role="status" aria-live="polite" ${suppliesNote.hidden ? 'hidden' : ''}>${escapeHtml(suppliesNote.text)}</div>
        `;
        helperWrap.querySelector('#btn-add-first-aid-top').addEventListener('click', () => {
          addCommonSupplies();
        });
        topActionsArea.appendChild(helperWrap);
      }
    }

    container.appendChild(topActionsArea);

    // Group items by category in GEAR_CATEGORIES order
    const categoryKeys = Object.keys(GEAR_CATEGORIES);
    const visibleSections = [];

    categoryKeys.forEach((catKey) => {
      const items = trek.gear.filter((g) => normalizeGearCategory(g.category, g.item) === catKey);
      if (items.length > 0) {
        visibleSections.push({ catKey, items });
      }
    });

    const sectionsWrapper = document.createElement('div');
    sectionsWrapper.className = 'gear-sections-wrapper collapsible-sections-wrapper';

    // If no sections have items at all, show empty hint
    if (visibleSections.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'list-editor-empty-hint';
      emptyHint.textContent = 'No gear added yet.';
      sectionsWrapper.appendChild(emptyHint);
    }

    // Render each category section
    visibleSections.forEach(({ catKey, items }) => {
      const catLabel = GEAR_CATEGORIES[catKey];
      const secPacked = items.filter((g) => g.packed).length;
      const secTotal = items.length;
      const isOpen = openSections.has(catKey);
      const countText = secTotal > 0 ? `(${secPacked}/${secTotal})` : '(0)';
      const hasWarning = items.some((g) => g.source === SOURCES.BORROW || g.source === SOURCES.BUY || !g.packed);

      const sectionGroup = createCollapsibleSectionGroup({
        key: catKey,
        title: catLabel,
        countText,
        hasWarning,
        isOpen,
        addLabel: '+ Add',
        onToggle: () => {
          if (openSections.has(catKey)) {
            openSections.delete(catKey);
          } else {
            openSections.add(catKey);
          }
          render();
        },
        onAdd: () => {
          readAllExpandedCards();
          cleanupEmptyItems();
          expandedCardIds.clear();
          isAddingTopItem = false;

          const newItem = {
            id: crypto.randomUUID(),
            item: '',
            category: catKey,
            source: SOURCES.HAVE,
            packed: false,
          };
          trek.gear.push(newItem);
          expandedCardIds.add(newItem.id);
          openSections.add(catKey);
          onSave();
          render();

          setTimeout(() => {
            const cardEl = container.querySelector(`[data-id="${newItem.id}"]`);
            cardEl?.querySelector('input[name="item"]')?.focus();
          }, 50);
        },
        renderBody: (bodyEl) => {
          // "Add common first-aid supplies" button inside First aid section when expanded
          if (catKey === 'first_aid') {
            const helperWrap = document.createElement('div');
            helperWrap.className = 'gear-supplies-helper';
            helperWrap.innerHTML = `
              <button type="button" id="btn-add-first-aid-supplies" class="btn btn-add btn-block btn-add-first-aid-supplies">Add common first-aid supplies</button>
              <div id="gear-supplies-note" class="gear-supplies-note" role="status" aria-live="polite" ${suppliesNote.hidden ? 'hidden' : ''}>${escapeHtml(suppliesNote.text)}</div>
            `;
            helperWrap.querySelector('#btn-add-first-aid-supplies').addEventListener('click', (e) => {
              e.stopPropagation();
              addCommonSupplies();
            });
            bodyEl.appendChild(helperWrap);
          }

          // Cards list
          const cardsWrap = document.createElement('div');
          cardsWrap.className = 'gear-cards-list';

          items.forEach((item, index) => {
          const isCardExpanded = expandedCardIds.has(item.id);
          const title = item.item?.trim() || `Gear item ${index + 1} (no item name)`;
          const subtitle = item.source ? `Source: ${item.source}` : '';

          const card = document.createElement('div');
          card.className = `list-card ${item.packed ? 'card-packed' : ''}`;
          card.dataset.id = item.id;

          if (!isCardExpanded) {
            // Collapsed Card
            card.innerHTML = `
              <div
                class="list-card-header"
                role="button"
                tabindex="0"
                aria-expanded="false"
                aria-label="Expand ${escapeHtml(title)}"
              >
                <div class="list-card-header-top">
                  <span class="list-card-toggle-icon" aria-hidden="true">▸</span>
                  <span class="list-card-title">${escapeHtml(title)}</span>
                  <div class="list-card-header-actions">
                    <div class="gear-packed-wrapper">
                      <label class="gear-packed-label" title="Toggle packed">
                        <input type="checkbox" class="gear-packed-cb" ${item.packed ? 'checked' : ''} aria-label="Mark packed" />
                        <span>Packed</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      class="btn-icon-delete btn-delete-collapsed"
                      aria-label="Delete ${escapeHtml(title)}"
                    >
                      ${TRASH_ICON_SVG}
                    </button>
                  </div>
                </div>
                ${subtitle ? `
                  <div class="list-card-header-bottom">
                    <span class="list-card-subtitle">${escapeHtml(subtitle)}</span>
                  </div>
                ` : ''}
              </div>
            `;

            const cardHeader = card.querySelector('.list-card-header');
            const packedCb = card.querySelector('.gear-packed-cb');
            const btnDelete = card.querySelector('.btn-delete-collapsed');

            cardHeader.addEventListener('click', (e) => {
              if (e.target.closest('button, input, select, textarea, label, a, .list-card-header-actions, .gear-packed-wrapper, .btn-icon-delete')) {
                return;
              }
              readAllExpandedCards();
              expandedCardIds.add(item.id);
              render();
            });

            cardHeader.addEventListener('keydown', (e) => {
              if (e.target === cardHeader && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                readAllExpandedCards();
                expandedCardIds.add(item.id);
                render();
              }
            });

            if (packedCb) {
              packedCb.addEventListener('click', (e) => e.stopPropagation());
              packedCb.addEventListener('change', (e) => {
                e.stopPropagation();
                item.packed = packedCb.checked;
                card.classList.toggle('card-packed', item.packed);
                onSave();
                render();
              });
            }

            if (btnDelete) {
              btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isGearItemEmpty(item)) {
                  if (!window.confirm(`Delete "${title}"?`)) return;
                }
                const idx = trek.gear.findIndex((g) => g.id === item.id);
                if (idx >= 0) {
                  trek.gear.splice(idx, 1);
                  expandedCardIds.delete(item.id);
                  onSave();
                  render();
                }
              });
            }
          } else {
            // Expanded Card
            const catOptionsHtml = Object.entries(GEAR_CATEGORIES)
              .map(([k, label]) => `<option value="${k}" ${normalizeGearCategory(item.category, item.item) === k ? 'selected' : ''}>${escapeHtml(label)}</option>`)
              .join('');

            card.innerHTML = `
              <div
                class="list-card-header expanded"
                role="button"
                tabindex="0"
                aria-expanded="true"
                aria-label="Collapse ${escapeHtml(title)}"
              >
                <div class="list-card-header-top">
                  <span class="list-card-toggle-icon" aria-hidden="true">▾</span>
                  <span class="list-card-title">${escapeHtml(title)}</span>
                </div>
              </div>
              <div class="list-card-body">
                <div class="form-group">
                  <label class="form-label">Item</label>
                  <input type="text" name="item" class="text-input" value="${escapeHtml(item.item || '')}" placeholder="e.g. Sleeping bag" />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Category</label>
                    <select name="category" class="text-input">
                      ${catOptionsHtml}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Source</label>
                    <select name="source" class="text-input">
                      <option value="${SOURCES.HAVE}" ${item.source === SOURCES.HAVE ? 'selected' : ''}>Have</option>
                      <option value="${SOURCES.BORROW}" ${item.source === SOURCES.BORROW ? 'selected' : ''}>Borrow</option>
                      <option value="${SOURCES.BUY}" ${item.source === SOURCES.BUY ? 'selected' : ''}>Buy</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="checkbox-label" for="gear-field-packed-${escapeHtml(item.id)}">
                    <input type="checkbox" id="gear-field-packed-${escapeHtml(item.id)}" name="packed" ${item.packed ? 'checked' : ''} />
                    <span>Packed</span>
                  </label>
                </div>

                <div class="list-card-footer-buttons">
                  <button type="button" class="btn btn-primary btn-done" aria-label="Done editing ${escapeHtml(title)}">Done</button>
                  <button type="button" class="btn btn-danger btn-delete btn-delete-expanded" aria-label="Delete ${escapeHtml(title)}">Delete</button>
                </div>
              </div>
            `;

            const cardHeader = card.querySelector('.list-card-header');
            const categorySelect = card.querySelector('[name="category"]');
            const itemInput = card.querySelector('[name="item"]');
            const sourceSelect = card.querySelector('[name="source"]');
            const packedInput = card.querySelector('[name="packed"]');
            const btnDone = card.querySelector('.btn-done');
            const btnDeleteExp = card.querySelector('.btn-delete-expanded');

            const collapseThisCard = () => {
              readCardFields(card, item);
              expandedCardIds.delete(item.id);
              cleanupEmptyItems();
              onSave();
              render();
            };

            cardHeader.addEventListener('click', collapseThisCard);
            cardHeader.addEventListener('keydown', (e) => {
              if (e.target === cardHeader && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                collapseThisCard();
              }
            });

            // Live updates for item, source, packed
            [itemInput, sourceSelect, packedInput].forEach((el) => {
              if (!el) return;
              const syncHandler = () => {
                readCardFields(card, item);
                onSave();
                // update top counter live if packed changes
                const curTotal = trek.gear.length;
                const curPacked = trek.gear.filter((g) => g.packed).length;
                counterBox.textContent = `${curPacked} of ${curTotal} packed`;
              };
              el.addEventListener('input', syncHandler);
              el.addEventListener('change', syncHandler);
            });

            // Category select change: moves the item to the new section!
            categorySelect.addEventListener('change', () => {
              readCardFields(card, item);
              const newCategory = normalizeGearCategory(categorySelect.value, item.item);
              item.category = newCategory;
              openSections.add(newCategory); // ensure target section is open
              onSave();
              render();

              setTimeout(() => {
                const movedCard = container.querySelector(`[data-id="${item.id}"]`);
                movedCard?.querySelector('[name="category"]')?.focus();
              }, 50);
            });

            btnDone.addEventListener('click', (e) => {
              e.stopPropagation();
              collapseThisCard();
            });

            btnDeleteExp.addEventListener('click', (e) => {
              e.stopPropagation();
              if (!isGearItemEmpty(item)) {
                if (!window.confirm(`Delete "${title}"?`)) return;
              }
              const idx = trek.gear.findIndex((g) => g.id === item.id);
              if (idx >= 0) {
                trek.gear.splice(idx, 1);
                expandedCardIds.delete(item.id);
                onSave();
                render();
              }
            });
          }

          cardsWrap.appendChild(card);
        });

        bodyEl.appendChild(cardsWrap);
      },
    });

    sectionsWrapper.appendChild(sectionGroup);
  });

  container.appendChild(sectionsWrapper);
}

  render();
}

const FOOD_GROUPS = [
  { key: 'breakfast', label: 'Breakfast', defaultMeal: 'Breakfast' },
  { key: 'lunch', label: 'Lunch', defaultMeal: 'Lunch' },
  { key: 'dinner', label: 'Dinner', defaultMeal: 'Dinner' },
  { key: 'snacks_other', label: 'Snacks & other', defaultMeal: 'Snack' },
];

function getFoodGroupKey(f) {
  const m = (f?.meal || '').toLowerCase().trim();
  if (m.includes('break')) return 'breakfast';
  if (m.includes('lunch')) return 'lunch';
  if (m.includes('dinner')) return 'dinner';
  return 'snacks_other';
}

// Renders and binds the Food & ration section including items list and resupply points textarea.
function renderFoodSection(container, trek, onSave) {
  if (!trek.food || typeof trek.food !== 'object') {
    trek.food = { items: [], resupply: '' };
  }
  if (!Array.isArray(trek.food.items)) {
    trek.food.items = [];
  }

  // Treat older items lacking packed as false
  trek.food.items.forEach((f) => {
    if (f.packed === undefined) {
      f.packed = false;
    }
  });

  // In-memory UI state: starts collapsed by default
  const openSections = new Set();
  const foodEditors = new Map();

  function render() {
    container.innerHTML = `
      <div id="food-counter-box" class="gear-counter-container"></div>
      <div id="food-groups-container" class="food-sections-wrapper collapsible-sections-wrapper"></div>
      <div class="form-group" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
        <label for="food-resupply" class="form-label">Resupply points</label>
        <textarea id="food-resupply" class="text-input" rows="3" placeholder="Towns, villages, or shops along the route to buy rations...">${escapeHtml(trek.food.resupply || '')}</textarea>
      </div>
    `;

    const counterBox = container.querySelector('#food-counter-box');
    const updateCounter = () => {
      const total = trek.food.items.length;
      const packed = trek.food.items.filter((f) => f.packed).length;
      counterBox.textContent = `${packed} of ${total} packed`;
    };
    updateCounter();

    const resupplyEl = container.querySelector('#food-resupply');
    const resupplyHandler = () => {
      trek.food.resupply = resupplyEl.value;
      onSave();
    };
    resupplyEl.addEventListener('input', resupplyHandler);
    resupplyEl.addEventListener('change', resupplyHandler);

    const groupsContainer = container.querySelector('#food-groups-container');

    FOOD_GROUPS.forEach((group) => {
      const groupItems = trek.food.items.filter((f) => getFoodGroupKey(f) === group.key);
      const secPacked = groupItems.filter((f) => f.packed).length;
      const secTotal = groupItems.length;
      const countText = secTotal > 0 ? `(${secPacked}/${secTotal})` : '(0)';
      const hasWarning = groupItems.some((f) => !f.packed);
      const isOpen = openSections.has(group.key);

      const groupEl = createCollapsibleSectionGroup({
        key: group.key,
        title: group.label,
        countText,
        hasWarning,
        isOpen,
        addLabel: '+ Add',
        onToggle: () => {
          if (openSections.has(group.key)) {
            openSections.delete(group.key);
            foodEditors.delete(group.key);
          } else {
            openSections.add(group.key);
          }
          render();
        },
        onAdd: () => {
          if (!openSections.has(group.key)) {
            openSections.add(group.key);
            render();
          }
          const ed = foodEditors.get(group.key);
          if (ed) {
            ed.addItem();
          }
        },
        renderBody: (bodyEl) => {
          const editor = mountListEditor(bodyEl, {
            items: groupItems,
            emptyHint: `No ${group.label.toLowerCase()} items recorded yet.`,
            addLabel: '',
            getItemTitle: (f, idx) => {
              const dayPrefix = f.day && f.day.trim() ? `${f.day.trim()}: ` : '';
              const mealSuffix = f.meal && f.meal.trim() ? ` (${f.meal.trim()})` : '';
              return (f.item && f.item.trim())
                ? `${dayPrefix}${f.item.trim()}${mealSuffix}`
                : `Food item ${idx + 1} (no item name)`;
            },
            getItemSubtitle: (f) => (f.quantity ? `Qty: ${f.quantity}` : ''),
            renderCollapsedActions: (f) => `
              <div class="gear-packed-wrapper">
                <label class="gear-packed-label" title="Toggle packed">
                  <input type="checkbox" class="food-packed-cb" ${f.packed ? 'checked' : ''} aria-label="Mark packed" />
                  <span>Packed</span>
                </label>
              </div>
            `,
            onBindCollapsed: (cardEl, f) => {
              cardEl.classList.toggle('card-packed', Boolean(f.packed));
              const cb = cardEl.querySelector('.food-packed-cb');
              if (cb) {
                cb.addEventListener('click', (e) => e.stopPropagation());
                cb.addEventListener('change', (e) => {
                  e.stopPropagation();
                  f.packed = cb.checked;
                  delete f.status;
                  cardEl.classList.toggle('card-packed', f.packed);
                  updateCounter();
                  onSave();
                  // Update group count and warning
                  const curPacked = groupItems.filter((it) => it.packed).length;
                  const curTotal = groupItems.length;
                  const countSpan = groupEl.querySelector('.collapsible-section-count');
                  if (countSpan) countSpan.textContent = curTotal > 0 ? `(${curPacked}/${curTotal})` : '(0)';
                  const warnSpan = groupEl.querySelector('.collapsible-section-warning');
                  const stillWarn = groupItems.some((it) => !it.packed);
                  if (warnSpan) warnSpan.hidden = !stillWarn;
                });
              }
            },
            createDefaultItem: () => {
              const newItem = {
                id: crypto.randomUUID(),
                day: '',
                meal: group.defaultMeal,
                item: '',
                quantity: '',
                packed: false,
              };
              trek.food.items.push(newItem);
              return newItem;
            },
            isItemEmpty: (f) =>
              !f.day?.trim() &&
              !f.meal?.trim() &&
              !f.item?.trim() &&
              !f.quantity?.trim() &&
              !f.packed,
            onAfterDelete: () => {
              const groupItemIds = new Set(groupItems.map((f) => f.id));
              trek.food.items = trek.food.items.filter((f) => {
                if (getFoodGroupKey(f) === group.key) {
                  return groupItemIds.has(f.id);
                }
                return true;
              });
              updateCounter();
              onSave();
              const curPacked = groupItems.filter((it) => it.packed).length;
              const curTotal = groupItems.length;
              const countSpan = groupEl.querySelector('.collapsible-section-count');
              if (countSpan) countSpan.textContent = curTotal > 0 ? `(${curPacked}/${curTotal})` : '(0)';
              const warnSpan = groupEl.querySelector('.collapsible-section-warning');
              const stillWarn = groupItems.some((it) => !it.packed);
              if (warnSpan) warnSpan.hidden = !stillWarn;
            },
            renderItemFields: (f) => `
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Day</label>
                  <input type="text" name="day" class="text-input" value="${escapeHtml(f.day || '')}" placeholder="e.g. Day 1, or All days" />
                </div>
                <div class="form-group">
                  <label class="form-label">Meal</label>
                  <input type="text" name="meal" class="text-input" value="${escapeHtml(f.meal || '')}" placeholder="Breakfast, Lunch, Dinner, Snack" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Item</label>
                  <input type="text" name="item" class="text-input" value="${escapeHtml(f.item || '')}" placeholder="e.g. Oats, Maggi, Nuts" />
                </div>
                <div class="form-group">
                  <label class="form-label">Quantity</label>
                  <input type="text" name="quantity" class="text-input" value="${escapeHtml(f.quantity || '')}" placeholder="e.g. 500g, 4 bars" />
                </div>
              </div>

              <div class="form-group">
                <label class="checkbox-label" for="food-field-packed-${escapeHtml(f.id)}">
                  <input type="checkbox" id="food-field-packed-${escapeHtml(f.id)}" name="packed" ${f.packed ? 'checked' : ''} />
                  <span>Packed</span>
                </label>
              </div>
            `,
            readItemFields: (cardEl, f) => {
              f.day = cardEl.querySelector('[name="day"]')?.value || '';
              f.meal = cardEl.querySelector('[name="meal"]')?.value || '';
              f.item = cardEl.querySelector('[name="item"]')?.value || '';
              f.quantity = cardEl.querySelector('[name="quantity"]')?.value || '';
              f.packed = Boolean(cardEl.querySelector('[name="packed"]')?.checked);
              delete f.status;
            },
            onUpdate: () => {
              const groupItemIds = new Set(groupItems.map((f) => f.id));
              const otherItems = trek.food.items.filter((f) => getFoodGroupKey(f) !== group.key && !groupItemIds.has(f.id));
              trek.food.items = [...otherItems, ...groupItems];
              updateCounter();
              onSave();
              const curPacked = groupItems.filter((it) => it.packed).length;
              const curTotal = groupItems.length;
              const countSpan = groupEl.querySelector('.collapsible-section-count');
              if (countSpan) countSpan.textContent = curTotal > 0 ? `(${curPacked}/${curTotal})` : '(0)';
              const warnSpan = groupEl.querySelector('.collapsible-section-warning');
              const stillWarn = groupItems.some((it) => !it.packed);
              if (warnSpan) warnSpan.hidden = !stillWarn;
            },
          });
          foodEditors.set(group.key, editor);
        },
      });

      groupsContainer.appendChild(groupEl);
    });
  }

  render();
}

// Renders and binds the redesigned Safety section with 5 blocks and share action.
function renderSafetySection(container, trek, onSave) {
  if (!trek.safety || typeof trek.safety !== 'object') {
    trek.safety = {
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
      emergencyNumber: '112',
      medicines: '',
      nearestHelp: '',
      network: '',
    };
  }
  if (!Array.isArray(trek.safety.contacts)) {
    trek.safety.contacts = [];
  }
  if (!trek.safety.trustedPerson) {
    trek.safety.trustedPerson = {
      name: '',
      phone: '',
      hasItinerary: false,
      expectedReturn: '',
      alertBy: '',
      checkInPlan: '',
      instructions: '',
    };
  }
  if (!trek.safety.essentials || typeof trek.safety.essentials !== 'object') {
    trek.safety.essentials = {
      firstAid: false,
      medicines: false,
      headlamp: false,
      powerBank: false,
      offlineMap: false,
      whistle: false,
    };
  }
  if (typeof trek.safety.medicines !== 'string') {
    trek.safety.medicines = '';
  }
  if (typeof trek.safety.emergencyNumber !== 'string' || !trek.safety.emergencyNumber.trim()) {
    trek.safety.emergencyNumber = '112';
  }

  const tp = trek.safety.trustedPerson;
  const alertParts = splitIsoDateTime(tp.alertBy || '');
  const essentials = trek.safety.essentials;

  container.innerHTML = `
    <!-- 1. Home contact -->
    <div class="safety-block">
      <h3 class="safety-subheading">Home contact</h3>
      <div class="safety-hint">Someone at home who knows your plan and raises the alarm if you don't check in.</div>

      <div class="form-row">
        <div class="form-group">
          <label for="safety-tp-name" class="form-label">Name</label>
          <input type="text" id="safety-tp-name" name="tpName" class="text-input" value="${escapeHtml(tp.name || '')}" placeholder="Person at home" />
        </div>
        <div class="form-group">
          <label for="safety-tp-phone" class="form-label">Phone</label>
          <input type="tel" id="safety-tp-phone" name="tpPhone" class="text-input" value="${escapeHtml(tp.phone || '')}" placeholder="+91 ..." />
        </div>
      </div>

      <div class="form-group">
        <label class="checkbox-label" for="safety-tp-itinerary">
          <input type="checkbox" id="safety-tp-itinerary" ${tp.hasItinerary ? 'checked' : ''} />
          <span>Has a copy of the plan?</span>
        </label>
      </div>

      <div class="form-group">
        <label for="safety-tp-return" class="form-label">Expected return date</label>
        <input type="date" id="safety-tp-return" name="tpReturn" class="text-input" value="${escapeHtml(tp.expectedReturn || '')}" />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="safety-tp-alert-date" class="form-label">Raise the alarm if no contact by</label>
          <input type="date" id="safety-tp-alert-date" class="text-input" value="${escapeHtml(alertParts.date || '')}" />
        </div>
        <div class="form-group">
          <label for="safety-tp-alert-time" class="form-label">Time (optional)</label>
          <input type="time" id="safety-tp-alert-time" class="text-input" value="${escapeHtml(alertParts.time || '')}" />
        </div>
      </div>
      <div class="form-help">The exact date and time your contact will call for help if they haven't heard from you.</div>

      <div class="form-group">
        <label for="safety-tp-checkin-plan" class="form-label">When you'll check in</label>
        <input type="text" id="safety-tp-checkin-plan" class="text-input" value="${escapeHtml(tp.checkInPlan || '')}" placeholder="e.g. Each evening when there's signal" />
      </div>

      <div class="form-group">
        <label for="safety-tp-instructions" class="form-label">What they should do</label>
        <textarea id="safety-tp-instructions" class="text-input" rows="3" placeholder="e.g. Call the forest office at ..., then the local police at 112. Tell them our route is ...">${escapeHtml(tp.instructions || '')}</textarea>
      </div>
    </div>

    <!-- 2. Emergency contacts -->
    <div class="safety-block">
      <div class="safety-hint" style="margin-bottom: 8px;">People to call when something goes wrong, including local help.</div>
      <div id="safety-contacts-container" class="collapsible-sections-wrapper"></div>
    </div>

    <!-- 3. Carrying? checklist -->
    <div class="safety-block">
      <h3 class="safety-subheading">Carrying?</h3>
      <div class="safety-hint">Essential items that must be with you on the trail, not left in town.</div>
      <div class="safety-essentials-grid">
        <div class="essential-item-col">
          <label class="checkbox-label" for="essential-first-aid">
            <input type="checkbox" id="essential-first-aid" ${essentials.firstAid ? 'checked' : ''} />
            <span>First-aid kit</span>
          </label>
          <a href="#/trek/${encodeURIComponent(trek.id)}/plan?s=gear" class="first-aid-gear-link">See first-aid items in Gear</a>
        </div>
        <label class="checkbox-label" for="essential-medicines">
          <input type="checkbox" id="essential-medicines" ${essentials.medicines ? 'checked' : ''} />
          <span>Personal medicines</span>
        </label>
        <label class="checkbox-label" for="essential-headlamp">
          <input type="checkbox" id="essential-headlamp" ${essentials.headlamp ? 'checked' : ''} />
          <span>Headlamp + spare batteries</span>
        </label>
        <label class="checkbox-label" for="essential-power-bank">
          <input type="checkbox" id="essential-power-bank" ${essentials.powerBank ? 'checked' : ''} />
          <span>Power bank</span>
        </label>
        <label class="checkbox-label" for="essential-offline-map">
          <input type="checkbox" id="essential-offline-map" ${essentials.offlineMap ? 'checked' : ''} />
          <span>Offline map / GPX downloaded</span>
        </label>
        <label class="checkbox-label" for="essential-whistle">
          <input type="checkbox" id="essential-whistle" ${essentials.whistle ? 'checked' : ''} />
          <span>Whistle</span>
        </label>
      </div>

      <div class="form-group" style="margin-top: 14px;">
        <label for="safety-medicines" class="form-label">My medicines</label>
        <div class="safety-hint">List what you're carrying. Ask a doctor what you need, especially for high altitude.</div>
        <textarea id="safety-medicines" class="text-input" rows="2" placeholder="List what you're carrying...">${escapeHtml(trek.safety.medicines || '')}</textarea>
      </div>
    </div>

    <!-- 4. Emergency number, nearest help, mobile network -->
    <div class="safety-block">
      <h3 class="safety-subheading">Emergency number, nearest help, mobile network</h3>
      <div class="safety-hint">Keep these details handy for anyone who finds this phone.</div>

      <div class="form-group">
        <label for="safety-emergency-number" class="form-label">Emergency number</label>
        <input type="tel" id="safety-emergency-number" class="text-input" value="${escapeHtml(trek.safety.emergencyNumber || '112')}" placeholder="112" />
      </div>

      <div class="form-group">
        <label for="safety-nearest-help" class="form-label">Nearest help / road head</label>
        <textarea id="safety-nearest-help" class="text-input" rows="2" placeholder="Nearest hospital, police post, search & rescue contact...">${escapeHtml(trek.safety.nearestHelp || '')}</textarea>
      </div>

      <div class="form-group">
        <label for="safety-network" class="form-label">Mobile network notes</label>
        <textarea id="safety-network" class="text-input" rows="2" placeholder="Connectivity details (e.g. BSNL works till camp 2)...">${escapeHtml(trek.safety.network || '')}</textarea>
      </div>
    </div>

    <!-- 5. Bottom button: Share plan -->
    <div class="safety-block safety-share-block" style="border-bottom: none;">
      <button type="button" id="btn-safety-share" class="btn btn-primary btn-block">Share plan</button>
    </div>
  `;

  // Bind Home contact fields
  const tpNameInput = container.querySelector('#safety-tp-name');
  const tpPhoneInput = container.querySelector('#safety-tp-phone');
  const tpItineraryCb = container.querySelector('#safety-tp-itinerary');
  const tpReturnInput = container.querySelector('#safety-tp-return');
  const tpAlertDateInput = container.querySelector('#safety-tp-alert-date');
  const tpAlertTimeInput = container.querySelector('#safety-tp-alert-time');
  const tpCheckInPlanInput = container.querySelector('#safety-tp-checkin-plan');
  const tpInstructionsInput = container.querySelector('#safety-tp-instructions');

  const tpHandler = () => {
    tp.name = tpNameInput.value;
    tp.phone = tpPhoneInput.value;
    tp.hasItinerary = tpItineraryCb.checked;
    tp.expectedReturn = tpReturnInput.value;
    tp.alertBy = combineDateAndTime(tpAlertDateInput.value, tpAlertTimeInput.value);
    tp.checkInPlan = tpCheckInPlanInput.value;
    tp.instructions = tpInstructionsInput.value;
    onSave();
  };

  [tpNameInput, tpPhoneInput, tpReturnInput, tpAlertDateInput, tpAlertTimeInput, tpCheckInPlanInput, tpInstructionsInput].forEach((input) => {
    input.addEventListener('input', tpHandler);
    input.addEventListener('change', tpHandler);
  });
  tpItineraryCb.addEventListener('change', tpHandler);

  // Mount emergency contacts list as collapsible section
  const contactsContainer = container.querySelector('#safety-contacts-container');
  const openSections = new Set();
  let contactsEditor = null;

  function renderContactsGroup() {
    contactsContainer.innerHTML = '';
    const count = trek.safety.contacts.length;
    const countText = `(${count})`;
    const hasWarning = count === 0 || trek.safety.contacts.some((c) => !c.name?.trim() || !c.phone?.trim());
    const isOpen = openSections.has('contacts');

    const groupEl = createCollapsibleSectionGroup({
      key: 'contacts',
      title: 'Emergency contacts',
      countText,
      hasWarning,
      isOpen,
      addLabel: '+ Add',
      onToggle: () => {
        if (openSections.has('contacts')) {
          openSections.delete('contacts');
          contactsEditor = null;
        } else {
          openSections.add('contacts');
        }
        renderContactsGroup();
      },
      onAdd: () => {
        if (!openSections.has('contacts')) {
          openSections.add('contacts');
          renderContactsGroup();
        }
        if (contactsEditor) {
          contactsEditor.addItem();
        }
      },
      renderBody: (bodyEl) => {
        contactsEditor = mountListEditor(bodyEl, {
          items: trek.safety.contacts,
          emptyHint: 'No emergency contacts recorded yet.',
          addLabel: '',
          getItemTitle: (c, idx) => (c.name && c.name.trim() ? c.name.trim() : `Contact ${idx + 1} (no name entered)`),
          getItemSubtitle: (c) => CONTACT_ROLE_LABELS[c.role] || CONTACT_ROLE_LABELS[CONTACT_ROLES.FAMILY],
          getItemChips: (c) => {
            if (!c.phone?.trim()) return '';
            const cleanPhone = c.phone.replace(/\s+/g, '');
            return `<a href="tel:${escapeHtml(cleanPhone)}" class="contact-call-link" onclick="event.stopPropagation()">📞 ${escapeHtml(c.phone.trim())}</a>`;
          },
          createDefaultItem: () => ({
            id: crypto.randomUUID(),
            name: '',
            role: CONTACT_ROLES.FAMILY,
            phone: '',
          }),
          isItemEmpty: (c) => !c.name?.trim() && !c.phone?.trim(),
          renderItemFields: (c) => `
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Contact name</label>
                <input type="text" name="name" class="text-input" value="${escapeHtml(c.name || '')}" placeholder="Full name or agency" />
              </div>
              <div class="form-group">
                <label class="form-label">Role</label>
                <select name="role" class="text-input">
                  <option value="${CONTACT_ROLES.FAMILY}" ${c.role === CONTACT_ROLES.FAMILY ? 'selected' : ''}>${CONTACT_ROLE_LABELS[CONTACT_ROLES.FAMILY]}</option>
                  <option value="${CONTACT_ROLES.LOCAL_HELP}" ${c.role === CONTACT_ROLES.LOCAL_HELP ? 'selected' : ''}>${CONTACT_ROLE_LABELS[CONTACT_ROLES.LOCAL_HELP]}</option>
                  <option value="${CONTACT_ROLES.GUIDE}" ${c.role === CONTACT_ROLES.GUIDE ? 'selected' : ''}>${CONTACT_ROLE_LABELS[CONTACT_ROLES.GUIDE]}</option>
                  <option value="${CONTACT_ROLES.OTHER}" ${c.role === CONTACT_ROLES.OTHER ? 'selected' : ''}>${CONTACT_ROLE_LABELS[CONTACT_ROLES.OTHER]}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="tel" name="phone" class="text-input" value="${escapeHtml(c.phone || '')}" placeholder="+91 ..." />
            </div>
          `,
          readItemFields: (cardEl, c) => {
            c.name = cardEl.querySelector('[name="name"]')?.value || '';
            c.role = cardEl.querySelector('[name="role"]')?.value || CONTACT_ROLES.FAMILY;
            c.phone = cardEl.querySelector('[name="phone"]')?.value || '';
          },
          onUpdate: () => {
            onSave();
            const countSpan = groupEl.querySelector('.collapsible-section-count');
            if (countSpan) countSpan.textContent = `(${trek.safety.contacts.length})`;
            const warnSpan = groupEl.querySelector('.collapsible-section-warning');
            const stillWarn = trek.safety.contacts.length === 0 || trek.safety.contacts.some((c) => !c.name?.trim() || !c.phone?.trim());
            if (warnSpan) warnSpan.hidden = !stillWarn;
          },
        });
      },
    });

    contactsContainer.appendChild(groupEl);
  }

  renderContactsGroup();

  // Bind Carrying checklist
  const essentialCbs = {
    firstAid: container.querySelector('#essential-first-aid'),
    medicines: container.querySelector('#essential-medicines'),
    headlamp: container.querySelector('#essential-headlamp'),
    powerBank: container.querySelector('#essential-power-bank'),
    offlineMap: container.querySelector('#essential-offline-map'),
    whistle: container.querySelector('#essential-whistle'),
  };

  Object.entries(essentialCbs).forEach(([key, cb]) => {
    if (cb) {
      cb.addEventListener('change', () => {
        trek.safety.essentials[key] = cb.checked;
        onSave();
      });
    }
  });

  // Bind My medicines
  const safetyMedicinesInput = container.querySelector('#safety-medicines');
  if (safetyMedicinesInput) {
    const medHandler = () => {
      trek.safety.medicines = safetyMedicinesInput.value;
      onSave();
    };
    safetyMedicinesInput.addEventListener('input', medHandler);
    safetyMedicinesInput.addEventListener('change', medHandler);
  }

  // Bind Emergency number, nearest help, mobile network
  const emergencyNumberInput = container.querySelector('#safety-emergency-number');
  const nearestHelpInput = container.querySelector('#safety-nearest-help');
  const networkInput = container.querySelector('#safety-network');

  const notesHandler = () => {
    trek.safety.emergencyNumber = emergencyNumberInput.value.trim() || '112';
    trek.safety.nearestHelp = nearestHelpInput.value;
    trek.safety.network = networkInput.value;
    onSave();
  };

  [emergencyNumberInput, nearestHelpInput, networkInput].forEach((input) => {
    input.addEventListener('input', notesHandler);
    input.addEventListener('change', notesHandler);
  });

  // Bind Share plan button
  const btnShare = container.querySelector('#btn-safety-share');
  if (btnShare) {
    btnShare.addEventListener('click', () => {
      sharePlan(trek);
    });
  }
}

// Renders the structured Plan view for sections 1–8 with section chips and auto-save.
export function renderPlan(container, trekId, sectionKey = 'overview') {
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

  const validSection = PLAN_SECTIONS.some((s) => s.key === sectionKey) ? sectionKey : 'overview';
  const currentIdx = PLAN_SECTIONS.findIndex((s) => s.key === validSection);
  const currentSection = PLAN_SECTIONS[currentIdx];

  const prevSection = currentIdx > 0 ? PLAN_SECTIONS[currentIdx - 1] : null;
  const nextSection = currentIdx < PLAN_SECTIONS.length - 1 ? PLAN_SECTIONS[currentIdx + 1] : null;

  // A2: Save scrollLeft of chip row before re-render
  const existingChipsBar = container.querySelector('.section-chips-bar');
  const savedScrollLeft = existingChipsBar ? existingChipsBar.scrollLeft : null;

  container.innerHTML = `
    <div class="page-container">
      <header class="page-header">
        <div class="header-top-row">
          <a href="#/" class="back-link">← Treks</a>
          <span id="saved-indicator" class="save-status" aria-live="polite">Saved</span>
        </div>
        <h1 class="plan-trek-title">${escapeHtml(trek.overview.name || 'Untitled Trek')}</h1>
      </header>

      <!-- Horizontal scrollable row of 8 section chips (Part A) -->
      <div class="section-chips-wrapper">
        <nav class="section-chips-bar" aria-label="Planner Sections">
          ${PLAN_SECTIONS.map((section) => {
            const isComplete = isSectionComplete(trek, section.key);
            const isActive = section.key === validSection;
            const labelWithCheck = `${section.label}${isComplete ? ' ✓' : ''}`;
            return `
              <a
                href="#/trek/${encodeURIComponent(trek.id)}/plan?s=${section.key}"
                class="section-chip ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}"
                data-section="${section.key}"
                ${isActive ? 'aria-current="step"' : ''}
              >
                ${escapeHtml(labelWithCheck)}
              </a>
            `;
          }).join('')}
        </nav>
      </div>

      <!-- Active Section Card -->
      <main class="section-content-card">
        <h2 class="section-title">${escapeHtml(currentSection.label)}</h2>
        <div id="section-body" class="section-body"></div>
      </main>

      <!-- Back / Next navigation buttons -->
      <div class="plan-nav-buttons">
        ${
          prevSection
            ? `<a href="#/trek/${encodeURIComponent(trek.id)}/plan?s=${prevSection.key}" class="btn btn-secondary btn-nav-back">Back</a>`
            : `<button type="button" class="btn btn-secondary btn-nav-back" disabled>Back</button>`
        }
        ${
          nextSection
            ? `<a href="#/trek/${encodeURIComponent(trek.id)}/plan?s=${nextSection.key}" class="btn btn-primary btn-nav-next">Next</a>`
            : `<button type="button" class="btn btn-primary btn-nav-next" disabled>Next</button>`
        }
      </div>

      ${renderBottomTabBar(trek.id, 'plan')}
    </div>
  `;

  // Section chip row scrolling, edge fades, and wheel navigation (Part A)
  const chipsWrapper = container.querySelector('.section-chips-wrapper');
  const chipsBar = container.querySelector('.section-chips-bar');
  const activeChip = container.querySelector('.section-chip.active');

  // A2: Restore previous chip row scroll position to prevent snapping back on re-render
  if (chipsBar && savedScrollLeft !== null) {
    chipsBar.scrollLeft = savedScrollLeft;
  }

  const updateFades = () => {
    if (!chipsBar || !chipsWrapper) return;
    const maxScroll = chipsBar.scrollWidth - chipsBar.clientWidth;
    const hasLeft = chipsBar.scrollLeft > 2;
    const hasRight = chipsBar.scrollLeft < maxScroll - 2;
    chipsWrapper.classList.toggle('fade-left', hasLeft && maxScroll > 0);
    chipsWrapper.classList.toggle('fade-right', hasRight && maxScroll > 0);
  };

  // A1: Smooth scroll active chip to the CENTRE of the row
  if (activeChip && activeChip.scrollIntoView) {
    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeChip.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }

  // Update edge fades initially and after scroll settlement
  updateFades();
  requestAnimationFrame(updateFades);
  setTimeout(updateFades, 350);

  if (chipsBar) {
    chipsBar.addEventListener('scroll', updateFades, { passive: true });
    window.addEventListener('resize', updateFades, { passive: true });

    // A1 & A7: Wheel listener on chip row attached on every render
    chipsBar.addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY !== 0) {
          const maxScroll = chipsBar.scrollWidth - chipsBar.clientWidth;
          if (maxScroll > 0) {
            const canScrollRight = e.deltaY > 0 && chipsBar.scrollLeft < maxScroll - 1;
            const canScrollLeft = e.deltaY < 0 && chipsBar.scrollLeft > 1;
            if (canScrollRight || canScrollLeft) {
              e.preventDefault();
              chipsBar.scrollLeft += e.deltaY;
              updateFades();
            }
          }
        }
      },
      { passive: false }
    );
  }

  // Auto-save notification and section completion updater
  let saveTimer = null;
  const onSave = () => {
    saveTrek(trek);

    // Briefly show the "Saved" notification
    const savedEl = container.querySelector('#saved-indicator');
    if (savedEl) {
      savedEl.classList.add('visible');
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        savedEl.classList.remove('visible');
      }, 1500);
    }

    // Refresh checkmarks on all section chips
    PLAN_SECTIONS.forEach((sec) => {
      const chipEl = container.querySelector(`.section-chip[data-section="${sec.key}"]`);
      if (chipEl) {
        const isComp = isSectionComplete(trek, sec.key);
        chipEl.textContent = `${sec.label}${isComp ? ' ✓' : ''}`;
        chipEl.classList.toggle('complete', isComp);
      }
    });

    // Update trek title if overview name changed
    const titleEl = container.querySelector('.plan-trek-title');
    if (titleEl) {
      titleEl.textContent = trek.overview.name || 'Untitled Trek';
    }
  };

  const sectionBody = container.querySelector('#section-body');

  switch (validSection) {
    case 'overview':
      sectionBody.innerHTML = renderOverviewForm(trek.overview);
      bindOverviewEvents(sectionBody, trek, onSave);
      break;

    case 'permits':
      renderPermitsSection(sectionBody, trek, onSave);
      break;

    case 'travel':
      renderTravelSection(sectionBody, trek, onSave);
      break;

    case 'stays':
      renderStaysSection(sectionBody, trek, onSave);
      break;

    case 'days':
      renderDaysSection(sectionBody, trek, onSave);
      break;

    case 'gear':
      renderGearSection(sectionBody, trek, onSave);
      break;

    case 'food':
      renderFoodSection(sectionBody, trek, onSave);
      break;

    case 'safety':
      renderSafetySection(sectionBody, trek, onSave);
      break;

    default:
      sectionBody.innerHTML = `
        <div class="placeholder-card">
          <p class="placeholder-message">Coming next</p>
        </div>
      `;
      break;
  }
}
