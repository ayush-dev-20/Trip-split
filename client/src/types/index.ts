// ─── Enums ───────────────────────────────────────────────
export type Role = 'ADMIN' | 'MEMBER';
export type TripStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'EXACT' | 'SHARES';
export type SubscriptionTier = 'FREE' | 'PRO' | 'TEAM';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
export type SettlementStatus = 'PENDING' | 'SETTLED' | 'DISPUTED';
export type PollStatus = 'OPEN' | 'CLOSED';

export type ExpenseCategory =
  | 'FOOD'
  | 'TRANSPORT'
  | 'ACCOMMODATION'
  | 'ACTIVITIES'
  | 'SHOPPING'
  | 'HEALTH'
  | 'COMMUNICATION'
  | 'ENTERTAINMENT'
  | 'FEES'
  | 'MISCELLANEOUS';

export type NotificationType =
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'SETTLEMENT_REQUESTED'
  | 'SETTLEMENT_CONFIRMED'
  | 'TRIP_INVITATION'
  | 'TRIP_STATUS_CHANGED'
  | 'GROUP_INVITATION'
  | 'COMMENT_ADDED'
  | 'MENTION'
  | 'REACTION'
  | 'POLL_CREATED'
  | 'BUDGET_WARNING'
  | 'GENERAL';

// ─── Models ──────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  preferredCurrency: string;
  tier: SubscriptionTier;
  onboardingDone: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyReport: boolean;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  inviteCode: string;
  createdById: string;
  createdBy?: User;
  members?: GroupMember[];
  trips?: Trip[];
  _count?: { members: number; trips: number };
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: Role;
  user?: User;
  joinedAt: string;
}

export interface Trip {
  id: string;
  name: string;
  description?: string;
  destination?: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  budgetCurrency: string;
  budgetAmount?: number;
  status: TripStatus;
  isPublic: boolean;
  inviteCode: string;
  groupId: string;
  createdById: string;
  group?: Group;
  createdBy?: User;
  members?: TripMember[];
  expenses?: Expense[];
  _count?: { members: number; expenses: number };
  totalSpent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripMember {
  id: string;
  userId: string;
  tripId: string;
  role: Role;
  user?: User;
  joinedAt: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  convertedAmount?: number;
  category: ExpenseCategory;
  description?: string;
  date: string;
  splitType: SplitType;
  tripId: string;
  paidById: string;
  paidBy?: User;
  trip?: Trip;
  splits?: ExpenseSplit[];
  receipts?: Receipt[];
  comments?: Comment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
  percentage?: number;
  shares?: number;
  user?: User;
}

export interface Receipt {
  id: string;
  expenseId: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface Settlement {
  id: string;
  tripId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  note?: string;
  settledAt?: string;
  fromUser?: User;
  toUser?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  expenseId: string;
  userId: string;
  user?: User;
  createdAt: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  expenseId: string;
  userId: string;
  user?: User;
}

export interface ChatMessage {
  id: string;
  content: string;
  tripId: string;
  userId: string;
  user?: User;
  replyToId?: string;
  replyTo?: ChatMessage;
  createdAt: string;
}

export interface Poll {
  id: string;
  question: string;
  tripId: string;
  createdById: string;
  createdBy?: User;
  status: PollStatus;
  options: PollOption[];
  createdAt: string;
  closedAt?: string;
}

export interface PollOption {
  id: string;
  text: string;
  pollId: string;
  votes?: PollVote[];
  _count?: { votes: number };
}

export interface PollVote {
  id: string;
  optionId: string;
  userId: string;
  user?: User;
}

export interface TripNote {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  tripId: string;
  userId: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface TripFeedPost {
  id: string;
  content: string;
  imageUrl?: string;
  tripId: string;
  userId: string;
  user?: User;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  userId: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
}

// ─── API Types ───────────────────────────────────────────
export interface ApiResponse<T> {
  status: 'success';
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  status: 'error';
  message: string;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  currency?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// ─── Analytics Types ─────────────────────────────────────
export interface TripAnalytics {
  summary: {
    totalSpent: number;
    remainingBudget: number | null;
    budget: number | null;
    highestExpense: { title: string; amount: number } | null;
    totalTransactions: number;
    avgDailySpend: number;
    currency: string;
  };
  categoryBreakdown: { category: string; total: number; count: number; percentage: number }[];
  dailySpending: { date: string; amount: number }[];
  budgetVsActual: { date: string; spent: number; cumulative: number; budget: number | null }[];
  perUser: { userId: string; name: string; paid: number; owes: number; net: number }[];
  spendingByDayOfWeek: { day: string; amount: number }[];
  topExpenses: { title: string; amount: number; category: string; paidBy: string; date: string }[];
  splitTypeDistribution: { type: string; count: number }[];
  settlementProgress: { settled: number; pending: number; disputed: number; total: number; outstanding: number; percentage: number };
  spendingVelocity: { dailyAverage: number; projectedTotal: number; daysElapsed: number };
}

export interface YearInReview {
  currency: string;
  totalTrips: number;
  totalSpent: number;
  totalExpenses: number;
  topCategory: string;
  monthlySpending: { month: string; amount: number }[];
  topDestinations: { destination: string; count: number }[];
  categoryBreakdown: Record<string, number>;
  avgPerTrip: number;
  destinationCount: number;
}

export interface CategoryTrend {
  category: string;
  months: { month: string; amount: number }[];
}

export interface UserExpenseItem {
  expenseId: string;
  expenseName: string;
  amount: number;          // user's personal share
  fullAmount: number;      // total expense amount
  category: string;
  date: string;
  currency: string;
  splitType: string;
  paidBy: { id: string; name: string };
  trip: { id: string; name: string };
}

export interface MyExpensesSummary {
  year: number;
  totalSpent: number;
  totalExpenses: number;
  expenses: UserExpenseItem[];
}

// ─── AI Types ────────────────────────────────────────────
export interface ReceiptScanResult {
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  description: string;
}

export interface TripPlan {
  itinerary: string;
}

export interface Checkpoint {
  id: string;
  tripId: string;
  title: string;
  description?: string | null;
  category?: string | null;
  estimatedCost?: number | null;
  day?: number | null;
  sortOrder: number;
  isVisited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedCheckpoint {
  title: string;
  description: string;
  category: string;
  estimatedCost: number;
  day: number;
}

export interface TripPlanWithCheckpoints {
  itinerary: string;
  suggestedCheckpoints: SuggestedCheckpoint[];
}

export interface NLPExpenseResult {
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string;
  splitType: SplitType;
}

// ─── Settlement/Balance Types ────────────────────────────
export interface Balance {
  user: { id: string; name: string; avatarUrl?: string };
  amount: number;
}

export interface SimplifiedDebt {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
}

export interface TripBalances {
  balances: Balance[];
  simplifiedDebts: SimplifiedDebt[];
  totalExpenses: number;
  totalSettled: number;
  currency: string;
}

export interface OverallDebtEntry {
  user: { id: string; name: string; avatarUrl?: string };
  amount: number;
  trips: { id: string; name: string }[];
}

export interface OverallBalances {
  iOwe: OverallDebtEntry[];
  owedToMe: OverallDebtEntry[];
}

export interface TripNote {
  id: string;
  tripId: string;
  userId: string;
  title: string;
  content: string;
  isPinned: boolean;
  user?: User;
  createdAt: string;
  updatedAt: string;
}
