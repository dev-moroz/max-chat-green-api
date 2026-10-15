import { chatTitle, useChatStore } from '../../store/chatStore'
import { Avatar } from '../../shared/ui/Avatar'
import { formatPhone } from '../../shared/lib/phone'
import styles from './ChatPanel.module.css'

interface ChatPanelProps {
  chatId: string
  onBack(): void
}

/** Окно переписки. Лента сообщений и поле ввода — этап 6. */
export function ChatPanel({ chatId, onBack }: ChatPanelProps) {
  const chat = useChatStore((s) => s.chats[chatId])
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
      <div className={styles.feed}>
        <p className={styles.empty}>Сообщений пока нет</p>
      </div>
    </section>
  )
}
