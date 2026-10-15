import { createGreenApiClient, type Credentials } from '../../api'

export type VerifyResult = { ok: true } | { ok: false; error: string }

const STATE_MESSAGES: Record<string, string> = {
  notAuthorized: 'Инстанс не авторизован в MAX. Отсканируйте QR-код в личном кабинете Green-API.',
  blocked: 'Аккаунт MAX заблокирован.',
  starting: 'Инстанс запускается. Подождите минуту и попробуйте снова.',
  yellowCard: 'На аккаунте временные ограничения MAX.',
}

/**
 * Проверяет креды запросом getStateInstance: заодно ловим неверный токен,
 * неверный apiUrl и неавторизованный инстанс — до того, как пользователь попадёт в чат.
 */
export async function verifyCredentials(
  credentials: Credentials,
  signal?: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<VerifyResult> {
  const { stateInstance } = await createGreenApiClient(credentials, fetchImpl).getStateInstance(signal)
  if (stateInstance === 'authorized') return { ok: true }
  return { ok: false, error: STATE_MESSAGES[stateInstance] ?? `Инстанс недоступен: ${stateInstance}` }
}
