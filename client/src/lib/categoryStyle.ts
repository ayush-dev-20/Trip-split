import {
  Utensils,
  Car,
  Building2,
  Map,
  ShoppingBag,
  Heart,
  Phone,
  Film,
  Coins,
  Package,
  type LucideIcon,
} from 'lucide-react';
import type { ExpenseCategory } from '@/types';

interface CategoryStyle {
  icon: LucideIcon;
  label: string;
  bg: string;
  fg: string;
}

export const CATEGORY_STYLES: Record<ExpenseCategory, CategoryStyle> = {
  FOOD:          { icon: Utensils,    label: 'Food',          bg: 'bg-orange-500/10 dark:bg-orange-500/15',  fg: 'text-orange-600 dark:text-orange-400' },
  TRANSPORT:     { icon: Car,         label: 'Transport',     bg: 'bg-blue-500/10 dark:bg-blue-500/15',      fg: 'text-blue-600 dark:text-blue-400' },
  ACCOMMODATION: { icon: Building2,   label: 'Accommodation', bg: 'bg-purple-500/10 dark:bg-purple-500/15',  fg: 'text-purple-600 dark:text-purple-400' },
  ACTIVITIES:    { icon: Map,         label: 'Activities',    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',fg: 'text-emerald-600 dark:text-emerald-400' },
  SHOPPING:      { icon: ShoppingBag, label: 'Shopping',      bg: 'bg-pink-500/10 dark:bg-pink-500/15',      fg: 'text-pink-600 dark:text-pink-400' },
  HEALTH:        { icon: Heart,       label: 'Health',        bg: 'bg-red-500/10 dark:bg-red-500/15',        fg: 'text-red-600 dark:text-red-400' },
  COMMUNICATION: { icon: Phone,       label: 'Communication', bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',      fg: 'text-cyan-600 dark:text-cyan-400' },
  ENTERTAINMENT: { icon: Film,        label: 'Entertainment', bg: 'bg-violet-500/10 dark:bg-violet-500/15',  fg: 'text-violet-600 dark:text-violet-400' },
  FEES:          { icon: Coins,       label: 'Fees',          bg: 'bg-amber-500/10 dark:bg-amber-500/15',    fg: 'text-amber-600 dark:text-amber-400' },
  MISCELLANEOUS: { icon: Package,     label: 'Other',         bg: 'bg-slate-500/10 dark:bg-slate-500/15',    fg: 'text-slate-600 dark:text-slate-400' },
};

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category as ExpenseCategory] ?? CATEGORY_STYLES.MISCELLANEOUS;
}
