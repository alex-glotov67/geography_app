import { render } from '@testing-library/react'
import { ContourBackground } from './ContourBackground'

describe('ContourBackground', () => {
  it('декоративний: прихований від читачів екрана, не перехоплює кліки, прив\'язаний до правого краю', () => {
    const { container } = render(<ContourBackground />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.style.pointerEvents).toBe('none')
    expect(svg.style.right).toBe('0px')
    expect(svg.style.height).toBe('100%')
    expect(svg.querySelectorAll('path').length).toBe(6)
    for (const p of svg.querySelectorAll('path')) expect(p.getAttribute('d')!.endsWith('Z')).toBe(true)
  })

  it('тримає прозорість у межах 0,12–0,35 (SPEC 13.3)', () => {
    const { container, rerender } = render(<ContourBackground opacity={0.9} />)
    expect(container.querySelector('svg')!.style.opacity).toBe('0.35')
    rerender(<ContourBackground opacity={0.01} />)
    expect(container.querySelector('svg')!.style.opacity).toBe('0.12')
  })
})
