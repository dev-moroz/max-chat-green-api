import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isAbortError } from '../../api'
import { describeError } from '../../shared/lib/describeError'
import { getApiClient } from '../../store/sessionStore'
import { createChat } from './createChat'
import styles from './NewChatForm.module.css'

export function NewChatForm() {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsChecking(true)
    setError(null)

    try {
      const result = await createChat(phone, getApiClient(), controller.signal)
      if (result.ok) setPhone('')
      else setError(result.error)
    } catch (e) {
      if (!isAbortError(e)) setError(describeError(e))
    } finally {
      if (!controller.signal.aborted) setIsChecking(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-busy={isChecking}>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setError(null)
          }}
          placeholder="Новый чат: +7 999 123-45-67"
          aria-label="Номер телефона получателя"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'new-chat-error' : undefined}
          autoComplete="off"
        />
        <button
          className={styles.button}
          type="submit"
          disabled={isChecking || !phone.trim()}
          aria-label="Создать чат"
          title="Создать чат"
        >
          {isChecking ? '…' : '+'}
        </button>
      </div>
      {error && (
        <p id="new-chat-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
