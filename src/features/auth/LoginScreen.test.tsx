import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '../../store/chatStore'
import { useSessionStore } from '../../store/sessionStore'
import { LoginScreen } from './LoginScreen'

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('apiUrl'), 'https://3100.api.green-api.com')
  await user.type(screen.getByLabelText('idInstance'), '3100123456')
  await user.type(screen.getByLabelText('apiTokenInstance'), 'token')
  await user.click(screen.getByRole('button', { name: 'Войти' }))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  useSessionStore.setState({ credentials: null })
  useChatStore.setState({ instanceId: null, chats: {}, activeChatId: null })
})

describe('LoginScreen', () => {
  it('авторизованный инстанс — вход и привязка чатов к инстансу', async () => {
    respond(200, { stateInstance: 'authorized' })
    render(<LoginScreen />)
    await fillAndSubmit()

    expect(useSessionStore.getState().credentials).toEqual({
      apiUrl: 'https://3100.api.green-api.com',
      idInstance: '3100123456',
      apiTokenInstance: 'token',
    })
    expect(useChatStore.getState().instanceId).toBe('3100123456')
  })

  it('неавторизованный инстанс — понятная ошибка, вход не выполняется', async () => {
    respond(200, { stateInstance: 'notAuthorized' })
    render(<LoginScreen />)
    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Инстанс не авторизован в MAX')
    expect(useSessionStore.getState().credentials).toBeNull()
  })

  it('неверный токен — сообщение про креды', async () => {
    respond(401, { message: 'Unauthorized' })
    render(<LoginScreen />)
    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверный idInstance или apiTokenInstance')
    expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled()
  })
})
