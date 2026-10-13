import { ChipGroup } from '../ChipGroup'
import { itemResult, type TaskViewProps } from '../types'

/** Відповідність: для кожного елемента зліва — рядок варіантів справа (телефон і клавіатура). */
export function Matching({ uid, content, value, onChange, disabled, details }: TaskViewProps<'matching'>) {
  return (
    <div>
      {content.left.map((l) => (
        <ChipGroup
          key={l.id}
          name={`${uid}-${l.id}`}
          legend={l.text}
          choices={content.right}
          selected={value.pairs[l.id]}
          onSelect={(r) => onChange({ pairs: { ...value.pairs, [l.id]: r } })}
          disabled={disabled}
          result={itemResult(details, l.id)}
        />
      ))}
    </div>
  )
}
