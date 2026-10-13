import { Link } from '@tanstack/react-router'
import { tasksWord } from '@/lib/plural'
import { useLesson } from '../lessonContext'
import classes from '../blocks.module.css'

/**
 * Блок ДЗ (Lesson.dc.html). Гість бачить лише кількість завдань і пропозицію увійти (SPEC 6.2);
 * виконання онлайн і PDF для учня з відкритим призначенням — Фаза 4.
 */
export function HomeworkView() {
  const { homeworkCount } = useLesson()
  if (!homeworkCount) return null
  return (
    <section className={classes.homework} aria-labelledby="hw-title">
      <div>
        <h2 id="hw-title">Домашнє завдання</h2>
        <p className={classes.homeworkMeta}>{tasksWord(homeworkCount)}. Вчитель видає ДЗ твоєму класу з терміном.</p>
      </div>
      <Link to="/login" className={classes.homeworkAction}>
        Увійти, щоб виконати онлайн
      </Link>
    </section>
  )
}
