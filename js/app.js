import { getTrek } from './store.js';
import { escapeHtml } from './model.js';
import { renderHome } from './views/home.js';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'plan', label: 'Plan' },
  { key: 'today', label: 'Today' },
  { key: 'review', label: 'Review' },
];

// Renders the bottom navigation bar for a trek with four tabs.
function renderBottomTabBar(trekId, activeTabKey) {
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

// Renders a placeholder view for a specific trek tab.
function renderTrekPlaceholder(container, trekId, tabKey) {
  const trek = getTrek(trekId);
  const tabConfig = TABS.find((t) => t.key === tabKey) || { label: tabKey };

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

  const trekName = trek.overview.name || 'Untitled Trek';

  container.innerHTML = `
    <div class="page-container">
      <header class="page-header">
        <a href="#/" class="back-link">← Treks</a>
        <h1>${escapeHtml(trekName)}</h1>
      </header>

      <section class="placeholder-card">
        <h2>${escapeHtml(tabConfig.label)}</h2>
        <p class="placeholder-message">${escapeHtml(tabConfig.label)} view will be built here.</p>
      </section>

      ${renderBottomTabBar(trekId, tabKey)}
    </div>
  `;
}

// Renders a placeholder view for the Settings screen.
function renderSettingsPlaceholder(container) {
  container.innerHTML = `
    <div class="page-container">
      <header class="page-header">
        <a href="#/" class="back-link">← Treks</a>
        <h1>Settings</h1>
      </header>

      <section class="placeholder-card">
        <p class="placeholder-message">Settings view will be built here.</p>
      </section>
    </div>
  `;
}

// Renders a not-found error page when an unknown route is visited.
function renderNotFound(container) {
  container.innerHTML = `
    <div class="page-container">
      <header class="page-header">
        <a href="#/" class="back-link">← Treks</a>
        <h1>Page Not Found</h1>
      </header>
      <div class="placeholder-card">
        <p class="placeholder-message">The requested page does not exist.</p>
      </div>
    </div>
  `;
}

// Resolves the current URL hash route and mounts the appropriate view.
export function router() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container element #app not found.');
    return;
  }

  const rawHash = window.location.hash.trim();
  const hash = rawHash === '' || rawHash === '#' ? '#/' : rawHash;

  if (hash === '#/') {
    renderHome(appContainer);
    return;
  }

  if (hash === '#/settings') {
    renderSettingsPlaceholder(appContainer);
    return;
  }

  const trekMatch = hash.match(/^#\/trek\/([^/]+)\/(dashboard|plan|today|review)$/);
  if (trekMatch) {
    const trekId = decodeURIComponent(trekMatch[1]);
    const tabKey = trekMatch[2];
    renderTrekPlaceholder(appContainer, trekId, tabKey);
    return;
  }

  renderNotFound(appContainer);
}

// Initializes the application router and event listeners.
export function initApp() {
  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', router);

  // If DOM is already ready, run router immediately
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    router();
  }
}

initApp();
