import type { TextMessageEvent, WebhookBody } from './types'

/**
 * Типы уведомлений, которые несут сообщения:
 * - incomingMessageReceived — пришло от собеседника
 * - outgoingMessageReceived — отправлено с телефона (или в «Избранное»)
 * - outgoingAPIMessageReceived — отправлено через API, в том числе этим приложением
 */
const DIRECTION_BY_TYPE: Record<string, TextMessageEvent['direction']> = {
  incomingMessageReceived: 'incoming',
  outgoingMessageReceived: 'outgoing',
  outgoingAPIMessageReceived: 'outgoing',
}

/**
 * Извлекает текстовое сообщение из уведомления.
 * Возвращает null для всего остального: статусов, медиа, сервисных событий.
 * Тело приходит из сети, поэтому каждое поле проверяется в рантайме, а не приводится через `as`.
 */
export function parseTextMessage(body: WebhookBody): TextMessageEvent | null {
  const direction = DIRECTION_BY_TYPE[body.typeWebhook]
  if (!direction) return null

  const senderData = asRecord(body.senderData)
  const messageData = asRecord(body.messageData)
  if (!senderData || !messageData) return null

  const chatId = asId(senderData.chatId)
  const idMessage = asId(body.idMessage)
  const text = extractText(messageData)
  if (!chatId || !idMessage || text === null) return null

  const timestampSeconds = typeof body.timestamp === 'number' ? body.timestamp : Date.now() / 1000

  return {
    direction,
    idMessage,
    chatId,
    chatName: asString(senderData.chatName) || asString(senderData.senderName) || undefined,
    text,
    timestamp: Math.round(timestampSeconds * 1000),
  }
}

function extractText(messageData: Record<string, unknown>): string | null {
  switch (messageData.typeMessage) {
    case 'textMessage':
      return asString(asRecord(messageData.textMessageData)?.textMessage)
    // Текст со ссылкой и ответ с цитатой — тоже текст для пользователя
    case 'extendedTextMessage':
    case 'quotedMessage':
      return asString(asRecord(messageData.extendedTextMessageData)?.text)
    default:
      return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Идентификаторы в MAX числовые; документация обещает строки, но число тоже принимаем */
function asId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return asString(value) || null
}
