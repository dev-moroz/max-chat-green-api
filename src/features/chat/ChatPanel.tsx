import { chatTitle, useChatStore } from '../../store/chatStore'
import { useHistoryStore } from '../../store/historyStore'
import { getApiClient } from '../../store/sessionStore'
import { Avatar } from '../../shared/ui/Avatar'
import { formatPhone } from '../../shared/lib/phone'
import { Composer } from './Composer'
import { MessageFeed } from './MessageFeed'
import { retryMessage, sendMessage } from './sendMessage'
import styles from './ChatPanel.module.css'

interface ChatPanelProps {
  chatId: string
  onBack(): void
}

export function ChatPanel({ chatId, onBack }: ChatPanelProps) {
  const chat = useChatStore((s) => s.chats[chatId])
  const historyStatus = useHistoryStore((s) => s.status[chatId])
  if (!chat) return null

  const title = chatTitle(chat)
  const subtitle = chat.name && chat.phone ? formatPhone(chat.phone) : 'MAX'

  return (
    <section className={styles.panel} aria-label={`Чат: ${title}`}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="Назад к списку чатов">
          ‹
        </button>
        <Avatar name={title} seed={chat.chatId} size={40} />
        <div className={styles.heading}>
          <h2 className={styles.title}>{title}</h2>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
      </header>
      <MessageFeed
        chatId={chatId}
        messages={chat.messages}
        historyStatus={historyStatus}
        onRetryHistory={() =>
          useHistoryStore.getState().loader?.request(chatId, { priority: true, force: true })
        }
        onRetry={(localId) => void retryMessage(chatId, localId, getApiClient())}
      />
      <Composer key={chatId} onSend={(text) => void sendMessage(chatId, text, getApiClient())} />
    </section>
  )
}
