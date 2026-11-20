/**
 * Enrutador mínimo por hash (#/apuestas, #/admin/analisis...).
 * Se usa hash porque la app se publica en una subruta y el servidor solo sirve index.html en la raíz.
 */
import { useEffect, useState } from 'react'

export type Ruta = '/apuestas' | '/apuestas/login' | '/apuestas/registro' | '/admin/login' | '/admin/analisis'
const RUTAS: Ruta[] = ['/apuestas', '/apuestas/login', '/apuestas/registro', '/admin/login', '/admin/analisis']

export function rutaActual(): Ruta {
  const h = window.location.hash.replace(/^#/, '').split('?')[0] || '/apuestas'
  if (h === '/admin' || h === '/admin/') return '/admin/analisis'
  return (RUTAS as string[]).includes(h) ? (h as Ruta) : '/apuestas'
}

export function navegar(ruta: string) {
  if (window.location.hash !== `#${ruta}`) window.location.hash = ruta
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState<Ruta>(rutaActual())
  useEffect(() => {
    const cambio = () => { setRuta(rutaActual()); window.scrollTo({ top: 0 }) }
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])
  return ruta
}

/** Desplazamiento suave a una sección sin cambiar el hash de la ruta. */
export function irASeccion(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
