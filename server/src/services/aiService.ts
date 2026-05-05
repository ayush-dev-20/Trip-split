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

/**
 * AI Expense Categorizer — Given an expense title, suggest a category.
 */
export async function categorizeExpense(title: string): Promise<string> {
  const validCategories = [
    'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES',
    'SHOPPING', 'ENTERTAINMENT', 'HEALTH', 'COMMUNICATION', 'FEES', 'MISCELLANEOUS',
  ];

  const text = await askText(
    `Given this expense: "${title}"
Return ONLY one category from: ${validCategories.join(', ')}
No explanation, just the category name.`,
    'MISCELLANEOUS'
  );

  const category = text.trim().toUpperCase();
  return validCategories.includes(category) ? category : 'MISCELLANEOUS';
}

/**
 * AI Trip Budget Advisor — Suggest a budget for a trip.
 */
export async function suggestTripBudget(params: {
  destination: string;
  durationDays: number;
  groupSize: number;
  travelStyle?: string;
}): Promise<{
  totalBudget: number;
  perPersonBudget: number;
  breakdown: Record<string, number>;
  tips: string[];
}> {
  return askJSON(
    `You are a travel budget advisor. Suggest a realistic budget for:
Destination: ${params.destination}, Duration: ${params.durationDays} days, Group: ${params.groupSize} people, Style: ${params.travelStyle || 'moderate'}

Return JSON:
{ "totalBudget": number, "perPersonBudget": number, "breakdown": { "food": number, "transport": number, "accommodation": number, "activities": number, "miscellaneous": number }, "tips": ["tip1","tip2","tip3"] }
All amounts in USD. Return ONLY valid JSON.`,
    { totalBudget: 0, perPersonBudget: 0, breakdown: {}, tips: ['Unable to generate budget estimate.'] }
  );
}

/**
 * AI Spending Insights — Generate natural language summary of trip spending.
 */
export async function generateSpendingInsights(data: {
  tripName: string;
  destination: string;
  totalBudget: number | null;
  totalSpent: number;
  categoryBreakdown: Record<string, number>;
  perUserSpending: { name: string; amount: number }[];
  duration: number;
}): Promise<string> {
  return askText(
    `You are a friendly spending insights assistant. Analyze this trip data and give a concise, insightful summary.
Include: overall spending health, category highlights, per-person observations, and actionable tips.
Keep it conversational, under 300 words.

Trip Data: ${JSON.stringify(data)}`,
    'Unable to generate insights at this time.'
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
 * AI Expense Prediction — Predict trip cost based on history.
 */
export async function predictTripCost(data: {
  destination: string;
  durationDays: number;
  groupSize: number;
  pastTrips: {
    destination: string;
    duration: number;
    groupSize: number;
    totalSpent: number;
    categoryBreakdown: Record<string, number>;
  }[];
}): Promise<{
  predictedTotal: number;
  predictedPerPerson: number;
  confidence: 'low' | 'medium' | 'high';
  breakdown: Record<string, number>;
}> {
  return askJSON(
    `Based on past trip data, predict the cost for a new trip.
Data: ${JSON.stringify(data)}
Return JSON: { "predictedTotal": number, "predictedPerPerson": number, "confidence": "low"|"medium"|"high", "breakdown": { "category": amount } }
Return ONLY valid JSON.`,
    { predictedTotal: 0, predictedPerPerson: 0, confidence: 'low' as const, breakdown: {} }
  );
}
