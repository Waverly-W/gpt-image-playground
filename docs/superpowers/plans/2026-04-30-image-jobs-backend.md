# Image Jobs Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move recoverable image generation state from browser memory/localStorage into a SQLite-backed server job model.

**Architecture:** Add an `image_jobs` table and a focused `src/lib/image-jobs.ts` repository for create/list/status transitions. Add job API routes that create a job, run non-streaming generation in the background, and let the client poll after refresh. Keep `/api/images` for direct streaming compatibility.

**Tech Stack:** Next.js route handlers, better-sqlite3, existing OpenAI image storage helpers, React polling.

---

### Task 1: Server Job Repository

**Files:**
- Modify: `src/lib/sqlite-db.ts`
- Create: `src/lib/image-jobs.ts`
- Test: `tests/image-jobs.test.mjs`

- [ ] Write failing tests for creating, completing, failing, and listing user-scoped jobs.
- [ ] Add `image_jobs` migration.
- [ ] Implement repository functions with JSON columns for params, images, usage, and cost.
- [ ] Run `npm test -- tests/image-jobs.test.mjs`.

### Task 2: Non-Streaming Generation Service

**Files:**
- Create: `src/lib/image-generation-service.ts`
- Modify: `src/app/api/images/route.ts`

- [ ] Extract non-streaming generate/edit behavior from `/api/images` into a reusable service.
- [ ] Keep existing `/api/images` response shape unchanged for non-streaming callers.
- [ ] Leave existing streaming code in `/api/images`.

### Task 3: Job API

**Files:**
- Create: `src/app/api/image-jobs/route.ts`
- Create: `src/app/api/image-jobs/[id]/route.ts`

- [ ] Add `POST /api/image-jobs` to create a job and start background generation.
- [ ] Add `GET /api/image-jobs` for current-user job history.
- [ ] Add `GET /api/image-jobs/[id]` for polling one job.
- [ ] Return only jobs owned by the authenticated user.

### Task 4: Frontend Integration

**Files:**
- Modify: `src/app/playground-client.tsx`
- Modify: `src/components/history-panel.tsx`

- [ ] Load server jobs on mount and map completed jobs into the existing history view.
- [ ] Submit non-streaming requests through `/api/image-jobs`.
- [ ] Poll running jobs and update output/history when jobs complete or fail.
- [ ] Keep streaming submissions on `/api/images` for live partial previews.

### Task 5: Verification

**Files:**
- Existing test suite

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Inspect `git diff` for accidental unrelated changes.
