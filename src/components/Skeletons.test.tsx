import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { theme } from '@/theme/mantine-theme'
import { LessonListSkeleton, LessonPageSkeleton, TaskCardSkeleton } from './Skeletons'

const wrap = (ui: React.ReactElement) => render(<MantineProvider theme={theme}>{ui}</MantineProvider>)

describe('скелетони (SPEC 13.7)', () => {
  it('сторінка уроку: aria-busy, справжні заголовки секцій, форма як у LessonSkeleton.dc.html', () => {
    const { container } = wrap(<LessonPageSkeleton />)
    const region = screen.getByRole('status', { name: 'Урок завантажується' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    for (const h of ['Що ти дізнаєшся', 'Ключові терміни', 'Пояснення', 'Відео', 'Завдання']) {
      expect(screen.getByRole('heading', { level: 2, name: h })).toBeInTheDocument()
    }
    // 4 терміни і 4 рівні — як у макеті
    expect(container.querySelectorAll('[class*="termRow"]')).toHaveLength(4)
    expect(container.querySelectorAll('[class*="levelRow"]')).toHaveLength(4)
  })

  it('шапка уроку — тон tint, решта — звичайний', () => {
    const { container } = wrap(<LessonPageSkeleton />)
    expect(container.querySelectorAll('header [data-tone="tint"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('main [data-tone="tint"]')).toHaveLength(0)
  })

  it('список уроків і картка завдання — теж з aria-busy і без спінера', () => {
    wrap(
      <>
        <LessonListSkeleton count={3} />
        <TaskCardSkeleton />
      </>,
    )
    expect(screen.getByRole('status', { name: 'Уроки завантажуються' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status', { name: 'Завдання завантажується' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
