/** Tarjetas de mercados con cuota y botón para añadir al boleto. */
import { FormatoCuota, formatoCuota } from '../../lib/cuotas'
import { usePrefs } from '../../lib/preferencias'
import { Termino } from '../../components/ui'
import type { Mercado, Seleccion } from './tipos'

export function TarjetaMercado({ m, formato, seleccion, alternar }: { m: Mercado; formato: FormatoCuota; seleccion: Seleccion[]; alternar: (m: Mercado, opcionId: string) => void }) {
  const { principiante } = usePrefs()
  return (
    <article className={`rounded-2xl border bg-nfl-navy p-4 shadow-lg sm:p-5 ${m.mejorado ? 'border-nfl-red ring-2 ring-nfl-red' : 'border-white/20'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-white"><Termino id={m.termino} oscuro>{m.titulo}</Termino></h3>
        {m.mejorado && <span className="rounded bg-nfl-red px-2 py-0.5 font-mono text-[10px] font-bold text-white">★ MOMIO MEJORADO</span>}
      </div>
      {principiante && <p className="mt-2 rounded-lg border border-white/10 bg-nfl-dark/60 px-3 py-2 text-sm text-blue-100"><span aria-hidden>💡 </span>{m.ayuda}</p>}
      <div className={`mt-3 grid gap-2.5 ${m.opciones.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {m.opciones.map(o => {
          const activa = seleccion.some(s => s.id === o.id)
          return (
            <button key={o.id} onClick={() => alternar(m, o.id)} aria-pressed={activa}
              aria-label={`${o.etiqueta}, cuota ${formatoCuota(o.cuota, formato)}${o.tendencia ? `, ${o.tendencia}` : ''}. ${activa ? 'Quitar del boleto' : 'Añadir al boleto'}`}
              className={`flex min-h-[64px] items-center justify-between gap-3 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-400 ${activa ? 'border-nfl-red bg-white text-nfl-dark ring-2 ring-nfl-red' : 'border-white/20 bg-[#012852] text-white hover:bg-[#023C7A]'}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{o.etiqueta}</span>
                <span className={`block truncate text-xs ${activa ? 'text-slate-600' : 'text-blue-200'}`}>{activa ? '✓ En tu boleto' : o.sub}</span>
              </span>
              <span key={`${o.cuota}`} className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold ${o.tendencia === 'sube' ? 'animate-sube' : o.tendencia === 'baja' ? 'animate-baja' : ''} ${activa ? 'bg-nfl-red text-white' : 'border border-white/20 bg-nfl-dark'}`}>
                {o.tendencia === 'sube' && <span aria-hidden className="text-emerald-400">▲</span>}
                {o.tendencia === 'baja' && <span aria-hidden className="text-red-300">▼</span>}
                {formatoCuota(o.cuota, formato)}
              </span>
            </button>
          )
        })}
      </div>
    </article>
  )
}
