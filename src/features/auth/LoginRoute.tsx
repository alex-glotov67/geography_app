import { loginRoute } from '@/router'
import { LoginPage } from './LoginPage'

/** Окремий чанк: форма входу тягне zod і React Hook Form, а головна сторінка — ні */
export function LoginRoute() {
  const { login, redirect } = loginRoute.useSearch()
  return <LoginPage initialLogin={login} redirect={redirect} />
}
