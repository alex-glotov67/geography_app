import { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useMe } from '@/api/auth'
import { useViewSettings } from '@/stores/viewSettings'

/**
 * Корінь застосунку. Для учня — «Спрощений режим» за замовчуванням від вчителя (SPEC 8.1):
 * застосовується, коли вчитель змінив позначку; між змінами учень може перемикати сам.
 */
export function Root() {
  const me = useMe()
  useEffect(() => {
    if (me?.kind !== 'student') return
    const key = `${me.id}:${me.simplifiedMode}`
    if (useViewSettings.getState().studentDefault !== key) {
      useViewSettings.setState({ simplified: me.simplifiedMode, studentDefault: key })
    }
  }, [me])
  return <Outlet />
}
