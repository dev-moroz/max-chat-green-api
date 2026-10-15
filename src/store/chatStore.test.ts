import { beforeEach, describe, expect, it } from 'vitest'
import type { TextMessageEvent } from '../api'
import { sortChatsByActivity, useChatStore } from './chatStore'

const store = () => useChatStore.getState()

function event(overrides: Partial<TextMessageEvent> = {}): TextMessageEvent {
  return {
    direction: 'incoming',
    idMessage: 'm1',
    chatId: '100',
    chatName: 'Друг',
    text: 'Привет',
    timestamp: 1_000,
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  useChatStore.setState({ instanceId: 'inst-1', chats: {}, activeChatId: null })
})

describe('chatStore', () => {
  it('openChat создаёт чат и делает его активным; повторный вызов не теряет историю', () => {
    store().openChat({ chatId: '100', phone: '79991234567' })
    store().applyTextMessage(event())
    store().openChat({ chatId: '100' })

    expect(store().activeChatId).toBe('100')
    expect(store().chats['100'].phone).toBe('79991234567')
    expect(store().chats['100'].messages).toHaveLength(1)
  })

  it('findChatIdByPhone находит существующий чат', () => {
    store().openChat({ chatId: '100', phone: '79991234567' })
    expect(store().findChatIdByPhone('79991234567')).toBe('100')
    expect(store().findChatIdByPhone('79990000000')).toBeUndefined()
  })

  it('входящее сообщение от неизвестного chatId создаёт чат с именем отправителя', () => {
    store().applyTextMessage(event())
    expect(store().chats['100']).toMatchObject({ name: 'Друг', unreadCount: 1 })
  })

  it('не считает непрочитанными сообщения в открытом чате', () => {
    store().openChat({ chatId: '100' })
    store().applyTextMessage(event())
    expect(store().chats['100'].unreadCount).toBe(0)
  })

  it('selectChat сбрасывает счётчик непрочитанных', () => {
    store().applyTextMessage(event())
    store().selectChat('100')
    expect(store().chats['100'].unreadCount).toBe(0)
  })

  it('pending → sent, затем уведомление о своей же отправке не дублирует сообщение', () => {
    store().openChat({ chatId: '100' })
    const localId = store().addPendingMessage('100', 'Привет')
    expect(store().chats['100'].messages[0].status).toBe('pending')

    store().markMessageSent('100', localId, 'srv-1')
    store().applyTextMessage(event({ direction: 'outgoing', idMessage: 'srv-1' }))

    const messages = store().chats['100'].messages
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ idMessage: 'srv-1', status: 'sent' })
  })

  it('уведомление пришло раньше ответа sendMessage — локальная копия удаляется', () => {
    store().openChat({ chatId: '100' })
    const localId = store().addPendingMessage('100', 'Привет')

    store().applyTextMessage(event({ direction: 'outgoing', idMessage: 'srv-1', timestamp: Date.now() }))
    store().markMessageSent('100', localId, 'srv-1')

    const messages = store().chats['100'].messages
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('srv-1')
  })

  it('failed → retry → pending', () => {
    store().openChat({ chatId: '100' })
    const localId = store().addPendingMessage('100', 'Привет')
    store().markMessageFailed('100', localId)
    expect(store().chats['100'].messages[0].status).toBe('failed')
    store().markMessageRetrying('100', localId)
    expect(store().chats['100'].messages[0].status).toBe('pending')
  })

  it('ответ с серверным временем «раньше» локального всё равно встаёт после отправленного', () => {
    store().openChat({ chatId: '100' })
    store().addPendingMessage('100', 'Привет') // локальное время в мс
    // сервер отдаёт секунды — после умножения время может оказаться меньше локального
    store().applyTextMessage(
      event({ idMessage: 'reply', timestamp: Math.floor(Date.now() / 1000) * 1000 - 500 }),
    )
    expect(store().chats['100'].messages.map((m) => m.text)).toEqual(['Привет', 'Привет'])
    expect(store().chats['100'].messages[1].id).toBe('reply')
  })

  it('bindInstance к другому инстансу очищает историю', () => {
    store().applyTextMessage(event())
    store().bindInstance('inst-1')
    expect(Object.keys(store().chats)).toHaveLength(1)
    store().bindInstance('inst-2')
    expect(store().chats).toEqual({})
  })

  it('sortChatsByActivity: свежие сверху, пустой новый чат — по времени создания', () => {
    store().applyTextMessage(event({ chatId: 'old', idMessage: 'x', timestamp: 1_000 }))
    store().applyTextMessage(event({ chatId: 'new', idMessage: 'y', timestamp: 5_000 }))
    store().openChat({ chatId: 'empty' })
    expect(sortChatsByActivity(store().chats).map((c) => c.chatId)).toEqual(['empty', 'new', 'old'])
  })
})
