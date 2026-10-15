import { useEffect, useState } from 'react'
import { isAbortError, type InstanceSettings, type NotificationSettings } from '../../api'
import { describeError } from '../../shared/lib/describeError'
import { getApiClient, useSessionStore } from '../../store/sessionStore'
import styles from './NotificationSettingsWarning.module.css'

const REQUIRED_SETTINGS: NotificationSettings = {
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  outgoingMessageWebhook: 'yes',
  outgoingAPIMessageWebhook: 'yes',
  stateWebhook: 'yes',
}

function areNotificationsEnabled(settings: InstanceSettings): boolean {
  return settings.incomingWebhook === 'yes'
}

/**
 * HTTP API получает сообщения только когда типы уведомлений включены у инстанса.
 * Проверка выполняется после входа, чтобы проблема не выглядела как сбой приложения.
 */
export function NotificationSettingsWarning() {
  const credentials = useSessionStore((s) => s.credentials)
  const [settings, setSettings] = useState<InstanceSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isEnabling, setIsEnabling] = useState(false)
  const [wasEnabled, setWasEnabled] = useState(false)

  useEffect(() => {
    if (!credentials) return
    const controller = new AbortController()

    getApiClient()
      .getSettings(controller.signal)
      .then(setSettings)
      .catch((reason: unknown) => {
        if (!isAbortError(reason)) setError(describeError(reason))
      })

    return () => controller.abort()
  }, [credentials])

  if (error || !settings || areNotificationsEnabled(settings)) return null

  async function enable() {
    const accepted = window.confirm(
      'Включить уведомления Green-API для этого инстанса? Инстанс будет перезапущен, а изменения могут применяться до 5 минут.',
    )
    if (!accepted) return

    setIsEnabling(true)
    setError(null)
    try {
      await getApiClient().setSettings(REQUIRED_SETTINGS)
      setWasEnabled(true)
    } catch (reason) {
      setError(describeError(reason))
    } finally {
      setIsEnabling(false)
    }
  }

  return (
    <section className={styles.warning} role="status">
      <p>
        {wasEnabled
          ? 'Настройки сохранены. Инстанс перезапускается — сообщения начнут поступать в течение 5 минут.'
          : 'Входящие уведомления Green-API выключены: новые сообщения не смогут попасть в этот чат.'}
      </p>
      {!wasEnabled && (
        <button type="button" onClick={() => void enable()} disabled={isEnabling}>
          {isEnabling ? 'Включаем…' : 'Включить уведомления'}
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
