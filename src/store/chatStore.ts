import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { TextMessageEvent } from '../api'
import { formatPhone } from '../shared/lib/phone'
import type { Chat, ChatMessage } from './types'

interface ChatState {
  /** Инстанс, которому принадлежат чаты; при входе в другой инстанс история сбрасывается */
  instanceId: string | null
  chats: Record<string, Chat>
  activeChatId: string | null

  /** Привязать стор к инстансу; чаты чужого инстанса удаляются */
  bindInstance(instanceId: string): void
  /** Открыть чат, создав его при необходимости */
  openChat(chat: { chatId: string; phone?: string; name?: string }): void
  selectChat(chatId: string | null): void
  /** Найти чат по номеру — чтобы не вызывать CheckAccount повторно */
  findChatIdByPhone(phone: string): string | undefined

  /** Оптимистично добавить исходящее; возвращает локальный id */
  addPendingMessage(chatId: string, text: string): string
  markMessageSent(chatId: string, localId: string, idMessage: string): void
  markMessageFailed(chatId: string, localId: string): void
  /** Повторная отправка: failed → pending */
  markMessageRetrying(chatId: string, localId: string): void

  /** Применить сообщение из уведомления (входящее или исходящее с другого устройства) */
  applyTextMessage(event: TextMessageEvent): void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      instanceId: null,
      chats: {},
      activeChatId: null,

      bindInstance(instanceId) {
        if (get().instanceId === instanceId) return
        set({ instanceId, chats: {}, activeChatId: null })
      },

      openChat({ chatId, phone, name }) {
        set((state) => {
          const existing = state.chats[chatId]
          const chat: Chat = existing
            ? { ...existing, phone: existing.phone ?? phone, name: existing.name ?? name, unreadCount: 0 }
            : { chatId, phone, name, messages: [], unreadCount: 0, createdAt: Date.now() }
          return { chats: { ...state.chats, [chatId]: chat }, activeChatId: chatId }
        })
      },

      selectChat(chatId) {
        set((state) => {
          if (!chatId || !state.chats[chatId]) return { activeChatId: null }
          return {
            activeChatId: chatId,
            chats: { ...state.chats, [chatId]: { ...state.chats[chatId], unreadCount: 0 } },
          }
        })
      },

      findChatIdByPhone(phone) {
        return Object.values(get().chats).find((chat) => chat.phone === phone)?.chatId
      },

      addPendingMessage(chatId, text) {
        const id = `local-${crypto.randomUUID()}`
        const message: ChatMessage = {
          id,
          direction: 'outgoing',
          text,
          timestamp: Date.now(),
          status: 'pending',
        }
        set((state) =>
          updateChat(state, chatId, (chat) => ({ ...chat, messages: [...chat.messages, message] })),
        )
        return id
      },

      markMessageSent(chatId, localId, idMessage) {
        set((state) =>
          updateChat(state, chatId, (chat) => {
            // Уведомление outgoingAPIMessageReceived могло прийти раньше ответа sendMessage —
            // тогда сообщение с этим idMessage уже есть, и локальную копию надо убрать
            const duplicate = chat.messages.some((m) => m.idMessage === idMessage && m.id !== localId)
            const messages = duplicate
              ? chat.messages.filter((m) => m.id !== localId)
              : chat.messages.map((m) =>
                  m.id === localId ? { ...m, idMessage, status: 'sent' as const } : m,
                )
            return { ...chat, messages }
          }),
        )
      },

      markMessageFailed(chatId, localId) {
        set((state) => setMessageStatus(state, chatId, localId, 'failed'))
      },

      markMessageRetrying(chatId, localId) {
        set((state) => setMessageStatus(state, chatId, localId, 'pending'))
      },

      applyTextMessage(event) {
        set((state) => {
          const existing = state.chats[event.chatId]
          const chat: Chat = existing ?? {
            chatId: event.chatId,
            messages: [],
            unreadCount: 0,
            createdAt: event.timestamp,
          }

          // Дедупликация: своё сообщение, отправленное через API, приходит ещё и уведомлением
          if (chat.messages.some((m) => m.idMessage === event.idMessage)) return state

          const message: ChatMessage = {
            id: event.idMessage,
            idMessage: event.idMessage,
            direction: event.direction,
            text: event.text,
            timestamp: event.timestamp,
            ...(event.direction === 'outgoing' ? { status: 'sent' as const } : {}),
          }

          const isActive = state.activeChatId === event.chatId
          const updated: Chat = {
            ...chat,
            name: chat.name ?? event.chatName,
            // Порядок — по поступлению: очередь Green-API отдаёт уведомления строго FIFO,
            // а сортировка по timestamp ломается из-за секундной точности сервера
            // и расхождения часов клиента и сервера
            messages: [...chat.messages, message],
            unreadCount:
              event.direction === 'incoming' && !isActive ? chat.unreadCount + 1 : chat.unreadCount,
          }
          return { chats: { ...state.chats, [event.chatId]: updated } }
        })
      },
    }),
    {
      name: 'max-chat:chats',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ instanceId, chats, activeChatId }) => ({ instanceId, chats, activeChatId }),
      // Отправки, не дождавшиеся ответа до перезагрузки, считаем неудачными — их можно повторить
      merge: (persisted, current) => {
        const state = persisted as Partial<ChatState> | undefined
        const chats = Object.fromEntries(
          Object.entries(state?.chats ?? {}).map(([id, chat]) => [
            id,
            {
              ...chat,
              messages: chat.messages.map((m) =>
                m.status === 'pending' ? { ...m, status: 'failed' as const } : m,
              ),
            },
          ]),
        )
        return { ...current, ...state, chats }
      },
    },
  ),
)

function updateChat(state: ChatState, chatId: string, update: (chat: Chat) => Chat): Partial<ChatState> {
  const chat = state.chats[chatId]
  if (!chat) return {}
  return { chats: { ...state.chats, [chatId]: update(chat) } }
}

function setMessageStatus(
  state: ChatState,
  chatId: string,
  localId: string,
  status: ChatMessage['status'],
): Partial<ChatState> {
  return updateChat(state, chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((m) => (m.id === localId ? { ...m, status } : m)),
  }))
}

/** Чаты для сайдбара: свежие сверху. Возвращает новый массив — вызывать в useMemo, не в селекторе */
export function sortChatsByActivity(chats: Record<string, Chat>): Chat[] {
  const lastTime = (chat: Chat) => chat.messages.at(-1)?.timestamp ?? chat.createdAt
  return Object.values(chats).sort((a, b) => lastTime(b) - lastTime(a))
}

export function chatTitle(chat: Chat): string {
  return chat.name || (chat.phone ? formatPhone(chat.phone) : `ID ${chat.chatId}`)
}
