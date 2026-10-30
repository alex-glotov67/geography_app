import { RichDoc } from '@shared/schemas/richtext.ts'
import { isEmptyRichDoc, sanitizeRichDoc } from './richtext'

/** JSON, яким його віддає Tiptap: зайві атрибути, порожні абзаци, позначки */
const tiptap = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2, textAlign: null }, content: [{ type: 'text', text: 'Рельєф' }] },
    {
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [
        { type: 'text', text: 'Більшу частину займають ' },
        { type: 'text', text: 'рівнини', marks: [{ type: 'bold' }, { type: 'underline' }] },
        { type: 'hardBreak' },
        { type: 'text', text: 'карта', marks: [{ type: 'link', attrs: { href: 'https://uk.wikipedia.org', target: '_blank', rel: 'noopener', class: null } }] },
        { type: 'text', text: ' небезпечне', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      ],
    },
    { type: 'orderedList', attrs: { start: 1, type: null }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Низовини' }] }] }] },
    { type: 'bulletList', content: [] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Форма' }] }] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1 }, content: [] }] },
      ],
    },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Цитата' }] }] },
    { type: 'codeBlock', content: [{ type: 'text', text: 'код' }] },
    { type: 'heading', attrs: { level: 3 }, content: [] },
  ],
}

describe('Tiptap → RichDoc (SPEC 10.7: без довільного HTML)', () => {
  it('лише дозволені вузли, позначки й атрибути; результат проходить схему', () => {
    const doc = sanitizeRichDoc(tiptap)
    expect(RichDoc.safeParse(doc).success).toBe(true)
    expect(doc.content.map((n) => n.type)).toEqual(['heading', 'paragraph', 'orderedList', 'table', 'paragraph', 'paragraph', 'paragraph'])
    expect(doc.content[0]).toEqual({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Рельєф' }] })
    const p = doc.content[1] as { content: { marks?: unknown[] }[] }
    expect(p.content[1]).toEqual({ type: 'text', text: 'рівнини', marks: [{ type: 'bold' }] })
    expect(p.content[3]).toEqual({ type: 'text', text: 'карта', marks: [{ type: 'link', attrs: { href: 'https://uk.wikipedia.org' } }] })
    expect(p.content[4]).toEqual({ type: 'text', text: ' небезпечне' })
    expect(doc.content[2]).toEqual({ type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Низовини' }] }] }] })
    expect(JSON.stringify(doc.content[3])).not.toMatch(/colspan|colwidth/)
    expect(doc.content[4]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'Цитата' }] })
    expect(doc.content[5]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: 'код' }] })
  })

  it('порожній редактор — один порожній абзац; isEmptyRichDoc', () => {
    expect(sanitizeRichDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(sanitizeRichDoc(null)).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(isEmptyRichDoc(sanitizeRichDoc(null))).toBe(true)
    expect(isEmptyRichDoc(sanitizeRichDoc(tiptap))).toBe(false)
  })
})
