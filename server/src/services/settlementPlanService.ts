import { prisma } from '../config/database';
import { buildBalanceSheet, Debt } from './settlementService';
import { notifyUsers } from './notificationService';
import { logger } from '../utils/logger';

type PlanScope = { tripId?: string; groupId?: string };

function scopeWhere(scope: PlanScope) {
  return scope.tripId ? { tripId: scope.tripId } : { groupId: scope.groupId };
}

/** Expenses that belong to this balance scope (group scope excludes trip expenses). */
function expenseWhere(scope: PlanScope) {
  return scope.tripId ? { tripId: scope.tripId } : { groupId: scope.groupId, tripId: null };
}

async function computeCurrentDebts(scope: PlanScope): Promise<Debt[]> {
  const [expenses, settled] = await Promise.all([
    prisma.expense.findMany({ where: expenseWhere(scope), include: { splits: true } }),
    prisma.settlement.findMany({ where: { ...scopeWhere(scope), status: 'SETTLED' } }),
  ]);
  const { simplifiedDebts } = buildBalanceSheet(
    expenses.map((e) => ({
      paidById: e.paidById,
      splitType: e.splitType,
      baseAmount: e.baseAmount,
      splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount, owedAmount: s.owedAmount })),
    })),
    settled
  );
  return simplifiedDebts;
}

async function scopeCurrency(scope: PlanScope): Promise<string> {
  if (scope.tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: scope.tripId },
      select: { budgetCurrency: true },
    });
    return trip?.budgetCurrency ?? 'USD';
  }
  const group = await prisma.group.findUnique({
    where: { id: scope.groupId },
    select: { defaultCurrency: true },
  });
  return group?.defaultCurrency ?? 'USD';
}

/**
 * Replace the scope's PENDING settlements with the given debts, in one transaction.
 * Returns the created settlements (with user includes).
 */
async function replacePendingWith(scope: PlanScope, debts: Debt[], currency: string) {
  const where = scopeWhere(scope);
  return prisma.$transaction(async (tx) => {
    await tx.settlement.deleteMany({ where: { ...where, status: 'PENDING', note: 'Settlement plan' } });
    if (debts.length === 0) return [];
    await tx.settlement.createMany({
      data: debts.map((d) => ({
        ...where,
        fromUserId: d.from,
        toUserId: d.to,
        amount: d.amount,
        currency,
        status: 'PENDING' as const,
        note: 'Settlement plan',
      })),
    });
    return tx.settlement.findMany({
      where: { ...where, status: 'PENDING' },
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  });
}

/**
 * Record (or re-record) the settlement plan for a scope. Always replaces the
 * current PENDING set with the live simplified-debt graph.
 */
export async function recordSettlementPlan(scope: PlanScope) {
  const debts = await computeCurrentDebts(scope);
  const currency = await scopeCurrency(scope);
  const created = await replacePendingWith(scope, debts, currency);

  await Promise.all(
    debts.map((d) =>
      notifyUsers([d.from], {
        type: 'SETTLEMENT_REQUEST',
        title: 'Settlement Request',
        message: `You owe ${created.find((c) => c.fromUserId === d.from && c.toUserId === d.to)?.toUser.name ?? 'a member'} ${d.amount.toFixed(2)} ${currency}`,
        data: { ...scopeWhere(scope) },
      })
    )
  );
  return created;
}

/**
 * Auto-refresh: if the scope has PENDING settlements, re-derive them from the
 * live graph. No-ops when there is no recorded plan or nothing changed.
 * Never throws — a failed refresh must not break the calling mutation.
 */
export async function refreshSettlementPlan(scope: PlanScope): Promise<void> {
  try {
    if (!scope.tripId && !scope.groupId) return;
    const where = scopeWhere(scope);
    const pending = await prisma.settlement.findMany({
      where: { ...where, status: 'PENDING', note: 'Settlement plan' },
    });
    if (pending.length === 0) return;

    const debts = await computeCurrentDebts(scope);

    const key = (from: string, to: string, amount: number) => `${from}->${to}:${amount.toFixed(2)}`;
    const oldSet = new Set(pending.map((p) => key(p.fromUserId, p.toUserId, p.amount)));
    const newSet = new Set(debts.map((d) => key(d.from, d.to, d.amount)));
    const unchanged = oldSet.size === newSet.size && [...oldSet].every((k) => newSet.has(k));
    if (unchanged) return;

    const currency = await scopeCurrency(scope);
    await replacePendingWith(scope, debts, currency);

    // Notify only debtors whose pair or amount changed.
    const changedDebtors = new Set<string>();
    for (const d of debts) {
      if (!oldSet.has(key(d.from, d.to, d.amount))) changedDebtors.add(d.from);
    }
    for (const p of pending) {
      if (!newSet.has(key(p.fromUserId, p.toUserId, p.amount))) changedDebtors.add(p.fromUserId);
    }
    if (changedDebtors.size > 0) {
      await notifyUsers([...changedDebtors], {
        type: 'SETTLEMENT_REQUEST',
        title: 'Settlement Updated',
        message: 'Balances changed — your settlement plan was updated automatically.',
        data: { ...where },
      });
    }
  } catch (err) {
    logger.error('SettlementPlan', 'refreshSettlementPlan failed', { error: String(err), scope });
  }
}
