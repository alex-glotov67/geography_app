import { useRouter } from '@tanstack/react-router'
import { PlaceholderPage } from './PlaceholderPage'
import classes from './PlaceholderPage.module.css'

/** Помилка завантаження (немає мережі тощо): пояснення і повтор — без технічних деталей. */
export function ErrorPage() {
  const router = useRouter()
  return (
    <PlaceholderPage title="Не вдалося завантажити">
      Перевір інтернет і{' '}
      <button type="button" className={classes.retry} onClick={() => void router.invalidate()}>
        спробуй ще раз
      </button>
      .
    </PlaceholderPage>
  )
}
