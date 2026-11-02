import { slotFromParam, slotVisibility } from '@/features/builder/draft'
import { newTaskRoute, taskRoute } from '@/router'
import { TaskEditorPage } from './TaskEditorPage'

/** Редактор завдання — окремий чанк: банк і решта кабінету його не вантажать */
export function NewTaskRoute() {
  const { type, lesson, slot } = newTaskRoute.useSearch()
  const target = slotFromParam(slot)
  // «Нове завдання» з блоку уроку: вид завдання — за місцем, після збереження — назад в урок
  const returnTo = lesson && target ? { lessonId: lesson, slot: slot!, visibility: slotVisibility(target) } : undefined
  return <TaskEditorPage taskId={null} type={type} returnTo={returnTo} />
}

export function TaskRoute() {
  return <TaskEditorPage taskId={taskRoute.useParams().taskId} />
}
