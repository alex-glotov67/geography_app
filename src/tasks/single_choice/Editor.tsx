import { OptionsEditor, PromptField } from '../editorKit'

/** Редактор «Вибір відповіді»: питання, 3–5 варіантів, один правильний (SPEC 10.3) */
export function SingleChoiceEditor() {
  return (
    <>
      <PromptField />
      <OptionsEditor multiple={false} min={3} max={5} />
    </>
  )
}
