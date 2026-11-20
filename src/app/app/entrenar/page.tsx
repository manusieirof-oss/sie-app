'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navegacion from '../Navegacion'
import { fechaCorta } from './comun'

// ENTRENAR POR SU CUENTA (APARCADO: es para particulares, no para la clínica; no sale en
// la barra). Sus sesiones (listas de
// ejercicios verificados) y lo último que entrenó. Lo que haga aquí suma veces a sus
// cromos, sin sello (no lo ha visto nadie). Datos: sql/app-10-entreno.sql.
export default function Entrenar() {
  const [mias, setMias] = useState<any[] | null>(null)
  const [hechos, setHechos] = useState<any[]>([])
  const [fuera, setFuera] = useState(false)

  useEffect(() => {
    Promise.all([supabase.rpc('app_mis_sesiones'), supabase.rpc('app_mis_entrenos')]).then(([a, b]) => {
      if (a.data == null) { setFuera(true); return }
      setMias(a.data); setHechos(b.data || [])
    })
  }, [])

  if (fuera) return <div className="capp-centro"><h1>Entrenar</h1><p>Muy pronto podrás entrenar por tu cuenta desde aquí.</p><p><a href="/app" style={{ color: 'var(--tinta)', fontWeight: 700 }}>Volver al inicio</a></p></div>
  if (!mias) return <div className="capp-centro"><h1>Un momento…</h1></div>
  return (
    <>
      <main className="capp-col capp-con-nav">
        <header className="capp-hola"><small>Por tu cuenta</small><h1>Entrenar</h1></header>

        {/* Las sesiones del centro son para hacer en el centro: aquí solo las suyas. */}

        <section className="capp-sec">
          <h3>Tus sesiones</h3>
          {mias.length === 0 && <div className="capp-vacio">Crea tu propia sesión: una lista sencilla con los ejercicios que quieras hacer.</div>}
          {mias.map(s => (
            <div key={s.id} className="capp-tarjeta-entreno">
              <Link href={`/app/entrenar/hacer?de=${s.id}`} className="cuerpo">
                <span><b>{s.nombre}</b><small>{s.ejercicios.length} {s.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}</small></span>
                <span className="ir">Empezar</span>
              </Link>
              <Link href={`/app/entrenar/sesion?id=${s.id}`} className="editar">Cambiar</Link>
            </div>
          ))}
          <Link href="/app/entrenar/sesion" className="capp-boton" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 12 }}>+ Crear una sesión</Link>
        </section>

        {hechos.length > 0 && (
          <section className="capp-sec">
            <h3>Lo último que entrenaste</h3>
            <ul className="capp-lista">
              {hechos.map((h, i) => <li key={i}><b>{fechaCorta(h.fecha)}</b><span>{h.nombre || 'Entreno'} · {h.hechos} de {h.total}</span></li>)}
            </ul>
            <p className="capp-nota">Lo que entrenas por tu cuenta suma veces a tus cromos (su color). El sello solo lo pone el centro cuando te ve hacerlo bien.</p>
          </section>
        )}
      </main>
      <Navegacion/>
    </>
  )
}
