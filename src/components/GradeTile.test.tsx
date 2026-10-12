import { screen } from '@testing-library/react'
import { renderWithRouter } from '@/test/render'
import { GradeTile } from './GradeTile'

describe('GradeTile', () => {
  it('веде на сторінку класу і має кольор «висоти» класу', async () => {
    await renderWithRouter(<GradeTile grade={8} />)
    const link = await screen.findByRole('link', { name: '8 клас' })
    expect(link).toHaveAttribute('href', '/grade/8')
    expect(link.style.background).toBe('var(--grade-8)')
  })
})
