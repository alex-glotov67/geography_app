import type { Block, BlockType } from '@shared/schemas/blocks.ts'
import type { ComponentType } from 'react'
import { CalloutView } from './callout/View'
import { FileView } from './file/View'
import { GalleryView } from './gallery/View'
import { GoalView } from './goal/View'
import { HomeworkView } from './homework/View'
import { ImageView } from './image/View'
import { PracticeView } from './practice/View'
import { TableView } from './table/View'
import { TermsView } from './terms/View'
import { TextView } from './text/View'
import { VideoView } from './video/View'

/** Реєстр блоків уроку (SPEC 10.2): тип → компонент перегляду. */
export const BLOCK_VIEWS: { [T in BlockType]: ComponentType<{ block: Extract<Block, { type: T }> }> } = {
  goal: GoalView,
  text: TextView,
  terms: TermsView,
  image: ImageView,
  gallery: GalleryView,
  video: VideoView,
  callout: CalloutView,
  table: TableView,
  file: FileView,
  practice: PracticeView,
  homework: HomeworkView,
}
