import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import type { Me } from '@/api/auth'
import { createLesson, directoryQuery, freeSlug, lessonSlug, lessonsQuery, type DirSection, type LessonRow } from '@/api/builder'
import { TeacherPageSkeleton } from '@/features/teacher/TeacherSkeletons'
import t from '@/features/teacher/teacher.module.css'
import { GRADES } from '@/lib/grades'

/*
 * Уроки (SPEC 8.2): дерево «клас → розділ → урок» зі статусами, пошук, «Новий урок».
 * Розділи — з довідника програми вчителя. Адреса уроку g8-u05 — пропонується з класу й номера,
 * до першої публікації її можна змінити (далі вона в QR і не змінюється).
 */

type Teacher = Extract<Me, { kind: 'teacher' }>

const STATUS: Record<LessonRow['status'], { text: string; cls: string }> = {
  draft: { text: 'Чернетка — учні не бачать', cls: t.statusSkip! },
  published: { text: 'Опубліковано', cls: t.statusNew! },
  changed: { text: 'Опубліковано · є зміни', cls: t.statusNew! },
}

const norm = (s: string) => s.toLocaleLowerCase('uk')

export function LessonsPage({ me, grade }: { me: Teacher; grade: number }) {
  const navigate = useNavigate()
  const lessons = useQuery(lessonsQuery(me.id))
  const dir = useQuery(directoryQuery(me.id))
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)

  const groups = useMemo(() => {
    if (!lessons.data || !dir.data) return []
    const query = norm(q.trim())
    const list = lessons.data.filter((l) => l.grade === grade && (!query || norm(`${l.number ?? ''} ${l.title} ${l.slug}`).includes(query)))
    const sections = dir.data.filter((s) => s.grade === grade)
    const bySection = sections.map((s) => ({ key: s.id, title: `${s.number === 0 ? 'Вступ' : `Розділ ${s.number}`}. ${s.title}`, lessons: list.filter((l) => l.sectionId === s.id) }))
    const loose = list.filter((l) => !l.sectionId || !sections.some((s) => s.id === l.sectionId))
    return [...bySection, ...(loose.length ? [{ key: 'none', title: 'Без розділу', lessons: loose }] : [])].filter((g) => g.lessons.length || !query)
  }, [lessons.data, dir.data, grade, q])

  if (lessons.isPending || dir.isPending) return <TeacherPageSkeleton rows={8} />
  if (lessons.isError || dir.isError) return <p className={t.alert}>Не вдалося завантажити уроки. Онови сторінку.</p>

  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>Уроки</h1>
        <div className={t.actions}>
          <button type="button" className={t.btnPrimary} onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            Новий урок
          </button>
        </div>
      </div>

      <div className={t.fieldRow}>
        <div className={t.actions} role="tablist" aria-label="Клас">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={g === grade}
              className={g === grade ? t.btnPrimary : t.btn}
              onClick={() => void navigate({ to: '/t/lessons', search: { grade: g } })}
            >
              {g} клас
            </button>
          ))}
        </div>
        <label className={t.field} style={{ maxWidth: 360 }}>
          <span className="visually-hidden">Пошук уроку</span>
          <input className={t.input} type="search" placeholder="Пошук: номер, тема" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {adding && (
        <NewLessonForm
          grade={grade}
          sections={dir.data.filter((s) => s.grade === grade)}
          lessons={lessons.data}
          onCancel={() => setAdding(false)}
        />
      )}

      {dir.data.every((s) => s.grade !== grade) && (
        <p className={t.notice}>
          Для {grade} класу ще немає розділів. Імпортуй <Link to="/t/outcomes">довідник програми</Link> — розділи й теми знадобляться для
          уроків. Урок можна створити й без розділу.
        </p>
      )}

      {groups.length === 0 ? (
        <p className={t.empty}>{q ? 'Нічого не знайдено.' : `Уроків ${grade} класу ще немає.`}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className={t.card} aria-label={g.title}>
            <h2 className={t.h2}>{g.title}</h2>
            {g.lessons.length === 0 ? (
              <p className={t.empty}>Уроків ще немає.</p>
            ) : (
              <div className={t.tableWrap}>
                <table className={t.table}>
                  <thead>
                    <tr>
                      <th scope="col">№</th>
                      <th scope="col">Тема</th>
                      <th scope="col">Адреса</th>
                      <th scope="col">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lessons.map((l) => (
                      <tr key={l.id}>
                        <td className={t.num}>{l.number ?? '—'}</td>
                        <td>
                          <Link to="/t/lessons/$lessonId" params={{ lessonId: l.id }} className={t.strong} style={{ color: 'var(--ink)' }}>
                            {l.title}
                          </Link>
                          {l.isDemo && <span className={t.muted}> · ДЕМО</span>}
                        </td>
                        <td className={t.mono} style={{ fontSize: 14 }}>
                          {l.slug}
                        </td>
                        <td className={STATUS[l.status].cls}>
                          <span className={l.status === 'draft' ? t.strong : undefined}>{STATUS[l.status].text}</span>
                          {l.publishedVersion ? ` (версія ${l.publishedVersion})` : ''}
                          {l.status === 'draft' && (
                            <span className={t.muted} style={{ display: 'block', fontSize: 14 }}>
                              Опублікуйте урок у конструкторі
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </>
  )
}

const NewLesson = z.object({
  sectionId: z.string(),
  number: z.coerce.number().int('Ціле число').min(1, 'Від 1').max(200, 'До 200'),
  title: z.string().trim().min(1, 'Вкажи тему уроку').max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Латиниця, цифри й дефіс, напр. g8-u05')
    .max(64),
})

function NewLessonForm({
  grade,
  sections,
  lessons,
  onCancel,
}: {
  grade: number
  sections: DirSection[]
  lessons: LessonRow[]
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const nextNumber = Math.max(0, ...lessons.filter((l) => l.grade === grade).map((l) => l.number ?? 0)) + 1
  const taken = lessons.map((l) => l.slug)
  // Розділ за замовчуванням: як в останнього уроку класу, інакше перший розділ після вступу
  const last = lessons.filter((l) => l.grade === grade && l.sectionId).sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0]
  const defaultSection = (last && sections.find((s) => s.id === last.sectionId)) ?? sections.find((s) => s.number > 0) ?? sections[0]
  const { register, handleSubmit, formState, setValue, getFieldState } = useForm<
    z.input<typeof NewLesson>,
    unknown,
    z.output<typeof NewLesson>
  >({
    resolver: zodResolver(NewLesson),
    defaultValues: { sectionId: defaultSection?.id ?? '', number: nextNumber, title: '', slug: freeSlug(lessonSlug(grade, nextNumber), taken) },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      const id = await createLesson({ grade, sectionId: v.sectionId || null, number: v.number, title: v.title, slug: v.slug })
      await qc.invalidateQueries({ queryKey: ['t', 'lessons'] })
      await navigate({ to: '/t/lessons/$lessonId', params: { lessonId: id } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити урок')
    }
  })

  return (
    <form className={t.cardAccent} onSubmit={onSubmit} noValidate aria-labelledby="new-lesson">
      <h2 id="new-lesson" className={t.h2}>
        Новий урок · {grade} клас
      </h2>
      <div className={t.fieldRow}>
        <label className={t.field}>
          <span className={t.fieldLabel}>Розділ</span>
          <select className={t.select} {...register('sectionId')}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number === 0 ? 'Вступ' : `Розділ ${s.number}`}. {s.title}
              </option>
            ))}
            <option value="">Без розділу</option>
          </select>
        </label>
        <label className={t.field} style={{ flexGrow: 0, flexBasis: 110 }}>
          <span className={t.fieldLabel}>№ уроку</span>
          <input
            className={t.input}
            type="number"
            min={1}
            {...register('number', {
              onChange: (e) => {
                // Адресу підлаштовуємо під номер, доки вчитель не змінив її сам
                if (!getFieldState('slug').isDirty && Number(e.target.value) > 0) {
                  setValue('slug', freeSlug(lessonSlug(grade, Number(e.target.value)), taken))
                }
              },
            })}
            aria-invalid={!!formState.errors.number}
          />
        </label>
        <label className={t.field} style={{ flexBasis: 320 }}>
          <span className={t.fieldLabel}>Тема уроку</span>
          <input className={t.input} {...register('title')} aria-invalid={!!formState.errors.title} />
        </label>
      </div>
      <div className={t.fieldRow}>
        <label className={t.field} style={{ maxWidth: 320 }}>
          <span className={t.fieldLabel}>Адреса: /lesson/…</span>
          <input
            className={`${t.input} ${t.mono}`}
            {...register('slug')}
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={!!formState.errors.slug}
            aria-describedby="slug-note"
          />
        </label>
        <span id="slug-note" className={t.note} style={{ alignSelf: 'center' }}>
          Після першої публікації адреса не змінюється — вона в QR-кодах.
        </span>
      </div>
      {Object.values(formState.errors).map((e, i) => (
        <span key={i} className={t.fieldError}>
          {e?.message}
        </span>
      ))}
      {error && (
        <p className={t.alert} role="alert">
          {error}
        </p>
      )}
      <div className={t.footerActions}>
        <button type="button" className={t.btn} onClick={onCancel}>
          Скасувати
        </button>
        <button type="submit" className={t.btnPrimary} disabled={formState.isSubmitting}>
          Створити й відкрити конструктор
        </button>
      </div>
    </form>
  )
}
