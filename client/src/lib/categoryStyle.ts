import {
  Utensils,
  UtensilsCrossed,
  ShoppingCart,
  Car,
  Fuel,
  House,
  Zap,
  ShieldCheck,
  Landmark,
  Repeat,
  TrendingUp,
  Stethoscope,
  Scissors,
  GraduationCap,
  ShoppingBag,
  Film,
  Gift,
  Building2,
  Map,
  Package,
  type LucideIcon,
} from 'lucide-react';
import type { ExpenseCategory } from '@/types';

interface CategoryStyle {
  icon: LucideIcon;
  label: string;
  bg: string;
  fg: string;
  /** Hex used by Recharts, which can't read Tailwind classes. */
  chart: string;
}

/**
 * Single source of truth for expense categories — icon, label, badge colours and
 * chart colour all live here, and `ALL_CATEGORIES` derives its order from it.
 *
 * Key order is deliberate: it drives every category picker and filter in the app,
 * grouped everyday → travel → fallback rather than alphabetically.
 */
export const CATEGORY_STYLES: Record<ExpenseCategory, CategoryStyle> = {
  // Everyday
  FOOD:           { icon: Utensils,        label: 'Food',        bg: 'bg-orange-500/10 dark:bg-orange-500/15',   fg: 'text-orange-600 dark:text-orange-400',   chart: '#ea580c' },
  DINING:         { icon: UtensilsCrossed, label: 'Dining Out',  bg: 'bg-lime-500/10 dark:bg-lime-500/15',       fg: 'text-lime-600 dark:text-lime-400',       chart: '#65a30d' },
  GROCERIES:      { icon: ShoppingCart,    label: 'Groceries',   bg: 'bg-green-500/10 dark:bg-green-500/15',     fg: 'text-green-600 dark:text-green-400',     chart: '#16a34a' },

  // Getting around
  TRANSPORT:      { icon: Car,             label: 'Transport',   bg: 'bg-blue-500/10 dark:bg-blue-500/15',       fg: 'text-blue-600 dark:text-blue-400',       chart: '#2563eb' },
  FUEL:           { icon: Fuel,            label: 'Fuel',        bg: 'bg-stone-500/10 dark:bg-stone-500/15',     fg: 'text-stone-600 dark:text-stone-400',     chart: '#78716c' },

  // Home & bills
  RENT:           { icon: House,           label: 'Rent',        bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',   fg: 'text-indigo-600 dark:text-indigo-400',   chart: '#4f46e5' },
  UTILITIES:      { icon: Zap,             label: 'Utilities',   bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',       fg: 'text-cyan-600 dark:text-cyan-400',       chart: '#0891b2' },

  // Financial commitments
  INSURANCE:      { icon: ShieldCheck,     label: 'Insurance',   bg: 'bg-teal-500/10 dark:bg-teal-500/15',       fg: 'text-teal-600 dark:text-teal-400',       chart: '#0d9488' },
  LOAN_REPAYMENT: { icon: Landmark,        label: 'Loan / EMI',  bg: 'bg-rose-500/10 dark:bg-rose-500/15',       fg: 'text-rose-600 dark:text-rose-400',       chart: '#e11d48' },
  SUBSCRIPTION:   { icon: Repeat,          label: 'Subscription', bg: 'bg-amber-500/10 dark:bg-amber-500/15',    fg: 'text-amber-600 dark:text-amber-400',     chart: '#d97706' },
  INVESTMENT:     { icon: TrendingUp,      label: 'Investment',  bg: 'bg-emerald-700/10 dark:bg-emerald-700/20', fg: 'text-emerald-700 dark:text-emerald-400', chart: '#065f46' },

  // Life
  MEDICAL:        { icon: Stethoscope,     label: 'Medical',     bg: 'bg-red-500/10 dark:bg-red-500/15',         fg: 'text-red-600 dark:text-red-400',         chart: '#dc2626' },
  PERSONAL_CARE:  { icon: Scissors,        label: 'Personal Care', bg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15', fg: 'text-fuchsia-600 dark:text-fuchsia-400', chart: '#c026d3' },
  EDUCATION:      { icon: GraduationCap,   label: 'Education',   bg: 'bg-sky-500/10 dark:bg-sky-500/15',         fg: 'text-sky-600 dark:text-sky-400',         chart: '#0284c7' },
  SHOPPING:       { icon: ShoppingBag,     label: 'Shopping',    bg: 'bg-pink-500/10 dark:bg-pink-500/15',       fg: 'text-pink-600 dark:text-pink-400',       chart: '#db2777' },
  ENTERTAINMENT:  { icon: Film,            label: 'Entertainment', bg: 'bg-violet-500/10 dark:bg-violet-500/15', fg: 'text-violet-600 dark:text-violet-400',   chart: '#7c3aed' },
  GIFTING:        { icon: Gift,            label: 'Gifting',     bg: 'bg-yellow-500/10 dark:bg-yellow-500/15',   fg: 'text-yellow-600 dark:text-yellow-400',   chart: '#ca8a04' },

  // Travel
  ACCOMMODATION:  { icon: Building2,       label: 'Accommodation', bg: 'bg-purple-500/10 dark:bg-purple-500/15', fg: 'text-purple-600 dark:text-purple-400',   chart: '#9333ea' },
  ACTIVITIES:     { icon: Map,             label: 'Activities',  bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', fg: 'text-emerald-600 dark:text-emerald-400', chart: '#059669' },

  // Fallback
  MISCELLANEOUS:  { icon: Package,         label: 'Other',       bg: 'bg-slate-500/10 dark:bg-slate-500/15',     fg: 'text-slate-600 dark:text-slate-400',     chart: '#64748b' },
};

/**
 * Every category, in display order. Import this instead of hand-writing a list —
 * category lists used to be duplicated across pages, which is how GROCERIES ended
 * up missing from the trip expense filter.
 */
export const ALL_CATEGORIES = Object.keys(CATEGORY_STYLES) as ExpenseCategory[];

/** Hex colour per category, for chart libraries. */
export const CATEGORY_CHART_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_STYLES).map(([key, style]) => [key, style.chart])
);

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category as ExpenseCategory] ?? CATEGORY_STYLES.MISCELLANEOUS;
}
