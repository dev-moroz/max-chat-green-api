import { ApiError, isAbortError } from './errors'
import type {
  ChatInfo,
  CheckAccountResult,
  Credentials,
  HistoryItem,
  InstanceSettings,
  NotificationSettings,
  ReceivedNotification,
  SendMessageResponse,
  StateInstanceResponse,
} from './types'

/** Сколько секунд сервер держит long-poll запрос receiveNotification (допустимо 5–60). */
export const RECEIVE_TIMEOUT_SECONDS = 20

/** Ограничение длины текста из документации SendMessage */
export const MAX_MESSAGE_LENGTH = 4000

export interface GreenApiClient {
  getStateInstance(signal?: AbortSignal): Promise<StateInstanceResponse>
  getSettings(signal?: AbortSignal): Promise<InstanceSettings>
  setSettings(settings: NotificationSettings, signal?: AbortSignal): Promise<void>
  checkAccount(phoneNumber: string, signal?: AbortSignal): Promise<CheckAccountResult>
  sendMessage(chatId: string, message: string, signal?: AbortSignal): Promise<SendMessageResponse>
  /** Возвращает null, если за время long-poll уведомлений не пришло */
  receiveNotification(signal?: AbortSignal): Promise<ReceivedNotification | null>
  deleteNotification(receiptId: number, signal?: AbortSignal): Promise<void>
  /** Список чатов аккаунта. Последних сообщений не содержит */
  getChats(signal?: AbortSignal): Promise<ChatInfo[]>
  /** Последние count сообщений чата. Лимит API — 1 запрос в секунду */
  getChatHistory(chatId: string, count: number, signal?: AbortSignal): Promise<HistoryItem[]>
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  /** Дополнительный сегмент пути после токена (receiptId для deleteNotification) */
  pathSuffix?: string
  query?: Record<string, string>
  signal?: AbortSignal
}

export function normalizeApiUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/+$/, '')
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function createGreenApiClient(
  credentials: Credentials,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): GreenApiClient {
  const base = `${normalizeApiUrl(credentials.apiUrl)}/waInstance${credentials.idInstance.trim()}`
  const token = encodeURIComponent(credentials.apiTokenInstance.trim())

  async function request<T>(apiMethod: string, options: RequestOptions): Promise<T> {
    let url = `${base}/${apiMethod}/${token}`
    if (options.pathSuffix) url += `/${encodeURIComponent(options.pathSuffix)}`
    if (options.query) url += `?${new URLSearchParams(options.query).toString()}`

    let response: Response
    try {
      response = await fetchImpl(url, {
        method: options.method,
        headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      })
    } catch (error) {
      if (isAbortError(error)) throw error
      throw new ApiError(apiMethod, 0, 'Нет соединения с сервером Green-API')
    }

    const text = await response.text()

    if (!response.ok) {
      throw new ApiError(apiMethod, response.status, extractErrorMessage(text, response.status))
    }

    // receiveNotification на пустой очереди отвечает "null" или пустым телом
    if (text.trim() === '') return null as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new ApiError(apiMethod, response.status, 'Некорректный ответ сервера')
    }
  }

  return {
    getStateInstance: (signal) =>
      request<StateInstanceResponse>('getStateInstance', { method: 'GET', signal }),

    getSettings: (signal) => request<InstanceSettings>('getSettings', { method: 'GET', signal }),

    async setSettings(settings, signal) {
      await request<unknown>('setSettings', { method: 'POST', body: settings, signal })
    },

    async checkAccount(phoneNumber, signal) {
      const data = await request<{ exist: boolean; chatId?: string } | { status: false; reason: string }>(
        'checkAccount',
        {
          method: 'POST',
          // По документации phoneNumber — integer; 11–12 цифр безопасно влезают в Number
          body: { phoneNumber: Number(phoneNumber) },
          signal,
        },
      )
      if ('reason' in data) throw new ApiError('checkAccount', 200, data.reason)
      return data.exist && data.chatId ? { exist: true, chatId: data.chatId } : { exist: false }
    },

    sendMessage: (chatId, message, signal) =>
      request<SendMessageResponse>('sendMessage', {
        method: 'POST',
        body: { chatId, message },
        signal,
      }),

    receiveNotification: (signal) =>
      request<ReceivedNotification | null>('receiveNotification', {
        method: 'GET',
        query: { receiveTimeout: String(RECEIVE_TIMEOUT_SECONDS) },
        signal,
      }),

    async deleteNotification(receiptId, signal) {
      await request<{ result: boolean }>('deleteNotification', {
        method: 'DELETE',
        pathSuffix: String(receiptId),
        signal,
      })
    },

    async getChats(signal) {
      const data = await request<unknown>('getChats', { method: 'GET', signal })
      return Array.isArray(data) ? data.filter(isChatInfo) : []
    },

    async getChatHistory(chatId, count, signal) {
      const data = await request<unknown>('getChatHistory', {
        method: 'POST',
        body: { chatId, count },
        signal,
      })
      return Array.isArray(data) ? data.filter(isRecord) : []
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isChatInfo(value: unknown): value is ChatInfo {
  if (!isRecord(value)) return false
  if (typeof value.chatId === 'number') value.chatId = String(value.chatId)
  return typeof value.chatId === 'string' && value.chatId !== ''
}

function extractErrorMessage(text: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && 'message' in parsed) {
      const message = (parsed as { message: unknown }).message
      if (typeof message === 'string' && message) return message
    }
  } catch {
    // тело не JSON — используем текст как есть
  }
  return text.trim() || `HTTP ${status}`
}
