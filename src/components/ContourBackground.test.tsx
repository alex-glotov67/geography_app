import { render } from '@testing-library/react'
import { ContourBackground } from './ContourBackground'

describe('ContourBackground', () => {
  it('декоративний: прихований від екранних читачів і не перехоплює кліки', () => {
    const { container } = render(<ContourBackground width={390} height={260} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg.style.pointerEvents).toBe('none')
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0)
  })

  it('тримає прозорість у межах 0,12–0,35 (SPEC 13.3)', () => {
    const { container, rerender } = render(<ContourBackground width={10} height={10} opacity={0.9} />)
    expect(container.querySelector('svg')!.style.opacity).toBe('0.35')
    rerender(<ContourBackground width={10} height={10} opacity={0.01} />)
    expect(container.querySelector('svg')!.style.opacity).toBe('0.12')
  })
})
