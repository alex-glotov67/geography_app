import { OptionList } from '../OptionList'
import type { TaskViewProps } from '../types'

export function SingleChoice({ uid, content, value, onChange, disabled, details }: TaskViewProps<'single_choice'>) {
  const correct = details ? (details.correct as boolean) : undefined
  return (
    <OptionList
      uid={uid}
      legend={content.prompt}
      options={content.options}
      shuffle={content.shuffle}
      multiple={false}
      selected={value.selected ? [value.selected] : []}
      onToggle={(id) => onChange({ selected: id })}
      disabled={disabled}
      resultOf={(id) => (correct === undefined || id !== value.selected ? undefined : correct ? 'ok' : 'err')}
    />
  )
}
