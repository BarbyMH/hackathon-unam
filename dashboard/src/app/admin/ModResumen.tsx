/** Módulo 1 · Resumen del partido: contexto, QB titulares, lesiones, altitud, localía y tendencias. */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePrefs } from '../../lib/preferencias'
import { COLORES, EJE, Grafica } from '../../components/charts/Grafica'
import { EnResumen, Escudo, Fuente, Termino, VerMas } from '../../components/ui'

const NOMBRE: Record<string, string> = { MIN: 'Vikings', SF: '49ers' }

export function ModResumen({ a, externas }: { a: any; externas: any }) {
  const { principiante } = usePrefs()
  const e = a.estadisticas
  const fecha = new Date(a.dataset.cargado_en).toLocaleString('es-MX')
  const semanas = Array.from(new Set([...e.MIN.por_semana, ...e.SF.por_semana].map((s: any) => s.semana))).sort((x: any, y: any) => x - y)
  const tendencia = semanas.map(s => ({ semana: `Sem ${s}`, MIN: e.MIN.por_semana.find((x: any) => x.semana === s)?.yardas_por_jugada ?? null, SF: e.SF.por_semana.find((x: any) => x.semana === s)?.yardas_por_jugada ?? null }))
  return (
    <section id="resumen" aria-labelledby="t-resumen" className="scroll-mt-20 space-y-4">
      <h2 id="t-resumen" className="titular text-3xl text-nfl-navy">1 · Resumen del partido</h2>
      <EnResumen icono="🏈" titulo="Contexto del encuentro">{a.resumenes.resumen}</EnResumen>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(['MIN', 'SF'] as const).map(eq => {
          const ext = externas?.equipos?.[eq]
          return (
            <div key={eq} className="tarjeta flex flex-col gap-3 p-5" style={{ borderTop: `6px solid ${eq === 'MIN' ? COLORES.MIN : COLORES.SF}` }}>
              <div className="flex items-center gap-3"><Escudo equipo={eq} tam="sm" /><div><p className="font-bold">{a.equipos[eq].nombre}</p><p className="text-xs text-slate-600">{eq === 'SF' ? 'Local designado' : 'Visitante'}</p></div></div>
              <p className="text-sm"><strong>Récord actual:</strong> {ext?.ok && ext.datos?.record ? <span className="font-mono">{ext.datos.record}</span> : <span className="text-slate-600">no disponible</span>}</p>
              {ext && <Fuente fuente={ext.ok ? ext.fuente : 'Sin conexión a fuente externa'} fecha={ext.consultado_en ? new Date(ext.consultado_en).toLocaleString('es-MX') : undefined} />}
              <p className="text-sm"><strong>En el archivo:</strong> {e[eq].partidos} partidos · {e[eq].jugadas_pase} jugadas de pase</p>
              <VerMas etiqueta="Ver partidos del archivo">
                <ul className="text-xs text-slate-700">{a.partidos.filter((p: any) => p.equipo === eq).map((p: any, i: number) => <li key={i}>Sem {p.semana}: {p.visitante} @ {p.local} · {p.fecha}</li>)}</ul>
              </VerMas>
            </div>
          )
        })}
        <div className="tarjeta p-5">
          <p className="font-bold text-nfl-navy"><Termino id="qb">Quarterbacks titulares</Termino></p>
          <ul className="mt-3 space-y-2">
            {(['MIN', 'SF'] as const).map(eq => { const q = a.qb_titulares[eq]; return (
              <li key={eq} className="rounded-lg bg-nfl-light p-2.5 text-sm">
                <strong>{q?.displayName ?? 'Sin dato'}</strong> <span className="text-slate-600">({NOMBRE[eq]})</span>
                {q && <span className="block font-mono text-xs text-slate-700">{q.yardas} yds · {q.td} TD · {q.intercepciones} INT · rating {q.rating}</span>}
              </li>) })}
          </ul>
          <p className="mt-2 text-xs text-slate-600">Estado: el archivo no trae reporte de lesiones. Confirma con el parte médico oficial de la semana 11.</p>
          <div className="mt-2"><Fuente fuente={a.dataset.fuente} fecha={fecha} /></div>
        </div>
        <div className="tarjeta p-5">
          <p className="font-bold text-nfl-red"><Termino id="altitud">Factor altitud · 2,240 m</Termino></p>
          <p className="mt-2 text-sm text-slate-700">{a.contexto.nota_altitud}</p>
          <p className="mt-2 text-sm text-slate-700"><strong>Localía:</strong> San Francisco es local en papel, pero se juega en sede neutral ({a.contexto.sede}).</p>
          <p className="mt-2 text-xs text-slate-600"><strong>Lesiones:</strong> sin datos en el archivo; se muestran al cargar un archivo con la columna <code>estatus</code>.</p>
        </div>
      </div>
      <Grafica titulo="Tendencia reciente: yardas por jugada de pase" fuente={a.dataset.fuente} alto={principiante ? 220 : 280}
        comoLeer="Cada punto es un partido. Más arriba = el ataque aéreo avanzó más en cada jugada."
        loQueDice={`Promedio de la muestra: 49ers ${e.SF.yardas_por_jugada} y Vikings ${e.MIN.yardas_por_jugada} yardas por jugada de pase.`}
        tabla={{ columnas: ['Semana', 'Vikings', '49ers'], filas: tendencia.map(t => [t.semana, t.MIN, t.SF]) }} mostrarTabla={!principiante}>
        <ResponsiveContainer>
          <LineChart data={tendencia} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="#E2E8F0" /><XAxis dataKey="semana" tick={EJE} /><YAxis tick={EJE} /><Tooltip /><Legend />
            <Line dataKey="MIN" name="Vikings ●" stroke={COLORES.MIN} strokeWidth={3} dot={{ r: 5 }} connectNulls />
            <Line dataKey="SF" name="49ers ▲" stroke={COLORES.SF} strokeWidth={3} strokeDasharray="6 3" dot={{ r: 5, strokeWidth: 2 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </Grafica>
      {a.h2h.nota && <p className="text-sm text-slate-600"><span aria-hidden>ℹ </span><strong>Enfrentamientos directos (H2H):</strong> {a.h2h.nota}</p>}
    </section>
  )
}
