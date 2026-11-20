/** /admin/login · Pantalla independiente con 2FA (endpoints /api/auth/admin/*). Sin registro público. */
import { FormEvent, useState } from 'react'
import { api, ErrorApi } from '../../lib/api'
import { usePrefs } from '../../lib/preferencias'
import { navegar } from '../../lib/router'

export function LoginAdmin() {
  const { avisar } = usePrefs()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoDemo, setCodigoDemo] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const paso1 = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setEnviando(true)
    try {
      const r = await api<{ token: string; codigo_demo?: string }>('auth/admin/login', { cuerpo: { email, password } })
      setToken(r.token); setCodigoDemo(r.codigo_demo ?? '')
    } catch (err) { setError((err as ErrorApi).message) } finally { setEnviando(false) }
  }
  const paso2 = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setEnviando(true)
    try {
      await api('auth/admin/2fa', { cuerpo: { token, codigo } })
      avisar('Acceso de administrador concedido.', 'exito'); navegar('/admin/analisis')
    } catch (err) {
      const e2 = err as ErrorApi
      setError(e2.message)
      if (e2.message.includes('expiró')) { setToken(''); setCodigo('') }
    } finally { setEnviando(false) }
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-nfl-light px-4 py-10 text-nfl-dark">
      <div className="w-full max-w-md rounded-2xl border-2 border-nfl-navy bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex items-center gap-3 border-b border-nfl-border pb-4">
          <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-nfl-red bg-nfl-navy font-display text-xl font-extrabold text-white">BI</span>
          <div>
            <h1 className="titular text-2xl text-nfl-navy">Gridiron Analytics</h1>
            <p className="text-sm text-slate-600">Acceso exclusivo para administradores</p>
          </div>
        </div>
        <ol className="mb-5 flex gap-2 text-xs font-bold" aria-label="Pasos de acceso">
          <li className={`flex-1 rounded-lg p-2 text-center ${!token ? 'bg-nfl-navy text-white' : 'bg-nfl-light text-slate-600'}`}>1 · Contraseña</li>
          <li className={`flex-1 rounded-lg p-2 text-center ${token ? 'bg-nfl-navy text-white' : 'bg-nfl-light text-slate-600'}`}>2 · Código 2FA</li>
        </ol>
        {!token ? (
          <form onSubmit={paso1} className="space-y-4">
            <div><label className="etiqueta" htmlFor="a-email">Correo institucional</label>
              <input id="a-email" type="email" autoComplete="username" required className="campo-form" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label className="etiqueta" htmlFor="a-pass">Contraseña</label>
              <input id="a-pass" type="password" autoComplete="current-password" required className="campo-form" value={password} onChange={e => setPassword(e.target.value)} /></div>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ {error}</p>}
            <button className="btn-navy w-full" disabled={enviando}>{enviando ? 'Verificando…' : 'Continuar'}</button>
          </form>
        ) : (
          <form onSubmit={paso2} className="space-y-4">
            <p className="text-sm text-slate-700">Abre tu app de autenticación (Google Authenticator, Authy…) y escribe el código de 6 dígitos.</p>
            {codigoDemo && <p className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">⚠ Cuenta de demostración: el código vigente es <strong className="font-mono">{codigoDemo}</strong>.</p>}
            <div><label className="etiqueta" htmlFor="a-2fa">Código 2FA</label>
              <input id="a-2fa" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="campo-form text-center font-mono text-xl tracking-[0.4em]" value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))} /></div>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ {error}</p>}
            <button className="btn-navy w-full" disabled={enviando || codigo.length !== 6}>Entrar al portal de análisis</button>
            <button type="button" className="w-full text-sm font-semibold text-nfl-navy underline" onClick={() => { setToken(''); setCodigo(''); setError('') }}>Volver</button>
          </form>
        )}
        <div className="mt-5 space-y-1 rounded-xl bg-nfl-light p-3 text-xs text-slate-600">
          <p>No hay registro público: un superadmin crea las cuentas.</p>
          <p>Cuenta de prueba: <code>admin@gridiron.demo</code> · <code>AdminDemo2026</code></p>
        </div>
      </div>
    </main>
  )
}
