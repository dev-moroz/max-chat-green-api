import { Fragment, useLayoutEffect, useRef } from 'react'
import type { HistoryStatus } from '../../services/historyLoader'
import type { ChatMessage } from '../../store/types'
import styles from './MessageFeed.module.css'

interface MessageFeedProps {
  chatId: string
  messages: ChatMessage[]
  historyStatus?: HistoryStatus
  onRetry(localId: string): void
  onRetryHistory(): void
}

/** Насколько близко к низу (px) считаем, что пользователь «внизу» и автоскролл уместен */
const STICK_THRESHOLD = 120

export function MessageFeed({ chatId, messages, historyStatus, onRetry, onRetryHistory }: MessageFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const prevChatIdRef = useRef<string | null>(null)
  const lastMessage = messages.at(-1)

  useLayoutEffect(() => {
    const el = feedRef.current
    if (!el) return
    const chatChanged = prevChatIdRef.current !== chatId
    prevChatIdRef.current = chatId
    // Новый чат — сразу вниз. Новое сообщение — вниз, если пользователь не листает историю
    // или если сообщение отправил он сам.
    if (chatChanged || isAtBottomRef.current || lastMessage?.status === 'pending') {
      el.scrollTop = el.scrollHeight
    }
  }, [chatId, messages.length, lastMessage?.id, lastMessage?.status])

  function handleScroll() {
    const el = feedRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  }

  return (
    <div ref={feedRef} className={styles.feed} onScroll={handleScroll} role="log" aria-live="polite">
      {historyStatus === 'loading' && (
        <p className={styles.historyNotice} role="status">
          Загружаем историю…
        </p>
      )}
      {historyStatus === 'error' && (
        <p className={styles.historyNotice} role="alert">
          Не удалось загрузить историю.{' '}
          <button type="button" className={styles.link} onClick={onRetryHistory}>
            Повторить
          </button>
        </p>
      )}
      {messages.length === 0 ? (
        historyStatus !== 'loading' && <p className={styles.notice}>Сообщений пока нет. Напишите первым.</p>
      ) : (
        <ol className={styles.list}>
          {messages.map((message, index) => {
            const showDate = index === 0 || !isSameDay(messages[index - 1].timestamp, message.timestamp)
            return (
              <Fragment key={message.id}>
                {showDate && (
                  <li className={styles.date}>
                    <span>{formatDay(message.timestamp)}</span>
                  </li>
                )}
                <MessageBubble message={message} onRetry={onRetry} />
              </Fragment>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry(localId: string): void }) {
  const isOutgoing = message.direction === 'outgoing'
  return (
    <li className={styles.row} data-outgoing={isOutgoing || undefined}>
      <div className={styles.bubble} data-status={message.status}>
        {message.media && (
          <span className={styles.media}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M10.5 4.5 5.2 9.8a1.5 1.5 0 0 0 2.1 2.1l5.6-5.6a3 3 0 0 0-4.2-4.2L3 7.8a4.5 4.5 0 0 0 6.4 6.4l4.1-4.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            {message.media}
          </span>
        )}
        {message.text && <p className={styles.text}>{message.text}</p>}
        <span className={styles.meta}>
          <time dateTime={new Date(message.timestamp).toISOString()}>{formatTime(message.timestamp)}</time>
          {isOutgoing && <StatusIcon status={message.status} />}
        </span>
      </div>
      {message.status === 'failed' && (
        <button type="button" className={styles.retry} onClick={() => onRetry(message.id)}>
          Не отправлено. Повторить
        </button>
      )}
    </li>
  )
}

function StatusIcon({ status }: { status: ChatMessage['status'] }) {
  if (status === 'pending') {
    return (
      <svg className={styles.status} viewBox="0 0 16 16" aria-label="Отправляется">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3.5l2 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg className={styles.status} data-failed viewBox="0 0 16 16" aria-label="Ошибка отправки">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M8 4.5v4.5M8 11.2v.3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className={styles.status} viewBox="0 0 16 16" aria-label="Отправлено">
      <path
        d="m3 8.5 3 3 7-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function isSameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Сегодня'
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера'
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}
