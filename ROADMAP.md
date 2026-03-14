# AutoFlow AI — 30-Day Product Roadmap

> **Vision**: AI-native workflow automation platform where users describe automations in plain English and the AI generates, visualizes, and executes them instantly.

---

## Current State (Day 0)

| Feature | Status |
|---|---|
| Next.js 16 + Tailwind v4 scaffold | ✅ Done |
| Prisma 7 + Supabase PostgreSQL | ✅ Done |
| Auth system (signup, signin, OTP, reset password) | ✅ Done |
| Dashboard shell (sidebar, header, mobile responsive) | ✅ Done |
| Middleware (route protection) | ✅ Done |
| Reusable UI component library | ✅ Done |
| Database schema (User, Workflow, Otp, PasswordReset) | ✅ Done |

---

## Week 1 — Days 1–7: Workflow Foundation

> Goal: User can create, save, list, and delete workflows. No AI yet — just the data layer and UI scaffolding.

### Day 1 — Workflow Data Layer

- [ ] Extend Prisma schema: add `WorkflowStep`, `WorkflowRun`, `WorkflowRunLog` models
- [ ] Run migration: `npx prisma migrate dev --name workflow-steps`
- [ ] Create `lib/workflow.ts` — CRUD helpers (createWorkflow, getWorkflows, deleteWorkflow)
- [ ] API route: `GET /api/workflows` — list user's workflows
- [ ] API route: `POST /api/workflows` — create workflow
- [ ] API route: `DELETE /api/workflows/[id]` — delete workflow

### Day 2 — Workflow List Page

- [ ] `app/dashboard/workflows/page.tsx` — list all workflows (cards with name, status badge, date)
- [ ] Empty state illustration when no workflows exist
- [ ] Skeleton loading state
- [ ] Delete workflow with confirmation modal
- [ ] Update sidebar nav link to `/dashboard/workflows`

### Day 3 — Create Workflow Page (Shell)

- [ ] `app/dashboard/workflows/create/page.tsx` — multi-step form shell
- [ ] Step 1: Workflow name + description input
- [ ] Step 2: Describe automation in plain English (textarea placeholder for AI)
- [ ] Step indicator component (Step 1 of 3)
- [ ] "Save Draft" button → calls `POST /api/workflows`

### Day 4 — Workflow Detail Page

- [ ] `app/dashboard/workflows/[id]/page.tsx` — view single workflow
- [ ] Display workflow metadata (name, status, created date)
- [ ] Display workflow steps as a vertical timeline (placeholder nodes)
- [ ] Status badge: DRAFT / ACTIVE / COMPLETED / FAILED
- [ ] Edit name/description inline

### Day 5 — Workflow Run History

- [ ] API route: `GET /api/workflows/[id]/runs` — list run history
- [ ] `app/dashboard/workflows/[id]/runs/page.tsx` — run history table
- [ ] Run log detail drawer (slide-in panel)
- [ ] Status indicators: running spinner, success checkmark, failed X

### Day 6 — Settings Page

- [ ] `app/dashboard/settings/page.tsx` — user settings
- [ ] Update profile form (name, email display)
- [ ] Change password form (current + new + confirm)
- [ ] API route: `PATCH /api/user/profile`
- [ ] API route: `PATCH /api/user/password`
- [ ] Danger zone: Delete account with confirmation

### Day 7 — Polish + Review Week 1

- [ ] Consistent page titles and breadcrumbs across dashboard
- [ ] 404 page for unknown workflow IDs
- [ ] Handle unauthenticated API requests properly (401 responses)
- [ ] Run `npm run build` — fix any TypeScript errors
- [ ] Review mobile responsiveness across all new pages

---

## Week 2 — Days 8–14: AI Engine + Visual Workflow Editor

> Goal: User describes automation in natural language → AI generates structured JSON steps → visualized with React Flow.

### Day 8 — AI SDK Setup

- [ ] Install Vercel AI SDK: `npm install ai @ai-sdk/anthropic`
- [ ] Add `ANTHROPIC_API_KEY` to `.env` and `.env.example`
- [ ] Create `lib/ai-agent.ts` — system prompt + workflow JSON schema
- [ ] Define `WorkflowStepSchema` type (step name, description, tool, inputs, outputs)
- [ ] Test AI generation in isolation with a sample prompt

### Day 9 — Workflow Generation API

- [ ] API route: `POST /api/workflows/generate` — accepts user description, returns workflow JSON
- [ ] Structured output using Vercel AI SDK `generateObject()`
- [ ] Validate and sanitize AI output before saving
- [ ] Save generated steps to DB via `prisma.workflowStep.createMany()`
- [ ] Error handling: AI timeout, invalid JSON, rate limits

### Day 10 — React Flow Installation + Basic Canvas

- [ ] Install React Flow: `npm install @xyflow/react`
- [ ] Create `components/workflow/workflow-canvas.tsx` — React Flow canvas wrapper
- [ ] Custom node component: `components/workflow/step-node.tsx` (icon, title, description)
- [ ] Auto-layout nodes top-to-bottom using `elkjs` or manual calculation
- [ ] Render workflow steps from DB as connected nodes

### Day 11 — AI-Powered Create Workflow

- [ ] Connect create workflow form to `/api/workflows/generate`
- [ ] Loading state: animated "AI is thinking..." message while generating
- [ ] Display generated steps in React Flow canvas after generation
- [ ] "Regenerate" button to re-run AI with same prompt
- [ ] "Accept & Save" button to persist to database

### Day 12 — Node Types + Palette

- [ ] Define 6 node types: Trigger, HttpRequest, AIProcess, Filter, Transform, Output
- [ ] Color-code nodes by type
- [ ] Node detail panel (click node → side panel shows inputs/outputs)
- [ ] Edge labels showing data flow
- [ ] Read-only vs editable canvas modes

### Day 13 — Manual Workflow Editing

- [ ] Drag to reorder steps in the canvas
- [ ] Add new step node via "+" button between nodes
- [ ] Delete a step node (with edge reconnection)
- [ ] Edit step name/description inline
- [ ] Auto-save on change (debounced 1s)

### Day 14 — Polish + Review Week 2

- [ ] Ensure React Flow canvas is responsive (min-height, overflow)
- [ ] Export workflow JSON button (download as `.json`)
- [ ] Duplicate workflow feature
- [ ] Run `npm run build` — fix any TypeScript/React Flow type errors
- [ ] Performance: memoize React Flow nodes/edges

---

## Week 3 — Days 15–21: Integrations + Execution Engine

> Goal: Workflows can actually run. Build the execution engine and first set of real integrations.

### Day 15 — Workflow Execution Engine

- [ ] Create `lib/workflow-engine.ts` — step-by-step executor
- [ ] Execution context object (pass data between steps)
- [ ] API route: `POST /api/workflows/[id]/run` — trigger execution
- [ ] Create `WorkflowRun` record with status RUNNING
- [ ] Execute steps sequentially, write logs per step
- [ ] Mark run as COMPLETED or FAILED with error message

### Day 16 — Integration: HTTP Request Tool

- [ ] Tool: `fetch_url` — make HTTP GET/POST to any URL
- [ ] Input schema: url, method, headers, body
- [ ] Output: response status, body (parsed JSON or text)
- [ ] Handle timeouts (5s max per step)
- [ ] Sanitize URLs (no internal network calls)

### Day 17 — Integration: AI Content Generator Tool

- [ ] Tool: `ai_generate` — generate text using Claude
- [ ] Input schema: prompt, max_tokens, tone
- [ ] Output: generated text
- [ ] Stream response to client via Server-Sent Events
- [ ] Token usage tracking per workflow run

### Day 18 — Integration: Email Tool

- [ ] Tool: `send_email` — send email via nodemailer (already configured)
- [ ] Input schema: to, subject, body (HTML supported)
- [ ] Add `app/dashboard/settings/integrations/page.tsx` — SMTP config per user
- [ ] Store user SMTP credentials encrypted in DB
- [ ] Test email button in settings

### Day 19 — Integration: YouTube Trends Tool

- [ ] Tool: `fetch_youtube_trends` — fetch trending videos via YouTube Data API v3
- [ ] Add `YOUTUBE_API_KEY` to `.env`
- [ ] Input schema: region code, category, max results
- [ ] Output: array of { title, views, url, description }
- [ ] Cache results for 1 hour (avoid quota burn)

### Day 20 — Live Execution UI

- [ ] Real-time execution status on workflow canvas (node highlight as it runs)
- [ ] Use Server-Sent Events (`/api/workflows/[id]/run/stream`)
- [ ] Step nodes turn green (completed) / red (failed) during run
- [ ] Live log panel below canvas (scrolling output)
- [ ] "Stop Run" button — mark run as CANCELLED

### Day 21 — Polish + Review Week 3

- [ ] Rate limiting on `/api/workflows/[id]/run` (max 10 runs/hour per user)
- [ ] Webhook trigger: `POST /api/webhooks/[workflowId]` — run workflow via external call
- [ ] Webhook URL display in workflow settings
- [ ] Run `npm run build` — zero errors
- [ ] Write integration tests for execution engine

---

## Week 4 — Days 22–28: Analytics, Polish & Production

> Goal: Make the product feel complete, production-ready, and demo-worthy.

### Day 22 — Dashboard Analytics

- [ ] Dashboard home: real metrics (total workflows, total runs, success rate, last run)
- [ ] `GET /api/analytics/summary` — aggregate stats for current user
- [ ] Mini sparkline charts (recharts or chart.js)
- [ ] "Recent Activity" feed (last 5 runs with status)
- [ ] Quick action: "New Workflow" prominent CTA button

### Day 23 — Workflow Templates

- [ ] Define 5 starter templates in `lib/templates.ts`
  - YouTube Shorts Generator
  - Lead Follow-up Email
  - Daily News Digest
  - Content Repurposer
  - API Health Monitor
- [ ] `app/dashboard/templates/page.tsx` — template gallery
- [ ] "Use Template" button → pre-fills create workflow form
- [ ] Template preview (read-only React Flow canvas)

### Day 24 — Notifications System

- [ ] DB model: `Notification` (userId, type, message, read, createdAt)
- [ ] API: `GET /api/notifications`, `PATCH /api/notifications/[id]/read`
- [ ] Bell icon in header with unread count badge
- [ ] Notification dropdown (mark all read, last 10 items)
- [ ] Auto-notify on workflow run completion/failure

### Day 25 — API Key Management

- [ ] DB model: `ApiKey` (userId, name, key hash, lastUsed, createdAt)
- [ ] `app/dashboard/settings/api-keys/page.tsx` — list + create + revoke keys
- [ ] `POST /api/user/api-keys` — generate new key (show once)
- [ ] Authenticate webhook triggers via API key in header
- [ ] Copy-to-clipboard key display with mask

### Day 26 — Error Handling + Empty States

- [ ] Global error boundary (`app/error.tsx`)
- [ ] App-wide loading skeleton (`app/loading.tsx`)
- [ ] Empty states for: workflows list, run history, notifications
- [ ] Friendly error pages for 404, 500, unauthorized
- [ ] Toast notifications for all async actions across the dashboard

### Day 27 — Performance + SEO

- [ ] Add `loading.tsx` to all dashboard route segments
- [ ] Lazy load React Flow canvas component
- [ ] Add `next/image` where applicable
- [ ] Optimize fonts (already using Geist via `next/font`)
- [ ] Add Open Graph metadata to auth and landing pages

### Day 28 — Production Deployment

- [ ] Create `vercel.json` with environment variable references
- [ ] Add all env vars to Vercel project settings
- [ ] Run `npx prisma migrate deploy` for production DB
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Smoke test all critical flows on production URL
- [ ] Set up Vercel deployment preview for `main` branch

---

## Days 29–30 — Buffer + Launch

### Day 29 — Bug Bash

- [ ] Full end-to-end manual test of all user flows
- [ ] Fix any bugs found during testing
- [ ] Cross-browser test (Chrome, Firefox, Safari)
- [ ] Mobile device test (iOS Safari, Android Chrome)
- [ ] Accessibility: keyboard navigation, screen reader labels

### Day 30 — Demo & Documentation

- [ ] Record a 2-minute demo video (screen capture)
- [ ] Update `README.md` with setup instructions, env vars, deployment steps
- [ ] Write the pitch: *"Automation platforms like n8n require manual workflows. AutoFlow AI generates them from plain English in 30 seconds."*
- [ ] Final production deploy
- [ ] Share live URL

---

## Feature Priority Matrix

| Feature | Impact | Effort | Priority |
|---|---|---|---|
| AI workflow generation | Very High | Medium | P0 |
| React Flow visual canvas | Very High | High | P0 |
| Workflow execution engine | Very High | High | P0 |
| Workflow templates | High | Low | P1 |
| YouTube + Email integrations | High | Medium | P1 |
| Live execution UI | High | Medium | P1 |
| Dashboard analytics | Medium | Low | P2 |
| Notifications system | Medium | Medium | P2 |
| API key management | Medium | Medium | P2 |
| Webhook triggers | Medium | Low | P2 |

---

## Tech Stack Additions (Weeks 2–4)

| Package | Purpose |
|---|---|
| `ai` + `@ai-sdk/anthropic` | Vercel AI SDK for Claude integration |
| `@xyflow/react` | React Flow visual workflow editor |
| `recharts` | Analytics charts on dashboard |
| `elkjs` | Auto-layout for workflow nodes |
| `zod` | Runtime schema validation for AI output |

---

## Environment Variables Needed

```env
# Already set
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
NEXT_PUBLIC_APP_URL=

# To add
ANTHROPIC_API_KEY=        # Week 2, Day 8
YOUTUBE_API_KEY=          # Week 3, Day 19
```

---

*Last updated: Day 0 — Auth + Dashboard complete. Starting Week 1.*
