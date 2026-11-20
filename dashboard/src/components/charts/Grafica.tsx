/**
 * Contenedor de gráficas didácticas: título claro, "Cómo leer esta gráfica", conclusión automática
 * ("Lo que nos dice"), fuente y una tabla de datos como texto alternativo (accesibilidad).
 */
import { ReactNode } from 'react'
import { Fuente } from '../ui'

export const COLORES = { MIN: '#4F2683', SF: '#AA0000', MIN_ACENTO: '#FFC62F', SF_ACENTO: '#B3995D' }
export const EJE = { fontSize: 12, fill: '#334155' }

/** Patrón de rayas para SF: los equipos se distinguen por color Y por textura. */
export function DefsPatrones() {
  return (
    <defs>
      <pattern id="rayas-sf" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill={COLORES.SF} />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#ffffff" strokeOpacity=".35" strokeWidth="3" />
      </pattern>
    </defs>
  )
}
export const RELLENO = { MIN: COLORES.MIN, SF: 'url(#rayas-sf)' }

export type Tabla = { columnas: string[]; filas: (string | number | null | undefined)[][] }

export function TablaDatos({ tabla, visible }: { tabla: Tabla; visible: boolean }) {
  return (
    <div className={visible ? 'mt-3 overflow-x-auto' : 'sr-only'}>
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr className="border-b-2 border-nfl-navy font-mono text-[11px] uppercase text-nfl-navy">{tabla.columnas.map(c => <th key={c} scope="col" className="px-2 py-2">{c}</th>)}</tr></thead>
        <tbody className="divide-y divide-nfl-border">{tabla.filas.map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j} className={`px-2 py-1.5 ${j ? 'font-mono' : 'font-semibold'}`}>{v ?? '—'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function Grafica({ titulo, comoLeer, loQueDice, fuente, alto = 280, tabla, mostrarTabla = false, controles, children }: {
  titulo: string; comoLeer: string; loQueDice: ReactNode; fuente: string; alto?: number; tabla?: Tabla; mostrarTabla?: boolean; controles?: ReactNode; children: ReactNode
}) {
  return (
    <figure className="tarjeta flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <figcaption className="titular text-xl text-nfl-navy">{titulo}</figcaption>
        <Fuente fuente={fuente} />
      </div>
      <p className="mt-1 text-sm text-slate-600"><strong>Cómo leer esta gráfica:</strong> {comoLeer}</p>
      {controles && <div className="mt-3">{controles}</div>}
      <div className="mt-3 w-full" style={{ height: alto }} role="img" aria-label={`${titulo}. ${comoLeer}`}>{children}</div>
      <p className="mt-3 rounded-xl bg-nfl-light p-3 text-sm text-slate-800"><span aria-hidden>🔎 </span><strong>Lo que nos dice:</strong> {loQueDice}</p>
      {tabla && <TablaDatos tabla={tabla} visible={mostrarTabla} />}
    </figure>
  )
}

/** Leyenda propia con forma + texto (no depende solo del color). */
export function LeyendaEquipos() {
  return (
    <div className="flex flex-wrap gap-4 text-sm font-semibold text-nfl-dark">
      <span className="flex items-center gap-1.5"><span aria-hidden className="h-4 w-4 rounded-sm" style={{ background: COLORES.MIN }} />● Vikings (MIN)</span>
      <span className="flex items-center gap-1.5"><span aria-hidden className="h-4 w-4 rounded-sm" style={{ background: `repeating-linear-gradient(45deg, ${COLORES.SF}, ${COLORES.SF} 3px, #e9a3a3 3px, #e9a3a3 5px)` }} />▲ 49ers (SF)</span>
    </div>
  )
}
