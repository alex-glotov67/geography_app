import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { classesQuery } from '@/api/teacher'
import { ClassTiles, NewClassForm } from './ClassesPage'
import { TeacherPageSkeleton } from './TeacherSkeletons'
import t from './teacher.module.css'

/**
 * Огляд (SPEC 8.2, макет TeacherHome.dc.html). Зараз — класи й імпорт учнів; таблиця активних ДЗ
 * і «Потребує уваги» з'являться з ДЗ (Фаза 4), «Почати квіз» — з квізом (Фаза 6).
 */
export function TeacherHome() {
  const classes = useQuery(classesQuery())
  if (classes.isPending) return <TeacherPageSkeleton />
  if (classes.isError) return <p className={t.alert}>Не вдалося завантажити класи. Онови сторінку.</p>
  const first = classes.data.find((c) => !c.archived)
  return (
    <>
      <div className={t.pageHead}>
        <h1 className={t.pageTitle}>Огляд</h1>
        <div className={t.actions}>
          {first && (
            <Link to="/t/classes/$classId" params={{ classId: first.id }} search={{ import: true }} className={t.btn}>
              Імпортувати учнів
            </Link>
          )}
        </div>
      </div>
      <section className={t.card} aria-labelledby="my-classes">
        <h2 id="my-classes" className={t.h2}>
          Мої класи
        </h2>
        <ClassTiles classes={classes.data} />
      </section>
      {!first && <NewClassForm />}
    </>
  )
}
