# DeltaDatabase Feedback

Issues and observations recorded while running DeltaDatabase locally during frontend screenshot generation.

---

## 1. Docker image tag `donti/deltadatabase` does not exist

**Command tried:**
```bash
docker run -d --name deltadatabase -p 8080:8080 -e ADMIN_KEY=secretkey donti/deltadatabase
```

**Error:**
```
manifest for donti/deltadatabase:latest not found: manifest unknown: manifest unknown
```

**Fix:** Use the explicit `latest-aio` tag:
```bash
docker run -d --name deltadatabase -p 8080:8080 -e ADMIN_KEY=secretkey donti/deltadatabase:latest-aio
```

The tagless image (`donti/deltadatabase:latest`) does not exist on Docker Hub. Only `donti/deltadatabase:latest-aio` is published. The README and `.env.example` have been updated to use the correct tag.

---

## 2. DeltaDatabase started and responded correctly

Once the correct tag was used, DeltaDatabase started without issues:

```
GET http://localhost:8080/health → {"status":"ok"}
```

- Authentication with `ADMIN_KEY=secretkey` via `POST /api/login` works as expected.
- The backend (`DELTA_DB_ADMIN_KEY=secretkey`) connected successfully.

---

## 3. Frontend screenshots: headless Chrome cannot reach localhost via TCP

**Observation:** Chrome headless (both via Puppeteer and `--screenshot` CLI flag) running inside the sandboxed CI environment returns `ERR_CONNECTION_REFUSED` for any `http://localhost:*` or `http://127.0.0.1:*` URL, even when `curl` from the same shell succeeds.

**Root cause:** Chrome runs in a separate network namespace / sandbox that blocks loopback TCP connections.

**Workaround used to generate screenshots:**
1. Built the frontend with `base: './'` so all asset paths are relative (e.g. `./assets/index.js` instead of `/assets/index.js`).
2. Temporarily switched Vue Router to `createWebHashHistory()` so hash-based routes (`#/`, `#/knowledge`, `#/settings`) work with `file://` URLs.
3. Loaded the built `dist/index.html` directly via `file://` in Chrome headless — no server required.
4. Intercepted and aborted all `http://` requests (backend API, Socket.io) inside Puppeteer so the UI renders in its empty/offline state.

Screenshots produced: `docs/screenshots/chat.png`, `chat-light.png`, `knowledge.png`, `settings.png`.

---

## 4. `ADMIN_Key` vs `ADMIN_KEY` casing

The problem statement used `ADMIN_Key=secretkey` (mixed case). DeltaDatabase only recognises `ADMIN_KEY` (all caps). Using `ADMIN_Key` results in no authentication key being set, leaving the server open or inaccessible depending on the implementation.

**Recommendation:** Always use `ADMIN_KEY` (all caps) when running the container.
