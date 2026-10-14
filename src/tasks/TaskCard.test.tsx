import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard, type PracticeTask } from './TaskCard'

const o = (...pairs: [string, string][]) => pairs.map(([id, text]) => ({ id, text }))
const task = (type: string, content: unknown, key: unknown, extra: Partial<PracticeTask> = {}): PracticeTask => ({
  id: type, type, level: 'base', points: 1, content, key, ...extra,
})
/** Відгук завдання (dnd-kit має ще власну живу область role=status) */
const status = async () => (await screen.findAllByRole('status')).find((e) => e.tagName === 'P' && !!e.textContent)!
const checkBtn = () => screen.getByRole('button', { name: 'Перевірити' })

describe('TaskCard — тренування (SPEC 7)', () => {
  it('single_choice: клавіатурою (Tab + стрілки) і хибна відповідь з підказкою', async () => {
    const u = userEvent.setup()
    render(
      <TaskCard
        number={1}
        task={task('single_choice', { prompt: 'Що переважає?', options: o(['a', 'Гори'], ['b', 'Рівнини'], ['c', 'Плато']), shuffle: false }, { correct: 'b' }, { hint: 'Подивись на карту' })}
      />,
    )
    expect(screen.getByRole('heading', { name: /Завдання 1, базовий рівень: Що переважає\?/ })).toBeInTheDocument()
    await u.click(checkBtn())
    expect(screen.getByText('Спершу дай відповідь.')).toBeInTheDocument()
    await u.click(screen.getByRole('radio', { name: 'Гори' }))
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Не зовсім')
    expect(screen.getByText('Подивись на карту')).toBeInTheDocument()
    screen.getByRole('radio', { name: 'Гори' }).focus()
    await u.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Рівнини' })).toBeChecked()
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно!')
  })

  it('multiple_choice: часткова відповідь', async () => {
    const u = userEvent.setup()
    render(<TaskCard number={2} task={task('multiple_choice', { prompt: 'Низовини?', options: o(['a', 'Поліська'], ['b', 'Подільська'], ['c', 'Причорноморська']), shuffle: false }, { correct: ['a', 'c'] })} />)
    await u.click(screen.getByRole('checkbox', { name: 'Поліська' }))
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно 2 з 3')
  })

  it('true_false і matching: рядки «пігулок»', async () => {
    const u = userEvent.setup()
    const { unmount } = render(
      <TaskCard number={3} task={task('true_false', { statements: o(['s1', 'Говерла — найвища']) }, { answers: { s1: true } })} />,
    )
    await u.click(screen.getByRole('radio', { name: 'Так' }))
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно!')
    unmount()
    render(<TaskCard number={4} task={task('matching', { prompt: 'Висоти', left: o(['l1', 'Низовина'], ['l2', 'Височина']), right: o(['r1', 'до 200 м'], ['r2', '200–500 м']) }, { pairs: { l1: 'r1', l2: 'r2' } })} />)
    // «Торкнись варіанта → торкнись рядка» (запасний режим для клавіатури й читачів екрана)
    const bank = () => within(screen.getByRole('group', { name: 'Варіанти' }))
    await u.click(bank().getByRole('button', { name: 'до 200 м' }))
    await u.click(screen.getByRole('button', { name: 'Покласти «до 200 м» у «Низовина»' }))
    await u.click(bank().getByRole('button', { name: 'до 200 м' }))
    await u.click(screen.getByRole('button', { name: 'Покласти «до 200 м» у «Височина»' }))
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно 1 з 2')
    expect(screen.getByRole('button', { name: 'Низовина: до 200 м' })).toBeInTheDocument()
    // Значення в рядку можна прибрати
    await u.click(screen.getByRole('button', { name: 'Прибрати «до 200 м» з «Височина»' }))
    expect(screen.getByRole('button', { name: 'Височина: порожньо' })).toBeDisabled()
  })

  it('ordering: кнопки «вище/нижче», старт не збігається з правильним порядком', async () => {
    const u = userEvent.setup()
    render(<TaskCard number={5} task={task('ordering', { prompt: 'Від низького', items: o(['a', 'Низовина'], ['b', 'Височина'], ['c', 'Гори']), scoring: 'exact' }, { correctOrder: ['a', 'b', 'c'] })} />)
    const order = () => screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/^\d/, '').replace(/Вище.*$/, '').trim())
    expect(order()).not.toEqual(['Низовина', 'Височина', 'Гори'])
    // Сортуємо вибором: піднімаємо кожен потрібний елемент на своє місце
    for (const [i, name] of ['Низовина', 'Височина'].entries()) {
      while (order().indexOf(name) > i) await u.click(screen.getByRole('button', { name: `Вище: ${name}` }))
    }
    expect(order()).toEqual(['Низовина', 'Височина', 'Гори'])
    expect(screen.getByText(/тепер на місці/)).toBeInTheDocument()
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно!')
  })

  it('categorize: торкнись картки, потім групи; картку можна повернути', async () => {
    const u = userEvent.setup()
    render(<TaskCard number={6} task={task('categorize', { prompt: 'Розподіли', groups: [{ id: 'g1', title: 'Низовини' }, { id: 'g2', title: 'Височини' }], cards: o(['c1', 'Поліська'], ['c2', 'Волинська']) }, { groups: { c1: 'g1', c2: 'g2' } })} />)
    await u.click(screen.getByRole('button', { name: 'Поліська' }))
    await u.click(screen.getByRole('button', { name: /^Височини/ }))
    await u.click(screen.getByRole('button', { name: 'Повернути «Поліська»' }))
    await u.click(screen.getByRole('button', { name: 'Поліська' }))
    await u.click(screen.getByRole('button', { name: /^Низовини/ }))
    await u.click(screen.getByRole('button', { name: 'Волинська' }))
    await u.click(screen.getByRole('button', { name: /^Височини/ }))
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно!')
  })

  it('fill_blanks: введення з апострофом і select', async () => {
    const u = userEvent.setup()
    const { unmount } = render(<TaskCard number={7} task={task('fill_blanks', { text: 'Річка {{b1}}', mode: 'input' }, { blanks: { b1: ["Прип'ять"] } })} />)
    await u.type(screen.getByRole('textbox', { name: 'Пропуск 1' }), 'припʼять')
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Правильно!')
    unmount()
    render(<TaskCard number={8} task={task('fill_blanks', { text: 'Найвища — {{b1}}', mode: 'select', options: { b1: ['Говерла', 'Ай-Петрі'] } }, { blanks: { b1: ['Говерла'] } })} />)
    await u.selectOptions(screen.getByRole('combobox', { name: 'Пропуск 1' }), 'Ай-Петрі')
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Не зовсім')
  })

  it('numeric: кома, «замало», некоректне число', async () => {
    const u = userEvent.setup()
    render(<TaskCard number={9} task={task('numeric', { prompt: 'Висота Говерли', unit: 'м' }, { answer: 2061, tolerance: 5 }, { feedback: { incorrect: 'Згадай атлас.' } })} />)
    const input = screen.getByRole('textbox', { name: 'Відповідь, м' })
    await u.type(input, 'дві')
    expect(screen.getByText(/Введи число/)).toBeInTheDocument()
    await u.clear(input)
    await u.type(input, '2 000,5')
    await u.click(checkBtn())
    expect(await status()).toHaveTextContent('Замало. Згадай атлас.')
  })

  it('пошкоджене завдання не ламає сторінку', () => {
    render(<TaskCard number={10} task={task('single_choice', { prompt: 'x' }, {})} />)
    expect(screen.getByText(/не вдалося показати/)).toBeInTheDocument()
  })
})
