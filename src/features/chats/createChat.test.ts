import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GreenApiClient } from '../../api'
import { useChatStore } from '../../store/chatStore'
import { createChat, resetCreateChatCache } from './createChat'

function clientWith(checkAccount: GreenApiClient['checkAccount']): GreenApiClient {
  return { checkAccount } as GreenApiClient
}

beforeEach(() => {
  resetCreateChatCache()
  useChatStore.setState({ instanceId: 'inst', chats: {}, activeChatId: null })
})

describe('createChat', () => {
  it('получает chatId через CheckAccount и открывает чат', async () => {
    const checkAccount = vi.fn<GreenApiClient['checkAccount']>(async () => ({ exist: true, chatId: '100' }))
    const result = await createChat('+7 (999) 123-45-67', clientWith(checkAccount))

    expect(result).toEqual({ ok: true, chatId: '100' })
    expect(checkAccount).toHaveBeenCalledWith('79991234567', undefined)
    expect(useChatStore.getState()).toMatchObject({
      activeChatId: '100',
      chats: { '100': { phone: '79991234567' } },
    })
  })

  it('невалидный номер не уходит в API', async () => {
    const checkAccount = vi.fn<GreenApiClient['checkAccount']>()
    const result = await createChat('123', clientWith(checkAccount))
    expect(result.ok).toBe(false)
    expect(checkAccount).not.toHaveBeenCalled()
  })

  it('повторный номер открывает существующий чат без запроса', async () => {
    const checkAccount = vi.fn<GreenApiClient['checkAccount']>(async () => ({ exist: true, chatId: '100' }))
    const client = clientWith(checkAccount)
    await createChat('79991234567', client)
    useChatStore.getState().selectChat(null)

    await expect(createChat('8 999 123 45 67', client)).resolves.toEqual({ ok: true, chatId: '100' })
    expect(checkAccount).toHaveBeenCalledTimes(1)
    expect(useChatStore.getState().activeChatId).toBe('100')
  })

  it('номер без аккаунта MAX: ошибка, повторно не проверяется', async () => {
    const checkAccount = vi.fn<GreenApiClient['checkAccount']>(async () => ({ exist: false }))
    const client = clientWith(checkAccount)

    const first = await createChat('79991234567', client)
    const second = await createChat('79991234567', client)

    expect(first).toEqual({ ok: false, error: 'На номере +7 999 123-45-67 нет аккаунта MAX' })
    expect(second).toEqual(first)
    expect(checkAccount).toHaveBeenCalledTimes(1)
  })

  it('дописывает номер к чату, который уже появился из входящего сообщения', async () => {
    useChatStore.getState().applyMessage({
      direction: 'incoming',
      idMessage: 'm1',
      chatId: '100',
      chatName: 'Друг',
      text: 'Привет',
      timestamp: 1,
    })
    await createChat(
      '79991234567',
      clientWith(async () => ({ exist: true, chatId: '100' })),
    )

    const chat = useChatStore.getState().chats['100']
    expect(chat).toMatchObject({ name: 'Друг', phone: '79991234567' })
    expect(chat.messages).toHaveLength(1)
  })
})
