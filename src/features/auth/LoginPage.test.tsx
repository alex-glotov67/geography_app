import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginError, loginErrorMessage, signIn } from '@/api/auth'
import { safeRedirect } from '@/lib/links'
import { renderWithRouter } from '@/test/render'
import { LoginPage } from './LoginPage'

vi.mock('@/api/auth', async (orig) => ({ ...(await orig<typeof import('@/api/auth')>()), signIn: vi.fn() }))

describe('Вхід (Login.dc.html)', () => {
  it('порожні поля — підказки біля полів, без запиту', async () => {
    await renderWithRouter(<LoginPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    expect(await screen.findByText('Введи логін')).toBeInTheDocument()
    expect(screen.getByText('Введи пароль')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('логін з QR підставлено; пароль можна показати; помилка входу — українською', async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new LoginError('Неправильний логін або пароль'))
    await renderWithRouter(<LoginPage initialLogin="8b-07" />)
    expect(screen.getByRole('textbox', { name: 'Логін' })).toHaveValue('8b-07')
    const password = screen.getByLabelText('Пароль')
    expect(password).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Показати пароль' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.type(password, 'gora-step-47')
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Неправильний логін або пароль')
    expect(signIn).toHaveBeenCalledWith('8b-07', 'gora-step-47')
  })

  it('після входу — туди, звідки прийшли, або в кабінет вчителя', async () => {
    vi.mocked(signIn).mockResolvedValue({
      kind: 'teacher', id: 't', displayName: '', loginPrefix: '', studentsCanChangePassword: false, schoolId: 's', schoolName: '',
    })
    const { router } = await renderWithRouter(<LoginPage redirect="/t/settings" />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Логін' }), 'teacher@school.ua')
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/t/settings'))
  })
})

describe('помилки й переходи', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'Неправильний логін або пароль'],
    [{ code: 'user_banned' }, 'Вхід вимкнено. Звернись до вчителя.'],
    [{ status: 429 }, 'Забагато спроб. Зачекай кілька хвилин і спробуй ще.'],
    [{ name: 'AuthRetryableFetchError' }, "Немає зв'язку з сервером. Перевір інтернет і спробуй ще."],
    [null, 'Не вдалося увійти. Спробуй ще раз.'],
  ])('%o → %s', (e, msg) => expect(loginErrorMessage(e)).toBe(msg))

  it('повернення після входу — лише на внутрішні адреси', () => {
    expect(safeRedirect('/t/classes')).toBe('/t/classes')
    expect(safeRedirect('//evil.example')).toBeUndefined()
    expect(safeRedirect('https://evil.example')).toBeUndefined()
    expect(safeRedirect(42)).toBeUndefined()
  })
})
