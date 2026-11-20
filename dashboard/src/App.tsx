/**
 * Raíz de la aplicación. Dos portales independientes que no comparten menús ni navegación:
 *   #/apuestas, #/apuestas/login, #/apuestas/registro  -> Portal A (rol usuario)
 *   #/admin/login, #/admin/analisis                     -> Portal B (rol admin)
 * La autorización real la hace el servidor; aquí solo se elige la pantalla.
 */
import { lazy, Suspense } from 'react'
import { GlosarioModal } from './components/Experiencia'
import { Cargando, Toasts } from './components/ui'
import { ProveedorPreferencias } from './lib/preferencias'
import { useRuta } from './lib/router'

// Carga diferida: cada portal se descarga solo cuando se visita
const PortalApuestas = lazy(() => import('./app/apuestas/PortalApuestas'))
const PortalAnalisis = lazy(() => import('./app/admin/PortalAnalisis'))

function Pantalla() {
  const ruta = useRuta()
  // Login desactivado: las rutas de acceso llevan directo a su portal (cuentas demo en el servidor).
  // Las pantallas de acceso siguen en app/apuestas/Acceso.tsx y app/admin/AccesoAdmin.tsx por si se reactivan.
  return ruta.startsWith('/admin') ? <PortalAnalisis /> : <PortalApuestas />
}

export default function App() {
  return (
    <ProveedorPreferencias>
      <a href="#contenido" onClick={e => { e.preventDefault(); document.querySelector('main')?.focus() }} className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-white focus:p-3 focus:text-nfl-navy">Saltar al contenido</a>
      <Suspense fallback={<div className="min-h-screen bg-nfl-dark"><Cargando oscuro /></div>}>
        <Pantalla />
      </Suspense>
      <GlosarioModal />
      <Toasts />
    </ProveedorPreferencias>
  )
}
