import { getTrek } from '../store.js';
import { escapeHtml } from '../model.js';
import {
  formatDate,
  renderStatusChip,
  renderWaterStatusChip,
  renderReadinessChip,
  renderOwnTentChip,
  renderBottomTabBar,
} from '../ui.js';
import { runChecks } from '../checks.js';
import { buildTimeline } from '../timeline.js';
import { sharePlan } from '../share.js';

// Returns an appropriate emoji icon based on timeline entry type and travel mode.
function getTimelineIcon(type, mode) {
  if (type === 'stay') return '🏠';
  if (type === 'day') return '🥾';
  if (type === 'travel') {
    switch (mode) {
      case 'bus':
        return '🚌';
      case 'shared_jeep':
        return '🚙';
      case 'taxi':
        return '🚕';
      case 'flight':
        return '✈️';
      case 'train':
      default:
        return '🚆';
    }
  }
  return '📍';
}

// Formats dates for the dashboard header: trip dates if both are set, otherwise trekking dates.
function formatHeaderDates(overview) {
  const tripStart = formatDate(overview?.tripStartDate);
  const tripEnd = formatDate(overview?.tripEndDate);
  if (tripStart && tripEnd) return `${tripStart} – ${tripEnd}`;
  const start = formatDate(overview?.startDate);
  const end = formatDate(overview?.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – (end date not set)`;
  return 'Dates not set';
}

// Renders the Dashboard view with completeness, readiness, plan check issues, and chronological timeline.
export function renderDashboard(container, trekId) {
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

  const checkResults = runChecks(trek);
  const { critical, warnings, completeness, readiness } = checkResults;
  const issues = [...critical, ...warnings];

  const timelineGroups = buildTimeline(trek);

  const datesFormatted = formatHeaderDates(trek.overview);
  const regionFormatted = trek.overview?.region?.trim() || '';

  const tripStart = formatDate(trek.overview?.tripStartDate);
  const tripEnd = formatDate(trek.overview?.tripEndDate);
  const hasTripDates = Boolean(tripStart && tripEnd);

  const trekStart = formatDate(trek.overview?.startDate);
  const trekEnd = formatDate(trek.overview?.endDate);
  const trekkingDatesSet = Boolean(trekStart && trekEnd);
  const trekkingSubline = hasTripDates && trekkingDatesSet ? `Trekking: ${trekStart} – ${trekEnd}` : '';

  const progressPercent = Math.round((completeness.done / completeness.total) * 100);

  container.innerHTML = `
    <div class="page-container">
      <header class="page-header">
        <a href="#/" class="back-link">← Treks</a>
        <h1 class="dashboard-trek-title">${escapeHtml(trek.overview.name || 'Untitled Trek')}</h1>
        <div class="dashboard-trek-meta">
          <span class="dashboard-dates">${escapeHtml(datesFormatted)}</span>
          ${regionFormatted ? `<span class="dashboard-region"> · ${escapeHtml(regionFormatted)}</span>` : ''}
          ${trekkingSubline ? `<div class="dashboard-trekking-subdates">${escapeHtml(trekkingSubline)}</div>` : ''}
        </div>
      </header>

      <!-- Two metric cards side by side -->
      <section class="dashboard-metrics" aria-label="Trek Status Summary">
        <div class="metric-card">
          <div class="metric-label">Planning</div>
          <div class="progress-bar-container" role="progressbar" aria-valuenow="${completeness.done}" aria-valuemin="0" aria-valuemax="${completeness.total}">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
          <div class="metric-value-text">${completeness.done} of ${completeness.total} sections filled</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Readiness</div>
          <div class="readiness-chip-row">
            ${renderReadinessChip(readiness)}
          </div>
          <div class="metric-value-text">
            ${critical.length} critical · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}
          </div>
        </div>
      </section>

      <!-- Share plan action -->
      <div class="dashboard-share-row">
        <button type="button" id="btn-dashboard-share" class="btn btn-secondary btn-block">Share plan</button>
      </div>

      <!-- Plan check issues list -->
      <section class="dashboard-section issues-section" aria-label="Plan Check Issues">
        <h2 class="dashboard-section-title">Plan Check</h2>
        ${
          issues.length === 0
            ? `<div class="empty-state-card"><p>No issues found in what's entered.</p></div>`
            : `<ul class="issues-list" role="list">
                ${issues
                  .map((issue) => {
                    const isCrit = issue.level === 'critical';
                    const icon = isCrit ? '✕' : '△';
                    return `
                      <li role="listitem">
                        <a
                          href="#/trek/${encodeURIComponent(trek.id)}/plan?s=${encodeURIComponent(issue.section)}"
                          class="issue-card issue-${issue.level}"
                          aria-label="${isCrit ? 'Critical issue' : 'Warning'}: ${escapeHtml(issue.message)}"
                        >
                          <span class="issue-icon" aria-hidden="true">${icon}</span>
                          <span class="issue-message">${escapeHtml(issue.message)}</span>
                          <span class="issue-arrow" aria-hidden="true">→</span>
                        </a>
                      </li>
                    `;
                  })
                  .join('')}
              </ul>`
        }
      </section>

      <!-- Timeline grouped by date -->
      <section class="dashboard-section timeline-section" aria-label="Trek Timeline">
        <h2 class="dashboard-section-title">Timeline</h2>
        ${
          timelineGroups.length === 0
            ? `<div class="empty-state-card"><p>No travel legs, stays, or trek days added yet.</p></div>`
            : `<div class="timeline-groups">
                ${timelineGroups
                  .map((group) => `
                    <div class="timeline-group">
                      <h3 class="timeline-date-header">${escapeHtml(group.label)}</h3>
                      <div class="timeline-entries" role="list">
                        ${group.entries
                          .map((entry) => `
                            <a
                              href="#/trek/${encodeURIComponent(trek.id)}/plan?s=${encodeURIComponent(entry.section)}"
                              class="timeline-card"
                              role="listitem"
                            >
                              <div class="timeline-icon" aria-hidden="true">${getTimelineIcon(entry.type, entry.mode)}</div>
                              <div class="timeline-content">
                                <div class="timeline-title-row">
                                  <span class="timeline-title">${escapeHtml(entry.title)}</span>
                                  <div class="timeline-chips">
                                    ${entry.isOwnTent ? renderOwnTentChip() : (entry.status ? renderStatusChip(entry.status) : '')}
                                    ${entry.waterStatus ? renderWaterStatusChip(entry.waterStatus) : ''}
                                  </div>
                                </div>
                                ${
                                  entry.subtitle
                                    ? `<div class="timeline-subtitle">${escapeHtml(entry.subtitle)}</div>`
                                    : ''
                                }
                              </div>
                            </a>
                          `)
                          .join('')}
                      </div>
                    </div>
                  `)
                  .join('')}
              </div>`
        }
      </section>

      <footer class="dashboard-footer-note">
        <p>Readiness reflects only what's entered here. It is not a safety guarantee.</p>
      </footer>

      ${renderBottomTabBar(trek.id, 'dashboard')}
    </div>
  `;

  const btnDashboardShare = container.querySelector('#btn-dashboard-share');
  if (btnDashboardShare) {
    btnDashboardShare.addEventListener('click', () => {
      sharePlan(trek);
    });
  }
}
