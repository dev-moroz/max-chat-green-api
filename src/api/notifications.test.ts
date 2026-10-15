import { describe, expect, it } from 'vitest'
import { parseTextMessage } from './notifications'
import type { WebhookBody } from './types'

// Пример из документации Green-API (входящее текстовое сообщение, личный чат)
const incomingText: WebhookBody = {
  typeWebhook: 'incomingMessageReceived',
  instanceData: { idInstance: 3100000000, wid: '79991234567@c.us', typeInstance: 'v3' },
  timestamp: 1763115112,
  idMessage: '1763115112345',
  senderData: {
    chatId: '10000000',
    chatName: 'Ходабрыш Пробешёлов',
    chatType: 'user',
    sender: '10000000',
    senderName: 'Ходабрыш Пробешёлов',
  },
  messageData: {
    typeMessage: 'textMessage',
    textMessageData: { textMessage: 'Привет от Green-API!' },
  },
}

describe('parseTextMessage', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(parseTextMessage(incomingText)).toEqual({
      direction: 'incoming',
      idMessage: '1763115112345',
      chatId: '10000000',
      chatName: 'Ходабрыш Пробешёлов',
      text: 'Привет от Green-API!',
      timestamp: 1763115112000,
    })
  })

  it('исходящие с телефона и через API помечает как outgoing', () => {
    expect(parseTextMessage({ ...incomingText, typeWebhook: 'outgoingMessageReceived' })?.direction).toBe(
      'outgoing',
    )
    expect(parseTextMessage({ ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' })?.direction).toBe(
      'outgoing',
    )
  })

  it('берёт текст из extendedTextMessage и quotedMessage', () => {
    for (const typeMessage of ['extendedTextMessage', 'quotedMessage']) {
      const body = {
        ...incomingText,
        messageData: { typeMessage, extendedTextMessageData: { text: 'со ссылкой https://max.ru' } },
      }
      expect(parseTextMessage(body)?.text).toBe('со ссылкой https://max.ru')
    }
  })

  it('числовой chatId приводит к строке', () => {
    const body = { ...incomingText, senderData: { chatId: 10000000 } }
    expect(parseTextMessage(body)?.chatId).toBe('10000000')
  })

  it('игнорирует медиа, статусы и сервисные уведомления', () => {
    expect(
      parseTextMessage({
        ...incomingText,
        messageData: { typeMessage: 'imageMessage', fileMessageData: {} },
      }),
    ).toBeNull()
    expect(
      parseTextMessage({ typeWebhook: 'outgoingMessageStatus', status: 'read', idMessage: '1' }),
    ).toBeNull()
    expect(parseTextMessage({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' })).toBeNull()
  })

  it('не падает на битом теле', () => {
    expect(parseTextMessage({ typeWebhook: 'incomingMessageReceived' })).toBeNull()
    expect(
      parseTextMessage({ typeWebhook: 'incomingMessageReceived', senderData: 'x', messageData: null }),
    ).toBeNull()
    expect(
      parseTextMessage({
        ...incomingText,
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 5 } },
      }),
    ).toBeNull()
  })
})
