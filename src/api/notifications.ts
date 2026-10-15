import type { ChatMessageEvent, HistoryItem, WebhookBody } from './types'

/**
 * Типы уведомлений, которые несут сообщения:
 * - incomingMessageReceived — пришло от собеседника
 * - outgoingMessageReceived — отправлено с телефона (или в «Избранное»)
 * - outgoingAPIMessageReceived — отправлено через API, в том числе этим приложением
 */
const DIRECTION_BY_TYPE: Record<string, ChatMessageEvent['direction']> = {
  incomingMessageReceived: 'incoming',
  outgoingMessageReceived: 'outgoing',
  outgoingAPIMessageReceived: 'outgoing',
}

/**
 * Задание требует только текст, поэтому вложения не скачиваем и не отправляем.
 * Но если собеседник прислал фото, молча пропустить его — значит исказить переписку,
 * поэтому показываем подпись-заглушку.
 */
const MEDIA_LABELS: Record<string, string> = {
  imageMessage: 'Фото',
  videoMessage: 'Видео',
  audioMessage: 'Аудио',
  documentMessage: 'Документ',
  stickerMessage: 'Стикер',
  locationMessage: 'Геолокация',
  contactMessage: 'Контакт',
  pollMessage: 'Опрос',
}

interface Content {
  text: string
  media?: string
}

/**
 * Извлекает сообщение из уведомления. Возвращает null для статусов, сервисных событий
 * и неизвестных типов. Тело приходит из сети, поэтому каждое поле проверяется в рантайме.
 */
export function parseNotification(body: WebhookBody): ChatMessageEvent | null {
  const direction = DIRECTION_BY_TYPE[body.typeWebhook]
  if (!direction) return null

  const senderData = asRecord(body.senderData)
  const messageData = asRecord(body.messageData)
  if (!senderData || !messageData) return null

  const chatId = asId(senderData.chatId)
  const idMessage = asId(body.idMessage)
  const content = notificationContent(messageData)
  if (!chatId || !idMessage || !content) return null

  return {
    direction,
    idMessage,
    chatId,
    chatName: asString(senderData.chatName) || asString(senderData.senderName) || undefined,
    ...content,
    timestamp: toMs(body.timestamp),
  }
}

/** Разбирает элемент getChatHistory */
export function parseHistoryItem(item: HistoryItem, chatId: string): ChatMessageEvent | null {
  const direction = item.type === 'incoming' || item.type === 'outgoing' ? item.type : null
  const idMessage = asId(item.idMessage)
  const content = historyContent(item)
  if (!direction || !idMessage || !content) return null

  return {
    direction,
    idMessage,
    chatId: asId(item.chatId) ?? chatId,
    ...content,
    timestamp: toMs(item.timestamp),
  }
}

function notificationContent(messageData: Record<string, unknown>): Content | null {
  const type = messageData.typeMessage
  switch (type) {
    case 'textMessage':
      return textContent(asRecord(messageData.textMessageData)?.textMessage)
    // Текст со ссылкой и ответ с цитатой — тоже текст для пользователя
    case 'extendedTextMessage':
    case 'quotedMessage':
      return textContent(asRecord(messageData.extendedTextMessageData)?.text)
  }
  const file = asRecord(messageData.fileMessageData)
  return mediaContent(type, asString(file?.caption), asString(file?.fileName))
}

function historyContent(item: HistoryItem): Content | null {
  const type = item.typeMessage
  switch (type) {
    case 'textMessage':
      return textContent(item.textMessage)
    case 'extendedTextMessage':
    case 'quotedMessage':
      return textContent(item.textMessage ?? asRecord(item.extendedTextMessage)?.text)
  }
  return mediaContent(type, asString(item.caption), asString(item.fileName))
}

function textContent(value: unknown): Content | null {
  const text = asString(value)
  return text === null ? null : { text }
}

function mediaContent(type: unknown, caption: string | null, fileName: string | null): Content | null {
  const label = typeof type === 'string' ? MEDIA_LABELS[type] : undefined
  if (!label) return null
  const media = type === 'documentMessage' && fileName ? `${label}: ${fileName}` : label
  return { text: caption ?? '', media }
}

function toMs(seconds: unknown): number {
  return typeof seconds === 'number' && Number.isFinite(seconds) ? Math.round(seconds * 1000) : Date.now()
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
