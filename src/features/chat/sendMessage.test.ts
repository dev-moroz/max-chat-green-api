import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type GreenApiClient } from '../../api'
import { useChatStore } from '../../store/chatStore'
import { retryMessage, sendMessage } from './sendMessage'

const messages = () => useChatStore.getState().chats['100'].messages

function client(send: GreenApiClient['sendMessage']) {
  return { sendMessage: vi.fn(send) } as unknown as GreenApiClient & {
    sendMessage: ReturnType<typeof vi.fn>
  }
}

beforeEach(() => {
  useChatStore.setState({ instanceId: 'i', chats: {}, activeChatId: null })
  useChatStore.getState().openChat({ chatId: '100' })
})

describe('sendMessage', () => {
  it('показывает сообщение сразу, затем помечает отправленным', async () => {
    let resolve!: (value: { idMessage: string }) => void
    const api = client(() => new Promise((r) => (resolve = r)))

    const done = sendMessage('100', '  Привет  ', api)
    expect(messages()).toMatchObject([{ text: 'Привет', status: 'pending' }])
    expect(api.sendMessage).toHaveBeenCalledWith('100', 'Привет')

    resolve({ idMessage: 'srv-1' })
    await done
    expect(messages()).toMatchObject([{ idMessage: 'srv-1', status: 'sent' }])
  })

  it('пустой текст не отправляется', async () => {
    const api = client(async () => ({ idMessage: 'x' }))
    await sendMessage('100', '   \n ', api)
    expect(api.sendMessage).not.toHaveBeenCalled()
    expect(messages()).toHaveLength(0)
  })

  it('ошибка API → failed; повтор отправляет тот же текст', async () => {
    const api = client(async () => {
      throw new ApiError('sendMessage', 0, 'offline')
    })
    await sendMessage('100', 'Привет', api)
    expect(messages()[0].status).toBe('failed')

    api.sendMessage.mockImplementation(async () => ({ idMessage: 'srv-2' }))
    await retryMessage('100', messages()[0].id, api)

    expect(api.sendMessage).toHaveBeenLastCalledWith('100', 'Привет')
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toMatchObject({ status: 'sent', idMessage: 'srv-2' })
  })
})
