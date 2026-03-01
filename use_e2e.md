# How to Use the E2E Test Framework (Agent Guide)

This document explains how an AI agent should use the Playwright E2E test suite to **verify bug fixes** from [report.md](report.md). The test framework automates a browser, takes screenshots at every step, and saves them as `.base64.txt` files you can read directly into your context — no MCP browser tool needed.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `cd c:\projekte\DeltaChat && npx playwright test` | Run all tests headless |
| `npx playwright test --headed` | Run with visible browser window |
| `npx playwright test --debug` | Step-through debugger |
| `node e2e/view-screenshots.js` | List all captured screenshots |
| `node e2e/view-screenshots.js 13_message` | Print base64 data URI of a specific screenshot |

---

## Project Layout

```
e2e/
├── ollama-full-flow.spec.ts     # Main test — 4 serial steps (provider → model → chat → response)
├── view-screenshots.js          # CLI tool to list/view screenshot base64
├── helpers/
│   ├── navigation.ts            # Reusable Vuetify UI helpers (fill fields, select options, navigate)
│   ├── screenshots.ts           # takeScreenshot() — saves .png + .base64.txt
│   └── screenshots/             # Output directory (created at runtime)
│       ├── 01_settings_providers_initial_<timestamp>.png
│       ├── 01_settings_providers_initial_<timestamp>.base64.txt
│       └── ...
├── report/                      # Playwright HTML report
└── .gitignore
```

---

## How the Tests Work

The test suite in `e2e/ollama-full-flow.spec.ts` runs **4 sequential steps** that exercise the full flow from the [report.md](report.md):

### Step 1: Enable Ollama Provider (`Settings → Providers`)
- Navigates to `/settings`, selects the "Model Providers" tab
- Toggles Ollama ON, fills in Base URL (`http://localhost:11434`) and Default Model (`qwen:0.5b`)
- Clicks "Save Providers"
- **Reloads the page** and checks if the provider settings persisted
- Screenshots: `01_*` through `05_*`

### Step 2: Create a Model (`Settings → Models`)
- Also sets the provider via API as a workaround (the persistence bug may cause the UI save to be lost)
- Navigates to the Models tab, clicks "Add Model"
- Fills the dialog: Display Name, Provider (ollama), Model Name
- Saves and verifies the model appears in the list
- Screenshots: `06_*` through `09_*`

### Step 3: Send a Chat Message (`Chat View`)
- Navigates to `/`, selects the created model from the dropdown
- Types a test message ("What is 2+2? ...") and clicks Send
- Intercepts the `POST /api/chats` call to confirm chat creation
- Verifies the message content is in the DOM
- Screenshots: `10_*` through `13_*`

### Step 4: Verify AI Response
- Polls for up to 90 seconds for an assistant message bubble (`.message-assistant`)
- If no UI response, checks if the backend is still alive (it often crashes — known bug)
- Falls back to testing the non-streaming REST API directly
- Reports one of 4 outcomes:
  - **SUCCESS** — AI responded in the UI
  - **UI streaming broken** — API works but socket/streaming layer is broken
  - **Backend crashed** — backend died processing the Ollama message
  - **No response** — neither UI nor API works
- Screenshots: `14_*` through `17_*`

---

## Consuming Screenshots in Context

Every `takeScreenshot(page, name)` call produces two files:

| File | Content |
|------|---------|
| `<name>_<timestamp>.png` | Standard PNG image |
| `<name>_<timestamp>.base64.txt` | Full `data:image/png;base64,...` data URI |

### To view a screenshot without browser MCP:

```bash
# List all screenshots
node e2e/view-screenshots.js

# Read a specific screenshot's base64 into context
cat e2e/helpers/screenshots/13_message_sent_<timestamp>.base64.txt
```

Or directly read the `.base64.txt` file with your file-reading tool. The base64 content is a complete data URI that can be rendered in any markdown viewer or consumed by vision-capable models.

### Screenshot naming convention:

| Prefix | Step | What it shows |
|--------|------|---------------|
| `01_` – `05_` | Provider setup | Settings page, Ollama card, fields filled, after save, after reload |
| `06_` – `09_` | Model creation | Models tab, Add dialog open, form filled, model in list |
| `10_` – `13_` | Chat & message | Chat welcome screen, model selected, message typed, message sent |
| `14_` – `17_` | AI response | Waiting for response, thinking state, final chat state, test complete |

---

## Workflow for Fixing Bugs

### Prerequisites
Before running tests, ensure all three services are running:

```bash
# Terminal 1 — Backend
cd backend && npx ts-node src/server.ts

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Ollama (must have qwen:0.5b pulled)
ollama serve
```

Verify services:
```bash
curl http://127.0.0.1:3000/api/settings     # Backend
curl http://localhost:5173                    # Frontend
curl http://localhost:11434/api/tags          # Ollama
```

### Fix → Test → Screenshot Cycle

1. **Read the report** — Open [report.md](report.md) section 14 for the prioritized bug list.

2. **Pick a bug to fix** — Start with CRITICAL bugs:
   - Bug #1: Backend crashes with Ollama models → look at `backend/src/services/ChatService.ts` and the Ollama provider in `backend/src/modules/ModelProvider/`
   - Bug #2: Provider settings don't persist → look at `frontend/src/stores/settings.js` and `frontend/src/components/SettingsPanel.vue` (`saveProviderSettings()`)
   - Bug #3: Model selector resets → look at `frontend/src/components/ChatInterface.vue` (`selectedModelId`)

3. **Make your code change.**

4. **Restart the backend** if you edited backend code (it crashes, so you often need to restart):
   ```bash
   # Kill old process, then:
   cd backend && npx ts-node src/server.ts
   ```

5. **Run the tests:**
   ```bash
   cd c:\projekte\DeltaChat
   npx playwright test
   ```

6. **Check the results.** The console output tells you pass/fail per step. On failure:
   - Read the screenshot files for visual context
   - Check `e2e/helpers/screenshots/` for the numbered screenshots
   - The Playwright HTML report in `e2e/report/` has detailed traces

7. **Iterate.** Fix the code, restart services, run tests again.

### Interpreting Test Output

| Console output | Meaning |
|----------------|---------|
| `✅ Ollama provider enabled after reload: true` | Provider persistence bug is **fixed** |
| `✅ Ollama provider enabled after reload: false` | Provider persistence bug still present |
| `✅ Model "Test Qwen 0.5B" created successfully` | Model creation works |
| `✅ Chat created via API — id: ...` | Chat creation works, message was sent |
| `🎉 SUCCESS: AI model responded in the UI!` | **Everything works end-to-end** |
| `⚠️ UI streaming broken, but backend API + Ollama work fine.` | Backend works, fix the Socket.IO / streaming layer |
| `❌ CONFIRMED BUG: Backend crashed when processing Ollama chat message.` | Backend crashes — fix the Ollama model provider |
| `⚠️ Backend unreachable when checking chats` | Backend process is dead — restart it |

---

## Modifying the Tests

### Configuration constants (top of `ollama-full-flow.spec.ts`):

```typescript
const OLLAMA_BASE_URL = 'http://localhost:11434';   // Ollama server address
const OLLAMA_MODEL    = 'qwen:0.5b';               // Model name in Ollama
const MODEL_DISPLAY   = 'Test Qwen 0.5B';          // Display name in DeltaChat UI
const TEST_MESSAGE    = 'What is 2+2? Reply with just the number.';
```

### Adding a new screenshot:

```typescript
import { takeScreenshot } from './helpers/screenshots';

// Inside any test:
await takeScreenshot(page, 'my_descriptive_name');
// → saves my_descriptive_name_<timestamp>.png + .base64.txt
```

### Adding a new test step:

```typescript
test('Step 5: Verify provider persistence after fix', async () => {
  await goToSettings(page, 'providers');
  await page.waitForTimeout(1000);
  
  const ollamaCard = page.locator('.v-card').filter({ hasText: 'Ollama' });
  const toggle = ollamaCard.locator('.v-switch input[type="checkbox"]');
  
  await takeScreenshot(page, '18_provider_persistence_check');
  
  const isEnabled = await toggle.isChecked();
  expect(isEnabled, 'Ollama provider should stay enabled after reload').toBeTruthy();
});
```

### Using the navigation helpers:

```typescript
import { goToSettings, goToChat, fillVuetifyField, selectVuetifyOption, waitForDialog, clickDialogAction } from './helpers/navigation';

// Navigate
await goToSettings(page, 'providers');   // goes to /settings, clicks tab
await goToChat(page);                    // goes to /

// Fill a Vuetify text field by its label
await fillVuetifyField(page, 'Display Name', 'My Model', '.v-dialog');

// Select from a Vuetify v-select dropdown
await selectVuetifyOption(page, 'Provider', 'ollama', '.v-dialog');

// Wait for dialog + click action button
await waitForDialog(page);
await clickDialogAction(page, 'Save');
```

### Using the API request context:

The test suite creates a Playwright `APIRequestContext` called `api` for direct backend calls:

```typescript
// GET
const res = await api.get('/api/models');
const models = await res.json();

// POST
const res = await api.post('/api/chats/some-id/messages', {
  data: { content: 'Hello', stream: false },
});

// PUT
await api.put('/api/settings', {
  data: { ollama: { enabled: true, baseUrl: 'http://localhost:11434' } },
});

// DELETE
await api.delete(`/api/models/${modelId}`);
```

---

## Key Files to Fix (from report.md)

| Bug | Severity | Files to investigate |
|-----|----------|---------------------|
| Backend crashes with Ollama | **CRITICAL** | `backend/src/services/ChatService.ts`, `backend/src/modules/ModelProvider/` |
| Chat hangs at "Thinking..." | **CRITICAL** | `frontend/src/stores/chat.js` (Socket.IO `streamMessage`), `backend/src/routes/chat.ts` |
| Provider settings don't persist | **CRITICAL** | `frontend/src/components/SettingsPanel.vue` (`saveProviderSettings`), `frontend/src/stores/settings.js`, `backend/src/routes/settings.ts` |
| Model selector resets | **HIGH** | `frontend/src/components/ChatInterface.vue` (`selectedModelId` ref, no localStorage) |
| No error toasts | **HIGH** | Add a global snackbar in `frontend/src/App.vue` or via a Pinia store |
| No form validation | **MEDIUM** | `frontend/src/components/SettingsPanel.vue` (Agent/Tool dialogs — Save button `:disabled` binding) |

---

## Tips

- **The backend crashes frequently** when an Ollama message is processed. Always check if the backend is still alive before re-running tests. Restart it with: `cd backend && npx ts-node src/server.ts`
- **Provider persistence has a workaround** — Step 2 sets the provider via the API directly (`api.put('/api/settings', ...)`), so the model creation test doesn't depend on the UI save working.
- **Screenshots are timestamped** — each test run creates a new set. Clean old ones with: `Remove-Item e2e/helpers/screenshots/* -Force`
- **Use `--headed` for debugging** — `npx playwright test --headed` opens a visible browser so you can watch the test interact with the UI.
- **The HTML report** at `e2e/report/` includes failure screenshots, traces, and step-by-step logs. Open it with: `npx playwright show-report e2e/report`
