import { useMemo } from 'react'
import { chatTitle, sortChatsByActivity, useChatStore } from '../../store/chatStore'
import type { Chat } from '../../store/types'
import { Avatar } from '../../shared/ui/Avatar'
import styles from './ChatList.module.css'

export function ChatList() {
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const selectChat = useChatStore((s) => s.selectChat)
  const sorted = useMemo(() => sortChatsByActivity(chats), [chats])

  if (sorted.length === 0) {
    return (
      <p className={styles.empty}>
        Чатов пока нет. Введите номер получателя выше — или дождитесь входящего сообщения.
      </p>
    )
  }

  return (
    <ul className={styles.list} aria-label="Чаты">
      {sorted.map((chat) => (
        <li key={chat.chatId}>
          <ChatListItem
            chat={chat}
            isActive={chat.chatId === activeChatId}
            onSelect={() => selectChat(chat.chatId)}
          />
        </li>
      ))}
    </ul>
  )
}

interface ChatListItemProps {
  chat: Chat
  isActive: boolean
  onSelect(): void
}

function ChatListItem({ chat, isActive, onSelect }: ChatListItemProps) {
  const title = chatTitle(chat)
  const last = chat.messages.at(-1)

  return (
    <button
      type="button"
      className={styles.item}
      data-active={isActive || undefined}
      aria-current={isActive || undefined}
      onClick={onSelect}
    >
      <Avatar name={title} seed={chat.chatId} />
      <span className={styles.body}>
        <span className={styles.top}>
          <span className={styles.title}>{title}</span>
          {last && <time className={styles.time}>{formatListTime(last.timestamp)}</time>}
        </span>
        <span className={styles.bottom}>
          <span className={styles.preview}>
            {last ? (
              <>
                {last.direction === 'outgoing' && <span className={styles.you}>Вы: </span>}
                {last.text}
              </>
            ) : (
              'Нет сообщений'
            )}
          </span>
          {chat.unreadCount > 0 && (
            <span className={styles.badge} aria-label={`Непрочитанных: ${chat.unreadCount}`}>
              {chat.unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

function formatListTime(timestamp: number): string {
  const date = new Date(timestamp)
  const isToday = date.toDateString() === new Date().toDateString()
  return isToday
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
