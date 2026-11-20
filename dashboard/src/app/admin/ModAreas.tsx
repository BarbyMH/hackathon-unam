/** Módulo 4 · Mejores jugadores por área, con una gráfica comparativa por área y tarjeta de jugador. */
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { usePrefs } from '../../lib/preferencias'
import { COLORES, DefsPatrones, EJE, Grafica, LeyendaEquipos, RELLENO } from '../../components/charts/Grafica'
import { EnResumen, Modal, Termino } from '../../components/ui'

const METRICA: Record<string, string> = {
  yardas: 'Yardas', td: 'Touchdowns', intercepciones: 'Intercepciones', rating: 'Rating', completos_pct: '% completos',
  yardas_tierra: 'Yardas por tierra', yardas_por_acarreo: 'Yardas por acarreo', recepciones: 'Recepciones', objetivos: 'Objetivos (targets)',
  capturas_permitidas: 'Capturas permitidas', presiones_permitidas: 'Presiones permitidas', proteccion_pct: '% protección de pase',
  capturas: 'Capturas (sacks)', tackleos: 'Tackleos', presiones: 'Presiones', pases_defendidos: 'Pases defendidos',
  fg_pct: '% goles de campo', yardas_por_despeje: 'Yardas por despeje', snaps: 'Jugadas', golpes: 'Golpes al QB', apuros: 'Apuros al QB',
  intentos: 'Intentos', completos: 'Completos', yardas_por_intento: 'Yds por intento', yardas_por_recepcion: 'Yds por recepción', fg_largo: 'FG más largo',
}
const AREAS = [
  { id: 'QB', etiqueta: 'QB', termino: 'qb' }, { id: 'RB', etiqueta: 'RB', termino: 'rb' }, { id: 'WR', etiqueta: 'WR / TE', termino: 'wr' },
  { id: 'OL', etiqueta: 'OL', termino: 'ol' }, { id: 'DL', etiqueta: 'DL / LB', termino: 'dl' }, { id: 'DB', etiqueta: 'CB / S', termino: 'cb' }, { id: 'ST', etiqueta: 'K / P', termino: 'k' },
]
const MENOS_ES_MEJOR = new Set(['intercepciones', 'capturas_permitidas', 'presiones_permitidas'])
const corto = (n: string) => { const p = n.split(' '); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : n }

export function ModAreas({ a }: { a: any }) {
  const { principiante } = usePrefs()
  const [area, setArea] = useState('QB')
  const info = a.areas[area]
  const [metrica, setMetrica] = useState(info.metricas[0])
  const [jugador, setJugador] = useState<any>(null)
  useEffect(() => setMetrica(a.areas[area].metricas[0]), [area, a])

  const n = principiante ? 3 : 5
  const jugadores = useMemo(() => (['MIN', 'SF'] as const).flatMap(eq => info.jugadores.filter((j: any) => j.equipo === eq && j[metrica] != null)
    .sort((x: any, y: any) => MENOS_ES_MEJOR.has(metrica) ? 0 : (y[metrica] ?? 0) - (x[metrica] ?? 0)).slice(0, n)), [info, metrica, n])
  const datos = jugadores.map((j: any) => ({ ...j, n: corto(j.displayName), v: j[metrica] }))
  const lider = [...datos].sort((x, y) => (MENOS_ES_MEJOR.has(metrica) ? x.v - y.v : y.v - x.v))[0]
  const qbs = area === 'QB' ? (['MIN', 'SF'] as const).map(eq => info.jugadores.find((j: any) => j.equipo === eq)).filter(Boolean) : []
  const radar = area === 'QB' && qbs.length === 2 ? ['yardas', 'td', 'rating', 'completos_pct', 'intercepciones'].map(k => {
    const mx = Math.max(...qbs.map((q: any) => q[k] ?? 0), 1)
    const val = (q: any) => Math.round(100 * (k === 'intercepciones' ? 1 - (q[k] ?? 0) / (mx * 1.5) : (q[k] ?? 0) / mx))
    return { m: k === 'intercepciones' ? 'Cuida el balón' : METRICA[k], MIN: val(qbs[0]), SF: val(qbs[1]) }
  }) : []

  const barras = (
    <ResponsiveContainer>
      <BarChart data={datos} layout={info.grafica === 'barras_horizontales' ? 'vertical' : 'horizontal'} margin={{ top: 20, right: 24, bottom: 0, left: info.grafica === 'barras_horizontales' ? 40 : -10 }}>
        <DefsPatrones /><CartesianGrid stroke="#E2E8F0" />
        {info.grafica === 'barras_horizontales'
          ? <><XAxis type="number" tick={EJE} /><YAxis type="category" dataKey="n" tick={EJE} width={110} /></>
          : <><XAxis dataKey="n" tick={{ ...EJE, fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis tick={EJE} /></>}
        <Tooltip formatter={(v: any) => [v, METRICA[metrica]]} labelFormatter={(l: any) => l} />
        <Bar dataKey="v" name={METRICA[metrica]} radius={6} onClick={(d: any) => setJugador(d?.payload ?? d)} cursor="pointer">
          {datos.map(d => <Cell key={d.displayName} fill={RELLENO[d.equipo as 'MIN' | 'SF']} />)}
          <LabelList dataKey="v" position={info.grafica === 'barras_horizontales' ? 'right' : 'top'} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )

  return (
    <section id="jugadores" aria-labelledby="t-areas" className="scroll-mt-20 space-y-4">
      <h2 id="t-areas" className="titular text-3xl text-nfl-navy">4 · Mejores jugadores por área</h2>
      <EnResumen icono="⭐" titulo="Duelos por posición">Elige un área del equipo para comparar a los mejores jugadores de Vikings y 49ers. Toca una barra o una tarjeta para ver la ficha del jugador.</EnResumen>
      <div role="tablist" aria-label="Áreas del juego" className="flex flex-wrap gap-2">
        {AREAS.map(x => <button key={x.id} role="tab" aria-selected={area === x.id} onClick={() => setArea(x.id)} className={area === x.id ? 'btn-navy text-sm' : 'btn-claro text-sm'}>{x.etiqueta}</button>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <Grafica titulo={info.titulo} fuente={info.fuente} alto={300}
            comoLeer={`Cada barra es un jugador (Top ${n} por equipo). Morado liso = Vikings, rojo con rayas = 49ers. ${MENOS_ES_MEJOR.has(metrica) ? 'En esta métrica, menos es mejor.' : 'Más alto es mejor.'}`}
            loQueDice={lider ? `${lider.displayName} (${lider.equipo === 'MIN' ? 'Vikings' : '49ers'}) lidera en ${METRICA[metrica].toLowerCase()} con ${lider.v}.${info.fuente === 'demo' ? ' Datos de demostración: el archivo no incluye esta área.' : ''}` : 'Sin datos para esta métrica.'}
            controles={<div className="flex flex-wrap items-center gap-3"><label className="text-sm font-bold text-nfl-navy" htmlFor="metrica">Métrica:</label>
              <select id="metrica" className="campo-form w-auto min-h-[44px] py-2 text-sm" value={metrica} onChange={e => setMetrica(e.target.value)}>{info.metricas.map((k: string) => <option key={k} value={k}>{METRICA[k] ?? k}</option>)}</select><LeyendaEquipos /></div>}
            tabla={{ columnas: ['Jugador', 'Equipo', ...info.metricas.map((k: string) => METRICA[k] ?? k)], filas: jugadores.map((j: any) => [j.displayName, j.equipo, ...info.metricas.map((k: string) => j[k])]) }} mostrarTabla={!principiante}>
            {barras}
          </Grafica>
          {area === 'QB' && radar.length > 0 && (
            <Grafica titulo="Perfil de los QB titulares (radar)" fuente={info.fuente} alto={300}
              comoLeer="Cada eje es una habilidad en escala 0-100 (100 = el mejor de los dos). Más área = perfil más completo."
              loQueDice={`${qbs[0].displayName} y ${qbs[1].displayName}: compara dónde la figura de cada uno se estira más.`}>
              <ResponsiveContainer><RadarChart data={radar} outerRadius="72%"><PolarGrid /><PolarAngleAxis dataKey="m" tick={EJE} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="MIN" name={`${qbs[0].displayName} ●`} stroke={COLORES.MIN} fill={COLORES.MIN} fillOpacity={0.35} strokeWidth={2} />
                <Radar dataKey="SF" name={`${qbs[1].displayName} ▲`} stroke={COLORES.SF} fill={COLORES.SF} fillOpacity={0.25} strokeWidth={2} strokeDasharray="5 3" /><Legend /><Tooltip /></RadarChart></ResponsiveContainer>
            </Grafica>
          )}
          {area === 'WR' && (
            <Grafica titulo="Objetivos vs. yardas (dispersión)" fuente={info.fuente} alto={300}
              comoLeer="Cada punto es un receptor: a la derecha = le lanzan más; arriba = gana más yardas. Arriba a la izquierda = muy eficiente."
              loQueDice="Los receptores por encima del resto ganan más yardas con menos pases recibidos.">
              <ResponsiveContainer><ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: -5 }}><CartesianGrid stroke="#E2E8F0" />
                <XAxis type="number" dataKey="objetivos" name="Objetivos" tick={EJE} /><YAxis type="number" dataKey="yardas" name="Yardas" tick={EJE} /><ZAxis range={[90, 90]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: any, k: any) => [v, k]} labelFormatter={() => ''} content={({ payload }) => payload?.[0] ? <div className="rounded-lg border bg-white p-2 text-xs shadow"><strong>{(payload[0].payload as any).displayName}</strong><br />{(payload[0].payload as any).objetivos} objetivos · {(payload[0].payload as any).yardas} yds</div> : null} />
                <Legend /><Scatter name="Vikings ●" data={info.jugadores.filter((j: any) => j.equipo === 'MIN')} fill={COLORES.MIN} shape="circle" onClick={(d: any) => setJugador(d?.payload ?? d)} />
                <Scatter name="49ers ▲" data={info.jugadores.filter((j: any) => j.equipo === 'SF')} fill={COLORES.SF} shape="triangle" onClick={(d: any) => setJugador(d?.payload ?? d)} /></ScatterChart></ResponsiveContainer>
            </Grafica>
          )}
        </div>
        <div className="space-y-3 xl:col-span-4">
          <p className="text-sm font-bold text-nfl-navy"><Termino id={AREAS.find(x => x.id === area)!.termino}>Líderes del área</Termino></p>
          {jugadores.map((j: any) => (
            <button key={j.displayName} onClick={() => setJugador(j)} className="tarjeta flex w-full items-center gap-3 p-3 text-left hover:border-nfl-navy" style={{ borderLeft: `6px solid ${j.equipo === 'MIN' ? COLORES.MIN : COLORES.SF}` }}>
              <Avatar j={j} />
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{j.displayName}</span><span className="text-xs text-slate-600">{j.officialPosition} · {j.equipo === 'MIN' ? '● Vikings' : '▲ 49ers'}</span></span>
              <span className="font-mono text-sm font-bold text-nfl-navy">{j[metrica]}<span className="block text-[10px] font-normal text-slate-500">{METRICA[metrica]}</span></span>
            </button>
          ))}
        </div>
      </div>
      <Modal titulo="Ficha del jugador" abierto={!!jugador} alCerrar={() => setJugador(null)}>
        {jugador && (
          <div>
            <div className="flex items-center gap-4"><Avatar j={jugador} grande />
              <div><p className="text-xl font-bold">{jugador.displayName}</p><p className="text-sm text-slate-600">{jugador.officialPosition} · {jugador.equipo === 'MIN' ? 'Minnesota Vikings' : 'San Francisco 49ers'}</p>
                <p className="text-xs text-slate-500">Número: {jugador.numero ?? 's/n (no incluido en el archivo)'}</p></div></div>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(jugador).filter(([k, v]) => METRICA[k] && v != null).map(([k, v]) => <div key={k} className="rounded-lg bg-nfl-light p-2"><dt className="text-xs text-slate-600">{METRICA[k]}</dt><dd className="font-mono text-lg font-bold text-nfl-navy">{String(v)}</dd></div>)}
            </dl>
            {info.fuente === 'demo' && <p className="mt-3 text-sm text-amber-900">⚠ Datos de demostración.</p>}
          </div>
        )}
      </Modal>
    </section>
  )
}

function Avatar({ j, grande = false }: { j: any; grande?: boolean }) {
  const ini = String(j.displayName).split(' ').map((p: string) => p[0]).slice(0, 2).join('')
  return <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold ${grande ? 'h-16 w-16 text-2xl' : 'h-11 w-11 text-base'} ${j.equipo === 'MIN' ? 'bg-vikings-purple text-vikings-gold' : 'bg-niners-red text-white'}`}>{ini}</span>
}
