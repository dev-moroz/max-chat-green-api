export type PhoneParseResult = { ok: true; phone: string } | { ok: false; error: string }

/**
 * Приводит введённый номер к формату CheckAccount: только цифры, с кодом страны.
 * Green-API для MAX принимает номера РФ (+7, 11 цифр) и РБ (+375, 12 цифр).
 */
export function parsePhone(input: string): PhoneParseResult {
  let digits = input.replace(/\D/g, '')
  if (!digits) return { ok: false, error: 'Введите номер телефона' }

  // Российский номер в национальном формате: 8 999 123-45-67
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`

  if (digits.startsWith('375')) {
    return digits.length === 12
      ? { ok: true, phone: digits }
      : { ok: false, error: 'Номер РБ должен содержать 12 цифр: +375 XX XXX-XX-XX' }
  }
  if (digits.startsWith('7')) {
    return digits.length === 11
      ? { ok: true, phone: digits }
      : { ok: false, error: 'Номер РФ должен содержать 11 цифр: +7 XXX XXX-XX-XX' }
  }
  return { ok: false, error: 'MAX через Green-API поддерживает только номера РФ (+7) и РБ (+375)' }
}

/** 79991234567 → +7 999 123-45-67; 375291234567 → +375 29 123-45-67 */
export function formatPhone(phone: string): string {
  const by = phone.match(/^375(\d{2})(\d{3})(\d{2})(\d{2})$/)
  if (by) return `+375 ${by[1]} ${by[2]}-${by[3]}-${by[4]}`
  const ru = phone.match(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/)
  if (ru) return `+7 ${ru[1]} ${ru[2]}-${ru[3]}-${ru[4]}`
  return `+${phone}`
}
