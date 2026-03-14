# AutoFlow AI — Engine UI & Integrations Build Prompt

> Paste this entire file as context when starting a new session.
> It describes exactly what to build, how it should look, and the tech decisions already made.

---

## Project Context

- **App**: AutoFlow AI — AI-native workflow automation (competitor to n8n / Zapier but AI-first)
- **Stack**: Next.js 16 (App Router, Turbopack), Tailwind CSS v4, Prisma 7, Supabase PostgreSQL
- **Auth**: Custom JWT with httpOnly cookies — already complete
- **Dashboard shell**: Sidebar + header already built at `components/dashboard/`
- **Port**: Runs on `localhost:3001`
- **DO NOT** rebuild auth, dashboard shell, or anything in `app/(auth)/`

---

## What We Are Building Today

### 1. The Engine UI (`/dashboard/engine`)
### 2. Integrations Page (`/dashboard/integrations`)
### 3. Memory System Architecture
### 4. Agent Mascot Component

---

## 1. The Engine UI — Core Concept

### The Metaphor

Think of the AI agent as a **car engine**. The user doesn't need to know how the engine works internally. They interact with it through:

| Metaphor | What it actually is |
|---|---|
| **Fuel** | The user's prompt / task description |
| **Memory Tank** | Persistent context the agent remembers (Pinecone vectors + session DB) |
| **Engine Mods / Nitro** | Tools, APIs, MCPs that give the agent extra capabilities |
| **The Engine** | The AI agent (Claude) that processes everything |
| **Exhaust / Output** | The result, logs, generated content |

This is **NOT a chat UI**. It is an **engine control panel** where the user:
1. Loads fuel (writes the task)
2. Checks which mods are active (tools/integrations)
3. Loads memory (what to remember from before)
4. **Fires the engine** (runs the agent)
5. Watches it execute in real time

---

### The Agent Mascot

- A small **animated character** lives in the center of the engine panel
- Think: a glowing orb, a friendly slime creature, or a mini robot — **it reacts to engine state**
- **States**:
  - `idle` → character floats gently, breathing animation
  - `thinking` → character spins or pulses, "loading" glow
  - `running` → character vibrates/shakes with energy, engine sound wave animation
  - `success` → character jumps and sparkles
  - `error` → character turns red, shakes head
- Use **Lottie animations** (`npm install lottie-react`) for the character
- If no Lottie file, use CSS keyframe animations with an SVG slime/orb character
- The character should sit inside a **circular engine chamber** in the center of the page

---

### Engine UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │           ENGINE ROOM                         │
│             │                                               │
│             │  ┌──────────────────────────────────────┐    │
│             │  │         FUEL INPUT                   │    │
│             │  │  ┌──────────────────────────────┐   │    │
│             │  │  │  Describe your task...        │   │    │
│             │  │  │  (large textarea, glowing     │   │    │
│             │  │  │   border when focused)        │   │    │
│             │  │  └──────────────────────────────┘   │    │
│             │  │  [Memory Slots] [Active Mods]        │    │
│             │  └──────────────────────────────────────┘    │
│             │                                               │
│             │         ┌───────────────┐                     │
│             │         │  [AGENT GIF]  │                     │
│             │         │  slime/orb    │                     │
│             │         │  character   │                     │
│             │         └───────────────┘                     │
│             │         [  IGNITE ENGINE  ] ← big button      │
│             │                                               │
│             │  ┌──────────────────────────────────────┐    │
│             │  │         OUTPUT / EXHAUST              │    │
│             │  │  streaming logs + final result        │    │
│             │  └──────────────────────────────────────┘    │
│             │                                               │
│             │  [MEMORY PANEL]         [MODS PANEL]         │
│             │  pinned memories        active tools          │
└─────────────┴───────────────────────────────────────────────┘
```

---

### Engine UI — Detailed Sections

#### A. Fuel Input (Top)
```tsx
// Large dark textarea with glowing purple/blue border on focus
// Placeholder text: "Describe what you want the engine to do..."
// Below the textarea: two pill tags
//   [🧠 3 memories loaded]  [⚙️ 4 mods active]
// Both are clickable — open their respective side panels
```

#### B. Agent Chamber (Center)
```tsx
// Dark circular container (~200px) with inner glow ring
// The agent character animates based on engine state
// Below character: state label ("Ready" / "Thinking..." / "Running" / "Done")
// Pulsing ring animation always on (intensity changes by state)
```

#### C. Ignite Button
```tsx
// Full-width or large centered button
// Text: "IGNITE ENGINE" with a flame or lightning bolt icon
// On click → animates into loading state → calls /api/engine/run
// Color: deep purple to orange gradient (feels like ignition)
```

#### D. Output / Exhaust Panel (Below button)
```tsx
// Hidden when idle, slides up when engine runs
// Shows streaming text output (Server-Sent Events)
// Monospace font, dark background — looks like a terminal
// Each step prefixed: ✅ Step 1: Fetching data... / ❌ Step 3: API failed
// "Copy Output" and "Save to Memory" buttons appear when done
```

#### E. Memory Panel (Left side panel, slide-in)
```tsx
// Shows list of "memory chips" — past saved context
// Each chip: title, preview snippet, date, "load" toggle
// User can load multiple memories into the engine
// Loaded memories = part of the agent's system prompt context
// "Add Memory" button → opens text input to manually pin something
```

#### F. Mods Panel (Right side panel, slide-in)
```tsx
// Shows all connected integrations as mod cards
// Each mod: icon, name, on/off toggle
// Active mods are injected as tools the agent can use during run
// Categories: Web, Communication, Data, AI, Custom API
// "Add Mod" → goes to /dashboard/integrations
```

---

## 2. Memory System Architecture

### Recommendation: Two-Layer Memory

#### Layer 1 — Short-Term (Session Memory)
- Store in **PostgreSQL** (already on Supabase) — no extra service needed
- Table: `EngineMemory { id, userId, title, content, tags, pinned, createdAt }`
- Loaded into the agent's system prompt as context window text
- Max 5 memories loaded at once (context window budget)

#### Layer 2 — Long-Term Semantic Memory (Vector Search)
- Use **Pinecone** — user will provide API key
- Store: workflow results, agent outputs, user-provided facts
- On retrieval: embed the user's current prompt → find top-5 relevant memories → inject into context
- Package: `npm install @pinecone-database/pinecone`
- Also install: `npm install @ai-sdk/anthropic` for embeddings

#### Memory Flow
```
User writes prompt
     ↓
Embed prompt → search Pinecone → top 5 relevant memories
     ↓
+ Short-term pinned memories from PostgreSQL
     ↓
All injected into agent system prompt as [MEMORY CONTEXT]
     ↓
Agent has full context → executes task
     ↓
Output saved back to Pinecone as new memory
```

#### Environment Variables Needed
```env
PINECONE_API_KEY=          # from pinecone.io
PINECONE_INDEX_NAME=       # e.g. "autoflow-memory"
```

---

## 3. Integrations Page (`/dashboard/integrations`)

### Layout
```
┌─────────────────────────────────────────────────────┐
│  Integrations                                        │
│  Connect tools to supercharge your engine           │
│                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │YouTube│ │Gmail │ │Slack │ │HubSpt│ │Sheets│    │
│  │  ✅  │ │  ➕  │ │  ➕  │ │  ➕  │ │  ➕  │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
│                                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │WhatsApp│ │FB  │ │Notion│ │Airtbl│ │Custom│    │
│  │  ➕  │ │  ➕  │ │  ➕  │ │  ➕  │ │  API │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
└─────────────────────────────────────────────────────┘
```

### Integration Card Component
```tsx
// Each card shows:
// - Service logo/icon (colored SVG)
// - Service name
// - Short description (what it enables the agent to do)
// - Status badge: "Connected" (green) / "Not Connected" (gray)
// - Button: "Connect" or "Disconnect"
// - On "Connect" click → modal opens asking for API key OR OAuth flow

// Connected integrations show:
// - Last used date
// - "Test Connection" button
// - What the agent can do with it (e.g. "Send messages, Read contacts")
```

### Integration List (Build UI for all, implement gradually)

| Integration | Category | Auth Method | Agent Capabilities |
|---|---|---|---|
| YouTube Data API | Content | API Key | Fetch trends, search videos, get transcripts |
| Gmail | Communication | OAuth 2.0 | Send emails, read inbox, search |
| Slack | Communication | OAuth / Bot Token | Send messages, post to channel |
| HubSpot | CRM | API Key / OAuth | Create contacts, update deals, send emails |
| Facebook Pages | Social | OAuth | Post content, read page insights |
| WhatsApp Business | Messaging | Meta API Key | Send messages, use templates |
| Google Sheets | Data | OAuth / Service Account | Read/write rows, create sheets |
| Notion | Productivity | Integration Token | Create pages, update databases |
| Airtable | Data | API Key | Read/write records, search |
| Custom HTTP API | Custom | API Key + URL | Make any HTTP request with auth header |

### DB Schema for Integrations
```prisma
model Integration {
  id          String   @id @default(uuid())
  userId      String
  service     String   // "youtube", "gmail", "slack", etc.
  credentials Json     // encrypted { apiKey, accessToken, refreshToken }
  status      String   @default("connected") // connected | expired | error
  lastUsed    DateTime?
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, service])
  @@map("integrations")
}
```

---

## 4. API Routes to Build

```
POST   /api/engine/run              → run the agent with fuel + memory + active mods
GET    /api/engine/run/[runId]/stream → SSE stream of execution logs
POST   /api/engine/memory           → save a memory (text or from output)
GET    /api/engine/memory           → list user's memories
DELETE /api/engine/memory/[id]      → delete memory
POST   /api/engine/memory/search    → semantic search (Pinecone)

GET    /api/integrations            → list user's integrations
POST   /api/integrations            → connect new integration (save credentials)
DELETE /api/integrations/[service]  → disconnect integration
POST   /api/integrations/[service]/test → test if credentials work
```

---

## 5. Visual Design Language

- **Background**: Deep dark (`#0a0a0f`) — feels like a machine room at night
- **Engine chamber**: Dark card with subtle purple/blue inner glow
- **Fuel input**: Slightly lighter dark bg, glowing border on focus (`ring-purple-500`)
- **Active state colors**:
  - Idle → `#6366f1` (indigo)
  - Running → `#f97316` (orange, like actual combustion)
  - Success → `#22c55e` (green)
  - Error → `#ef4444` (red)
- **Mods/integrations**: Dark cards with colored service icon accent
- **Typography**: Monospace for output panel, sans-serif for everything else
- **Animations**: Subtle — glow pulses, the agent character, progress rings
- **Feel**: Powerful, technical, but not overwhelming — like a cockpit

---

## 6. Today's Build Order (Vibe Coding Session)

Execute in this exact order:

1. **Prisma schema** — add `EngineMemory` and `Integration` models → migrate
2. **Integrations page** — static UI with all 10 integration cards, connect modal (API key input)
3. **API: `POST /api/integrations`** — save encrypted credentials to DB
4. **API: `GET /api/integrations`** — return user's connected integrations
5. **Engine page shell** — `/dashboard/engine` layout with all sections
6. **Agent mascot component** — CSS animated SVG slime/orb with 4 states
7. **Fuel input** — textarea + memory/mods pill tags
8. **Memory panel** — slide-in panel, list memories, load toggle
9. **Mods panel** — slide-in panel, active integrations as toggles
10. **`POST /api/engine/run`** — take prompt + memory + mods → call Claude → stream response
11. **Output panel** — SSE streaming terminal-style output
12. **Save to memory** — button after run completes → saves output to `EngineMemory`
13. **Sidebar nav** — add "Engine" and "Integrations" links
14. **Update dashboard home** — CTA button "Open Engine" instead of generic cards

---

## 7. File Structure to Create

```
app/
  dashboard/
    engine/
      page.tsx              ← Engine UI main page
    integrations/
      page.tsx              ← Integrations gallery page

app/api/
  engine/
    run/
      route.ts              ← POST: run the agent
      [runId]/
        stream/
          route.ts          ← GET: SSE stream
  integrations/
    route.ts                ← GET + POST
    [service]/
      route.ts              ← DELETE
      test/
        route.ts            ← POST: test credentials

components/
  engine/
    agent-mascot.tsx        ← Animated character component
    fuel-input.tsx          ← Textarea + pills
    memory-panel.tsx        ← Slide-in memory drawer
    mods-panel.tsx          ← Slide-in mods drawer
    output-panel.tsx        ← Streaming terminal output
    engine-shell.tsx        ← Composes all engine parts
  integrations/
    integration-card.tsx    ← Single integration card
    connect-modal.tsx       ← API key input modal

lib/
  engine.ts                 ← Agent runner logic
  memory.ts                 ← PostgreSQL memory CRUD + Pinecone search
  integrations.ts           ← Credentials encryption/decryption + tool builders
  encryption.ts             ← AES-256 encrypt/decrypt for stored credentials
```

---

## 8. Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| AI SDK | `ai` + `@ai-sdk/anthropic` | Streaming, tool use, structured output |
| Long-term memory | Pinecone | User has key, semantic search |
| Short-term memory | PostgreSQL (`EngineMemory` table) | Already there, no extra service |
| Embeddings | `@ai-sdk/anthropic` (`claude` embed) or OpenAI `text-embedding-3-small` | Small, fast, cheap |
| Credential storage | AES-256 encrypted JSON in Postgres | Simple, no extra service |
| Streaming | Vercel AI SDK `streamText` + SSE | Native Next.js support |
| Canvas | REMOVED — replaced with Engine UI | Per user decision |

---

## 9. Environment Variables Needed (New)

```env
ANTHROPIC_API_KEY=          # Claude for agent + optional embeddings
PINECONE_API_KEY=           # Long-term vector memory
PINECONE_INDEX_NAME=        # e.g. "autoflow-memory"
ENCRYPTION_KEY=             # 32-char random string for AES-256 credential encryption
# Optional (for specific integrations)
YOUTUBE_API_KEY=            # YouTube Data API v3
```

---

## 10. Agent System Prompt Template

```
You are AutoFlow — an intelligent automation engine.

[MEMORY CONTEXT]
{{injected memories here}}

[ACTIVE TOOLS / MODS]
{{list of connected integrations and what they can do}}

[TASK]
{{user's fuel/prompt}}

Instructions:
- Break the task into steps
- Execute each step using the available tools
- Log each step as you complete it (prefix with: STEP: your message)
- When done, output: RESULT: final summary
- If you hit an error, output: ERROR: what failed and why
```

---

*This prompt file describes the complete Engine UI + Memory + Integrations build.*
*Auth is already done. Dashboard shell is done. Start from Prisma schema.*
