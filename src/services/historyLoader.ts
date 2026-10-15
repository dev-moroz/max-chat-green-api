import { isAbortError, parseHistoryItem, type ChatMessageEvent, type GreenApiClient } from '../api'
import { abortableSleep } from '../shared/lib/sleep'

export type HistoryStatus = 'loading' | 'loaded' | 'error'

export interface HistoryLoaderOptions {
  client: Pick<GreenApiClient, 'getChatHistory'>
  onHistory(chatId: string, events: ChatMessageEvent[]): void
  onStatus(chatId: string, status: HistoryStatus): void
  signal: AbortSignal
  /** Сколько последних сообщений грузить на чат. MAX отдаёт до 5 000 за последние 3 месяца. */
  count?: number
  /** getChatHistory ограничен 1 запросом в секунду — держим паузу с запасом */
  minIntervalMs?: number
  sleep?(ms: number, signal: AbortSignal): Promise<void>
}

export interface HistoryLoader {
  /**
   * Поставить чат в очередь. priority — в начало: открытый пользователем чат
   * не должен ждать, пока фоном догрузятся остальные.
   * Уже загруженный в этой сессии чат повторно не грузится.
   */
  request(chatId: string, options?: { priority?: boolean; force?: boolean }): void
}

/** Последовательная очередь запросов истории с паузой между ними. */
export function createHistoryLoader(options: HistoryLoaderOptions): HistoryLoader {
  const { client, signal } = options
  const count = options.count ?? 5_000
  const interval = options.minIntervalMs ?? 1_100
  const sleep = options.sleep ?? abortableSleep

  const queue: string[] = []
  const loaded = new Set<string>()
  let inFlight: string | null = null
  let running = false

  async function run() {
    running = true
    while (queue.length > 0 && !signal.aborted) {
      const chatId = queue.shift()!
      inFlight = chatId
      options.onStatus(chatId, 'loading')
      try {
        const items = await client.getChatHistory(chatId, count, signal)
        const events = items
          .map((item) => parseHistoryItem(item, chatId))
          .filter((e): e is ChatMessageEvent => e !== null)
        loaded.add(chatId)
        options.onHistory(chatId, events)
        options.onStatus(chatId, 'loaded')
      } catch (error) {
        if (signal.aborted || isAbortError(error)) break
        options.onStatus(chatId, 'error')
      } finally {
        inFlight = null
      }
      try {
        await sleep(interval, signal)
      } catch {
        break
      }
    }
    running = false
  }

  return {
    request(chatId, { priority = false, force = false } = {}) {
      if (signal.aborted || inFlight === chatId) return
      if (loaded.has(chatId) && !force) return
      if (force) loaded.delete(chatId)

      const index = queue.indexOf(chatId)
      if (index !== -1) {
        if (!priority) return
        queue.splice(index, 1)
      }
      if (priority) queue.unshift(chatId)
      else queue.push(chatId)

      if (!running) void run()
    },
  }
}
