import api from './api';
import { getClerkToken } from '@/lib/clerkHelper';
import { AIStreamError } from '@/lib/aiError';
import type { ReceiptScanResult, ItemizedReceipt, TripPlan, TripPlanWithCheckpoints, NLPExpenseResult, SuggestedCheckpoint, AIBudgetStatus, AIPredictedCost, RootCauseExplanation } from '@/types';

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
    // Non-2xx responses are normal JSON errors (validation, plan gate, ...) — surface their message/code.
    let code: string | undefined;
    let message: string | undefined;
    try {
      const json = await response.json();
      code = json?.error?.code;
      message = json?.error?.message;
    } catch { /* body wasn't JSON */ }
    throw new AIStreamError(message ?? `Stream request failed: ${response.status}`, { code, status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith('data: ')) {
        let event: { type: string; [key: string]: unknown };
        try { event = JSON.parse(line.slice(6)); } catch { continue; /* skip malformed */ }

        // The server reports a failed generation as a distinct `error` event —
        // never as ordinary text — so callers can show an error and offer a retry.
        if (event.type === 'error') {
          throw new AIStreamError(
            (event.message as string) || 'AI is unavailable right now. Please try again.',
            { code: 'AI_GENERATION_FAILED', status: 503, stage: event.stage as string | undefined }
          );
        }
        if (event.type === 'done') sawDone = true;
        yield event;
      }
    }
  }

  // The connection closed before the server said it was finished (dropped
  // network, proxy timeout): treat the partial output as a failure, not a result.
  if (!sawDone) throw new AIStreamError('The connection was interrupted before the AI finished.', { status: 503 });
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

  scanReceiptItems: (file: File) => {
    const formData = new FormData();
    formData.append('receipt', file);
    return api
      .post<{ success: boolean; data: ItemizedReceipt }>('/ai/scan-receipt-items', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },

  categorize: (title: string, description?: string) =>
    api.post<{ success: boolean; data: { category: string } }>('/ai/categorize', { title, description }).then((r) => r.data.data),

  insightsSpending: (scope: 'trip' | 'group' | 'personal', ids?: { tripId?: string; groupId?: string }) =>
    api.post<{ success: boolean; data: { insights: string } }>('/ai/insights/spending', { scope, ...ids }).then((r) => r.data.data.insights),

  insightsBudgetStatus: (scope: 'trip' | 'personal', tripId?: string) =>
    api.post<{ success: boolean; data: AIBudgetStatus }>('/ai/insights/budget-status', { scope, tripId }).then((r) => r.data.data),

  insightsPredictedCost: (scope: 'trip' | 'personal', tripId?: string) =>
    api.post<{ success: boolean; data: AIPredictedCost }>('/ai/insights/predicted-cost', { scope, tripId }).then((r) => r.data.data),

  insightsRootCause: (params: { period?: string; startDate?: string; endDate?: string }) =>
    api.post<{ success: boolean; data: RootCauseExplanation }>('/ai/insights/root-cause', params).then((r) => r.data.data.explanation),

  planCheckpoints: (params: { destination: string; days: number; budget: number; currency: string; travelers: number }) =>
    api.post<{ success: boolean; data: SuggestedCheckpoint[] }>('/ai/plan-checkpoints', params).then((r) => r.data.data),

  /** Writes/revises one checkpoint's description, steered by the traveler's instruction. */
  checkpointDescription: (params: {
    tripId: string;
    title: string;
    category?: string;
    day?: number;
    currentDescription?: string;
    prompt?: string;
  }) =>
    api.post<{ success: boolean; data: { description: string } }>('/ai/checkpoint-description', params)
      .then((r) => r.data.data.description),

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
   * `onItineraryComplete` fires once itinerary streaming ends, before checkpoint generation starts.
   */
  planForTripStream: async (
    params: {
      tripId: string;
      /** Optional free-text steer, e.g. "focus on street food, keep day 3 free". */
      prompt?: string;
      /** Retry hook: re-run only the checkpoint step, keeping the itinerary already on screen. */
      only?: 'checkpoints';
    },
    onChunk: (text: string) => void,
    onCheckpoints: (data: SuggestedCheckpoint[]) => void,
    onDone?: () => void,
    onItineraryComplete?: () => void
  ): Promise<void> => {
    for await (const event of streamSSE('/api/ai/trip-planner-for-trip/stream', params)) {
      if (event.type === 'chunk') onChunk(event.text as string);
      else if (event.type === 'itinerary_complete') onItineraryComplete?.();
      else if (event.type === 'checkpoints') onCheckpoints(event.data as SuggestedCheckpoint[]);
      else if (event.type === 'done') onDone?.();
    }
  },

  /**
   * Streaming itinerary refinement — sends the current itinerary + a change
   * instruction, calls `onChunk` for each replacement markdown token. Stateless
   * per call (no chat history sent).
   */
  tripPlannerRefineStream: async (
    params: { currentItinerary: string; instruction: string },
    onChunk: (text: string) => void,
    onDone?: () => void
  ): Promise<void> => {
    for await (const event of streamSSE('/api/ai/trip-planner/refine/stream', params)) {
      if (event.type === 'chunk') onChunk(event.text as string);
      else if (event.type === 'done') onDone?.();
    }
  },

  /**
   * Streaming AI note generation — informed by the trip's context, for NotesPage's
   * "Ask AI" feature. Calls `onChunk` for each markdown token; resolves when the stream ends.
   */
  noteGenerateStream: async (
    scope: { type: 'trip'; tripId: string } | { type: 'group'; groupId: string } | { type: 'personal' },
    prompt: string,
    onChunk: (text: string) => void
  ): Promise<void> => {
    const body =
      scope.type === 'trip' ? { scope: 'trip', tripId: scope.tripId, prompt } :
      scope.type === 'group' ? { scope: 'group', groupId: scope.groupId, prompt } :
      { scope: 'personal', prompt };
    for await (const event of streamSSE('/api/ai/notes/generate/stream', body)) {
      if (event.type === 'chunk') onChunk(event.text as string);
    }
  },

  parseNaturalLanguage: (text: string) =>
    api.post<{ success: boolean; data: NLPExpenseResult }>('/ai/parse-expense', { text }).then((r) => r.data.data),

  chatbot: (tripId: string, message: string) =>
    api.post<{ success: boolean; data: { answer: string } }>('/ai/chat', { tripId, message }).then((r) => r.data.data.answer),

  chatbotPersonal: (message: string) =>
    api.post<{ success: boolean; data: { answer: string } }>('/ai/chat-personal', { message }).then((r) => r.data.data.answer),

  chatbotGroup: (groupId: string, message: string) =>
    api.post<{ success: boolean; data: { answer: string } }>('/ai/chat-group', { groupId, message }).then((r) => r.data.data.answer),

  detectAnomaly: (params: { title: string; amount: number; category: string; tripId?: string; groupId?: string }) =>
    api
      .post<{ success: boolean; data: { isAnomaly: boolean; reason: string | null; severity: 'low' | 'medium' | 'high' } }>(
        '/ai/detect-anomaly',
        params
      )
      .then((r) => r.data.data),
};
