import type { ReactNode } from 'react'
import type { RichDoc, RichNode } from '@shared/schemas/richtext.ts'
import classes from './blocks.module.css'

/** Рендер обмеженого JSON Tiptap (SPEC 10.2) без dangerouslySetInnerHTML: лише дозволені вузли. */
function inline(node: RichNode, key: number): ReactNode {
  if (node.type === 'hardBreak') return <br key={key} />
  let out: ReactNode = node.text ?? ''
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>
    else if (mark.type === 'italic') out = <em>{out}</em>
    else if (mark.type === 'link') {
      out = (
        <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">
          {out}
        </a>
      )
    }
  }
  return <span key={key}>{out}</span>
}

const kids = (n: RichNode) => (n.content ?? []).map(block)

function block(node: RichNode, key: number): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{(node.content ?? []).map(inline)}</p>
    case 'heading':
      return <h3 key={key}>{(node.content ?? []).map(inline)}</h3>
    case 'bulletList':
      return <ul key={key}>{kids(node)}</ul>
    case 'orderedList':
      return <ol key={key}>{kids(node)}</ol>
    case 'listItem':
      return <li key={key}>{kids(node)}</li>
    case 'table':
      return (
        <div key={key} className={classes.tableScroll}>
          <table className={classes.table}>
            <tbody>
              {(node.content ?? []).map((row, r) => (
                <tr key={r}>
                  {(row.content ?? []).map((cell, c) =>
                    cell.type === 'tableHeader' ? <th key={c}>{kids(cell)}</th> : <td key={c}>{kids(cell)}</td>,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

export function RichText({ doc, className }: { doc: RichDoc; className?: string }) {
  return <div className={`${classes.rich} ${className ?? ''}`}>{(doc.content as RichNode[]).map(block)}</div>
}
