import { useEffect } from 'react'
import { isAbortError } from '../../api'
import { createHistoryLoader } from '../../services/historyLoader'
import { useChatStore } from '../../store/chatStore'
import { useHistoryStore } from '../../store/historyStore'
import { getApiClient, useSessionStore } from '../../store/sessionStore'

/**
 * Синхронизация с аккаунтом:
 * 1. getChats — список существующих диалогов, чтобы сайдбар не был пустым;
 * 2. getChatHistory — открытый чат целиком (до 5 000 сообщений за 3 месяца).
 * Новые сообщения по-прежнему приходят через поллер; дубли отсекаются по idMessage.
 */
export function useHistorySync() {
  const credentials = useSessionStore((s) => s.credentials)
  const activeChatId = useChatStore((s) => s.activeChatId)

  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()
    const client = getApiClient()
    const loader = createHistoryLoader({
      client,
      signal: controller.signal,
      onHistory: (chatId, events) => useChatStore.getState().mergeHistory(chatId, events),
      onStatus: (chatId, status) => useHistoryStore.getState().setStatus(chatId, status),
    })
    useHistoryStore.getState().setLoader(loader)

    const active = useChatStore.getState().activeChatId
    if (active) loader.request(active, { priority: true })

    client
      .getChats(controller.signal)
      .then((chats) => useChatStore.getState().importChats(chats))
      .catch((error: unknown) => {
        if (!isAbortError(error)) console.warn('Не удалось загрузить список чатов', error)
      })

    return () => {
      controller.abort()
      useHistoryStore.getState().setLoader(null)
    }
  }, [credentials])

  useEffect(() => {
    if (activeChatId) useHistoryStore.getState().loader?.request(activeChatId, { priority: true })
  }, [activeChatId])
}
