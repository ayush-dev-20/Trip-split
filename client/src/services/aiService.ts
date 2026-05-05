import api from './api';
import { getClerkToken } from '@/lib/clerkHelper';
import type { ReceiptScanResult, TripPlan, TripPlanWithCheckpoints, NLPExpenseResult, SuggestedCheckpoint } from '@/types';

/**
 * Low-level SSE helper — POSTs to `url`, then async-iterates the event stream.
 * Yields parsed JSON objects from `data: {...}` lines.
 */
async function* streamSSE(url: string, body: unknown): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const token = await getClerkToken();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith('data: ')) {
        try { yield JSON.parse(line.slice(6)); } catch { /* skip malformed */ }
      }
    }
  }
}

export const aiService = {
  scanReceipt: (file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api
      .post<{ success: boolean; data: ReceiptScanResult }>('/ai/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },

  categorize: (title: string, description?: string) =>
    api.post<{ success: boolean; data: { category: string } }>('/ai/categorize', { title, description }).then((r) => r.data.data),

  budgetAdvisor: (tripId: string) =>
    api.post<{ success: boolean; data: unknown }>('/ai/budget-advisor', { tripId }).then((r) => r.data.data),

  spendingInsights: (tripId: string) =>
    api.post<{ success: boolean; data: { insights: string } }>(`/ai/spending-insights/${tripId}`).then((r) => r.data.data.insights),

  tripPlanner: (destination: string, days: number, budget: number, currency: string, travelers: number) =>
    api.post<{ success: boolean; data: TripPlan }>('/ai/trip-planner', { destination, days, budget, currency, travelers }).then((r) => r.data.data),

  planForTrip: (tripId: string) =>
    api.post<{ success: boolean; data: TripPlanWithCheckpoints }>('/ai/trip-planner-for-trip', { tripId }).then((r) => r.data.data),

  /**
   * Streaming version of tripPlanner — calls `onChunk` for each markdown token.
   * Resolves when the stream ends.
   */
  tripPlannerStream: async (
    params: { destination: string; days: number; budget: number; currency: string; travelers: number },
    onChunk: (text: string) => void,
    onDone?: () => void
  ): Promise<void> => {
    for await (const event of streamSSE('/api/ai/trip-planner/stream', params)) {
      if (event.type === 'chunk') onChunk(event.text as string);
      else if (event.type === 'done') onDone?.();
    }
  },

  /**
   * Streaming version of planForTrip — streams itinerary markdown tokens, then fires
   * `onCheckpoints` with the AI-suggested checkpoint list before calling `onDone`.
   */
  planForTripStream: async (
    tripId: string,
    onChunk: (text: string) => void,
    onCheckpoints: (data: SuggestedCheckpoint[]) => void,
    onDone?: () => void
  ): Promise<void> => {
    for await (const event of streamSSE('/api/ai/trip-planner-for-trip/stream', { tripId })) {
      if (event.type === 'chunk') onChunk(event.text as string);
      else if (event.type === 'checkpoints') onCheckpoints(event.data as SuggestedCheckpoint[]);
      else if (event.type === 'done') onDone?.();
    }
  },

  parseNaturalLanguage: (text: string) =>
    api.post<{ success: boolean; data: NLPExpenseResult }>('/ai/parse-expense', { text }).then((r) => r.data.data),

  chatbot: (tripId: string, message: string) =>
    api.post<{ success: boolean; data: { answer: string } }>('/ai/chat', { tripId, message }).then((r) => r.data.data.answer),

  predictCost: (tripId: string) =>
    api.post<{ success: boolean; data: unknown }>('/ai/predict-cost', { tripId }).then((r) => r.data.data),
};
