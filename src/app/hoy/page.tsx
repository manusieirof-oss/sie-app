'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { hoyISO } from '@/lib/fechas'
import { hhmm, aMin } from '@/lib/movil'
import { cargarTurnos, nombresDe, Turno } from '@/lib/turnos'
import { testsPorDia } from '@/lib/evaluaciones'
import { testsPorConfirmar } from '@/lib/mantenimiento'
import CaraPaciente from '@/components/CaraPaciente'

// HOY: LA PORTADA DE SIE.
//
// No guarda nada propio: LEE de los pilares y lo junta para empezar el día sin saber
// dónde está cada cosa. La clase de ahora con cada persona (sesión, alertas, molestias,
// tests que tocan) y, al tocarla, su taller; lo que viene luego; las tareas del equipo y
// tus notas personales. Quien entra como Dirección ve además un resumen del día.

const nombre = (p: any) => (p?.nombre_clinica || `${p?.nombre || ''} ${p?.apellidos || ''}`).trim()
const LBL: Record<string, string> = { dolor: 'Dolor', lesion: 'Lesión', cita_medica: 'Cita médica', personal: 'Personal', duda: 'Duda', otro: 'Aviso' }

export default function Hoy() {
  const router = useRouter()
  const hoy = hoyISO()
  const [yo, setYo] = useState<{ id: string, nombre: string, dir: boolean } | null>(null)
  const [citas, setCitas] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [molestias, setMolestias] = useState<any[]>([])
  const [tests, setTests] = useState<Record<string, string[]>>({})
  const [tareas, setTareas] = useState<any[]>([])
  const [notas, setNotas] = useState<any[]>([])
  const [nueva, setNueva] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [cobros, setCobros] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [, setTic] = useState(0)

  // El reloj de la portada: la clase "de ahora" cambia sola al pasar la hora.
  useEffect(() => { const t = setInterval(() => setTic(x => x + 1), 60_000); return () => clearInterval(t) }, [])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: pf } = await supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle()
      let comoEntrenador = false
      // Cualquier «ver como» (un nivel o el antiguo 'entrenador') quita lo de dirección.
      try { comoEntrenador = !!localStorage.getItem('sie_ver_como') } catch {}
      setYo({ id: user.id, nombre: (pf?.nombre || user.email || '').split(' ')[0], dir: pf?.rol === 'admin' && !comoEntrenador })

      const { data: cs } = await supabase.from('citas')
        .select('id,hora,sala,tipo,estado,paciente_id,sesion_id,pacientes(id,nombre,apellidos,nombre_clinica,foto_url),sesiones:sesion_id(nombre)')
        .eq('fecha', hoy).neq('estado', 'cancelada').not('paciente_id', 'is', null).order('hora')
      setCitas(cs || [])
      const ids = Array.from(new Set((cs || []).map((c: any) => c.paciente_id)))
      const [{ data: al }, { data: mo }, { data: ta }, { data: no }, { data: bo }] = await Promise.all([
        ids.length ? supabase.from('alertas_paciente').select('paciente_id,tipo,afecta_sesion,descripcion').eq('activa', true).in('paciente_id', ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? supabase.from('molestias').select('paciente_id,zona,lado,eva,activa').in('paciente_id', ids) : Promise.resolve({ data: [] as any[] }),
        supabase.from('tareas').select('*').eq('completada', false).order('fecha_limite', { ascending: true, nullsFirst: false }),
        supabase.from('notas_personales').select('*').order('hecha').order('creado', { ascending: false }),
        supabase.from('bonos').select('estado_pago').eq('activo', true).in('estado_pago', ['pendiente', 'impago']),
      ])
      setAlertas(al || []); setMolestias((mo || []).filter((m: any) => m.activa !== false))
      setTareas((ta || []).filter((t: any) => !t.asignado_a || t.asignado_a === user.id))
      setNotas(no || []); setCobros((bo || []).length)
      setTurnos(await cargarTurnos())
      setCargando(false)
    })()
  }, [hoy])

  // ---- Clases: hora + sala. "Ahora" = la última que ha empezado, si fue hace menos de 70 min ----
  const clases = Object.values(citas.reduce((acc: Record<string, any>, c: any) => {
    const k = hhmm(c.hora) + '|' + (c.sala || '')
    ;(acc[k] ||= { hora: hhmm(c.hora), sala: c.sala, citas: [] as any[] }).citas.push(c)
    return acc
  }, {})).sort((a: any, b: any) => a.hora.localeCompare(b.hora) || String(a.sala).localeCompare(String(b.sala))) as any[]
  const min = new Date().getHours() * 60 + new Date().getMinutes()
  const empezadas = clases.filter(c => aMin(c.hora) <= min && min - aMin(c.hora) <= 70)
  const horaAhora = empezadas.length ? empezadas[empezadas.length - 1].hora : null
  const ahora = clases.filter(c => c.hora === horaAhora)
  const luego = clases.filter(c => aMin(c.hora) > min)
  const destacadas = ahora.length ? ahora : luego.filter(c => c.hora === luego[0]?.hora)
  const resto = luego.filter(c => !destacadas.includes(c))

  // Tests que tocan hoy: solo a la gente de la clase destacada (es lo que se va a mirar).
  const idsDest = destacadas.flatMap(c => c.citas.map((x: any) => x.paciente_id)).join(',')
  useEffect(() => {
    if (!idsDest) return
    let vivo = true
    ;(async () => {
      const out: Record<string, string[]> = {}
      for (const pid of idsDest.split(',')) {
        try {
          const [porDia, mant] = await Promise.all([testsPorDia(pid), testsPorConfirmar(pid, hoy)])
          const lista = [...(porDia[hoy] || []).map((x: any) => x.test?.nombre), ...mant.tests.map((x: any) => x.test?.nombre), ...mant.sinTest.map((x: any) => x.nombre)].filter(Boolean)
          if (lista.length) out[pid] = Array.from(new Set(lista))
        } catch { /* sin tests */ }
      }
      if (vivo) setTests(out)
    })()
    return () => { vivo = false }
  }, [idsDest, hoy])

  // ---- Tareas y notas ----
  async function hecha(t: any) {
    setTareas(p => p.filter(x => x.id !== t.id))
    await supabase.from('tareas').update({ completada: true, fecha_completada: new Date().toISOString(), completada_por: yo?.id || null }).eq('id', t.id)
  }
  async function anotar() {
    const texto = nueva.trim(); if (!texto) return
    setNueva('')
    const { data } = await supabase.from('notas_personales').insert({ texto }).select().single()
    if (data) setNotas(p => [data, ...p])
  }
  async function marcarNota(n: any) {
    setNotas(p => p.map(x => x.id === n.id ? { ...x, hecha: !x.hecha } : x))
    await supabase.from('notas_personales').update({ hecha: !n.hecha }).eq('id', n.id)
  }
  async function borrarNota(n: any) {
    setNotas(p => p.filter(x => x.id !== n.id))
    await supabase.from('notas_personales').delete().eq('id', n.id)
  }

  const irTaller = (hora: string, pid?: string) => router.push(`/taller?h=${hora}${pid ? `&p=${pid}` : ''}`)
  const caja: React.CSSProperties = { background: '#fff', borderRadius: 18, boxShadow: '0 2px 12px rgba(38,40,37,.07)', padding: 16 }
  const chip = (fondo: string, color: string): React.CSSProperties => ({ fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 600, background: fondo, color, whiteSpace: 'nowrap' })
  const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 22px 40px' }}>
      <h1 style={{ fontSize: 26, margin: 0, fontWeight: 600 }}>Hola{yo?.nombre ? `, ${yo.nombre}` : ''}</h1>
      <div style={{ color: 'var(--gr)', marginBottom: 18, textTransform: 'capitalize' }}>{fecha} · {hora}</div>

      {/* DIRECCIÓN: el día de un vistazo. */}
      {yo?.dir && !cargando && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            ['Citas hoy', citas.length, '/agenda', ''],
            ['Sin sesión', citas.filter(c => !c.sesion_id && c.estado === 'programada').length, '/taller', '#8a6d1f'],
            ['Faltas', citas.filter(c => c.estado === 'falta').length, '/agenda', ''],
            ['Cobros pendientes', cobros, '/cobros', ''],
          ].map(([k, v, href, col]) => (
            <Link key={k as string} href={href as string} style={{ ...caja, padding: '12px 14px', textDecoration: 'none', color: 'var(--n)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--gr)' }}>{k}</div><b style={{ fontSize: 22, color: (col as string) || undefined }}>{v}</b>
            </Link>
          ))}
        </div>
      )}

      {cargando ? <div style={{ color: 'var(--gr)' }}>Cargando el día…</div> : destacadas.length === 0 ? (
        <div style={{ ...caja, color: 'var(--gr)', marginBottom: 16 }}>No quedan clases hoy.</div>
      ) : destacadas.map(c => {
        const sinSes = c.citas.filter((x: any) => !x.sesion_id).length
        const quien = nombresDe(turnos, hoy, c.hora, c.sala).join(' · ')
        return (
          <section key={c.hora + c.sala} style={{ ...caja, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={chip(ahora.length ? 'var(--g)' : 'var(--bl)', ahora.length ? '#fff' : 'var(--gr)')}>{ahora.length ? '● AHORA' : 'PRÓXIMA'}</span>
              <b style={{ fontSize: 18 }}>{c.hora}{c.sala ? ` · Sala ${c.sala}` : ''}</b>
              <span style={{ color: 'var(--gr)' }}>{c.citas.length} persona{c.citas.length === 1 ? '' : 's'}{sinSes ? ` · ${sinSes} sin sesión` : ''}{quien ? ` · ${quien}` : ''}</span>
              <span style={{ flex: 1 }}/>
              <button className="btn btn-p" onClick={() => irTaller(c.hora)}>Abrir la clase en el Taller →</button>
            </div>
            {c.citas.map((x: any) => {
              const p = x.pacientes, als = alertas.filter(a => a.paciente_id === x.paciente_id), mols = molestias.filter(m => m.paciente_id === x.paciente_id)
              const ts = tests[x.paciente_id] || []
              const limpio = !als.length && !mols.length && !ts.length && x.sesion_id
              return (
                <div key={x.id} onClick={() => irTaller(c.hora, x.paciente_id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderTop: '1px solid var(--bl)', cursor: 'pointer', borderRadius: 12, flexWrap: 'wrap' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'var(--gl)')} onMouseOut={e => (e.currentTarget.style.background = '')}>
                  <span style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flex: 'none', display: 'grid' }}><CaraPaciente p={p}/></span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, textDecoration: x.estado === 'falta' ? 'line-through' : undefined }}>{nombre(p)}{x.estado === 'falta' ? ' · falta' : ''}</div>
                    <div style={{ fontSize: 12.5, color: x.sesion_id ? 'var(--gr)' : '#8a6d1f' }}>{x.sesion_id ? (x.sesiones?.nombre || 'Sesión') : 'Sin sesión hoy · toca asignar'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {als.map((a, i) => <span key={'a' + i} title={a.descripcion || ''} style={chip('var(--redl)', 'var(--red)')}>⚠ {LBL[a.tipo] || 'Aviso'}{a.descripcion ? ` · ${String(a.descripcion).slice(0, 34)}` : ''}{a.afecta_sesion ? ' · afecta sesión' : ''}</span>)}
                    {mols.map((m, i) => <span key={'m' + i} style={chip('var(--redl)', 'var(--red)')}>⚠ Molestia {m.zona}{m.lado ? ` ${m.lado}` : ''}{m.eva != null ? ` (EVA ${m.eva})` : ''}</span>)}
                    {ts.slice(0, 2).map(t => <span key={t} style={chip('var(--ambl)', '#7A5800')}>📋 {t}</span>)}
                    {ts.length > 2 && <span style={chip('var(--ambl)', '#7A5800')}>+{ts.length - 2} tests</span>}
                    {limpio && <span style={chip('var(--gl)', 'var(--gd)')}>✓ Todo en orden</span>}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <section style={caja}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Luego</h3>
          {resto.length === 0 && <div style={{ fontSize: 13, color: 'var(--gr)' }}>Nada más hoy.</div>}
          {resto.map(c => {
            const sinSes = c.citas.filter((x: any) => !x.sesion_id).length
            const nAl = c.citas.filter((x: any) => alertas.some(a => a.paciente_id === x.paciente_id) || molestias.some(m => m.paciente_id === x.paciente_id)).length
            return (
              <div key={c.hora + c.sala} onClick={() => irTaller(c.hora)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--bl)', fontSize: 13.5, cursor: 'pointer', flexWrap: 'wrap' }}>
                <b style={{ width: 48 }}>{c.hora}</b>
                <span style={{ display: 'flex' }}>{c.citas.slice(0, 4).map((x: any, i: number) => <span key={x.id} style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', marginLeft: i ? -6 : 0, border: '2px solid #fff', display: 'grid' }}><CaraPaciente p={x.pacientes}/></span>)}</span>
                <span style={{ color: 'var(--gr)' }}>{c.citas.length} · Sala {c.sala}
                  {sinSes ? <span style={{ color: '#8a6d1f' }}> · {sinSes} sin sesión</span> : null}
                  {nAl ? <span style={{ color: 'var(--red)' }}> · {nAl} con aviso</span> : null}</span>
              </div>
            )
          })}
        </section>

        <section style={caja}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Tareas del equipo</h3>
          {tareas.length === 0 && <div style={{ fontSize: 13, color: 'var(--gr)' }}>Sin tareas pendientes.</div>}
          {tareas.slice(0, 8).map(t => (
            <label key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--bl)', fontSize: 13.5, cursor: 'pointer' }}>
              <input type="checkbox" onChange={() => hecha(t)} style={{ marginTop: 3 }}/>
              <span>{t.titulo}{t.fecha_limite && <span style={{ display: 'block', fontSize: 12, color: t.fecha_limite < hoy ? 'var(--red)' : 'var(--grl)' }}>{t.fecha_limite < hoy ? 'Vencida · ' : ''}{new Date(t.fecha_limite + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>}</span>
            </label>
          ))}
          {tareas.length > 8 && <Link href="/agenda" style={{ fontSize: 12.5, color: 'var(--gd)' }}>Ver las {tareas.length} en la agenda →</Link>}
        </section>

        {/* NOTAS PERSONALES: solo las ve quien las escribe (RLS por usuario). Para
            acordarse de algo propio sin llenar las tareas del equipo. */}
        <section style={caja}>
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Mis notas <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--grl)' }}>· solo las ves tú</span></h3>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="input" value={nueva} onChange={e => setNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && anotar()}
              placeholder="Apunta algo para ti…" style={{ flex: 1, fontSize: 14 }}/>
            <button className="btn btn-p btn-sm" onClick={anotar} disabled={!nueva.trim()}>Añadir</button>
          </div>
          {notas.length === 0 && <div style={{ fontSize: 13, color: 'var(--gr)' }}>Nada apuntado.</div>}
          {notas.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: '1px solid var(--bl)', fontSize: 13.5 }}>
              <input type="checkbox" checked={!!n.hecha} onChange={() => marcarNota(n)} style={{ marginTop: 3 }}/>
              <span style={{ flex: 1, textDecoration: n.hecha ? 'line-through' : undefined, color: n.hecha ? 'var(--grl)' : undefined, whiteSpace: 'pre-wrap' }}>{n.texto}</span>
              <button onClick={() => borrarNota(n)} title="Borrar" style={{ border: 0, background: 'transparent', color: 'var(--grl)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
