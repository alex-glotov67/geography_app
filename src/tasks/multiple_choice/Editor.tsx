import { OptionsEditor, PromptField } from '../editorKit'

/** Редактор «Кілька правильних»: питання, 3–8 варіантів, позначені правильні (SPEC 10.3) */
export function MultipleChoiceEditor() {
  return (
    <>
      <PromptField />
      <OptionsEditor multiple min={3} max={8} />
    </>
  )
}
