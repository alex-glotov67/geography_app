import { render, screen } from '@testing-library/react'
import { TaskCard } from './TaskCard'

// Регресія: стартовий порядок не може збігатися з правильним — за будь-якого перемішування
describe('ordering: старт ніколи не дорівнює правильному порядку', () => {
  it.each(Array.from({ length: 40 }, (_, i) => i))('спроба %i', (i) => {
    const items = [{ id: 'a', text: 'А' }, { id: 'b', text: 'Б' }, { id: 'c', text: 'В' }]
    const { unmount } = render(
      <TaskCard number={i} task={{ id: `o${i}`, type: 'ordering', level: 'base', points: 1, content: { prompt: 'П', items, scoring: 'exact' }, key: { correctOrder: ['a', 'b', 'c'] } }} />,
    )
    const order = screen.getAllByRole('listitem').map((li) => li.textContent?.match(/[АБВ]/)?.[0])
    expect(order).not.toEqual(['А', 'Б', 'В'])
    unmount()
  })
})
