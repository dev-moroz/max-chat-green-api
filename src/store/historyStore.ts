import { create } from 'zustand'
import type { HistoryLoader, HistoryStatus } from '../services/historyLoader'

interface HistoryState {
  /** Статус загрузки истории по chatId; не сохраняется между сессиями */
  status: Record<string, HistoryStatus>
  /** Загрузчик текущей сессии; null до входа */
  loader: HistoryLoader | null
  setStatus(chatId: string, status: HistoryStatus): void
  setLoader(loader: HistoryLoader | null): void
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  status: {},
  loader: null,
  setStatus: (chatId, status) => set((s) => ({ status: { ...s.status, [chatId]: status } })),
  setLoader: (loader) => set(loader ? { loader } : { loader: null, status: {} }),
}))
