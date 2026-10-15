import { useEffect } from 'react'
import { isAbortError } from '../../api'
import { createHistoryLoader } from '../../services/historyLoader'
import { sortChatsByActivity, useChatStore } from '../../store/chatStore'
import { useHistoryStore } from '../../store/historyStore'
import { getApiClient, useSessionStore } from '../../store/sessionStore'

/** Сколько чатов догружать фоном после входа; остальные — при открытии */
const BACKGROUND_LIMIT = 30

/**
 * Синхронизация с аккаунтом:
 * 1. getChats — список существующих диалогов, чтобы сайдбар не был пустым;
 * 2. getChatHistory — открытый чат в приоритете, остальные фоном (лимит API — 1 запрос/с).
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

    const enqueueKnownChats = () =>
      sortChatsByActivity(useChatStore.getState().chats)
        .slice(0, BACKGROUND_LIMIT)
        .forEach((chat) => loader.request(chat.chatId))

    client
      .getChats(controller.signal)
      .then((chats) => useChatStore.getState().importChats(chats))
      .catch((error: unknown) => {
        if (!isAbortError(error)) console.warn('Не удалось загрузить список чатов', error)
      })
      .finally(() => {
        if (!controller.signal.aborted) enqueueKnownChats()
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
