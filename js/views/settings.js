import { getSettings, saveSettings, exportData, importData } from '../store.js';
import { escapeHtml } from '../model.js';
import { downloadJsonFile } from '../ui.js';

// Renders the Settings view with backup & transfer, Gemma config, and about section.
export function renderSettings(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-container">
      <header class="page-header">
        <div class="header-top-row">
          <a href="#/" class="back-link">← Treks</a>
          <span id="settings-saved-indicator" class="save-status" aria-live="polite">Saved</span>
        </div>
        <h1>Settings</h1>
      </header>

      <div class="settings-container">
        <!-- 1. Backup & transfer card -->
        <section class="settings-card" aria-labelledby="card-title-backup">
          <h2 id="card-title-backup" class="settings-card-title">Backup & transfer</h2>
          <div class="settings-buttons-row">
            <button type="button" id="btn-export-all" class="btn btn-primary">Export all treks</button>
            <button type="button" id="btn-import-file" class="btn btn-secondary">Import from file</button>
            <input type="file" id="input-import-file" accept=".json,application/json" hidden />
          </div>
          <div id="import-result-msg" class="settings-result-msg" role="status" hidden></div>
          <p class="settings-help-text">To move your plan to your phone: export here, send the file to your phone, then import it in the app on your phone.</p>
        </section>

        <!-- 2. Gemma (AI review) card -->
        <section class="settings-card" aria-labelledby="card-title-gemma">
          <h2 id="card-title-gemma" class="settings-card-title">Gemma (AI review)</h2>
          <div class="form-group">
            <label for="settings-ollama-url" class="form-label">Ollama address</label>
            <input
              type="text"
              id="settings-ollama-url"
              name="ollamaUrl"
              class="text-input"
              value="${escapeHtml(settings.ollamaUrl || 'http://localhost:11434')}"
              placeholder="http://localhost:11434"
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label for="settings-model" class="form-label">Model</label>
            <input
              type="text"
              id="settings-model"
              name="model"
              class="text-input"
              value="${escapeHtml(settings.model || 'gemma3:4b')}"
              placeholder="gemma3:4b"
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label for="settings-review-timeout" class="form-label">Review time limit (seconds)</label>
            <input
              type="number"
              id="settings-review-timeout"
              name="reviewTimeoutSec"
              class="text-input"
              min="60"
              max="900"
              value="${settings.reviewTimeoutSec ?? 300}"
              placeholder="300"
              autocomplete="off"
            />
          </div>
          <p class="settings-help-text">Gemma runs on the laptop through Ollama. Not needed on your phone.</p>
        </section>

        <!-- 3. About card -->
        <section class="settings-card" aria-labelledby="card-title-about">
          <h2 id="card-title-about" class="settings-card-title">About</h2>
          <p class="settings-help-text">Your data is stored only on this device. Export a backup before your trek.</p>
        </section>
      </div>
    </div>
  `;

  // Attach Export All event
  const btnExportAll = container.querySelector('#btn-export-all');
  if (btnExportAll) {
    btnExportAll.addEventListener('click', () => {
      try {
        const data = exportData();
        const todayIso = new Date().toISOString().slice(0, 10);
        const filename = `trek-organizer-backup-${todayIso}.json`;
        downloadJsonFile(filename, data);
      } catch (err) {
        console.error('Failed to export data:', err);
      }
    });
  }

  // Attach Import event
  const btnImportFile = container.querySelector('#btn-import-file');
  const inputImportFile = container.querySelector('#input-import-file');
  const resultMsgEl = container.querySelector('#import-result-msg');

  if (btnImportFile && inputImportFile) {
    btnImportFile.addEventListener('click', () => {
      inputImportFile.click();
    });

    inputImportFile.addEventListener('change', () => {
      const file = inputImportFile.files && inputImportFile.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonText = e.target.result;
          const parsed = JSON.parse(jsonText);
          const { added, replaced, skipped } = importData(parsed, {
            onConflict: (existingTrek) => {
              const name = existingTrek.overview?.name || 'Untitled Trek';
              return window.confirm(
                `A trek named "${name}" already exists. Replace it with the imported version?`
              )
                ? 'replace'
                : 'skip';
            },
          });

          if (resultMsgEl) {
            resultMsgEl.hidden = false;
            resultMsgEl.classList.remove('error');
            resultMsgEl.textContent = `Imported: ${added} added, ${replaced} replaced, ${skipped} skipped.`;
          }
        } catch (err) {
          console.error('Failed to import backup file:', err);
          if (resultMsgEl) {
            resultMsgEl.hidden = false;
            resultMsgEl.classList.add('error');
            resultMsgEl.textContent = "This file isn't a valid Trek Organizer backup.";
          }
        } finally {
          inputImportFile.value = '';
        }
      };

      reader.onerror = (err) => {
        console.error('Failed to read file:', err);
        if (resultMsgEl) {
          resultMsgEl.hidden = false;
          resultMsgEl.classList.add('error');
          resultMsgEl.textContent = "This file isn't a valid Trek Organizer backup.";
        }
        inputImportFile.value = '';
      };

      reader.readAsText(file);
    });
  }

  // Attach Gemma settings auto-save
  let saveTimer = null;
  const showSavedIndicator = () => {
    const indicator = container.querySelector('#settings-saved-indicator');
    if (indicator) {
      indicator.classList.add('visible');
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        indicator.classList.remove('visible');
      }, 1500);
    }
  };

  const ollamaInput = container.querySelector('#settings-ollama-url');
  const modelInput = container.querySelector('#settings-model');
  const timeoutInput = container.querySelector('#settings-review-timeout');

  const onSettingsChange = () => {
    let timeoutVal = parseInt(timeoutInput?.value, 10);
    if (isNaN(timeoutVal)) {
      timeoutVal = 300;
    } else if (timeoutVal < 60) {
      timeoutVal = 60;
    } else if (timeoutVal > 900) {
      timeoutVal = 900;
    }

    saveSettings({
      ollamaUrl: ollamaInput.value.trim() || 'http://localhost:11434',
      model: modelInput.value.trim() || 'gemma3:4b',
      reviewTimeoutSec: timeoutVal,
    });
    showSavedIndicator();
  };

  if (ollamaInput && modelInput && timeoutInput) {
    ollamaInput.addEventListener('input', onSettingsChange);
    ollamaInput.addEventListener('change', onSettingsChange);
    modelInput.addEventListener('input', onSettingsChange);
    modelInput.addEventListener('change', onSettingsChange);
    timeoutInput.addEventListener('input', onSettingsChange);
    timeoutInput.addEventListener('change', onSettingsChange);
  }
}
