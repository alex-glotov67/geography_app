import '@testing-library/jest-dom/vitest'

// jsdom не має matchMedia і ResizeObserver, а Mantine їх використовує
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub

// Відновлення прокрутки роутера викликає scrollTo, якого jsdom не реалізує
window.scrollTo = () => {}

// Відповіді учня зберігаються в sessionStorage (stores/answers) — кожен тест з чистого аркуша
import { useAnswers } from '@/stores/answers'
beforeEach(() => {
  sessionStorage.clear()
  useAnswers.setState({ answers: {} })
})
