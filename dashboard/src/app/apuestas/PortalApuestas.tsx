/** PORTAL A · /apuestas · solo rol `usuario`. No muestra análisis ni predicciones del portal admin. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ErrorApi } from '../../lib/api'
import { AYUDA_FORMATO, FormatoCuota, pesos } from '../../lib/cuotas'
import { usePrefs, useTourPrimeraVez } from '../../lib/preferencias'
import { navegar } from '../../lib/router'
import { AvisoLegal, ControlesExperiencia, LoBasico, Tour } from '../../components/Experiencia'
import { Hero } from '../../components/Hero'
import { Navegacion } from '../../components/Navegacion'
import { Cargando, EnResumen, Marca, MensajeError, Modal } from '../../components/ui'
import { Boleto } from './Boleto'
import { TarjetaMercado } from './Mercados'
import { PanelUsuario } from './PanelUsuario'
import type { Cuenta, Mercado, Seleccion } from './tipos'

const CATEGORIAS = [
  { id: 'principales', titulo: 'Mercados principales', icono: '🏈' },
  { id: 'mitades', titulo: 'Mitades, cuartos y touchdowns', icono: '⏱' },
  { id: 'props', titulo: 'Props de jugadores', icono: '👤' },
  { id: 'especiales', titulo: 'Apuestas especiales', icono: '★' },
]

const PASOS_TOUR = [
  { icono: '🏟', titulo: 'Un solo partido', texto: 'Todo aquí gira en torno a Vikings vs. 49ers, el 22 de noviembre de 2026 en el Estadio Banorte.' },
  { icono: '👆', titulo: 'Elige un pronóstico', texto: 'Toca cualquier botón con número (la cuota). Se añade a tu boleto de apuestas.' },
  { icono: '🧾', titulo: 'Revisa tu boleto', texto: 'Escribe cuánto crédito ficticio quieres usar y verás cuánto ganarías si aciertas.' },
  { icono: '❓', titulo: '¿Dudas con algún término?', texto: 'Toca el botón "?" junto a cualquier palabra técnica o abre el Glosario. El Modo Principiante explica cada mercado.' },
]

export default function PortalApuestas() {
  const { avisar } = usePrefs()
  const [sesion, setSesion] = useState<{ nombre: string } | null>(null)
  const [error, setError] = useState('')
  const [mercados, setMercados] = useState<Mercado[]>([])
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [seleccion, setSeleccion] = useState<Seleccion[]>([])
  const [monto, setMonto] = useState(100)
  const [formato, setFormato] = useState<FormatoCuota>('americana')
  const [enviando, setEnviando] = useState(false)
  const [cajon, setCajon] = useState(false)
  const [legal, setLegal] = useState(false)
  const pasoAnterior = useRef(-1)

  // Guarda de ruta: el servidor decide (401 -> login; 403 -> portal correcto)
  const manejarAuth = useCallback((e: unknown) => {
    const err = e as ErrorApi
    if ((err.estado === 401 || err.estado === 403) && err.redirigir) {
      if (err.estado === 403) avisar(err.message, 'error')
      navegar(err.redirigir); return true
    }
    return false
  }, [avisar])

  const cargar = useCallback(async () => {
    setError('')
    try {
      const s = await api('auth/usuario/sesion')
      setSesion(s)
      const [m, c] = await Promise.all([api('apuestas/mercados'), api<Cuenta>('apuestas/cuenta')])
      setMercados(m.mercados); setCuenta(c); pasoAnterior.current = m.paso
    } catch (e) { if (!manejarAuth(e)) setError((e as ErrorApi).message) }
  }, [manejarAuth])
  useEffect(() => { cargar() }, [cargar])
  useTourPrimeraVez('gmx_tour_apuestas')

  // Cuotas simuladas "en vivo": consulta cada 4 s y actualiza las cuotas del boleto
  useEffect(() => {
    if (!sesion) return
    const t = setInterval(async () => {
      try {
        const m = await api('apuestas/mercados')
        if (m.paso === pasoAnterior.current) return
        pasoAnterior.current = m.paso
        setMercados(m.mercados)
        const cuotas = new Map<string, number>(m.mercados.flatMap((x: Mercado) => x.opciones.map(o => [o.id, o.cuota] as [string, number])))
        setSeleccion(sel => sel.map(s => ({ ...s, cuota: cuotas.get(s.id) ?? s.cuota })))
      } catch (e) { manejarAuth(e) }
    }, 4000)
    return () => clearInterval(t)
  }, [sesion, manejarAuth])

  const alternar = (m: Mercado, opcionId: string) => {
    const o = m.opciones.find(x => x.id === opcionId)!
    setSeleccion(sel => sel.some(s => s.id === opcionId) ? sel.filter(s => s.id !== opcionId)
      : [...sel.filter(s => s.mercadoId !== m.id), { id: o.id, mercadoId: m.id, mercado: m.titulo, etiqueta: o.etiqueta, cuota: o.cuota }])
  }

  const enviarBoleto = async (sel: Seleccion[], montoBoleto: number) => {
    setEnviando(true)
    try {
      const r = await api('apuestas/boleto', { portal: 'usuario', cuerpo: { selecciones: sel.map(s => s.id), monto: montoBoleto, cuotas_vistas: Object.fromEntries(sel.map(s => [s.id, s.cuota])) } })
      setCuenta(r.cuenta); setSeleccion([]); setCajon(false); avisar(`Apuesta ${r.apuesta_id} registrada (demostración).`, 'exito')
    } catch (e) {
      const err = e as ErrorApi
      if (err.estado === 409) {
        const nuevas = (err.datos as any)?.cuotas ?? {}
        setSeleccion(s => s.map(x => ({ ...x, cuota: nuevas[x.id] ?? x.cuota })))
        avisar('La cuota cambió. Revisa el boleto y confirma de nuevo.', 'info')
      } else if (!manejarAuth(e)) avisar(err.message, 'error')
    } finally { setEnviando(false) }
  }

  const salir = async () => { await api('auth/usuario/logout', { metodo: 'POST' }).catch(() => null); navegar('/apuestas/login') }

  if (error) return <div className="min-h-screen bg-nfl-dark pt-24"><MensajeError texto={error} reintentar={cargar} /></div>
  if (!sesion || !cuenta) return <div className="min-h-screen bg-nfl-dark"><Cargando texto="Preparando el partido…" oscuro /></div>

  const bloqueado = cuenta.autoexcluido_hasta ? 'Tu autoexclusión está activa. Las apuestas están bloqueadas.' : null
  const boleto = (
    <Boleto seleccion={seleccion} quitar={id => setSeleccion(s => s.filter(x => x.id !== id))} limpiar={() => setSeleccion([])}
      monto={monto} setMonto={setMonto} formato={formato} confirmar={() => enviarBoleto(seleccion, monto)} enviando={enviando}
      abiertas={cuenta.apuestas} mercados={mercados} bloqueado={bloqueado}
      rapida={(m, id, mm) => { const o = m.opciones.find(x => x.id === id)!; enviarBoleto([{ id, mercadoId: m.id, mercado: m.titulo, etiqueta: o.etiqueta, cuota: o.cuota }], mm) }} />
  )

  return (
    <div className="min-h-screen bg-nfl-dark text-white">
      <Navegacion etiqueta="Navegación del portal de apuestas" marca={<Marca subtitulo="CDMX 2026 · Partido único" />}
        items={[{ id: 'principales', etiqueta: 'Mercados', icono: '🏈' }, { id: 'props', etiqueta: 'Jugadores', icono: '👤' }, { id: 'especiales', etiqueta: 'Especiales', icono: '★' }, { id: 'lo-basico', etiqueta: 'Lo básico', icono: '📘' }, { id: 'mi-cuenta', etiqueta: 'Mi cuenta', icono: '💳' }]}
        acciones={<>
          <span className="hidden rounded-lg border border-white/30 bg-nfl-navy px-3 py-1.5 text-right sm:block"><span className="block text-[10px] text-blue-200">Saldo demo</span><span className="font-mono text-sm font-bold">{pesos(cuenta.saldo)}</span></span>
          <button onClick={salir} className="btn-fantasma min-h-[44px] px-3 text-sm">Salir</button>
        </>} />

      <Hero cta="Apostar ahora" destino="mercados" etiquetaScroll="Ver mercados" />
      <Tour pasos={PASOS_TOUR} />

      <main id="mercados" tabIndex={-1} className="mx-auto max-w-[1520px] scroll-mt-20 space-y-8 px-4 pb-32 pt-8 sm:px-6 lg:pb-12">
        <div className="flex flex-col gap-3 rounded-xl border-l-4 border-nfl-red bg-nfl-navy p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm"><span className="mr-2 rounded bg-nfl-red px-2 py-0.5 font-mono text-xs font-bold">DEMOSTRACIÓN</span>Las cuotas son <strong>datos simulados</strong> que cambian cada pocos segundos. No es dinero real ni un operador autorizado.</p>
          <ControlesExperiencia />
        </div>
        <EnResumen icono="💡" titulo="¿Cómo funciona esta página?">1) Toca una cuota para elegir tu pronóstico. 2) Revisa el boleto. 3) Escribe un monto ficticio y confirma.</EnResumen>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          <aside className="space-y-4 lg:sticky lg:top-20 lg:col-span-3 xl:col-span-2" aria-label="Enlaces rápidos">
            <nav className="rounded-xl border border-white/20 bg-nfl-navy p-3">
              <p className="mb-2 border-b border-white/15 px-2 pb-2 font-mono text-[11px] uppercase text-blue-200">Tipos de apuesta</p>
              {CATEGORIAS.map(c => <a key={c.id} href={`#/apuestas`} onClick={e => { e.preventDefault(); document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth' }) }}
                className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-white/10"><span aria-hidden>{c.icono}</span>{c.titulo}</a>)}
            </nav>
            <div className="rounded-xl border border-white/20 bg-nfl-navy p-3">
              <p className="mb-2 font-mono text-[11px] uppercase text-blue-200">Formato de cuota</p>
              <div role="radiogroup" aria-label="Formato de cuota" className="grid grid-cols-3 gap-1">
                {(['americana', 'decimal', 'fraccional'] as FormatoCuota[]).map(f => (
                  <button key={f} role="radio" aria-checked={formato === f} title={AYUDA_FORMATO[f]} onClick={() => setFormato(f)}
                    className={`min-h-[40px] rounded-lg font-mono text-xs font-bold ${formato === f ? 'bg-nfl-red' : 'bg-white/10 hover:bg-white/20'}`}>{f === 'americana' ? 'US' : f === 'decimal' ? 'DEC' : 'FRAC'}</button>))}
              </div>
              <p className="mt-2 text-xs text-blue-100">{AYUDA_FORMATO[formato]}</p>
            </div>
          </aside>

          <div className="space-y-8 lg:col-span-6 xl:col-span-7">
            {CATEGORIAS.map(c => (
              <section key={c.id} id={c.id} aria-labelledby={`t-${c.id}`} className="scroll-mt-20 space-y-3">
                <h2 id={`t-${c.id}`} className="titular text-2xl"><span aria-hidden>{c.icono} </span>{c.titulo}</h2>
                {c.id === 'especiales' && <p className="text-sm text-blue-100">Combina selecciones de mercados distintos en el boleto para crear una <strong>combinada (parlay)</strong>, o usa la pestaña <strong>Apuesta rápida</strong>.</p>}
                {mercados.filter(m => m.cat === c.id).map(m => <TarjetaMercado key={m.id} m={m} formato={formato} seleccion={seleccion} alternar={alternar} />)}
              </section>
            ))}
          </div>

          <aside className="hidden lg:sticky lg:top-20 lg:col-span-3 lg:block" aria-label="Boleto de apuestas">{boleto}</aside>
        </div>

        <LoBasico />
        <PanelUsuario cuenta={cuenta} actualizar={setCuenta} />
      </main>

      {/* Boleto en móvil: barra inferior + cajón */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-nfl-red bg-nfl-navy px-4 py-3 lg:hidden">
        <button onClick={() => setCajon(true)} className="flex w-full items-center justify-between" aria-haspopup="dialog">
          <span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-nfl-red font-mono font-bold">{seleccion.length}</span><span className="text-left text-sm font-bold">Boleto de apuestas<span className="block text-xs font-normal text-blue-200">{seleccion.length ? 'Toca para revisar' : 'Toca una cuota para añadir'}</span></span></span>
          <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-nfl-navy">Abrir ▲</span>
        </button>
      </div>
      {cajon && (
        <div className="fixed inset-0 z-[95] flex items-end bg-black/70 lg:hidden" onMouseDown={e => { if (e.target === e.currentTarget) setCajon(false) }}>
          <div role="dialog" aria-modal="true" aria-label="Boleto de apuestas" className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-3">
            <button onClick={() => setCajon(false)} className="btn-claro mb-2 w-full">Cerrar ✕</button>
            {boleto}
          </div>
        </div>
      )}

      <footer className="border-t border-white/15 bg-[#001024] pb-24 lg:pb-0">
        <div className="mx-auto max-w-[1520px] space-y-4 px-4 py-10 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <button className="btn-fantasma text-sm" onClick={() => setLegal(true)}>Términos y privacidad</button>
            <button className="btn-fantasma text-sm" onClick={() => document.getElementById('mi-cuenta')?.scrollIntoView({ behavior: 'smooth' })}>Juego responsable</button>
          </div>
          <AvisoLegal />
        </div>
      </footer>
      <Modal titulo="Términos y privacidad" abierto={legal} alCerrar={() => setLegal(false)}>
        <div className="space-y-3 text-sm text-slate-700">
          <p><strong>Uso:</strong> plataforma de demostración educativa. Las cuotas, saldos y apuestas son ficticios y no tienen valor monetario.</p>
          <p><strong>Privacidad:</strong> los datos de registro viven solo en la memoria del servidor de demostración y se borran al reiniciarlo. No se comparten con terceros.</p>
          <p><strong>Edad:</strong> solo mayores de 18 años. Está prohibido el acceso a menores.</p>
          <p><strong>Juego responsable:</strong> fija límites de depósito o tómate un descanso con la autoexclusión desde "Mi cuenta".</p>
        </div>
      </Modal>
    </div>
  )
}
