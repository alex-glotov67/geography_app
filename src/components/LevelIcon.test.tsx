import { render, screen } from '@testing-library/react'
import { LEVELS } from '@/lib/levels'
import { LevelIcon } from './LevelIcon'

describe('LevelIcon', () => {
  it.each(LEVELS.map((l, i) => [l, i + 1] as const))('рівень %s зафарбовує %i сходинок', (level, filled) => {
    const { container } = render(<LevelIcon level={level} />)
    const rects = container.querySelectorAll('rect')
    expect(rects).toHaveLength(4)
    expect(container.querySelectorAll('rect[data-filled="true"]')).toHaveLength(filled)
  })

  it('без підпису має доступну назву', () => {
    render(<LevelIcon level="sufficient" />)
    expect(screen.getByRole('img', { name: 'Достатній рівень' })).toBeInTheDocument()
  })

  it('з підписом показує слово, а іконку ховає від екранних читачів', () => {
    const { container } = render(<LevelIcon level="high" withLabel />)
    expect(screen.getByText('Високий рівень')).toBeVisible()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
