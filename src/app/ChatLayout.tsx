import { ChatPanel } from '../features/chat/ChatPanel'
import { ChatList } from '../features/chats/ChatList'
import { NewChatForm } from '../features/chats/NewChatForm'
import { useChatStore } from '../store/chatStore'
import { useSessionStore } from '../store/sessionStore'
import styles from './ChatLayout.module.css'

export function ChatLayout() {
  const idInstance = useSessionStore((s) => s.credentials?.idInstance)
  const logout = useSessionStore((s) => s.logout)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const selectChat = useChatStore((s) => s.selectChat)

  return (
    <div className={styles.layout} data-chat-open={activeChatId ? true : undefined}>
      <aside className={styles.sidebar}>
        <header className={styles.sidebarHeader}>
          <div>
            <h1 className={styles.sidebarTitle}>Чаты</h1>
            <span className={styles.instance}>Инстанс {idInstance}</span>
          </div>
          <button type="button" className={styles.logout} onClick={logout}>
            Выйти
          </button>
        </header>
        <NewChatForm />
        <nav className={styles.chats}>
          <ChatList />
        </nav>
      </aside>

      <main className={styles.main}>
        {activeChatId ? (
          <ChatPanel chatId={activeChatId} onBack={() => selectChat(null)} />
        ) : (
          <div className={styles.placeholder}>
            <p>Выберите чат или создайте новый по номеру телефона</p>
          </div>
        )}
      </main>
    </div>
  )
}
