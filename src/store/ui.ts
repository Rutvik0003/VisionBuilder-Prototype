import { create } from 'zustand';

// Ephemeral UI state — not persisted, not part of the demo data.
interface UiState {
  toast: { id: number; text: string } | null;
  showToast: (text: string) => void;
}

export const useUi = create<UiState>((set) => ({
  toast: null,
  showToast: (text) => {
    const id = Date.now();
    set({ toast: { id, text } });
    setTimeout(() => set((s) => (s.toast?.id === id ? { toast: null } : s)), 2200);
  },
}));
