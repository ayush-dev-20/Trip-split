import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

// ──────────────────────────────────
// Helpers
// ──────────────────────────────────

/** Express params may be string | string[] — always take the first value. */
function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

function fmtDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ──────────────────────────────────
// CSV Export
// ──────────────────────────────────

export const exportTripCSV = asyncHandler(async (req: Request, res: Response) => {
  const tripId = param(req.params.tripId);
  const userId = req.user!.id;

  const member = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  if (!member) throw AppError.forbidden('Not a member of this trip');

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
  });
  if (!trip) throw AppError.notFound('Trip not found');

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      paidBy: { select: { name: true, email: true } },
      splits: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { date: 'asc' },
  });

  const rows: string[] = [
    'Date,Title,Category,Amount,Currency,Base Amount,Paid By,Split Type,Participants',
  ];

  for (const expense of expenses) {
    const participants = expense.splits.map((s) => s.user.name).join(' | ');
    const row = [
      new Date(expense.date).toISOString().split('T')[0],
      `"${expense.title.replace(/"/g, '""')}"`,
      expense.category,
      expense.amount.toFixed(2),
      expense.currency,
      expense.baseAmount.toFixed(2),
      `"${expense.paidBy.name}"`,
      expense.splitType,
      `"${participants}"`,
    ].join(',');
    rows.push(row);
  }

  const csv = rows.join('\n');
  const filename = `${trip.name.replace(/[^a-z0-9]/gi, '_')}_expenses.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// ──────────────────────────────────
// PDF Export
// ──────────────────────────────────

export const exportTripPDF = asyncHandler(async (req: Request, res: Response) => {
  const tripId = param(req.params.tripId);
  const userId = req.user!.id;

  const member = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  if (!member) throw AppError.forbidden('Not a member of this trip');

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw AppError.notFound('Trip not found');

  const [members, expenses, settlements] = await Promise.all([
    prisma.tripMember.findMany({
      where: { tripId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.expense.findMany({
      where: { tripId },
      include: {
        paidBy: { select: { name: true } },
        splits: { include: { user: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.settlement.findMany({
      where: { tripId, status: { not: 'DISPUTED' } },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
      },
    }),
  ]);

  // Lazy-load pdfkit to keep startup fast
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  const filename = `${trip.name.replace(/[^a-z0-9]/gi, '_')}_report.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // ── Cover ────────────────────────────────────────────────────────────────────
  doc.fontSize(26).font('Helvetica-Bold').text('TripSplit', { align: 'center' });
  doc.fontSize(18).font('Helvetica').text('Trip Expense Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(trip.name, { align: 'center' });
  if (trip.destination) {
    doc.fontSize(12).fillColor('#666').text(trip.destination, { align: 'center' });
  }
  doc
    .fontSize(11)
    .fillColor('#666')
    .text(`${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}`, { align: 'center' });
  doc.fillColor('#000').moveDown(2);

  // ── Members ──────────────────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold').text('Members');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica');
  for (const m of members) {
    doc.text(`• ${m.user.name} (${m.user.email})  [${m.role}]`);
  }
  doc.moveDown();

  // ── Expenses ─────────────────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold').text('Expenses');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
  doc.moveDown(0.5);

  const totalBase = expenses.reduce((s, e) => s + e.baseAmount, 0);

  for (const expense of expenses) {
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(`${fmtDate(expense.date)}  ${expense.title}`, { continued: true });
    doc
      .font('Helvetica')
      .text(`  ${expense.amount.toFixed(2)} ${expense.currency}`, { align: 'right' });
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(`Paid by ${expense.paidBy.name} · ${expense.category} · ${expense.splitType}`);
    doc.fillColor('#000').moveDown(0.3);
  }

  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`Total: ${totalBase.toFixed(2)} ${trip.budgetCurrency}`, { align: 'right' });
  if (trip.budget) {
    const remaining = trip.budget - totalBase;
    doc
      .fontSize(11)
      .font('Helvetica')
      .text(
        `Budget: ${trip.budget.toFixed(2)} ${trip.budgetCurrency}  |  Remaining: ${remaining.toFixed(2)} ${trip.budgetCurrency}`,
        { align: 'right' }
      );
  }
  doc.moveDown();

  // ── Settlements ───────────────────────────────────────────────────────────────
  if (settlements.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('Settlements');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    for (const s of settlements) {
      const statusLabel = s.status === 'SETTLED' ? '✓ Settled' : '⏳ Pending';
      doc.text(
        `${s.fromUser.name} → ${s.toUser.name}  ${s.amount.toFixed(2)} ${s.currency}  [${statusLabel}]`
      );
    }
  }

  doc.end();
});
