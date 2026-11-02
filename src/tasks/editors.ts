import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { TaskContent, TaskKey, TaskType } from '@shared/schemas/tasks/index.ts'

/**
 * Редактори типів завдань для вчителя (SPEC 7, 10.3) — окремо від модулів рендеру (registry.ts):
 * тренування учня їх не вантажить. Кожен редактор — свій чанк, лише коли відкрито цей тип.
 * Тип з редактором автоматично з'являється в каталозі «Нове завдання».
 */
export interface TaskEditorModule<T extends TaskType> {
  /** Форма типу всередині React Hook Form над TaskFormValues */
  Editor: LazyExoticComponent<ComponentType>
  /** Порожнє завдання-заготовка */
  template: () => { content: TaskContent<T>; key: TaskKey<T> }
}

export const TASK_EDITORS: { [T in TaskType]?: TaskEditorModule<T> } = {
  single_choice: {
    Editor: lazy(() => import('./single_choice/Editor').then((m) => ({ default: m.SingleChoiceEditor }))),
    template: () => ({ content: { prompt: '', shuffle: true, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }] }, key: { correct: 'a' } }),
  },
  multiple_choice: {
    Editor: lazy(() => import('./multiple_choice/Editor').then((m) => ({ default: m.MultipleChoiceEditor }))),
    template: () => ({ content: { prompt: '', shuffle: true, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }] }, key: { correct: ['a'] } }),
  },
  true_false: {
    Editor: lazy(() => import('./true_false/Editor').then((m) => ({ default: m.TrueFalseEditor }))),
    template: () => ({ content: { prompt: 'Чи правильні твердження?', statements: [{ id: 'sa', text: '' }] }, key: { answers: { sa: true } } }),
  },
  numeric: {
    Editor: lazy(() => import('./numeric/Editor').then((m) => ({ default: m.NumericEditor }))),
    template: () => ({ content: { prompt: '' }, key: { answer: Number.NaN, tolerance: 0 } }),
  },
}
