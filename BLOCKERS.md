# BLOCKERS.md

**Project:** Coaching Platform MVP
**Purpose:** Active and resolved environmental and dependency blockers. Separate from BUG_LOG.md (which tracks code bugs). Append-only.
**Last updated:** 2026-05-14 (T0-06.5 complete — all blockers resolved)

---

## Format

- **ID** — B-ENV-NNN (environment) or B-DEP-NNN (dependency)
- **Date** — ISO YYYY-MM-DD when identified
- **Task blocked** — task ID(s) affected
- **Severity** — Blocking / Non-blocking
- **What** — one-line description
- **Exact error** — quoted verbatim
- **Root cause** — why it happened
- **Resolution** — steps to resolve
- **Status** — Open / Resolved

---

## Active Blockers

_None._

---

## Non-blocking Issues

### B-ENV-002 — Supabase CLI not installed as native binary

| Field | Value |
| ----- | ----- |
| **Date** | 2026-05-14 |
| **Task affected** | T0-06.5 and all subsequent Supabase CLI operations |
| **Severity** | Non-blocking (`npx supabase@2.98.2` works) |
| **What** | `supabase` command not found as a native binary. `npx supabase` resolves and works but adds latency on first invocation per session. |

**Resolution (optional, recommended):**
After Docker is confirmed working post-restart:
```
winget install Supabase.Supabase
```
Verify: `supabase --version`

**Status:** Open (non-blocking)

---

### B-ENV-003 — UserPromptSubmit hook ParserError

| Field | Value |
| ----- | ----- |
| **Date** | 2026-05-14 |
| **Task affected** | None — cosmetic only |
| **Severity** | Non-blocking |
| **What** | Recurring `ParserError` from `UserPromptSubmit` hook observed during this CMD session. Does not affect Claude Code execution or task output. |

**Resolution:** Investigate hook configuration in `.claude/settings.json` when convenient. Not a priority before T0-06.5 resumes.

**Status:** Open (non-blocking)

---

## Resolved Blockers

### B-ENV-001 — Docker Desktop daemon not running / crash

| Field | Value |
| ----- | ----- |
| **Date identified** | 2026-05-14 |
| **Date resolved** | 2026-05-14 |
| **Task blocked** | T0-06.5 (local Supabase bootstrap) |
| **Severity** | Blocking |
| **What** | Docker Desktop daemon was not running when `supabase start` was attempted. After launch attempt, Docker Desktop crashed with a `dockerd` panic / SIGBUS bus error. |

**Root cause:** Docker Desktop was installed but not started before the session. After manual launch attempt, the daemon crashed (likely WSL2 backend instability or corrupted Docker state).

**Resolution applied:** Windows restart. Docker Desktop started cleanly after restart. `docker version` and `docker ps` both succeed. No containers running.

**Status:** Resolved — 2026-05-14

---

### B-ENV-004 — Windows: Docker daemon TCP socket not exposed (vector/analytics failure)

| Field | Value |
| ----- | ----- |
| **Date identified** | 2026-05-14 |
| **Date resolved** | 2026-05-14 |
| **Task blocked** | T0-06.5 (local Supabase bootstrap) |
| **Severity** | Blocking |
| **What** | Vector (Supabase log aggregator) crash-looped on Windows because it requires the Docker daemon exposed on `tcp://localhost:2375`. Docker Desktop on Windows exposes the daemon via named pipe only by default. Vector exited cleanly (exit 0) and restarted indefinitely, causing `supabase start` to time out waiting for health checks. |

**Exact error (vector container logs):**
```
ERROR vector::sources::docker_logs: Listing currently running containers failed.
error=HyperLegacyError { err: hyper_util::client::legacy::Error(
  Connect, ConnectError("tcp connect error",
  Os { code: 111, kind: ConnectionRefused })) }
```

**Root cause:** Docker Desktop on Windows uses a named pipe for daemon communication. Vector's `docker_logs` source connects via TCP (`localhost:2375`). TCP not exposed → connection refused → vector exits → health check fails.

**Resolution applied:** Docker Desktop → Settings → General → enabled "Expose daemon on tcp://localhost:2375 without TLS" → Apply & Restart. Vector started successfully after this change.

**Note:** The Supabase CLI prints this warning on every Windows `supabase start` even after the setting is enabled — the warning is cosmetic once TCP is exposed.

**Status:** Resolved — 2026-05-14

---

### B-ENV-005 — Storage image corruption (SIGBUS-induced zero-byte server.js)

| Field | Value |
| ----- | ----- |
| **Date identified** | 2026-05-14 |
| **Date resolved** | 2026-05-14 |
| **Task blocked** | T0-06.5 (local Supabase bootstrap) |
| **Severity** | Blocking |
| **What** | `supabase/storage-api:v1.54.1` Docker image was corrupted by the original dockerd SIGBUS panic (B-ENV-001). The image was recorded as "present locally" in Docker's content store, so Supabase CLI skipped re-pulling it. The entry point `dist/start/server.js` inside the image was 0 bytes. Node ran an empty script, exited cleanly (exit 0), produced no output, and the container health check at `http://127.0.0.1:5000/status` never passed. |

**Diagnosis command:**
```
docker run --rm --entrypoint sh public.ecr.aws/supabase/storage-api:v1.54.1 -c "wc -c /app/dist/start/server.js"
# Output: 0 /app/dist/start/server.js
```

**Root cause:** Partial layer extraction during the SIGBUS crash left the image metadata intact but file content missing. Docker treated the image as valid and did not re-pull.

**Resolution applied:**
```
docker image rm public.ecr.aws/supabase/storage-api:v1.54.1
npx supabase@2.98.2 start   # re-pulled clean image (7934 bytes)
```

**Status:** Resolved — 2026-05-14
