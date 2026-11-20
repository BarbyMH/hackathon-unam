/** Boleto de apuestas con pestañas Estándar / Apuesta rápida / Apuestas abiertas. */
import { useState } from 'react'
import { aDecimal, FormatoCuota, formatoCuota, pesos } from '../../lib/cuotas'
import { Termino, Vacio } from '../../components/ui'
import type { Apuesta, Mercado, Seleccion } from './tipos'

type Props = {
  seleccion: Seleccion[]; quitar: (id: string) => void; limpiar: () => void
  monto: number; setMonto: (n: number) => void; formato: FormatoCuota
  confirmar: () => void; enviando: boolean; abiertas: Apuesta[]
  rapida: (m: Mercado, opcionId: string, monto: number) => void; mercados: Mercado[]; bloqueado: string | null
}

export function Boleto(p: Props) {
  const [pestana, setPestana] = useState<'estandar' | 'rapida' | 'abiertas'>('estandar')
  const [montoRapido, setMontoRapido] = useState(100)
  const cuota = p.seleccion.reduce((a, s) => a * aDecimal(s.cuota), 1)
  const pago = p.seleccion.length ? p.monto * cuota : 0
  const ml = p.mercados.find(m => m.id === 'ml')
  const tab = (id: typeof pestana, t: string) => (
    <button role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
      className={`min-h-[48px] border-b-4 px-2 text-xs font-bold ${pestana === id ? 'border-nfl-red bg-white text-nfl-navy' : 'border-transparent text-slate-600 hover:text-nfl-navy'}`}>{t}</button>
  )
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-nfl-navy bg-white text-nfl-dark shadow-2xl">
      <div role="tablist" aria-label="Boleto de apuestas" className="grid grid-cols-3 border-b border-nfl-border bg-nfl-light">
        {tab('estandar', `Estándar (${p.seleccion.length})`)}{tab('rapida', 'Apuesta rápida')}{tab('abiertas', `Abiertas (${p.abiertas.length})`)}
      </div>
      <div className="p-4" role="tabpanel">
        {p.bloqueado && <p role="alert" className="mb-3 rounded-lg border border-nfl-red bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ {p.bloqueado}</p>}

        {pestana === 'estandar' && (p.seleccion.length === 0 ? (
          <Vacio titulo="Tu boleto está vacío" texto="Toca cualquier cuota de un mercado para añadirla aquí." />
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-sm">
              <strong className="text-nfl-navy">{p.seleccion.length > 1 ? <Termino id="parlay">Combinada ({p.seleccion.length})</Termino> : 'Apuesta sencilla'}</strong>
              <button onClick={p.limpiar} className="min-h-[40px] px-2 font-semibold text-nfl-red hover:underline">Limpiar</button>
            </div>
            <ul className="mb-3 max-h-60 space-y-2 overflow-y-auto">
              {p.seleccion.map(s => (
                <li key={s.id} className="flex items-start justify-between gap-2 rounded-xl border border-nfl-border bg-nfl-light p-2.5">
                  <span><span className="block text-[11px] text-slate-600">{s.mercado}</span><span className="text-sm font-bold">{s.etiqueta}</span></span>
                  <span className="flex items-center gap-1"><span className="font-mono text-sm font-bold text-nfl-navy">{formatoCuota(s.cuota, p.formato)}</span>
                    <button onClick={() => p.quitar(s.id)} aria-label={`Quitar ${s.etiqueta}`} className="h-9 w-9 rounded-lg font-bold text-slate-500 hover:bg-white hover:text-nfl-red">✕</button></span>
                </li>
              ))}
            </ul>
            <label className="etiqueta" htmlFor="monto">Monto (MXN de demostración)</label>
            <input id="monto" type="number" min={10} max={10000} step={10} value={p.monto} onChange={e => p.setMonto(Math.max(0, Number(e.target.value)))} className="campo-form font-mono font-bold" />
            <div className="mt-2 grid grid-cols-4 gap-1">{[50, 100, 200, 500].map(v => <button key={v} onClick={() => p.setMonto(v)} className="min-h-[40px] rounded-lg bg-nfl-light font-mono text-xs font-bold text-nfl-navy hover:bg-slate-200">${v}</button>)}</div>
            <div className="mt-3 rounded-xl bg-nfl-navy p-3 text-white">
              <div className="flex justify-between text-xs"><span>Cuota total</span><span className="font-mono">{cuota.toFixed(2)}</span></div>
              <div className="mt-1 flex items-center justify-between"><span className="text-sm">Ganancia potencial</span><span className="font-mono text-lg font-bold">{pesos(pago)}</span></div>
            </div>
            <button onClick={p.confirmar} disabled={p.enviando || !!p.bloqueado || p.monto < 10} className="btn-rojo mt-3 w-full uppercase tracking-wider">{p.enviando ? 'Confirmando…' : 'Confirmar apuesta'}</button>
            <p className="mt-2 text-center text-[11px] text-slate-500">Crédito ficticio. No es dinero real.</p>
          </>
        ))}

        {pestana === 'rapida' && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">Apuesta en un solo toque al ganador del partido.</p>
            <label className="etiqueta" htmlFor="monto-rapido">Monto</label>
            <select id="monto-rapido" className="campo-form" value={montoRapido} onChange={e => setMontoRapido(Number(e.target.value))}>{[50, 100, 200, 500].map(v => <option key={v} value={v}>{pesos(v)}</option>)}</select>
            {ml?.opciones.map(o => (
              <button key={o.id} disabled={p.enviando || !!p.bloqueado} onClick={() => p.rapida(ml, o.id, montoRapido)} className="btn-claro w-full justify-between">
                <span>{o.etiqueta}</span><span className="font-mono">{formatoCuota(o.cuota, p.formato)}</span>
              </button>
            ))}
          </div>
        )}

        {pestana === 'abiertas' && (p.abiertas.length === 0 ? <Vacio titulo="Sin apuestas abiertas" texto="Cuando confirmes un boleto aparecerá aquí." /> : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {p.abiertas.map(a => (
              <li key={a.id} className="rounded-xl border border-nfl-border bg-nfl-light p-3 text-sm">
                <div className="flex justify-between font-mono text-[11px] font-bold"><span className="text-nfl-navy">{a.id}</span><span className="text-emerald-800">● {a.estado}</span></div>
                <p className="mt-1 font-semibold">{a.selecciones.map(s => s.etiqueta).join(' + ')}</p>
                <div className="mt-1 flex justify-between border-t border-nfl-border pt-1 font-mono text-xs text-slate-600"><span>Monto {pesos(a.monto)}</span><strong className="text-nfl-navy">Pago {pesos(a.pago_potencial)}</strong></div>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
