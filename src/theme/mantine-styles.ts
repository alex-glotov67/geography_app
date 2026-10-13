/*
 * Стилі Mantine по компонентах (SPEC 13.6, Фаза 1) замість повного @mantine/core/styles.css (~370 КБ).
 * Порядок важливий: спершу базові, далі — лише компоненти, які справді використовуються.
 * Новий компонент Mantine у коді → додай сюди його CSS (і залежні: Button ← UnstyledButton тощо).
 */
import '@mantine/core/styles/baseline.css'
import '@mantine/core/styles/default-css-variables.css'
import '@mantine/core/styles/global.css'

import '@mantine/core/styles/Skeleton.css'
