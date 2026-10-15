import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from '../../api'
import styles from './Composer.module.css'

interface ComposerProps {
  onSend(text: string): void
}

const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 500

/** Черновик сбрасывается при смене чата: родитель передаёт key={chatId} */
export function Composer({ onSend }: ComposerProps) {
  const [text, setText] = useState('')

  const trimmedLength = text.trim().length
  const isTooLong = text.length > MAX_MESSAGE_LENGTH
  const canSend = trimmedLength > 0 && !isTooLong

  function submit() {
    if (!canSend) return
    onSend(text)
    setText('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter — отправить, Shift+Enter — перенос строки; не мешаем вводу через IME
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <textarea
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение"
          aria-label="Текст сообщения"
          aria-invalid={isTooLong || undefined}
          rows={1}
          autoFocus
        />
        {text.length > COUNTER_THRESHOLD && (
          <span className={styles.counter} data-error={isTooLong || undefined} aria-live="polite">
            {text.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
      <button className={styles.send} type="submit" disabled={!canSend} aria-label="Отправить">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
        </svg>
      </button>
    </form>
  )
}
