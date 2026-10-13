/** Число з поля введення: «2061», «2 061», «0,5» — кома як десятковий роздільник; інакше null. */
export const parseNumber = (raw: string): number | null => {
  const s = raw.replace(/[\s\u00a0]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}
