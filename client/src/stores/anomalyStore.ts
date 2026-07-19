import { create } from 'zustand';

export interface AnomalyAlert {
  expenseId: string;
  title: string;
  amount: number;
  currency: string;
  reason: string;
}

interface AnomalyState {
  anomaly: AnomalyAlert | null;
  setAnomaly: (anomaly: AnomalyAlert) => void;
  clearAnomaly: () => void;
}

export const useAnomalyStore = create<AnomalyState>()((set) => ({
  anomaly: null,
  setAnomaly: (anomaly) => set({ anomaly }),
  clearAnomaly: () => set({ anomaly: null }),
}));
