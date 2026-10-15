/**
 * Типы Green-API для MAX (v3).
 * Документация: https://green-api.com/v3/docs/api/
 */

export interface Credentials {
  /** Хост инстанса из личного кабинета, например https://3100.api.green-api.com */
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

/** Состояние инстанса из getStateInstance. Список неполный — сервер может прислать и другие значения. */
export type InstanceState =
  'authorized' | 'notAuthorized' | 'blocked' | 'starting' | 'yellowCard' | (string & {})

export interface StateInstanceResponse {
  stateInstance: InstanceState
}

export type CheckAccountResult = { exist: true; chatId: string } | { exist: false }

export interface SendMessageResponse {
  idMessage: string
}

/**
 * Тело уведомления. Приходит из сети, поэтому снаружи считаем его недоверенным:
 * знаем только поле typeWebhook, остальное разбираем рантайм-проверками в notifications.ts.
 */
export interface WebhookBody {
  typeWebhook: string
  [key: string]: unknown
}

export interface ReceivedNotification {
  receiptId: number
  body: WebhookBody
}

/** Нормализованное сообщение из уведомления или истории чата. */
export interface ChatMessageEvent {
  /** incoming — от собеседника; outgoing — отправлено с телефона или через API */
  direction: 'incoming' | 'outgoing'
  idMessage: string
  chatId: string
  /** Имя чата, если сервер его прислал */
  chatName?: string
  /** Текст или подпись к вложению; может быть пустым у вложения без подписи */
  text: string
  /** Подпись вложения для отображения: «Фото», «Документ: отчёт.pdf». Сами файлы не загружаем */
  media?: string
  /** Unix-время в миллисекундах */
  timestamp: number
}

/** Чат из getChats */
export interface ChatInfo {
  chatId: string
  name: string
  type: 'user' | 'group' | 'channel' | 'bot' | (string & {})
  /** 0, если номер скрыт или это группа */
  phoneNumber: number
}

/**
 * Элемент getChatHistory. Поля плоские, в отличие от уведомлений.
 * Как и уведомления, разбирается рантайм-проверками в notifications.ts.
 */
export type HistoryItem = Record<string, unknown>
