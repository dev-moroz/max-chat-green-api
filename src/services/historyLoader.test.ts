import { describe, expect, it, vi } from 'vitest'
import { ApiError, type GreenApiClient } from '../api'
import { createHistoryLoader, type HistoryStatus } from './historyLoader'

const item = (idMessage: string) => ({
  type: 'incoming',
  idMessage,
  timestamp: 1,
  typeMessage: 'textMessage',
  textMessage: idMessage,
})

function setup(getChatHistory: GreenApiClient['getChatHistory']) {
  const controller = new AbortController()
  const order: string[] = []
  const statuses: Array<[string, HistoryStatus]> = []
  const histories: Record<string, string[]> = {}
  const sleeps: number[] = []
  let releaseSleep: () => void = () => {}

  const client = {
    getChatHistory: vi.fn<GreenApiClient['getChatHistory']>(async (chatId, ...rest) => {
      order.push(chatId)
      return getChatHistory(chatId, ...rest)
    }),
  }
  const loader = createHistoryLoader({
    client,
    signal: controller.signal,
    count: 20,
    minIntervalMs: 1_100,
    onHistory: (chatId, events) => (histories[chatId] = events.map((e) => e.text)),
    onStatus: (chatId, status) => statuses.push([chatId, status]),
    // пауза между запросами отпускается вручную — так проверяем порядок очереди
    sleep: (ms) => {
      sleeps.push(ms)
      return new Promise<void>((resolve) => (releaseSleep = resolve))
    },
  })
  const tick = async () => {
    await new Promise((r) => setTimeout(r, 0))
    releaseSleep()
    await new Promise((r) => setTimeout(r, 0))
  }
  return { loader, client, order, statuses, histories, sleeps, tick, controller }
}

describe('historyLoader', () => {
  it('по умолчанию запрашивает полную доступную историю', async () => {
    const controller = new AbortController()
    const getChatHistory = vi.fn<GreenApiClient['getChatHistory']>(async () => [])
    const loader = createHistoryLoader({
      client: { getChatHistory },
      signal: controller.signal,
      onHistory: () => undefined,
      onStatus: () => undefined,
      minIntervalMs: 0,
      sleep: async () => undefined,
    })

    loader.request('chat-1')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getChatHistory).toHaveBeenCalledWith('chat-1', 5_000, expect.any(AbortSignal))
  })

  it('грузит последовательно, с паузой между запросами и нужным count', async () => {
    const t = setup(async (chatId) => [item(`${chatId}-1`)])
    t.loader.request('a')
    t.loader.request('b')
    await t.tick()
    await t.tick()

    expect(t.order).toEqual(['a', 'b'])
    expect(t.client.getChatHistory).toHaveBeenCalledWith('a', 20, expect.any(AbortSignal))
    expect(t.sleeps).toEqual([1_100, 1_100])
    expect(t.histories).toEqual({ a: ['a-1'], b: ['b-1'] })
  })

  it('priority ставит открытый чат перед фоновыми', async () => {
    const t = setup(async () => [])
    t.loader.request('a') // уже в работе
    t.loader.request('b')
    t.loader.request('c')
    t.loader.request('c', { priority: true })
    await t.tick()
    await t.tick()
    await t.tick()
    expect(t.order).toEqual(['a', 'c', 'b'])
  })

  it('загруженный чат повторно не грузится, force — грузит', async () => {
    const t = setup(async () => [])
    t.loader.request('a')
    await t.tick()
    t.loader.request('a')
    await t.tick()
    expect(t.order).toEqual(['a'])

    t.loader.request('a', { force: true })
    await t.tick()
    expect(t.order).toEqual(['a', 'a'])
  })

  it('ошибка помечает чат как error и не останавливает очередь; повтор возможен', async () => {
    const t = setup(async (chatId) => {
      if (chatId === 'a') throw new ApiError('getChatHistory', 429, 'Too Many Requests')
      return []
    })
    t.loader.request('a')
    t.loader.request('b')
    await t.tick()
    await t.tick()

    expect(t.statuses).toEqual([
      ['a', 'loading'],
      ['a', 'error'],
      ['b', 'loading'],
      ['b', 'loaded'],
    ])
    t.loader.request('a')
    await t.tick()
    expect(t.order).toEqual(['a', 'b', 'a'])
  })

  it('после отмены новые запросы не выполняются', async () => {
    const t = setup(async () => [])
    t.controller.abort()
    t.loader.request('a')
    await t.tick()
    expect(t.client.getChatHistory).not.toHaveBeenCalled()
  })
})
