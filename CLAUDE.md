# TripSplit — Claude Code Context

> Read this every session. It contains everything you need to contribute correctly to this codebase.

---

## Project Overview

**TripSplit** is a SaaS trip expense tracker — groups of travellers log, split, and settle shared expenses. It is a **monorepo** with two workspaces:

| Folder     | Role             | Port   |
|------------|------------------|--------|
| `server/`  | REST API backend | `3000` |
| `client/`  | React SPA        | `5173` |

Run both together from root: `npm run dev`

---

## Tech Stack

### Client (`client/`)

| Concern        | Library                                  |
|----------------|------------------------------------------|
| Framework      | React 19 + TypeScript                    |
| Build          | Vite 6                                   |
| Routing        | React Router 7 (`src/App.tsx`)           |
| Server state   | TanStack Query 5 (`hooks/` + `services/`)|
| Client state   | Zustand 5 (`stores/`)                    |
| UI components  | **shadcn/ui** (New York style)           |
| Styling        | Tailwind CSS 3.4 (`tailwind.config.js`)  |
| Icons          | Lucide React                             |
| Animation      | Framer Motion 11                         |
| Charts         | Recharts 2.15                            |
| HTTP client    | Axios (`services/api.ts` — single instance) |

### Server (`server/`)

| Concern        | Library                                     |
|----------------|---------------------------------------------|
| Runtime        | Node.js 22+ with TypeScript 5.x (stable)    |
| Framework      | Express 4                                   |
| ORM            | Prisma 6 (`prisma/schema.prisma`)           |
| Database       | PostgreSQL 16 (Docker)                      |
| Cache          | Redis 7 via ioredis (Docker)                |
| Auth           | JWT access (15m) + refresh (7d, httpOnly cookie) + Google OAuth via Passport |
| Validation     | Zod (`validators/index.ts`)                 |
| Payments       | Stripe (lazy init in `services/stripeService.ts`) |
| AI             | Google Gemini via `@google/generative-ai` (`services/aiService.ts`) |
| Logging        | Custom structured logger (`utils/logger.ts`) |
| Error handling | `AppError` class + global error handler middleware |

---

## Folder Structure

### Server (`server/src/`)
```
config/
  env.ts          ← All env vars (read from .env via dotenv)
  database.ts     ← Prisma client singleton
  plans.ts        ← PLAN_LIMITS per subscription tier
controllers/      ← Route handlers (thin — Prisma queries live here)
middleware/
  authenticate.ts ← Attaches req.user = { id, email, name, tier }
  validate.ts     ← validate(zodSchema) middleware
  featureGate.ts  ← featureGate('featureName') — checks subscription tier
  rateLimiter.ts  ← express-rate-limit configs
  errorHandler.ts ← Global error handler
routes/           ← <domain>Routes.ts → maps to controllers
services/
  aiService.ts    ← Gemini AI calls
  auditService.ts ← logAudit(), logActivity()
  currencyService.ts ← convertCurrency()
  notificationService.ts ← notifyUsers()
  settlementService.ts  ← balance calculation logic
types/            ← Server-side TypeScript interfaces
utils/
  AppError.ts     ← AppError.badRequest/unauthorized/forbidden/notFound/conflict/internal
  asyncHandler.ts ← Wraps async route handlers
  helpers.ts      ← paginate(), paginationMeta(), roundCurrency()
  logger.ts       ← logger.info/warn/error/debug/request/response
validators/
  index.ts        ← All Zod schemas (register, login, trip, expense, etc.)
```

### Client (`client/src/`)
```
App.tsx           ← All React Router routes
main.tsx          ← Entry (QueryClientProvider + BrowserRouter)
index.css         ← CSS variables for shadcn theme
components/
  layout/         ← AppLayout, AuthLayout, Header, Sidebar
  ui/             ← shadcn components + custom (LoadingSpinner, EmptyState)
hooks/            ← TanStack Query hooks (useTrips, useExpenses, useGroups, etc.)
services/         ← Axios service modules per domain (tripService, expenseService, etc.)
stores/           ← Zustand (authStore, themeStore, notificationStore)
pages/
  auth/           ← LoginPage, RegisterPage, OnboardingPage
  trips/          ← TripsPage, CreateTripPage, TripDetailPage, EditTripPage
  groups/         ← GroupsPage, GroupDetailPage
  expenses/       ← ExpensesPage, CreateExpensePage, ExpenseDetailPage
  settlements/    ← SettlementsPage
  analytics/      ← AnalyticsPage
  ai/             ← AIAssistantPage
  settings/       ← SettingsPage, BillingPage
types/index.ts    ← All TypeScript interfaces and type aliases
lib/utils.ts      ← cn() helper (clsx + tailwind-merge)
```

---

## Data Model (Key Entities)

```
User
  ├── Subscription  (FREE | PRO | TEAM)
  ├── GroupMember → Group
  ├── TripMember  → Trip (groupId is OPTIONAL — trips can exist without a group)
  ├── Expense (paidBy) → ExpenseSplit (per user)
  ├── Settlement (fromUser / toUser)
  ├── Comment, Reaction (on Expenses)
  ├── ChatMessage, PollVote, TripNote, TripFeedPost
  ├── Notification
  └── RefreshToken, AuditLog, ActivityLog
```

**Enums:** `Role`, `TripStatus`, `SplitType`, `ExpenseCategory`, `SubscriptionTier`, `SubscriptionStatus`, `SettlementStatus`, `NotificationType`, `PollStatus`, `AuditAction`

**Split logic:** `ExpenseSplit.amount` = contribution (what the person actually paid), NOT what they owe. The settlement engine computes balances as `contribution − fair_share` per expense.

---

## API Routes (all prefixed `/api`)

| Prefix                 | Domain                                  |
|------------------------|-----------------------------------------|
| `/api/auth`            | Register, login, refresh, logout, Google OAuth, profile |
| `/api/groups`          | CRUD groups, invite/join via code       |
| `/api/trips`           | CRUD trips, invite/join, status, members|
| `/api/expenses`        | CRUD expenses, split calc, comments, reactions |
| `/api/settlements`     | Balances, create/settle/dispute         |
| `/api/social`          | Chat, polls, notes, feed posts          |
| `/api/analytics`       | Spending breakdown, category stats      |
| `/api/ai`              | Receipt scan, budget advice, chatbot    |
| `/api/billing`         | Stripe checkout, portal, webhook        |
| `/api/notifications`   | List, mark read, preferences            |
| `/api/trips/:id/checkpoints` | Trip itinerary checkpoints        |

All responses: `{ success: true, data: ... }` or `{ success: false, error: { message, code, details? } }`

---

## Subscription Tiers

| Feature              | FREE | PRO | TEAM |
|----------------------|------|-----|------|
| Active trips         | 2    | ∞   | ∞    |
| Members/trip         | 5    | ∞   | ∞    |
| Split types          | Equal only | All 4 | All 4 |
| Multi-currency       | ✗    | ✓   | ✓    |
| AI receipt scanning  | ✗    | ✓   | ✓    |
| AI chatbot & NLP     | ✗    | ✗   | ✓    |
| Advanced analytics   | ✗    | ✓   | ✓    |
| PDF/CSV export       | ✗    | ✓   | ✓    |
| Group chat & polls   | ✗    | ✓   | ✓    |

Feature gating is enforced **server-side** via `featureGate()` middleware reading `PLAN_LIMITS` from `config/plans.ts`.

---

## Coding Conventions

### General
- TypeScript **strict mode** is enabled everywhere. Never use `any` without a comment explaining why.
- Prefer `const` over `let`. Never use `var`.
- Use early returns to reduce nesting.
- Destructure props and function arguments.
- `PascalCase` for component/page files; `camelCase` for everything else.
- Path alias `@/` maps to `client/src/`. Always use it in client code.

### Client — Must Follow
- **Always use shadcn/ui components** — never raw `<button>`, `<input>`, `<select>`. Use `Button`, `Input`, `Select`, `Dialog`, `Card`, etc.
- Use `cn()` from `@/lib/utils` for all conditional class names.
- Use **CSS variable tokens** (`bg-primary`, `text-muted-foreground`, `bg-muted`, `border-border`, `bg-card`, `bg-background`, etc.) — avoid hard-coded Tailwind grays like `text-gray-500`.
- Dark mode is **class-based** — tokens like `bg-background` already handle dark. Don't add redundant `dark:` variants.
- Use `<Button asChild>` with `<Link>` for navigation buttons.
- **Server state** → TanStack Query hooks in `hooks/`. **Client state** → Zustand in `stores/`.
- All hooks are named `use<Domain>` (e.g. `useTrips`, `useExpenses`). One file per domain.
- Forms: `useState` for form state (no form library). Validate client-side before submitting.
- Loading: `<PageLoader />` for full-page, `<Skeleton />` for inline.
- Empty states: `<EmptyState />` or muted icon + text.
- Animations: `motion.div` with stagger on lists, `AnimatePresence` for mount/unmount.

### Server — Must Follow
- **Every route** needs `authenticate` middleware (except `/api/auth` and `/api/health`).
- **Every mutation route** needs `validate(zodSchema)` middleware.
- Wrap all async handlers with `asyncHandler()`.
- Use `logger.info/warn/error/debug()` — **never `console.log`**.
- Throw via `AppError` static factories: `.badRequest()`, `.unauthorized()`, `.forbidden()`, `.notFound()`, `.conflict()`, `.internal()`.
- Prisma queries live directly in controllers (no separate repository layer).
- Keep controllers thin; complex logic moves to `services/`.
- **TypeScript stable 5.x only** — do NOT use beta/RC features.
- Do NOT instantiate Stripe or AI clients at module level — use lazy initialisation.
- Do NOT write raw SQL — use Prisma's query builder.

---

## Environment Setup

```bash
# 1. Start DB & cache
docker compose up -d

# 2. Install dependencies
npm install                  # root
cd server && npm install
cd ../client && npm install

# 3. Run migrations
npm run db:migrate           # from root

# 4. Seed test data
npm run db:seed              # alice@example.com, bob@example.com, charlie@example.com (Password123)

# 5. Start dev servers
npm run dev                  # starts both client (5173) and server (3000)
```

Key env files: `server/.env` (copy from `server/.env.example`). Client env vars are Vite-prefixed (`VITE_*`).

---

## Common Pitfalls — Always Check These

1. **`groupId` on Trip is optional** — never make it required.
2. **`ExpenseSplit.amount` = contribution**, not what they owe. Don't confuse the two.
3. **Do not use TypeScript beta** — the project uses `^5.8.0` stable on the server.
4. **AI and Stripe** are lazy-initialised — check if the service is initialised before calling.
5. **Redis degrades gracefully** — rate limiter falls back to memory if Redis is unavailable.
6. **Invite codes** are `nanoid`-generated short strings, not UUIDs.
7. **Currency conversion** always happens before storing — `baseAmount` is always in the trip's `budgetCurrency`.
