import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo users
  const passwordHash = await bcrypt.hash('Password123', 12);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      passwordHash,
      preferredCurrency: 'USD',
      emailVerified: true,
      onboardingDone: true,
      subscription: { create: { tier: 'PRO', status: 'ACTIVE' } },
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      passwordHash,
      preferredCurrency: 'EUR',
      emailVerified: true,
      onboardingDone: true,
      subscription: { create: { tier: 'FREE', status: 'ACTIVE' } },
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      name: 'Charlie Davis',
      passwordHash,
      preferredCurrency: 'GBP',
      emailVerified: true,
      onboardingDone: true,
      subscription: { create: { tier: 'FREE', status: 'ACTIVE' } },
    },
  });

  // Create a group
  const group = await prisma.group.create({
    data: {
      name: 'College Friends',
      description: 'Our travel group from college!',
      defaultCurrency: 'USD',
      inviteCode: 'demo-group-001',
      members: {
        create: [
          { userId: alice.id, role: 'ADMIN' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: charlie.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Create a trip
  const trip = await prisma.trip.create({
    data: {
      name: 'Bali Adventure 2026',
      description: 'Our annual friends trip — this time to Bali! 🌴',
      destination: 'Bali, Indonesia',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-10'),
      status: 'UPCOMING',
      budget: 3000,
      budgetCurrency: 'USD',
      groupId: group.id,
      inviteCode: 'demo-trip-001',
      isPublic: true,
      members: {
        create: [
          { userId: alice.id, role: 'ADMIN' },
          { userId: bob.id, role: 'MEMBER' },
          { userId: charlie.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Create sample expenses
  const expenses = [
    {
      title: 'Airport taxi',
      amount: 45,
      category: 'TRANSPORT' as const,
      date: new Date('2026-04-01'),
      paidById: alice.id,
    },
    {
      title: 'Hotel check-in (3 nights)',
      amount: 450,
      category: 'ACCOMMODATION' as const,
      date: new Date('2026-04-01'),
      paidById: bob.id,
    },
    {
      title: 'Beach BBQ dinner',
      amount: 85,
      category: 'FOOD' as const,
      date: new Date('2026-04-02'),
      paidById: charlie.id,
    },
    {
      title: 'Scuba diving tour',
      amount: 210,
      category: 'ACTIVITIES' as const,
      date: new Date('2026-04-03'),
      paidById: alice.id,
    },
    {
      title: 'Lunch at Warung',
      amount: 25,
      category: 'FOOD' as const,
      date: new Date('2026-04-03'),
      paidById: bob.id,
    },
    {
      title: 'Souvenir shopping',
      amount: 60,
      category: 'SHOPPING' as const,
      date: new Date('2026-04-04'),
      paidById: charlie.id,
    },
  ];

  const memberIds = [alice.id, bob.id, charlie.id];

  for (const exp of expenses) {
    const perPerson = Math.round((exp.amount / 3) * 100) / 100;
    const remainder = Math.round((exp.amount - perPerson * 3) * 100) / 100;

    await prisma.expense.create({
      data: {
        title: exp.title,
        amount: exp.amount,
        currency: 'USD',
        exchangeRate: 1,
        baseAmount: exp.amount,
        category: exp.category,
        date: exp.date,
        splitType: 'EQUAL',
        tripId: trip.id,
        paidById: exp.paidById,
        splits: {
          create: memberIds.map((userId, idx) => ({
            userId,
            amount: idx === 0 ? perPerson + remainder : perPerson,
          })),
        },
      },
    });
  }

  console.log('✅ Seed completed!');
  console.log(`   👤 Users: ${alice.email}, ${bob.email}, ${charlie.email}`);
  console.log(`   👥 Group: ${group.name}`);
  console.log(`   ✈️  Trip: ${trip.name}`);
  console.log(`   💸 Expenses: ${expenses.length}`);
  console.log(`\n   🔑 Login with any email + password: Password123`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
