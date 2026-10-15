/** Ошибка вызова Green-API. URL с токеном в сообщение не попадает. */
export class ApiError extends Error {
  readonly method: string
  /** HTTP-статус; 0 — сетевой сбой, ответа нет */
  readonly status: number

  constructor(method: string, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.method = method
    this.status = status
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** Неверный idInstance / apiTokenInstance */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403
  }

  /** Превышена частота запросов или лимит тарифа Developer */
  get isRateLimited(): boolean {
    return this.status === 429 || this.status === 466
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
