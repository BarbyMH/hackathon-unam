/** Módulos 6 y 7 · Probabilidades de victoria y comparativo con el mercado. */
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatoCuota } from '../../lib/cuotas'
import { usePrefs } from '../../lib/preferencias'
import { COLORES, EJE, Grafica } from '../../components/charts/Grafica'
import { EnResumen, Termino, VerMas } from '../../components/ui'

export function ModProbabilidades({ a }: { a: any }) {
  const { principiante } = usePrefs()
  const m = a.modelo
  const datosMercado = a.mercado.map((x: any) => ({ n: x.pronostico, Modelo: x.prob_modelo, Mercado: x.prob_mercado }))
  const mayor = [...a.mercado].sort((x: any, y: any) => Math.abs(y.diferencia) - Math.abs(x.diferencia))[0]
  return (
    <>
      <section id="probabilidades" aria-labelledby="t-prob" className="scroll-mt-20 space-y-4">
        <h2 id="t-prob" className="titular text-3xl text-nfl-navy">6 · Probabilidades de victoria</h2>
        <EnResumen icono="🎯" titulo="¿Quién es favorito?" acento="red">{a.resumenes.probabilidades} {m.aviso}</EnResumen>
        <div className="tarjeta space-y-5 p-5 sm:p-6">
          <div>
            <div className="flex justify-between text-sm font-bold"><span style={{ color: COLORES.MIN }}>● Vikings {m.probabilidad.MIN}%</span><span style={{ color: COLORES.SF }}>49ers {m.probabilidad.SF}% ▲</span></div>
            <div className="mt-1 flex h-8 overflow-hidden rounded-full" role="img" aria-label={`Vikings ${m.probabilidad.MIN} por ciento, 49ers ${m.probabilidad.SF} por ciento`}>
              <div style={{ width: `${m.probabilidad.MIN}%`, background: COLORES.MIN }} className="flex items-center justify-center font-mono text-xs font-bold text-white">{m.probabilidad.MIN}%</div>
              <div style={{ width: `${m.probabilidad.SF}%`, background: `repeating-linear-gradient(45deg, ${COLORES.SF}, ${COLORES.SF} 6px, #c43a3a 6px, #c43a3a 10px)` }} className="flex items-center justify-center font-mono text-xs font-bold text-white">{m.probabilidad.SF}%</div>
            </div>
            <p className="mt-2 text-sm text-slate-700"><Termino id="intervalo">Rango probable</Termino> para los 49ers: <strong>{m.intervalo_sf[0]}% – {m.intervalo_sf[1]}%</strong> · Nivel de confianza: <strong className="uppercase">{m.nivel_confianza}</strong></p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-nfl-light p-4"><p className="text-xs font-bold text-slate-600">Marcador esperado</p><p className="font-mono text-2xl font-bold text-nfl-navy">SF {m.marcador_esperado.SF} – MIN {m.marcador_esperado.MIN}</p></div>
            <div className="rounded-xl bg-nfl-light p-4"><p className="text-xs font-bold text-slate-600"><Termino id="spread">Cubrir el spread</Termino> ({m.spread.linea})</p><p className="font-mono text-2xl font-bold text-nfl-navy">SF {m.spread.p_cubre_sf}%</p><p className="text-xs text-slate-600">Vikings +3: {m.spread.p_cubre_min}%</p></div>
            <div className="rounded-xl bg-nfl-light p-4"><p className="text-xs font-bold text-slate-600"><Termino id="over_under">Over / Under</Termino> {m.total.linea}</p><p className="font-mono text-2xl font-bold text-nfl-navy">Over {m.total.p_over}%</p><p className="text-xs text-slate-600">Under: {m.total.p_under}%</p></div>
          </div>
          <div>
            <p className="font-bold text-nfl-navy">Factores del modelo, en lenguaje simple</p>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {m.factores.map((f: any) => (
                <li key={f.factor} className="rounded-xl border border-nfl-border p-3 text-sm">
                  <p className="font-bold">{f.factor} <span className="font-mono text-xs text-slate-600">{f.favorece ? `→ favorece a ${f.favorece === 'SF' ? '49ers ▲' : 'Vikings ●'} (${f.puntos > 0 ? '+' : ''}${f.puntos} pts)` : '→ neutral'}</span></p>
                  <p className="mt-1 text-slate-700">{f.detalle}</p>
                </li>))}
            </ul>
          </div>
          <VerMas etiqueta="Ver cómo se calcula" abiertoInicial={!principiante}>
            <p className="text-sm text-slate-700">{m.metodo} Se simularon {m.simulaciones.toLocaleString('es-MX')} partidos. Cada yarda extra por jugada de pase vale ~2.6 puntos por partido. Los datos vienen de {a.dataset.temporada}; no reflejan cambios de plantilla posteriores.</p>
          </VerMas>
          <p className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">⚠ Estimaciones estadísticas, no garantías. Úsalas solo con fines de análisis.</p>
        </div>
      </section>

      <section id="mercado" aria-labelledby="t-mercado" className="scroll-mt-20 space-y-4">
        <h2 id="t-mercado" className="titular text-3xl text-nfl-navy">7 · Comparativo con el mercado</h2>
        <EnResumen icono="⚖" titulo="Modelo vs. cuotas">La mayor diferencia está en <strong>{mayor.pronostico}</strong>: el modelo da {mayor.prob_modelo}% y las cuotas demo implican {mayor.prob_mercado}%.</EnResumen>
        <Grafica titulo="Probabilidad del modelo vs. probabilidad implícita" fuente="Modelo + cuotas de demostración" alto={300}
          comoLeer="Para cada pronóstico, la barra oscura es nuestro modelo y la clara es lo que 'dicen' las cuotas (sin el margen de la casa)."
          loQueDice={`Cuando la barra del modelo supera a la del mercado, el modelo ve ese resultado más probable de lo que paga la cuota.`}
          tabla={{ columnas: ['Pronóstico', 'Cuota', 'Prob. mercado %', 'Prob. modelo %', 'Diferencia', 'Lectura'], filas: a.mercado.map((x: any) => [x.pronostico, formatoCuota(x.cuota, 'americana'), x.prob_mercado, x.prob_modelo, x.diferencia, x.lectura]) }} mostrarTabla={!principiante}>
          <ResponsiveContainer>
            <BarChart data={datosMercado} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}><CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="n" tick={{ ...EJE, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} /><YAxis tick={EJE} unit="%" domain={[0, 100]} /><Tooltip formatter={(v: any) => `${v}%`} /><Legend />
              <Bar dataKey="Modelo" name="Modelo ■" fill="#013369" radius={[6, 6, 0, 0]} /><Bar dataKey="Mercado" name="Mercado □" fill="#C8D1DC" stroke="#013369" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Grafica>
        <p className="text-sm text-slate-600"><Termino id="probabilidad_implicita">Probabilidad implícita</Termino>: se calcula con las cuotas simuladas del portal de apuestas, normalizadas para quitar el margen.</p>
      </section>
    </>
  )
}
