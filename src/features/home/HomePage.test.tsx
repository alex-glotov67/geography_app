import { screen } from '@testing-library/react'
import { renderApp } from '@/test/render'

describe('Головна (Main.dc.html)', () => {
  it('гість бачить 4 класи, «Увійти» і «Живий квіз» з чистими адресами', async () => {
    await renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Географія' })).toBeInTheDocument()
    for (const g of [6, 7, 8, 9]) {
      expect(screen.getByRole('link', { name: `${g} клас` })).toHaveAttribute('href', `/grade/${g}`)
    }
    expect(screen.getByRole('link', { name: /Увійти$/ })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /Живий квіз/ })).toHaveAttribute('href', '/quiz')
    expect(screen.queryByText(/Продовжити/)).not.toBeInTheDocument()
  })

  it('невідомий клас і невідома адреса дають сторінку «не знайдено»', async () => {
    await renderApp('/grade/5')
    expect(await screen.findByRole('heading', { name: 'Сторінку не знайдено' })).toBeInTheDocument()
  })
})
