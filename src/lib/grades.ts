/** Класи ресурсу (SPEC 1). Колір — токен «висоти» класу `--grade-N`. */
export const GRADES = [6, 7, 8, 9] as const
export type Grade = (typeof GRADES)[number]

export const isGrade = (n: number): n is Grade => (GRADES as readonly number[]).includes(n)
