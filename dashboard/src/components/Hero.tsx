/**
 * Hero full-bleed (100vw × 100svh). El fondo es un estadio nocturno generado en <canvas>
 * (placeholder propio, libre de derechos) con overlay azul marino para legibilidad.
 * Si existe dashboard/public/hero.mp4 se puede activar con la prop `video`.
 */
import { useEffect, useRef, useState } from 'react'
import { EVENTO } from '../lib/evento'
import { irASeccion } from '../lib/router'
import { Escudo } from './ui'

function useCuentaRegresiva(objetivo: Date) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t) }, [])
  const dif = Math.max(0, objetivo.getTime() - ahora)
  return { dias: Math.floor(dif / 864e5), horas: Math.floor(dif / 36e5) % 24, min: Math.floor(dif / 6e4) % 60, seg: Math.floor(dif / 1e3) % 60, termino: dif === 0 }
}

function FondoEstadio() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const dibujar = (t: number) => {
      const w = (c.width = c.offsetWidth), h = (c.height = c.offsetHeight)
      ctx.fillStyle = '#001A38'; ctx.fillRect(0, 0, w, h)
      // Reflectores que respiran lentamente
      const pulso = reducir ? 0.4 : 0.35 + 0.08 * Math.sin(t / 1400)
      for (const [x, color] of [[0.18, '79,38,131'], [0.82, '213,10,10'], [0.5, '255,255,255']] as const) {
        const g = ctx.createRadialGradient(w * x, h * 0.05, 5, w * x, h * 0.05, w * 0.5)
        g.addColorStop(0, `rgba(${color},${x === 0.5 ? pulso * 0.35 : pulso})`); g.addColorStop(1, 'rgba(0,26,56,0)')
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
      }
      // Gradas (puntos de luz)
      ctx.fillStyle = 'rgba(255,255,255,.18)'
      for (let i = 0; i < 160; i++) {
        const x = ((i * 97) % 1000) / 1000 * w, y = h * 0.22 + ((i * 53) % 100) / 100 * h * 0.3
        ctx.fillRect(x, y, 2, 2)
      }
      // Césped en perspectiva con líneas de yarda
      const hz = h * 0.62
      const pasto = ctx.createLinearGradient(0, hz, 0, h)
      pasto.addColorStop(0, '#0f3d1d'); pasto.addColorStop(1, '#1e5e26')
      ctx.fillStyle = pasto; ctx.beginPath(); ctx.moveTo(w * 0.2, hz); ctx.lineTo(w * 0.8, hz); ctx.lineTo(w * 1.3, h); ctx.lineTo(-w * 0.3, h); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5
      for (let i = 0; i <= 12; i++) {
        const f = i / 12
        ctx.beginPath(); ctx.moveTo(w * (0.2 + 0.6 * f), hz); ctx.lineTo(w * (-0.3 + 1.6 * f), h); ctx.stroke()
      }
      if (!reducir) raf = requestAnimationFrame(dibujar)
    }
    raf = requestAnimationFrame(dibujar)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />
}

export function Hero({ cta, destino, etiquetaScroll, video }: { cta: string; destino: string; etiquetaScroll: string; video?: string }) {
  const c = useCuentaRegresiva(EVENTO.kickoff)
  const celdas: [number, string][] = [[c.dias, 'Días'], [c.horas, 'Horas'], [c.min, 'Min'], [c.seg, 'Seg']]
  return (
    <section id="hero" aria-label="Partido Minnesota Vikings contra San Francisco 49ers" className="relative flex min-h-[100svh] w-full flex-col items-center justify-center overflow-hidden text-white">
      {video ? <video className="absolute inset-0 h-full w-full object-cover" src={video} autoPlay muted loop playsInline aria-hidden /> : <FondoEstadio />}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-nfl-dark/85 via-nfl-navy/60 to-nfl-dark" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pb-20 pt-28 text-center sm:px-6">
        <p className="mb-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/30 bg-nfl-navy/90 px-4 py-1.5 font-mono text-xs tracking-wider shadow-lg">
          <span aria-hidden className="h-2 w-2 rounded-full bg-nfl-red" /> <strong>MEXICO CITY GAME 2026</strong> <span aria-hidden className="text-blue-300">•</span> {EVENTO.detalle.toUpperCase()}
        </p>
        <div className="grid w-full grid-cols-3 items-center gap-2 sm:gap-6">
          <div className="flex flex-col items-center gap-2">
            <Escudo equipo="MIN" tam="lg" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-blue-200">Visitante</span>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="titular text-4xl leading-none sm:text-6xl md:text-7xl">
              VIKINGS <span className="block py-1 text-2xl text-red-400 sm:text-4xl">vs</span> 49ERS
            </h1>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Escudo equipo="SF" tam="lg" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-blue-200">Local designado</span>
          </div>
        </div>
        <p className="mt-6 text-lg font-semibold">Domingo 22 de noviembre de 2026 · 7:20 p.m. CDMX <span className="font-normal text-blue-200">(8:20 p.m. ET)</span></p>
        <p className="mt-1 text-sm text-blue-100">{EVENTO.sede}</p>

        <div role="timer" aria-label={`Faltan ${c.dias} días, ${c.horas} horas y ${c.min} minutos para el inicio`} className="mt-6 grid w-full max-w-md grid-cols-4 gap-2 sm:gap-3">
          {celdas.map(([v, t]) => (
            <div key={t} className="rounded-xl border border-white/25 bg-nfl-navy/90 p-2.5">
              <div className="font-mono text-2xl font-bold sm:text-3xl" aria-hidden>{String(v).padStart(2, '0')}</div>
              <div className="font-mono text-[10px] uppercase text-blue-200" aria-hidden>{t}</div>
            </div>
          ))}
        </div>
        {c.termino && <p className="mt-3 font-bold text-amber-300">¡El partido ya comenzó!</p>}

        <button onClick={() => irASeccion(destino)} className="btn-rojo mt-8 px-8 py-4 text-base uppercase tracking-wider shadow-xl">
          {cta} <span aria-hidden>↓</span>
        </button>
      </div>

      <button onClick={() => irASeccion(destino)} aria-label={etiquetaScroll} className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-blue-100 hover:text-white">
        <span className="font-mono text-[10px] uppercase tracking-widest">{etiquetaScroll}</span>
        <span className="flex h-8 w-5 justify-center rounded-full border-2 border-white/60 pt-1.5"><span className="h-1.5 w-1 animate-rueda rounded-full bg-white" /></span>
      </button>
    </section>
  )
}
