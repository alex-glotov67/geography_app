import type { Block } from '@shared/schemas/blocks.ts'
import { keyIssues } from '@shared/schemas/tasks/index.ts'
import type { GeoPackage, PackageTask } from './schema'

/**
 * Валідатор пакета (SPEC 17) — спільний для імпорту й публікації. Помилки блокують, попередження — ні.
 */
export interface Issue {
  level: 'error' | 'warning'
  where: string
  message: string
}

/** Типи, дозволені в квізі, і їхні обмеження (SPEC 9.2) — для квіз-пулу уроку */
const QUIZ_TYPES = new Set(['single_choice', 'true_false', 'multiple_choice', 'odd_one_out', 'ordering', 'numeric', 'slider_estimate', 'map_click', 'map_pin', 'image_hotspot', 'coordinates'])

const allBlocks = (pkg: GeoPackage): { block: Block; where: string }[] => [
  ...pkg.lesson.blocks.map((block) => ({ block, where: `lesson.json → блок «${block.id}»` })),
  ...(pkg.lesson.simplified?.blocks ?? []).map((block) => ({ block, where: `lesson.json → спрощений блок «${block.id}»` })),
]

export function validatePackage(pkg: GeoPackage): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const err = (where: string, message: string) => errors.push({ level: 'error', where, message })
  const warn = (where: string, message: string) => warnings.push({ level: 'warning', where, message })

  const tasks = new Map(pkg.tasks.map((t) => [t.id, t]))
  const media = new Map(pkg.media.map((m) => [m.id, m]))
  const videos = new Set(pkg.videos.map((v) => v.id))

  for (const [name, list] of [['tasks.json', pkg.tasks], ['media.json', pkg.media], ['videos.json', pkg.videos]] as const) {
    const ids = list.map((x) => x.id)
    for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) err(name, `id «${id}» повторюється`)
  }

  // Завдання: узгодженість змісту й ключа, short_text лише secure
  for (const t of pkg.tasks) {
    const where = `tasks.json → «${t.id}»`
    for (const m of keyIssues(t.type, t.content, t.key)) err(where, m)
    if (t.type === ('short_text' as string) && t.visibility !== 'secure') err(where, 'Відкрита відповідь — лише захищене завдання')
  }

  // Посилання уроку: тренування — open, ДЗ і квіз-пул — secure, не в обох ролях
  const practice = new Set<string>()
  const refTask = (id: string, where: string, need: PackageTask['visibility']): PackageTask | undefined => {
    const t = tasks.get(id)
    if (!t) {
      err(where, `Завдання «${id}» немає в tasks.json`)
      return undefined
    }
    if (t.visibility !== need)
      err(where, need === 'open' ? `У тренуванні лише відкриті завдання; «${id}» — захищене` : `У ДЗ і квіз-пулі лише захищені завдання; «${id}» — відкрите`)
    return t
  }
  for (const { block, where } of allBlocks(pkg)) {
    if (block.type === 'practice') block.taskIds.forEach((id) => (refTask(id, where, 'open'), practice.add(id)))
    if (block.type === 'image' || block.type === 'file') {
      const m = media.get(block.mediaId)
      if (!m) err(where, `Медіа «${block.mediaId}» немає в media.json`)
      else if (block.type === 'file' && m.kind !== 'pdf') err(where, `«${block.mediaId}» — не PDF`)
      else if (block.type === 'image' && m.kind !== 'image') err(where, `«${block.mediaId}» — не зображення`)
    }
    if (block.type === 'gallery') for (const it of block.items) if (!media.get(it.mediaId)) err(where, `Медіа «${it.mediaId}» немає в media.json`)
    if (block.type === 'video' && !videos.has(block.videoId)) err(where, `Відео «${block.videoId}» немає в videos.json`)
  }
  const homework = [...(pkg.lesson.homework?.taskIds ?? []), ...(pkg.lesson.simplified?.homeworkTaskIds ?? [])]
  homework.forEach((id) => refTask(id, 'lesson.json → homework', 'secure'))
  for (const id of pkg.lesson.quizPool) {
    const t = refTask(id, 'lesson.json → quizPool', 'secure')
    if (!t) continue
    if (!QUIZ_TYPES.has(t.type)) err(`tasks.json → «${id}»`, `Тип ${t.type} не допускається в квізі (SPEC 9.2)`)
    const opts = (t.content as { options?: unknown[] }).options
    if (opts && opts.length > 4) err(`tasks.json → «${id}»`, 'У квізі не більше 4 варіантів')
    const st = (t.content as { statements?: unknown[] }).statements
    if (t.type === 'true_false' && st && st.length !== 1) err(`tasks.json → «${id}»`, 'У квізі «так / ні» — одне твердження')
  }
  for (const id of homework.concat(pkg.lesson.quizPool)) if (practice.has(id)) err('lesson.json', `«${id}» не може бути і в тренуванні, і в ДЗ / квізі`)

  // Медіа: alt для зображень, файли на місці, джерело й ліцензія — попередження
  for (const m of pkg.media) {
    const where = `media.json → «${m.id}»`
    if (!pkg.files[m.file]) err(where, `Немає файлу ${m.file}`)
    if (m.kind === 'image' && !m.alt) err(where, 'Зображенню потрібен опис для незрячих (alt)')
    if (!m.source) warn(where, 'Не вказано джерело')
    if (!m.license) warn(where, 'Не вказано ліцензію')
  }

  // TODO(teacher) лише в чернетках: пакет імпортується чернеткою, тож — попередження
  if (JSON.stringify(pkg.lesson).includes('TODO(teacher)')) warn('lesson.json', 'Є TODO(teacher) — урок не можна буде опублікувати, доки їх не прибрано')

  // Педагогічні попередження (SPEC 17)
  const practiceTasks = [...practice].map((id) => tasks.get(id)).filter((t): t is PackageTask => !!t)
  if (practiceTasks.length && !practiceTasks.some((t) => t.level === 'high')) warn('lesson.json', 'У тренуванні немає завдань високого рівня')
  const groups = new Set(pkg.tasks.map((t) => t.grp))
  if (!groups.has('ГР2') || !groups.has('ГР3')) warn('tasks.json', 'Немає завдань ГР2 або ГР3')
  const positions = pkg.tasks
    .filter((t) => t.type === 'single_choice')
    .map((t) => (t.content.options as { id: string }[]).findIndex((o) => o.id === (t.key as { correct: string }).correct))
  if (positions.length >= 3 && new Set(positions).size === 1) warn('tasks.json', 'Правильна відповідь завжди на тій самій позиції')

  return { errors, warnings }
}
