import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { writePackage } from '../../src/lib/packages/read.ts'

/** Тека-джерело пакета (seed/demo-lesson) → байти .geo.zip */
export async function packFolder(dir: string, { demo = false, author = 'geography-6-9' } = {}) {
  const read = (name: string) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
  const mediaDir = join(dir, 'media')
  const files: Record<string, Uint8Array> = {}
  try {
    for (const name of readdirSync(mediaDir)) {
      if (statSync(join(mediaDir, name)).isFile()) files[`media/${name}`] = new Uint8Array(readFileSync(join(mediaDir, name)))
    }
  } catch {
    /* без медіа */
  }
  return writePackage({
    lesson: read('lesson.json'), tasks: read('tasks.json'), media: read('media.json'), videos: read('videos.json'),
    files, demo, author, createdAt: '2026-10-13T00:00:00.000Z',
  })
}
