import { getTrek } from '../store.js';
import {
  escapeHtml,
  CONTACT_ROLE_LABELS,
  STAY_TYPE_LABELS,
} from '../model.js';
import {
  formatDate,
  formatDateTime,
  formatDayMonth,
  renderStatusChip,
  renderWaterStatusChip,
  renderOwnTentChip,
  renderBottomTabBar,
} from '../ui.js';
import { getLocalTodayIso, daysBetween } from '../checks.js';
import { buildTimeline } from '../timeline.js';

const ESSENTIAL_LABELS = Object.freeze({
  firstAid: 'First-aid kit',
  medicines: 'Personal medicines',
  headlamp: 'Headlamp + spare batteries',
  powerBank: 'Power bank',
  offlineMap: 'Offline map / GPX',
  whistle: 'Whistle',
});

// Capitalizes travel mode for display.
function formatMode(mode) {
  if (!mode) return 'Travel';
  if (mode === 'shared_jeep') return 'Shared jeep';
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

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
  return '📌';
}

// Renders the Emergency card that is always visible on the Today view.
function renderEmergencyCard(trek) {
  const safety = trek.safety || {};
  const emNum = safety.emergencyNumber?.trim() || '112';
  const cleanEmNum = emNum.replace(/\s+/g, '');
  const contacts = Array.isArray(safety.contacts) ? safety.contacts : [];
  const tp = safety.trustedPerson || {};

  // Unticked carrying essentials
  const essentials = safety.essentials || {};
  const unpacked = Object.entries(ESSENTIAL_LABELS)
    .filter(([key]) => !essentials[key])
    .map(([, label]) => label);

  return `
    <section class="today-emergency-card" aria-label="Emergency Details">
      <div class="today-emergency-header">
        <h2 class="today-emergency-title">Emergency</h2>
        <span class="emergency-badge">Always available</span>
      </div>

      <!-- Prominent Emergency Number -->
      <div class="emergency-main-dial">
        <a href="tel:${escapeHtml(cleanEmNum)}" class="btn-emergency-call" aria-label="Call emergency number ${escapeHtml(emNum)}">
          🚨 Call ${escapeHtml(emNum)}
        </a>
      </div>

      <!-- Unticked Essentials Warning Box -->
      ${
        unpacked.length > 0
          ? `<div class="today-emergency-unpacked" role="alert">
              <span class="unpacked-icon">⚠️</span>
              <div class="unpacked-text">
                <strong>Not marked as packed:</strong>
                <span>${escapeHtml(unpacked.join(', '))}</span>
              </div>
            </div>`
          : `<div class="today-emergency-packed-ok">
              ✓ All safety essentials marked packed
            </div>`
      }

      <!-- Emergency & Home Contacts -->
      <div class="today-emergency-contacts">
        <h3 class="today-emergency-subtitle">Contacts to call</h3>
        <div class="emergency-contacts-list">
          ${
            tp.phone?.trim()
              ? `
                <a href="tel:${escapeHtml(tp.phone.replace(/\s+/g, ''))}" class="emergency-call-row">
                  <div class="call-row-main">
                    <span class="call-row-name">${escapeHtml(tp.name?.trim() || 'Home contact')}</span>
                    <span class="call-row-role">Home contact</span>
                  </div>
                  <span class="call-row-phone">📞 ${escapeHtml(tp.phone.trim())}</span>
                </a>
              `
              : (tp.name?.trim() ? `<div class="emergency-call-row-text">${escapeHtml(tp.name)} (home contact — no phone recorded)</div>` : '')
          }
          ${
            contacts.length === 0 && !tp.phone?.trim() && !tp.name?.trim()
              ? `<div class="empty-state-text">No emergency contacts recorded in Safety.</div>`
              : contacts
                  .map((c) => {
                    const roleLabel = CONTACT_ROLE_LABELS[c.role] || c.role || 'Family';
                    const name = c.name?.trim() || 'Contact';
                    if (!c.phone?.trim()) {
                      return `<div class="emergency-call-row-text">${escapeHtml(name)} (${escapeHtml(roleLabel)} — no phone)</div>`;
                    }
                    const cleanPhone = c.phone.replace(/\s+/g, '');
                    return `
                      <a href="tel:${escapeHtml(cleanPhone)}" class="emergency-call-row">
                        <div class="call-row-main">
                          <span class="call-row-name">${escapeHtml(name)}</span>
                          <span class="call-row-role">${escapeHtml(roleLabel)}</span>
                        </div>
                        <span class="call-row-phone">📞 ${escapeHtml(c.phone.trim())}</span>
                      </a>
                    `;
                  })
                  .join('')
          }
        </div>
      </div>

      <!-- Nearest help and network notes -->
      ${
        safety.nearestHelp?.trim()
          ? `
            <div class="today-emergency-info">
              <span class="info-label">Nearest help / road head:</span>
              <p class="info-value">${escapeHtml(safety.nearestHelp.trim())}</p>
            </div>
          `
          : ''
      }
      ${
        safety.network?.trim()
          ? `
            <div class="today-emergency-info">
              <span class="info-label">Mobile network notes:</span>
              <p class="info-value">${escapeHtml(safety.network.trim())}</p>
            </div>
          `
          : ''
      }
    </section>
  `;
}

// Renders the one-tap SMS check-in button linking to the home contact.
function renderCheckInButton(trek, checkInMessage) {
  const tp = trek.safety?.trustedPerson || {};
  const phone = (tp.phone || '').trim();

  if (!phone) {
    return `
      <div class="today-checkin-wrapper">
        <a href="#/trek/${encodeURIComponent(trek.id)}/plan?s=safety" class="btn btn-secondary btn-block">
          Set home contact phone in Safety to enable one-tap check-in
        </a>
      </div>
    `;
  }

  const cleanPhone = phone.replace(/\s+/g, '');
  const smsHref = `sms:${escapeHtml(cleanPhone)}?body=${encodeURIComponent(checkInMessage)}`;

  return `
    <div class="today-checkin-wrapper">
      <a href="${smsHref}" class="btn btn-primary btn-block btn-checkin" id="btn-send-checkin">
        📱 Send check-in SMS
      </a>
      <div class="today-checkin-preview">
        Message: "${escapeHtml(checkInMessage)}" to ${escapeHtml(phone)}
      </div>
    </div>
  `;
}

// Renders the Today view showing real-time stage info and emergency tools offline.
export function renderToday(container, trekId) {
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

  const todayIso = getLocalTodayIso();
  const tripStart = trek.overview?.tripStartDate || trek.overview?.startDate || '';
  const tripEnd = trek.overview?.tripEndDate || trek.overview?.endDate || '';
  const days = Array.isArray(trek.days) ? trek.days : [];
  const todayTrekDay = days.find((d) => d.date === todayIso);

  const todayTravel = Array.isArray(trek.travel)
    ? trek.travel.filter((t) => t.departAt && t.departAt.slice(0, 10) === todayIso)
    : [];
  const todayStays = Array.isArray(trek.stays)
    ? trek.stays.filter((s) => s.checkIn === todayIso)
    : [];

  let stateHtml = '';

  // Determine state
  if (todayTrekDay) {
    // ─── STATE 2: Trekking Day ───
    const fromTo = todayTrekDay.from && todayTrekDay.to
      ? `${todayTrekDay.from} → ${todayTrekDay.to}`
      : (todayTrekDay.from || todayTrekDay.to || 'Route not entered');

    const metricsParts = [];
    if (todayTrekDay.distanceKm != null && todayTrekDay.distanceKm !== '') {
      metricsParts.push(`${todayTrekDay.distanceKm} km`);
    }
    if (todayTrekDay.hours != null && todayTrekDay.hours !== '') {
      metricsParts.push(`${todayTrekDay.hours} hours`);
    }

    const stayTypeLabel = STAY_TYPE_LABELS[todayTrekDay.stayType] || todayTrekDay.stayType || 'Stay';
    const stayTonight = todayTrekDay.stayName?.trim()
      ? `${stayTypeLabel} at ${todayTrekDay.stayName.trim()}`
      : stayTypeLabel;

    const checkInDest = todayTrekDay.to?.trim() || 'camp';
    const checkInMsg = `Day ${todayTrekDay.dayNumber}: reached ${checkInDest}. All OK.`;

    stateHtml = `
      <section class="today-focus-card" aria-label="Today's Trekking Stage">
        <div class="today-card-badge">Trekking Day</div>
        <div class="today-card-header">
          <span class="today-day-number">Day ${todayTrekDay.dayNumber}</span>
          <span class="today-date">${formatDayMonth(todayIso)}</span>
        </div>

        <h2 class="today-route-title">${escapeHtml(fromTo)}</h2>

        ${
          metricsParts.length > 0
            ? `<div class="today-metrics-row">${escapeHtml(metricsParts.join(' · '))}</div>`
            : ''
        }

        <div class="today-details-grid">
          <div class="today-detail-item">
            <span class="detail-label">Stay tonight</span>
            <span class="detail-value">${escapeHtml(stayTonight)}</span>
          </div>

          <div class="today-detail-item">
            <span class="detail-label">Water</span>
            <div class="detail-chip-row">
              ${renderWaterStatusChip(todayTrekDay.waterStatus)}
              ${todayTrekDay.water ? `<span class="detail-subtext">${escapeHtml(todayTrekDay.water)}</span>` : ''}
            </div>
          </div>
        </div>

        ${
          todayTrekDay.notes?.trim()
            ? `<div class="today-notes-box">
                <span class="notes-label">Notes for today:</span>
                <p>${escapeHtml(todayTrekDay.notes.trim())}</p>
              </div>`
            : ''
        }

        ${renderCheckInButton(trek, checkInMsg)}
      </section>
    `;
  } else if (tripEnd && todayIso > tripEnd) {
    // ─── STATE 4: After Trip ───
    stateHtml = `
      <section class="today-status-card today-after-trip" aria-label="Trip Finished">
        <div class="status-card-icon">🏔️</div>
        <h2 class="status-card-title">Trip finished. Welcome back!</h2>
        <p class="status-card-desc">
          Trip ended on ${formatDate(tripEnd)}. Hope you had a safe and memorable trek!
        </p>
      </section>
    `;
  } else if (tripStart && todayIso < tripStart) {
    // ─── STATE 1: Before Trip ───
    const daysUntil = daysBetween(todayIso, tripStart);
    let countdownText = `Your trip starts in ${daysUntil} days`;
    if (daysUntil === 1) {
      countdownText = 'Your trip starts tomorrow';
    } else if (daysUntil === 0) {
      countdownText = 'Your trip starts today';
    }

    // Get next 3 upcoming timeline entries
    const timelineGroups = buildTimeline(trek);
    const upcoming = [];
    for (const group of timelineGroups) {
      if (group.date && group.date >= todayIso) {
        for (const entry of group.entries) {
          upcoming.push({ ...entry, date: group.date, groupLabel: group.label });
          if (upcoming.length >= 3) break;
        }
      }
      if (upcoming.length >= 3) break;
    }

    stateHtml = `
      <section class="today-hero-card" aria-label="Trip Countdown">
        <div class="hero-countdown-badge">Upcoming</div>
        <h2 class="hero-countdown-title">${escapeHtml(countdownText)}</h2>
        <div class="hero-date-range">
          Starts ${formatDate(tripStart)}${tripEnd ? ` · Ends ${formatDate(tripEnd)}` : ''}
        </div>
      </section>

      <section class="today-upcoming-section" aria-label="What's Coming Next">
        <h3 class="today-section-heading">What's coming next</h3>
        ${
          upcoming.length === 0
            ? `<div class="empty-state-card"><p>No upcoming timeline entries found.</p></div>`
            : `<div class="timeline-entries" role="list">
                ${upcoming
                  .map((entry) => `
                    <div class="timeline-card" role="listitem">
                      <div class="timeline-icon" aria-hidden="true">${getTimelineIcon(entry.type, entry.mode)}</div>
                      <div class="timeline-content">
                        <div class="timeline-title-row">
                          <span class="timeline-title">${escapeHtml(entry.title)}</span>
                          <div class="timeline-chips">
                            ${entry.status ? renderStatusChip(entry.status) : ''}
                            ${entry.isOwnTent ? renderOwnTentChip() : ''}
                            ${entry.waterStatus ? renderWaterStatusChip(entry.waterStatus) : ''}
                          </div>
                        </div>
                        <div class="timeline-subtitle">
                          ${escapeHtml(entry.groupLabel)}${entry.subtitle ? ` · ${escapeHtml(entry.subtitle)}` : ''}
                        </div>
                      </div>
                    </div>
                  `)
                  .join('')}
              </div>`
        }
      </section>
    `;
  } else if ((tripStart && todayIso >= tripStart) || (tripEnd && todayIso <= tripEnd) || todayTravel.length > 0 || todayStays.length > 0) {
    // ─── STATE 3: Travel / Off-Trail Day During Trip ───
    const checkInMsg = 'Checking in: all OK.';
    const hasTodayEvents = todayTravel.length > 0 || todayStays.length > 0;

    stateHtml = `
      <section class="today-focus-card" aria-label="Today's Schedule">
        <div class="today-card-badge">Trip Day</div>
        <div class="today-card-header">
          <span class="today-day-number">Today</span>
          <span class="today-date">${formatDayMonth(todayIso)}</span>
        </div>

        <h2 class="today-route-title">Travel & Transition</h2>

        ${
          !hasTodayEvents
            ? `<p class="today-rest-desc">Rest day or transition day — no travel legs or trek stages scheduled for today.</p>`
            : `
              <div class="today-events-list">
                ${todayTravel
                  .map((leg) => {
                    const modeTitle = formatMode(leg.mode);
                    const route = leg.from && leg.to ? `${leg.from} → ${leg.to}` : (leg.from || leg.to || 'Route not entered');
                    const dep = leg.departAt ? formatDateTime(leg.departAt) : '';
                    return `
                      <div class="today-event-item">
                        <div class="event-icon">${getTimelineIcon('travel', leg.mode)}</div>
                        <div class="event-body">
                          <div class="event-title">${escapeHtml(modeTitle)}: ${escapeHtml(route)}</div>
                          ${dep ? `<div class="event-time">Departs: ${escapeHtml(dep)}</div>` : ''}
                          ${leg.bookingRef ? `<div class="event-ref">Ref: ${escapeHtml(leg.bookingRef)}</div>` : ''}
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
                ${todayStays
                  .map((stay) => {
                    const namePlace = [stay.name, stay.place].filter(Boolean).join(', ') || 'Stay';
                    const nights = stay.nights != null ? stay.nights : 1;
                    return `
                      <div class="today-event-item">
                        <div class="event-icon">🏠</div>
                        <div class="event-body">
                          <div class="event-title">Stay: ${escapeHtml(namePlace)}</div>
                          <div class="event-time">${nights} night${nights > 1 ? 's' : ''}</div>
                          ${stay.notes ? `<div class="event-ref">${escapeHtml(stay.notes)}</div>` : ''}
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
        }

        ${renderCheckInButton(trek, checkInMsg)}
      </section>
    `;
  } else {
    // ─── Fallback: Dates Not Set ───
    stateHtml = `
      <section class="today-status-card" aria-label="Dates Not Configured">
        <div class="status-card-icon">📅</div>
        <h2 class="status-card-title">Trip dates not set</h2>
        <p class="status-card-desc">Set trip dates in Overview to see your day-by-day plan here.</p>
        <div class="status-card-action">
          <a href="#/trek/${encodeURIComponent(trek.id)}/plan?s=overview" class="btn btn-secondary">
            Go to Overview
          </a>
        </div>
      </section>
    `;
  }

  const trekName = trek.overview?.name || 'Untitled Trek';

  container.innerHTML = `
    <div class="page-container today-container">
      <header class="page-header">
        <a href="#/" class="back-link">← Treks</a>
        <h1 class="page-title">${escapeHtml(trekName)}</h1>
        <div class="page-date-indicator">Today · ${formatDate(todayIso)}</div>
      </header>

      <main class="today-main-content">
        ${stateHtml}
        ${renderEmergencyCard(trek)}
      </main>

      ${renderBottomTabBar(trek.id, 'today')}
    </div>
  `;
}
