/** Componentes de interfaz reutilizables en ambos portales. */
import { ReactNode, useEffect, useId, useRef, useState } from 'react'
import { GLOSARIO } from '../lib/glosario'
import { usePrefs } from '../lib/preferencias'

/** Término técnico con botón "?" que muestra una explicación corta (tooltip accesible). */
export function Termino({ id, children, oscuro = false }: { id: string; children?: ReactNode; oscuro?: boolean }) {
  const def = GLOSARIO[id]
  const [abierto, setAbierto] = useState(false)
  const tipId = useId()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  if (!def) return <>{children}</>
  return (
    <span ref={ref} className="relative inline-flex items-center gap-1">
      {children ?? def.termino}
      <button type="button" aria-label={`¿Qué es ${def.termino}?`} aria-expanded={abierto} aria-describedby={abierto ? tipId : undefined}
        onClick={e => { e.stopPropagation(); setAbierto(a => !a) }}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${oscuro ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-nfl-navy text-white hover:bg-blue-900'}`}>?</button>
      {abierto && (
        <span role="tooltip" id={tipId} className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-nfl-border bg-white p-3 text-left text-xs font-normal normal-case tracking-normal text-slate-800 shadow-xl">
          <strong className="block text-nfl-navy">{def.termino}</strong>
          {def.definicion}
        </span>
      )}
    </span>
  )
}

/** Tarjeta "En resumen": la conclusión principal del módulo en 1-2 frases. */
export function EnResumen({ icono, titulo, children, acento = 'navy' }: { icono: string; titulo: string; children: ReactNode; acento?: 'navy' | 'red' }) {
  return (
    <div className={`tarjeta flex items-start gap-3 border-l-4 p-4 ${acento === 'red' ? 'border-l-nfl-red' : 'border-l-nfl-navy'}`}>
      <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${acento === 'red' ? 'bg-nfl-red' : 'bg-nfl-navy'} text-white`}>{icono}</span>
      <div>
        <p className="text-sm font-bold text-nfl-navy">En resumen · {titulo}</p>
        <p className="mt-0.5 text-sm text-slate-700">{children}</p>
      </div>
    </div>
  )
}

/** Divulgación progresiva: lo esencial a la vista y el detalle bajo "Ver más". */
export function VerMas({ children, etiqueta = 'Ver más', abiertoInicial = false }: { children: ReactNode; etiqueta?: string; abiertoInicial?: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  useEffect(() => setAbierto(abiertoInicial), [abiertoInicial])
  return (
    <div>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(a => !a)}
        className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-nfl-navy underline-offset-4 hover:underline">
        <span aria-hidden>{abierto ? '▾' : '▸'}</span>{abierto ? 'Ver menos' : etiqueta}
      </button>
      {abierto && <div className="mt-2">{children}</div>}
    </div>
  )
}

/** Etiqueta de fuente y fecha de cada dato. */
export function Fuente({ fuente, fecha }: { fuente: string; fecha?: string }) {
  const nombre = fuente === 'archivo' ? 'Archivo /data' : fuente === 'demo' ? 'DEMOSTRACIÓN' : fuente === 'plantilla' ? 'Plantilla de formación' : fuente
  const demo = fuente === 'demo'
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] ${demo ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-nfl-border bg-nfl-light text-slate-700'}`}>
      <span aria-hidden>{demo ? '⚠' : '🗂'}</span> Fuente: {nombre}{fecha ? ` · ${fecha}` : ''}
    </span>
  )
}

export function Cargando({ texto = 'Cargando…', oscuro = false }: { texto?: string; oscuro?: boolean }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-16 ${oscuro ? 'text-blue-100' : 'text-slate-600'}`}>
      <span aria-hidden className="h-6 w-6 animate-spin rounded-full border-4 border-current border-t-transparent" />
      <span className="text-sm font-semibold">{texto}</span>
    </div>
  )
}

export function MensajeError({ texto, reintentar }: { texto: string; reintentar?: () => void }) {
  return (
    <div role="alert" className="tarjeta mx-auto my-8 max-w-lg p-6 text-center text-nfl-dark">
      <p className="text-3xl" aria-hidden>🏈</p>
      <p className="mt-2 font-bold text-nfl-navy">Algo no salió como esperábamos</p>
      <p className="mt-1 text-sm text-slate-700">{texto}</p>
      {reintentar && <button className="btn-navy mt-4" onClick={reintentar}>Intentar de nuevo</button>}
    </div>
  )
}

export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-3xl" aria-hidden>📋</p>
      <p className="mt-2 font-bold text-nfl-navy">{titulo}</p>
      <p className="mt-1 text-sm text-slate-600">{texto}</p>
    </div>
  )
}

/** Diálogo modal accesible: cierra con Escape y devuelve el foco al cerrar. */
export function Modal({ titulo, abierto, alCerrar, children, ancho = 'max-w-lg' }: { titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode; ancho?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar() }
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('keydown', esc); previo?.focus() }
  }, [abierto, alCerrar])
  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget) alCerrar() }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo}
        className={`flex max-h-[88vh] w-full ${ancho} flex-col overflow-hidden rounded-2xl border-2 border-nfl-navy bg-white text-nfl-dark shadow-2xl focus:outline-none`}>
        <div className="flex items-center justify-between gap-3 bg-nfl-navy px-5 py-4 text-white">
          <h2 className="titular text-xl">{titulo}</h2>
          <button onClick={alCerrar} className="btn-fantasma min-h-[40px] px-3 py-1.5 text-sm" aria-label="Cerrar">Cerrar ✕</button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

/** Notificaciones accesibles (sin alert()). */
export function Toasts() {
  const { toasts } = usePrefs()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-24 right-4 z-[150] flex max-w-sm flex-col gap-2 lg:bottom-6">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-bold shadow-2xl ${t.tipo === 'error' ? 'bg-nfl-red text-white' : t.tipo === 'exito' ? 'border-2 border-emerald-400 bg-nfl-navy text-white' : 'border-2 border-nfl-navy bg-white text-nfl-navy'}`}>
          <span aria-hidden>{t.tipo === 'error' ? '⚠ ' : t.tipo === 'exito' ? '✓ ' : 'ℹ '}</span>{t.texto}
        </div>
      ))}
    </div>
  )
}

/** Escudo placeholder (marca propia, sin logos oficiales). */
export function Escudo({ equipo, tam = 'md' }: { equipo: 'MIN' | 'SF'; tam?: 'sm' | 'md' | 'lg' }) {
  const t = tam === 'lg' ? 'h-24 w-24 text-3xl' : tam === 'md' ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-sm'
  const c = equipo === 'MIN' ? 'bg-vikings-purple border-vikings-gold text-vikings-gold' : 'bg-niners-red border-niners-gold text-white'
  return (
    <span role="img" aria-label={`Escudo ${equipo === 'MIN' ? 'Minnesota Vikings' : 'San Francisco 49ers'} (ilustrativo)`}
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl border-[3px] font-display font-extrabold shadow-xl ${t} ${c}`}>
      {equipo === 'MIN' ? 'MIN' : 'SF'}
    </span>
  )
}

/** Logo de la marca ficticia GRIDIRON MX. */
export function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-white bg-nfl-red shadow-md">
        <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-35 12 12)" />
          <path d="M9 15l6-6M10.5 10.5l3 3M12.5 8.5l3 3M8.5 12.5l3 3" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block font-display text-xl font-extrabold tracking-wider text-white">GRIDIRON <span className="text-red-400">MX</span></span>
        <span className="block font-mono text-[10px] uppercase tracking-widest text-blue-200">{subtitulo}</span>
      </span>
    </span>
  )
}
