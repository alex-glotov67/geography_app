import { createContext, useContext } from 'react'
import type { PracticeTask } from '@/tasks/TaskCard'

export interface MediaInfo {
  id: string
  url: string
  kind: 'image' | 'pdf'
  alt: string | null
  caption: string | null
  source: string | null
  license: string | null
  width: number | null
  height: number | null
}

export interface VideoInfo {
  id: string
  youtubeId: string
  title: string
  channel: string | null
  durationSec: number | null
  startSec: number | null
  endSec: number | null
}

/** Дані опублікованого уроку, потрібні блокам (SPEC 6.1: усе — зі знімка публікації). */
export interface LessonContextValue {
  slug: string
  grade: number
  media: Record<string, MediaInfo>
  videos: Record<string, VideoInfo>
  practiceTasks: Record<string, PracticeTask>
  homeworkCount: number
  simplified: boolean
}

export const LessonContext = createContext<LessonContextValue | null>(null)

export function useLesson() {
  const ctx = useContext(LessonContext)
  if (!ctx) throw new Error('Блок уроку поза LessonContext')
  return ctx
}
