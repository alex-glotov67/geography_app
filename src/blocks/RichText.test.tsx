import { render, screen } from '@testing-library/react'
import { RichText } from './RichText'

describe('RichText', () => {
  it('рендерить дозволені вузли; посилання — у новій вкладці без referrer', () => {
    render(
      <RichText
        doc={{
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Заголовок' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'жирне', marks: [{ type: 'bold' }] }, { type: 'text', text: 'атлас', marks: [{ type: 'link', attrs: { href: 'https://example.org' } }] }] },
            { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'пункт' }] }] }] },
          ],
        }}
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Заголовок' })).toBeInTheDocument()
    expect(screen.getByText('жирне').closest('strong')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'атлас' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('listitem')).toHaveTextContent('пункт')
  })

  it('невідомі вузли не рендеряться (без сирого HTML)', () => {
    const { container } = render(<RichText doc={{ type: 'doc', content: [{ type: 'html', text: '<img src=x onerror=alert(1)>' }] } as never} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('')
  })
})
