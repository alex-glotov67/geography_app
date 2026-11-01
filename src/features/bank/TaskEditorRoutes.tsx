import { newTaskRoute, taskRoute } from '@/router'
import { TaskEditorPage } from './TaskEditorPage'

/** Редактор завдання — окремий чанк: банк і решта кабінету його не вантажать */
export function NewTaskRoute() {
  return <TaskEditorPage taskId={null} type={newTaskRoute.useSearch().type} />
}

export function TaskRoute() {
  return <TaskEditorPage taskId={taskRoute.useParams().taskId} />
}
