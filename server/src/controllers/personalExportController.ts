import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';

function fmtDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildPersonalExportWhere(userId: string, req: Request) {
  const startDate = req.query.startDate as string | undefined;
  const endDate   = req.query.endDate   as string | undefined;
  const category  = req.query.category  as string | undefined;

  const where: Record<string, unknown> = { paidById: userId, tripId: null };
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate   ? { lte: new Date(endDate)   } : {}),
    };
  }
  if (category) where.category = category;
  return where;
}

// ──────────────────────────────────
// CSV Export
// ──────────────────────────────────

export const exportPersonalCSV = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const where = buildPersonalExportWhere(userId, req);

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'asc' } });

  const rows: string[] = ['Date,Title,Category,Amount,Currency,Base Amount,Recurring'];
  for (const e of expenses) {
    const recurringLabel = e.isRecurring ? (e.recurringPattern ?? 'yes') : 'no';
    const row = [
      e.date.toISOString().split('T')[0],
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.amount.toFixed(2),
      e.currency,
      e.baseAmount.toFixed(2),
      `"${recurringLabel.replace(/"/g, '""')}"`,
    ].join(',');
    rows.push(row);
  }

  const csv = rows.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="personal_expenses.csv"');
  res.send(csv);
});

// ──────────────────────────────────
// PDF Export
// ──────────────────────────────────

export const exportPersonalPDF = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const where = buildPersonalExportWhere(userId, req);

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'asc' } });

  // Lazy-load pdfkit to keep startup fast
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="personal_expenses.pdf"');
  doc.pipe(res);

  // ── Cover ────────────────────────────────────────────────────────────────────
  doc.fontSize(26).font('Helvetica-Bold').text('TripSplit', { align: 'center' });
  doc.fontSize(18).font('Helvetica').text('Personal Expense Report', { align: 'center' });
  doc.moveDown();

  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam   = req.query.endDate   as string | undefined;
  if (startDateParam || endDateParam) {
    doc
      .fontSize(11)
      .fillColor('#666')
      .text(
        `${startDateParam ? fmtDate(new Date(startDateParam)) : 'All time'} – ${endDateParam ? fmtDate(new Date(endDateParam)) : 'today'}`,
        { align: 'center' }
      );
  }
  doc.fillColor('#000').moveDown(2);

  // ── Expenses ─────────────────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold').text('Expenses');
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#ddd');
  doc.moveDown(0.5);

  const total = expenses.reduce((s, e) => s + e.baseAmount, 0);

  for (const e of expenses) {
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(`${fmtDate(e.date)}  ${e.title}`, { continued: true });
    doc
      .font('Helvetica')
      .text(`  ${e.amount.toFixed(2)} ${e.currency}`, { align: 'right' });
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(e.category + (e.isRecurring ? ` · recurring (${e.recurringPattern ?? 'yes'})` : ''));
    doc.fillColor('#000').moveDown(0.3);
  }

  doc.moveDown(0.5);
  const currency = expenses[0]?.currency ?? 'USD';
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`Total: ${total.toFixed(2)} ${currency}`, { align: 'right' });

  doc.end();
});
