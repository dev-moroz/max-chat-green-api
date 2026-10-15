import { LoginScreen } from '../features/auth/LoginScreen'
import { useSessionStore } from '../store/sessionStore'
import { ChatLayout } from './ChatLayout'

export function App() {
  const isLoggedIn = useSessionStore((s) => s.credentials !== null)
  return isLoggedIn ? <ChatLayout /> : <LoginScreen />
}
