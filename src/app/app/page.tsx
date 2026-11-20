'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navegacion from './Navegacion'
import { tiene } from './activas'
import Avisos from './Avisos'

// INICIO DE LA APP DE CLIENTES: su próxima cita, lo que lleva hecho y el álbum que viene.
// Todo llega por funciones app_… (sql/app-3-clientes.sql): el cliente no lee tablas.

const diaSemana = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })
const diaMes = (f: string) => new Date(f + 'T12:00:00').getDate()
const mes = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
const fechaLarga = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
const cuando = (f: string) => {
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
  const d = Math.round((+new Date(f + 'T12:00:00') - +hoy) / 864e5)
  return d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : diaSemana(f).replace(/^./, c => c.toUpperCase())
}

export default function InicioApp() {
  const [estado, setEstado] = useState<'cargando' | 'fuera' | 'equipo' | 'dentro'>('cargando')
  const [yo, setYo] = useState<any>(null)
  const [citas, setCitas] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { setEstado('fuera'); return }
      const { data: y } = await supabase.rpc('app_yo')
      if (!y) { setEstado('equipo'); return }
      setYo(y)
      const { data: c } = await supabase.rpc('app_mis_citas')
      setCitas(c || { proximas: [], ultimas: [], hechas: 0 })
      setEstado('dentro')
    })
  }, [])

  if (estado === 'cargando') return <div className="capp-centro"><h1>Un momento…</h1></div>
  if (estado === 'fuera') return <Fuera/>
  if (estado === 'equipo') return (
    <div className="capp-centro">
      <h1>Esta es la app de los clientes</h1>
      <p>Has entrado con un usuario del equipo. Tu sitio es SIE.</p>
      <p><a href="/" style={{ color: 'var(--tinta)', fontWeight: 700 }}>Ir a SIE</a></p>
    </div>
  )

  const prox = citas.proximas[0]
  return (
    <>
    <main className="capp-col capp-con-nav">
      <header className="capp-hola">
        <small>{yo.centro || 'Tu centro'}</small>
        <h1>Hola, {yo.nombre}</h1>
      </header>

      {prox ? (
        <section className="capp-billete" aria-label="Tu próxima cita"
          onClick={tiene(yo.activas, 'sesion') ? () => { window.location.href = '/app/sesion' } : undefined}
          style={tiene(yo.activas, 'sesion') ? { cursor: 'pointer' } : undefined}>
          <div className="dia"><b>{diaMes(prox.fecha)}</b><span>{mes(prox.fecha)}</span></div>
          <div className="que">
            <h2>{cuando(prox.fecha)} a las {prox.hora}</h2>
            <p>{prox.sesion || 'Entrenamiento'}{prox.sala ? `, sala ${prox.sala}` : ''}</p>
            {tiene(yo.activas, 'sesion') && prox.sesion && <p className="ver">Ver lo que te toca</p>}
          </div>
        </section>
      ) : <div className="capp-vacio">No tienes citas próximas. Pídela en el centro.</div>}

      <div className="capp-cuenta">
        <div><b>{citas.hechas}</b><span>entrenos hechos</span></div>
        <div><b>{citas.proximas.length}</b><span>citas por venir</span></div>
      </div>

      {tiene(yo.activas, 'avisos') && <Avisos/>}

      {tiene(yo.activas, 'album') && <section className="capp-sec">
        <Link href="/app/album" className="capp-album" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="sobres" aria-hidden><span className="sobre"/><span className="sobre"/><span className="sobre"/></div>
          <p><b>Tu álbum de cromos</b>Cada ejercicio que haces bien en clase es un cromo. Repítelo bien para ganar bronce, plata, oro y diamante.</p>
        </Link>
      </section>}

      {citas.proximas.length > 1 && (
        <section className="capp-sec">
          <h3>Tus próximas citas</h3>
          <ul className="capp-lista">
            {citas.proximas.slice(1).map((c: any, i: number) => (
              <li key={i}><b>{fechaLarga(c.fecha)}</b>{c.hora}<span>{c.sesion || ''}</span></li>
            ))}
          </ul>
        </section>
      )}

      {citas.ultimas.length > 0 && (
        <section className="capp-sec">
          <h3>Lo último que hiciste</h3>
          <ul className="capp-lista">
            {citas.ultimas.map((c: any, i: number) => <li key={i}><b>{fechaLarga(c.fecha)}</b><span>{c.sesion || 'Entrenamiento'}</span></li>)}
          </ul>
        </section>
      )}
    </main>
    <Navegacion/>
    </>
  )
}

/* SIN SESIÓN. Además de abrir el enlace, se puede PEGAR aquí: en iPhone la app instalada
   no comparte la sesión con Safari, y los enlaces de WhatsApp se abren en Safari. */
function Fuera() {
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)
  async function entrar() {
    setError('')
    let t = ''
    try { t = new URL(texto.trim()).searchParams.get('t') || '' } catch { t = '' }
    if (!t) { setError('Eso no parece tu enlace. Cópialo entero del mensaje del centro.'); return }
    setEntrando(true)
    const { error } = await supabase.auth.verifyOtp({ token_hash: t, type: 'magiclink' })
    setEntrando(false)
    if (error) setError('Este enlace ya no sirve. Pide uno nuevo en el centro.'); else window.location.reload()
  }
  return (
    <div className="capp-centro">
      <h1>Tu entreno, en el móvil</h1>
      <p>Para entrar, abre el enlace que te mandamos desde el centro. Si tienes la app en tu pantalla de inicio, copia el enlace y pégalo aquí:</p>
      <input className="capp-campo" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Pega aquí tu enlace" inputMode="url" autoCapitalize="off" autoCorrect="off"/>
      <button type="button" className="capp-boton" disabled={entrando || !texto.trim()} onClick={entrar}>{entrando ? 'Entrando…' : 'Entrar'}</button>
      {error && <p style={{ color: 'var(--mora)' }}>{error}</p>}
    </div>
  )
}
