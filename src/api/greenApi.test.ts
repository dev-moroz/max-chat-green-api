import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './errors'
import { createGreenApiClient, normalizeApiUrl } from './greenApi'

const credentials = {
  apiUrl: 'https://3100.api.green-api.com/',
  idInstance: '3100000001',
  apiTokenInstance: 'secret-token',
}

function mockFetch(status: number, body: string) {
  return vi.fn<typeof fetch>(async () => new Response(body, { status }))
}

describe('normalizeApiUrl', () => {
  it('убирает завершающий слэш и добавляет протокол', () => {
    expect(normalizeApiUrl(' 3100.api.green-api.com/ ')).toBe('https://3100.api.green-api.com')
    expect(normalizeApiUrl('https://api.green-api.com//')).toBe('https://api.green-api.com')
  })
})

describe('createGreenApiClient', () => {
  it('собирает URL метода по схеме {apiUrl}/waInstance{id}/{method}/{token}', async () => {
    const fetchImpl = mockFetch(200, '{"stateInstance":"authorized"}')
    const client = createGreenApiClient(credentials, fetchImpl)

    await expect(client.getStateInstance()).resolves.toEqual({ stateInstance: 'authorized' })
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://3100.api.green-api.com/waInstance3100000001/getStateInstance/secret-token',
    )
  })

  it('sendMessage отправляет chatId и текст в JSON', async () => {
    const fetchImpl = mockFetch(200, '{"idMessage":"42"}')
    const client = createGreenApiClient(credentials, fetchImpl)

    await expect(client.sendMessage('10000000', 'Привет')).resolves.toEqual({ idMessage: '42' })
    const init = fetchImpl.mock.calls[0][1]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ chatId: '10000000', message: 'Привет' })
  })

  it('receiveNotification возвращает null на пустой очереди', async () => {
    const client = createGreenApiClient(credentials, mockFetch(200, 'null'))
    await expect(client.receiveNotification()).resolves.toBeNull()

    const clientEmpty = createGreenApiClient(credentials, mockFetch(200, ''))
    await expect(clientEmpty.receiveNotification()).resolves.toBeNull()
  })

  it('receiveNotification передаёт receiveTimeout', async () => {
    const fetchImpl = mockFetch(200, 'null')
    await createGreenApiClient(credentials, fetchImpl).receiveNotification()
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(
      /\/receiveNotification\/secret-token\?receiveTimeout=20$/,
    )
  })

  it('deleteNotification вызывает DELETE с receiptId в пути', async () => {
    const fetchImpl = mockFetch(200, '{"result":true}')
    await createGreenApiClient(credentials, fetchImpl).deleteNotification(1234567)
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/deleteNotification\/secret-token\/1234567$/)
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('DELETE')
  })

  it('checkAccount отдаёт chatId, если аккаунт есть', async () => {
    const fetchImpl = mockFetch(200, '{"exist":true,"chatId":"10000000","fromCache":true}')
    const client = createGreenApiClient(credentials, fetchImpl)

    await expect(client.checkAccount('79991234567')).resolves.toEqual({ exist: true, chatId: '10000000' })
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ phoneNumber: 79991234567 })
  })

  it('checkAccount: аккаунта нет', async () => {
    const client = createGreenApiClient(credentials, mockFetch(200, '{"exist":false,"chatId":""}'))
    await expect(client.checkAccount('79991234567')).resolves.toEqual({ exist: false })
  })

  it('checkAccount: ответ со status=false превращается в ApiError с причиной', async () => {
    const client = createGreenApiClient(
      credentials,
      mockFetch(200, '{"status":false,"reason":"instance is starting or not authorized"}'),
    )
    await expect(client.checkAccount('79991234567')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'instance is starting or not authorized',
    })
  })

  it('HTTP-ошибка превращается в ApiError без токена в сообщении', async () => {
    const client = createGreenApiClient(credentials, mockFetch(401, 'Unauthorized'))
    const error = await client.getStateInstance().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isUnauthorized).toBe(true)
    expect((error as ApiError).message).not.toContain('secret-token')
  })

  it('сетевой сбой — ApiError со статусом 0', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const error = await createGreenApiClient(credentials, fetchImpl)
      .getStateInstance()
      .catch((e: unknown) => e)
    expect((error as ApiError).isNetworkError).toBe(true)
  })

  it('отмену через AbortSignal пробрасывает как есть, а не как ApiError', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new DOMException('Aborted', 'AbortError')
    })
    const error = await createGreenApiClient(credentials, fetchImpl)
      .receiveNotification(AbortSignal.abort())
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DOMException)
  })

  it('getChatHistory — POST с chatId и count; мусор в ответе отбрасывается', async () => {
    const fetchImpl = mockFetch(200, '[{"type":"incoming","idMessage":"1"}, null, 5]')
    const items = await createGreenApiClient(credentials, fetchImpl).getChatHistory('100', 50)

    expect(items).toEqual([{ type: 'incoming', idMessage: '1' }])
    expect(fetchImpl.mock.calls[0][0]).toMatch(/\/getChatHistory\/secret-token$/)
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ chatId: '100', count: 50 })
  })

  it('getChats — список чатов; числовой chatId приводится к строке, без chatId — отбрасывается', async () => {
    const fetchImpl = mockFetch(
      200,
      '[{"chatId":"100","name":"А","type":"user","phoneNumber":0},{"chatId":200,"name":"Б","type":"user","phoneNumber":0},{"name":"без id"}]',
    )
    const chats = await createGreenApiClient(credentials, fetchImpl).getChats()
    expect(chats.map((c) => c.chatId)).toEqual(['100', '200'])
  })

  it('getChats — не массив в ответе даёт пустой список', async () => {
    await expect(createGreenApiClient(credentials, mockFetch(200, '{}')).getChats()).resolves.toEqual([])
  })
})
