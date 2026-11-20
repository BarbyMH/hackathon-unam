/** Pantallas de acceso del Portal de apuestas: /apuestas/login y /apuestas/registro (endpoints /api/auth/usuario/*). */
import { FormEvent, useState } from 'react'
import { api, ErrorApi } from '../../lib/api'
import { usePrefs } from '../../lib/preferencias'
import { navegar } from '../../lib/router'
import { AvisoLegal } from '../../components/Experiencia'
import { Marca } from '../../components/ui'

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100svh] flex-col items-center justify-center bg-nfl-dark bg-[radial-gradient(circle_at_20%_10%,rgba(79,38,131,.35),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(213,10,10,.3),transparent_40%)] px-4 py-10">
      <div className="mb-6"><Marca subtitulo="Portal de apuestas · Vikings vs. 49ers" /></div>
      <div className="w-full max-w-md rounded-2xl border-2 border-nfl-navy bg-white p-6 text-nfl-dark shadow-2xl sm:p-8">
        <h1 className="titular text-3xl text-nfl-navy">{titulo}</h1>
        <p className="mb-4 mt-1 inline-flex items-center gap-1 rounded-md bg-nfl-red px-2 py-0.5 font-mono text-[11px] font-bold text-white"><span aria-hidden>+18</span> Solo mayores de edad</p>
        {children}
      </div>
      <div className="mt-6 max-w-md"><AvisoLegal /></div>
    </main>
  )
}

export function LoginUsuario() {
  const { avisar } = usePrefs()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setEnviando(true)
    try {
      await api('auth/usuario/login', { cuerpo: { email, password } })
      avisar('¡Bienvenido! Ya puedes armar tu boleto.', 'exito'); navegar('/apuestas')
    } catch (err) { setError((err as ErrorApi).message) } finally { setEnviando(false) }
  }
  return (
    <Marco titulo="Inicia sesión">
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <div><label className="etiqueta" htmlFor="u-email">Correo electrónico</label>
          <input id="u-email" type="email" autoComplete="email" required className="campo-form" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="u-pass">Contraseña</label>
          <input id="u-pass" type="password" autoComplete="current-password" required className="campo-form" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ {error}</p>}
        <button className="btn-rojo w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar al portal de apuestas'}</button>
      </form>
      <p className="mt-4 text-sm text-slate-700">¿No tienes cuenta? <button className="font-bold text-nfl-navy underline" onClick={() => navegar('/apuestas/registro')}>Regístrate gratis</button></p>
      <p className="mt-3 rounded-lg bg-nfl-light p-3 text-xs text-slate-600">Cuenta de prueba: <code>aficionado@gridiron.demo</code> · <code>Aficionado2026</code></p>
    </Marco>
  )
}

export function RegistroUsuario() {
  const { avisar } = usePrefs()
  const [f, setF] = useState({ nombre: '', email: '', password: '', fecha_nacimiento: '', acepta_terminos: false })
  const [paso, setPaso] = useState<'datos' | 'verificar'>('datos')
  const [codigo, setCodigo] = useState('')
  const [codigoDemo, setCodigoDemo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const registrar = async (e: FormEvent) => {
    e.preventDefault(); setError('')
    const nac = new Date(f.fecha_nacimiento)
    const edad = (Date.now() - nac.getTime()) / (365.25 * 864e5)
    if (!f.fecha_nacimiento || edad < 18) { setError('Debes tener 18 años o más para registrarte.'); return }
    setEnviando(true)
    try {
      const r = await api<{ mensaje: string; codigo_demo?: string }>('auth/usuario/registro', { cuerpo: f })
      setCodigoDemo(r.codigo_demo ?? ''); setPaso('verificar'); avisar(r.mensaje, 'info')
    } catch (err) { setError((err as ErrorApi).message) } finally { setEnviando(false) }
  }
  const verificar = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setEnviando(true)
    try {
      await api('auth/usuario/verificar', { cuerpo: { email: f.email, codigo } })
      await api('auth/usuario/login', { cuerpo: { email: f.email, password: f.password } })
      avisar('Correo verificado. ¡Bienvenido!', 'exito'); navegar('/apuestas')
    } catch (err) { setError((err as ErrorApi).message) } finally { setEnviando(false) }
  }

  if (paso === 'verificar') return (
    <Marco titulo="Verifica tu correo">
      <p className="text-sm text-slate-700">Enviamos un código de 6 dígitos a <strong>{f.email}</strong>.</p>
      {codigoDemo && <p className="mt-3 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">⚠ Demostración sin servicio de correo. Tu código es <strong className="font-mono">{codigoDemo}</strong>.</p>}
      <form onSubmit={verificar} className="mt-4 space-y-4">
        <div><label className="etiqueta" htmlFor="codigo">Código de verificación</label>
          <input id="codigo" inputMode="numeric" maxLength={6} required className="campo-form text-center font-mono text-xl tracking-[0.4em]" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} /></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ {error}</p>}
        <button className="btn-rojo w-full" disabled={enviando || codigo.length !== 6}>Verificar y entrar</button>
      </form>
    </Marco>
  )

  return (
    <Marco titulo="Crea tu cuenta">
      <form onSubmit={registrar} className="space-y-4" noValidate>
        <div><label className="etiqueta" htmlFor="r-nombre">Nombre completo</label>
          <input id="r-nombre" autoComplete="name" required className="campo-form" value={f.nombre} onChange={set('nombre')} /></div>
        <div><label className="etiqueta" htmlFor="r-email">Correo electrónico</label>
          <input id="r-email" type="email" autoComplete="email" required className="campo-form" value={f.email} onChange={set('email')} /></div>
        <div><label className="etiqueta" htmlFor="r-pass">Contraseña</label>
          <input id="r-pass" type="password" autoComplete="new-password" required minLength={8} aria-describedby="r-pass-ayuda" className="campo-form" value={f.password} onChange={set('password')} />
          <p id="r-pass-ayuda" className="mt-1 text-xs text-slate-600">Mínimo 8 caracteres, con letras y números.</p></div>
        <div><label className="etiqueta" htmlFor="r-nac">Fecha de nacimiento</label>
          <input id="r-nac" type="date" required className="campo-form" value={f.fecha_nacimiento} onChange={set('fecha_nacimiento')} max={new Date().toISOString().slice(0, 10)} /></div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={f.acepta_terminos} onChange={set('acepta_terminos')} />
          <span>Confirmo que tengo 18 años o más y acepto los términos, la privacidad y las reglas de juego responsable.</span>
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ {error}</p>}
        <button className="btn-rojo w-full" disabled={enviando || !f.acepta_terminos}>{enviando ? 'Creando…' : 'Crear cuenta'}</button>
      </form>
      <p className="mt-4 text-sm text-slate-700">¿Ya tienes cuenta? <button className="font-bold text-nfl-navy underline" onClick={() => navegar('/apuestas/login')}>Inicia sesión</button></p>
    </Marco>
  )
}
