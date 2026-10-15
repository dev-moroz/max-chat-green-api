import { describe, expect, it } from 'vitest'
import { parseHistoryItem, parseNotification } from './notifications'
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

describe('parseNotification', () => {
  it('разбирает входящее текстовое сообщение', () => {
    expect(parseNotification(incomingText)).toEqual({
      direction: 'incoming',
      idMessage: '1763115112345',
      chatId: '10000000',
      chatName: 'Ходабрыш Пробешёлов',
      text: 'Привет от Green-API!',
      timestamp: 1763115112000,
    })
  })

  it('исходящие с телефона и через API помечает как outgoing', () => {
    expect(parseNotification({ ...incomingText, typeWebhook: 'outgoingMessageReceived' })?.direction).toBe(
      'outgoing',
    )
    expect(parseNotification({ ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' })?.direction).toBe(
      'outgoing',
    )
  })

  it('берёт текст из extendedTextMessage и quotedMessage', () => {
    for (const typeMessage of ['extendedTextMessage', 'quotedMessage']) {
      const body = {
        ...incomingText,
        messageData: { typeMessage, extendedTextMessageData: { text: 'со ссылкой https://max.ru' } },
      }
      expect(parseNotification(body)?.text).toBe('со ссылкой https://max.ru')
    }
  })

  it('числовой chatId приводит к строке', () => {
    const body = { ...incomingText, senderData: { chatId: 10000000 } }
    expect(parseNotification(body)?.chatId).toBe('10000000')
  })

  it('игнорирует статусы и сервисные уведомления', () => {
    expect(
      parseNotification({ typeWebhook: 'outgoingMessageStatus', status: 'read', idMessage: '1' }),
    ).toBeNull()
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' })).toBeNull()
  })

  it('не падает на битом теле', () => {
    expect(parseNotification({ typeWebhook: 'incomingMessageReceived' })).toBeNull()
    expect(
      parseNotification({ typeWebhook: 'incomingMessageReceived', senderData: 'x', messageData: null }),
    ).toBeNull()
    expect(
      parseNotification({
        ...incomingText,
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 5 } },
      }),
    ).toBeNull()
  })

  it('вложение превращается в подпись-заглушку с текстом подписи', () => {
    const photo = parseNotification({
      ...incomingText,
      messageData: { typeMessage: 'imageMessage', fileMessageData: { caption: 'Смотри', downloadUrl: 'x' } },
    })
    expect(photo).toMatchObject({ media: 'Фото', text: 'Смотри' })

    const doc = parseNotification({
      ...incomingText,
      messageData: { typeMessage: 'documentMessage', fileMessageData: { fileName: 'отчёт.pdf' } },
    })
    expect(doc).toMatchObject({ media: 'Документ: отчёт.pdf', text: '' })
  })

  it('неизвестный тип сообщения пропускает', () => {
    expect(parseNotification({ ...incomingText, messageData: { typeMessage: 'somethingNew' } })).toBeNull()
  })
})

describe('parseHistoryItem', () => {
  it('разбирает исходящее и входящее из истории', () => {
    expect(
      parseHistoryItem(
        {
          type: 'outgoing',
          idMessage: '1769676078000',
          timestamp: 1769676078,
          typeMessage: 'textMessage',
          chatId: '10000000',
          textMessage: 'Привет',
          statusMessage: 'delivered',
          sendByApi: true,
        },
        '10000000',
      ),
    ).toEqual({
      direction: 'outgoing',
      idMessage: '1769676078000',
      chatId: '10000000',
      text: 'Привет',
      timestamp: 1769676078000,
    })

    expect(
      parseHistoryItem(
        { type: 'incoming', idMessage: 'a', timestamp: 1, typeMessage: 'imageMessage', caption: '' },
        '100',
      ),
    ).toMatchObject({ direction: 'incoming', chatId: '100', media: 'Фото', text: '' })
  })

  it('текст со ссылкой берёт из textMessage или extendedTextMessage.text', () => {
    const base = { type: 'incoming', idMessage: 'a', timestamp: 1, typeMessage: 'extendedTextMessage' }
    expect(parseHistoryItem({ ...base, textMessage: 'https://max.ru' }, '1')?.text).toBe('https://max.ru')
    expect(parseHistoryItem({ ...base, extendedTextMessage: { text: 'ссылка' } }, '1')?.text).toBe('ссылка')
  })

  it('битые элементы пропускает', () => {
    expect(
      parseHistoryItem({ type: 'other', idMessage: 'a', typeMessage: 'textMessage', textMessage: 'x' }, '1'),
    ).toBeNull()
    expect(
      parseHistoryItem({ type: 'incoming', typeMessage: 'textMessage', textMessage: 'x' }, '1'),
    ).toBeNull()
  })
})
