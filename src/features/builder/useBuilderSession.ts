import { useCallback, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBlocker } from '@tanstack/react-router'
import { builderLessonQuery, publishLesson, RevisionConflict, saveLesson, unpublishLesson } from '@/api/builder'
import { createAutosave, type SaveOutcome } from './autosave'
import { useBuilder, writeBackup } from './store'

/**
 * Сесія конструктора одного уроку (SPEC 10.1): автозбереження правок зі store, «Перезаписати
 * моїми змінями» / «Завантажити збережену версію» після конфлікту, збереження перед переходом
 * з екрана й попередження браузера, якщо зміни не збережено. Публікація — після збереження.
 */
export function useBuilderSession(lessonId: string) {
  const qc = useQueryClient()

  const save = useCallback(async (): Promise<SaveOutcome> => {
    const s = useBuilder.getState()
    if (!s.draft || s.lessonId !== lessonId) return 'saved'
    const seq = s.editSeq
    const before = s.revision
    useBuilder.setState({ saveState: 'saving' })
    try {
      const revision = await saveLesson(lessonId, s.overwrite ? null : s.revision, s.draft)
      const now = useBuilder.getState()
      const clean = now.editSeq === seq
      useBuilder.setState({
        revision,
        savedSeq: seq,
        savedAt: new Date(),
        overwrite: false,
        saveState: clean ? 'saved' : 'dirty',
        changedSincePublish: now.changedSincePublish || (now.isPublished && revision !== before),
      })
      writeBackup(lessonId, { draft: now.draft!, baseRevision: revision, dirty: !clean, at: new Date().toISOString() })
      void qc.invalidateQueries({ queryKey: ['t', 'lessons'] })
      return 'saved'
    } catch (e) {
      useBuilder.setState({ saveState: e instanceof RevisionConflict ? 'conflict' : 'offline' })
      return e instanceof RevisionConflict ? 'conflict' : 'error'
    }
  }, [lessonId, qc])

  const autosave = useMemo(() => createAutosave({ save }), [save])
  useEffect(() => () => autosave.dispose(), [autosave])

  // Кожна правка в store → автозбереження
  useEffect(
    () =>
      useBuilder.subscribe((s, prev) => {
        if (s.lessonId === lessonId && s.lessonId === prev.lessonId && s.editSeq > prev.editSeq) autosave.changed()
      }),
    [autosave, lessonId],
  )

  // Перехід з екрана — спершу зберегти; не вдалося — спитати
  useBlocker({
    shouldBlockFn: async () => {
      const outcome = await autosave.flush()
      if (outcome === 'clean' || outcome === 'saved') return false
      return !window.confirm('Зміни не збережено (немає зв\'язку або урок змінено в іншій вкладці). Вийти без збереження?')
    },
    enableBeforeUnload: () => {
      const s = useBuilder.getState()
      return s.editSeq !== s.savedSeq || s.saveState === 'saving'
    },
  })

  /** Конфлікт: зберегти мою версію поверх збереженої */
  const overwrite = useCallback(() => {
    useBuilder.setState({ overwrite: true, saveState: 'dirty' })
    autosave.resume()
  }, [autosave])

  /** Конфлікт: відкинути локальні правки й узяти збережену версію */
  const reload = useCallback(async () => {
    autosave.discard()
    const fresh = await qc.fetchQuery({ ...builderLessonQuery(lessonId), staleTime: 0 })
    useBuilder.getState().load(fresh)
  }, [autosave, lessonId, qc])

  /** Відновлення копії з localStorage — як звичайна правка */
  const restore = useCallback(
    async (draft: Parameters<ReturnType<typeof useBuilder.getState>['load']>[1]) => {
      const lesson = await qc.ensureQueryData(builderLessonQuery(lessonId))
      useBuilder.getState().load(lesson, draft)
      autosave.changed()
    },
    [autosave, lessonId, qc],
  )

  const invalidatePublic = useCallback(() => {
    const slug = useBuilder.getState().draft?.slug
    void qc.invalidateQueries({ queryKey: ['t', 'lessons'] })
    void qc.invalidateQueries({ queryKey: ['grade-lessons'] })
    if (slug) qc.removeQueries({ queryKey: ['lesson', slug] })
  }, [qc])

  /** Зберегти й опублікувати переглянуту ревізію; помилку повертає текстом */
  const publish = useCallback(async (): Promise<string | null> => {
    const outcome = await autosave.flush()
    if (outcome === 'conflict') return 'Урок змінено в іншій вкладці — спершу виріши, чию версію зберегти.'
    if (outcome === 'error') return 'Не вдалося зберегти зміни — перевір зв\'язок і спробуй ще раз.'
    try {
      const version = await publishLesson(lessonId, useBuilder.getState().revision)
      useBuilder.setState({ publishedVersion: version, isPublished: true, changedSincePublish: false })
      invalidatePublic()
      return null
    } catch (e) {
      if (e instanceof RevisionConflict) {
        useBuilder.setState({ saveState: 'conflict' })
        return e.message
      }
      return e instanceof Error ? e.message : 'Не вдалося опублікувати'
    }
  }, [autosave, invalidatePublic, lessonId])

  const unpublish = useCallback(async (): Promise<string | null> => {
    try {
      await unpublishLesson(lessonId)
      useBuilder.setState({ isPublished: false, changedSincePublish: false })
      invalidatePublic()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Не вдалося зняти з публікації'
    }
  }, [invalidatePublic, lessonId])

  return { flush: autosave.flush, overwrite, reload, restore, publish, unpublish }
}

export type BuilderSession = ReturnType<typeof useBuilderSession>
