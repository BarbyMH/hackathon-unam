/**
 * Preferencias de experiencia compartidas: Modo Principiante/Avanzado, tamaño de texto,
 * glosario, tour y notificaciones (toasts). Se guardan en localStorage.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Toast = { id: number; texto: string; tipo: 'info' | 'exito' | 'error' }

interface Prefs {
  principiante: boolean
  alternarModo: () => void
  escala: number
  cambiarEscala: (delta: number) => void
  glosarioAbierto: string | null // null = cerrado; '' = abierto sin término; 'clave' = enfocado en un término
  abrirGlosario: (clave?: string) => void
  cerrarGlosario: () => void
  tourAbierto: boolean
  abrirTour: () => void
  cerrarTour: () => void
  toasts: Toast[]
  avisar: (texto: string, tipo?: Toast['tipo']) => void
}

const Ctx = createContext<Prefs | null>(null)
const leer = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* modo privado */ } }

export function ProveedorPreferencias({ children }: { children: ReactNode }) {
  const [principiante, setPrincipiante] = useState(leer('gmx_modo', 'principiante') === 'principiante')
  const [escala, setEscala] = useState(Number(leer('gmx_escala', '1')) || 1)
  const [glosarioAbierto, setGlosario] = useState<string | null>(null)
  const [tourAbierto, setTour] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => { document.documentElement.style.setProperty('--escala-texto', String(escala)); guardar('gmx_escala', String(escala)) }, [escala])
  useEffect(() => { guardar('gmx_modo', principiante ? 'principiante' : 'avanzado') }, [principiante])

  const avisar = useCallback((texto: string, tipo: Toast['tipo'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, texto, tipo }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }, [])

  const valor = useMemo<Prefs>(() => ({
    principiante, alternarModo: () => setPrincipiante(p => !p),
    escala, cambiarEscala: d => setEscala(e => (d === 0 ? 1 : Math.min(1.3, Math.max(0.9, +(e + d * 0.1).toFixed(1))))),
    glosarioAbierto, abrirGlosario: (c = '') => setGlosario(c), cerrarGlosario: () => setGlosario(null),
    tourAbierto, abrirTour: () => setTour(true), cerrarTour: () => setTour(false),
    toasts, avisar,
  }), [principiante, escala, glosarioAbierto, tourAbierto, toasts, avisar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function usePrefs(): Prefs {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePrefs fuera de ProveedorPreferencias')
  return c
}

/** Abre el tour la primera vez que se visita cada portal. */
export function useTourPrimeraVez(clave: string) {
  const { abrirTour } = usePrefs()
  useEffect(() => {
    if (leer(clave, '') !== 'visto') { guardar(clave, 'visto'); abrirTour() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
}
