import { Skeleton } from '@mantine/core'

/**
 * Скелетон сторінки кабінету тієї ж форми: заголовок + картка з рядками (SPEC 13.7). Без CSS
 * кабінету — він у головному чанку як pendingComponent маршруту /t.
 */
/** standalone — без розмітки кабінету (поки перевіряється вхід), тоді з власними відступами */
export function TeacherPageSkeleton({ rows = 4, standalone = false }: { rows?: number; standalone?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Завантаження" style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(standalone ? { padding: '32px var(--page-x)' } : {}) }}>
      <Skeleton height={38} width={220} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '22px 24px',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--surface)',
        }}
      >
        <Skeleton height={22} width={180} />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} height={20} width={`${90 - i * 8}%`} />
        ))}
      </div>
    </div>
  )
}
