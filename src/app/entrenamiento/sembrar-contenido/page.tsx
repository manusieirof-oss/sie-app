'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { categoriaDe } from '@/lib/etiquetas'
import { crearVariante, moverAFamilia, usosDeEjercicio, eliminarEjercicio } from '@/lib/ejercicios'
import { CONTENIDO, VARIANTES, FUSIONES, CAMBIOS, BORRAR } from './datos'

// ---------------------------------------------------------------------------
// CONTENIDO DE LA BIBLIOTECA DE UNA VEZ. Página de un solo uso (como sembrar-masajes).
//
// SOLO RELLENA HUECOS: la descripción, la ejecución y los feedbacks se escriben donde
// están vacíos en ese momento; lo que ya escribió el fisio no se toca nunca. Lo que
// escribo yo llega en amarillo (por revisar), igual que al copiar en una variante.
//
// Orden: primero el texto, luego las variantes nuevas (que copian ese texto ya
// relleno), luego los masajes que cambian de material y por último las fusiones de
// familias. Todo se puede repetir sin miedo: lo hecho se salta.
//
// Borrar va aparte y uno a uno, y solo deja si el ejercicio no tiene registros en
// sesiones (usosDeEjercicio): borrar sería decisión del fisio, no de un botón masivo.
// ---------------------------------------------------------------------------

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const vacia = (l: any) => !Array.isArray(l) || !l.some((i: any) => (i?.texto || '').trim())

export default function SembrarContenido() {
  const router = useRouter()
  const [ets, setEts] = useState<any[]>([])
  const [ejs, setEjs] = useState<any[]>([])
  const [usos, setUsos] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(true)
  const [haciendo, setHaciendo] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [log, setLog] = useState<string[]>([])

  async function cargar() {
    const [a, b] = await Promise.all([
      traerTodo((d, h) => supabase.from('etiquetas').select('id,nombre,padre_id,categoria').order('id').range(d, h)),
      traerTodo((d, h) => supabase.from('ejercicios').select('*').order('id').range(d, h)),
    ])
    setEts(a.filas); setEjs(b.filas)
    const u: Record<string, number> = {}
    for (const [id] of BORRAR) u[id] = await usosDeEjercicio(id)
    setUsos(u)
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  /** "material:Banda elástica" → la etiqueta de ese nombre dentro de esa categoría. */
  const etiqueta = (clave: string) => {
    const [cat, nombre] = [clave.slice(0, clave.indexOf(':')), clave.slice(clave.indexOf(':') + 1)]
    return ets.find(e => norm(e.nombre) === norm(nombre) && categoriaDe(ets, e) === cat)
  }
  const porId = (id: string) => ejs.find(e => e.id === id)

  // Lo que queda por hacer, para enseñarlo antes de aplicar.
  const pendientes = CONTENIDO.filter(([id, d, ej, fb]) => {
    const e = porId(id); if (!e) return false
    return (d && !(e.descripcion || '').trim()) || (ej.length && vacia(e.items_ejecucion)) || (fb.length && vacia(e.feedbacks))
  }).length
  const nombreVar = (base: any, sufijo: string) => `${(base?.nombre || '').split(' · ')[0]} · ${sufijo}`
  const varPend = VARIANTES.filter(([b, , s]) => porId(b) && !ejs.some(e => norm(e.nombre) === norm(nombreVar(porId(b), s)))).length
  const fusPend = FUSIONES.filter(([id, dest]) => {
    const e = porId(id), d = porId(dest); if (!e || !d) return false
    return e.portada_id !== (d.portada_id || d.id)
  }).length
  const camPend = CAMBIOS.filter(([id, nombre]) => porId(id) && porId(id).nombre !== nombre).length
  const faltanEts = Array.from(new Set([...VARIANTES.map(v => v[1]), ...CAMBIOS.flatMap(c => [...c[2], c[3]])])).filter(k => !etiqueta(k))

  async function aplicar() {
    setHaciendo(true); setLog([])
    const apunta = (t: string) => setLog(l => [...l, t])
    // Se relee todo justo antes: puede haber cambiado desde que se abrió la página.
    const fresco = async (id: string) => (await supabase.from('ejercicios').select('*').eq('id', id).single()).data

    // 1. Texto, solo en huecos
    let nTexto = 0
    for (const [id, d, ej, fb] of CONTENIDO) {
      const e = await fresco(id); if (!e) continue
      const cambio: any = {}
      const revisar = new Set<string>(e.por_revisar || [])
      if (d && !(e.descripcion || '').trim()) cambio.descripcion = d
      if (ej.length && vacia(e.items_ejecucion)) { cambio.items_ejecucion = ej.map(texto => ({ texto })); revisar.add('ejecucion') }
      if (fb.length && vacia(e.feedbacks)) { cambio.feedbacks = fb.map(texto => ({ texto })); revisar.add('feedbacks') }
      if (!Object.keys(cambio).length) continue
      cambio.por_revisar = Array.from(revisar)
      const { error } = await supabase.from('ejercicios').update(cambio).eq('id', id)
      if (error) apunta(`✗ ${e.nombre}: ${error.message}`); else nTexto++
    }
    apunta(`✓ Texto rellenado en ${nTexto} ejercicios`)

    // 2. Variantes nuevas: copia de la base cambiando la etiqueta de esa categoría
    for (const [baseId, clave, sufijo] of VARIANTES) {
      const base = await fresco(baseId); const et = etiqueta(clave)
      if (!base || !et) { apunta(`✗ Variante ${sufijo}: falta la base o la etiqueta ${clave}`); continue }
      const nombre = nombreVar(base, sufijo)
      const { data: ya } = await supabase.from('ejercicios').select('id').ilike('nombre', nombre).limit(1)
      if (ya && ya.length) { apunta(`· ${nombre} ya existía`); continue }
      const r = await crearVariante(base, nombre)
      if (r.ok === false) { apunta(`✗ ${nombre}: ${r.error}`); continue }
      const cat = clave.slice(0, clave.indexOf(':'))
      const etiquetas = [...(base.etiquetas || []).filter((id: string) => {
        const x = ets.find(t => t.id === id); return !x || categoriaDe(ets, x) !== cat
      }), et.id]
      await supabase.from('ejercicios').update({ etiquetas, por_revisar: ['ejecucion', 'feedbacks'] }).eq('id', r.ejercicio.id)
      apunta(`✓ ${nombre}`)
    }

    // 3. Masajes repetidos: cambian de material y de familia en vez de borrarse
    for (const [id, nombre, quitar, poner, destId] of CAMBIOS) {
      const e = await fresco(id); const dest = await fresco(destId); const et = etiqueta(poner)
      if (!e || !dest || !et) { apunta(`✗ ${nombre}: falta el ejercicio, la familia o la etiqueta`); continue }
      const fuera = quitar.map(k => etiqueta(k)?.id).filter(Boolean)
      const cambio: any = {
        nombre, etiquetas: Array.from(new Set([...(e.etiquetas || []).filter((x: string) => !fuera.includes(x)), et.id])),
      }
      const revisar = new Set<string>(e.por_revisar || [])
      if (!(e.descripcion || '').trim()) cambio.descripcion = dest.descripcion || ''
      if (vacia(e.items_ejecucion)) { cambio.items_ejecucion = dest.items_ejecucion || []; revisar.add('ejecucion') }
      if (vacia(e.feedbacks)) { cambio.feedbacks = dest.feedbacks || []; revisar.add('feedbacks') }
      cambio.por_revisar = Array.from(revisar)
      const { error } = await supabase.from('ejercicios').update(cambio).eq('id', id)
      if (error) { apunta(`✗ ${nombre}: ${error.message}`); continue }
      const r = await moverAFamilia(id, dest)
      apunta(r.ok === false ? `✗ ${nombre}: ${r.error}` : `✓ ${nombre}`)
    }

    // 4. Fusiones de familias (las variantes del que se mueve van con él)
    for (const [id, destId] of FUSIONES) {
      const e = await fresco(id); const dest = await fresco(destId)
      if (!e || !dest) { apunta(`✗ Fusión: no encuentro ${!e ? id : destId}`); continue }
      if (e.portada_id === (dest.portada_id || dest.id)) continue
      const r = await moverAFamilia(id, dest)
      apunta(r.ok === false ? `✗ ${e.nombre}: ${r.error}` : `✓ ${e.nombre} → ${dest.nombre}`)
    }

    await cargar()
    setHaciendo(false); setHecho(true)
  }

  async function borrar(id: string, nombre: string) {
    if ((usos[id] || 0) > 0) return
    const r = await eliminarEjercicio(id)
    setLog(l => [...l, r.ok === false ? `✗ ${nombre}: ${r.error}` : `✓ Borrado: ${nombre}`])
    await cargar()
  }

  if (cargando) return <div className="muted" style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>

  const tarjeta = { background: '#fff', borderRadius: 18, padding: '14px 16px', marginBottom: 14, boxShadow: '0 4px 16px rgba(38,40,37,.08)' }
  const fila = (t: string, n: number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: '1px solid var(--bd)' }}>
      <span>{t}</span><span style={{ color: n ? 'var(--n)' : 'var(--gd)' }}>{n ? n : '✓ hecho'}</span>
    </div>
  )
  const quedanBorrar = BORRAR.filter(([id]) => porId(id))

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 4px 60px' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>Contenido de la biblioteca</div>
      <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 18 }}>
        Solo se rellenan huecos: lo que ya tengas escrito no se toca. Ejecución y feedbacks llegan en amarillo para que los revises.
        Se puede volver a pasar: lo hecho se salta.
      </div>

      <div style={tarjeta}>
        {fila('Ejercicios con texto por rellenar', pendientes)}
        {fila('Variantes nuevas por crear', varPend)}
        {fila('Masajes que cambian de material', camPend)}
        {fila('Fusiones de familias pendientes', fusPend)}
        {faltanEts.length > 0 && (
          <div style={{ fontSize: 11.5, color: '#A87E2C', marginTop: 8 }}>No encuentro estas etiquetas (eso se saltará): {faltanEts.join(', ')}</div>
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <button className="btn btn-p" disabled={haciendo} onClick={aplicar}>
            <Ic name="mas" size={13}/> {haciendo ? 'Aplicando…' : hecho ? 'Volver a pasar' : 'Aplicar todo'}
          </button>
          {hecho && <button className="btn btn-t" onClick={() => router.push('/torno?que=ejercicios')}>Ir al torno</button>}
        </div>
      </div>

      {quedanBorrar.length > 0 && (
        <div style={tarjeta}>
          <div style={{ fontSize: 14, marginBottom: 2 }}>Para borrar</div>
          <div style={{ fontSize: 11.5, color: 'var(--gr)', marginBottom: 8 }}>Solo se puede si no está apuntado en ninguna sesión.</div>
          {quedanBorrar.map(([id, nombre]) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--bd)', fontSize: 13 }}>
              <span style={{ flex: 1 }}>{nombre}</span>
              {(usos[id] || 0) > 0
                ? <span style={{ fontSize: 11.5, color: 'var(--grl)' }}>Usado en {usos[id]} registros: se queda</span>
                : <button className="btn btn-t btn-sm" onClick={() => borrar(id, nombre)}><Ic name="papelera" size={12}/> Borrar</button>}
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.7, color: 'var(--gd)' }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
      )}
    </div>
  )
}
