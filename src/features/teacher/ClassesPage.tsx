import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { UA_LETTERS } from '@shared/accounts/index.ts'
import { classesQuery, createClass, currentSchoolYear, type ClassItem } from '@/api/teacher'
import { GRADES } from '@/lib/grades'
import { studentsWord } from '@/lib/plural'
import { TeacherPageSkeleton } from './TeacherSkeletons'
import t from './teacher.module.css'

/** Плитки класів у кольорах висот (як на головній) */
export function ClassTiles({ classes }: { classes: ClassItem[] }) {
  const active = classes.filter((c) => !c.archived)
  if (!active.length) return <p className={t.empty}>Класів ще немає — створи перший нижче.</p>
  return (
    <div className={t.tiles}>
      {active.map((c) => (
        <Link
          key={c.id}
          to="/t/classes/$classId"
          params={{ classId: c.id }}
          className={t.tile}
          style={{ '--tile-color': `var(--grade-${c.grade})` } as React.CSSProperties}
        >
          <span className={t.tileName}>{c.name}</span>
          <span className={t.tileNote}>
            {studentsWord(c.studentCount)} · {c.schoolYear}
          </span>
        </Link>
      ))}
    </div>
  )
}

const NewClass = z.object({
  grade: z.coerce.number().int().min(6).max(9),
  letter: z.string().length(1, 'Обери літеру'),
})

/** Новий клас: номер + літера → «8-Б», рік — поточний навчальний */
export function NewClassForm() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm<z.input<typeof NewClass>, unknown, z.output<typeof NewClass>>({
    resolver: zodResolver(NewClass),
    defaultValues: { grade: 8, letter: 'А' },
  })
  const year = currentSchoolYear()
  const onSubmit = handleSubmit(async ({ grade, letter }) => {
    setError(null)
    try {
      const id = await createClass(`${grade}-${letter}`, year)
      await qc.invalidateQueries({ queryKey: ['t', 'classes'] })
      await navigate({ to: '/t/classes/$classId', params: { classId: id } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося створити клас')
    }
  })
  return (
    <form className={t.card} onSubmit={onSubmit} noValidate>
      <h2 className={t.h2}>Новий клас</h2>
      <div className={t.fieldRow}>
        <label className={t.field} style={{ flexGrow: 0, flexBasis: 120 }}>
          <span className={t.fieldLabel}>Клас</span>
          <select className={t.select} {...register('grade')}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className={t.field} style={{ flexGrow: 0, flexBasis: 120 }}>
          <span className={t.fieldLabel}>Літера</span>
          <select className={t.select} {...register('letter')}>
            {[...UA_LETTERS].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <span className={t.note} style={{ alignSelf: 'center' }}>
          Навчальний рік {year}
        </span>
        <button type="submit" className={t.btnPrimary} disabled={formState.isSubmitting}>
          Створити клас
        </button>
      </div>
      {error && (
        <p className={t.alert} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export function ClassesPage() {
  const classes = useQuery(classesQuery())
  if (classes.isPending) return <TeacherPageSkeleton />
  if (classes.isError) return <p className={t.alert}>Не вдалося завантажити класи. Онови сторінку.</p>
  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>Класи й учні</h1>
      </div>
      <ClassTiles classes={classes.data} />
      <NewClassForm />
    </>
  )
}
