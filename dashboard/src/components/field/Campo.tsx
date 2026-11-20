/**
 * Campo de fútbol americano a escala en SVG (120 × 53.3 yardas, 10 px por yarda):
 * zonas de anotación, líneas cada 5 yardas, números, hash marks y logo placeholder.
 * Muestra la distribución de jugadores por formación con transición animada y una capa de mapa de calor.
 */
import { useMemo, useState } from 'react'
import { COLOR_EQUIPO } from '../../lib/evento'
import { DEFENSIVAS, ESPECIALES_PATEA, ESPECIALES_REGRESA, Formacion, OFENSIVAS, ROLES } from './formaciones'

type JugadorCampo = { nombre: string; posicion: string; veces: number; resumen: string }
type Zona = { profundidad: string; lado: string; intentos: number; yardas_por_intento: number }
export type DatosCampo = { equipos: Record<string, Record<string, JugadorCampo[]>>; uso_formaciones: Record<string, { formacion: string; uso: number }[]>; nota: string; fuente: string }

const PX = 10, ANCHO = 1200, ALTO = 533, LOS = 600
type Equipo = 'MIN' | 'SF'
type Nodo = { key: string; equipo: Equipo; x: number; y: number; etiqueta: string; nombre: string; resumen: string }

/** Coordenadas relativas -> absolutas. El ataque queda a la izquierda de la línea y avanza hacia la derecha. */
function ubicar(f: Formacion, equipo: Equipo, datos: DatosCampo): Nodo[] {
  const g = datos.equipos[equipo] ?? {}
  return f.lugares.map(l => {
    const especial = l.grupo.startsWith('_')
    const j = especial ? undefined : g[l.grupo]?.[l.i]
    return {
      key: `${equipo}-${l.slot}`, equipo, etiqueta: l.etiqueta, x: LOS + l.dx * PX, y: l.y * PX,
      nombre: j?.nombre ?? `${l.etiqueta} (${especial ? 'no incluido en el archivo' : 'sin dato'})`, resumen: j?.resumen ?? '',
    }
  })
}

function Cesped() {
  const lineas = Array.from({ length: 21 }, (_, i) => 100 + i * 50)
  const numeros = [10, 20, 30, 40, 50, 40, 30, 20, 10]
  return (
    <g>
      <rect width={ANCHO} height={ALTO} fill="#236B2C" />
      {[0, 2, 4, 6, 8].map(k => <rect key={k} x={100 + k * 100 + 100} y="0" width="100" height={ALTO} fill="#1E5E26" />)}
      <rect width="100" height={ALTO} fill="#4F2683" />
      <rect x="1100" width="100" height={ALTO} fill="#AA0000" />
      <text x="50" y={ALTO / 2} fill="#FFC62F" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="40" textAnchor="middle" transform={`rotate(-90 50 ${ALTO / 2})`} letterSpacing="8">VIKINGS</text>
      <text x="1150" y={ALTO / 2} fill="#B3995D" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="40" textAnchor="middle" transform={`rotate(90 1150 ${ALTO / 2})`} letterSpacing="8">49ERS</text>
      <g stroke="#fff" strokeOpacity=".85">
        <rect x="2" y="2" width={ANCHO - 4} height={ALTO - 4} fill="none" strokeWidth="4" />
        {lineas.map(x => <line key={x} x1={x} x2={x} y1="0" y2={ALTO} strokeWidth={x === 100 || x === 1100 ? 4 : x % 100 === 0 ? 2 : 1} strokeOpacity={x % 100 === 0 ? 0.85 : 0.5} />)}
        {/* Hash marks y marcas de cada yarda en bandas laterales */}
        {Array.from({ length: 99 }, (_, i) => 110 + i * 10).filter(x => x % 50 !== 0).map(x => (
          <g key={x} strokeWidth="1.5" strokeOpacity=".7">
            <line x1={x} x2={x} y1="4" y2="14" /><line x1={x} x2={x} y1={ALTO - 14} y2={ALTO - 4} />
            <line x1={x} x2={x} y1="231" y2="241" /><line x1={x} x2={x} y1="292" y2="302" />
          </g>
        ))}
      </g>
      <g fill="#fff" fillOpacity=".85" fontFamily="Barlow Condensed, sans-serif" fontWeight="700" fontSize="28" textAnchor="middle">
        {numeros.map((n, k) => <g key={k}><text x={200 + k * 100} y="80">{n}</text><text x={200 + k * 100} y={ALTO - 60} transform={`rotate(180 ${200 + k * 100} ${ALTO - 69})`}>{n}</text></g>)}
      </g>
      <g transform={`translate(600 ${ALTO / 2})`} opacity=".9">
        <circle r="46" fill="#013369" stroke="#fff" strokeWidth="3" />
        <text y="-3" textAnchor="middle" fill="#fff" fontFamily="Barlow Condensed, sans-serif" fontWeight="800" fontSize="17">GRIDIRON MX</text>
        <text y="16" textAnchor="middle" fill="#FFC62F" fontFamily="monospace" fontWeight="700" fontSize="11">CDMX 2026</text>
      </g>
    </g>
  )
}

export function CampoFutbol({ datos, zonas }: { datos: DatosCampo; zonas: Record<string, Zona[]> }) {
  const [unidad, setUnidad] = useState<'ofensiva' | 'defensiva' | 'especiales'>('ofensiva')
  const [vista, setVista] = useState<'MIN' | 'SF' | 'ambos'>('ambos')
  const [ofe, setOfe] = useState('shotgun')
  const [def, setDef] = useState('nickel')
  const [calor, setCalor] = useState(false)
  const [elegido, setElegido] = useState<Nodo | null>(null)

  // En "ambos": la unidad se interpreta desde los Vikings (ofensiva = MIN ataca vs. defensa SF).
  const ataca: Equipo = vista === 'ambos' ? (unidad === 'defensiva' ? 'SF' : 'MIN') : vista
  const defiende: Equipo = ataca === 'MIN' ? 'SF' : 'MIN'
  const fOfe = unidad === 'especiales' ? ESPECIALES_PATEA : OFENSIVAS.find(f => f.id === ofe)!
  const fDef = unidad === 'especiales' ? ESPECIALES_REGRESA : DEFENSIVAS.find(f => f.id === def)!

  const lista = useMemo(() => {
    const r: Nodo[] = []
    if (vista === 'ambos') { r.push(...ubicar(fOfe, ataca, datos), ...ubicar(fDef, defiende, datos)) }
    else if (unidad === 'defensiva') r.push(...ubicar(fDef, vista, datos))
    else r.push(...ubicar(fOfe, vista, datos))
    return r
  }, [vista, unidad, fOfe, fDef, ataca, defiende, datos])

  const zonasEq = zonas[ataca] ?? []
  const maxYpa = Math.max(1, ...zonasEq.map(z => z.yardas_por_intento || 0))
  const usos = datos.uso_formaciones[ataca] ?? []
  const sel = 'campo-form w-auto min-h-[44px] py-2 text-sm font-semibold'

  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <div className="space-y-3 xl:col-span-8">
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="unidad">Unidad</label>
          <select id="unidad" className={sel} value={unidad} onChange={e => setUnidad(e.target.value as typeof unidad)}>
            <option value="ofensiva">Unidad: Ofensiva</option><option value="defensiva">Unidad: Defensiva</option><option value="especiales">Unidad: Equipos especiales</option>
          </select>
          <label className="sr-only" htmlFor="vista">Equipo</label>
          <select id="vista" className={sel} value={vista} onChange={e => setVista(e.target.value as typeof vista)}>
            <option value="ambos">Ambos enfrentados</option><option value="MIN">Solo Vikings</option><option value="SF">Solo 49ers</option>
          </select>
          {unidad !== 'especiales' && (vista === 'ambos' || unidad === 'ofensiva') && (
            <><label className="sr-only" htmlFor="f-ofe">Formación ofensiva</label>
              <select id="f-ofe" className={sel} value={ofe} onChange={e => setOfe(e.target.value)}>{OFENSIVAS.map(f => <option key={f.id} value={f.id}>Ataque: {f.nombre}</option>)}</select></>
          )}
          {unidad !== 'especiales' && (vista === 'ambos' || unidad === 'defensiva') && (
            <><label className="sr-only" htmlFor="f-def">Formación defensiva</label>
              <select id="f-def" className={sel} value={def} onChange={e => setDef(e.target.value)}>{DEFENSIVAS.map(f => <option key={f.id} value={f.id}>Defensa: {f.nombre}</option>)}</select></>
          )}
          <button className={calor ? 'btn-rojo text-sm' : 'btn-claro text-sm'} aria-pressed={calor} onClick={() => setCalor(c => !c)}>
            <span aria-hidden>🔥</span> Mapa de calor: {calor ? 'visible' : 'oculto'}
          </button>
        </div>
        <p className="text-sm font-semibold text-nfl-navy">
          {vista === 'ambos' ? `${COLOR_EQUIPO[ataca].nombre} atacan → contra la defensa de los ${COLOR_EQUIPO[defiende].nombre}` : `${COLOR_EQUIPO[vista].nombre}: unidad ${unidad}`}
          {unidad !== 'especiales' && <span className="font-normal text-slate-600"> · {fOfe.descripcion}</span>}
        </p>

        <div className="overflow-x-auto rounded-2xl border-2 border-nfl-navy">
          <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="block h-auto w-full min-w-[640px] select-none" role="img"
            aria-label={`Campo de fútbol americano con ${lista.length} jugadores. ${vista === 'ambos' ? `${COLOR_EQUIPO[ataca].nombre} en ataque contra ${COLOR_EQUIPO[defiende].nombre}.` : ''}`}>
            <Cesped />
            {calor && unidad !== 'especiales' && (
              <g aria-hidden>
                {zonasEq.map(z => {
                  const x = LOS + (z.profundidad === 'corto' ? 0 : 150)
                  const w = z.profundidad === 'corto' ? 150 : 250
                  const y = z.lado === 'izquierda' ? 0 : z.lado === 'centro' ? ALTO / 3 : (2 * ALTO) / 3
                  const a = 0.15 + 0.55 * ((z.yardas_por_intento || 0) / maxYpa)
                  return (
                    <g key={`${z.profundidad}${z.lado}`}>
                      <rect x={x} y={y} width={w} height={ALTO / 3} fill="#D50A0A" fillOpacity={a} stroke="#fff" strokeOpacity=".4" strokeDasharray="6 6" />
                      <text x={x + w / 2} y={y + ALTO / 6 - 4} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800" fontFamily="monospace">{(z.yardas_por_intento || 0).toFixed(1)} yds</text>
                      <text x={x + w / 2} y={y + ALTO / 6 + 14} textAnchor="middle" fill="#fff" fontSize="11" fontFamily="monospace">{z.profundidad} · {z.lado} · {z.intentos} pases</text>
                    </g>
                  )
                })}
              </g>
            )}
            <line x1={LOS} x2={LOS} y1="0" y2={ALTO} stroke="#38BDF8" strokeWidth="3" strokeDasharray="10 6" />
            <text x={LOS - 8} y="28" textAnchor="end" fill="#E0F2FE" fontSize="13" fontFamily="monospace">Línea de golpeo</text>
            {lista.map(n => {
              const c = COLOR_EQUIPO[n.equipo]
              const activo = elegido?.key === n.key
              return (
                <g key={n.key} className="nodo-jugador" style={{ transform: `translate(${n.x}px, ${n.y}px)` }} tabIndex={0} role="button"
                  aria-label={`${n.nombre}, ${n.etiqueta}, ${c.nombre}`} onClick={() => setElegido(n)} onMouseEnter={() => setElegido(n)} onFocus={() => setElegido(n)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setElegido(n) } }}>
                  {n.equipo === 'MIN' ? <circle r="17" fill={c.base} stroke={activo ? '#fff' : c.acento} strokeWidth="3" />
                    : <rect x="-16" y="-16" width="32" height="32" rx="6" fill={c.base} stroke={activo ? '#fff' : c.acento} strokeWidth="3" />}
                  <text y="5" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="800" fontFamily="Inter, sans-serif">{n.etiqueta}</text>
                  <title>{`${n.nombre} (${n.etiqueta} · ${c.nombre})${n.resumen ? ': ' + n.resumen : ''}`}</title>
                </g>
              )
            })}
          </svg>
        </div>
        <p className="text-xs text-slate-600">* {datos.nota} El mapa de calor usa la dirección de los pases del archivo (corto/profundo · izquierda/centro/derecha) del equipo que ataca.</p>
        {usos.length > 0 && <p className="text-xs text-slate-600">Formaciones más usadas por {COLOR_EQUIPO[ataca].nombre} en el archivo: {usos.slice(0, 4).map(u => `${u.formacion} ${u.uso}%`).join(' · ')}</p>}
      </div>

      <aside className="space-y-4 xl:col-span-4">
        <div className="rounded-xl border-2 border-nfl-navy bg-nfl-light p-4" aria-live="polite">
          <p className="font-mono text-[11px] font-bold uppercase text-nfl-navy">Jugador seleccionado</p>
          {elegido ? (
            <>
              <p className="mt-2 text-lg font-bold">{elegido.nombre}</p>
              <p className="text-sm text-slate-600">{elegido.etiqueta} · {COLOR_EQUIPO[elegido.equipo].nombre}</p>
              <p className="mt-2 text-sm text-slate-700"><strong>Qué hace:</strong> {ROLES[elegido.etiqueta] ?? 'Jugador de la formación.'}</p>
              {elegido.resumen && <p className="mt-1 text-sm text-slate-700"><strong>Datos del archivo:</strong> {elegido.resumen}</p>}
            </>
          ) : <p className="mt-2 text-sm text-slate-600">Pasa el cursor, toca o usa Tab sobre un jugador para ver su nombre y estadísticas.</p>}
        </div>
        <div className="space-y-2 rounded-xl border border-nfl-border bg-white p-4 text-sm">
          <p className="font-bold text-nfl-navy">Cómo leer el campo</p>
          <p className="flex items-center gap-2"><svg width="18" height="18" aria-hidden><circle cx="9" cy="9" r="7" fill="#4F2683" stroke="#FFC62F" strokeWidth="2" /></svg> Círculos: Vikings (MIN)</p>
          <p className="flex items-center gap-2"><svg width="18" height="18" aria-hidden><rect x="2" y="2" width="14" height="14" rx="3" fill="#AA0000" stroke="#B3995D" strokeWidth="2" /></svg> Cuadrados: 49ers (SF)</p>
          <p>La línea azul punteada es la <strong>línea de golpeo</strong>: ahí empieza la jugada. El ataque avanza hacia la derecha.</p>
          <ul className="grid grid-cols-1 gap-1 pt-1 text-xs text-slate-700 sm:grid-cols-2 xl:grid-cols-1">
            {['QB', 'RB', 'WR', 'TE', 'C', 'DE', 'DT', 'LB', 'CB', 'FS'].map(p => <li key={p}><strong className="font-mono">{p}</strong> · {ROLES[p]}</li>)}
          </ul>
        </div>
      </aside>
    </div>
  )
}
