import { describe, expect, it, vi } from 'vitest'
import { ApiError, type GreenApiClient, type ReceivedNotification } from '../api'
import { runPoller, type PollerStatus } from './notificationPoller'

type Step = ReceivedNotification | null | Error

const textNotification = (receiptId: number, idMessage: string, text = 'Привет'): ReceivedNotification => ({
  receiptId,
  body: {
    typeWebhook: 'incomingMessageReceived',
    timestamp: 1763115112,
    idMessage,
    senderData: { chatId: '100', senderName: 'Друг' },
    messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } },
  },
})

const statusNotification = (receiptId: number): ReceivedNotification => ({
  receiptId,
  body: { typeWebhook: 'outgoingMessageStatus', status: 'delivered', idMessage: 'x' },
})

/**
 * Клиент-заглушка: отдаёт шаги по очереди, после последнего шага отменяет поллер.
 * Так тест детерминированно заканчивается без таймеров.
 */
function scriptedClient(steps: Step[], controller: AbortController) {
  const queue = [...steps]
  const deleted: number[] = []
  const client = {
    receiveNotification: vi.fn<GreenApiClient['receiveNotification']>(async () => {
      const step = queue.shift()
      if (queue.length === 0) queueMicrotask(() => controller.abort())
      if (step instanceof Error) throw step
      return step ?? null
    }),
    deleteNotification: vi.fn<GreenApiClient['deleteNotification']>(async (receiptId) => {
      deleted.push(receiptId)
    }),
  }
  return { client, deleted }
}

function setup(steps: Step[]) {
  const controller = new AbortController()
  const { client, deleted } = scriptedClient(steps, controller)
  const messages: string[] = []
  const statuses: PollerStatus[] = []
  const sleeps: number[] = []
  const run = () =>
    runPoller({
      client,
      signal: controller.signal,
      locks: undefined,
      onMessage: (event) => messages.push(event.text),
      onStatus: (status) => statuses.push(status),
      backoff: { initialMs: 100, maxMs: 400 },
      sleep: async (ms) => {
        sleeps.push(ms)
      },
    })
  return { run, client, deleted, messages, statuses, sleeps, controller }
}

describe('runPoller', () => {
  it('передаёт текстовые сообщения и удаляет каждое уведомление, включая нерелевантные', async () => {
    const t = setup([
      textNotification(1, 'a'),
      statusNotification(2),
      textNotification(3, 'b', 'Как дела?'),
      null,
    ])
    await t.run()

    expect(t.messages).toEqual(['Привет', 'Как дела?'])
    expect(t.deleted).toEqual([1, 2, 3])
  })

  it('пустой long-poll (null) не вызывает deleteNotification', async () => {
    const t = setup([null, null])
    await t.run()
    expect(t.client.deleteNotification).not.toHaveBeenCalled()
    expect(t.client.receiveNotification).toHaveBeenCalledTimes(2)
  })

  it('при ошибках ждёт с экспоненциальной задержкой и сбрасывает её после успеха', async () => {
    const networkError = new ApiError('receiveNotification', 0, 'offline')
    const t = setup([networkError, networkError, networkError, networkError, null, networkError, null])
    await t.run()

    expect(t.sleeps).toEqual([100, 200, 400, 400, 100])
    expect(t.statuses).toEqual(['connecting', 'offline', 'online', 'offline', 'online'])
  })

  it('ошибка в обработчике не блокирует очередь', async () => {
    const controller = new AbortController()
    const { client, deleted } = scriptedClient([textNotification(1, 'a'), null], controller)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runPoller({
      client,
      signal: controller.signal,
      locks: undefined,
      onMessage: () => {
        throw new Error('bug')
      },
    })

    expect(deleted).toEqual([1])
    expect(consoleError).toHaveBeenCalled()
  })

  it('отмена прерывает висящий long-poll и завершает цикл', async () => {
    const controller = new AbortController()
    const client = {
      receiveNotification: vi.fn<GreenApiClient['receiveNotification']>(
        (signal) =>
          new Promise((_, reject) => {
            signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
      deleteNotification: vi.fn<GreenApiClient['deleteNotification']>(),
    }

    const done = runPoller({ client, signal: controller.signal, locks: undefined, onMessage: () => {} })
    controller.abort()
    await expect(done).resolves.toBeUndefined()
    expect(client.receiveNotification).toHaveBeenCalledTimes(1)
  })

  it('с Web Locks опрашивает очередь только после получения блокировки', async () => {
    const t = setup([null])
    const request = vi.fn(async (_name: string, _options: LockOptions, callback: () => Promise<void>) =>
      callback(),
    )
    const locks = { request } as unknown as LockManager

    await runPoller({
      client: t.client,
      signal: t.controller.signal,
      locks,
      lockName: 'max-chat:poller:1',
      onMessage: () => {},
      onStatus: (s) => t.statuses.push(s),
    })

    expect(request).toHaveBeenCalledWith('max-chat:poller:1', expect.anything(), expect.any(Function))
    expect(t.statuses.slice(0, 2)).toEqual(['standby', 'connecting'])
  })

  it('отмена во время ожидания блокировки — штатное завершение', async () => {
    const controller = new AbortController()
    const locks = {
      request: (_name: string, options: LockOptions) =>
        new Promise((_, reject) =>
          options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        ),
    } as unknown as LockManager
    const { client } = scriptedClient([], controller)

    const done = runPoller({ client, signal: controller.signal, locks, lockName: 'x', onMessage: () => {} })
    controller.abort()
    await expect(done).resolves.toBeUndefined()
    expect(client.receiveNotification).not.toHaveBeenCalled()
  })
})
