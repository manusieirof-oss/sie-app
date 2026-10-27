'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { llamarVald, sincronizarVald, puntuarPerfil, PerfilVald } from '@/lib/vald'
import { aplicarDynamo, enlazarTodo } from '@/lib/valdTests'

// VALD · DYNAMO: PONERLO TODO EN MARCHA DE GOLPE.
//
// En la ficha se hace paciente a paciente y test a test. Aquí, para todos:
//  1. Emparejar los perfiles de VALD con los pacientes de SIE (nombre, apellidos y
//     fecha de nacimiento). Se proponen; tú confirmas.
//  2. Enlazar cada tipo de DynaMo con un test de SIE (uno por articulación y fuerza/rango).
//  3. Traer de VALD y apuntar los resultados en SIE (abre/cierra objetivos).

interface Par { perfil: PerfilVald, pac: any | null, s: number, marcado: boolean }
const nombrePac = (p: any) => (p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim()
const fecha = (f: string | null) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES') : 's/f'

// Fuera del componente: definido dentro, cada tecla en un input lo volvía a montar y se perdía el foco.
function Paso({ n, titulo, children, m }: { n: number, titulo: string, children: any, m?: { t: string, mal?: boolean } }) {
  return (
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--g)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 13 }}>{n}</span>
        <b style={{ fontSize: 15 }}>{titulo}</b>
      </div>
      {children}
      {m && <div style={{ marginTop: 10, fontSize: 13, padding: '7px 10px', borderRadius: 7, background: m.mal ? 'var(--redl)' : 'var(--gl)', color: m.mal ? 'var(--red)' : 'var(--gd)' }}>{m.t}</div>}
    </div>
  )
}

export default function ValdPage() {
  const [pacs, setPacs] = useState<any[]>([])
  const [pares, setPares] = useState<Par[] | null>(null)
  const [nMapeos, setNMapeos] = useState(0)
  const [asim, setAsim] = useState('15')
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState<Record<string, { t: string, mal?: boolean }>>({})
  const decir = (k: string, t: string, mal = false) => setMsg(p => ({ ...p, [k]: { t, mal } }))

  async function cargar() {
    const { filas } = await traerTodo<any>((d, h) => supabase.from('pacientes')
      .select('id,nombre,apellidos,nombre_clinica,fecha_nacimiento,vald_profile_id').order('id').range(d, h))
    setPacs(filas)
    const { count } = await supabase.from('vald_mapeo').select('clave', { count: 'exact', head: true })
    setNMapeos(count || 0)
  }
  useEffect(() => { cargar() }, [])
  const enlazados = pacs.filter(p => p.vald_profile_id).length

  async function hacer(k: string, f: () => Promise<void>) {
    setOcupado(k)
    try { await f() } catch (e: any) { decir(k, e.message || 'Error', true) }
    setOcupado('')
  }

  // ---- 1. Emparejar: a cada perfil su mejor paciente, sin repetir paciente ----
  const buscar = () => hacer('pac', async () => {
    const { perfiles } = await llamarVald('perfiles') as { perfiles: PerfilVald[] }
    const usados = new Set(pacs.filter(p => p.vald_profile_id).map(p => p.id))
    const ya = new Set(pacs.map(p => p.vald_profile_id).filter(Boolean))
    const cand: { perfil: PerfilVald, pac: any, s: number }[] = []
    for (const perfil of perfiles) {
      if (ya.has(perfil.profileId)) continue
      for (const pac of pacs) {
        if (usados.has(pac.id)) continue
        const s = puntuarPerfil(perfil, pac)
        if (s >= 40) cand.push({ perfil, pac, s })
      }
    }
    // Los más seguros primero; cada paciente y cada perfil, una sola vez.
    cand.sort((a, b) => b.s - a.s)
    const tomadoP = new Set<string>(), tomadoPac = new Set<string>()
    const out: Par[] = []
    for (const c of cand) {
      if (tomadoP.has(c.perfil.profileId) || tomadoPac.has(c.pac.id)) continue
      tomadoP.add(c.perfil.profileId); tomadoPac.add(c.pac.id)
      out.push({ ...c, marcado: c.s >= 80 })
    }
    perfiles.filter(p => !ya.has(p.profileId) && !tomadoP.has(p.profileId)).forEach(perfil => out.push({ perfil, pac: null, s: 0, marcado: false }))
    setPares(out)
    decir('pac', `${perfiles.length} perfiles en VALD · ${ya.size} ya enlazados · ${out.filter(x => x.pac).length} con pareja propuesta`)
  })
  const enlazarMarcados = () => hacer('pac', async () => {
    const sel = (pares || []).filter(x => x.marcado && x.pac)
    for (const x of sel) {
      const { error } = await supabase.from('pacientes').update({ vald_profile_id: x.perfil.profileId }).eq('id', x.pac.id)
      if (error) throw new Error(error.message)
    }
    setPares(null); await cargar()
    decir('pac', `${sel.length} pacientes enlazados con VALD.`)
  })

  // ---- 2. Enlazar los tipos de test ----
  const enlazarTests = () => hacer('tests', async () => {
    const n = parseFloat(asim)
    const r = await enlazarTodo(n > 0 ? n : null)
    await cargar()
    decir('tests', r.enlaces ? `${r.enlaces} tipos de DynaMo enlazados · ${r.testsNuevos} tests nuevos en la biblioteca.` : 'No hay tipos nuevos sin enlazar.')
  })

  // ---- 3. Traer y apuntar ----
  const traer = () => hacer('traer', async () => {
    const n = await sincronizarVald()
    const r = await aplicarDynamo()
    const v = Object.values(r)
    const suma = (k: 'resultados' | 'positivos' | 'abiertos' | 'logrados') => v.reduce((s, x) => s + x[k], 0)
    const err = v.flatMap(x => x.errores)
    decir('traer', `${n} tests nuevos de VALD · ${suma('resultados')} resultados apuntados en SIE (${v.filter(x => x.resultados).length} pacientes) · ${suma('positivos')} positivos · ${suma('abiertos')} objetivos abiertos · ${suma('logrados')} logrados${err.length ? ` · ${err.length} errores: ${err[0]}` : ''}`, err.length > 0)
  })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>VALD · DynaMo</h1>
      <p style={{ color: 'var(--gr)', fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>Para poner en marcha a todos los pacientes de golpe. En la ficha de cada uno (Resultados → DynaMo) se puede hacer uno a uno.</p>

      <Paso n={1} titulo={`Pacientes enlazados con VALD · ${enlazados}`} m={msg.pac}>
        {!pares ? (
          <button className="btn btn-p btn-sm" onClick={buscar} disabled={!!ocupado}>{ocupado === 'pac' ? 'Buscando…' : 'Buscar parejas en VALD'}</button>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 8 }}>Marcados los que coinciden en nombre y fecha de nacimiento. Revisa los «parecidos» antes de marcarlos.</div>
            <div style={{ display: 'grid', gap: 4, maxHeight: 420, overflow: 'auto', marginBottom: 10 }}>
              {pares.map((x, i) => (
                <label key={x.perfil.profileId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 7, fontSize: 13,
                  background: x.marcado ? 'var(--gl)' : 'var(--w)', border: '1px solid var(--bd)', cursor: x.pac ? 'pointer' : 'default', opacity: x.pac ? 1 : .6 }}>
                  <input type="checkbox" disabled={!x.pac} checked={x.marcado} onChange={e => setPares(p => p!.map((y, j) => j === i ? { ...y, marcado: e.target.checked } : y))}/>
                  <span style={{ flex: 1 }}>{x.perfil.givenName} {x.perfil.familyName} <span style={{ color: 'var(--gr)' }}>· {fecha(x.perfil.dateOfBirth)}</span></span>
                  <span style={{ flex: 1 }}>{x.pac ? <>→ {nombrePac(x.pac)} <span style={{ color: 'var(--gr)' }}>· {fecha(x.pac.fecha_nacimiento)}</span></> : <span style={{ color: 'var(--gr)' }}>sin pareja en SIE</span>}</span>
                  {x.pac && <span style={{ fontSize: 11, color: x.s >= 80 ? 'var(--gd)' : '#8a6d1f' }}>{x.s >= 80 ? 'coincide' : 'parecido'}</span>}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => setPares(p => p!.map(y => ({ ...y, marcado: !!y.pac })))}>Marcar todos los que tienen pareja</button>
              <button className="btn btn-sm" onClick={() => setPares(p => p!.map(y => ({ ...y, marcado: !!y.pac && y.s >= 80 })))}>Solo los que coinciden</button>
              <button className="btn btn-p btn-sm" onClick={enlazarMarcados} disabled={!!ocupado}>Enlazar los marcados ({pares.filter(x => x.marcado).length})</button>
              <button className="btn btn-sm" onClick={() => setPares(null)}>Cancelar</button>
            </div>
          </>
        )}
      </Paso>

      <Paso n={2} titulo={`Tests de DynaMo enlazados con SIE · ${nMapeos}`} m={msg.tests}>
        <div style={{ fontSize: 13, color: 'var(--gr)', marginBottom: 10 }}>
          Crea un test por articulación y tipo («Fuerza de rodilla (DynaMo)», «Rango de cadera (DynaMo)»…) con un ítem por movimiento y posición, en kg o grados, y enlaza cada tipo de DynaMo con su ítem. Si ya existe un test con ese nombre, le añade lo que falte. Luego puedes retocarlos en la biblioteca de tests.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
          Positivo si un lado rinde más de
          <input className="input" type="number" value={asim} onChange={e => setAsim(e.target.value)} style={{ width: 70 }}/>
          % peor que el otro <span style={{ color: 'var(--gr)' }}>(vacío = solo medir, no abre objetivos)</span>
        </div>
        <button className="btn btn-p btn-sm" style={{ marginTop: 10 }} onClick={enlazarTests} disabled={!!ocupado}>{ocupado === 'tests' ? 'Enlazando…' : 'Enlazar todos los tipos de DynaMo'}</button>
      </Paso>

      <Paso n={3} titulo="Traer de VALD y apuntar en SIE" m={msg.traer}>
        <div style={{ fontSize: 13, color: 'var(--gr)', marginBottom: 10 }}>Baja lo nuevo de VALD y apunta como resultado de SIE los tests enlazados de los pacientes enlazados, incluidos los que ya había. Puede tardar un poco la primera vez.</div>
        <button className="btn btn-p btn-sm" onClick={traer} disabled={!!ocupado}>{ocupado === 'traer' ? 'Trayendo y apuntando…' : 'Traer y apuntar'}</button>
      </Paso>
    </div>
  )
}
