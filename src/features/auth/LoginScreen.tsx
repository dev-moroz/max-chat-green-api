import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { isAbortError, type Credentials } from '../../api'
import { describeError } from '../../shared/lib/describeError'
import { useChatStore } from '../../store/chatStore'
import { useSessionStore } from '../../store/sessionStore'
import { verifyCredentials } from './verifyCredentials'
import styles from './LoginScreen.module.css'

const EMPTY: Credentials = { apiUrl: '', idInstance: '', apiTokenInstance: '' }

export function LoginScreen() {
  const login = useSessionStore((s) => s.login)
  const bindInstance = useChatStore((s) => s.bindInstance)

  const [form, setForm] = useState<Credentials>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const update = (field: keyof Credentials) => (value: string) => setForm((f) => ({ ...f, [field]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const credentials: Credentials = {
      apiUrl: form.apiUrl.trim(),
      idInstance: form.idInstance.trim(),
      apiTokenInstance: form.apiTokenInstance.trim(),
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await verifyCredentials(credentials, controller.signal)
      if (!result.ok) {
        setError(result.error)
        return
      }
      bindInstance(credentials.idInstance)
      login(credentials)
    } catch (e) {
      if (!isAbortError(e)) setError(describeError(e))
    } finally {
      if (!controller.signal.aborted) setIsSubmitting(false)
    }
  }

  return (
    <main className={styles.screen}>
      <form className={styles.card} onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className={styles.logo} aria-hidden="true">
          M
        </div>
        <h1 className={styles.title}>Вход в MAX</h1>
        <p className={styles.subtitle}>
          Данные инстанса из{' '}
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer">
            личного кабинета Green-API
          </a>
        </p>

        <Field
          label="apiUrl"
          value={form.apiUrl}
          onChange={update('apiUrl')}
          placeholder="https://3100.api.green-api.com"
          inputMode="url"
          autoFocus
        />
        <Field
          label="idInstance"
          value={form.idInstance}
          onChange={update('idInstance')}
          placeholder="3100123456"
          inputMode="numeric"
          pattern="\d+"
          title="Только цифры"
        />
        <Field
          label="apiTokenInstance"
          value={form.apiTokenInstance}
          onChange={update('apiTokenInstance')}
          type="password"
          autoComplete="off"
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Проверяем…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange(value: string): void
}

function Field({ label, onChange, ...input }: FieldProps) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        required
        spellCheck={false}
        {...input}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
