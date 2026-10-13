import { ChipGroup } from '../ChipGroup'
import { itemResult, type TaskViewProps } from '../types'

const YES_NO = [
  { id: 'yes', text: 'Так' },
  { id: 'no', text: 'Ні' },
]

export function TrueFalse({ uid, content, value, onChange, disabled, details }: TaskViewProps<'true_false'>) {
  return (
    <div>
      {content.statements.map((s) => {
        const v = value.answers[s.id]
        return (
          <ChipGroup
            key={s.id}
            name={`${uid}-${s.id}`}
            legend={s.text}
            choices={YES_NO}
            selected={v === undefined ? null : v ? 'yes' : 'no'}
            onSelect={(id) => onChange({ answers: { ...value.answers, [s.id]: id === 'yes' } })}
            disabled={disabled}
            wide
            result={itemResult(details, s.id)}
          />
        )
      })}
    </div>
  )
}
