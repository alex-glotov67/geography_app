import { render, screen, within } from '@testing-library/react'
import { LoginCards } from './LoginCards'

const creds = Array.from({ length: 12 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  number: i + 1,
  displayName: `Учень${i + 1} А.`,
  login: `8b-${String(i + 1).padStart(2, '0')}`,
  password: 'gora-step-47',
}))

describe('картки входу (SPEC 5.1)', () => {
  it('10 карток на аркуш A4; логін, пароль, школа, клас і QR на кожній; друк відкривається сам', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const onDone = vi.fn()
    render(<LoginCards credentials={creds} className="8-Б" schoolName="Ліцей №1" onDone={onDone} />)
    const sheets = screen.getAllByRole('region', { name: /Аркуш/, hidden: true }) // на екрані приховані, видно лише при друці
    expect(sheets.map((s) => within(s).getAllByRole('article', { hidden: true }).length)).toEqual([10, 2])
    const first = within(sheets[0]!).getAllByRole('article', { hidden: true })[0]!
    expect(first).toHaveTextContent('Ліцей №1')
    expect(first).toHaveTextContent('Учень1 А., 8-Б')
    expect(first).toHaveTextContent('8b-01')
    expect(first).toHaveTextContent('gora-step-47')
    expect(within(first).getByRole('img', { name: 'QR-код входу для 8b-01', hidden: true })).toBeInTheDocument()
    await vi.waitFor(() => expect(print).toHaveBeenCalledOnce())
    window.dispatchEvent(new Event('afterprint'))
    expect(onDone).toHaveBeenCalled()
    print.mockRestore()
  })
})
