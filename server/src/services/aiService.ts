import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Google Gemini AI Service
 *
 * Uses Google's Gemini model (free tier: 15 RPM, 1 million tokens/day).
 * All functions ask for JSON output and parse it safely.
 */

let genAI: GoogleGenerativeAI | null = null;

function getModel() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Get a free key at https://aistudio.google.com/apikey');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
}

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
 * Helper — send a prompt and get parsed JSON back.
 * If the model returns an object wrapping an array (e.g. { "items": [...] })
 * and the caller expected an array, we unwrap it automatically.
 */
async function askJSON<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    let parsed = extractJSON(text);

    // If caller expects an array but got an object, look for the first array value
    if (Array.isArray(fallback) && parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const nestedArray = Object.values(parsed as Record<string, unknown>).find((v) => Array.isArray(v));
      if (nestedArray !== undefined) parsed = nestedArray;
    }

    return parsed as T;
  } catch (err) {
    logger.error('AIService', 'Gemini JSON parse error', { error: String(err) });
    return fallback;
  }
}

/**
 * Helper — send a prompt and get plain text back.
 */
async function askText(prompt: string, fallback: string): Promise<string> {
  try {
    const model = getModel();
    const result = await model.generateContent(prompt);
    return result.response.text() || fallback;
  } catch (err) {
    logger.error('AIService', 'Gemini text error', { error: String(err) });
    return fallback;
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
    const model = getModel();

    const result = await model.generateContent([
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
- category: one of FOOD, TRANSPORT, ACCOMMODATION, ACTIVITIES, SHOPPING, ENTERTAINMENT, HEALTH, COMMUNICATION, FEES, MISCELLANEOUS
- date: string (YYYY-MM-DD) or null
- description: string (brief description of items)
Return ONLY valid JSON, no markdown.`,
      },
    ]);

    const text = result.response.text();
    const cleaned = text.replace(/\`\`\`json\\s*/g, '').replace(/\`\`\`\\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error('AIService', 'Receipt scan error', { error: String(err) });
    return { title: 'Receipt', amount: null, currency: 'USD', category: 'MISCELLANEOUS', date: null, description: '' };
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
    const model = getModel();
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' } },
      {
        text: `You are a receipt line-item extractor. Extract data from this receipt image and return JSON with:
- vendor: string (store/restaurant name)
- date: string (YYYY-MM-DD) or null
- currency: string (3-letter code, e.g. "INR", "USD")
- category: one of FOOD, GROCERIES, TRANSPORT, ACCOMMODATION, ACTIVITIES, SHOPPING, ENTERTAINMENT, HEALTH, COMMUNICATION, FEES, MISCELLANEOUS
- items: array of { name: string, quantity: number, unitPrice: number, totalPrice: number } — one entry per line item, totalPrice = quantity × unitPrice
- subtotal: number (sum of item totals, before tax/charges)
- tax: number (all taxes combined; 0 if none shown)
- serviceCharge: number (service charge/tip printed on the bill; 0 if none)
- total: number (final payable amount)
Return ONLY valid JSON, no markdown.`,
      },
    ]);
    const text = result.response.text();
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return reconcileReceipt(JSON.parse(cleaned) as RawItemizedReceipt);
  } catch (err) {
    logger.error('AIService', 'Itemized receipt scan error', { error: String(err) });
    return reconcileReceipt({ items: [], subtotal: 0, total: 0 });
  }
}

/**
 * AI Expense Categorizer — Given an expense title, suggest a category.
 */
export async function categorizeExpense(title: string, description?: string): Promise<string> {
  const validCategories = [
    'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES',
    'SHOPPING', 'ENTERTAINMENT', 'HEALTH', 'COMMUNICATION', 'FEES', 'MISCELLANEOUS',
  ];

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
  return askJSON(
    `You are a budget pacing advisor. Analyze this ${params.scope === 'trip' ? 'trip' : 'personal monthly'} budget:
Budget: ${params.currency} ${params.budget}
Spent so far: ${params.currency} ${params.spent} (${(spendRatio * 100).toFixed(0)}% of budget)
Time elapsed: ${(params.elapsedRatio * 100).toFixed(0)}%
Category breakdown: ${JSON.stringify(params.categoryBreakdown)}

Return JSON: { "status": "under"|"on_track"|"over", "summary": "1-2 sentence pacing summary", "tips": ["tip1","tip2"] }
"over" means the spend ratio is meaningfully ahead of time elapsed. Return ONLY valid JSON.`,
    {
      status:
        spendRatio > params.elapsedRatio + 0.15 ? ('over' as const) :
        spendRatio < params.elapsedRatio - 0.15 ? ('under' as const) :
        ('on_track' as const),
      summary: 'Unable to generate budget analysis at this time.',
      tips: [],
    }
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
  return askText(
    `You are a friendly spending insights assistant. Analyze this spending data for ${data.scopeLabel} and give a concise, insightful summary.
Include: overall spending health, category highlights, per-person observations (if more than one person), and actionable tips.
Keep it conversational, under 300 words.
${data.totalBudget == null ? 'No budget has been set for this scope — skip budget-pacing commentary and focus on category and behavioral insights instead.' : ''}

Data: ${JSON.stringify(data)}`,
    'Unable to generate insights at this time.'
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
  return askText(
    `You are a personal finance assistant. Explain WHY the user's spending changed between two periods, in ONE tight sentence, in this exact style:
"Your spending in June was 25% higher than May, primarily driven by a ₹5,000 flight purchase and 2 extra restaurant visits."

Data for ${params.periodLabel}:
Current total: ${params.currency} ${params.currentTotal}
Previous total: ${params.currency} ${params.previousTotal}
Category deltas (current vs previous): ${JSON.stringify(params.categoryDeltas)}
Standout individual expenses this period: ${JSON.stringify(params.standoutExpenses)}

Return ONLY the one sentence. No markdown, no preamble, no quotes around it.`,
    'Unable to generate an explanation right now.'
  );
}

type TripPlanParams = {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  travelers: number;
  interests?: string[];
};

/** Shared prompt builder for both streaming and non-streaming trip plan generation. */
function buildTripPlanPrompt(params: TripPlanParams): string {
  const perDay = Math.round(params.budget / params.days);
  const perPerson = Math.round(params.budget / params.travelers);
  return `You are an expert travel planner and local guide. Create a **comprehensive day-by-day itinerary** for the following trip.

## Trip Details
- **Destination:** ${params.destination}
- **Duration:** ${params.days} days
- **Total Budget:** ${params.currency} ${params.budget} (for ${params.travelers} traveler${params.travelers > 1 ? 's' : ''})
- **Per Person Budget:** ~${params.currency} ${perPerson}
- **Daily Budget:** ~${params.currency} ${perDay}/day
${params.interests?.length ? `- **Interests:** ${params.interests.join(', ')}` : ''}

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
  const markdown = await askText(
    buildTripPlanPrompt(params),
    `## Trip Plan for ${params.destination}\n\nUnable to generate itinerary at this time. Please try again.`
  );
  return { itinerary: markdown };
}

/**
 * AI Trip Planner — Streaming version. Calls `onChunk` for each text token.
 */
export async function generateTripPlanStream(
  params: TripPlanParams,
  onChunk: (text: string) => void
): Promise<void> {
  try {
    const model = getModel();
    const result = await model.generateContentStream(buildTripPlanPrompt(params));
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onChunk(text);
    }
  } catch (err) {
    logger.error('AIService', 'Gemini stream error', { error: String(err) });
    onChunk(`\n\n## Trip Plan for ${params.destination}\n\nUnable to generate itinerary at this time. Please try again.`);
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
    const model = getModel();
    const result = await model.generateContentStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onChunk(text);
    }
  } catch (err) {
    logger.error('AIService', 'Trip plan refine stream error', { error: String(err) });
    onChunk('\n\n_Unable to refine the itinerary right now. Please try again._');
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
  try {
    const model = getModel();
    const fullPrompt = `You are a helpful assistant. Use the context below to inform your response.

Context: ${params.context}

User's request: ${params.prompt}

Respond in well-structured markdown (headings, lists, etc. where appropriate). Do not repeat the context back verbatim — just use it to inform the content.`;

    const result = await model.generateContentStream(fullPrompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onChunk(text);
    }
  } catch (err) {
    logger.error('AIService', 'Note generation stream error', { error: String(err) });
    onChunk('\n\n_Unable to generate content right now. Please try again._');
  }
}

/**
 * AI Checkpoint Suggestions — returns structured JSON of places to visit.
 */
export async function generateCheckpointSuggestions(params: {
  destination: string;
  days: number;
  budget: number;
  currency: string;
  travelers: number;
}): Promise<
  Array<{
    title: string;
    description: string;
    category: string;
    estimatedCost: number;
    day: number;
  }>
> {
  return askJSON(
    `You are a travel expert. For a ${params.days}-day trip to ${params.destination} with a budget of ${params.currency} ${params.budget} for ${params.travelers} traveler(s), suggest the top places/activities to visit.

Return a JSON array of objects with EXACTLY these fields:
- "title": string — name of place or activity
- "description": string — 1 sentence description
- "category": string — one of: "sightseeing", "food", "activity", "shopping", "transport", "accommodation"
- "estimatedCost": number — estimated cost per person in ${params.currency}
- "day": number — which day (1 to ${params.days}) this belongs to

Suggest 3-5 items per day. Return ONLY the JSON array, no wrapping object.`,
    []
  );
}

export interface PackingListCategory {
  name: string;
  items: string[];
}

export interface PackingListResponse {
  categories: PackingListCategory[];
}

/**
 * AI Packing List — categorized packing suggestions for a trip.
 */
export async function generatePackingList(params: {
  destination: string;
  days: number;
  startDate?: string;
  travelers: number;
}): Promise<PackingListResponse> {
  const seasonHint = params.startDate
    ? `The trip starts on ${params.startDate} — infer the likely season/weather at the destination on that date and tailor clothing/gear accordingly.`
    : `No start date was given — suggest weather-neutral items and note destination-specific gear that applies year-round.`;

  return askJSON(
    `You are a travel packing expert. Create a packing list for a ${params.days}-day trip to ${params.destination} for ${params.travelers} traveler(s).
${seasonHint}

Return a JSON object: { "categories": [ { "name": string, "items": string[] } ] }
Include AT LEAST these categories, in this order: "Clothing", "Documents", "Electronics", "Toiletries", "Destination-Specific".
"Destination-Specific" must contain items genuinely specific to ${params.destination} (e.g. plug adapter type, monsoon gear, altitude medication, visa paperwork) — not generic items already covered by the other categories.
Each category should have 4-10 items. Return ONLY the JSON object, no markdown.`,
    { categories: [] }
  );
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
  return askJSON(
    `Parse this expense description into structured data: "${text}"
Today is ${new Date().toISOString().split('T')[0]}.

Return JSON:
{ "title": "short desc", "amount": number or null, "currency": "3-letter code default USD", "category": one of "FOOD","TRANSPORT","ACCOMMODATION","ACTIVITIES","SHOPPING","ENTERTAINMENT","HEALTH","COMMUNICATION","FEES","MISCELLANEOUS", "date": "YYYY-MM-DD" or null, "vendor": "string" or null }
Return ONLY valid JSON.`,
    { title: text, amount: null, currency: 'USD', category: 'MISCELLANEOUS', date: null, vendor: null }
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

  return askText(
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

User question: ${message}`,
    "Sorry, I couldn't process that question."
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

  return askText(
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

User question: ${message}`,
    "Sorry, I couldn't process that question."
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

  return askText(
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

User question: ${message}`,
    "Sorry, I couldn't process that question."
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
  return askJSON(
    `You are a spending forecaster. Based on the current pace, project the total spend by the end of the ${params.scope === 'trip' ? 'trip' : 'month'}.
Spent so far: ${params.currency} ${params.spentSoFar}
Time elapsed: ${(params.elapsedRatio * 100).toFixed(0)}%
Category breakdown: ${JSON.stringify(params.categoryBreakdown)}
A naive linear projection would be ${params.currency} ${naiveProjection.toFixed(2)} — use this as a starting point but adjust for realistic spending patterns (e.g. front-loaded accommodation costs).

Return JSON: { "predictedTotal": number, "confidence": "low"|"medium"|"high", "reasoning": "1 sentence" }
Return ONLY valid JSON.`,
    { predictedTotal: Math.round(naiveProjection), confidence: 'low' as const, reasoning: 'Unable to generate prediction at this time.' }
  );
}
