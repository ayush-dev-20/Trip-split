import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { runWithModelFallback } from './geminiModels';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORIES_PROMPT, EXPENSE_CATEGORIES_JSON_PROMPT } from '../config/categories';

/**
 * Google Gemini AI Service
 *
 * Uses Google's Gemini model (free tier: 15 RPM, 1 million tokens/day).
 * All functions ask for JSON output and parse it safely.
 */

/**
 * Extracts a JSON value from raw Gemini output, handling:
 * - Markdown code fences (```json ... ```)
 * - Prose before/after the JSON
 * - Arrays wrapped in an object (e.g. { "items": [...] })
 */
function extractJSON(text: string): unknown {
  // Strip code fences
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Try parsing the whole cleaned string first
  try {
    return JSON.parse(stripped);
  } catch { /* fall through */ }

  // Try to find the first JSON array [...] in the text
  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch { /* fall through */ }
  }

  // Try to find the first JSON object {...} in the text
  const objectMatch = stripped.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]); } catch { /* fall through */ }
  }

  throw new SyntaxError('No valid JSON found in response');
}

/**
 * Failure raised by every user-triggered AI function. Surfacing a real error
 * (rather than returning fallback content dressed up as a result) lets the
 * client tell "the AI failed" apart from "the AI answered" and offer a retry.
 */
function aiFailure(): AppError {
  return new AppError('AI is unavailable right now. Please try again.', 503, 'AI_GENERATION_FAILED');
}

/**
 * Keeps errors we raised deliberately (e.g. "AI is at capacity, try again in ~40s")
 * intact, and turns anything else into the generic AI failure.
 */
function toAIError(err: unknown): AppError {
  return err instanceof AppError ? err : aiFailure();
}

/** Sends a prompt and parses JSON out of the reply. Throws on any failure. */
async function generateJSON(prompt: string, expectArray: boolean): Promise<unknown> {
  const result = await runWithModelFallback((model) => model.generateContent(prompt));
  let parsed = extractJSON(result.response.text());

  // If caller expects an array but got an object, look for the first array value
  if (expectArray && parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const nestedArray = Object.values(parsed as Record<string, unknown>).find((v) => Array.isArray(v));
    if (nestedArray !== undefined) parsed = nestedArray;
  }
  return parsed;
}

/** Sends a prompt and returns the reply text. Throws on any failure or an empty reply. */
async function generateText(prompt: string): Promise<string> {
  const result = await runWithModelFallback((model) => model.generateContent(prompt));
  const text = result.response.text();
  if (!text.trim()) throw new Error('Empty response from model');
  return text;
}

/**
 * Helper — send a prompt and get parsed JSON back, falling back to `fallback`
 * on failure. Only for passive/background features where a silent default is
 * fine; anything the user explicitly asked for should use `askJSONStrict`.
 * If the model returns an object wrapping an array (e.g. { "items": [...] })
 * and the caller expected an array, we unwrap it automatically.
 */
async function askJSON<T>(prompt: string, fallback: T): Promise<T> {
  try {
    return (await generateJSON(prompt, Array.isArray(fallback))) as T;
  } catch (err) {
    logger.error('AIService', 'Gemini JSON parse error', { error: String(err) });
    return fallback;
  }
}

/** Like `askJSON`, but throws an `AI_GENERATION_FAILED` error instead of returning a fallback. */
async function askJSONStrict<T>(prompt: string, opts: { expectArray?: boolean } = {}): Promise<T> {
  try {
    return (await generateJSON(prompt, opts.expectArray ?? false)) as T;
  } catch (err) {
    logger.error('AIService', 'Gemini JSON error', { error: String(err) });
    throw toAIError(err);
  }
}

/**
 * Helper — send a prompt and get plain text back, falling back to `fallback`
 * on failure. Passive features only; see `askTextStrict`.
 */
async function askText(prompt: string, fallback: string): Promise<string> {
  try {
    return await generateText(prompt);
  } catch (err) {
    logger.error('AIService', 'Gemini text error', { error: String(err) });
    return fallback;
  }
}

/** Like `askText`, but throws an `AI_GENERATION_FAILED` error instead of returning a fallback. */
async function askTextStrict(prompt: string): Promise<string> {
  try {
    return await generateText(prompt);
  } catch (err) {
    logger.error('AIService', 'Gemini text error', { error: String(err) });
    throw toAIError(err);
  }
}

/**
 * AI Receipt Scanner — Extracts data from a receipt image (base64).
 */
export async function scanReceipt(imageBase64: string, mimeType: string): Promise<{
  title: string;
  amount: number | null;
  currency: string;
  category: string;
  date: string | null;
  description: string;
}> {
  try {
    const result = await runWithModelFallback((model) => model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        },
      },
      {
        text: `You are a receipt scanner. Extract data from this receipt image and return JSON with:
- title: string (vendor/store name or short description)
- amount: number (total amount)
- currency: string (3-letter code, e.g. "INR", "USD")
- category: one of ${EXPENSE_CATEGORIES_PROMPT}
- date: string (YYYY-MM-DD) or null
- description: string (brief description of items)
Return ONLY valid JSON, no markdown.`,
      },
    ]));

    return extractJSON(result.response.text()) as {
      title: string;
      amount: number | null;
      currency: string;
      category: string;
      date: string | null;
      description: string;
    };
  } catch (err) {
    logger.error('AIService', 'Receipt scan error', { error: String(err) });
    throw toAIError(err);
  }
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isAdjustment?: boolean;
}

export interface RawItemizedReceipt {
  vendor?: string;
  date?: string | null;
  currency?: string;
  category?: string;
  items?: Partial<ReceiptItem>[];
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  total?: number;
}

export interface ItemizedReceipt {
  vendor: string;
  date: string | null;
  currency: string;
  category: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  reconciled: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Never trust model arithmetic: force items to sum to subtotal (adjustment
 * line for any gap) and total to equal subtotal + tax + serviceCharge.
 */
export function reconcileReceipt(parsed: RawItemizedReceipt): ItemizedReceipt {
  const items: ReceiptItem[] = (parsed.items ?? [])
    .filter((i) => i && typeof i.totalPrice === 'number' && (i.totalPrice as number) > 0)
    .map((i) => ({
      name: i.name || 'Item',
      quantity: i.quantity && i.quantity > 0 ? i.quantity : 1,
      unitPrice: round2(i.unitPrice ?? (i.totalPrice as number)),
      totalPrice: round2(i.totalPrice as number),
    }));

  const tax = round2(parsed.tax ?? 0);
  const serviceCharge = round2(parsed.serviceCharge ?? 0);
  const itemsSum = round2(items.reduce((s, i) => s + i.totalPrice, 0));
  const subtotal = round2(parsed.subtotal ?? itemsSum);

  let reconciled = false;

  const gap = round2(subtotal - itemsSum);
  if (Math.abs(gap) > Math.max(0.005 * subtotal, 0.01)) {
    items.push({ name: 'Adjustment', quantity: 1, unitPrice: gap, totalPrice: gap, isAdjustment: true });
    reconciled = true;
  }

  const computedTotal = round2(subtotal + tax + serviceCharge);
  let total = round2(parsed.total ?? computedTotal);
  if (Math.abs(total - computedTotal) > 0.01) {
    total = computedTotal;
    reconciled = true;
  }

  return {
    vendor: parsed.vendor || 'Receipt',
    date: parsed.date ?? null,
    currency: parsed.currency || 'USD',
    category: parsed.category || 'FOOD',
    items,
    subtotal,
    tax,
    serviceCharge,
    total,
    reconciled,
  };
}

/**
 * AI Receipt Itemizer — extracts line items from a receipt image.
 */
export async function scanReceiptItemized(imageBase64: string, mimeType: string): Promise<ItemizedReceipt> {
  try {
    const result = await runWithModelFallback((model) => model.generateContent([
      { inlineData: { data: imageBase64, mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' } },
      {
        text: `You are a receipt line-item extractor. Extract data from this receipt image and return JSON with:
- vendor: string (store/restaurant name)
- date: string (YYYY-MM-DD) or null
- currency: string (3-letter code, e.g. "INR", "USD")
- category: one of ${EXPENSE_CATEGORIES_PROMPT}
- items: array of { name: string, quantity: number, unitPrice: number, totalPrice: number } — one entry per line item, totalPrice = quantity × unitPrice
- subtotal: number (sum of item totals, before tax/charges)
- tax: number (all taxes combined; 0 if none shown)
- serviceCharge: number (service charge/tip printed on the bill; 0 if none)
- total: number (final payable amount)
Return ONLY valid JSON, no markdown.`,
      },
    ]));
    return reconcileReceipt(extractJSON(result.response.text()) as RawItemizedReceipt);
  } catch (err) {
    logger.error('AIService', 'Itemized receipt scan error', { error: String(err) });
    throw toAIError(err);
  }
}

/**
 * AI Expense Categorizer — Given an expense title, suggest a category.
 */
export async function categorizeExpense(title: string, description?: string): Promise<string> {
  const validCategories = EXPENSE_CATEGORIES as string[];

  const text = await askText(
    `Given this expense: "${title}"${description ? ` — ${description}` : ''}
Return ONLY one category from: ${validCategories.join(', ')}
No explanation, just the category name.`,
    'MISCELLANEOUS'
  );

  const category = text.trim().toUpperCase();
  return validCategories.includes(category) ? category : 'MISCELLANEOUS';
}

/**
 * AI Budget Status — Analyze pacing against an existing trip or monthly budget.
 */
export async function analyzeBudgetStatus(params: {
  scope: 'trip' | 'personal';
  spent: number;
  budget: number;
  currency: string;
  elapsedRatio: number; // 0..1, how far through the trip/month we are
  categoryBreakdown: Record<string, number>;
}): Promise<{
  status: 'under' | 'on_track' | 'over';
  summary: string;
  tips: string[];
}> {
  const spendRatio = params.budget > 0 ? params.spent / params.budget : 0;
  return askJSONStrict(
    `You are a budget pacing advisor. Analyze this ${params.scope === 'trip' ? 'trip' : 'personal monthly'} budget:
Budget: ${params.currency} ${params.budget}
Spent so far: ${params.currency} ${params.spent} (${(spendRatio * 100).toFixed(0)}% of budget)
Time elapsed: ${(params.elapsedRatio * 100).toFixed(0)}%
Category breakdown: ${JSON.stringify(params.categoryBreakdown)}

Return JSON: { "status": "under"|"on_track"|"over", "summary": "1-2 sentence pacing summary", "tips": ["tip1","tip2"] }
"over" means the spend ratio is meaningfully ahead of time elapsed. Return ONLY valid JSON.`
  );
}

/**
 * AI Spending Insights — Generate a natural language summary of spending for a trip, group, or personal scope.
 */
export async function generateSpendingInsights(data: {
  scopeLabel: string; // e.g. "the \"Tokyo\" trip", "the \"Roommates\" group", "your personal spending this month"
  totalBudget: number | null;
  totalSpent: number;
  categoryBreakdown: Record<string, number>;
  perUserSpending: { name: string; amount: number }[];
  duration: number | null; // days; null when the scope has no fixed duration (e.g. a group)
}): Promise<string> {
  return askTextStrict(
    `You are a friendly spending insights assistant. Analyze this spending data for ${data.scopeLabel} and give a concise, insightful summary.
Include: overall spending health, category highlights, per-person observations (if more than one person), and actionable tips.
Keep it conversational, under 300 words.
${data.totalBudget == null ? 'No budget has been set for this scope — skip budget-pacing commentary and focus on category and behavioral insights instead.' : ''}

Data: ${JSON.stringify(data)}`
  );
}

/**
 * Pure helper — given current/previous period expenses, computes per-category
 * spend deltas and flags "standout" expenses in the current period: any single
 * expense whose amount is more than 2x the average of the OTHER expenses in its
 * own category this period (catches one-off big-ticket purchases like a flight).
 */
export function computeCategoryDeltas(
  current: { category: string; baseAmount: number; title: string }[],
  previous: { category: string; baseAmount: number }[]
): {
  categoryDeltas: { category: string; current: number; previous: number }[];
  standoutExpenses: { title: string; amount: number; category: string }[];
} {
  const currentByCategory = new Map<string, number>();
  for (const e of current) {
    currentByCategory.set(e.category, (currentByCategory.get(e.category) || 0) + e.baseAmount);
  }
  const previousByCategory = new Map<string, number>();
  for (const e of previous) {
    previousByCategory.set(e.category, (previousByCategory.get(e.category) || 0) + e.baseAmount);
  }

  const categoryDeltas = Array.from(currentByCategory.entries()).map(([category, currentTotal]) => ({
    category,
    current: currentTotal,
    previous: previousByCategory.get(category) || 0,
  }));

  const standoutExpenses: { title: string; amount: number; category: string }[] = [];
  const byCategory = new Map<string, { category: string; baseAmount: number; title: string }[]>();
  for (const e of current) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category)!.push(e);
  }
  for (const expenses of byCategory.values()) {
    for (const expense of expenses) {
      const others = expenses.filter((e) => e !== expense);
      if (others.length === 0) continue;
      const othersAvg = others.reduce((s, e) => s + e.baseAmount, 0) / others.length;
      if (othersAvg > 0 && expense.baseAmount > othersAvg * 2) {
        standoutExpenses.push({ title: expense.title, amount: expense.baseAmount, category: expense.category });
      }
    }
  }

  return { categoryDeltas, standoutExpenses };
}

/**
 * AI Root-Cause Spending — one-sentence natural-language explanation of why
 * spending changed vs. the previous period, driven by category deltas and
 * standout individual expenses (both already computed server-side).
 */
export async function generateRootCauseExplanation(params: {
  periodLabel: string;
  currentTotal: number;
  previousTotal: number;
  currency: string;
  categoryDeltas: { category: string; current: number; previous: number }[];
  standoutExpenses: { title: string; amount: number; category: string }[];
}): Promise<string> {
  return askTextStrict(
    `You are a personal finance assistant. Explain WHY the user's spending changed between two periods, in ONE tight sentence, in this exact style:
"Your spending in June was 25% higher than May, primarily driven by a ₹5,000 flight purchase and 2 extra restaurant visits."

Data for ${params.periodLabel}:
Current total: ${params.currency} ${params.currentTotal}
Previous total: ${params.currency} ${params.previousTotal}
Category deltas (current vs previous): ${JSON.stringify(params.categoryDeltas)}
Standout individual expenses this period: ${JSON.stringify(params.standoutExpenses)}

Return ONLY the one sentence. No markdown, no preamble, no quotes around it.`
  );
}

/**
 * Trip-specific context beyond the bare destination/days/budget. Everything is
 * optional so the standalone Trip Planner page (which knows none of this) keeps
 * producing exactly the same prompt as before.
 */
export type TripContextExtras = {
  tripName?: string;
  tripDescription?: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  /** Total already spent on the trip, in the trip's budget currency. */
  spentSoFar?: number;
  /** Checkpoints the group has already planned. */
  existingCheckpoints?: { title: string; day: number | null; category: string | null }[];
  /** Free-text request from the traveler describing what they want. */
  userPrompt?: string;
};

type TripPlanParams = {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  travelers: number;
  interests?: string[];
} & TripContextExtras;

const MAX_CONTEXT_CHECKPOINTS = 60;

/**
 * Builds the "what we know about this trip + what the traveler asked for"
 * section shared by the itinerary and checkpoint prompts. Returns '' when there
 * is nothing extra to say.
 *
 * `purpose` only changes how the traveler's request is framed: an itinerary
 * must still cover every day, while checkpoint suggestions may be narrowed to
 * whatever the traveler asked for (a theme, particular days, a count).
 */
export function buildTripContextBlock(
  params: { destination: string; days: number; budget: number; currency: string } & TripContextExtras,
  purpose: 'itinerary' | 'checkpoints'
): string {
  const lines: string[] = [];

  if (params.tripName) lines.push(`- **Trip name:** ${params.tripName}`);
  if (params.tripDescription) lines.push(`- **About the trip:** ${params.tripDescription}`);
  if (params.startDate && params.endDate) {
    lines.push(
      `- **Dates:** ${params.startDate} to ${params.endDate} — factor in the season/weather, local festivals, holidays and typical opening hours for that time of year`
    );
  }
  if (params.spentSoFar && params.spentSoFar > 0) {
    const remaining = Math.max(0, params.budget - params.spentSoFar);
    lines.push(
      `- **Already spent:** ${params.currency} ${Math.round(params.spentSoFar)} (about ${params.currency} ${Math.round(remaining)} of the budget remains)`
    );
  }

  const existing = (params.existingCheckpoints ?? []).slice(0, MAX_CONTEXT_CHECKPOINTS);
  if (existing.length > 0) {
    lines.push(
      `- **Already planned (do NOT repeat these — build around them):**\n${existing
        .map((c) => `  - ${c.day != null ? `Day ${c.day}` : 'Unscheduled'}: ${c.title}${c.category ? ` (${c.category})` : ''}`)
        .join('\n')}`
    );
  }

  let block = lines.length > 0 ? `## Additional Trip Context\n${lines.join('\n')}` : '';

  if (params.userPrompt) {
    const framing =
      purpose === 'itinerary'
        ? 'Follow it closely — let it steer the themes, pace, must-do places and what to emphasise or skip — while still covering every day of the trip.'
        : 'Follow it closely. It takes priority over the default guidelines: if it narrows the scope (particular days, a theme, an area, a number of places), return only what was asked for.';
    // JSON.stringify gives a safely quoted single string, so free text can't break out of the quotes.
    block += `${block ? '\n\n' : ''}## Traveler's Request\nThe traveler wrote: ${JSON.stringify(params.userPrompt)}\n${framing}`;
  }

  return block;
}

/** Shared prompt builder for both streaming and non-streaming trip plan generation. */
function buildTripPlanPrompt(params: TripPlanParams): string {
  const perDay = Math.round(params.budget / params.days);
  const perPerson = Math.round(params.budget / params.travelers);
  const contextBlock = buildTripContextBlock(params, 'itinerary');
  return `You are an expert travel planner and local guide. Create a **comprehensive day-by-day itinerary** for the following trip.

## Trip Details
- **Destination:** ${params.destination}
- **Duration:** ${params.days} days
- **Total Budget:** ${params.currency} ${params.budget} (for ${params.travelers} traveler${params.travelers > 1 ? 's' : ''})
- **Per Person Budget:** ~${params.currency} ${perPerson}
- **Daily Budget:** ~${params.currency} ${perDay}/day
${params.interests?.length ? `- **Interests:** ${params.interests.join(', ')}` : ''}
${contextBlock ? `\n${contextBlock}\n` : ''}
## Response Format
Return ONLY well-formatted **Markdown**. Use the EXACT structure below:

1. Start with a section **## Budget Overview** — a compact table or bullet list showing estimated allocation:
   - Accommodation, Food & Dining, Transport, Activities & Sightseeing, Shopping & Miscellaneous
   - Show amount in ${params.currency} for each.

2. Then for EACH day write a section **## Day X: [Theme/Title]**
   - Morning, Afternoon, Evening sub-sections.
   - For each activity mention: the place/activity name in **bold**, a 1-2 sentence description, approximate cost in ${params.currency}.
   - Include specific restaurant / hotel / transport recommendations by name.
   - Include local tips like best time to visit, how to get tickets, what to wear, etc.

3. After all days, add a section **## Do's & Don'ts**
   - ✅ Do's — 5-7 bullet points of things to do for this specific destination.
   - ❌ Don'ts — 5-7 bullet points of things to avoid for this specific destination.

4. End with a section **## Pro Tips**
   - 4-5 insider tips about saving money, local customs, safety, best foods to try, hidden gems, etc.

IMPORTANT RULES:
- All amounts MUST be in ${params.currency}.
- Stay within the total budget of ${params.currency} ${params.budget}.
- Be specific — use real place names, real restaurant names, real hotel names relevant to ${params.destination}.
- Cover ALL ${params.days} days — do not skip any day.
- Keep it practical and actionable.
- Do NOT wrap the response in code fences. Return raw Markdown only.`;
}

/**
 * AI Trip Planner — Generate a detailed day-by-day itinerary in markdown (non-streaming).
 */
export async function generateTripPlan(params: TripPlanParams): Promise<{ itinerary: string }> {
  const markdown = await askTextStrict(buildTripPlanPrompt(params));
  return { itinerary: markdown };
}

/**
 * Streams a prompt's reply through `onChunk`. If the request is rejected (rate
 * limited, overloaded) *before any text has been sent*, it is transparently re-run
 * on the next model. Once text has gone out a switch would splice two models'
 * output together, so a mid-stream failure is thrown instead. An empty stream
 * counts as a failure.
 */
async function streamText(prompt: string, onChunk: (text: string) => void): Promise<void> {
  let emitted = false;
  await runWithModelFallback(
    async (model) => {
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          emitted = true;
          onChunk(text);
        }
      }
      if (!emitted) throw new Error('Empty response from model');
    },
    { canSwitch: () => !emitted }
  );
}

/**
 * AI Trip Planner — Streaming version. Calls `onChunk` for each text token.
 */
export async function generateTripPlanStream(
  params: TripPlanParams,
  onChunk: (text: string) => void
): Promise<void> {
  try {
    await streamText(buildTripPlanPrompt(params), onChunk);
  } catch (err) {
    logger.error('AIService', 'Gemini stream error', { error: String(err) });
    throw toAIError(err);
  }
}

/**
 * AI Trip Planner Refinement — Streaming. Given the currently displayed itinerary
 * and a follow-up instruction, returns a complete revised itinerary in the same
 * format. Stateless per call: the itinerary text itself carries all prior state,
 * so no chat history needs to be threaded through.
 */
export async function generateTripPlanRefineStream(
  params: { currentItinerary: string; instruction: string },
  onChunk: (text: string) => void
): Promise<void> {
  const prompt = `You are an expert travel planner. Below is a day-by-day trip itinerary you previously wrote, followed by a change the traveler wants.

## Current Itinerary
${params.currentItinerary}

## Requested Change
${params.instruction}

Rewrite the COMPLETE itinerary incorporating this change, in the exact same Markdown structure and level of detail as the current itinerary (same section headings: Budget Overview, Day-by-day sections, Do's & Don'ts, Pro Tips). Do not just describe the change — output the full revised itinerary. Do NOT wrap the response in code fences. Return raw Markdown only.`;

  try {
    await streamText(prompt, onChunk);
  } catch (err) {
    logger.error('AIService', 'Trip plan refine stream error', { error: String(err) });
    throw toAIError(err);
  }
}

/**
 * AI Note Generation — streams a markdown response for a free-form prompt,
 * informed by the given trip's context. Used by NotesPage's "Ask AI" feature.
 */
export async function generateNoteContentStream(
  params: { context: string; prompt: string },
  onChunk: (text: string) => void
): Promise<void> {
  const fullPrompt = `You are a helpful assistant. Use the context below to inform your response.

Context: ${params.context}

User's request: ${params.prompt}

Respond in well-structured markdown (headings, lists, etc. where appropriate). Do not repeat the context back verbatim — just use it to inform the content.`;

  try {
    await streamText(fullPrompt, onChunk);
  } catch (err) {
    logger.error('AIService', 'Note generation stream error', { error: String(err) });
    throw toAIError(err);
  }
}

/**
 * AI Checkpoint Suggestions — returns structured JSON of places to visit.
 */
export interface CheckpointSuggestion {
  title: string;
  description: string;
  category: string;
  estimatedCost: number;
  day: number;
}

const CHECKPOINT_CATEGORIES = ['sightseeing', 'food', 'activity', 'shopping', 'transport', 'accommodation', 'other'];

/**
 * Model output is untrusted: coerce every field into the shape the client and
 * the bulk-create endpoint expect, clamp `day` into the trip's range, and drop
 * anything unusable or that repeats an existing/earlier checkpoint title.
 */
export function normalizeCheckpointSuggestions(
  raw: unknown,
  opts: { days: number; existingTitles?: string[] }
): CheckpointSuggestion[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set((opts.existingTitles ?? []).map((t) => t.trim().toLowerCase()));
  const result: CheckpointSuggestion[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;

    const title = typeof r.title === 'string' ? r.title.trim().slice(0, 200) : '';
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const category = typeof r.category === 'string' ? r.category.trim().toLowerCase() : '';
    const cost = Number(r.estimatedCost);
    const dayNum = Math.round(Number(r.day));

    result.push({
      title,
      description: typeof r.description === 'string' ? r.description.trim().slice(0, 1000) : '',
      category: CHECKPOINT_CATEGORIES.includes(category) ? category : 'sightseeing',
      estimatedCost: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) / 100 : 0,
      day: Number.isFinite(dayNum) ? Math.min(Math.max(dayNum, 1), Math.max(1, opts.days)) : 1,
    });
  }

  return result;
}

export async function generateCheckpointSuggestions(
  params: {
    destination: string;
    days: number;
    budget: number;
    currency: string;
    travelers: number;
  } & TripContextExtras
): Promise<CheckpointSuggestion[]> {
  const perPerson = Math.round(params.budget / Math.max(1, params.travelers));
  const contextBlock = buildTripContextBlock(params, 'checkpoints');

  const raw = await askJSONStrict<unknown>(
    `You are a travel expert and local guide. Suggest specific places and activities ("checkpoints") for a trip.

## Trip Details
- **Destination:** ${params.destination}
- **Duration:** ${params.days} day${params.days > 1 ? 's' : ''}
- **Total budget:** ${params.currency} ${params.budget} for ${params.travelers} traveler${params.travelers > 1 ? 's' : ''} (~${params.currency} ${perPerson} per person)
${contextBlock ? `\n${contextBlock}\n` : ''}
## Output
Return a JSON array of objects with EXACTLY these fields:
- "title": string — the real, specific name of the place or activity
- "description": string — one sentence on why it's worth visiting
- "category": string — one of: "sightseeing", "food", "activity", "shopping", "transport", "accommodation"
- "estimatedCost": number — realistic cost per person in ${params.currency} (0 if free)
- "day": integer — which day of the trip, from 1 to ${params.days}

## Rules
- Default coverage is 3-5 checkpoints for each of the ${params.days} days. If the traveler's request narrows the scope (particular days, a theme, an area, a number of places), follow that instead of the default.
- Use real, named places in ${params.destination} — never generic entries like "local restaurant" or "city tour".
- Order each day's checkpoints in a sensible route (morning to evening) and keep a day's stops geographically close.
- Do not repeat or closely duplicate anything already planned.
- Keep costs realistic and the overall plan within the budget.
- Return ONLY the JSON array, no wrapping object and no markdown.`,
    { expectArray: true }
  );

  // An empty/non-array reply means the model didn't actually answer. (Items that
  // all get filtered out as duplicates below is a legitimate "nothing new" result.)
  if (!Array.isArray(raw) || raw.length === 0) throw aiFailure();

  return normalizeCheckpointSuggestions(raw, {
    days: params.days,
    existingTitles: params.existingCheckpoints?.map((c) => c.title),
  });
}

/**
 * Model output for a free-text field is untrusted: strip code fences, a leading
 * "Description:" label, wrapping quotes and markdown emphasis, then cap the
 * length to what the checkpoint description column/validator allows.
 */
export function cleanGeneratedDescription(text: string, maxLength = 1000): string {
  let out = text.trim();
  out = out.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  out = out.replace(/^(description|updated description)\s*:\s*/i, '');
  // Only unwrap quotes that surround the whole text — a lone apostrophe ("the locals'") is real content.
  const wrapped = /^["'\u201C\u2018]([\s\S]*)["'\u201D\u2019]$/.exec(out);
  if (wrapped) out = wrapped[1].trim();
  out = out.replace(/\*\*/g, '').replace(/`/g, '');
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out.slice(0, maxLength).trim();
}

/**
 * AI Checkpoint Description — writes (or revises) the description of a single
 * itinerary stop, steered by the traveler's own instruction. Returns '' when
 * generation fails so the caller can surface an error instead of saving filler.
 */
export async function generateCheckpointDescription(params: {
  title: string;
  category?: string;
  day?: number;
  currentDescription?: string;
  destination?: string;
  tripName?: string;
  startDate?: string;
  endDate?: string;
  userPrompt?: string;
}): Promise<string> {
  const trip: string[] = [];
  if (params.destination) trip.push(`- Destination: ${params.destination}`);
  if (params.tripName) trip.push(`- Trip: ${params.tripName}`);
  if (params.startDate && params.endDate) trip.push(`- Dates: ${params.startDate} to ${params.endDate}`);

  const stop: string[] = [`- Name: ${params.title}`];
  if (params.category) stop.push(`- Category: ${params.category}`);
  if (params.day != null) stop.push(`- Planned for: Day ${params.day}`);
  stop.push(
    params.currentDescription
      ? `- Current description: ${JSON.stringify(params.currentDescription)}`
      : '- Current description: none yet'
  );

  const request = params.userPrompt
    ? `\n## Traveler's Request\nThe traveler wrote: ${JSON.stringify(params.userPrompt)}\nFollow it closely — it decides the focus, tone and length.\n`
    : '';

  const task = params.currentDescription
    ? params.userPrompt
      ? 'Rewrite the current description so it reflects the traveler\'s request. Keep any facts from it that are still relevant.'
      : 'Improve and polish the current description without changing its facts.'
    : 'Write a new description for this stop.';

  const text = await askTextStrict(
    `You write short descriptions for stops on a trip itinerary.
${trip.length ? `\n## Trip\n${trip.join('\n')}\n` : ''}
## Stop
${stop.join('\n')}
${request}
## Task
${task}

## Rules
- 2-3 sentences, under 350 characters unless the traveler asks for more (never above 900).
- Plain text only: no markdown, no headings, no surrounding quotes, and don't just repeat the stop's name as a title.
- Be specific and useful — what it is, what to see/do/eat, a best-time or practical tip.
- State only what you are confident is true; do not invent opening hours, prices or booking rules.
- Return ONLY the description text.`
  );

  return cleanGeneratedDescription(text);
}

export interface PackingListCategory {
  name: string;
  items: string[];
}

export interface PackingListResponse {
  categories: PackingListCategory[];
}

/**
 * Model output is untrusted: keep only categories with a name and at least one
 * non-empty string item, trimmed and de-duplicated within the category.
 */
export function normalizePackingList(raw: unknown): PackingListResponse {
  const cats = (raw as { categories?: unknown })?.categories;
  if (!Array.isArray(cats)) return { categories: [] };

  const categories: PackingListCategory[] = [];
  for (const c of cats) {
    if (!c || typeof c !== 'object') continue;
    const name = typeof (c as { name?: unknown }).name === 'string' ? (c as { name: string }).name.trim() : '';
    const rawItems = (c as { items?: unknown }).items;
    if (!name || !Array.isArray(rawItems)) continue;

    const seen = new Set<string>();
    const items: string[] = [];
    for (const it of rawItems) {
      if (typeof it !== 'string') continue;
      const item = it.trim().slice(0, 200);
      if (!item || seen.has(item.toLowerCase())) continue;
      seen.add(item.toLowerCase());
      items.push(item);
    }
    if (items.length > 0) categories.push({ name: name.slice(0, 100), items });
  }
  return { categories };
}

/**
 * AI Packing List — categorized packing suggestions for a trip.
 */
export async function generatePackingList(params: {
  destination: string;
  days: number;
  startDate?: string;
  travelers: number;
  /** Optional free-text steer from the traveler, e.g. "business trip, need formal wear". */
  prompt?: string;
}): Promise<PackingListResponse> {
  const seasonHint = params.startDate
    ? `The trip starts on ${params.startDate} — infer the likely season/weather at the destination on that date and tailor clothing/gear accordingly.`
    : `No start date was given — suggest weather-neutral items and note destination-specific gear that applies year-round.`;

  const userHint = params.prompt
    ? `\nThe traveler gave these additional instructions — follow them closely and let them steer which items are included/excluded: "${params.prompt}"`
    : '';

  const raw = await askJSONStrict<unknown>(
    `You are a travel packing expert. Create a packing list for a ${params.days}-day trip to ${params.destination} for ${params.travelers} traveler(s).
${seasonHint}${userHint}

Return a JSON object: { "categories": [ { "name": string, "items": string[] } ] }
Include AT LEAST these categories, in this order: "Clothing", "Documents", "Electronics", "Toiletries", "Destination-Specific".
"Destination-Specific" must contain items genuinely specific to ${params.destination} (e.g. plug adapter type, monsoon gear, altitude medication, visa paperwork) — not generic items already covered by the other categories.
Each category should have 4-10 items. Return ONLY the JSON object, no markdown.`
  );

  const normalized = normalizePackingList(raw);
  if (normalized.categories.length === 0) throw aiFailure();
  return normalized;
}

/**
 * AI Natural Language Expense Parser.
 */
export async function parseNaturalLanguageExpense(text: string): Promise<{
  title: string;
  amount: number | null;
  currency: string;
  category: string;
  date: string | null;
  vendor: string | null;
}> {
  return askJSONStrict(
    `Parse this expense description into structured data: "${text}"
Today is ${new Date().toISOString().split('T')[0]}.

Return JSON:
{ "title": "short desc", "amount": number or null, "currency": "3-letter code default USD", "category": one of ${EXPENSE_CATEGORIES_JSON_PROMPT}, "date": "YYYY-MM-DD" or null, "vendor": "string" or null }
Return ONLY valid JSON.`
  );
}

/**
 * AI Anomaly Detection — Flag unusual expenses.
 */
export async function detectAnomalies(data: {
  currentExpense: { title: string; amount: number; category: string };
  categoryAverage: number;
  userAverage: number;
  recentExpenses: { title: string; amount: number; category: string }[];
}): Promise<{
  isAnomaly: boolean;
  reason: string | null;
  severity: 'low' | 'medium' | 'high';
}> {
  const ratio = data.currentExpense.amount / (data.categoryAverage || 1);

  if (ratio < 2) {
    return { isAnomaly: false, reason: null, severity: 'low' };
  }

  return askJSON(
    `Analyze if this expense is anomalous. It is ${ratio.toFixed(1)}x the category average.
Data: ${JSON.stringify(data)}
Return JSON: { "isAnomaly": boolean, "reason": "string or null", "severity": "low"|"medium"|"high" }
Return ONLY valid JSON.`,
    {
      isAnomaly: ratio > 3,
      reason: ratio > 3 ? `This expense is ${ratio.toFixed(1)}x your average ${data.currentExpense.category} spend` : null,
      severity: ratio > 5 ? 'high' as const : ratio > 3 ? 'medium' as const : 'low' as const,
    }
  );
}

/**
 * AI Chatbot — Answer questions about trip expenses.
 */
export async function chatWithExpenseData(
  message: string,
  context: {
    tripName: string;
    destination: string;
    currency: string;
    expenses: {
      title: string;
      amount: number;
      category: string;
      splitType: string;
      date: string;
      paidBy: string;
      splits: { member: string; contributed: number; fairShare: number; percentage: number | null }[];
    }[];
    members: string[];
    totalSpent: number;
    budget: number | null;
    balanceSummary: { member: string; net: number; status: string }[];
    debtSummary: { from: string; to: string; amount: number }[];
  }
): Promise<string> {
  // Build a concise but complete context for the AI
  const settlementsText = context.debtSummary.length > 0
    ? context.debtSummary.map((d) => `${d.from} owes ${d.to} ${context.currency} ${d.amount}`).join('; ')
    : 'All settled — no debts';

  const balancesText = context.balanceSummary
    .map((b) => `${b.member}: net ${b.net >= 0 ? '+' : ''}${context.currency} ${b.net} (${b.status})`)
    .join('; ');

  return askTextStrict(
    `You are a helpful expense tracker assistant for the trip "${context.tripName}" to ${context.destination}.
Currency: ${context.currency}
Members: ${context.members.join(', ')}
Total Spent: ${context.currency} ${context.totalSpent}
Budget: ${context.budget ? `${context.currency} ${context.budget}` : 'Not set'}

=== NET BALANCES (pre-computed, use these for balance/settlement questions) ===
${balancesText}

=== WHO OWES WHOM (simplified debts) ===
${settlementsText}

=== EXPENSE DETAILS (last ${Math.min(context.expenses.length, 50)}) ===
${JSON.stringify(context.expenses.slice(0, 50), null, 0)}

IMPORTANT RULES:
- For any question about "who owes whom", "balances", or "settlements", use the pre-computed NET BALANCES and WHO OWES WHOM sections above. Do NOT try to recalculate from raw expenses.
- "contributed" in splits means how much that person actually paid toward the expense. "fairShare" is the equal share each person should bear.
- All amounts are in ${context.currency}.
- Be concise, friendly, and accurate. Format currency amounts with the currency code.
- If you can't answer from the data, say so.

User question: ${message}`
  );
}

/**
 * Personal expense chatbot — answers questions about the user's own daily spending.
 */
export async function chatWithPersonalExpenses(
  message: string,
  context: {
    currency: string;
    totalSpent: number;
    totalExpenses: number;
    topCategory: string;
    dateRange: { from: string; to: string } | null;
    categoryTotals: { category: string; total: number; count: number }[];
    expenses: { title: string; amount: number; currency: string; category: string; date: string; isRecurring: boolean }[];
  }
): Promise<string> {
  const categoryText = context.categoryTotals
    .map((c) => `${c.category}: ${context.currency} ${c.total.toFixed(2)} (${c.count} transactions)`)
    .join('; ');

  return askTextStrict(
    `You are a helpful personal finance assistant. The user is asking about their own daily expenses.
Currency: ${context.currency}
Total Spent: ${context.currency} ${context.totalSpent.toFixed(2)} across ${context.totalExpenses} expenses
Top Category: ${context.topCategory}
${context.dateRange ? `Date Range: ${context.dateRange.from} to ${context.dateRange.to}` : ''}

=== SPENDING BY CATEGORY ===
${categoryText}

=== RECENT EXPENSES (last ${Math.min(context.expenses.length, 50)}) ===
${JSON.stringify(context.expenses.slice(0, 50), null, 0)}

IMPORTANT RULES:
- All amounts are in ${context.currency} unless the expense has its own currency listed.
- Be concise, friendly, and helpful with budgeting advice when relevant.
- Format currency amounts with the currency symbol or code.
- If you can't answer from the data, say so.

User question: ${message}`
  );
}

/**
 * Group expense chatbot — answers questions about shared group expenses.
 */
export async function chatWithGroupExpenses(
  message: string,
  context: {
    groupName: string;
    currency: string;
    totalSpent: number;
    members: string[];
    categoryTotals: { category: string; total: number; count: number }[];
    memberTotals: { name: string; totalPaid: number; fairShare: number; balance: number }[];
    expenses: {
      title: string;
      amount: number;
      currency: string;
      category: string;
      date: string;
      paidBy: string;
      splitCount: number;
    }[];
  }
): Promise<string> {
  const categoryText = context.categoryTotals
    .map((c) => `${c.category}: ${context.currency} ${c.total.toFixed(2)} (${c.count} transactions)`)
    .join('; ');

  const memberText = context.memberTotals
    .map((m) => `${m.name}: paid ${context.currency} ${m.totalPaid.toFixed(2)}, fair share ${context.currency} ${m.fairShare.toFixed(2)}, balance ${m.balance >= 0 ? '+' : ''}${context.currency} ${m.balance.toFixed(2)}`)
    .join('; ');

  return askTextStrict(
    `You are a helpful expense assistant for the group "${context.groupName}".
Currency: ${context.currency}
Members: ${context.members.join(', ')}
Total Spent: ${context.currency} ${context.totalSpent.toFixed(2)}

=== MEMBER BREAKDOWN ===
${memberText}

=== SPENDING BY CATEGORY ===
${categoryText}

=== RECENT EXPENSES (last ${Math.min(context.expenses.length, 50)}) ===
${JSON.stringify(context.expenses.slice(0, 50), null, 0)}

IMPORTANT RULES:
- A positive balance means the member paid more than their fair share (is owed money).
- A negative balance means the member paid less than their fair share (owes money).
- Be concise, friendly, and accurate. Format currency amounts with the currency code.
- If you can't answer from the data, say so.

User question: ${message}`
  );
}

/**
 * AI Expense Prediction — Predict trip cost based on history.
 */
/**
 * AI Predicted Cost — Project total spend by the end of the trip/month based on current pace.
 */
export async function predictProjectedCost(params: {
  scope: 'trip' | 'personal';
  spentSoFar: number;
  currency: string;
  elapsedRatio: number; // 0..1
  categoryBreakdown: Record<string, number>;
}): Promise<{
  predictedTotal: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
}> {
  const naiveProjection = params.elapsedRatio > 0 ? params.spentSoFar / params.elapsedRatio : params.spentSoFar;
  return askJSONStrict(
    `You are a spending forecaster. Based on the current pace, project the total spend by the end of the ${params.scope === 'trip' ? 'trip' : 'month'}.
Spent so far: ${params.currency} ${params.spentSoFar}
Time elapsed: ${(params.elapsedRatio * 100).toFixed(0)}%
Category breakdown: ${JSON.stringify(params.categoryBreakdown)}
A naive linear projection would be ${params.currency} ${naiveProjection.toFixed(2)} — use this as a starting point but adjust for realistic spending patterns (e.g. front-loaded accommodation costs).

Return JSON: { "predictedTotal": number, "confidence": "low"|"medium"|"high", "reasoning": "1 sentence" }
Return ONLY valid JSON.`
  );
}
