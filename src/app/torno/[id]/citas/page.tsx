'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { cargarSistema, sistemasDePaciente, tramos } from '@/lib/sistemas'
import { registrarSesion } from '@/lib/sesiones'

// ---------------------------------------------------------------------------
// PONERLO EN SUS CITAS
//
// Lo último del torno: lo programado se engancha a sus citas y queda listo. Un
// calendario grande con sus citas por delante y, arriba, sus sesiones como fichas
// de color. Dos formas, que se mezclan:
//
//   - A MANO: tocas una ficha (es el pincel) y tocas citas. Tocar una cita que ya
//     tiene esa sesión la vacía.
//   - REPARTIR: eliges una o varias sesiones (rotan en el orden en que las tocas),
//     cada cuántas citas y hasta cuándo. Se pinta en el calendario y se corrige a
//     mano antes de confirmar.
//
// Si es un ciclo, cada sesión solo cae en las citas de las fechas de su fase: la
// sesión de la fase 2 no puede acabar en un día de la fase 1.
//
// Nada se escribe hasta "Confirmar": se cambian de golpe solo las citas tocadas.
// ---------------------------------------------------------------------------

type Cita = { id: string, fecha: string, hora: string | null, sala: string | null, sesion_id: string | null }
type Ses = { id: string, nombre: string, color: string, desde: string | null, hasta: string | null, fase?: string }

const COLORES = ['#5A969E', '#C9A84C', '#B0708C', '#6E8FC7', '#7C9A6B', '#C77F5A', '#8A7CC7', '#4F9C8A']
const leer = () => {
  if (typeof window === 'undefined') return { ses: [] as string[], sis: '' }
  const q = new URLSearchParams(window.location.search)
  return { ses: (q.get('ses') || '').split(',').filter(Boolean), sis: q.get('sis') || '' }
}
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const corta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function CitasTorno({ params }: { params: { id: string } }) {
  const router = useRouter()
  const pid = params.id
  const [q] = useState(leer)
  const [nombre, setNombre] = useState('')
  const [citas, setCitas] = useState<Cita[]>([])
  const [sesiones, setSesiones] = useState<Ses[]>([])
  const [otras, setOtras] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<Record<string, string | null>>({})
  const [pincel, setPincel] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  // Repartir
  const [rot, setRot] = useState<string[]>([])
  const [cada, setCada] = useState(1)
  const [limite, setLimite] = useState<'todas' | 'veces' | 'hasta'>('todas')
  const [veces, setVeces] = useState(8)
  const [hasta, setHasta] = useState('')
  const [pisar, setPisar] = useState(false)

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    const hoy = hoyISO()
    const [{ data: p }, { data: cs }] = await Promise.all([
      supabase.from('pacientes').select('nombre,apellidos,nombre_clinica').eq('id', pid).maybeSingle(),
      supabase.from('citas').select('id,fecha,hora,sala,sesion_id').eq('paciente_id', pid)
        .gte('fecha', hoy).neq('estado', 'cancelada').order('fecha').order('hora'),
    ])
    setNombre((p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim())
    setCitas((cs || []) as Cita[])

    // Las sesiones: las de la URL, o las del ciclo con las fechas de su fase.
    let lista: Ses[] = []
    if (q.sis) {
      const [sis, asig] = await Promise.all([cargarSistema(q.sis), sistemasDePaciente(pid)])
      const a = asig.find(x => x.sistema_id === q.sis)
      const tr = sis && a ? tramos(sis, a) : []
      const ids = (sis?.fases || []).flatMap(f => f.sesiones || [])
      const { data: ss } = ids.length ? await supabase.from('sesiones').select('id,nombre').in('id', ids) : { data: [] as any[] }
      let k = 0
      ;(sis?.fases || []).forEach(f => {
        const t = tr.find(x => x.fase.id === f.id)
        ;(f.sesiones || []).forEach(sid => {
          const s = (ss || []).find((x: any) => x.id === sid)
          if (s) lista.push({ id: s.id, nombre: s.nombre, color: COLORES[k++ % COLORES.length], desde: t?.desde || null, hasta: t?.hasta || null, fase: f.nombre })
        })
      })
    } else if (q.ses.length) {
      const { data: ss } = await supabase.from('sesiones').select('id,nombre').in('id', q.ses)
      lista = q.ses.map((id, k) => {
        const s = (ss || []).find((x: any) => x.id === id)
        return s ? { id, nombre: s.nombre, color: COLORES[k % COLORES.length], desde: null, hasta: null } : null
      }).filter(Boolean) as Ses[]
    }
    setSesiones(lista)
    setRot(lista.slice(0, 1).map(s => s.id))
    setPincel(lista[0]?.id || null)

    // Lo que ya tienen sus citas: si es de las nuestras sale en su color; si es otra,
    // en gris con su nombre, y no se pisa salvo que se diga.
    const ajenas = Array.from(new Set((cs || []).map((c: any) => c.sesion_id).filter((id: any) => id && !lista.some(s => s.id === id))))
    if (ajenas.length) {
      const { data: aj } = await supabase.from('sesiones').select('id,nombre').in('id', ajenas)
      setOtras(Object.fromEntries((aj || []).map((x: any) => [x.id, x.nombre])))
    }
    setPlan(Object.fromEntries((cs || []).map((c: any) => [c.id, c.sesion_id || null])))
    setCargando(false)
  }

  const sesDe = (id: string | null) => sesiones.find(s => s.id === id)
  const cabe = (s: Ses, f: string) => (!s.desde || f >= s.desde) && (!s.hasta || f <= s.hasta)

  function tocarCita(c: Cita) {
    if (!pincel) return
    const s = sesDe(pincel)!
    if (!cabe(s, c.fecha)) { alert(`«${s.nombre}» es de ${s.fase || 'otra fase'}: ese día cae fuera.`); return }
    setPlan(p => ({ ...p, [c.id]: p[c.id] === pincel ? null : pincel }))
  }

  /** REPARTIR: misma regla para la vista y para lo que se guarda. */
  function repartir() {
    if (rot.length === 0) return
    const nuevo = { ...plan }
    let puestas = 0, paso = 0, i = 0
    for (const c of citas) {
      if (limite === 'hasta' && hasta && c.fecha > hasta) break
      if (limite === 'veces' && puestas >= veces) break
      const actual = nuevo[c.id]
      const libre = !actual || sesiones.some(s => s.id === actual) || pisar
      if (!libre) continue
      // Cada N citas: se cuentan las que podrían llevarla, no las del calendario.
      if (paso++ % cada !== 0) continue
      // La que toca en la rotación y que además cabe en las fechas de su fase.
      let puesta = false
      for (let k = 0; k < rot.length; k++) {
        const s = sesDe(rot[(i + k) % rot.length])
        if (s && cabe(s, c.fecha)) { nuevo[c.id] = s.id; i = i + k + 1; puesta = true; break }
      }
      if (puesta) puestas++
    }
    setPlan(nuevo)
  }

  const cambios = citas.filter(c => (plan[c.id] || null) !== (c.sesion_id || null))

  async function confirmar() {
    setGuardando(true)
    // Agrupado por sesión: una actualización por cada una, no una por cita.
    const grupos: Record<string, string[]> = {}
    cambios.forEach(c => { const k = plan[c.id] || '∅'; (grupos[k] = grupos[k] || []).push(c.id) })
    for (const [k, ids] of Object.entries(grupos)) {
      const { error } = await supabase.from('citas').update({ sesion_id: k === '∅' ? null : k }).in('id', ids)
      if (error) { setGuardando(false); alert('No se han guardado todas: ' + error.message); return }
    }
    await registrarSesion(pid, `Sesiones puestas en ${cambios.length} cita${cambios.length === 1 ? '' : 's'}`, 'Desde el torno')
    setGuardando(false)
    router.push(`/pacientes/${pid}?tab=entreno`)
  }

  // ---- El calendario: de este mes al de la última cita ----------------------
  const meses = useMemo(() => {
    if (citas.length === 0) return []
    const ini = new Date(); ini.setDate(1)
    const fin = new Date(citas[citas.length - 1].fecha + 'T12:00:00')
    const out: Date[] = []
    const d = new Date(ini.getFullYear(), ini.getMonth(), 1)
    while (d <= fin && out.length < 12) { out.push(new Date(d)); d.setMonth(d.getMonth() + 1) }
    return out
  }, [citas])
  const porDia = useMemo(() => {
    const m: Record<string, Cita[]> = {}
    citas.forEach(c => { (m[c.fecha] = m[c.fecha] || []).push(c) })
    return m
  }, [citas])
  const hoy = hoyISO()

  return (
    <div className="tc">
      <style>{`
        .tc { background:#fff; margin:-16px -18px; padding:18px 22px 110px; min-height:calc(100vh - 32px) }
        @keyframes tc-entra { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        .tc-ficha { display:inline-flex; align-items:center; gap:7px; padding:7px 13px; border-radius:99px; cursor:pointer;
                    font-family:inherit; font-size:12.5px; background:#fff; transition: transform .15s ease, box-shadow .15s ease }
        .tc-ficha:hover { transform: translateY(-2px) }
        .tc-mes { animation: tc-entra .45s ease backwards }
        .tc-cita { display:block; width:100%; border:none; border-radius:6px; padding:3px 4px; margin-top:3px; cursor:pointer;
                   font-family:inherit; font-size:10.5px; line-height:1.25; text-align:left; transition: transform .12s ease }
        .tc-cita:hover { transform: scale(1.04) }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button className="btn btn-t btn-sm" onClick={() => router.push(`/pacientes/${pid}?tab=entreno`)}>Ahora no</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 17 }}>{nombre || '…'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--gd)' }}>Ponerlo en sus citas</div>
        </div>
        <div style={{ width: 80 }}/>
      </div>

      {cargando ? <div className="muted" style={{ textAlign: 'center', padding: 40 }}>Trayendo sus citas…</div> : citas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gr)', fontSize: 13.5 }}>
          No tiene citas por delante. Pónselas en la agenda y vuelve: lo programado ya está guardado en su ficha.
        </div>
      ) : (
        <>
          {/* LAS FICHAS: el pincel. Tocas una y tocas citas. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
            {sesiones.map(s => {
              const on = pincel === s.id
              const n = citas.filter(c => plan[c.id] === s.id).length
              return (
                <button key={s.id} className="tc-ficha" onClick={() => setPincel(on ? null : s.id)}
                  title={s.desde || s.hasta ? `${s.fase} · ${s.desde ? corta(s.desde) : '…'} – ${s.hasta ? corta(s.hasta) : '…'}` : ''}
                  style={{ border: `2px solid ${s.color}`, boxShadow: on ? `0 0 0 3px ${s.color}40, 0 8px 18px rgba(38,40,37,.14)` : 'none',
                    background: on ? s.color : '#fff', color: on ? '#fff' : 'var(--n)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: on ? '#fff' : s.color }}/>
                  {s.nombre}
                  {s.fase && <span style={{ opacity: .7, fontSize: 11 }}>· {s.fase}</span>}
                  <b style={{ fontWeight: 600 }}>{n}</b>
                </button>
              )
            })}
          </div>

          {/* REPARTIR: rotación, cada cuántas y hasta cuándo. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center',
            padding: '10px 14px', borderRadius: 14, background: 'var(--bl)', maxWidth: 980, margin: '0 auto 20px', fontSize: 12.5 }}>
            <span style={{ color: 'var(--gr)' }}>Repartir</span>
            {sesiones.map(s => {
              const k = rot.indexOf(s.id)
              return (
                <button key={s.id} type="button" onClick={() => setRot(r => r.includes(s.id) ? r.filter(x => x !== s.id) : [...r, s.id])}
                  style={{ fontFamily: 'inherit', fontSize: 11.5, padding: '3px 9px', borderRadius: 99, cursor: 'pointer',
                    border: `1px solid ${s.color}`, background: k >= 0 ? s.color : 'transparent', color: k >= 0 ? '#fff' : 'var(--gr)' }}>
                  {k >= 0 ? `${k + 1}. ` : ''}{s.nombre}
                </button>
              )
            })}
            <select className="input" value={cada} onChange={e => setCada(Number(e.target.value))} style={{ width: 'auto', fontSize: 12 }}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 1 ? 'cada cita' : `cada ${n} citas`}</option>)}
            </select>
            <select className="input" value={limite} onChange={e => setLimite(e.target.value as any)} style={{ width: 'auto', fontSize: 12 }}>
              <option value="todas">todas las citas</option>
              <option value="veces">un número de veces</option>
              <option value="hasta">hasta una fecha</option>
            </select>
            {limite === 'veces' && <input className="input" type="number" min={1} value={veces} onChange={e => setVeces(Math.max(1, Number(e.target.value) || 1))} style={{ width: 64, fontSize: 12 }}/>}
            {limite === 'hasta' && <input className="input" type="date" value={hasta} min={hoy} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', fontSize: 12 }}/>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--gr)', fontSize: 11.5 }}>
              <input type="checkbox" checked={pisar} onChange={e => setPisar(e.target.checked)}/> pisar las que ya tienen otra
            </label>
            <button className="btn btn-s btn-sm" disabled={rot.length === 0} onClick={repartir}>Pintar</button>
          </div>

          {/* EL CALENDARIO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 22, maxWidth: 1300, margin: '0 auto' }}>
            {meses.map((m, mi) => {
              const primero = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7
              const nDias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
              const celdas: (string | null)[] = [...Array(primero).fill(null), ...Array.from({ length: nDias }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1)))]
              return (
                <div key={mi} className="tc-mes" style={{ animationDelay: `${mi * 60}ms` }}>
                  <div style={{ fontSize: 14, marginBottom: 8, textTransform: 'capitalize' }}>
                    {m.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {DIAS.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--grl)', textAlign: 'center' }}>{d}</div>)}
                    {celdas.map((f, i) => {
                      if (!f) return <div key={i}/>
                      const cs = porDia[f] || []
                      const pasado = f < hoy
                      return (
                        <div key={i} style={{ minHeight: 46, borderRadius: 8, padding: 3, background: cs.length ? 'var(--bl)' : 'transparent', opacity: pasado ? .35 : 1 }}>
                          <div style={{ fontSize: 10, color: f === hoy ? 'var(--gd)' : 'var(--grl)', fontWeight: f === hoy ? 700 : 400 }}>{Number(f.slice(8))}</div>
                          {cs.map(c => {
                            const sid = plan[c.id]
                            const s = sesDe(sid || null)
                            const ajena = sid && !s ? otras[sid] || 'otra sesión' : null
                            const cambiada = (sid || null) !== (c.sesion_id || null)
                            return (
                              <button key={c.id} className="tc-cita" onClick={() => tocarCita(c)}
                                title={`${c.hora ? String(c.hora).slice(0, 5) : ''} ${s ? s.nombre : ajena || 'sin sesión'}`}
                                style={{ background: s ? s.color : ajena ? 'var(--bm)' : '#fff', color: s ? '#fff' : 'var(--gr)',
                                  border: s ? 'none' : '1px dashed var(--bd)', boxShadow: cambiada ? '0 0 0 2px var(--n)' : 'none' }}>
                                {c.hora ? String(c.hora).slice(0, 5) : '·'}
                                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9.5, opacity: .9 }}>
                                  {s ? s.nombre : ajena || ''}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* CONFIRMAR, abajo y fijo. */}
      {cambios.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--w)', border: '1px solid var(--bd)',
            borderRadius: 99, padding: '8px 10px 8px 18px', boxShadow: '0 12px 30px rgba(38,40,37,.18)' }}>
            <span style={{ fontSize: 13 }}>{cambios.length} cita{cambios.length === 1 ? '' : 's'} cambiada{cambios.length === 1 ? '' : 's'}</span>
            <button className="btn btn-t btn-sm" onClick={() => setPlan(Object.fromEntries(citas.map(c => [c.id, c.sesion_id || null])))}>Deshacer</button>
            <button className="btn btn-p" disabled={guardando} onClick={confirmar}><Ic name="ok" size={13}/> {guardando ? 'Guardando…' : 'Confirmar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
