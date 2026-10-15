import { isAbortError, parseNotification, type GreenApiClient, type ChatMessageEvent } from '../api'
import { abortableSleep } from '../shared/lib/sleep'

/**
 * connecting — первый запрос ещё не вернулся
 * online — очередь опрашивается
 * offline — ошибка сети или API, ждём и пробуем снова
 * standby — очередь уже опрашивает другая вкладка
 */
export type PollerStatus = 'connecting' | 'online' | 'offline' | 'standby'

export interface PollerOptions {
  client: Pick<GreenApiClient, 'receiveNotification' | 'deleteNotification'>
  onMessage(event: ChatMessageEvent): void
  onStatus?(status: PollerStatus): void
  signal: AbortSignal
  /**
   * Имя Web Lock. Очередь уведомлений у инстанса одна: две вкладки, опрашивающие её параллельно,
   * забирали бы и удаляли уведомления друг у друга. С блокировкой опрашивает только одна вкладка,
   * остальные ждут и подхватывают, когда она закроется.
   */
  lockName?: string
  locks?: LockManager | undefined
  backoff?: { initialMs: number; maxMs: number }
  sleep?(ms: number, signal: AbortSignal): Promise<void>
}

const DEFAULT_BACKOFF = { initialMs: 1_000, maxMs: 30_000 }

/** Работает, пока не отменён signal. Никогда не бросает исключений наружу. */
export async function runPoller(options: PollerOptions): Promise<void> {
  const locks = 'locks' in options ? options.locks : globalThis.navigator?.locks
  const report = dedupeStatus(options.onStatus)

  if (!options.lockName || !locks) {
    await pollLoop(options, report)
    return
  }

  report('standby')
  try {
    await locks.request(options.lockName, { signal: options.signal }, () => pollLoop(options, report))
  } catch (error) {
    // Отмена, пока ждали блокировку, — штатное завершение
    if (!isAbortError(error)) throw error
  }
}

/**
 * Цикл HTTP API: receiveNotification (long-poll) → обработка → deleteNotification.
 * Удаляем КАЖДОЕ уведомление, даже нерелевантное (статусы, медиа): иначе оно остаётся
 * в начале очереди и receiveNotification возвращает его снова и снова.
 */
async function pollLoop(options: PollerOptions, report: (status: PollerStatus) => void): Promise<void> {
  const { client, signal } = options
  const backoff = options.backoff ?? DEFAULT_BACKOFF
  const sleep = options.sleep ?? abortableSleep
  let delay = backoff.initialMs

  async function waitAfterError() {
    report('offline')
    await sleep(delay, signal)
    delay = Math.min(delay * 2, backoff.maxMs)
  }

  report('connecting')

  while (!signal.aborted) {
    let notification
    try {
      notification = await client.receiveNotification(signal)
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return
      await waitAfterError().catch(() => {})
      continue
    }

    delay = backoff.initialMs
    report('online')
    if (!notification) continue // за время long-poll ничего не пришло

    try {
      const event = parseNotification(notification.body)
      if (event) options.onMessage(event)
    } catch (error) {
      // Ошибка в обработчике не должна блокировать очередь — уведомление всё равно удаляем
      console.error('Не удалось обработать уведомление', error)
    }

    try {
      await client.deleteNotification(notification.receiptId, signal)
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return
      // Уведомление придёт повторно; дубль отсечёт дедупликация по idMessage в сторе
      await waitAfterError().catch(() => {})
    }
  }
}

function dedupeStatus(onStatus: PollerOptions['onStatus']) {
  let last: PollerStatus | null = null
  return (status: PollerStatus) => {
    if (status === last) return
    last = status
    onStatus?.(status)
  }
}
