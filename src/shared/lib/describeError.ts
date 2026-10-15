import { ApiError } from '../../api'

/** Человекочитаемый текст ошибки для интерфейса */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError)
      return 'Не удалось связаться с Green-API. Проверьте apiUrl и подключение к сети.'
    if (error.isUnauthorized) return 'Неверный idInstance или apiTokenInstance.'
    if (error.isRateLimited) return 'Превышен лимит запросов Green-API. Подождите немного и попробуйте снова.'
    if (/not authorized|starting/i.test(error.message)) {
      return 'Инстанс не авторизован в MAX. Авторизуйте его в личном кабинете Green-API.'
    }
    if (/contact info limit/i.test(error.message)) {
      return 'MAX временно ограничил проверку номеров. Повторите попытку позже.'
    }
    return error.message
  }
  return error instanceof Error ? error.message : 'Неизвестная ошибка'
}
