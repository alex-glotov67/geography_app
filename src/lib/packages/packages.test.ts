import { strToU8, unzipSync, zipSync } from 'fflate'
import lessonJson from '../../../seed/demo-lesson/lesson.json'
import tasksJson from '../../../seed/demo-lesson/tasks.json'
import mediaJson from '../../../seed/demo-lesson/media.json'
import videosJson from '../../../seed/demo-lesson/videos.json'
import { readPackage, writePackage } from './read'

const files = Object.fromEntries((mediaJson as { file: string }[]).map((m) => [m.file, strToU8(`<svg>${m.file}</svg>`)]))
const parts = (over: Record<string, unknown> = {}) =>
  ({ lesson: lessonJson, tasks: tasksJson, media: mediaJson, videos: videosJson, files, author: 'тест', demo: true, createdAt: '2026-10-13T00:00:00.000Z', ...over }) as never

describe('пакет .geo.zip (SPEC 10.6)', () => {
  it('round-trip: записаний пакет читається без помилок і з тим самим змістом', async () => {
    const zip = await writePackage(parts())
    const { pkg, errors } = await readPackage(zip)
    expect(errors).toEqual([])
    expect(pkg!.lesson.slug).toBe('demo-relief')
    expect(pkg!.tasks.map((t) => t.id)).toEqual(tasksJson.map((t) => t.id))
    expect(pkg!.manifest).toMatchObject({ formatVersion: 1, demo: true, containsAnswers: true })
    // Детермінованість: ті самі дані — ті самі байти
    expect(await writePackage(parts())).toEqual(zip)
  })

  it('пошкоджений або чужий архів — зрозуміла помилка', async () => {
    expect((await readPackage(strToU8('не zip'))).errors[0]!.message).toMatch(/пошкоджений/)
    expect((await readPackage(zipSync({ 'a.txt': strToU8('x') }))).errors[0]!.message).toMatch(/manifest\.json/)
  })

  it('змінений файл, зайвий файл і невідома версія формату', async () => {
    const entries = unzipSync(await writePackage(parts()))
    entries['tasks.json'] = strToU8('[]')
    entries['зайвий.txt'] = strToU8('x')
    const r = await readPackage(zipSync(entries))
    expect(r.errors.map((e) => e.message)).toEqual(
      expect.arrayContaining(['Контрольна сума не збігається — файл пошкоджено', 'Файл є в архіві, але не зазначений у manifest.json']),
    )
    const m = JSON.parse(new TextDecoder().decode(entries['manifest.json']))
    entries['manifest.json'] = strToU8(JSON.stringify({ ...m, formatVersion: 99 }))
    expect((await readPackage(zipSync(entries))).errors[0]!.message).toMatch(/версія формату 99/)
  })

  it('валідатор: secure у тренуванні, відсутні посилання, alt, квіз-пул', async () => {
    const lesson = structuredClone(lessonJson) as typeof lessonJson
    const practice = lesson.blocks.find((b) => b.type === 'practice') as { taskIds: string[] }
    practice.taskIds.push('hw-1', 'нема')
    lesson.quizPool.push('t-forms')
    const media = (mediaJson as { id: string; alt?: string }[]).map((m) => (m.id === 'contours' ? { ...m, alt: undefined } : m))
    const { errors } = await readPackage(await writePackage(parts({ lesson, media })))
    const msgs = errors.map((e) => e.message)
    expect(msgs).toEqual(
      expect.arrayContaining([
        'У тренуванні лише відкриті завдання; «hw-1» — захищене',
        'Завдання «нема» немає в tasks.json',
        'У ДЗ і квіз-пулі лише захищені завдання; «t-forms» — відкрите',
        '«hw-1» не може бути і в тренуванні, і в ДЗ / квізі',
        'Зображенню потрібен опис для незрячих (alt)',
      ]),
    )
  })

  it('попередження не блокують: немає високого рівня, правильна відповідь на тій самій позиції', async () => {
    const tasks = (tasksJson as { id: string; level: string }[]).map((t) => (t.id === 't-scale' ? { ...t, level: 'sufficient' } : t))
    const { pkg, warnings } = await readPackage(await writePackage(parts({ tasks })))
    expect(pkg).not.toBeNull()
    expect(warnings.map((w) => w.message)).toContain('У тренуванні немає завдань високого рівня')
  })
})
