import type { RichDoc, RichNode } from '@shared/schemas/richtext.ts'

/*
 * JSON редактора (Tiptap) → RichDoc (SPEC 10.2, 10.7): лише дозволені вузли й позначки, без зайвих
 * атрибутів (target, colspan, start…), без довільного HTML. Невідомий блок (вставка з Word, сайту)
 * стає абзацом з його текстом; невідома позначка відкидається; посилання — лише http/https.
 * Результат проходить zod-схему RichDoc.
 */

interface Loose {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type?: string; attrs?: Record<string, unknown> }[]
  content?: Loose[]
}

type Mark = NonNullable<Extract<RichNode, { marks?: unknown }>['marks']>[number]

const HTTP = /^https?:\/\//i

function marks(list: Loose['marks']): Mark[] | undefined {
  const out: Mark[] = []
  for (const m of list ?? []) {
    if (m.type === 'bold' || m.type === 'italic') out.push({ type: m.type })
    else if (m.type === 'link' && typeof m.attrs?.href === 'string' && HTTP.test(m.attrs.href)) out.push({ type: 'link', attrs: { href: m.attrs.href } })
  }
  return out.length ? out : undefined
}

/** Рядковий вміст: текст (з позначками) і переноси; усе інше — його текст без розмітки */
function inline(nodes: Loose[] | undefined): RichNode[] {
  const out: RichNode[] = []
  for (const n of nodes ?? []) {
    if (n.type === 'hardBreak') out.push({ type: 'hardBreak' })
    else if (n.type === 'text') {
      if (n.text) {
        const m = marks(n.marks)
        out.push(m ? { type: 'text', text: n.text, marks: m } : { type: 'text', text: n.text })
      }
    } else out.push(...inline(n.content))
  }
  return out
}

const paragraph = (content: RichNode[]): RichNode => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })

/** Увесь текст вузла — для невідомих блоків */
const flatten = (n: Loose): RichNode[] => (n.content ?? []).flatMap((c) => (c.type === 'text' || c.type === 'hardBreak' ? inline([c]) : flatten(c)))

function listItem(n: Loose): RichNode | null {
  const content = (n.content ?? []).flatMap((c): RichNode[] => {
    if (c.type === 'bulletList' || c.type === 'orderedList') {
      const l = list(c)
      return l ? [l] : []
    }
    return [paragraph(c.type === 'paragraph' ? inline(c.content) : flatten(c))]
  })
  return content.length ? { type: 'listItem', content } : null
}

function list(n: Loose): RichNode | null {
  const items = (n.content ?? []).map(listItem).filter((x): x is RichNode => !!x)
  return items.length ? { type: n.type as 'bulletList' | 'orderedList', content: items } : null
}

function table(n: Loose): RichNode | null {
  const rows = (n.content ?? [])
    .filter((r) => r.type === 'tableRow')
    .map((r) => {
      const cells = (r.content ?? []).map((c) => {
        const paragraphs = (c.content ?? []).map((p) => paragraph(p.type === 'paragraph' ? inline(p.content) : flatten(p)))
        return { type: c.type === 'tableHeader' ? 'tableHeader' : 'tableCell', content: paragraphs.length ? paragraphs : [paragraph([])] }
      })
      return cells.length ? ({ type: 'tableRow', content: cells } as RichNode) : null
    })
    .filter((r): r is RichNode => !!r)
  return rows.length ? { type: 'table', content: rows } : null
}

function block(n: Loose): RichNode[] {
  switch (n.type) {
    case 'paragraph':
      return [paragraph(inline(n.content))]
    case 'heading': {
      const content = inline(n.content)
      return [content.length ? { type: 'heading', attrs: { level: 3 }, content } : paragraph([])]
    }
    case 'bulletList':
    case 'orderedList': {
      const l = list(n)
      return l ? [l] : []
    }
    case 'table': {
      const tb = table(n)
      return tb ? [tb] : []
    }
    default: {
      // Невідомий блок (цитата, код, лінія…): блоки всередині — як є, текст — абзацом
      const nested = (n.content ?? []).filter((c) => c.type !== 'text' && c.type !== 'hardBreak')
      if (nested.length && nested.length === (n.content ?? []).length) return nested.flatMap(block)
      const content = flatten(n)
      return content.length ? [paragraph(content)] : []
    }
  }
}

export function sanitizeRichDoc(json: unknown): RichDoc {
  const doc = (json ?? {}) as Loose
  const content = (doc.content ?? []).flatMap(block)
  return { type: 'doc', content: (content.length ? content : [paragraph([])]) as RichDoc['content'] }
}

/** Порожній текст: лише порожні абзаци */
export const isEmptyRichDoc = (doc: RichDoc | undefined) =>
  !doc || doc.content.every((n) => n.type === 'paragraph' && !(n as RichNode).content?.length)
