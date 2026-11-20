/** Controles de experiencia: modo principiante/avanzado, tamaño de texto, glosario y tour guiado. */
import { useEffect, useMemo, useState } from 'react'
import { GLOSARIO } from '../lib/glosario'
import { usePrefs } from '../lib/preferencias'
import { Modal } from './ui'

export function ControlesExperiencia({ oscuro = true }: { oscuro?: boolean }) {
  const { principiante, alternarModo, cambiarEscala, abrirGlosario, abrirTour } = usePrefs()
  const base = oscuro ? 'border-white/25 bg-white/10 text-white hover:bg-white/20' : 'border-nfl-border bg-white text-nfl-navy hover:bg-nfl-light'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={alternarModo} role="switch" aria-checked={principiante} aria-label="Modo principiante"
        className={`flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-xs font-bold ${base}`}>
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${principiante ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {principiante ? 'Modo Principiante' : 'Modo Avanzado'}
      </button>
      <button onClick={() => abrirGlosario()} className={`min-h-[40px] rounded-full border px-3 text-xs font-bold ${base}`}><span aria-hidden>📖 </span>Glosario</button>
      <button onClick={abrirTour} className={`min-h-[40px] rounded-full border px-3 text-xs font-bold ${base}`}><span aria-hidden>🧭 </span>Tour</button>
      <span className={`flex min-h-[40px] items-center rounded-full border px-1 text-xs font-bold ${base}`} role="group" aria-label="Tamaño de texto">
        <button className="px-2 py-2" onClick={() => cambiarEscala(-1)} aria-label="Reducir texto">A−</button>
        <button className="px-2 py-2" onClick={() => cambiarEscala(0)} aria-label="Texto normal">A</button>
        <button className="px-2 py-2" onClick={() => cambiarEscala(1)} aria-label="Aumentar texto">A+</button>
      </span>
    </div>
  )
}

export function GlosarioModal() {
  const { glosarioAbierto, cerrarGlosario } = usePrefs()
  const [q, setQ] = useState('')
  useEffect(() => setQ(''), [glosarioAbierto])
  const grupos = useMemo(() => {
    const f = Object.entries(GLOSARIO).filter(([, v]) => !q || `${v.termino} ${v.definicion}`.toLowerCase().includes(q.toLowerCase()))
    return (['Juego', 'Posiciones', 'Apuestas', 'Estadísticas'] as const).map(g => [g, f.filter(([, v]) => v.grupo === g)] as const).filter(([, l]) => l.length)
  }, [q])
  return (
    <Modal titulo="Glosario para nuevos aficionados" abierto={glosarioAbierto !== null} alCerrar={cerrarGlosario} ancho="max-w-2xl">
      <label className="etiqueta" htmlFor="buscar-glosario">Buscar un término</label>
      <input id="buscar-glosario" className="campo-form mb-4" value={q} onChange={e => setQ(e.target.value)} placeholder="Ej. touchdown, spread, zona roja" />
      {grupos.length === 0 && <p className="text-sm text-slate-600">No encontramos ese término. Prueba con otra palabra.</p>}
      {grupos.map(([g, lista]) => (
        <section key={g} className="mb-4">
          <h3 className="titular mb-2 text-lg text-nfl-navy">{g}</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {lista.map(([k, v]) => (
              <div key={k} id={`glosario-${k}`} className={`rounded-xl border p-3 ${glosarioAbierto === k ? 'border-nfl-red bg-red-50' : 'border-nfl-border bg-nfl-light'}`}>
                <dt className="font-bold text-nfl-navy">{v.termino}</dt>
                <dd className="mt-1 text-sm text-slate-700">{v.definicion}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Modal>
  )
}

export type PasoTour = { titulo: string; texto: string; icono: string }

export function Tour({ pasos }: { pasos: PasoTour[] }) {
  const { tourAbierto, cerrarTour } = usePrefs()
  const [i, setI] = useState(0)
  useEffect(() => { if (tourAbierto) setI(0) }, [tourAbierto])
  const p = pasos[i]
  return (
    <Modal titulo={`Guía rápida · Paso ${i + 1} de ${pasos.length}`} abierto={tourAbierto} alCerrar={cerrarTour}>
      <p className="text-4xl" aria-hidden>{p.icono}</p>
      <h3 className="titular mt-2 text-2xl text-nfl-navy">{p.titulo}</h3>
      <p className="mt-2 text-slate-700">{p.texto}</p>
      <div className="mt-6 flex items-center justify-between gap-2">
        <button className="btn-claro" onClick={cerrarTour}>Omitir</button>
        <span className="flex gap-1.5" aria-hidden>{pasos.map((_, k) => <span key={k} className={`h-2.5 w-2.5 rounded-full ${k === i ? 'bg-nfl-red' : 'bg-slate-300'}`} />)}</span>
        <span className="flex gap-2">
          <button className="btn-claro" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
          <button className="btn-rojo" onClick={() => (i === pasos.length - 1 ? cerrarTour() : setI(i + 1))}>{i === pasos.length - 1 ? '¡Listo!' : 'Siguiente'}</button>
        </span>
      </div>
    </Modal>
  )
}

/** Sección "Lo básico del juego" con infografías sencillas en SVG. */
export function LoBasico() {
  const tarjetas = [
    { n: 1, t: 'El objetivo', d: 'Cada equipo intenta llevar el balón a la zona de anotación del rival, corriendo o lanzando pases.',
      svg: <svg viewBox="0 0 120 50" className="h-16 w-full" aria-hidden><rect width="120" height="50" rx="6" fill="#1e5e26" /><rect width="14" height="50" fill="#4F2683" /><rect x="106" width="14" height="50" fill="#AA0000" />{[28, 46, 60, 74, 92].map(x => <line key={x} x1={x} x2={x} y1="0" y2="50" stroke="#fff" strokeOpacity=".5" />)}<path d="M30 25h66" stroke="#FFC62F" strokeWidth="3" markerEnd="url(#fl)" /><defs><marker id="fl" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#FFC62F" /></marker></defs></svg> },
    { n: 2, t: 'Los 4 downs', d: 'El ataque tiene 4 intentos para avanzar 10 yardas. Si lo logra, gana otros 4 intentos.',
      svg: <svg viewBox="0 0 120 50" className="h-16 w-full" aria-hidden>{[0, 1, 2, 3].map(k => <g key={k}><rect x={6 + k * 28} y="12" width="24" height="26" rx="5" fill={k === 3 ? '#D50A0A' : '#013369'} /><text x={18 + k * 28} y="31" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">{k + 1}</text></g>)}</svg> },
    { n: 3, t: 'Los puntos', d: 'Touchdown: 6 puntos (+1 con la patada extra). Gol de campo: 3 puntos. Safety: 2 puntos.',
      svg: <svg viewBox="0 0 120 50" className="h-16 w-full" aria-hidden>{[['TD', '6', '#D50A0A'], ['FG', '3', '#013369'], ['+1', '1', '#4b5563']].map(([a, b, c], k) => <g key={a}><circle cx={22 + k * 38} cy="25" r="18" fill={c} /><text x={22 + k * 38} y="23" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700">{a}</text><text x={22 + k * 38} y="35" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800">{b}</text></g>)}</svg> },
    { n: 4, t: 'Las posiciones', d: 'QB lanza, RB corre, WR y TE atrapan. La línea protege. La defensa intenta frenar todo eso.',
      svg: <svg viewBox="0 0 120 50" className="h-16 w-full" aria-hidden>{[['QB', 20, 32], ['RB', 20, 44], ['WR', 60, 10], ['TE', 70, 40], ['OL', 42, 26]].map(([t, x, y]) => <g key={t as string}><circle cx={x as number} cy={y as number} r="8" fill="#013369" /><text x={x as number} y={(y as number) + 3} textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700">{t}</text></g>)}<line x1="52" x2="52" y1="0" y2="50" stroke="#38BDF8" strokeDasharray="3 3" />{[[64, 26], [88, 18], [96, 36]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="7" fill="#D50A0A" />)}</svg> },
  ]
  return (
    <section id="lo-basico" aria-labelledby="titulo-basico" className="tarjeta p-6 text-nfl-dark sm:p-8">
      <p className="font-mono text-[11px] font-bold uppercase text-nfl-red">Guía visual para principiantes</p>
      <h2 id="titulo-basico" className="titular text-3xl text-nfl-navy">Lo básico del juego</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map(t => (
          <article key={t.n} className="rounded-xl border border-nfl-border bg-nfl-light p-4">
            {t.svg}
            <h3 className="mt-2 font-bold text-nfl-navy">{t.n}. {t.t}</h3>
            <p className="mt-1 text-sm text-slate-700">{t.d}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

/** Aviso legal y de juego responsable (ambos portales). */
export function AvisoLegal({ oscuro = true }: { oscuro?: boolean }) {
  return (
    <p className={`text-xs leading-relaxed ${oscuro ? 'text-blue-100' : 'text-slate-600'}`}>
      <strong>Proyecto de demostración.</strong> GRIDIRON MX es una marca ficticia sin relación con la NFL ni con sus equipos.
      No opera apuestas reales ni recibe dinero: no cuenta con permiso de la Dirección General de Juegos y Sorteos de la SEGOB.
      Solo para mayores de 18 años. Juega con responsabilidad: si sientes que pierdes el control, busca ayuda (Línea de la Vida: 800 911 2000).
    </p>
  )
}
