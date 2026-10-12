import {
  ActionIcon,
  Button,
  Card,
  Input,
  Paper,
  createTheme,
  type CSSVariablesResolver,
  type MantineSize,
} from '@mantine/core'
import { palette } from './palette'

/**
 * Висоти елементів керування: усі ≥ 44 px (ціль дотику), основні дії — 52–54 px (SPEC 13.3).
 * Розміри Mantine xs–md зводимо до 44 px, lg — 52 px, xl — 54 px.
 */
const controlHeight = (size: MantineSize | string | undefined) => {
  if (size === 'xl') return '54px'
  if (size === 'lg') return '52px'
  return 'var(--tap)'
}

export const theme = createTheme({
  // Палітри з токенів 13.1; базовий колір на відтінку 6 (= primaryShade)
  colors: {
    water: palette('#1D5E8C', { 0: '#EEF4F9', 7: '#123F60' }),
    grade6: palette('#3F7A4A'),
    grade7: palette('#66742A'),
    grade8: palette('#8F6A1F'),
    grade9: palette('#6E4A2E'),
    levelBase: palette('#4E8A57'),
    levelMiddle: palette('#9AA33A'),
    levelSufficient: palette('#C99A3A'),
    levelHigh: palette('#8A5A34'),
    ok: palette('#2E5E37', { 0: '#E3EEE4' }),
    err: palette('#8E1B12', { 0: '#FBE4E1' }),
    warn: palette('#5C3A06', { 0: '#FCEBD3' }),
  },
  primaryColor: 'water',
  primaryShade: 6,
  black: '#1E2A2F',
  white: '#FFFFFF',

  fontFamily: 'var(--font-text)',
  fontFamilyMonospace: 'var(--font-mono)',
  headings: {
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
  },

  defaultRadius: 'md',
  radius: {
    xs: '8px',
    sm: '10px',
    md: '12px', // поля й кнопки
    lg: '16px', // картки
    xl: '18px', // плитки
  },

  focusRing: 'auto',
  cursorType: 'pointer',
  respectReducedMotion: true,

  components: {
    Button: Button.extend({
      vars: (_theme, props) => ({ root: { '--button-height': controlHeight(props.size) } }),
    }),
    Input: Input.extend({
      vars: (_theme, props) => ({ wrapper: { '--input-height': controlHeight(props.size) } }),
    }),
    ActionIcon: ActionIcon.extend({
      vars: () => ({ root: { '--ai-size': 'var(--tap)' } }),
    }),
    // Без декоративних тіней: картки — межа `--line` на білому
    Card: Card.extend({
      defaultProps: { shadow: undefined, withBorder: true, radius: 'lg', padding: 'lg' },
    }),
    Paper: Paper.extend({
      defaultProps: { shadow: undefined },
    }),
  },
})

/** Тло й текст сторінки з токенів замість стандартних кольорів Mantine. */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': 'var(--paper)',
    '--mantine-color-text': 'var(--ink)',
    '--mantine-color-dimmed': 'var(--muted)',
    '--mantine-color-default-border': 'var(--line-strong)',
    '--mantine-color-anchor': 'var(--water)',
  },
  dark: {},
})
