'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Sparkline from './Sparkline'
import { COLOR } from '@/lib/resultados'
import { llamarVald, sincronizarVald, candidatos, esVald, lado, esRango, PerfilVald } from '@/lib/vald'

// RESULTADOS DEL DYNAMO (VALD) EN LA FICHA.
//
// Los tests se hacen como siempre con el DynaMo y suben a VALD Hub. SIE los baja
// (botón "Traer de VALD") y aquí se enseñan los del perfil enlazado con este paciente.
// Por ahora es un bloque aparte: no cuentan como tests de SIE (objetivos, fases).

const fecha = (f: string) => new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
const kg = (n: number) => Math.round(n / 9.80665 * 10) / 10

interface Punto { fecha: string, I: number | null, D: number | null, U: number | null }
interface Grupo { clave: string, titulo: string, rango: boolean, puntos: Punto[] }

export default function DynamoVald({ pac }: { pac: any }) {
  const [perfilId, setPerfilId] = useState<string | null>(pac?.vald_profile_id || null)
  const [tests, setTests] = useState<any[] | null>(null)
  const [perfiles, setPerfiles] = useState<PerfilVald[] | null>(null)
  const [busca, setBusca] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ t: string, mal?: boolean } | null>(null)
  const [ultima, setUltima] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  async function cargar(pid = perfilId) {
    supabase.from('ajustes').select('valor').eq('clave', 'vald_ultima_sync').maybeSingle().then(({ data }) => setUltima(data?.valor || null))
    if (!pid) { setTests([]); return }
    const { data } = await supabase.from('vald_tests').select('id,fecha,categoria,region,movimiento,posicion,lateralidad,resumen')
      .eq('profile_id', pid).order('fecha')
    setTests(data || [])
  }
  useEffect(() => { cargar() }, [perfilId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(que: string, f: () => Promise<void>) {
    setOcupado(que); setAviso(null)
    try { await f() } catch (e: any) { setAviso({ t: e.message || 'Error', mal: true }) }
    setOcupado(null)
  }
  const traer = () => hacer('sync', async () => {
    const n = await sincronizarVald()
    setAviso({ t: n ? `${n} test${n === 1 ? '' : 's'} nuevos o cambiados de VALD.` : 'Nada nuevo en VALD.' })
    await cargar()
  })
  const buscarPerfiles = () => hacer('perfiles', async () => { setPerfiles((await llamarVald('perfiles')).perfiles || []) })
  const enlazar = (id: string | null) => hacer('enlazar', async () => {
    const { error } = await supabase.from('pacientes').update({ vald_profile_id: id }).eq('id', pac.id)
    if (error) throw new Error(error.message)
    setPerfilId(id); setPerfiles(null)
    // Al enlazar se traen los tests: si no, el bloque saldría vacío hasta pulsar.
    if (id) { await sincronizarVald().catch(() => {}); await cargar(id) }
  })
  const crear = () => hacer('crear', async () => {
    const { profileId } = await llamarVald('crear', { pacienteId: pac.id })
    setPerfilId(profileId); setPerfiles(null)
    setAviso({ t: 'Creado en VALD y enlazado. Ya puedes elegirlo en el DynaMo.' })
  })

  // ---- AGRUPAR: un grupo por zona + movimiento + posición + tipo. Un test de VALD
  // puede medir dos movimientos (extensión y flexión): cada uno va a su grupo.
  const grupos: Grupo[] = useMemo(() => {
    const m = new Map<string, Grupo>()
    for (const t of tests || []) {
      const rango = esRango(t.categoria)
      const porMov = new Map<string, Punto>()
      for (const s of (t.resumen || [])) {
        const v = rango ? s.maxRangeOfMotionDegrees : s.maxForceNewtons
        if (typeof v !== 'number' || !t.fecha) continue
        const mov = s.movement || t.movimiento
        const p = porMov.get(mov) || { fecha: t.fecha, I: null, D: null, U: null }
        const l = lado(s.laterality)
        const k = l || 'U'
        p[k] = Math.max(p[k] ?? -Infinity, v)
        porMov.set(mov, p)
      }
      porMov.forEach((p, mov) => {
        const clave = [t.region, mov, t.posicion, rango ? 'r' : 'f'].join('|')
        const g = m.get(clave) || { clave, rango, puntos: [], titulo: [esVald(t.region), esVald(mov), esVald(t.posicion)].filter(Boolean).join(' · ') }
        g.puntos.push(p); m.set(clave, g)
      })
    }
    // El que se ha medido hace menos, arriba.
    return Array.from(m.values()).sort((a, b) => b.puntos[b.puntos.length - 1].fecha.localeCompare(a.puntos[a.puntos.length - 1].fecha))
  }, [tests])

  const fmt = (g: Grupo, v: number | null) => v == null ? '—' : g.rango ? `${Math.round(v)}°` : `${kg(v)} kg`
  const asim = (p: Punto) => p.I != null && p.D != null && Math.max(p.I, p.D) > 0 ? Math.round(Math.abs(p.I - p.D) / Math.max(p.I, p.D) * 100) : null

  const sug = perfiles ? candidatos(perfiles, pac) : []
  const lista = perfiles ? perfiles.filter(p => !busca || `${p.givenName} ${p.familyName}`.toLowerCase().includes(busca.toLowerCase())).slice(0, 30) : []

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Ic name="fuerza" size={16}/>
        <b style={{ fontSize: 14 }}>DynaMo · VALD</b>
        {ultima && <span style={{ fontSize: 11.5, color: 'var(--gr)' }}>última sincronización {fecha(ultima)}</span>}
        <div style={{ flex: 1 }}/>
        {perfilId && <button className="btn btn-sm" onClick={() => { if (confirm('¿Quitar el enlace con su perfil de VALD? Los tests no se borran.')) enlazar(null) }} disabled={!!ocupado}>Desenlazar</button>}
        <button className="btn btn-p btn-sm" onClick={traer} disabled={!!ocupado}>
          <Ic name="descargar" size={12}/> {ocupado === 'sync' ? 'Trayendo…' : 'Traer de VALD'}
        </button>
      </div>

      {aviso && <div style={{ fontSize: 12.5, marginBottom: 10, padding: '7px 10px', borderRadius: 7,
        background: aviso.mal ? 'var(--redl)' : 'var(--gl)', color: aviso.mal ? 'var(--red)' : 'var(--gd)' }}>{aviso.t}</div>}

      {/* ---- SIN ENLAZAR: proponer su perfil o crearlo ---- */}
      {!perfilId && (
        <div style={{ fontSize: 13 }}>
          <div style={{ color: 'var(--gr)', marginBottom: 10 }}>Este paciente aún no está enlazado con su perfil de VALD.</div>
          {!perfiles ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-p btn-sm" onClick={buscarPerfiles} disabled={!!ocupado}><Ic name="buscar" size={12}/> {ocupado === 'perfiles' ? 'Buscando…' : 'Buscar en VALD'}</button>
              <button className="btn btn-sm" onClick={crear} disabled={!!ocupado}><Ic name="mas" size={12}/> {ocupado === 'crear' ? 'Creando…' : 'Crear en VALD'}</button>
            </div>
          ) : (
            <>
              {sug.length > 0 ? (
                <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                  <div className="et-mini">¿Es alguno de estos?</div>
                  {sug.map(({ p, s }) => (
                    <div key={p.profileId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: `1px solid ${s >= 80 ? 'var(--gm)' : 'var(--bd)'}`, background: s >= 80 ? 'var(--gl)' : 'var(--w)' }}>
                      <span style={{ flex: 1 }}>{p.givenName} {p.familyName}{p.dateOfBirth ? <span style={{ color: 'var(--gr)' }}> · {fecha(p.dateOfBirth)}</span> : null}</span>
                      <span style={{ fontSize: 11, color: 'var(--gr)' }}>{s >= 80 ? 'coincide' : 'parecido'}</span>
                      <button className="btn btn-p btn-sm" onClick={() => enlazar(p.profileId)} disabled={!!ocupado}><Ic name="check" size={12}/> Enlazar</button>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: 'var(--gr)', marginBottom: 10 }}>No hay ninguno con su nombre y fecha de nacimiento.</div>}
              <div className="et-mini" style={{ marginBottom: 5 }}>O búscalo a mano</div>
              <input className="input" placeholder="Nombre en VALD…" value={busca} onChange={e => setBusca(e.target.value)} style={{ marginBottom: 6 }}/>
              {busca && (
                <div style={{ display: 'grid', gap: 4, maxHeight: 220, overflow: 'auto', marginBottom: 10 }}>
                  {lista.map(p => (
                    <button key={p.profileId} className="btn btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => enlazar(p.profileId)} disabled={!!ocupado}>
                      {p.givenName} {p.familyName}{p.dateOfBirth ? ` · ${fecha(p.dateOfBirth)}` : ''}
                    </button>
                  ))}
                  {lista.length === 0 && <span style={{ fontSize: 12, color: 'var(--gr)' }}>Nadie con ese nombre.</span>}
                </div>
              )}
              <button className="btn btn-sm" onClick={crear} disabled={!!ocupado}><Ic name="mas" size={12}/> {ocupado === 'crear' ? 'Creando…' : 'No está: crearlo en VALD'}</button>
            </>
          )}
        </div>
      )}

      {/* ---- ENLAZADO: sus tests por movimiento ---- */}
      {perfilId && tests && grupos.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--gr)' }}>Sin tests de DynaMo todavía. Si acabas de hacerle uno, pulsa «Traer de VALD».</div>
      )}
      {perfilId && grupos.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {grupos.map(g => {
            const u = g.puntos[g.puntos.length - 1], p0 = g.puntos[0]
            const a = asim(u)
            const bi = u.I != null || u.D != null
            const serie = (k: 'I' | 'D' | 'U') => g.puntos.map(p => p[k]).filter((x): x is number => x != null)
            const tope = Math.max(...g.puntos.flatMap(p => [p.I, p.D, p.U]).filter((x): x is number => x != null), 1) * 1.1
            const dif = (k: 'I' | 'D' | 'U') => g.puntos.length > 1 && p0[k] != null && u[k] != null && p0[k]! > 0 ? Math.round((u[k]! - p0[k]!) / p0[k]! * 100) : null
            const Celda = ({ k, l }: { k: 'I' | 'D' | 'U', l: string }) => {
              const d = dif(k)
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: 'var(--gr)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(g, u[k])}</div>
                    {d != null && d !== 0 && <div style={{ fontSize: 11, color: d > 0 ? 'var(--gd)' : 'var(--red)' }}>{d > 0 ? '+' : '−'}{Math.abs(d)}% desde {fecha(p0.fecha)}</div>}
                  </div>
                  <Sparkline valores={serie(k)} color={COLOR.g} max={tope} ancho={70}/>
                </div>
              )
            }
            return (
              <div key={g.clave} style={{ border: '1px solid var(--bd)', borderRadius: 9, background: 'var(--w)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }}>{g.titulo}</b>
                  <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 99, background: 'var(--bl)', color: 'var(--gr)' }}>{g.rango ? 'Rango' : 'Fuerza máx.'}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--gr)' }}>{fecha(u.fecha)} · {g.puntos.length} vez{g.puntos.length === 1 ? '' : 'es'}</span>
                  <div style={{ flex: 1 }}/>
                  {a != null && (
                    // Diferencia entre lados sobre el mejor. Más de un 10-15% suele mirarse.
                    <span title="Asimetría entre lados" style={{ fontSize: 11.5, fontWeight: 600, padding: '2px 9px', borderRadius: 99,
                      background: a > 15 ? 'var(--redl)' : a > 10 ? 'var(--ambl)' : 'var(--gl)', color: a > 15 ? 'var(--red)' : a > 10 ? '#8a6d1f' : 'var(--gd)' }}>
                      Asimetría {a}%
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  {bi ? <><Celda k="I" l="Izquierda"/><Celda k="D" l="Derecha"/></> : <Celda k="U" l="Valor"/>}
                </div>
                {g.puntos.length > 1 && (
                  <button className="btn btn-sm" style={{ marginTop: 8, fontSize: 11.5 }} onClick={() => setAbierto(abierto === g.clave ? null : g.clave)}>
                    {abierto === g.clave ? 'Ocultar historial' : 'Ver historial'}
                  </button>
                )}
                {abierto === g.clave && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 2, fontSize: 12.5 }}>
                    {g.puntos.slice().reverse().map((p, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, padding: '3px 0', borderTop: '1px solid var(--bl)' }}>
                        <span style={{ width: 90, color: 'var(--gr)' }}>{fecha(p.fecha)}</span>
                        {bi ? <><span style={{ width: 90 }}>I {fmt(g, p.I)}</span><span style={{ width: 90 }}>D {fmt(g, p.D)}</span>{asim(p) != null && <span style={{ color: 'var(--gr)' }}>{asim(p)}%</span>}</> : <span>{fmt(g, p.U)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
