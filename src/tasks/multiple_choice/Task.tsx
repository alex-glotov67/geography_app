import { OptionList } from '../OptionList'
import { itemResult, type TaskViewProps } from '../types'

export function MultipleChoice({ uid, content, value, onChange, disabled, details }: TaskViewProps<'multiple_choice'>) {
  return (
    <OptionList
      uid={uid}
      legend={`${content.prompt} (кілька правильних)`}
      options={content.options}
      shuffle={content.shuffle}
      multiple
      selected={value.selected}
      onToggle={(id) =>
        onChange({ selected: value.selected.includes(id) ? value.selected.filter((x) => x !== id) : [...value.selected, id] })
      }
      disabled={disabled}
      // Підсвічуємо лише вибрані: правильно вибраний — ok, зайвий — err
      resultOf={(id) => (value.selected.includes(id) ? itemResult(details, id) : undefined)}
    />
  )
}
