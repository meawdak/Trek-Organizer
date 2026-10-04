# 🏔️ Trek Organizer

**An offline, phone-first trek planner with a local AI that checks your plan and never makes things up.**

Trek Organizer keeps everything about a trek in one place — travel, stays, trek days, gear, food, permits and emergency contacts and shows what's missing, unconfirmed or still to buy before you leave. On the trail, it works with no internet.

Its AI features run on **Gemma**, an open-weight model, **locally through Ollama**. Your notes and plans never leave your device.

🔗 **Live app:** https://meawdak.github.io/Trek-Organizer/
</br>
🏆 Built for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)

---

## 📸 Screenshots

| Dashboard | Timeline | Gemma — Sort my notes | Gemma — Plan check |
|---|---|---|---|
|<img width="802" height="940" alt="WhatsApp Image 2026-10-05 at 1 59 44 AM" src="https://github.com/user-attachments/assets/8933772b-dfbc-40a0-8fae-2d05daccc946" /> | <img width="778" height="936" alt="WhatsApp Image 2026-10-05 at 1 58 01 AM" src="https://github.com/user-attachments/assets/841acc43-7cb1-4d17-8b78-2b1974e5d49c" /> | <img width="1045" height="1078" alt="WhatsApp Image 2026-10-05 at 1 21 12 AM" src="https://github.com/user-attachments/assets/5e1dbb74-2557-459b-abdc-90f039357bdd" /> | <img width="763" height="817" alt="WhatsApp Image 2026-10-05 at 1 27 13 AM" src="https://github.com/user-attachments/assets/fdd897fc-2086-4130-90eb-64f7a099ca52" /> |



---

## 💡 Why I built this

I built this for my best friend, who treks regularly in the Himalayas.

For him, planning a trek is part of the preparation itself. But his plans were scattered across booking SMSes, WhatsApp tips, YouTube videos, phone notes and several AI chats. Nothing was in one place, and nothing told him what he'd forgotten.

He also doesn't trust AI with decisions this important and on a trek, he's right not to. A confident wrong answer ("there's water at camp 3") is worse than no answer.

So Trek Organizer is built on one rule:

> **An unknown stays unknown until you confirm it. The app never invents information.**

---

## 🛡️ How it avoids making things up

| Safeguard | What it does |
|---|---|
| **Source check** | Every value Gemma extracts from your notes is checked against your own text by code. If a place, name, booking number or phone number isn't in your text, it's removed. |
| **Unknown by default** | Anything added from notes is marked **Unknown** until you confirm it. |
| **Labelled suggestions** | Gemma's suggestions are tagged **"Suggestion — check this yourself"** and only enter your plan when you tap **Add**. |
| **No medical advice** | Gemma never suggests medicines. |
| **Code, not AI, for numbers** | Packed counts, missing items and readiness are calculated by code. |
| **Strict model settings** | Temperature 0 and JSON-only output, followed by a junk and duplicate filter. |

---

## 🚀 Getting started

### Option 1 — Use it on your phone (no setup)

1. Open **https://meawdak.github.io/Trek-Organizer/** in Chrome on your phone.
2. From the browser menu, tap **Add to Home screen** / **Install app**.
3. Open it once while online. After that, it works without internet.

**Check offline mode:** open the app, turn on airplane mode, and reload. Your treks should still be there.

### Option 2 — Run it locally

The app is plain HTML, CSS and JavaScript. No build step, no dependencies.

```bash
git clone https://github.com/meawdak/Trek-Organizer.git
cd Trek-Organizer
npx serve -l 3000
```

Open **http://localhost:3000**.

Any static server works, for example:

```bash
python3 -m http.server 3000
```

---

## 🤖 Setting up Gemma (optional)

The planner works fully without AI. To use **Sort my notes** and **Plan check**, run Gemma on your own computer with Ollama.

### 1. Install Ollama

Download it from **https://ollama.com** and install it.

### 2. Download a Gemma model

```bash
ollama pull gemma3:4b
```

On a laptop with less memory, use the smaller model:

```bash
ollama pull gemma3:1b
```

### 3. Make sure Ollama is running

```bash
ollama list
```

If you get an error, start it:

```bash
ollama serve
```

### 4. Connect the app

1. Open the app and go to **Settings**.
2. Set **Model** to the model you downloaded (for example `gemma3:4b`).
3. Open a trek and go to the **Gemma** tab.

If it says *"Gemma isn't reachable"*, check that Ollama is running (step 3).

### Using Gemma with the live link

Ollama only accepts requests from websites you allow. To use Gemma from the GitHub Pages link, start Ollama like this:

```bash
OLLAMA_ORIGINS="https://meawdak.github.io" ollama serve
```

If it still doesn't connect, run the app locally (Option 2).

### How long does it take?

Depending on the model and your laptop, a Gemma run can take from a few seconds to a couple of minutes. A timer and a **Cancel** button are shown while it runs.

---

## 🧭 How to use it

1. **Create a trek** — add a name, dates, region and trekking days.
2. **Fill in the Plan** — go section by section: travel, stays, trek days, gear, food, permits, contacts, safety.
3. **Sort your notes (optional)** — paste booking messages into **Gemma → Sort my notes** and add what's correct.
4. **Check the Dashboard** — fix critical items first, then warnings.
5. **Run a Plan check (optional)** — review Gemma's suggestions and add what's useful.
6. **Export your trek and import it on your phone** (see below).
7. **On the trail** — use **Today**.

### Try Sort my notes with this sample

```
Train 12541 Mumbai CSMT to Kathgodam on 6 Nov, dep 16:35, PNR 8123456790. From Kathgodam take a shared jeep to Bageshwar. Bus Bageshwar to Kharkiya 7 Nov morning. Govind (guide) 9000012345. Stay at KMVN rest house Khati 8 Nov, 1 night. Carry gaiters and a thermal flask. Forest permit from DFO Bageshwar office. Pack 2 kg poha and 1 kg peanut chikki.
```

You should get cards for the train, jeep, bus, stay, gear, food, guide contact and permit and nothing that isn't in the text.

---

## 🔄 Export & Import (JSON)

Your treks are stored **in the browser on that device only**. Export and Import let you back up a trek or move it between devices.

- **Export** — saves your trek as a `.json` file.
- **Import** — loads a `.json` file back into the app.

### Laptop → phone workflow

Gemma runs on a laptop, but on the trail you'll only have your phone:

1. **Plan on your laptop** and use Gemma to sort notes and check the plan.
2. **Export** the trek. A `.json` file downloads.
3. **Send the file to your phone** — WhatsApp to yourself, email, Google Drive or USB.
4. On your phone, open the app and **Import** the file.
5. Your full plan is now on your phone and **works offline on the trail**.

It works the other way too: edit on the phone, export, and import on the laptop to run Gemma again.

### Good to know

- **Export regularly as a backup.** Clearing browser data or uninstalling the browser can delete saved treks.
- The `.json` file contains your whole plan, including **phone numbers and booking references**. Only share it with people you trust.
- Import doesn't upload anything — the file is read on your device.

---

## 🗂️ Project structure

```
Trek-Organizer/
├── index.html          # App entry point
├── sw.js               # Service worker — offline caching
├── css/
│   └── styles.css      # All styles (mobile-first)
├── js/
│   ├── app.js          # App start-up and routing
│   ├── model.js        # Trek data model, defaults and gear categories
│   ├── store.js        # Saving and loading treks on the device
│   ├── checks.js       # Rule-based plan checks and readiness
│   ├── ai.js           # Gemma via Ollama: prompts, requests and source checks
│   ├── ui.js           # Shared UI helpers
│   └── views/          # One file per screen (plan, review/Gemma, …)
├── PRD.md              # Product requirements
├── UX_SPEC.md          # Screens and interactions
├── TECH_SPEC.md        # Data model, AI prompts and validation rules
└── AGENT_RULES.md      # Rules for the AI coding agent used to build this
```

---

## 🛠️ Tech stack

| Part | Technology |
|---|---|
| App | HTML, CSS, vanilla JavaScript |
| Offline | Progressive Web App (PWA) with a service worker |
| Storage | Browser storage on the device — no server, no login |
| AI model | **Gemma** (open-weight), `gemma3:4b` / `gemma3:1b` |
| AI runtime | **Ollama**, running locally |
| Hosting | GitHub Pages |
| Built with | Antigravity (AI coding agent), guided by the specs in this repo |

---

## ⚠️ Limitations

- **Gemma needs a computer running Ollama.** It doesn't run on the phone.
- **Data is stored per device and per browser.** Use Export / Import to move or back it up.
- **Gemma's suggestions can be wrong.** That's why they're labelled and only added when you choose to.
- **This app does not tell you a trek is safe.** It helps you organise and check your plan. It doesn't replace official sources, local knowledge, weather forecasts or a qualified guide.

---

## 🔭 What's next

- Run a small Gemma model directly on the phone.
- Day-by-day altitude profile to flag fast ascents.
- Weather forecast with an expiry time, so old forecasts are never shown as current.

---

## 👤 Author

Built by **[meawdak](https://github.com/meawdak)** — for someone who takes his treks seriously.
