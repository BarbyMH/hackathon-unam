/** Conversión y formato de cuotas (momios). La cuota base siempre llega en formato americano. */
export type FormatoCuota = 'americana' | 'decimal' | 'fraccional'

export const aDecimal = (a: number) => (a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1)

const mcd = (a: number, b: number): number => (b === 0 ? a : mcd(b, a % b))

export function formatoCuota(a: number, f: FormatoCuota): string {
  if (f === 'americana') return a > 0 ? `+${a}` : `${a}`
  if (f === 'decimal') return aDecimal(a).toFixed(2)
  const num = a > 0 ? a : 100
  const den = a > 0 ? 100 : Math.abs(a)
  const d = mcd(num, den)
  return `${num / d}/${den / d}`
}

export const AYUDA_FORMATO: Record<FormatoCuota, string> = {
  americana: 'Americana: +145 significa que con $100 ganas $145 extra. -175 significa que necesitas $175 para ganar $100 extra.',
  decimal: 'Decimal: multiplica tu apuesta por este número para saber cuánto recibes en total (incluye lo que apostaste).',
  fraccional: 'Fraccional: 29/20 significa que por cada $20 apostados ganas $29 extra.',
}

export const pesos = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
