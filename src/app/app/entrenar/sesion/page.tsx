'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EjBib } from '../comun'

// CREAR O CAMBIAR UNA SESIÓN SUYA: nombre y una lista de ejercicios (solo los verificados
// por el centro). Sencilla a propósito: sin series ni pesos; eso lo apunta al hacerla.
function Editor() {
  const router = useRouter(), q = useSearchParams(), id = q.get('id')
  const [bib, setBib] = useState<EjBib[]>([])
  const [nombre, setNombre] = useState('')
  const [lista, setLista] = useState<string[]>([])
  const [eligiendo, setEligiendo] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.rpc('app_biblioteca').then(({ data }) => setBib(data || []))
    if (id) supabase.rpc('app_mis_sesiones').then(({ data }) => {
      const s = (data || []).find((x: any) => x.id === id)
      if (s) { setNombre(s.nombre); setLista(s.ejercicios) }
    })
  }, [id])

  const porId = useMemo(() => Object.fromEntries(bib.map(e => [e.id, e])), [bib])
  const visibles = bib.filter(e => !lista.includes(e.id) && e.nombre.toLowerCase().includes(buscar.toLowerCase()))
  const zonas = Array.from(new Set(visibles.map(e => e.zona)))
  const mover = (i: number, d: number) => setLista(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n })

  async function guardar() {
    setGuardando(true)
    const { data } = await supabase.rpc('app_guardar_sesion', { sid: id, nom: nombre, ejs: lista })
    setGuardando(false)
    if (data) router.push('/app/entrenar')
  }
  async function borrar() {
    if (!id || !confirm('¿Borrar esta sesión?')) return
    await supabase.rpc('app_borrar_sesion', { sid: id }); router.push('/app/entrenar')
  }

  return (
    <main className="capp-col">
      <header className="capp-hola"><small><a href="/app/entrenar" style={{ color: 'inherit' }}>← Entrenar</a></small><h1>{id ? 'Tu sesión' : 'Nueva sesión'}</h1></header>
      <input className="capp-campo" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (p. ej. Piernas en casa)" maxLength={80}/>

      <section className="capp-sec">
        <h3>Ejercicios</h3>
        {lista.length === 0 && <div className="capp-vacio">Aún no has elegido ninguno.</div>}
        {lista.length > 0 && <ul className="capp-elegidos">
          {lista.map((eid, i) => { const e = porId[eid]; return (
            <li key={eid}>
              <span className="img">{e?.imagen ? <img src={e.imagen} alt=""/> : null}</span>
              <b>{e?.nombre || '…'}</b>
              <span className="acc">
                <button type="button" aria-label="Subir" onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" aria-label="Bajar" onClick={() => mover(i, 1)} disabled={i === lista.length - 1}>↓</button>
                <button type="button" aria-label="Quitar" onClick={() => setLista(l => l.filter(x => x !== eid))}>✕</button>
              </span>
            </li>) })}
        </ul>}
        <button type="button" className="capp-boton secundario" onClick={() => setEligiendo(true)}>+ Añadir ejercicio</button>
      </section>

      <button type="button" className="capp-boton" disabled={guardando || !lista.length} onClick={guardar}>{guardando ? 'Guardando…' : 'Guardar sesión'}</button>
      {id && <button type="button" className="capp-sobre-saltar" style={{ color: 'var(--mora)', width: '100%', marginTop: 8 }} onClick={borrar}>Borrar esta sesión</button>}

      {eligiendo && (
        <div className="capp-velo" onClick={e => { if (e.target === e.currentTarget) setEligiendo(false) }}>
          <div className="capp-hoja" style={{ textAlign: 'left' }} role="dialog" aria-label="Elegir ejercicio">
            <button type="button" className="cerrar" onClick={() => setEligiendo(false)} aria-label="Cerrar">✕</button>
            <h2 style={{ marginBottom: 12 }}>Añadir ejercicio</h2>
            <input className="capp-campo" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar…" autoFocus/>
            {bib.length === 0 && <p className="sub">El centro todavía no ha verificado ejercicios para la app.</p>}
            {zonas.map(z => (
              <div key={z} style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>{z}</h3>
                <ul className="capp-elegidos">
                  {visibles.filter(e => e.zona === z).map(e => (
                    <li key={e.id} onClick={() => { setLista(l => [...l, e.id]) }} style={{ cursor: 'pointer' }}>
                      <span className="img">{e.imagen ? <img src={e.imagen} alt=""/> : null}</span>
                      <b>{e.nombre}</b><span className="acc"><span className="mas">+</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
export default function Pagina() { return <Suspense><Editor/></Suspense> }
