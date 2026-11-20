'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navegacion from '../Navegacion'

// SU PRÓXIMA SESIÓN: lo que le toca, parte a parte, con lo que le habéis puesto y lo
// que hizo la última vez de cada ejercicio. Solo para mirar: lo apunta el entrenador en
// clase. Datos: app_mi_sesion() (sql/app-8-sesion.sql).

const ll = (x: any) => x !== '' && x != null
/** «3 × 10 · 20 kg», «3 × 30 s», «2 × 200 m · banda roja». */
function pauta(e: any) {
  const vol = ll(e.tiempo) ? `${e.tiempo} s` : ll(e.metros) ? `${e.metros} m` : ll(e.reps) ? `${e.reps}` : ''
  const carga = ll(e.peso) ? `${e.peso} kg` : ll(e.banda) ? `banda ${String(e.banda).toLowerCase()}` : ''
  return [ll(e.series) && vol ? `${e.series} × ${vol}` : vol || (ll(e.series) ? `${e.series} series` : ''), carga].filter(Boolean).join(' · ')
}
/** Lo que hizo: «20×10, 22×8» o «30 s, 35 s». */
function hizo(series: any[]) {
  return (Array.isArray(series) ? series : []).map(s => {
    const vol = ll(s.segundos) ? `${s.segundos} s` : ll(s.metros) ? `${s.metros} m` : ll(s.reps) ? `${s.reps}` : ''
    const c = ll(s.peso) ? `${s.peso}` : ''
    return c && ll(s.reps) ? `${c}×${vol}` : vol || c
  }).filter(Boolean).join(', ')
}
const dia = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const diaCorto = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')

export default function MiSesion() {
  const [datos, setDatos] = useState<any>(undefined)
  useEffect(() => {
    supabase.rpc('app_mi_sesion').then(({ data }) => setDatos(data ?? null))
  }, [])

  if (datos === undefined) return <div className="capp-centro"><h1>Un momento…</h1></div>
  if (datos === null) return <div className="capp-centro"><h1>Tu sesión</h1><p>Muy pronto podrás ver aquí lo que te toca.</p><p><a href="/app" style={{ color: 'var(--tinta)', fontWeight: 700 }}>Volver al inicio</a></p></div>
  const s = datos.sesion
  return (
    <>
      <main className="capp-col capp-con-nav">
        <header className="capp-hola">
          <small>{s ? `${dia(s.fecha).replace(/^./, (c: string) => c.toUpperCase())}, ${s.hora}` : 'Sin cita'}</small>
          <h1>{s ? s.nombre : 'Tu sesión'}</h1>
        </header>
        {!s && <div className="capp-vacio">No tienes una sesión preparada para tu próxima cita. La verás aquí cuando el centro te la ponga.</div>}
        {s?.partes?.map((p: any, i: number) => (
          <section key={i} className="capp-parte">
            {(p.nombre || p.modo === 'circuito') && <h2>{p.nombre || 'Circuito'}{p.modo === 'circuito' && p.vueltas ? <span>{p.vueltas} vueltas</span> : null}</h2>}
            <ul>
              {(p.ejercicios || []).map((e: any, k: number) => (
                <li key={k}>
                  <span className="img">{e.imagen ? <img src={e.imagen} alt="" loading="lazy"/> : null}</span>
                  <span className="txt">
                    <b>{e.nombre}</b>
                    {pauta(e) && <span className="pauta">{pauta(e)}</span>}
                    {e.ultima && hizo(e.ultima.series) && <span className="ultima">La última vez ({diaCorto(e.ultima.fecha)}): {hizo(e.ultima.series)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Navegacion/>
    </>
  )
}
