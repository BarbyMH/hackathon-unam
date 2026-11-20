/** PORTAL B · /admin/analisis · solo rol `admin`. Dashboard claro y didáctico, independiente del portal de apuestas. */
import { useCallback, useEffect, useState } from 'react'
import { api, ErrorApi } from '../../lib/api'
import { usePrefs, useTourPrimeraVez } from '../../lib/preferencias'
import { navegar } from '../../lib/router'
import { CampoFutbol } from '../../components/field/Campo'
import { AvisoLegal, ControlesExperiencia, LoBasico, Tour } from '../../components/Experiencia'
import { Hero } from '../../components/Hero'
import { Navegacion } from '../../components/Navegacion'
import { Cargando, EnResumen, Fuente, MensajeError } from '../../components/ui'
import { ModAreas } from './ModAreas'
import { ModExportar, ModGestion } from './ModGestion'
import { ModJugadas } from './ModJugadas'
import { ModProbabilidades } from './ModProbabilidades'
import { ModResumen } from './ModResumen'

const PASOS = [
  { icono: '📊', titulo: 'Panel de análisis', texto: 'Aquí ves los datos del archivo de /data convertidos en gráficas sencillas sobre Vikings y 49ers.' },
  { icono: '💡', titulo: 'Empieza por "En resumen"', texto: 'Cada módulo abre con una tarjeta con la conclusión principal en 1 o 2 frases.' },
  { icono: '🔎', titulo: 'Cada gráfica se explica sola', texto: 'Lee "Cómo leer esta gráfica" y "Lo que nos dice". El Modo Avanzado muestra tablas completas y más métricas.' },
  { icono: '🏟', titulo: 'Explora el campo', texto: 'Cambia formaciones, activa el mapa de calor y toca a los jugadores para saber qué hace cada uno.' },
]

export default function PortalAnalisis() {
  const { avisar } = usePrefs()
  const [sesion, setSesion] = useState<{ nombre: string; superadmin: boolean } | null>(null)
  const [a, setA] = useState<any>(null)
  const [externas, setExternas] = useState<any>(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setError('')
    try {
      const s = await api('auth/admin/sesion')
      setSesion(s)
      setA(await api('admin/analisis'))
      api('admin/fuentes-externas').then(setExternas).catch(() => setExternas(null))
    } catch (e) {
      const err = e as ErrorApi
      if ((err.estado === 401 || err.estado === 403) && err.redirigir) { if (err.estado === 403) avisar(err.message, 'error'); navegar(err.redirigir); return }
      setError(err.message)
    }
  }, [avisar])
  useEffect(() => { cargar() }, [cargar])
  useTourPrimeraVez('gmx_tour_admin')

  if (error) return <div className="min-h-screen bg-nfl-light pt-24"><MensajeError texto={error} reintentar={cargar} /></div>
  if (!sesion || !a) return <div className="min-h-screen bg-nfl-light"><Cargando texto="Calculando el análisis…" /></div>

  const fecha = new Date(a.dataset.cargado_en).toLocaleString('es-MX')
  return (
    <div className="min-h-screen bg-nfl-light text-nfl-dark">
      <Navegacion etiqueta="Navegación del portal de análisis"
        marca={<span className="flex items-center gap-2.5"><span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-nfl-red bg-white font-display text-lg font-extrabold text-nfl-navy">BI</span>
          <span className="leading-none"><span className="block font-display text-xl font-extrabold tracking-wider text-white">GRIDIRON <span className="text-red-300">ANALYTICS</span></span><span className="block font-mono text-[10px] uppercase tracking-widest text-blue-200">Panel de análisis · admin</span></span></span>}
        items={[{ id: 'resumen', etiqueta: 'Resumen', icono: '🏈' }, { id: 'jugadores', etiqueta: 'Jugadores', icono: '⭐' }, { id: 'campo', etiqueta: 'Campo', icono: '🏟' }, { id: 'probabilidades', etiqueta: 'Probabilidades', icono: '🎯' }, { id: 'gestion', etiqueta: 'Gestión', icono: '⚙' }]}
        acciones={<button onClick={() => navegar('/apuestas')} className="btn-rojo min-h-[44px] px-3 text-sm"><span aria-hidden>🎟</span> Ir a apuestas</button>} />
      <div className="no-imprimir"><Hero cta="Ver análisis" destino="analisis" etiquetaScroll="Explorar datos" /></div>
      <Tour pasos={PASOS} />

      <main id="analisis" tabIndex={-1} className="mx-auto max-w-[1560px] scroll-mt-20 space-y-10 px-4 py-8 sm:px-6">
        <div className="tarjeta no-imprimir flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold text-white ${a.dataset.es_demo ? 'bg-amber-600' : 'bg-nfl-navy'}`}>{a.dataset.es_demo ? '⚠ DATOS DE DEMOSTRACIÓN' : '✓ DATASET VALIDADO'}</span>
              <span>Datos de {a.dataset.temporada}</span><Fuente fuente={a.dataset.fuente} fecha={fecha} />
            </p>
            {a.dataset.es_demo && <p className="font-semibold text-nfl-red">No se encontró un archivo válido en /data. Revisa la sección Gestión.</p>}
            {externas?.discrepancias?.map((d: string) => <p key={d} className="text-amber-900">⚠ Discrepancia: {d}</p>)}
          </div>
          <ControlesExperiencia oscuro={false} />
        </div>

        <ModResumen a={a} externas={externas} />
        <ModJugadas a={a} />
        <ModAreas a={a} />

        <section id="campo" aria-labelledby="t-campo" className="scroll-mt-20 space-y-4">
          <h2 id="t-campo" className="titular text-3xl text-nfl-navy">5 · Campo y distribución de jugadores</h2>
          <EnResumen icono="🏟" titulo="Así se acomodan en el campo" acento="red">En cada jugada hay 11 jugadores por equipo. Cambia la formación para ver cómo se mueven y activa el mapa de calor para ver hacia dónde gana más yardas cada ataque.</EnResumen>
          <div className="tarjeta p-5"><div className="mb-3"><Fuente fuente={a.campo.fuente} /></div>
            <CampoFutbol datos={a.campo} zonas={{ MIN: a.estadisticas.MIN.zonas_pase, SF: a.estadisticas.SF.zonas_pase }} /></div>
        </section>

        <ModProbabilidades a={a} />
        <ModExportar />
        <ModGestion superadmin={sesion.superadmin} alCambiarDatos={() => api('admin/analisis').then(setA).catch(() => null)} />
        <div className="no-imprimir"><LoBasico /></div>
      </main>
      <footer className="bg-nfl-navy text-white"><div className="mx-auto max-w-[1560px] px-4 py-8 sm:px-6"><p className="font-display text-lg font-bold">GRIDIRON ANALYTICS // CDMX 2026 · Portal administrativo</p><div className="mt-2"><AvisoLegal /></div></div></footer>
    </div>
  )
}
