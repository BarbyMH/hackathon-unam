/** Módulos 2 y 3 · Análisis de jugadas anteriores y yardas. */
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePrefs } from '../../lib/preferencias'
import { DefsPatrones, EJE, Grafica, RELLENO } from '../../components/charts/Grafica'
import { EnResumen, Termino } from '../../components/ui'

function Barras({ datos, unidad = '' }: { datos: any[]; unidad?: string }) {
  return (
    <ResponsiveContainer>
      <BarChart data={datos} margin={{ top: 18, right: 8, bottom: 0, left: -12 }}>
        <DefsPatrones />
        <CartesianGrid stroke="#E2E8F0" vertical={false} /><XAxis dataKey="n" tick={EJE} interval={0} /><YAxis tick={EJE} unit={unidad} />
        <Tooltip formatter={(v: any) => `${v}${unidad}`} /><Legend />
        <Bar dataKey="MIN" name="Vikings ●" fill={RELLENO.MIN} radius={[6, 6, 0, 0]}><LabelList dataKey="MIN" position="top" fontSize={11} /></Bar>
        <Bar dataKey="SF" name="49ers ▲" fill={RELLENO.SF} radius={[6, 6, 0, 0]}><LabelList dataKey="SF" position="top" fontSize={11} /></Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const mas = (a: number, b: number, alto = true) => ((alto ? a >= b : a <= b) ? '49ers' : 'Vikings')

export function ModJugadas({ a }: { a: any }) {
  const { principiante } = usePrefs()
  const m = a.estadisticas.MIN, s = a.estadisticas.SF, f = a.dataset.fuente
  const clave = [
    { n: '3.er down %', MIN: m.tercer_down_pct, SF: s.tercer_down_pct },
    { n: 'TD en zona roja %', MIN: m.zona_roja_td_pct, SF: s.zona_roja_td_pct },
    { n: 'Explosivas %', MIN: m.explosivas_pct, SF: s.explosivas_pct },
    ...(principiante ? [] : [{ n: 'Capturas recibidas %', MIN: m.capturas_pct, SF: s.capturas_pct }, { n: 'Completos %', MIN: m.completos_pct, SF: s.completos_pct }]),
  ]
  const downs = m.por_down.map((d: any, i: number) => ({ n: `${d.down}.º down`, MIN: d.exito, SF: s.por_down[i].exito }))
  const dist = m.por_distancia.map((d: any, i: number) => ({ n: d.distancia, MIN: d.exito, SF: s.por_distancia[i].exito }))
  const yardas = [
    { n: 'Totales', MIN: m.yardas_totales_pj, SF: s.yardas_totales_pj },
    { n: 'Por aire', MIN: m.yardas_aire_pj, SF: s.yardas_aire_pj },
    { n: 'Scramble QB', MIN: m.yardas_scramble_pj, SF: s.yardas_scramble_pj },
  ]
  const eficiencia = [
    { n: 'Yds por intento', MIN: m.yardas_por_intento, SF: s.yardas_por_intento },
    { n: 'Yds por jugada', MIN: m.yardas_por_jugada, SF: s.yardas_por_jugada },
    { n: 'Permitidas (def.)', MIN: m.def_yardas_por_jugada, SF: s.def_yardas_por_jugada },
  ]
  const recs = a.areas.WR.jugadores.slice().sort((x: any, y: any) => (y.yardas ?? 0) - (x.yardas ?? 0)).slice(0, principiante ? 5 : 10)
  return (
    <>
      <section id="jugadas" aria-labelledby="t-jugadas" className="scroll-mt-20 space-y-4">
        <h2 id="t-jugadas" className="titular text-3xl text-nfl-navy">2 · Análisis de jugadas anteriores</h2>
        <EnResumen icono="📊" titulo="Momentos clave" acento="red">{a.resumenes.jugadas}</EnResumen>
        <p className="text-sm text-slate-600"><span aria-hidden>ℹ </span><strong>Pase vs. carrera:</strong> el archivo solo trae jugadas de pase (dropbacks), así que no se puede medir el reparto pase/carrera. Las carreras del QB aparecen como "scramble".</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <Grafica titulo="Eficiencia en momentos clave" fuente={f}
            comoLeer="Porcentaje de éxito en tercer down, en zona roja y de jugadas de 20+ yardas. Más alto es mejor (salvo capturas recibidas)."
            loQueDice={`Los ${mas(s.tercer_down_pct, m.tercer_down_pct)} convierten más terceros downs y los ${mas(s.zona_roja_td_pct, m.zona_roja_td_pct)} terminan más jugadas de zona roja en touchdown.`}
            tabla={{ columnas: ['Métrica', 'Vikings', '49ers'], filas: clave.map(x => [x.n, x.MIN, x.SF]) }} mostrarTabla={!principiante}>
            <Barras datos={clave} unidad="%" />
          </Grafica>
          <Grafica titulo="Tasa de éxito por down" fuente={f}
            comoLeer="Una jugada es exitosa si gana suficiente distancia según el down. Cada par de barras es un down."
            loQueDice={`En tercer down, el éxito es ${downs[2]?.MIN ?? '—'}% para Vikings y ${downs[2]?.SF ?? '—'}% para 49ers.`}
            tabla={{ columnas: ['Down', 'Vikings %', '49ers %', 'Jugadas MIN', 'Jugadas SF'], filas: m.por_down.map((d: any, i: number) => [`${d.down}.º`, d.exito, s.por_down[i].exito, d.jugadas, s.por_down[i].jugadas]) }} mostrarTabla={!principiante}>
            <Barras datos={downs} unidad="%" />
          </Grafica>
        </div>
        {!principiante && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Grafica titulo="Éxito según la distancia por avanzar" fuente={f} comoLeer="Agrupa las jugadas por yardas que faltaban para el primer down." loQueDice="Con distancias largas ambos equipos pierden eficiencia; la diferencia entre ellos se ve en las distancias medias."
              tabla={{ columnas: ['Distancia', 'Vikings %', '49ers %'], filas: dist.map((x: any) => [x.n, x.MIN, x.SF]) }} mostrarTabla>
              <Barras datos={dist} unidad="%" />
            </Grafica>
            <div className="tarjeta p-5">
              <p className="titular text-xl text-nfl-navy">Formaciones y penalizaciones</p>
              <table className="mt-3 w-full text-sm"><thead><tr className="border-b-2 border-nfl-navy text-left font-mono text-[11px] uppercase text-nfl-navy"><th className="py-2">Formación</th><th>Uso MIN</th><th>Yds MIN</th><th>Uso SF</th><th>Yds SF</th></tr></thead>
                <tbody className="divide-y divide-nfl-border">{m.formaciones.map((x: any) => { const y = s.formaciones.find((z: any) => z.formacion === x.formacion); return <tr key={x.formacion}><td className="py-1.5 font-semibold">{x.formacion}</td><td className="font-mono">{x.uso}%</td><td className="font-mono">{x.yardas_por_jugada}</td><td className="font-mono">{y?.uso ?? '—'}%</td><td className="font-mono">{y?.yardas_por_jugada ?? '—'}</td></tr> })}</tbody></table>
              <p className="mt-3 text-sm"><Termino id="penalizacion">Penalizaciones</Termino> por partido: Vikings <strong>{m.penalizaciones_pj}</strong> · 49ers <strong>{s.penalizaciones_pj}</strong></p>
              <p className="mt-1 text-sm">Jugadas <Termino id="explosiva">explosivas</Termino>: Vikings <strong>{m.explosivas}</strong> · 49ers <strong>{s.explosivas}</strong></p>
            </div>
          </div>
        )}
      </section>

      <section id="yardas" aria-labelledby="t-yardas" className="scroll-mt-20 space-y-4">
        <h2 id="t-yardas" className="titular text-3xl text-nfl-navy">3 · Yardas</h2>
        <EnResumen icono="📏" titulo="Cómo avanzan el balón">{a.resumenes.yardas}</EnResumen>
        <div className="grid gap-6 lg:grid-cols-2">
          <Grafica titulo="Yardas por partido" fuente={f} comoLeer="Barras más altas = más distancia ganada por partido en jugadas de pase."
            loQueDice={`Los ${mas(s.yardas_aire_pj, m.yardas_aire_pj)} ganan más yardas por aire por partido.`}
            tabla={{ columnas: ['Tipo', 'Vikings', '49ers'], filas: yardas.map(x => [x.n, x.MIN, x.SF]) }} mostrarTabla={!principiante}>
            <Barras datos={yardas} />
          </Grafica>
          <Grafica titulo="Eficiencia: yardas por intento" fuente={f} comoLeer="Cuántas yardas gana (o permite, en defensa) cada equipo por jugada. Para la defensa, más bajo es mejor."
            loQueDice={`Los ${mas(s.yardas_por_intento, m.yardas_por_intento)} sacan más yardas de cada pase; los ${mas(s.def_yardas_por_jugada, m.def_yardas_por_jugada, false)} permiten menos en defensa.`}
            tabla={{ columnas: ['Métrica', 'Vikings', '49ers'], filas: eficiencia.map(x => [x.n, x.MIN, x.SF]) }} mostrarTabla={!principiante}>
            <Barras datos={eficiencia} />
          </Grafica>
        </div>
        <div className="tarjeta p-5">
          <p className="titular text-xl text-nfl-navy">Yardas por jugador (receptores)</p>
          <p className="text-sm text-slate-600"><Termino id="yac">YAC</Termino>: el archivo no separa yardas en el aire y después de atrapar, así que no se muestra.</p>
          <table className="mt-3 w-full text-sm"><thead><tr className="border-b-2 border-nfl-navy text-left font-mono text-[11px] uppercase text-nfl-navy"><th className="py-2">Jugador</th><th>Equipo</th><th>Yardas</th><th>Recep.</th>{!principiante && <><th>Objetivos</th><th>Yds/rec</th><th>TD</th></>}</tr></thead>
            <tbody className="divide-y divide-nfl-border">{recs.map((r: any) => <tr key={r.displayName}><td className="py-1.5 font-semibold">{r.displayName} <span className="text-xs text-slate-500">{r.officialPosition}</span></td><td>{r.equipo === 'MIN' ? '● MIN' : '▲ SF'}</td><td className="font-mono">{r.yardas}</td><td className="font-mono">{r.recepciones}</td>{!principiante && <><td className="font-mono">{r.objetivos}</td><td className="font-mono">{r.yardas_por_recepcion}</td><td className="font-mono">{r.td}</td></>}</tr>)}</tbody></table>
        </div>
      </section>
    </>
  )
}
