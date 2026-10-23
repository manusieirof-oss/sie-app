'use client'
import { apuntarHistorial } from '@/lib/sesionViva'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { categoriaDe } from '@/lib/etiquetas'
import { useConfigTrabajo } from '@/components/TrabajoEjercicio'
import { indices } from '@/lib/mapaTrabajo'
import { registrarSesion } from '@/lib/sesiones'
import {
  type PlanCalor, type Mesa, citasDeFase, grupoDe, MIN_SESIONES_GRUPO, LETRA, colSes, bloques, segTxt, fechaCorta, clonar,
} from '@/lib/planCalor'
import {
  type ParteEst, type ConfigSes, type MixSes, type Ov, type Lado, type EjCat, type ParteMontada,
  configVacia, catalogo, montarSesion, alternativas, aPartes, pideSesion, cubre, opcionesEje, MIX_DEFECTO, LADOS,
} from '@/lib/montarCalor'

// ---------------------------------------------------------------------------
// LAS SESIONES MONTADAS (torno → mapa de calor → "Crear sesiones").
//
// Una columna por sesión distinta (A, B, C…) de la fase activa, con sus partes y sus
// ejercicios sacados de la biblioteca. Se cambia un ejercicio (↻), se fija (📌), se quita,
// se rehace lo no fijado, se toca la ejecución o la lateralidad de uno, y con dos velos se
// ajusta la estructura y la mezcla de lateralidad/ejecución de una o varias sesiones.
// "Dar por buenas" crea las sesiones y las pone en sus citas.
// ---------------------------------------------------------------------------

const COLC = { obj: '#5A969E', zon: '#3F7880', mov: '#8FB9BE' } as const
const LATC: Record<string, string> = { Bilateral: '#6E716C', Unilateral: '#8C6BB1', Alterno: '#2F8F83' }
const EJEC: Record<string, string> = { conc: '#5A969E', exc: '#B5527A', iso: '#4C7CB5', expl: '#D9663A', plio: '#C9A227', eest: '#6E9F5A', efnp: '#9A7B4F', ebal: '#B5527A', edin: '#2F8F83' }
const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function SesionesCalorPage({ params }: { params: { id: string } }) {
  const pid = params.id
  const router = useRouter()
  const cfg = useConfigTrabajo()

  // ---------------- datos ----------------
  const [plan, setPlan] = useState<PlanCalor | null>(null)
  const planId = useRef<string | null>(null)
  const [pac, setPac] = useState<any>(null)
  const [citas, setCitas] = useState<any[]>([])
  const [dur, setDur] = useState(50)
  const [tm, setTm] = useState<any>(null)
  const [ets, setEts] = useState<any[]>([])
  const [objs, setObjs] = useState<any[]>([])
  const [ejs, setEjs] = useState<any[]>([])
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [pl, p, ci, aj, et, po, ej] = await Promise.all([
        supabase.from('planes_calor').select('id,datos').eq('paciente_id', pid).order('actualizado', { ascending: false }).limit(1),
        supabase.from('pacientes').select('nombre,apellidos,nombre_clinica,fecha_nacimiento,sexo').eq('id', pid).maybeSingle(),
        supabase.from('citas').select('id,fecha,hora,sesion_id').eq('paciente_id', pid).gte('fecha', hoyISO()).neq('estado', 'cancelada').order('fecha').order('hora'),
        supabase.from('ajustes').select('clave,valor').in('clave', ['clinica_duracion_clase', 'calor_trabajo_medio']),
        supabase.from('etiquetas').select('id,nombre,categoria,padre_id'),
        supabase.from('pacientes_objetivos').select('logrado,nombre,objetivo_id,objetivos(id,nombre,articulacion_id,etiquetas,movimientos)').eq('paciente_id', pid),
        traerTodo((d, h) => supabase.from('ejercicios').select('*').order('nombre').range(d, h)),
      ])
      if (!vivo) return
      planId.current = pl.data?.[0]?.id || null
      setPlan(pl.data?.[0]?.datos || null)
      setPac(p.data); setCitas(ci.data || [])
      const a = Object.fromEntries((aj.data || []).map((x: any) => [x.clave, x.valor]))
      setDur(parseInt(a.clinica_duracion_clase || '50') || 50)
      try { const t = JSON.parse(a.calor_trabajo_medio || ''); if (t?.v === 2) setTm(t) } catch { /* sin media: 40% */ }
      setEts(et.data || [])
      setObjs((po.data || []).filter((r: any) => !r.logrado && r.objetivos).map((r: any) => ({ ...r.objetivos, nombre: r.nombre || r.objetivos.nombre })))
      setEjs(ej.filas || [])
      setCargado(true)
    })()
    return () => { vivo = false }
  }, [pid])

  // ---------------- la fase activa ----------------
  const act = plan?.faseAct ?? 0
  const mesa: Mesa | null = plan?.porFase[act] || null
  const dias = useMemo(() => {
    if (!citas.length) return []
    const d0 = +new Date(citas[0].fecha + 'T12:00:00')
    return citas.map(c => Math.round((+new Date(c.fecha + 'T12:00:00') - d0) / 864e5))
  }, [citas])
  const hayFases = !!plan?.fases.l.length
  const GI = plan && dias.length ? (hayFases ? citasDeFase(plan, dias, act) : dias.map((_, i) => i)) : []
  const FF = GI.map(i => citas[i].fecha)
  const g = tm?.grupos?.[grupoDe(pac?.fecha_nacimiento, pac?.sexo)]
  const pct = g && g.n >= MIN_SESIONES_GRUPO ? g.p : tm?.general || 40
  const minSes = dur * pct / 100
  const nombreFase = hayFases ? plan!.fases.l[act].n : 'Plan'

  // ---------------- catálogo de la biblioteca ----------------
  const cat: EjCat[] = useMemo(() => {
    if (!ets.length || !ejs.length) return []
    const idx = indices(ets)
    const raices = new Set(ets.filter(e => !e.padre_id).map(e => e.id))
    const tags = ets.filter(e => (categoriaDe(ets, e) === 'patron' || categoriaDe(ets, e) === 'plano_eje') && !raices.has(e.id))
    return catalogo(ejs, idx, Object.fromEntries(ets.map(e => [e.id, e.nombre])), new Set(tags.map(t => t.id)), objs)
  }, [ets, ejs, objs])

  // ---------------- configuración de las sesiones (se guarda en el plan) ----------------
  const ses: ConfigSes = (mesa as any)?.ses || configVacia()
  const estDe = (L: string) => ses.E[L] || ses.E.todas
  const guardaSes = (fn: (s: ConfigSes) => void, afecta: string[]) => {
    afecta.forEach(L => { const si = LETRA.indexOf(L); Object.keys(elegido.current).filter(k => k.startsWith(si + '-')).forEach(k => delete elegido.current[k]) })
    setPlan(p => { const q = clonar(p!); const m: any = q.porFase[q.faseAct]; const s = m.ses ? m.ses : (m.ses = configVacia()); fn(s); return q })
  }
  useEffect(() => {
    if (!plan || !planId.current) return
    const t = setTimeout(() => { supabase.from('planes_calor').update({ datos: plan, actualizado: new Date().toISOString() }).eq('id', planId.current!) }, 900)
    return () => clearTimeout(t)
  }, [plan])

  // ---------------- montaje ----------------
  const elegido = useRef<Record<string, string[]>>({})
  const [ov, setOv] = useState<Record<string, Ov>>({})
  const [fijos, setFijos] = useState<Set<string>>(new Set())
  const [ver, setVer] = useState(0)
  const [semilla] = useState(() => Math.floor(Math.random() * 1000) + 1)
  const mont: ParteMontada[][] = useMemo(() => {
    if (!mesa || !cat.length) return []
    return Array.from({ length: mesa.nses }, (_, si) => montarSesion({
      m: mesa, si, partes: estDe(LETRA[si]), cat, cfg, minSes, mix: ses.MIX[LETRA[si]] || {}, elegido: elegido.current, ov, semilla,
    }))
  }, [mesa, cat, cfg, minSes, ov, ver, semilla, ses]) // eslint-disable-line react-hooks/exhaustive-deps
  const sesDe = (i: number) => (mesa ? i % mesa.nses : 0)
  const catDe = (k: string) => cat.find(c => c.id === k)

  const rehacer = () => {
    mont.forEach((s, si) => s.forEach((x, pi) => {
      const key = `${si}-${pi}`, l = elegido.current[key] || []
      l.forEach((k, ei) => {
        if (fijos.has(`${key}-${ei}`)) return
        const al = alternativas(cat, k, x.p, cfg).filter(a => a.enc >= 50 && !l.includes(a.c.id))
        if (al.length) l[ei] = al[Math.floor(Math.random() * Math.min(3, al.length))].c.id
      })
    }))
    setVer(v => v + 1)
  }

  // ---------------- velos ----------------
  const [velo, setVelo] = useState<null | 'estr' | 'mix' | 'cambiar' | 'crear'>(null)
  const [cambio, setCambio] = useState<{ si: number, pi: number, ei: number } | null>(null)
  const [selS, setSelS] = useState<string[]>([])
  const [menu, setMenu] = useState<null | { id: string, k: string, campo: 'eje' | 'lado', ops: string[], x: number, y: number }>(null)
  useEffect(() => { const c = () => setMenu(null); addEventListener('click', c); return () => removeEventListener('click', c) }, [])

  // ---------------- crear ----------------
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  async function crear() {
    if (!mesa || !plan) return
    setCreando(true); setError('')
    const ids: string[] = []
    for (let si = 0; si < mesa.nses; si++) {
      const partes = aPartes(mont[si], cat, cfg, objs)
      const { data, error } = await supabase.from('sesiones').insert({
        paciente_id: pid, nombre: `${nombreFase} · Sesión ${LETRA[si]}`, descripcion: 'Montada con el mapa de calor',
        duracion_min: dur, estado: 'lista', partes,
      }).select('id').single()
      if (error || !data) { setError('No se pudo crear la sesión ' + LETRA[si] + ': ' + (error?.message || '')); setCreando(false); return }
      await apuntarHistorial(data.id, pid, 'inicio', 'Montada con el mapa de calor', 'Mapa de calor', partes)
      ids.push(data.id)
      const ob = Array.from(new Set(partes.flatMap((p: any) => p.ejercicios.flatMap((e: any) => e.objetivos || []))))
      if (ob.length) await supabase.from('sesiones_objetivos').insert(ob.map(objetivo_id => ({ sesion_id: data.id, objetivo_id })))
      const enCitas = GI.filter((_, j) => sesDe(j) === si).map(i => citas[i].id)
      if (enCitas.length) {
        const { error: e2 } = await supabase.from('citas').update({ sesion_id: data.id }).in('id', enCitas)
        if (e2) { setError('La sesión ' + LETRA[si] + ' se creó pero no se pudo poner en sus citas: ' + e2.message); setCreando(false); return }
      }
    }
    await registrarSesion(pid, `Sesiones creadas con el mapa de calor (${nombreFase})`, `${ids.length} sesiones en ${GI.length} citas`)
    const q = clonar(plan); q.estadoF[act] = 'creada'; (q.porFase[act] as any).creadas = ids
    if (planId.current) await supabase.from('planes_calor').update({ datos: q, actualizado: new Date().toISOString() }).eq('id', planId.current)
    router.push(`/torno/${pid}/calor`)
  }

  if (!cargado) return <div style={{ padding: 40, color: 'var(--grl)' }}>Montando las sesiones…</div>
  if (!plan || !mesa) return <div style={{ padding: 40 }}>No hay plan preparado. <button className="btn btn-s btn-sm" onClick={() => router.push(`/torno/${pid}/calor`)}>Ir a la mesa</button></div>
  if (!cat.length) return <div style={{ padding: 40 }}>La biblioteca está vacía.</div>
  const nombre = (pac?.nombre_clinica || `${pac?.nombre || ''} ${pac?.apellidos || ''}`).trim()
  const yaTienen = GI.filter(i => citas[i].sesion_id).length

  // ---------------- piezas de pantalla ----------------
  const barra = (p: ParteEst[]) => <div className="ms-estr">{p.map((x, i) => <span key={i} style={{ flex: x.p, background: colInt(x.i[0]) }} title={`${x.n} ${x.p}%`}>{x.n} {x.p}%</span>)}</div>
  const colInt = (id: string) => cfg.intensidades.find(i => i.id === id)?.color || '#A9ABA6'
  const nomInt = (id: string) => cfg.intensidades.find(i => i.id === id)?.nombre || id
  const nomEje = (id?: string) => cfg.ejecuciones.find(e => e.id === id)?.nombre || ''

  return (
    <div className="ms">
      <style>{CSS}</style>
      <div className="ms-top">
        <button className="btn btn-t btn-sm" onClick={() => router.push(`/torno/${pid}/calor`)}>← Volver a la mesa</button>
        <span className="ms-chip">{nombreFase} · {GI.length} citas{FF.length ? ` · ${fechaCorta(FF[0])} → ${fechaCorta(FF[FF.length - 1])}` : ''}</span>
        <span style={{ flex: 1 }} />
        <b style={{ fontSize: 15 }}>{nombre}</b>
        <button className="btn btn-s btn-sm" onClick={rehacer}>↻ Rehacer lo no fijado</button>
        <button className="btn btn-p btn-sm" onClick={() => setVelo('crear')}>Dar por buenas y asignar a sus citas</button>
      </div>
      <div className="ms-res">
        <div><div className="k">Sesiones</div><b>{mesa.nses} distintas</b>{mesa.rep > 1 && <span className="g"> · reparte todo cada {mesa.rep}: {bloques(mesa).map(b => b.join('+')).join(' · ')}</span>}</div>
        <div><div className="k">Trabajo por sesión</div><b>{segTxt(minSes)}</b> <span className="g">de {dur} min</span></div>
        <div style={{ minWidth: 220 }}><div className="k">Estructura</div>{barra(ses.E.todas)}{Object.keys(ses.E).length > 1 && <div className="ms-nota">+ {Object.keys(ses.E).length - 1} con estructura propia</div>}</div>
        <button className="btn btn-s btn-sm" onClick={() => { setSelS(LETRA.slice(0, mesa.nses).split('')); setVelo('estr') }}>Estructura e intensidades</button>
        <span className="ms-nota" style={{ marginLeft: 'auto' }}><b>↻</b> cambiar · <b>📌</b> fijar · toca ejecución o lateralidad para cambiarlas</span>
      </div>

      <div className="ms-cols">
        {mont.map((M, si) => {
          const L = LETRA[si], tot = M.reduce((n, x) => n + x.seg, 0) / 60
          const pide = pideSesion(mesa, si, minSes)
          const fechas = FF.filter((_, i) => sesDe(i) === si)
          const cuenta: Record<string, number> = {}; let n = 0
          M.forEach(x => x.ejs.forEach(e => { cuenta[e.lado] = (cuenta[e.lado] || 0) + 1; n++ }))
          return <div key={si} className="ms-ses">
            <div className="cab" style={{ borderTopColor: colSes(si) }}>
              <h3 style={{ color: colSes(si) }}>Sesión {L} <small>{fechas.length} citas · {fechas.map(fechaCorta).slice(0, 3).join(' · ')}{fechas.length > 3 ? '…' : ''}</small></h3>
              <div className="tiempo"><span>Trabajo</span><span className={'b' + (tot > minSes * 1.08 ? ' mas' : '')}><i style={{ width: Math.min(100, tot / minSes * 100) + '%' }} /></span><b>{segTxt(tot)}</b><span>/ {segTxt(minSes)}</span></div>
              {barra(estDe(L))}
              <button className="ms-mixbtn" onClick={() => { setSelS([L]); setVelo('mix') }}><span>Lateralidad y ejecución</span>
                <small>{ses.MIX[L]?.lat || ses.MIX[L]?.eje ? <b>a mano · </b> : ''}{Object.entries(cuenta).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v / (n || 1) * 100)}%`).join(' · ')}</small></button>
              <div className="cubre">{pide.map(({ el, min }) => {
                const h = M.reduce((s, x) => s + x.ejs.reduce((t, e) => t + (catDe(e.k) && cubre(catDe(e.k)!, el) ? e.trabajo : 0), 0), 0) / 60, r = min ? h / min : 1
                return <div key={el.capa + el.k} className="cb"><span><span style={{ color: COLC[el.capa] }}>● </span>{el.n}</span>
                  <span className="bb"><i style={{ width: Math.min(100, r * 50) + '%' }} /><u /></span>
                  <span className={'v ' + (r >= 0.8 ? 'ok' : 'no')}>{r >= 0.8 ? '✓ ' : ''}{segTxt(h)}</span></div>
              })}</div>
            </div>
            {M.map((x, pi) => {
              const g = Math.max(2, x.p.g || 3)
              return <div key={pi} className="parte">
                <div className="pn"><span>{x.p.n}{x.p.i.map(i => <i key={i} style={{ background: colInt(i) }}>{nomInt(i)}</i>)}</span><span>{segTxt(x.seg / 60)}</span></div>
                {x.p.org !== 'ejercicio' && x.ejs.length > 1 && <div className="org">{x.p.org === 'superserie' ? `Superseries de ${g} en ${g}: seguidos, sin descanso entre ellos` : `Circuitos de ${g} ejercicios · ${Math.max(...x.ejs.map(e => e.series))} vueltas`}</div>}
                {!x.ejs.length && <div className="ms-nota" style={{ padding: '4px 6px' }}>Ningún ejercicio de la biblioteca admite esta intensidad.</div>}
                {x.ejs.map((e, ei) => {
                  const c = catDe(e.k)!, marca = x.p.org === 'superserie' ? String.fromCharCode(65 + Math.floor(ei / g)) + (ei % g + 1) : x.p.org === 'circuito' ? `${Math.floor(ei / g) + 1}.${ei % g + 1}` : ''
                  const borde = x.p.org !== 'ejercicio' ? (ei % g === 0 ? ' ss1' : ei % g === g - 1 || ei === x.ejs.length - 1 ? ' ss2' : ' ssm') : ''
                  return <div key={e.id} className={'ej' + (fijos.has(e.id) ? ' fijo' : '') + borde}>
                    {marca && <span className="marca">{marca}</span>}
                    <div className="img">{c.imagen_url ? <img src={c.imagen_url} alt="" /> : null}</div>
                    <div>
                      <div className="nm">{c.nombre}{e.lado === 'Unilateral' ? <span className="uni">×2</span> : e.lado === 'Alterno' ? <span className="uni" style={{ color: '#2F8F83' }}>×1,5</span> : null}</div>
                      <div className="dosis">{e.series} × {e.seg ? `${e.seg} s` : e.reps}{e.lado !== 'Bilateral' ? ' / lado' : ''} <span>· {segTxt(e.trabajo / 60)}</span></div>
                      <div className="tags">
                        {e.eje && <button className="tag tq" style={{ background: EJEC[e.eje] || '#6E716C', borderColor: EJEC[e.eje] || '#6E716C', color: '#fff' }}
                          onClick={ev => { ev.stopPropagation(); const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ id: e.id, k: e.k, campo: 'eje', ops: opcionesEje(cfg, e.int), x: r.left, y: r.bottom + 4 }) }}>{nomEje(e.eje)} ▾</button>}
                        <button className="tag tq" style={{ borderColor: 'var(--n)', color: 'var(--n)' }}
                          onClick={ev => { ev.stopPropagation(); const r = (ev.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ id: e.id, k: e.k, campo: 'lado', ops: LADOS, x: r.left, y: r.bottom + 4 }) }}>{e.lado} ▾</button>
                        {c.zonas.map(z => <span key={z} className="tag" style={{ borderColor: COLC.zon, color: COLC.zon }}>{z}</span>)}
                        {c.movs.slice(0, 2).map(m => <span key={m} className="tag" style={{ borderColor: COLC.mov, color: COLC.mov }}>{m}</span>)}
                        {c.objs.map(o => <span key={o} className="tag" style={{ borderColor: COLC.obj, color: COLC.obj }}>{o}</span>)}
                      </div>
                    </div>
                    <div className="acc">
                      <button title="Cambiar por otro que cubra lo mismo" onClick={() => { setCambio({ si, pi, ei }); setVelo('cambiar') }}>↻</button>
                      <button className={fijos.has(e.id) ? 'on' : ''} title="Fijar: no se cambia al rehacer" onClick={() => setFijos(f => { const n = new Set(f); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}>📌</button>
                      <button title="Quitar" onClick={() => { elegido.current[`${si}-${pi}`].splice(ei, 1); setVer(v => v + 1) }}>✕</button>
                    </div>
                  </div>
                })}
              </div>
            })}
          </div>
        })}
      </div>

      {menu && <div className="ms-menu" style={{ left: menu.x, top: menu.y }} onClick={e => e.stopPropagation()}>
        {menu.ops.map(o => <button key={o} style={menu.campo === 'eje' ? { borderLeft: `4px solid ${EJEC[o] || '#ccc'}` } : {}} onClick={() => {
          setOv(v => { const n = { ...v }, prev = n[menu.id]?.k === menu.k ? n[menu.id] : { k: menu.k }; n[menu.id] = { ...prev, [menu.campo]: o }; return n }); setMenu(null)
        }}>{menu.campo === 'eje' ? nomEje(o) : o}</button>)}
      </div>}

      {velo === 'cambiar' && cambio && (() => {
        const x = mont[cambio.si][cambio.pi], k = elegido.current[`${cambio.si}-${cambio.pi}`][cambio.ei], c = catDe(k)!
        return <Velo titulo={'Cambiar ' + c.nombre} sub={`Sesión ${LETRA[cambio.si]} · ${x.p.n} (${x.p.i.map(nomInt).join(', ')})`} onCerrar={() => setVelo(null)} pie={false}>
          <div className="ms-alts">{alternativas(cat, k, x.p, cfg).map(a => <button key={a.c.id} className="alt" onClick={() => { elegido.current[`${cambio.si}-${cambio.pi}`][cambio.ei] = a.c.id; setVer(v => v + 1); setVelo(null) }}>
            <div className="img">{a.c.imagen_url ? <img src={a.c.imagen_url} alt="" /> : null}</div>
            <div><div className="enc">{a.enc}% encaja</div><div className="nm">{a.c.nombre}</div>
              <div className="tags">{a.c.zonas.map(z => <span key={z} className="tag" style={{ borderColor: COLC.zon, color: COLC.zon }}>{z}</span>)}{a.c.movs.slice(0, 2).map(m => <span key={m} className="tag" style={{ borderColor: COLC.mov, color: COLC.mov }}>{m}</span>)}</div></div>
          </button>)}</div>
        </Velo>
      })()}

      {velo === 'estr' && <Velo titulo="Estructura e intensidades" sub="las partes de la sesión, cuánto tiempo lleva cada una y con qué intensidad" onCerrar={() => setVelo(null)}>
        <Selector mesa={mesa} sel={selS} setSel={setSelS} />
        <Estructura partes={estDe(selS[0] || 'A')} distintas={selS.some(L => JSON.stringify(estDe(L)) !== JSON.stringify(estDe(selS[0])))} cfg={cfg} minSes={minSes}
          onCambia={nuevas => guardaSes(s => { if (selS.length === mesa.nses) { s.E = { todas: nuevas } } else selS.forEach(L => { s.E[L] = clonar(nuevas) }) }, selS)} />
      </Velo>}

      {velo === 'mix' && <Velo titulo="Lateralidad y ejecución" sub="qué parte de los ejercicios va de cada manera" onCerrar={() => setVelo(null)}>
        <Selector mesa={mesa} sel={selS} setSel={setSelS} />
        <Mezcla mix={ses.MIX[selS[0]] || {}} cfg={cfg} usadas={new Set(mont[LETRA.indexOf(selS[0])]?.flatMap(x => x.ejs.map(e => e.int)) || [])}
          onCambia={m => guardaSes(s => { selS.forEach(L => { s.MIX[L] = clonar(m) }) }, selS)} />
      </Velo>}

      {velo === 'crear' && <Velo titulo="Dar por buenas" sub={`${mesa.nses} sesiones en ${GI.length} citas de ${nombreFase}`} onCerrar={() => setVelo(null)} pie={false}>
        <div className="ms-ctl">
          <div className="ms-sescrear">{Array.from({ length: mesa.nses }, (_, si) => <div key={si} style={{ borderTopColor: colSes(si) }}>
            <b style={{ color: colSes(si) }}>{nombreFase} · Sesión {LETRA[si]}</b>
            <span>{mont[si].reduce((n, x) => n + x.ejs.length, 0)} ejercicios · {segTxt(mont[si].reduce((n, x) => n + x.seg, 0) / 60)}</span>
            <span>{FF.filter((_, i) => sesDe(i) === si).map(fechaCorta).join(' · ')}</span></div>)}</div>
          {yaTienen > 0 && <div className="ms-aviso">⚠ {yaTienen} de estas citas ya tienen una sesión puesta: se cambiará por la nueva.</div>}
          {error && <div className="ms-aviso" style={{ background: '#FBE9E4' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-s" onClick={() => setVelo(null)}>Seguir retocando</button>
            <button className="btn btn-p" disabled={creando} onClick={crear}>{creando ? 'Creando…' : 'Crear y asignar'}</button>
          </div>
        </div>
      </Velo>}
    </div>
  )
}

// =========================================================================
function Velo({ titulo, sub, onCerrar, children, pie = true }: { titulo: string, sub?: string, onCerrar: () => void, children: React.ReactNode, pie?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onCerrar])
  return <div className="ms-velo">
    <div className="vh"><b>{titulo}</b>{sub && <span>{sub}</span>}<span style={{ flex: 1 }} /><button className="ms-x" onClick={onCerrar}>✕</button></div>
    <div className="vc">{children}</div>
    {pie && <div className="pie"><button className="btn btn-p" onClick={onCerrar}>Listo</button></div>}
  </div>
}

/** A qué sesiones se aplica: todas, por bloque, las que trabajan lo mismo, o sueltas. */
function Selector({ mesa, sel, setSel }: { mesa: Mesa, sel: string[], setSel: (l: string[]) => void }) {
  const todas = LETRA.slice(0, mesa.nses).split('')
  const grupos: [string, string[]][] = [['Todas', todas]]
  if (mesa.rep > 1) bloques(mesa).forEach((b, i) => grupos.push([`Bloque ${i + 1}`, b]))
  // sesiones con el mismo contenido (mismo reparto en la mesa)
  const por: Record<string, string[]> = {}
  todas.forEach((L, si) => { const f = pideSesion(mesa, si, 1).map(x => x.el.n).join(' · '); (por[f] ||= []).push(L) })
  Object.entries(por).filter(([, l]) => l.length > 1 && l.length < todas.length).forEach(([f, l]) => grupos.push([f, l]))
  const igual = (a: string[]) => a.length === sel.length && a.every(x => sel.includes(x))
  return <>
    <div className="ms-lbl" style={{ marginTop: 0 }}>Aplicar a</div>
    <div className="ms-tabs">{grupos.map(([n, l]) => <button key={n + l.join()} className={'tab' + (igual(l) ? ' on' : '')} onClick={() => setSel(l)}>{n} <small>{l.join('+')}</small></button>)}</div>
    <div className="ms-tabs">{todas.map((L, i) => { const on = sel.includes(L); return <button key={L} className={'tab' + (on ? ' on' : '')} style={on ? { background: colSes(i), borderColor: colSes(i) } : {}}
      onClick={() => setSel(on ? (sel.length > 1 ? sel.filter(x => x !== L) : sel) : [...sel, L])}>{on ? '✓ ' : ''}Sesión {L}</button> })}
      <span className="ms-nota" style={{ alignSelf: 'center' }}>toca para sumar o quitar sesiones</span></div>
  </>
}

/** Barra con asas: arrastrar una pasa % solo entre los dos tramos que separa (siempre suma 100). */
function Barra({ ent, cols, edit, onFin, alto = 40 }: { ent: [string, number, string?][], cols: (k: string) => string, edit: boolean, onFin: (v: Record<string, number>) => void, alto?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [vals, setVals] = useState<number[] | null>(null)
  const t = ent.reduce((n, [, v]) => n + v, 0) || 1
  const ps = vals || ent.map(([, v]) => v / t * 100)
  let acc = 0
  return <div className="ms-bar" ref={ref} style={{ height: alto }}>
    {ent.map(([k, , et], j) => { const p = ps[j]; acc += p; const izq = acc; return [
      <div key={k} className="sg" style={{ width: p + '%', background: cols(k) }}><b>{et || k}</b><span>{Math.round(p)}%</span></div>,
      edit && j < ent.length - 1 && <div key={k + 'a'} className="asa" style={{ left: izq + '%' }} onPointerDown={e => {
        const el = e.currentTarget; el.setPointerCapture(e.pointerId)
        const base = ent.map(([, v]) => v / t * 100), ini = base.slice(0, j).reduce((n, v) => n + v, 0), par = base[j] + base[j + 1]
        let cur = base
        el.onpointermove = ev => { const r = ref.current!.getBoundingClientRect(); const v = Math.max(0, Math.min(par, Math.round((ev.clientX - r.left) / r.width * 100 - ini))); cur = base.slice(); cur[j] = v; cur[j + 1] = par - v; setVals(cur) }
        el.onpointerup = () => { el.onpointermove = null; setVals(null); onFin(Object.fromEntries(ent.map(([k2], i) => [k2, Math.round(cur[i])]))) }
      }} />] })}
  </div>
}

function Estructura({ partes, distintas, cfg, minSes, onCambia }: { partes: ParteEst[], distintas: boolean, cfg: any, minSes: number, onCambia: (p: ParteEst[]) => void }) {
  const ed = (fn: (b: ParteEst[]) => void) => { const b = clonar(partes); fn(b); onCambia(b) }
  const ints = cfg.intensidades.filter((i: any) => i.id !== 'lib')
  const colI = (id: string) => cfg.intensidades.find((i: any) => i.id === id)?.color || '#A9ABA6'
  return <div className="ms-ctl">
    {distintas && <div className="ms-nota" style={{ color: '#C9A227' }}>Las elegidas tienen estructuras distintas: al tocar algo se igualan a la primera.</div>}
    <div className="ms-lbl">Reparto del tiempo · arrastra las asas blancas</div>
    <Barra ent={partes.map((p, i) => [String(i), p.p, `${p.n} · ${segTxt(minSes * p.p / 100)}`] as [string, number, string])} cols={k => colI(partes[+k].i[0])} edit
      onFin={v => ed(b => b.forEach((p, i) => { p.p = v[String(i)] }))} />
    <div className="ms-lbl">Partes</div>
    {partes.map((x, i) => <div key={i} className="ms-pcard">
      <div className="ms-pfila"><span className="dot" style={{ background: colI(x.i[0]) }} />
        <input className="input" value={x.n} onChange={e => ed(b => { b[i].n = e.target.value })} />
        <span className="ms-nota"><b style={{ color: 'var(--n)' }}>{x.p}%</b> · {segTxt(minSes * x.p / 100)}</span>
        <span className="ints">{ints.map((I: any) => { const on = x.i.includes(I.id); return <button key={I.id} className={on ? 'on' : ''} style={on ? { background: I.color } : {}}
          onClick={() => ed(b => { const y = b[i]; y.i = on ? y.i.filter(z => z !== I.id) : [...y.i, I.id]; if (!y.i.length) y.i = [I.id] })}>{I.nombre}</button> })}</span>
        <span className="acc2"><button disabled={i === 0} onClick={() => ed(b => { [b[i], b[i - 1]] = [b[i - 1], b[i]] })}>↑</button><button disabled={i === partes.length - 1} onClick={() => ed(b => { [b[i], b[i + 1]] = [b[i + 1], b[i]] })}>↓</button>
          <button disabled={partes.length < 2} onClick={() => ed(b => { const q = b[i].p; b.splice(i, 1); b[Math.max(0, i - 1)].p += q })}>✕</button></span>
      </div>
      <div className="ms-pfila2">Organización <span className="seg2">{([['ejercicio', 'Ejercicio a ejercicio'], ['superserie', 'Superserie'], ['circuito', 'Circuito']] as const).map(([k, t]) =>
        <button key={k} className={x.org === k ? 'on' : ''} onClick={() => ed(b => { b[i].org = k })}>{t}</button>)}</span>
        {x.org !== 'ejercicio' && <> de <span className="seg2"><button onClick={() => ed(b => { b[i].g = Math.max(2, (b[i].g || 3) - 1) })}>−</button><button className="on">{x.g || 3}</button><button onClick={() => ed(b => { b[i].g = Math.min(6, (b[i].g || 3) + 1) })}>+</button></span> en {x.g || 3}</>}
      </div>
    </div>)}
    <button className="ms-ch" onClick={() => ed(b => { const m = b.reduce((a, x) => (x.p > a.p ? x : a), b[0]), q = Math.min(10, Math.floor(m.p / 2)); m.p -= q; b.push({ n: 'Parte nueva', p: q, i: ['hiper'], org: 'ejercicio', g: 3 }) })}>+ Añadir parte</button>
    <div className="ms-nota">Cada parte llena su % del tiempo de trabajo con ejercicios: 2 series cada uno y 4 en fuerza. La intensidad decide la dosis y qué ejercicios caben. Ejecución y lateralidad se cambian en cada ejercicio y luego en el taller.</div>
  </div>
}

function Mezcla({ mix, cfg, usadas, onCambia }: { mix: MixSes, cfg: any, usadas: Set<string>, onCambia: (m: MixSes) => void }) {
  const ed = (fn: (m: MixSes) => void) => { const m = clonar(mix); fn(m); onCambia(m) }
  const nomE = (id: string) => cfg.ejecuciones.find((e: any) => e.id === id)?.nombre || id
  return <div className="ms-ctl">
    <div className="ms-lbl">Lateralidad</div>
    <div className="ms-mixrow"><b>Todos los ejercicios</b>
      <span className="seg2"><button className={mix.lat ? '' : 'on'} onClick={() => ed(m => { delete m.lat })}>Biblioteca</button><button className={mix.lat ? 'on' : ''} onClick={() => ed(m => { m.lat = { Bilateral: 60, Unilateral: 25, Alterno: 15 } })}>A mano</button></span>
      {mix.lat ? <Barra alto={32} ent={LADOS.map(l => [l, mix.lat![l] || 0] as [string, number])} cols={k => LATC[k]} edit onFin={v => ed(m => { m.lat = v })} /> : <span className="ms-nota">cada ejercicio con la de la biblioteca</span>}
    </div>
    <div className="ms-lbl">Ejecución por capacidad</div>
    {cfg.intensidades.filter((i: any) => i.id !== 'lib').map((I: any) => {
      const ops = opcionesEje(cfg, I.id), man = mix.eje?.[I.id], base = man || MIX_DEFECTO[I.id] || {}
      const ent = ops.map(o => [o, base[o] || 0, nomE(o)] as [string, number, string]).filter(([, v]) => man || v > 0)
      return <div key={I.id} className={'ms-mixrow' + (usadas.has(I.id) ? '' : ' apag')}>
        <span><b style={{ color: I.color }}>{I.nombre}</b>{!usadas.has(I.id) && <small>no está en esta sesión</small>}</span>
        {ops.length ? <>
          <span className="seg2"><button className={man ? '' : 'on'} onClick={() => ed(m => { if (m.eje) { delete m.eje[I.id]; if (!Object.keys(m.eje).length) delete m.eje } })}>Ajustes</button>
            <button className={man ? 'on' : ''} onClick={() => ed(m => { m.eje ||= {}; m.eje[I.id] = Object.fromEntries(ops.map(o => [o, (MIX_DEFECTO[I.id] || {})[o] || 0])) })}>A mano</button></span>
          {ent.length ? <Barra alto={32} ent={ent} cols={k => EJEC[k] || '#A9ABA6'} edit={!!man} onFin={v => ed(m => { m.eje![I.id] = v })} /> : <span className="ms-nota">—</span>}
        </> : <span className="ms-nota">sin ejecución</span>}
      </div>
    })}
    <div className="ms-nota">«Ajustes» usa la mezcla por defecto de cada capacidad. Arrastra las asas para repartir a mano. Tocar la etiqueta de un ejercicio manda sobre esto.</div>
  </div>
}

const CSS = `
.ms{background:#fff;border-radius:14px;overflow:hidden}
.ms-top{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.ms-chip{font-size:11.5px;padding:3px 10px;border-radius:99px;background:var(--gl);color:var(--gd)}
.ms-res{display:flex;gap:18px;padding:12px 18px;border-bottom:1px solid var(--bd);align-items:center;flex-wrap:wrap}
.ms-res .k{font-size:11px;color:var(--grl);text-transform:uppercase;letter-spacing:.05em}.ms-res b{font-size:15px}.ms-res .g{color:var(--gr)}
.ms-nota{font-size:11.5px;color:var(--grl);line-height:1.4}
.ms-lbl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);margin:14px 0 6px;font-weight:600}
.ms-estr{display:flex;gap:3px;margin-top:6px}
.ms-estr span{height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9.5px;color:#fff;font-weight:600;overflow:hidden;white-space:nowrap;padding:0 4px}
.ms-cols{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(330px,1fr);gap:14px;padding:16px 18px;overflow-x:auto;align-items:start}
.ms-ses{border:1px solid var(--bd);border-radius:18px;background:#fff;overflow:hidden}
.ms-ses .cab{padding:12px 14px 10px;border-top:5px solid}
.ms-ses h3{margin:0;font-size:17px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.ms-ses h3 small{font-size:11px;color:var(--grl);font-weight:400}
.tiempo{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11.5px;color:var(--gr)}
.tiempo .b{flex:1;height:8px;border-radius:8px;background:var(--bl);overflow:hidden}.tiempo .b i{display:block;height:100%;background:var(--g);border-radius:8px}.tiempo .b.mas i{background:#E8A33D}
.ms-mixbtn{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;margin-top:8px;border:1px dashed var(--bd);border-radius:10px;background:#fff;padding:6px 10px;text-align:left;cursor:pointer;font-family:inherit}
.ms-mixbtn span{font-size:12px;font-weight:600;color:var(--gd)}.ms-mixbtn small{font-size:10.5px;color:var(--gr)}.ms-mixbtn:hover{border-color:var(--g)}
.cubre{margin-top:8px;display:flex;flex-direction:column;gap:3px}
.cb{display:grid;grid-template-columns:1fr 80px 80px;gap:6px;align-items:center;font-size:11.5px}
.cb .bb{height:5px;border-radius:4px;background:var(--bl);position:relative}.cb .bb i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--g)}
.cb .bb u{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:var(--n);opacity:.5}
.cb .v{text-align:right;color:var(--gr);white-space:nowrap}.cb .v.ok{color:var(--gd)}.cb .v.no{color:#C9A227}
.parte{border-top:1px solid var(--bd);padding:8px 10px 10px}
.parte .pn{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);font-weight:600;margin:2px 4px 6px;display:flex;justify-content:space-between;gap:6px}
.parte .pn i{font-style:normal;font-weight:600;padding:1px 7px;border-radius:99px;color:#fff;text-transform:none;letter-spacing:0;font-size:10px;margin-left:6px}
.org{font-size:11px;color:var(--gd);background:var(--gl);border-radius:8px;padding:4px 8px;margin:0 4px 6px}
.ej{display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;padding:7px 6px 7px 10px;border-radius:12px;position:relative}
.ej:hover{background:var(--bl)}.ej.fijo{background:var(--gl)}
.ej.ssm{border-left:3px solid var(--g);border-radius:0}.ej.ss1{border-left:3px solid var(--g);border-radius:0 12px 0 0;margin-top:4px}.ej.ss2{border-left:3px solid var(--g);border-radius:0 0 12px 0;margin-bottom:6px}
.marca{position:absolute;left:-2px;top:6px;font-size:10px;font-weight:700;color:#fff;background:var(--gd);border-radius:6px;padding:1px 5px;z-index:1}
.img{width:48px;height:48px;border-radius:10px;overflow:hidden;background:linear-gradient(135deg,#E7F1F2,#D3E6E8)}.img img{width:100%;height:100%;object-fit:cover}
.ej .nm{font-size:13px;font-weight:600;line-height:1.2}.ej .dosis{font-size:11.5px;color:var(--n);margin-top:2px}.ej .dosis span{color:var(--grl)}
.uni{font-size:10px;font-weight:700;color:#8C6BB1;margin-left:4px}
.tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.tag{font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid;background:#fff}
.tag.tq{cursor:pointer;font-family:inherit}.tag.tq:hover{box-shadow:0 2px 6px rgba(0,0,0,.12)}
.acc{display:flex;flex-direction:column;gap:4px;opacity:.35;transition:.15s}.ej:hover .acc,.ej.fijo .acc{opacity:1}
.acc button{width:28px;height:28px;border-radius:8px;border:1px solid var(--bd);background:#fff;display:grid;place-items:center;color:var(--gr);font-size:13px;cursor:pointer}
.acc button.on{background:var(--g);border-color:var(--g);color:#fff}
.ms-menu{position:fixed;z-index:90;background:#fff;border:1px solid var(--bd);border-radius:10px;box-shadow:0 10px 26px rgba(38,40,37,.16);padding:4px;display:flex;flex-direction:column;min-width:170px}
.ms-menu button{border:0;background:#fff;text-align:left;padding:7px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;font-family:inherit}.ms-menu button:hover{background:var(--bl)}
.ms-velo{position:fixed;inset:28px;z-index:60;background:rgba(255,255,255,.94);backdrop-filter:blur(4px);border:1px solid var(--bd);border-radius:22px;box-shadow:0 20px 60px rgba(38,40,37,.18);display:flex;flex-direction:column;padding:22px 26px}
.ms-velo .vh{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}.ms-velo .vh b{font-size:20px}.ms-velo .vh span{color:var(--gr)}
.ms-velo .vc{flex:1;overflow:auto;min-height:0}.ms-velo .pie{display:flex;justify-content:flex-end;margin-top:12px}
.ms-x{width:30px;height:30px;border-radius:50%;border:1px solid var(--bd);background:#fff;cursor:pointer}
.ms-ctl{display:flex;flex-direction:column;gap:10px}
.ms-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}
.ms-tabs .tab{padding:6px 14px;border-radius:99px;border:1.5px solid var(--bd);background:#fff;font-size:13px;cursor:pointer;font-family:inherit}
.ms-tabs .tab small{opacity:.7;font-size:11px}.ms-tabs .tab.on{color:#fff;background:var(--g);border-color:var(--g)}
.ms-bar{position:relative;border-radius:12px;overflow:hidden;display:flex;touch-action:none;user-select:none;flex:1;min-width:240px}
.ms-bar .sg{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:11px;line-height:1.15;white-space:nowrap;overflow:hidden;min-width:0}
.ms-bar .asa{position:absolute;top:0;bottom:0;width:18px;margin-left:-9px;cursor:ew-resize;display:grid;place-items:center;z-index:2}
.ms-bar .asa::after{content:'';width:5px;height:60%;border-radius:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.18)}
.ms-pcard{border-bottom:1px dashed var(--bd);padding:6px 0 10px}
.ms-pfila{display:grid;grid-template-columns:14px 1.2fr 110px 1.8fr 96px;gap:10px;align-items:center;padding:4px 0}
.ms-pfila .dot{width:12px;height:12px;border-radius:50%}
.ints{display:flex;gap:4px;flex-wrap:wrap}.ints button{font-size:11.5px;padding:3px 9px;border-radius:99px;border:1px solid var(--bd);background:#fff;cursor:pointer;font-family:inherit}.ints button.on{color:#fff;border-color:transparent}
.acc2{display:flex;gap:4px;justify-content:flex-end}.acc2 button{width:26px;height:26px;border-radius:8px;border:1px solid var(--bd);background:#fff;color:var(--gr);cursor:pointer}.acc2 button:disabled{opacity:.3}
.ms-pfila2{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-left:24px;font-size:12px;color:var(--gr)}
.seg2{display:inline-flex;border:1px solid var(--bd);border-radius:9px;overflow:hidden}
.seg2 button{border:0;background:#fff;padding:4px 10px;font-size:11.5px;border-right:1px solid var(--bd);cursor:pointer;font-family:inherit;white-space:nowrap}.seg2 button:last-child{border-right:0}.seg2 button.on{background:var(--g);color:#fff}
.ms-ch{align-self:flex-start;padding:6px 12px;border-radius:99px;border:1px solid var(--bd);background:#fff;font-size:13px;cursor:pointer;font-family:inherit}
.ms-mixrow{display:grid;grid-template-columns:180px auto 1fr;gap:12px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--bd)}
.ms-mixrow small{display:block;font-size:10.5px;color:var(--grl)}.ms-mixrow.apag{opacity:.5}
.ms-alts{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;padding:8px 2px}
.ms-alts .alt{border:1.5px solid var(--bd);border-radius:14px;background:#fff;padding:12px;text-align:left;display:grid;grid-template-columns:56px 1fr;gap:10px;cursor:pointer;font-family:inherit}
.ms-alts .alt:hover{border-color:var(--g)}.ms-alts .img{width:56px;height:56px}.ms-alts .enc{font-size:11px;font-weight:700;color:var(--gd)}.ms-alts .nm{font-weight:600}
.ms-sescrear{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.ms-sescrear div{border:1px solid var(--bd);border-top:4px solid;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--gr)}
.ms-aviso{padding:10px 12px;border-radius:10px;background:#FFF4D6;font-size:13px}
`
