'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { cargarSistema, sistemasDePaciente, tramos } from '@/lib/sistemas'
import { registrarSesion } from '@/lib/sesiones'
import MonedaObjetivo from '@/components/MonedaObjetivo'

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
type Ses = { id: string, nombre: string, color: string, desde: string | null, hasta: string | null, fase?: string, ciclo?: string, partes?: any[], objs?: any[] }
type Ciclo = { id: string, nombre: string, color: string, fases: { nombre: string, desde: string | null, hasta: string | null, sesiones: string[] }[] }

const COLORES = ['#5A969E', '#C9A84C', '#B0708C', '#6E8FC7', '#7C9A6B', '#C77F5A', '#8A7CC7', '#4F9C8A']
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const corta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function CitasTorno({ params }: { params: { id: string } }) {
  const router = useRouter()
  const pid = params.id
  // useSearchParams y no window.location: al llegar navegando, en el primer render
  // la dirección todavía es la de antes, y salía sin ninguna sesión.
  const sp = useSearchParams()
  const q = { ses: (sp.get('ses') || '').split(',').filter(Boolean), sis: (sp.get('sis') || '').split(',').filter(Boolean) }
  const [nombre, setNombre] = useState('')
  const [citas, setCitas] = useState<Cita[]>([])
  const [sesiones, setSesiones] = useState<Ses[]>([])
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  /** El cuadrado abierto (grande, con lo que lleva dentro): 's:<id>' o 'c:<id>'. */
  const [abierto, setAbierto] = useState<string | null>(null)
  // La información abierta se cierra al tocar fuera o con Escape: antes no había forma.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('.tc-sq-w')) setAbierto(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(null) }
    document.addEventListener('mousedown', fuera); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])
  const [otras, setOtras] = useState<Record<string, string>>({})
  /**
   * LO QUE SE VE = lo que ya tenía + lo último pintado + lo tocado a mano.
   * Antes "Pintar" escribía encima del plan, así que la segunda vez partía de la
   * primera y no se podía probar otra combinación. Ahora cada "Pintar" sale de lo
   * que había, y lo tocado a mano se respeta encima.
   */
  const [pintado, setPintado] = useState<Record<string, string | null>>({})
  const [aMano, setAMano] = useState<Record<string, string | null>>({})
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

  useEffect(() => { cargar() }, [sp.toString()]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const cics: Ciclo[] = []
    let k = 0
    // Los ciclos, con las fechas de cada fase.
    if (q.sis.length) {
      const asig = await sistemasDePaciente(pid)
      for (const sisId of q.sis) {
        const sis = await cargarSistema(sisId)
        const a = asig.find(x => x.sistema_id === sisId)
        const tr = sis && a ? tramos(sis, a) : []
        const ids = (sis?.fases || []).flatMap(f => f.sesiones || [])
        const { data: ss } = ids.length ? await supabase.from('sesiones').select('id,nombre,partes,sesiones_objetivos(objetivos(id,nombre,imagen_url))').in('id', ids) : { data: [] as any[] }
        if (sis) cics.push({ id: sis.id, nombre: sis.nombre, color: sis.color || '#5A969E', fases: (sis.fases || []).map(f => { const t = tr.find(x => x.fase.id === f.id); return { nombre: f.nombre, desde: t?.desde || null, hasta: t?.hasta || null, sesiones: f.sesiones || [] } }) })
        ;(sis?.fases || []).forEach(f => {
          const t = tr.find(x => x.fase.id === f.id)
          ;(f.sesiones || []).forEach(sid => {
            const s = (ss || []).find((x: any) => x.id === sid)
            if (s) lista.push({ id: s.id, nombre: s.nombre, color: COLORES[k++ % COLORES.length], desde: t?.desde || null, hasta: t?.hasta || null, fase: f.nombre, ciclo: sisId, partes: s.partes || [], objs: (s.sesiones_objetivos || []).map((r: any) => r.objetivos).filter(Boolean) })
          })
        })
      }
    }
    // Las sesiones sueltas.
    if (q.ses.length) {
      const { data: ss } = await supabase.from('sesiones').select('id,nombre,partes,sesiones_objetivos(objetivos(id,nombre,imagen_url))').in('id', q.ses)
      q.ses.forEach(id => {
        const s = (ss || []).find((x: any) => x.id === id)
        if (s) lista.push({ id, nombre: s.nombre, color: COLORES[k++ % COLORES.length], desde: null, hasta: null, partes: s.partes || [], objs: (s.sesiones_objetivos || []).map((r: any) => r.objetivos).filter(Boolean) })
      })
    }
    setSesiones(lista)
    setCiclos(cics)
    setRot(lista.slice(0, 1).map(s => s.id))
    setPincel(lista[0]?.id || null)

    // Lo que ya tienen sus citas: si es de las nuestras sale en su color; si es otra,
    // en gris con su nombre, y no se pisa salvo que se diga.
    const ajenas = Array.from(new Set((cs || []).map((c: any) => c.sesion_id).filter((id: any) => id && !lista.some(s => s.id === id))))
    if (ajenas.length) {
      const { data: aj } = await supabase.from('sesiones').select('id,nombre').in('id', ajenas)
      setOtras(Object.fromEntries((aj || []).map((x: any) => [x.id, x.nombre])))
    }
    setCargando(false)
  }

  const original: Record<string, string | null> = useMemo(() => Object.fromEntries(citas.map(c => [c.id, c.sesion_id || null])), [citas])
  const plan: Record<string, string | null> = { ...original, ...pintado, ...aMano }
  const sesDe = (id: string | null) => sesiones.find(s => s.id === id)
  const cabe = (s: Ses, f: string) => (!s.desde || f >= s.desde) && (!s.hasta || f <= s.hasta)

  function tocarCita(c: Cita) {
    if (!pincel) return
    const s = sesDe(pincel)!
    if (!cabe(s, c.fecha)) { alert(`«${s.nombre}» es de ${s.fase || 'otra fase'}: ese día cae fuera.`); return }
    setAMano(m => ({ ...m, [c.id]: plan[c.id] === pincel ? null : pincel }))
  }

  /** REPARTIR: misma regla para la vista y para lo que se guarda. */
  function repartir() {
    if (rot.length === 0) return
    const nuevo: Record<string, string | null> = { ...original }
    let puestas = 0, paso = 0, i = 0
    for (const c of citas) {
      if (limite === 'hasta' && hasta && c.fecha > hasta) break
      if (limite === 'veces' && puestas >= veces) break
      if (c.id in aMano) continue
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
    // Solo lo que cambia respecto a lo que había.
    setPintado(Object.fromEntries(Object.entries(nuevo).filter(([id, v]) => v !== original[id])))
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
        .tc-sq-w { position:relative }
        .tc-sq-orden { position:absolute; top:6px; right:6px; min-width:22px; height:20px; padding:0 5px; border-radius:99px; background:#fff;
                       font-size:10.5px; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 4px rgba(38,40,37,.18); z-index:2 }
        .tc-sq-i { position:absolute; bottom:6px; right:6px; width:18px; height:18px; border-radius:99px; background:#fff; color:var(--gd);
                   font-size:11px; font-style:italic; font-weight:700; display:flex; align-items:center; justify-content:center; z-index:3;
                   box-shadow:0 1px 4px rgba(38,40,37,.18); cursor:pointer }
        .tc-rep { display:flex; flex-wrap:wrap; gap:6px 14px; align-items:center; justify-content:center; max-width:980px; margin:0 auto 18px;
                  font-size:13px; color:var(--gr) }
        .tc-rep b { color:var(--n); font-weight:500 } .tc-rep em { color:var(--grl) }
        .tc-rep select, .tc-rep input[type=number], .tc-rep input[type=date] { font-family:inherit; font-size:13px; color:var(--gd); background:transparent;
                  border:none; border-bottom:1.5px solid var(--gm); padding:2px 2px; cursor:pointer; outline:none }
        .tc-rep label { display:flex; align-items:center; gap:5px; font-size:12px; cursor:pointer }
        .tc-sq { position:relative; width:104px; height:104px; border:none; border-radius:16px; background:#fff; cursor:pointer; padding:0;
                 display:flex; flex-direction:column; align-items:center; font-family:inherit; text-align:center;
                 box-shadow:0 3px 12px rgba(38,40,37,.12); transition: transform .2s ease, box-shadow .2s ease; animation: tc-entra .45s ease backwards }
        .tc-sq:hover { transform: scale(1.06) }
        .tc-sq-fotos { position:absolute; inset:0; border-radius:16px; overflow:hidden; display:grid; background:var(--bl) }
        .tc-sq-fotos img { width:100%; height:100%; object-fit:cover; display:block; min-width:0; min-height:0 }
        .tc-sq-nom { position:absolute; left:0; right:0; bottom:0; padding:22px 6px 7px; font-size:11px; line-height:1.2; color:var(--n);
                     background:linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.96) 48%); border-radius:0 0 16px 16px }
        .tc-sq-n { position:absolute; top:6px; left:6px; min-width:20px; height:20px; padding:0 6px; border-radius:99px; color:#fff;
                   font-size:10.5px; font-weight:600; display:flex; align-items:center; justify-content:center }
        .tc-info { position:absolute; left:50%; top:calc(100% + 10px); transform:translateX(-50%); width:260px; z-index:15; text-align:left;
                   background:#fff; border-radius:14px; padding:12px 14px; box-shadow:0 16px 36px rgba(38,40,37,.2); animation: tc-entra .2s ease backwards }
        .tc-cita { display:block; width:100%; min-width:0; overflow:hidden; border:none; border-radius:6px; padding:3px 4px; margin-top:3px; cursor:pointer;
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
          {/* LAS FICHAS, EN CUADRADO: el mosaico de sus ejercicios y su color (el que se
              ve en el calendario). Tocar una la coge como pincel y la abre en grande con
              lo que lleva. Las de un ciclo van detrás del cuadrado de su ciclo. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 18 }}>
            {[...ciclos.map(c => ({ ciclo: c as Ciclo | null, ses: sesiones.filter(s => s.ciclo === c.id) })),
              ...(sesiones.some(s => !s.ciclo) ? [{ ciclo: null as Ciclo | null, ses: sesiones.filter(s => !s.ciclo) }] : [])].map((g, gi) => (
              <div key={gi} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                {g.ciclo && (() => {
                  const c = g.ciclo!
                  const ab = abierto === 'c:' + c.id
                  return (
                    <div className="tc-sq-w">
                      <button type="button" className="tc-sq" onClick={() => {
                          // El ciclo entero: todas sus sesiones al reparto, en su orden.
                          const suyas = sesiones.filter(x => x.ciclo === c.id).map(x => x.id)
                          const todas = suyas.every(id => rot.includes(id))
                          setRot(r => todas ? r.filter(x => !suyas.includes(x)) : [...r.filter(x => !suyas.includes(x)), ...suyas])
                          setPincel(todas ? null : suyas[0] || null)
                        }}
                        style={{ background: c.color, color: '#fff', justifyContent: 'center', padding: 10 }}>
                        <span style={{ fontSize: 10, letterSpacing: .6, textTransform: 'uppercase', opacity: .85 }}>Ciclo</span>
                        <span style={{ fontSize: 12.5, lineHeight: 1.25, marginTop: 3 }}>{c.nombre}</span>
                        <span style={{ fontSize: 10.5, opacity: .85, marginTop: 3 }}>{c.fases.length} fase{c.fases.length === 1 ? '' : 's'}</span>
                        <span className="tc-sq-i" title="Ver qué lleva" onClick={e => { e.stopPropagation(); setAbierto(ab ? null : 'c:' + c.id) }}>i</span>
                      </button>
                      {ab && (
                        <div className="tc-info">
                          {c.fases.map((f, fi) => (
                            <div key={fi} style={{ marginBottom: 7 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gd)' }}>{f.nombre}</div>
                              <div style={{ fontSize: 11, color: 'var(--grl)' }}>{f.desde ? corta(f.desde) : '…'} – {f.hasta ? corta(f.hasta) : 'sin fin'}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--gr)' }}>{f.sesiones.map(id => sesiones.find(x => x.id === id)?.nombre).filter(Boolean).join(' · ')}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {g.ses.map(s => {
                  const on = pincel === s.id
                  const ab = abierto === 's:' + s.id
                  const n = citas.filter(c => plan[c.id] === s.id).length
                  const ejs = (s.partes || []).flatMap((p: any) => p.ejercicios || [])
                  const fotos = ejs.slice(0, 4).map((e: any) => e.imagen_url || '')
                  return (
                    <div key={s.id} className="tc-sq-w">
                      <button type="button" className={`tc-sq ${on ? 'on' : ''}`}
                        onClick={() => {
                          // TOCAR = ELEGIRLA. Entra en el reparto (en el orden en que se tocan) y
                          // es el pincel para tocar días. Tocar otra vez la saca.
                          const dentro = rot.includes(s.id)
                          setRot(r => dentro ? r.filter(x => x !== s.id) : [...r, s.id])
                          setPincel(dentro ? (rot.filter(x => x !== s.id).slice(-1)[0] || null) : s.id)
                        }}
                        style={{ boxShadow: rot.includes(s.id) ? `0 0 0 3px ${s.color}, 0 12px 26px rgba(38,40,37,.18)` : undefined,
                          opacity: rot.length > 0 && !rot.includes(s.id) ? .55 : 1 }}>
                        <span className="tc-sq-fotos" style={{ gridTemplateColumns: fotos.length > 1 ? '1fr 1fr' : '1fr', gridTemplateRows: fotos.length > 2 ? '1fr 1fr' : '1fr' }}>
                          {fotos.map((src: string, k: number) => src
                            ? <img key={k} src={src} alt=""/>
                            : <span key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gm)', background: '#fff' }}><Ic name="fuerza" size={18}/></span>)}
                        </span>
                        <span className="tc-sq-nom">{s.nombre}</span>
                        <span className="tc-sq-n" style={{ background: s.color }} title="Citas con ella">{n}</span>
                        {rot.includes(s.id) && <span className="tc-sq-orden" style={{ color: s.color }}>{rot.indexOf(s.id) + 1}º</span>}
                        <span className="tc-sq-i" title="Ver qué lleva" onClick={e => { e.stopPropagation(); setAbierto(ab ? null : 's:' + s.id) }}>i</span>
                      </button>
                      {ab && (
                        <div className="tc-info">
                          {s.fase && <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>{s.fase}{s.desde ? ` · desde ${corta(s.desde)}` : ''}{s.hasta ? ` hasta ${corta(s.hasta)}` : ''}</div>}
                          {(s.objs || []).length > 0 && (
                            <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                              {(s.objs || []).map((o: any) => (
                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                                  <MonedaObjetivo objetivo={o} tam="mini"/> {o.nombre}
                                </div>
                              ))}
                            </div>
                          )}
                          {(s.partes || []).map((p: any, pi: number) => (
                            <div key={pi} style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gd)' }}>{p.nombre || `Parte ${pi + 1}`}</div>
                              <div style={{ fontSize: 11, color: 'var(--gr)', lineHeight: 1.4 }}>{(p.ejercicios || []).map((e: any) => e.nombre).join(' · ')}</div>
                            </div>
                          ))}
                          <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 4 }}>{n} cita{n === 1 ? '' : 's'} con ella</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* REPARTIR. Qué sesiones se eligen arriba, tocando los cuadrados; aquí solo
              cada cuántas, hasta cuándo y pintar. Sobre blanco, como una frase. */}
          <div className="tc-rep">
            <span>Repartir</span>
            <select value={cada} onChange={e => setCada(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n === 1 ? 'en cada cita' : `cada ${n} citas`}</option>)}
            </select>
            <select value={limite} onChange={e => setLimite(e.target.value as any)}>
              <option value="todas">en todas las citas</option>
              <option value="veces">un número de veces</option>
              <option value="hasta">hasta una fecha</option>
            </select>
            {limite === 'veces' && <input type="number" min={1} value={veces} onChange={e => setVeces(Math.max(1, Number(e.target.value) || 1))} style={{ width: 54 }}/>}
            {limite === 'hasta' && <input type="date" value={hasta} min={hoy} onChange={e => setHasta(e.target.value)}/>}
            <label><input type="checkbox" checked={pisar} onChange={e => setPisar(e.target.checked)}/> pisar las que ya tienen otra</label>
            <button className="btn btn-p btn-sm" disabled={rot.length === 0} onClick={repartir}>Pintar</button>
          </div>

          {/* EL CALENDARIO */}
          {/* Meses de ancho fijo, centrados. Con 1fr las celdas con cita se ensanchaban
              y descuadraban la semana entera. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 28, maxWidth: 1300, margin: '0 auto' }}>
            {meses.map((m, mi) => {
              const primero = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7
              const nDias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()
              const celdas: (string | null)[] = [...Array(primero).fill(null), ...Array.from({ length: nDias }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1)))]
              return (
                <div key={mi} className="tc-mes" style={{ animationDelay: `${mi * 60}ms`, width: 336 }}>
                  <div style={{ fontSize: 14, marginBottom: 8, textAlign: 'center', textTransform: 'capitalize' }}>
                    {m.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                    {DIAS.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--grl)', textAlign: 'center' }}>{d}</div>)}
                    {celdas.map((f, i) => {
                      if (!f) return <div key={i}/>
                      const cs = porDia[f] || []
                      const pasado = f < hoy
                      return (
                        <div key={i} onClick={() => { if (cs.length === 1) tocarCita(cs[0]) }}
                          style={{ minHeight: 50, minWidth: 0, borderRadius: 8, padding: 3, cursor: cs.length ? 'pointer' : 'default',
                            background: cs.length ? 'var(--bl)' : 'transparent', opacity: pasado ? .35 : 1 }}>
                          <div style={{ fontSize: 10, color: f === hoy ? 'var(--gd)' : 'var(--grl)', fontWeight: f === hoy ? 700 : 400 }}>{Number(f.slice(8))}</div>
                          {cs.map(c => {
                            const sid = plan[c.id]
                            const s = sesDe(sid || null)
                            const ajena = sid && !s ? otras[sid] || 'otra sesión' : null
                            return (
                              <button key={c.id} className="tc-cita" onClick={e => { e.stopPropagation(); tocarCita(c) }}
                                title={`${c.hora ? String(c.hora).slice(0, 5) : ''} ${s ? s.nombre : ajena || 'sin sesión'}`}
                                style={{ background: s ? s.color : ajena ? 'var(--bm)' : '#fff', color: s ? '#fff' : 'var(--gr)',
                                  border: s ? 'none' : '1px dashed var(--bd)' }}>
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
            <button className="btn btn-t btn-sm" onClick={() => { setPintado({}); setAMano({}) }}>Deshacer todo</button>
            <button className="btn btn-p" disabled={guardando} onClick={confirmar}><Ic name="ok" size={13}/> {guardando ? 'Guardando…' : 'Programar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
