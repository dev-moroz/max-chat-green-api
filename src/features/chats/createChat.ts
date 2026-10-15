import type { GreenApiClient } from '../../api'
import { formatPhone, parsePhone } from '../../shared/lib/phone'
import { useChatStore } from '../../store/chatStore'

export type CreateChatResult = { ok: true; chatId: string } | { ok: false; error: string }

/**
 * Номера, для которых CheckAccount уже ответил «аккаунта нет».
 * MAX может временно заблокировать инстанс за частые проверки одного и того же несуществующего номера,
 * поэтому повторно их не проверяем до перезагрузки страницы.
 */
const knownMissing = new Set<string>()

/**
 * Номер → chatId → чат.
 * В MAX chatId — числовой id пользователя, а не номер телефона. Если отправить сообщение по номеру,
 * ответ придёт с chatId, который не сопоставить с чатом. Поэтому chatId получаем заранее через CheckAccount.
 */
export async function createChat(
  input: string,
  client: GreenApiClient,
  signal?: AbortSignal,
): Promise<CreateChatResult> {
  const parsed = parsePhone(input)
  if (!parsed.ok) return parsed

  const store = useChatStore.getState()
  const existingChatId = store.findChatIdByPhone(parsed.phone)
  if (existingChatId) {
    store.openChat({ chatId: existingChatId })
    return { ok: true, chatId: existingChatId }
  }

  const notFound = { ok: false, error: `На номере ${formatPhone(parsed.phone)} нет аккаунта MAX` } as const
  if (knownMissing.has(parsed.phone)) return notFound

  const account = await client.checkAccount(parsed.phone, signal)
  if (!account.exist) {
    knownMissing.add(parsed.phone)
    return notFound
  }

  // Чат с этим chatId мог уже появиться из входящего сообщения — openChat допишет к нему номер
  useChatStore.getState().openChat({ chatId: account.chatId, phone: parsed.phone })
  return { ok: true, chatId: account.chatId }
}

/** Для тестов */
export function resetCreateChatCache() {
  knownMissing.clear()
}
