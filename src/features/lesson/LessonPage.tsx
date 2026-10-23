import { useSuspenseQuery } from '@tanstack/react-query'
import { lessonQuery } from '@/api/content'
import { useViewSettings } from '@/stores/viewSettings'
import { LessonView } from './LessonView'
import { SectionAside } from './SectionAside'

export function LessonPage({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(lessonQuery(slug))
  const { simplified, setSimplified } = useViewSettings()
  const s = data.snapshot
  return (
    <LessonView
      lesson={{
        slug, grade: s.grade, number: s.number, title: s.title, textbookRef: s.textbookRef, blocks: s.blocks,
        simplifiedBlocks: s.simplified?.blocks, isDemo: data.isDemo,
        homeworkCount: simplified ? (s.simplified?.homeworkCount ?? data.homeworkCount) : data.homeworkCount,
      }}
      refs={{ media: data.media, videos: data.videos, practiceTasks: data.practiceTasks }}
      simplified={simplified}
      onSimplifiedChange={setSimplified}
      aside={<SectionAside grade={s.grade} slug={slug} inSection={(l) => (l.section?.number ?? null) === (s.section?.number ?? null)} />}
    />
  )
}
