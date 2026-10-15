export type MessageStatus = 'pending' | 'sent' | 'failed'

export interface ChatMessage {
  /** Локальный ключ: idMessage от сервера, а до ответа sendMessage — временный id */
  id: string
  /** Серверный идентификатор; нужен для дедупликации уведомлений */
  idMessage?: string
  direction: 'incoming' | 'outgoing'
  text: string
  /** Unix-время в миллисекундах */
  timestamp: number
  /** Только для исходящих, отправленных из этого приложения */
  status?: MessageStatus
}

export interface Chat {
  chatId: string
  /** Номер, по которому создан чат (если создан вручную) */
  phone?: string
  /** Имя из уведомлений MAX; если неизвестно — показываем номер или chatId */
  name?: string
  messages: ChatMessage[]
  unreadCount: number
  /** Когда чат появился в списке; для сортировки пустых чатов */
  createdAt: number
}
