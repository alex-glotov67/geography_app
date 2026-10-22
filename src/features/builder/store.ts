import { create } from 'zustand'
import type { BuilderLesson } from '@/api/builder'
import type { LessonDraftState } from './draft'

/*
 * Відкритий у конструкторі урок (SPEC 10.1): чернетка живе тут, а не в стані компонентів, тож
 * перемонтування її не губить. Копія — у localStorage (`geo-draft:<id>`): після закритої вкладки
 * конструктор пропонує відновити незбережене, а вкладка перегляду читає звідти чернетку.
 */

export type SaveState = 'saved' | 'dirty' | 'saving' | 'offline' | 'conflict'

export interface DraftBackup {
  draft: LessonDraftState
  /** Ревізія, від якої почато правки */
  baseRevision: number
  /** Є правки, яких сервер ще не має */
  dirty: boolean
  at: string
}

export const backupKey = (lessonId: string) => `geo-draft:${lessonId}`

export function readBackup(lessonId: string): DraftBackup | null {
  try {
    const raw = localStorage.getItem(backupKey(lessonId))
    return raw ? (JSON.parse(raw) as DraftBackup) : null
  } catch {
    return null
  }
}

export function writeBackup(lessonId: string, b: DraftBackup) {
  try {
    localStorage.setItem(backupKey(lessonId), JSON.stringify(b))
  } catch {
    /* сховище недоступне чи переповнене — автозбереження на сервер працює й без копії */
  }
}

interface BuilderState {
  lessonId: string | null
  draft: LessonDraftState | null
  revision: number
  /** Зміни, внесені після останнього успішного збереження (лічильник правок) */
  editSeq: number
  savedSeq: number
  saveState: SaveState
  savedAt: Date | null
  /** «Перезаписати моїми змінями» — наступне збереження без перевірки ревізії */
  overwrite: boolean
  publishedVersion: number | null
  isPublished: boolean
  changedSincePublish: boolean
  /** Блок, виділений у структурі чи панелі перевірки */
  selectedBlockId: string | null
  /** Незбережена копія з минулої вкладки — запропонувати «Відновити» */
  pendingRestore: DraftBackup | null

  /** Відкрити урок у конструкторі: чернетка з сервера + пошук незбереженої копії */
  open(lesson: BuilderLesson): void
  dismissRestore(): void
  load(lesson: BuilderLesson, draft?: LessonDraftState): void
  edit(fn: (d: LessonDraftState) => LessonDraftState): void
  select(blockId: string | null): void
}

export const useBuilder = create<BuilderState>()((set, get) => ({
  lessonId: null,
  draft: null,
  revision: 0,
  editSeq: 0,
  savedSeq: 0,
  saveState: 'saved',
  savedAt: null,
  overwrite: false,
  publishedVersion: null,
  isPublished: false,
  changedSincePublish: false,
  selectedBlockId: null,
  pendingRestore: null,

  open(lesson) {
    const backup = readBackup(lesson.id)
    get().load(lesson)
    if (backup?.dirty && JSON.stringify(backup.draft) !== JSON.stringify(lesson.draft)) {
      set({ pendingRestore: backup })
      writeBackup(lesson.id, backup) // до рішення вчителя копія лишається (і після ще одного перезавантаження)
    }
  },

  dismissRestore() {
    set({ pendingRestore: null })
  },

  load(lesson, draft) {
    const restored = !!draft
    set({
      lessonId: lesson.id,
      draft: draft ?? lesson.draft,
      revision: lesson.revision,
      editSeq: restored ? 1 : 0,
      savedSeq: 0,
      saveState: restored ? 'dirty' : 'saved',
      savedAt: null,
      overwrite: false,
      publishedVersion: lesson.publishedVersion,
      isPublished: lesson.isPublished,
      changedSincePublish: lesson.changedSincePublish,
      selectedBlockId: null,
      pendingRestore: null,
    })
    writeBackup(lesson.id, { draft: draft ?? lesson.draft, baseRevision: lesson.revision, dirty: restored, at: new Date().toISOString() })
  },

  edit(fn) {
    const { draft, lessonId, revision, editSeq, saveState } = get()
    if (!draft || !lessonId) return
    const next = fn(draft)
    if (next === draft) return
    set({ draft: next, editSeq: editSeq + 1, saveState: saveState === 'conflict' || saveState === 'offline' ? saveState : 'dirty' })
    writeBackup(lessonId, { draft: next, baseRevision: revision, dirty: true, at: new Date().toISOString() })
  },

  select(blockId) {
    set({ selectedBlockId: blockId })
  },
}))
