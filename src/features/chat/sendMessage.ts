import { MAX_MESSAGE_LENGTH, type GreenApiClient } from '../../api'
import { useChatStore } from '../../store/chatStore'

/**
 * Оптимистичная отправка: сообщение сразу появляется в ленте со статусом pending,
 * после ответа API становится sent, при ошибке — failed с возможностью повтора.
 */
export async function sendMessage(chatId: string, rawText: string, client: GreenApiClient): Promise<void> {
  const text = rawText.trim()
  if (!text || text.length > MAX_MESSAGE_LENGTH) return

  const localId = useChatStore.getState().addPendingMessage(chatId, text)
  await deliver(chatId, localId, text, client)
}

export async function retryMessage(chatId: string, localId: string, client: GreenApiClient): Promise<void> {
  const message = useChatStore.getState().chats[chatId]?.messages.find((m) => m.id === localId)
  if (!message || message.status !== 'failed') return

  useChatStore.getState().markMessageRetrying(chatId, localId)
  await deliver(chatId, localId, message.text, client)
}

async function deliver(chatId: string, localId: string, text: string, client: GreenApiClient) {
  try {
    const { idMessage } = await client.sendMessage(chatId, text)
    useChatStore.getState().markMessageSent(chatId, localId, idMessage)
  } catch {
    // Текст ошибки не показываем у каждого пузыря: статус failed и кнопка повтора понятнее
    useChatStore.getState().markMessageFailed(chatId, localId)
  }
}
