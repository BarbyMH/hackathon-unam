/** Panel del usuario: saldo, depósito/retiro simulados, historial y límites de juego responsable. */
import { useState } from 'react'
import { api, ErrorApi } from '../../lib/api'
import { pesos } from '../../lib/cuotas'
import { usePrefs } from '../../lib/preferencias'
import type { Cuenta } from './tipos'

export function PanelUsuario({ cuenta, actualizar }: { cuenta: Cuenta; actualizar: (c: Cuenta) => void }) {
  const { avisar } = usePrefs()
  const [monto, setMonto] = useState(500)
  const [limite, setLimite] = useState(cuenta.limite_deposito_diario)
  const [confirmarExclusion, setConfirmarExclusion] = useState(false)
  const accion = async (ruta: string, cuerpo: unknown, ok: string) => {
    try { actualizar(await api<Cuenta>(ruta, { portal: 'usuario', cuerpo })); avisar(ok, 'exito') }
    catch (e) { avisar((e as ErrorApi).message, 'error') }
  }
  const excluido = cuenta.autoexcluido_hasta ? new Date(cuenta.autoexcluido_hasta * 1000) : null
  return (
    <section id="mi-cuenta" aria-labelledby="titulo-cuenta" className="grid gap-4 lg:grid-cols-3">
      <h2 id="titulo-cuenta" className="titular text-3xl text-white lg:col-span-3">Mi cuenta</h2>
      <div className="tarjeta p-5 text-nfl-dark">
        <p className="text-sm font-bold text-slate-600">Saldo de demostración</p>
        <p className="font-mono text-3xl font-bold text-nfl-navy">{pesos(cuenta.saldo)}</p>
        <label className="etiqueta mt-4" htmlFor="monto-billetera">Monto</label>
        <select id="monto-billetera" className="campo-form" value={monto} onChange={e => setMonto(Number(e.target.value))}>{[100, 500, 1000, 2500].map(v => <option key={v} value={v}>{pesos(v)}</option>)}</select>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="btn-navy" disabled={!!excluido} onClick={() => accion('apuestas/deposito', { monto }, 'Depósito simulado aplicado.')}>Depositar</button>
          <button className="btn-claro" onClick={() => accion('apuestas/retiro', { monto }, 'Retiro simulado aplicado.')}>Retirar</button>
        </div>
        <p className="mt-2 text-xs text-slate-600">Hoy has depositado {pesos(cuenta.depositado_hoy)} de {pesos(cuenta.limite_deposito_diario)}.</p>
      </div>

      <div className="tarjeta p-5 text-nfl-dark">
        <p className="font-bold text-nfl-navy"><span aria-hidden>🛡 </span>Juego responsable</p>
        <label className="etiqueta mt-3" htmlFor="limite">Límite diario de depósito</label>
        <div className="flex gap-2">
          <select id="limite" className="campo-form" value={limite} onChange={e => setLimite(Number(e.target.value))}>{[1000, 2000, 5000, 10000].map(v => <option key={v} value={v}>{pesos(v)}</option>)}</select>
          <button className="btn-navy" onClick={() => accion('apuestas/limites', { limite_deposito_diario: limite }, 'Límite actualizado.')}>Guardar</button>
        </div>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-bold text-nfl-red">Autoexclusión</p>
          {excluido ? <p className="mt-1 text-sm text-slate-700">Activa hasta el {excluido.toLocaleString('es-MX')}. No puedes apostar ni depositar.</p> : confirmarExclusion ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-slate-700">No podrás apostar ni depositar durante el tiempo elegido. No se puede deshacer antes.</p>
              <div className="grid grid-cols-3 gap-2">{[[24, '24 h'], [168, '7 días'], [720, '30 días']].map(([h, t]) => (
                <button key={h} className="btn-rojo px-2 text-sm" onClick={() => { setConfirmarExclusion(false); accion('apuestas/autoexclusion', { horas: h }, `Autoexclusión de ${t} activada.`) }}>{t}</button>))}</div>
              <button className="text-sm font-semibold text-nfl-navy underline" onClick={() => setConfirmarExclusion(false)}>Cancelar</button>
            </div>
          ) : <button className="btn-rojo mt-2 w-full" onClick={() => setConfirmarExclusion(true)}>Tomar un descanso</button>}
        </div>
      </div>

      <div className="tarjeta p-5 text-nfl-dark">
        <p className="font-bold text-nfl-navy"><span aria-hidden>🧾 </span>Historial</p>
        {cuenta.movimientos.length === 0 ? <p className="mt-2 text-sm text-slate-600">Aún no hay movimientos.</p> : (
          <ul className="mt-2 max-h-64 divide-y divide-nfl-border overflow-y-auto text-sm">
            {cuenta.movimientos.map((m, i) => (
              <li key={i} className="flex justify-between py-2"><span>{m.tipo}<span className="block text-xs text-slate-500">{new Date(m.t * 1000).toLocaleString('es-MX')}</span></span>
                <span className={`font-mono font-bold ${m.monto < 0 ? 'text-nfl-red' : 'text-emerald-800'}`}>{m.monto < 0 ? '−' : '+'}{pesos(Math.abs(m.monto))}</span></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
