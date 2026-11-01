import { useFormContext, useFormState, useWatch, type FieldErrors } from 'react-hook-form'
import type { TaskFormValues } from '@/features/bank/taskForm'

/* Спільні хуки й функції редакторів типів (SPEC 10.3) — без компонентів (Fast Refresh) */

/** Повідомлення помилки за шляхом 'content.options' тощо (вкладені помилки zodResolver) */
export function errorAt(errors: FieldErrors<TaskFormValues>, path: string): string | undefined {
  let node: unknown = errors
  for (const part of path.split('.')) node = (node as Record<string, unknown> | undefined)?.[part]
  const n = node as { message?: string; root?: { message?: string } } | undefined
  return n?.message ?? n?.root?.message
}

/** Поточні зміст і ключ + запис цілком (перевірка — одразу, якщо форму вже надсилали) */
export function useTaskParts<C, K>() {
  const { setValue, control } = useFormContext<TaskFormValues>()
  const { isSubmitted } = useFormState({ control })
  const content = useWatch({ control, name: 'content' }) as C
  const key = useWatch({ control, name: 'key' }) as K
  const opts = { shouldDirty: true, shouldValidate: isSubmitted }
  return {
    content,
    key,
    setContent: (next: C) => setValue('content', next as TaskFormValues['content'], opts),
    setKey: (next: K) => setValue('key', next as TaskFormValues['key'], opts),
  }
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
/** Наступний вільний id: a, b, c… (стабільний — не залежить від порядку показу) */
export const nextId = (taken: string[], prefix = '') => {
  for (const ch of LETTERS) if (!taken.includes(prefix + ch)) return prefix + ch
  return `${prefix}${taken.length + 1}`
}
