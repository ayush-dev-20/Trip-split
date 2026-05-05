/**
 * db-clean.js — Wipes all data from every table in the correct dependency order.
 * Subscriptions, users, trips, expenses, settlements, social, audit — everything.
 *
 * WARNING: This is irreversible. Run only in development or staging environments.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('Starting database cleanup...\n');

  // Self-referential ChatMessage.replyToId must be nulled before deletion
  const nulledReplies = await prisma.chatMessage.updateMany({ data: { replyToId: null } });
  console.log(`  Nulled ${nulledReplies.count} chat message reply references`);

  // Delete in reverse dependency order (children → parents)
  const steps = [
    { label: 'AuditLog',      fn: () => prisma.auditLog.deleteMany() },
    { label: 'ActivityLog',   fn: () => prisma.activityLog.deleteMany() },
    { label: 'Notification',  fn: () => prisma.notification.deleteMany() },
    { label: 'PollVote',      fn: () => prisma.pollVote.deleteMany() },
    { label: 'PollOption',    fn: () => prisma.pollOption.deleteMany() },
    { label: 'Poll',          fn: () => prisma.poll.deleteMany() },
    { label: 'ChatMessage',   fn: () => prisma.chatMessage.deleteMany() },
    { label: 'TripFeedPost',  fn: () => prisma.tripFeedPost.deleteMany() },
    { label: 'TripNote',      fn: () => prisma.tripNote.deleteMany() },
    { label: 'Receipt',       fn: () => prisma.receipt.deleteMany() },
    { label: 'Comment',       fn: () => prisma.comment.deleteMany() },
    { label: 'Reaction',      fn: () => prisma.reaction.deleteMany() },
    { label: 'ExpenseSplit',  fn: () => prisma.expenseSplit.deleteMany() },
    { label: 'Expense',       fn: () => prisma.expense.deleteMany() },
    { label: 'Settlement',    fn: () => prisma.settlement.deleteMany() },
    { label: 'Checkpoint',    fn: () => prisma.checkpoint.deleteMany() },
    { label: 'TripMember',    fn: () => prisma.tripMember.deleteMany() },
    { label: 'Trip',          fn: () => prisma.trip.deleteMany() },
    { label: 'GroupMember',   fn: () => prisma.groupMember.deleteMany() },
    { label: 'Group',         fn: () => prisma.group.deleteMany() },
    { label: 'RefreshToken',  fn: () => prisma.refreshToken.deleteMany() },
    { label: 'Subscription',  fn: () => prisma.subscription.deleteMany() },
    { label: 'User',          fn: () => prisma.user.deleteMany() },
  ];

  for (const { label, fn } of steps) {
    const result = await fn();
    console.log(`  Deleted ${String(result.count).padStart(5)} ${label} rows`);
  }

  console.log('\nDatabase cleaned successfully. All tables are empty.');
}

cleanDatabase()
  .catch((err) => {
    console.error('\nCleanup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// To run this script:
//
//   npm run db:clean
//
// Or directly (from the repo root):
//
//   node scripts/db-clean.js
