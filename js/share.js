import { formatDate, formatDateTime, formatDayMonth } from './ui.js';
import { STAY_TYPE_LABELS, CONTACT_ROLE_LABELS, escapeHtml } from './model.js';

// Builds a clean, plain-text summary of the trek plan suitable for SMS or messaging apps.
export function buildShareText(trek) {
  if (!trek || typeof trek !== 'object') return '';

  const lines = [];
  const name = trek.overview?.name?.trim() || 'Untitled Trek';
  lines.push(`TREK PLAN — ${name}`);

  // Trip dates
  const tripStart = formatDate(trek.overview?.tripStartDate);
  const tripEnd = formatDate(trek.overview?.tripEndDate);
  if (tripStart || tripEnd) {
    lines.push(`Trip: ${tripStart || 'not set'} – ${tripEnd || 'not set'}`);
  }

  // Trekking dates
  const trekStart = formatDate(trek.overview?.startDate);
  const trekEnd = formatDate(trek.overview?.endDate);
  if (trekStart || trekEnd) {
    lines.push(`Trekking: ${trekStart || 'not set'} – ${trekEnd || 'not set'}`);
  }

  // Region
  if (trek.overview?.region?.trim()) {
    lines.push(`Region: ${trek.overview.region.trim()}`);
  }

  // Travel legs
  const travel = Array.isArray(trek.travel) ? trek.travel : [];
  const toLegs = travel.filter((l) => l.direction === 'to');
  const returnLegs = travel.filter((l) => l.direction === 'return');

  toLegs.forEach((l) => {
    const dep = formatDateTime(l.departAt);
    const mode = l.mode || 'travel';
    const route = `${l.from?.trim() || '?'} → ${l.to?.trim() || '?'}`;
    lines.push(`Travel there: ${mode}, ${route}${dep ? `, ${dep}` : ''}`);
  });

  returnLegs.forEach((l) => {
    const dep = formatDateTime(l.departAt);
    const mode = l.mode || 'travel';
    const route = `${l.from?.trim() || '?'} → ${l.to?.trim() || '?'}`;
    lines.push(`Travel back: ${mode}, ${route}${dep ? `, ${dep}` : ''}`);
  });

  // Day by day
  const days = Array.isArray(trek.days) ? trek.days : [];
  days.forEach((d) => {
    const dayDate = d.date ? ` (${formatDayMonth(d.date)})` : '';
    const route = `${d.from?.trim() || '?'} → ${d.to?.trim() || '?'}`;
    const stayDesc = d.stayName?.trim() || STAY_TYPE_LABELS[d.stayType] || d.stayType || '';
    lines.push(`Day ${d.dayNumber}${dayDate}: ${route}${stayDesc ? ` — stay: ${stayDesc}` : ''}`);
  });

  // Escalation & Home Contact
  const tp = trek.safety?.trustedPerson || {};
  if (tp.expectedReturn) {
    lines.push(`Expected back: ${formatDate(tp.expectedReturn)}`);
  }

  if (tp.alertBy) {
    const alertTime = formatDateTime(tp.alertBy);
    const instr = tp.instructions?.trim();
    lines.push(`If you haven't heard from me by ${alertTime}${instr ? `: ${instr}` : '.'}`);
  }

  if (tp.checkInPlan?.trim()) {
    lines.push(`Check-in plan: ${tp.checkInPlan.trim()}`);
  }

  // Emergency contacts
  const contacts = Array.isArray(trek.safety?.contacts) ? trek.safety.contacts : [];
  if (contacts.length > 0) {
    lines.push('Emergency contacts:');
    contacts.forEach((c) => {
      const role = CONTACT_ROLE_LABELS[c.role] || c.role || 'Family';
      const parts = [c.name?.trim() || 'Contact'];
      parts.push(`(${role})`);
      if (c.phone?.trim()) parts.push(c.phone.trim());
      lines.push(`- ${parts.join(' ')}`);
    });
  }

  // Emergency number
  if (trek.safety?.emergencyNumber?.trim()) {
    lines.push(`Emergency number: ${trek.safety.emergencyNumber.trim()}`);
  }

  // Nearest help
  if (trek.safety?.nearestHelp?.trim()) {
    lines.push(`Nearest help: ${trek.safety.nearestHelp.trim()}`);
  }

  // Medicines
  if (trek.safety?.medicines?.trim()) {
    lines.push(`Medicines: ${trek.safety.medicines.trim()}`);
  }

  lines.push('Sent from Trek Organizer.');
  return lines.join('\n');
}

// Displays a temporary toast or banner message on screen.
function showShareToast(message) {
  let toast = document.getElementById('share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.className = 'share-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
  }, 4000);
}

// Displays a manual text copy modal when neither Web Share nor clipboard is available.
function showManualCopyModal(text) {
  let modal = document.getElementById('share-manual-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'share-manual-modal';
  modal.className = 'share-modal-backdrop';
  modal.innerHTML = `
    <div class="share-modal-dialog" role="dialog" aria-labelledby="share-modal-title" aria-modal="true">
      <h3 id="share-modal-title">Share trek plan</h3>
      <p>Select and copy your plan below to send via WhatsApp or SMS:</p>
      <textarea readonly class="text-input share-modal-textarea">${escapeHtml(text)}</textarea>
      <div class="share-modal-actions">
        <button type="button" class="btn btn-primary" id="btn-close-share-modal">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const textarea = modal.querySelector('textarea');
  if (textarea) {
    textarea.focus();
    textarea.select();
  }

  const closeBtn = modal.querySelector('#btn-close-share-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.remove());
  }
}

// Shares the trek plan via Web Share API, clipboard fallback, or a manual copy modal.
export async function sharePlan(trek) {
  const text = buildShareText(trek);
  const title = `Trek Plan — ${trek.overview?.name || 'Trek'}`;

  // 1. Try Web Share API (native sheet on phones)
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled share sheet — not an error
        return;
      }
      console.warn('navigator.share failed, trying clipboard fallback:', err);
    }
  }

  // 2. Fallback to Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      showShareToast('Plan copied — paste it into WhatsApp or SMS.');
      return;
    } catch (err) {
      console.warn('navigator.clipboard failed, trying manual copy modal:', err);
    }
  }

  // 3. Fallback to manual copy modal
  showManualCopyModal(text);
}
