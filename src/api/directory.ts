import { getSupabase } from '@/supabase'

/*
 * Ручне редагування довідника програми (SPEC 16, Фаза 3; 10.6). Коди результатів незмінні й не
 * перевикористовуються — це гарантує БД (тригери, add_outcome); тут — запити й зрозумілі помилки.
 */

/** Помилка Postgres → текст для вчителя: дубль — «уже є», запобіжники БД — їхнє повідомлення */
function check(error: { code?: string; message: string } | null, duplicate: string) {
  if (!error) return
  if (error.code === '23505') throw new Error(duplicate)
  throw new Error(error.message)
}

export async function createSection(grade: number, number: number, title: string) {
  const db = await getSupabase()
  const { error } = await db.from('sections').insert({ grade, number, title })
  check(error, `Розділ ${number} для ${grade} класу вже є`)
}

/** Номер змінюється лише в розділі без результатів (інакше БД відмовить — він у кодах) */
export async function updateSection(id: string, fields: { title: string; number?: number }) {
  const db = await getSupabase()
  const { error } = await db.from('sections').update(fields).eq('id', id)
  check(error, `Розділ з номером ${fields.number} уже є`)
}

export async function deleteSection(id: string) {
  const db = await getSupabase()
  const { error } = await db.from('sections').delete().eq('id', id)
  check(error, '')
}

export async function createTopic(sectionId: string, number: number, title: string) {
  const db = await getSupabase()
  const { error } = await db.from('topics').insert({ section_id: sectionId, number, title })
  check(error, `Тема ${number} у цьому розділі вже є`)
}

export async function updateTopic(id: string, fields: { title: string; number?: number }) {
  const db = await getSupabase()
  const { error } = await db.from('topics').update(fields).eq('id', id)
  check(error, `Тема з номером ${fields.number} уже є`)
}

export async function deleteTopic(id: string) {
  const db = await getSupabase()
  const { error } = await db.from('topics').delete().eq('id', id)
  check(error, '')
}

/** Новий результат — наступний номер у темі (з урахуванням архівних); повертає код */
export async function addOutcome(topicId: string, text: string, source: string): Promise<string> {
  const db = await getSupabase()
  const { data, error } = await db.rpc('add_outcome', { p_topic_id: topicId, p_text: text, p_source: source })
  check(error, 'Такий результат у темі вже є')
  return data![0]!.code
}

/** Текст і джерело; код не змінюється */
export async function updateOutcome(id: string, text: string, source: string) {
  const db = await getSupabase()
  const { error } = await db.from('program_outcomes').update({ text, source }).eq('id', id)
  check(error, 'Такий результат у темі вже є')
}

export async function setOutcomeArchived(id: string, archived: boolean) {
  const db = await getSupabase()
  const { error } = await db.from('program_outcomes').update({ archived }).eq('id', id)
  check(error, '')
}

export async function reorderOutcomes(topicId: string, ids: string[]) {
  const db = await getSupabase()
  const { error } = await db.rpc('reorder_outcomes', { p_topic_id: topicId, p_ids: ids })
  check(error, '')
}
