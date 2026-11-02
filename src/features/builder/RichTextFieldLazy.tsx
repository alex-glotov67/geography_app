import { lazy, Suspense, type ComponentProps } from 'react'
import { Skeleton } from '@mantine/core'

/*
 * Tiptap (≈ 150 КБ gzip з ProseMirror) — окремий чанк, лише коли на екрані є поле форматованого
 * тексту. Поки вантажиться — скелетон тієї ж висоти: підпис, панель, поле (SPEC 13.7).
 */
const RichTextField = lazy(() => import('./RichTextField').then((m) => ({ default: m.RichTextField })))

export function RichTextFieldLazy(props: ComponentProps<typeof RichTextField>) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label={`${props.label}: завантаження редактора`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Skeleton height={16} width={80} />
          <Skeleton height={57} />
          <Skeleton height={120} />
        </div>
      }
    >
      <RichTextField {...props} />
    </Suspense>
  )
}
