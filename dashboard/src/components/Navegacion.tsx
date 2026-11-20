/** Barra de navegación sticky: transparente sobre el hero y azul marino sólido al hacer scroll. */
import { ReactNode, useEffect, useState } from 'react'
import { irASeccion } from '../lib/router'

export type ItemMenu = { id: string; etiqueta: string; icono: string }

export function Navegacion({ marca, items, acciones, etiqueta }: { marca: ReactNode; items: ItemMenu[]; acciones: ReactNode; etiqueta: string }) {
  const [solida, setSolida] = useState(false)
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const f = () => setSolida(window.scrollY > 40)
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  const ir = (id: string) => { setAbierto(false); irASeccion(id) }
  return (
    <header className={`no-imprimir fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${solida || abierto ? 'border-b border-white/20 bg-nfl-navy shadow-xl' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-[1520px] items-center justify-between gap-3 px-4 sm:px-6">
        <button onClick={() => ir('hero')} aria-label="Ir al inicio">{marca}</button>
        <nav aria-label={etiqueta} className="hidden items-center gap-1 lg:flex">
          {items.slice(0, 5).map(i => (
            <button key={i.id} onClick={() => ir(i.id)} className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white hover:bg-white/10">
              <span aria-hidden>{i.icono}</span>{i.etiqueta}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {acciones}
          <button className="btn-fantasma min-h-[44px] px-3 lg:hidden" aria-expanded={abierto} aria-controls="menu-movil" onClick={() => setAbierto(a => !a)}>
            <span aria-hidden>☰</span><span className="sr-only">Menú</span>
          </button>
        </div>
      </div>
      {abierto && (
        <nav id="menu-movil" aria-label={etiqueta} className="grid grid-cols-2 gap-2 border-t border-white/15 bg-nfl-navy p-3 lg:hidden">
          {items.slice(0, 5).map(i => (
            <button key={i.id} onClick={() => ir(i.id)} className="flex min-h-[48px] items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold text-white">
              <span aria-hidden className="text-lg">{i.icono}</span>{i.etiqueta}
            </button>
          ))}
        </nav>
      )}
    </header>
  )
}
