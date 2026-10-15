import { describe, expect, it } from 'vitest'
import { formatPhone, parsePhone } from './phone'

describe('parsePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['79991234567', '79991234567'],
    ['+375 29 123-45-67', '375291234567'],
  ])('%s → %s', (input, phone) => {
    expect(parsePhone(input)).toEqual({ ok: true, phone })
  })

  it.each([
    ['', 'Введите номер'],
    ['+7 999 123', '11 цифр'],
    ['+375 29 123', '12 цифр'],
    ['+381 64 1234567', 'только номера РФ'],
  ])('отклоняет «%s»', (input, error) => {
    const result = parsePhone(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain(error)
  })
})

describe('formatPhone', () => {
  it('форматирует номера РФ и РБ', () => {
    expect(formatPhone('79991234567')).toBe('+7 999 123-45-67')
    expect(formatPhone('375291234567')).toBe('+375 29 123-45-67')
  })
})
