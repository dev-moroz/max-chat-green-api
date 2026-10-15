import { useEffect, useState } from 'react'
import { runPoller, type PollerStatus } from '../../services/notificationPoller'
import { useChatStore } from '../../store/chatStore'
import { getApiClient, useSessionStore } from '../../store/sessionStore'

/**
 * Запускает поллер на время жизни сессии.
 * Один экземпляр гарантирует cleanup: в StrictMode эффект монтируется дважды, но первый цикл
 * отменяется через AbortController до старта второго, а Web Lock не даёт им пересечься.
 */
export function useNotificationPolling(): PollerStatus {
  const credentials = useSessionStore((s) => s.credentials)
  const [status, setStatus] = useState<PollerStatus>('connecting')

  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()

    void runPoller({
      client: getApiClient(),
      signal: controller.signal,
      lockName: `max-chat:poller:${credentials.idInstance}`,
      onMessage: (event) => useChatStore.getState().applyMessage(event),
      onStatus: setStatus,
    })

    return () => controller.abort()
  }, [credentials])

  return status
}
