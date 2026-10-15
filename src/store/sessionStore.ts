import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createGreenApiClient, type Credentials, type GreenApiClient } from '../api'

interface SessionState {
  credentials: Credentials | null
  login(credentials: Credentials): void
  logout(): void
}

/**
 * Креды живут в sessionStorage: переживают перезагрузку вкладки,
 * но не остаются в браузере после её закрытия.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      credentials: null,
      login: (credentials) => set({ credentials }),
      logout: () => set({ credentials: null }),
    }),
    {
      name: 'max-chat:session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ credentials: state.credentials }),
    },
  ),
)

let cachedClient: { credentials: Credentials; client: GreenApiClient } | null = null

/** Клиент для текущих кредов. Работает и вне React — поллер вызывает его из сервиса. */
export function getApiClient(): GreenApiClient {
  const { credentials } = useSessionStore.getState()
  if (!credentials) throw new Error('Не выполнен вход')
  if (cachedClient?.credentials !== credentials) {
    cachedClient = { credentials, client: createGreenApiClient(credentials) }
  }
  return cachedClient.client
}
