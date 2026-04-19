# Copilot Instructions — TripSplit

> These instructions give GitHub Copilot full context about this project so it can generate accurate, idiomatic code on every prompt.

---

## 1. Project Overview

**TripSplit** is a SaaS trip expense tracker that lets groups of travellers log, split, and settle shared expenses. It is organised as a **monorepo** with two workspaces:

| Folder | Role | Port |
|--------|------|------|
| `server/` | REST API backend | `3000` |
| `client/` | Single-page app frontend | `5173` |

The root `package.json` uses **concurrently** to run both workspaces in parallel via `npm run dev`.

---

## 2. Tech Stack

### Client (`client/`)

| Concern | Library |
|---------|---------|
| Framework | React 19 with TypeScript |
| Build tool | Vite 6 |
| Routing | React Router 7 (file: `App.tsx`) |
| State (server) | TanStack Query 5 (`hooks/` → `services/`) |
| State (client) | Zustand 5 (`stores/`) |
| UI components | **shadcn/ui** (New York style, CSS variables) |
| Styling | Tailwind CSS 3.4 + `tailwindcss-animate` |
| Icons | Lucide React |
| Animation | Framer Motion 11 |
| Charts | Recharts 2.15 |
| HTTP | Axios (single instance in `services/api.ts`) |

**Key conventions:**
- Path alias `@/` → `src/`.
- Every UI element must use **shadcn/ui** components (`Button`, `Card`, `Input`, `Dialog`, `Select`, etc.) — never raw HTML `<button>`, `<input>`, `<select>`, or custom CSS classes like `.btn-primary`, `.card`, `.input`.
- Use `cn()` from `@/lib/utils` (clsx + tailwind-merge) for conditional class names.
- Colour tokens are CSS variables: `bg-primary`, `text-muted-foreground`, `bg-muted`, `border-border`, `bg-card`, etc. Avoid hard-coded Tailwind grays (e.g. `text-gray-500`) — use semantic tokens instead.
- Dark mode is class-based (`darkMode: 'class'` in `tailwind.config.js`). Do not add explicit `dark:` variants for tokens that already adapt (e.g. `bg-background` already handles dark).
- Prefer `<Button asChild>` with `<Link>` for navigation buttons.
- Keep pages in `pages/<domain>/`, hooks in `hooks/`, services in `services/`, types in `types/index.ts`, stores in `stores/`.

### Server (`server/`)

| Concern | Library |
|---------|---------|
| Runtime | Node.js 22+ |
| Framework | Express 4 with TypeScript 5.x |
| ORM | Prisma 6 (schema at `prisma/schema.prisma`) |
| Database | PostgreSQL |
| Cache | Redis via ioredis |
| Auth | JWT (access + refresh tokens) + optional Google OAuth via Passport |
| Validation | Zod (schemas in `validators/index.ts`) |
| Payments | Stripe (lazy-initialised in `services/stripeService.ts`) |
| AI | OpenAI SDK (`services/aiService.ts`) |
| Logging | Custom structured logger (`utils/logger.ts`) |
| Error handling | `AppError` class (`utils/AppError.ts`) + global error handler middleware |

**Key conventions:**
- TypeScript is **stable 5.x** — do NOT use TypeScript beta/RC features.
- Config lives in `config/env.ts` (reads `.env`), `config/database.ts` (Prisma client), `config/plans.ts` (feature gates per tier).
- Routes follow REST: `routes/<domain>Routes.ts` → `controllers/<domain>Controller.ts`.
- All async route handlers are wrapped with `asyncHandler` from `utils/asyncHandler.ts`.
- Validation middleware: `validate(schema)` from `middleware/validate.ts` — pass the Zod schema.
- Auth middleware: `authenticate` from `middleware/authenticate.ts` — attaches `req.user` with `{ id, email, name, tier }`.
- Feature gating: `featureGate('featureName')` from `middleware/featureGate.ts` — checks user's subscription tier against `PLAN_LIMITS`.
- Use `logger.info()`, `logger.warn()`, `logger.error()`, `logger.debug()` from `utils/logger.ts` — never bare `console.log`.
- Throw `AppError.badRequest()`, `.unauthorized()`, `.forbidden()`, `.notFound()`, `.conflict()`, `.internal()` for operational errors.
- Prisma queries go directly in controllers (no separate repository layer).

---

## 3. Data Model (Prisma)

Core entities and their relationships:

```
User ──┬── GroupMember ── Group
       ├── TripMember ── Trip (optionally belongs to Group)
       ├── Expense (paidBy) ── ExpenseSplit (per user)
       ├── Settlement (from/to)
       ├── Comment, Reaction (on Expenses)
       ├── ChatMessage, PollVote, TripNote, TripFeedPost (social)
       ├── Notification
       ├── Subscription (Stripe billing)
       └── RefreshToken, AuditLog, ActivityLog
```

**Important relationships:**
- `Trip.groupId` is **optional** — trips can exist without a group.
- `Expense` belongs to a `Trip` and is paid by a `User`. Splits are stored in `ExpenseSplit`.
- `Settlement` tracks who pays whom; status: `PENDING` → `SETTLED` or `DISPUTED`.
- All enums: `Role`, `TripStatus`, `SplitType`, `ExpenseCategory`, `SubscriptionTier`, `SubscriptionStatus`, `SettlementStatus`, `NotificationType`, `PollStatus`, `AuditAction`.

---

## 4. API Routes

All routes are prefixed with `/api`:

| Prefix | Domain |
|--------|--------|
| `/api/auth` | Register, login, refresh, logout, Google OAuth, profile |
| `/api/groups` | CRUD groups, invite/join via code, manage members |
| `/api/trips` | CRUD trips, invite/join, change status, manage members |
| `/api/expenses` | CRUD expenses within a trip, split calculations |
| `/api/settlements` | Calculate balances, create/settle/dispute settlements |
| `/api/social` | Chat messages, polls, notes, feed posts, comments, reactions |
| `/api/analytics` | Spending breakdown, category analysis, trip stats |
| `/api/ai` | Receipt scanning, budget advice, spending insights, chatbot |
| `/api/billing` | Stripe checkout, portal, webhook |
| `/api/notifications` | List, mark read, preferences |

---

## 5. Client Architecture

```
src/
├── App.tsx              # All routes (React Router)
├── main.tsx             # Entry point (QueryClientProvider + BrowserRouter)
├── index.css            # CSS variables for shadcn theme
├── components/
│   ├── layout/          # AppLayout, AuthLayout, Header, Sidebar
│   └── ui/              # shadcn components + custom (LoadingSpinner, EmptyState, Modal)
├── hooks/               # TanStack Query hooks (useTrips, useExpenses, etc.)
├── services/            # Axios service modules (tripService, expenseService, etc.)
├── stores/              # Zustand stores (authStore, themeStore, notificationStore)
├── pages/               # Route pages grouped by domain
│   ├── auth/            # Login, Register, Onboarding
│   ├── trips/           # TripsPage, CreateTripPage, TripDetailPage
│   ├── groups/          # GroupsPage, GroupDetailPage
│   ├── expenses/        # ExpensesPage, CreateExpensePage, ExpenseDetailPage
│   ├── settlements/     # SettlementsPage
│   ├── analytics/       # AnalyticsPage
│   ├── ai/              # AIAssistantPage
│   └── settings/        # SettingsPage, BillingPage
├── types/index.ts       # All TypeScript interfaces and type aliases
└── lib/utils.ts         # cn() helper (clsx + tailwind-merge)
```

---

## 6. Subscription Tiers

| Feature | FREE | PRO | TEAM |
|---------|------|-----|------|
| Active trips | 2 | ∞ | ∞ |
| Members per trip | 5 | ∞ | ∞ |
| Split types | Equal only | All 4 | All 4 |
| Multi-currency | ✗ | ✓ | ✓ |
| AI receipt scanning | ✗ | ✓ | ✓ |
| AI chatbot & NLP | ✗ | ✗ | ✓ |
| Advanced analytics | ✗ | ✓ | ✓ |
| PDF/CSV export | ✗ | ✓ | ✓ |
| Group chat, polls | ✗ | ✓ | ✓ |
| Priority support | ✗ | ✗ | ✓ |

Feature gating is enforced server-side via `featureGate()` middleware reading `PLAN_LIMITS` from `config/plans.ts`.

---

## 7. Code Style Rules

### General
- **TypeScript strict mode** is enabled in both client and server.
- Prefer `const` over `let`. Never use `var`.
- Use early returns to reduce nesting.
- Destructure props and function arguments.
- Name files in PascalCase for components/pages, camelCase for everything else.

### Client-specific
- Hooks: prefix with `use`, one hook per domain (e.g. `useTrips` wraps all trip-related queries/mutations).
- Services: one file per domain, all functions use the shared `api` Axios instance.
- Components: prefer composition over prop drilling; use shadcn's slot pattern (`asChild`) where applicable.
- Forms: use `useState` for form state (no form library). Validate client-side before submission; server validates with Zod too.
- Loading states: use `<PageLoader />` for full-page, `<Skeleton />` for inline.
- Empty states: use `<EmptyState />` or inline with a muted icon + text.
- Animations: wrap lists in `motion.div` with stagger; use `AnimatePresence` for mount/unmount transitions.

### Server-specific
- Every route must have `authenticate` middleware (except auth routes and health check).
- Every mutation route must have `validate(schema)` middleware.
- Keep controllers thin — business logic can stay in controllers or move to `services/` for complex operations.
- Always return `{ success: true, data: ... }` for success and `{ success: false, error: { message, code, details? } }` for errors.
- Use `logger` for all server-side logging — never `console.log/warn/error`.

---

## 8. Environment & Setup

- **Database**: PostgreSQL (local via Homebrew or Docker).
- **Cache**: Redis (optional — gracefully degrades).
- **Environment variables**: `server/.env` (see `server/.env.example` for all keys).
- **Migrations**: `npx prisma migrate dev` (in `server/`).
- **Seed data**: `npx prisma db seed` — creates 3 test users (`alice@example.com`, `bob@example.com`, `charlie@example.com`, password: `Password123`).
- **Dev server**: `npm run dev` from root runs both client and server concurrently.

---

## 9. Do's and Don'ts

### ✅ Do
- Use shadcn/ui components for all UI elements.
- Use semantic Tailwind tokens (`text-muted-foreground`, `bg-card`, `border-border`).
- Use `cn()` for conditional classes.
- Use TanStack Query for all server state.
- Use Zustand only for truly client-side state (auth, theme, notifications).
- Validate with Zod on the server; match rules client-side for good UX.
- Handle loading, error, and empty states on every page.
- Use `AppError` static factories for server errors.
- Use `logger` for all server logging.

### ❌ Don't
- Don't use raw HTML elements when a shadcn equivalent exists.
- Don't use hard-coded colour classes (`text-gray-500`, `bg-blue-600`). Use tokens instead or scoped colours with context (e.g. `text-green-600` for success badges is fine).
- Don't use `console.log` on the server — use `logger`.
- Don't use TypeScript beta/RC — stay on stable 5.x.
- Don't make `groupId` required on trips — it's optional.
- Don't instantiate Stripe/OpenAI at module level — use lazy initialisation.
- Don't add `any` types without a comment explaining why.
- Don't write SQL — use Prisma's query builder.
