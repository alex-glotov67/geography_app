import { useEffect, useRef } from 'react'
import '@mantine/core/styles/UnstyledButton.css'
import '@mantine/core/styles/Popover.css'
import '@mantine/core/styles/Input.css'
import '@mantine/core/styles/Button.css'
import '@mantine/core/styles/Tooltip.css'
import '@mantine/tiptap/styles.css'
import { RichTextEditor, type RichTextEditorLabels } from '@mantine/tiptap'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { RichDoc } from '@shared/schemas/richtext.ts'
import { sanitizeRichDoc } from '@/lib/richtext'
import classes from './RichTextField.module.css'

/*
 * Форматований текст блоків (SPEC 3.2, 10.2): Tiptap через @mantine/tiptap. Лише те, що дозволяє
 * схема RichDoc: заголовок рівня 3, жирний, курсив, списки, посилання (http/https), таблиця.
 * Решта вузлів StarterKit вимкнена; вставлене з Word чи сайту зводить sanitizeRichDoc.
 * Стилі Mantine потрібних компонентів — лише тут (чанк кабінету вчителя), не в учнівському бандлі.
 */

const LABELS: Partial<RichTextEditorLabels> = {
  boldControlLabel: 'Жирний',
  italicControlLabel: 'Курсив',
  h3ControlLabel: 'Підзаголовок',
  bulletListControlLabel: 'Список',
  orderedListControlLabel: 'Нумерований список',
  linkControlLabel: 'Посилання',
  unlinkControlLabel: 'Прибрати посилання',
  undoControlLabel: 'Скасувати',
  redoControlLabel: 'Повторити',
  linkEditorInputLabel: 'Адреса посилання',
  linkEditorInputPlaceholder: 'https://…',
  linkEditorExternalLink: 'Відкривати в новій вкладці',
  linkEditorInternalLink: 'Відкривати в цій вкладці',
  linkEditorSave: 'Зберегти',
  tableInsertControlLabel: 'Таблиця',
  tableInsertLabel: (columns: number, rows: number) => `Таблиця ${columns} × ${rows}`,
  tableRowAfterControlLabel: 'Рядок нижче',
  tableRowDeleteControlLabel: 'Прибрати рядок',
  tableColumnAfterControlLabel: 'Стовпець праворуч',
  tableColumnDeleteControlLabel: 'Прибрати стовпець',
  tableToggleHeaderRowControlLabel: 'Рядок заголовків',
  tableDeleteControlLabel: 'Прибрати таблицю',
}

const HTTP = /^https?:\/\//i

const extensions = [
  StarterKit.configure({
    heading: { levels: [3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https'],
      isAllowedUri: (url) => HTTP.test(url),
    },
  }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
]

interface Props {
  /** Підпис поля (видимий і для читачів екрана) */
  label: string
  value: RichDoc | undefined
  onChange: (doc: RichDoc) => void
}

export function RichTextField({ label, value, onChange }: Props) {
  /** Останнє, що редактор віддав назовні: зовнішня зміна (відновлення, інша вкладка) — лише коли інше */
  const emitted = useRef<string>(JSON.stringify(value ?? null))
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions,
    content: value ?? '',
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox' } },
    onUpdate: ({ editor: e }) => {
      const doc = sanitizeRichDoc(e.getJSON())
      emitted.current = JSON.stringify(doc)
      onChangeRef.current(doc)
    },
  })

  useEffect(() => {
    const next = JSON.stringify(value ?? null)
    if (!editor || next === emitted.current) return
    emitted.current = next
    editor.commands.setContent(value ?? '', { emitUpdate: false })
  }, [editor, value])

  return (
    <div className={classes.field}>
      <span className={classes.label} aria-hidden="true">
        {label}
      </span>
      <RichTextEditor editor={editor} labels={LABELS} classNames={{ root: classes.root, toolbar: classes.toolbar, control: classes.control, content: classes.content }}>
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H3 />
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.TableInsert />
            {editor?.isActive('table') && (
              <>
                <RichTextEditor.TableRowAfter />
                <RichTextEditor.TableRowDelete />
                <RichTextEditor.TableColumnAfter />
                <RichTextEditor.TableColumnDelete />
                <RichTextEditor.TableToggleHeaderRow />
                <RichTextEditor.TableDelete />
              </>
            )}
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content />
      </RichTextEditor>
    </div>
  )
}
