'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { traerTodo } from '@/lib/paginar'
import { categoriaDe } from '@/lib/etiquetas'
import { useConfigTrabajo } from '@/components/TrabajoEjercicio'
import { ZONAS, MUS_RIG, indices, calcularMapa } from '@/lib/mapaTrabajo'
import type { MapaCalor3D } from '@/lib/anim3d/mapaCalor'
import CuboAlcance from '@/components/calor/CuboAlcance'
import {
  type PlanCalor, type Mesa, type Capa, type TipoFases, planVacio, mesaVacia, clonar,
  TRENES, ZPLAN, nombreZona, grupoDe, MIN_SESIONES_GRUPO, type TrabajoMedio, faseDe, citasDeFase,
  CAPAS, itemsDe, activas, pctCapa, pctItem, ponPctItem, lista,
  LETRA, colSes, contenido, bloques, frecTxt, PROGS, CONDS, bajaEn, curva, lineaPrograma,
  minTxt, segTxt, fechaCorta,
} from '@/lib/planCalor'

// ---------------------------------------------------------------------------
// MONTAR CON EL MAPA DE CALOR — la mesa del torno.
//
// Cuatro cartas a la vista, sin cambiar de pantalla (lo que se edita sale en un "velo"
// translúcido encima): alcance (sus citas reales y el cubo), a qué apunta, lo que tiene
// frente a lo que pedimos, y el reparto en sus citas. Se prepara fase a fase.
// El plan se guarda solo (planes_calor). Crear las sesiones es el siguiente paso.
// ---------------------------------------------------------------------------

const COLF = ['#5A969E', '#E8A33D', '#8C6BB1', '#D9663A', '#3F7880', '#C9A227']
const TIPOSF: [TipoFases, string, string][] = [
  ['tiempo', 'Por tiempo', 'cada fase dura sus semanas; avanza con el calendario, se venga o no'],
  ['ses', 'Por sesiones', 'cada fase dura un número de citas'],
  ['eval', 'Por evaluación', 'se pasa de fase al lograr su objetivo o test; la duración es una estimación'],
]
type Velo = null | 'obj' | 'mov' | 'zon' | 'tiempo' | 'rank' | 'comp' | 'sesiones' | 'proy' | 'fases' | 'inicio'
const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function CalorPage({ params }: { params: { id: string } }) {
  const pid = params.id
  const router = useRouter()
  const sp = useSearchParams()
  const cfg = useConfigTrabajo()

  // ---------------- datos ----------------
  const [pac, setPac] = useState<any>(null)
  const [citas, setCitas] = useState<{ id: string, fecha: string, hora: string | null }[] | null>(null)
  const [dur, setDur] = useState(50)
  const [tm, setTm] = useState<TrabajoMedio | null>(null)
  const tmViejo = useRef(false)
  const [objSuyos, setObjSuyos] = useState<string[]>([])
  const [objOtros, setObjOtros] = useState<string[]>([])
  const [ets, setEts] = useState<any[]>([])
  const [regs, setRegs] = useState<any[]>([])
  const [ejs, setEjs] = useState<Record<string, any>>({})
  const [plan, setPlan] = useState<PlanCalor | null>(null)
  const planId = useRef<string | null>(null)
  const [guardado, setGuardado] = useState<'' | 'guardando' | 'ok' | 'error'>('')

  const cargarCitas = useCallback(async () => {
    let q = supabase.from('citas').select('id,fecha,hora').eq('paciente_id', pid).gte('fecha', hoyISO()).neq('estado', 'cancelada').order('fecha').order('hora')
    const fin = sp.get('fin')
    if (fin) q = q.lte('fecha', fin)
    const { data } = await q
    setCitas(data || [])
  }, [pid, sp])

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const desde = new Date(Date.now() - 91 * 864e5).toISOString().slice(0, 10)
      const [p, aj, po, ob, et, rg, pl] = await Promise.all([
        supabase.from('pacientes').select('nombre,apellidos,nombre_clinica,fecha_nacimiento,sexo').eq('id', pid).maybeSingle(),
        supabase.from('ajustes').select('clave,valor').in('clave', ['clinica_duracion_clase', 'calor_trabajo_medio']),
        supabase.from('pacientes_objetivos').select('logrado,nombre,objetivos(nombre)').eq('paciente_id', pid),
        supabase.from('objetivos').select('nombre').order('nombre').limit(300),
        supabase.from('etiquetas').select('id,nombre,categoria,padre_id'),
        traerTodo((d, h) => supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen,sesion_id').eq('paciente_id', pid).gte('fecha', desde).order('id').range(d, h)),
        supabase.from('planes_calor').select('id,datos').eq('paciente_id', pid).order('actualizado', { ascending: false }).limit(1),
      ])
      if (!vivo) return
      setPac(p.data)
      const a = Object.fromEntries((aj.data || []).map((x: any) => [x.clave, x.valor]))
      setDur(parseInt(a.clinica_duracion_clase || '50') || 50)
      // Media guardada; si no hay o tiene más de una semana, se recalcula (abajo, con las etiquetas cargadas)
      try { const t = JSON.parse(a.calor_trabajo_medio || ''); if (t?.v === 2) { setTm(t); tmViejo.current = Date.now() - +new Date(t.fecha) > 7 * 864e5 } else tmViejo.current = true } catch { tmViejo.current = true }
      const suyos = (po.data || []).filter((r: any) => !r.logrado && r.objetivos).map((r: any) => r.nombre || r.objetivos.nombre)
      setObjSuyos(suyos)
      setObjOtros(Array.from(new Set((ob.data || []).map((r: any) => r.nombre))).filter((n: any) => !suyos.includes(n)).slice(0, 12) as string[])
      setEts(et.data || [])
      const filas = rg.filas || []
      const ids = Array.from(new Set(filas.map((r: any) => r.ejercicio_id).filter(Boolean)))
      const mapa: Record<string, any> = {}
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('ejercicios').select('id,nombre,trabajo,anatomia,tipo_medida,etiquetas').in('id', ids.slice(i, i + 200))
        ;(data || []).forEach((e: any) => { mapa[e.id] = e })
      }
      if (!vivo) return
      setEjs(mapa); setRegs(filas)
      if (pl.error) setGuardado('error')
      const fila = pl.data?.[0]
      planId.current = fila?.id || null
      setPlan(fila?.datos?.v === 1 ? fila.datos : planVacio())
    })()
    cargarCitas()
    // Al volver de la agenda (otra pestaña), se releen las citas
    const foco = () => cargarCitas()
    addEventListener('focus', foco)
    return () => { vivo = false; removeEventListener('focus', foco) }
  }, [pid, cargarCitas])

  // ---------------- trabajo real medio (de lo anotado en el taller) ----------------
  const idxMedio = useMemo(() => indices(ets), [ets])
  useEffect(() => {
    if (!ets.length || !tmViejo.current) return
    tmViejo.current = false
    ;(async () => {
      const desde = new Date(Date.now() - 91 * 864e5).toISOString().slice(0, 10)
      const { filas } = await traerTodo((d, h) => supabase.from('registros_ejercicio').select('paciente_id,fecha,ejercicio_id,series,regimen,sesion_id').gte('fecha', desde).order('id').range(d, h))
      const ids = Array.from(new Set((filas || []).map((r: any) => r.ejercicio_id).filter(Boolean))) as string[]
      const pids = Array.from(new Set((filas || []).map((r: any) => r.paciente_id).filter(Boolean))) as string[]
      const ej: Record<string, any> = {}, pa: Record<string, any> = {}
      for (let i = 0; i < ids.length; i += 200) { const { data } = await supabase.from('ejercicios').select('id,trabajo,anatomia,tipo_medida').in('id', ids.slice(i, i + 200)); (data || []).forEach((e: any) => { ej[e.id] = e }) }
      for (let i = 0; i < pids.length; i += 200) { const { data } = await supabase.from('pacientes').select('id,fecha_nacimiento,sexo').in('id', pids.slice(i, i + 200)); (data || []).forEach((p: any) => { pa[p.id] = p }) }
      // Una sesión = un paciente un día. Su trabajo / la duración de la clase.
      const ses: Record<string, any[]> = {}
      ;(filas || []).forEach((r: any) => { (ses[r.paciente_id + '|' + r.fecha] ||= []).push(r) })
      const todos: number[] = [], grupos: Record<string, number[]> = {}
      Object.entries(ses).forEach(([k, rs]) => {
        const seg = calcularMapa(rs, ej, idxMedio, cfg, { int: [], eje: [], combinada: false }).total
        const p = seg / 60 / dur * 100
        if (!(p > 0 && p <= 100)) return
        todos.push(p)
        const pac = pa[k.split('|')[0]]
        ;(grupos[grupoDe(pac?.fecha_nacimiento, pac?.sexo)] ||= []).push(p)
      })
      if (!todos.length) return
      const media = (l: number[]) => Math.round(l.reduce((n, v) => n + v, 0) / l.length)
      const t: TrabajoMedio = { v: 2, fecha: new Date().toISOString(), general: media(todos), n: todos.length,
        grupos: Object.fromEntries(Object.entries(grupos).map(([g, l]) => [g, { p: media(l), n: l.length }])) }
      setTm(t)
      await supabase.from('ajustes').upsert({ clave: 'calor_trabajo_medio', valor: JSON.stringify(t) }, { onConflict: 'clave' })
    })()
  }, [ets, idxMedio, cfg, dur])

  // ---------------- guardado automático ----------------
  const primera = useRef(true)
  useEffect(() => {
    if (!plan) return
    if (primera.current) { primera.current = false; return }
    setGuardado('guardando')
    const t = setTimeout(async () => {
      const ahora = new Date().toISOString()
      const r = planId.current
        ? await supabase.from('planes_calor').update({ datos: plan, actualizado: ahora }).eq('id', planId.current)
        : await supabase.from('planes_calor').insert({ paciente_id: pid, datos: plan, actualizado: ahora }).select('id').single()
      if (r.error) { setGuardado('error'); return }
      if (!planId.current) planId.current = (r.data as any)?.id || null
      setGuardado('ok')
    }, 900)
    return () => clearTimeout(t)
  }, [plan, pid])

  // ---------------- derivados ----------------
  const N = citas?.length || 0
  const dias = useMemo(() => {
    if (!citas?.length) return []
    const d0 = +new Date(citas[0].fecha + 'T12:00:00')
    return citas.map(c => Math.round((+new Date(c.fecha + 'T12:00:00') - d0) / 864e5))
  }, [citas])
  const span = dias.length ? dias[dias.length - 1] + 1 : 7
  const porSemana = N / Math.max(1, span / 7)
  const porMes = N / Math.max(1, span / 30.4)
  // Trabajo real que cabe en su cita: la media de su grupo (edad y sexo) si hay datos; si no, la de la clínica
  const grupo = grupoDe(pac?.fecha_nacimiento, pac?.sexo)
  const gMedio = tm?.grupos[grupo]
  const usaGrupo = !!gMedio && gMedio.n >= MIN_SESIONES_GRUPO
  const pctTrabajo = usaGrupo ? gMedio!.p : tm?.general || 40
  const minSes = dur * pctTrabajo / 100

  const hayFases = !!plan?.fases.l.length
  const act = plan?.faseAct ?? 0
  const mesa: Mesa | null = plan?.porFase[act] || null
  const GI = useMemo(() => (plan && dias.length ? (hayFases ? citasDeFase(plan, dias, act) : dias.map((_, i) => i)) : []), [plan, dias, hayFases, act])
  const NF = Math.max(1, GI.length)
  const FF = GI.map(i => citas![i].fecha)
  const TOT = minSes * GI.length
  const porSemanaF = NF / Math.max(1, ((GI.length ? dias[GI[GI.length - 1]] - dias[GI[0]] : 0) + 1) / 7)

  // Una fase sin preparar: se pregunta cómo empezarla. Sin fases, la mesa arranca vacía.
  const [velo, setVelo] = useState<Velo>(null)
  useEffect(() => {
    if (!plan || mesa) return
    if (!hayFases) { setPlan(p => { const q = clonar(p!); q.porFase[q.faseAct] = mesaVacia(); return q }); return }
    setVelo('inicio')
  }, [plan, mesa, hayFases])

  /** Cambia la mesa de la fase activa. */
  const cambia = (fn: (m: Mesa) => void) => setPlan(p => {
    const q = clonar(p!)
    const m = q.porFase[q.faseAct] || mesaVacia()
    fn(m)
    m.nses = Math.max(1, Math.min(m.nses, Math.max(1, GI.length || 1))); m.rep = Math.max(1, Math.min(m.rep, m.nses))
    q.porFase[q.faseAct] = m
    return q
  })
  const cambiaPlan = (fn: (p: PlanCalor) => void) => setPlan(p => { const q = clonar(p!); fn(q); return q })

  // ---------------- lo que hizo (3 meses) ----------------
  const idx = useMemo(() => indices(ets), [ets])
  const mapaHecho = useMemo(() => calcularMapa(regs, ejs, idx, cfg, { int: [], eje: [], combinada: false }), [regs, ejs, idx, cfg])
  const hechoZ = useMemo(() => {
    const s: Record<string, number> = {}
    ZPLAN.forEach(z => { s[z.k] = z.rig.reduce((n, g) => n + (mapaHecho.musculos[g] || 0), 0) + z.art.reduce((n, a) => n + (mapaHecho.zonas[a]?.seg || 0), 0) })
    return s // segundos
  }, [mapaHecho])
  const pct = (o: Record<string, number>) => { const t = Object.values(o).reduce((n, v) => n + v, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v / t * 100)])) as Record<string, number> }
  const hechoZpct = useMemo(() => pct(hechoZ), [hechoZ])

  // Patrones (movimientos) y planos de la biblioteca, y lo hecho en cada uno
  const { patrones, planos } = useMemo(() => {
    const porId: Record<string, any> = {}; ets.forEach(e => { porId[e.id] = e })
    const subir = (e: any) => { const r: string[] = []; let x = e; const v = new Set(); while (x && !v.has(x.id)) { v.add(x.id); r.push(x.nombre); x = porId[x.padre_id] } return r }
    const raices = new Set(ets.filter(e => !e.padre_id).map(e => e.id))
    const pat = ets.filter(e => categoriaDe(ets, e) === 'patron' && !raices.has(e.id) && !subir(e).some(n => /alcance/i.test(n)) && !/^patr[oó]n/i.test(e.nombre))
    const pla = ets.filter(e => categoriaDe(ets, e) === 'plano_eje' && !raices.has(e.id))
    return { patrones: pat, planos: pla }
  }, [ets])
  const segEj = useMemo(() => { const s: Record<string, number> = {}; Object.values(mapaHecho.zonas).forEach(z => Object.entries(z.porEj).forEach(([k, v]) => { s[k] = (s[k] || 0) + v })); return s }, [mapaHecho])
  const hechoTags = (tags: any[]) => {
    const ids = new Set(tags.map(t => t.id)), s: Record<string, number> = {}
    tags.forEach(t => { s[t.nombre] = 0 })
    Object.entries(segEj).forEach(([eid, seg]) => {
      const mis = ((ejs[eid]?.etiquetas || []) as string[]).filter(i => ids.has(i))
      mis.forEach(i => { const n = tags.find(t => t.id === i).nombre; s[n] += seg / mis.length })
    })
    return s
  }
  const hechoM = useMemo(() => hechoTags(patrones), [patrones, segEj, ejs]) // eslint-disable-line react-hooks/exhaustive-deps
  const hechoP = useMemo(() => hechoTags(planos), [planos, segEj, ejs]) // eslint-disable-line react-hooks/exhaustive-deps
  const NOM_MOVS = patrones.map(p => p.nombre)
  const NOM_PLANOS = planos.map(p => p.nombre)

  // Etiquetas del cuerpo de cada zona del plan (músculos de la biblioteca; el pie, por articulación)
  const etZona = useMemo(() => {
    const out: Record<string, string[]> = {}
    ZPLAN.forEach(z => {
      out[z.k] = z.rig.length
        ? Object.entries(MUS_RIG).filter(([, g]) => z.rig.includes(g)).map(([n]) => n)
        : ets.filter(e => categoriaDe(ets, e) === 'articulacion' && /tobillo|^pie/i.test(e.nombre)).map(e => e.nombre).slice(0, 6)
    })
    return out
  }, [ets])

  // ---------------- plan en zonas (para comparar y pintar) ----------------
  const planZona = (k: string) => (mesa && mesa.z.includes(k) ? Math.round(pctItem(mesa, 'zon', k)) : 0)

  // ---------------- cubo ----------------
  const linea = useMemo(() => (plan && dias.length && Object.values(plan.porFase).some(m => lista(m).length) ? lineaPrograma(plan, dias, porSemana) : null), [plan, dias, porSemana])
  const marcas = useMemo(() => {
    if (!plan || !hayFases) return []
    const out: { i: number, n: string, c: string }[] = []
    for (let i = 1; i < N; i++) { const k = faseDe(plan, dias, i); if (k >= 0 && k !== faseDe(plan, dias, i - 1)) out.push({ i, n: plan.fases.l[k].n, c: COLF[k % COLF.length] }) }
    return out
  }, [plan, dias, hayFases, N])
  const sombras = useMemo(() => {
    if (!plan || !hayFases) return [] as [number, number][]
    const out: [number, number][] = []; let ini = -1
    for (let i = 0; i <= N; i++) { const fuera = i < N && faseDe(plan, dias, i) !== act; if (fuera && ini < 0) ini = i; if (!fuera && ini >= 0) { out.push([ini, i]); ini = -1 } }
    return out
  }, [plan, dias, hayFases, N, act])

  // ---------------- cambio de fase ----------------
  const cambiaFase = (k: number) => { if (!plan || k === act) return; cambiaPlan(p => { p.faseAct = k }); if (!plan.porFase[k]) setVelo('inicio') }

  // ---------------- ajustes rápidos ----------------
  const preset = (v: string) => cambia(m => {
    Object.assign(m, mesaVacia())
    const movs = (l: string[]) => NOM_MOVS.filter(n => l.some(x => n.toLowerCase().includes(x)))
    if (v === 'piernas') { m.z = ['pierna', 'gluteo', 'core']; m.m = movs(['sentadilla', 'bisagra']); m.o = objSuyos.filter(o => /pierna|fuerza/i.test(o)).slice(0, 1); m.wi.zon = { pierna: 50, gluteo: 30, core: 20 }; m.nses = 4; m.rep = 2; m.prog = 0; m.proy.m = 15 }
    if (v === 'hombro') { m.z = ['brazo', 'espalda']; m.m = movs(['tracción horizontal', 'rotación']); m.o = objSuyos.filter(o => /hombro/i.test(o)).slice(0, 1); m.nses = 2; m.rep = 1; m.prog = 2 }
    if (v === 'general') { m.z = ZPLAN.map(z => z.k); m.m = movs(['empuje horizontal', 'tracción horizontal', 'sentadilla', 'bisagra']); m.nses = 3; m.rep = 3; m.prog = 1 }
  })

  if (!plan || !citas) return <div style={{ padding: 40, color: 'var(--grl)' }}>Cargando…</div>
  const nombre = (pac?.nombre_clinica || `${pac?.nombre || ''} ${pac?.apellidos || ''}`).trim()

  return (
    <div className="mc">
      <style>{CSS}</style>
      {/* ---------- barra ---------- */}
      <div className="mc-top">
        <button className="btn btn-t btn-sm" onClick={() => router.push(`/torno/${pid}/origen`)}>← Atrás</button>
        {hayFases && <div className="mc-fbar">{plan.fases.l.map((f, k) => {
          const c = COLF[k % COLF.length], n = citasDeFase(plan, dias, k).length
          const e = plan.estadoF[k] === 'creada' ? ['sesiones creadas', 'var(--gd)'] : plan.porFase[k] && lista(plan.porFase[k]).length ? ['preparada', '#C9A227'] : ['sin preparar', 'var(--grl)']
          return <button key={k} className={'mc-fch' + (k === act ? ' on' : '')} style={{ color: c }} onClick={() => cambiaFase(k)}>
            <i style={{ background: c }} /><span><b>{f.n}</b><small>{n} citas · <span style={{ color: e[1] }}>{e[0]}</span></small></span></button>
        })}</div>}
        <span style={{ flex: 1 }} />
        <span className="mc-guard">{guardado === 'guardando' ? 'Guardando…' : guardado === 'ok' ? 'Guardado' : guardado === 'error' ? 'No se guarda: falta la tabla planes_calor (SQL)' : ''}</span>
        <select className="input" style={{ width: 'auto' }} value="" onChange={e => { if (e.target.value) preset(e.target.value) }}>
          <option value="">Ajustes rápidos…</option>
          <option value="piernas">Fuerza de piernas · 2 días</option>
          <option value="hombro">Hombro · movilidad y control</option>
          <option value="general">General equilibrado · 3 días</option>
        </select>
        <b style={{ fontSize: 15 }}>{nombre}</b><span className="mc-chip">{N} citas</span>
        <button className="btn btn-p btn-sm" disabled={!mesa || !lista(mesa).length} title="Montar las sesiones de esta fase con la biblioteca"
          onClick={async () => {
            // Se guarda ya (sin esperar al guardado automático) y se pasa a ver las sesiones montadas
            const ahora = new Date().toISOString()
            if (planId.current) await supabase.from('planes_calor').update({ datos: plan, actualizado: ahora }).eq('id', planId.current)
            else { const r = await supabase.from('planes_calor').insert({ paciente_id: pid, datos: plan, actualizado: ahora }).select('id').single(); planId.current = (r.data as any)?.id || null }
            router.push(`/torno/${pid}/calor/sesiones`)
          }}>Crear sesiones{hayFases ? ' · ' + plan.fases.l[act].n : ''}</button>
      </div>

      {!N ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--gr)' }}>No tiene citas por delante{sp.get('fin') ? ' hasta esa fecha' : ''}. Dale citas en la agenda y vuelve.
        <div style={{ marginTop: 12 }}><button className="btn btn-s btn-sm" onClick={() => window.open('/agenda', '_blank')}>Abrir agenda</button></div></div> : (
      <div className="mc-mesa">
        {/* ---------- 1 · ALCANCE ---------- */}
        <div className="mc-carta c1">
          <div className="mc-h"><span className="t">Alcance de la programación</span><span className="s">arrastra para girar · doble clic para ampliar</span></div>
          <CuboAlcance n={N} hoy={0} marcas={marcas} sombras={sombras} linea={linea}
            fechaIni={fechaCorta(citas[0].fecha)} fechaFin={fechaCorta(citas[N - 1].fecha)}
            botones={<>
              <Pop titulo="i" filas={[
                ['Citas', `${N} × ${dur} min`], ['Duración de clase', 'de Ajustes'],
                ['Fechas', `${fechaCorta(citas[0].fecha)} → ${fechaCorta(citas[N - 1].fecha)}`],
                ['Trabajo real (clínica)', tm ? `${tm.general}% · ${tm.n} ses.` : 'calculando…'],
                [`Su grupo: ${grupo.replace('|', ', ').replace(/\?/g, 'sin dato')}`, gMedio ? `${gMedio.p}% · ${gMedio.n} ses.` : '—'],
                ['Se usa', usaGrupo ? `la de su grupo (${pctTrabajo}%)` : `la de la clínica (${pctTrabajo}%)`],
                ['Por sesión', segTxt(minSes)], ['Total', minTxt(minSes * N)],
              ]} />
              <button className="cb-btn cb-mini" title="Citas: añadir, quitar o mover (agenda)" onClick={() => window.open('/agenda', '_blank')}><IcoCal /></button>
              <button className="cb-btn cb-mini" title="Etapas y fases" onClick={() => setVelo('fases')}><IcoCapas /></button>
            </>} />
        </div>

        {/* ---------- 2 · A QUÉ APUNTA ---------- */}
        <div className="mc-carta c2">
          <div className="mc-h"><span className="t">A qué apunta</span><span className="s">se suman, ninguna borra a otra</span>
            <button className="cb-mini" style={{ marginLeft: 8 }} title="Tiempo por sesión, semana, mes y ciclo" onClick={() => setVelo('tiempo')}><IcoReloj /></button></div>
          {mesa && <>
            <div className="mc-glob">
              <div className="lin">Reparto del tiempo · <b>{minTxt(TOT)}</b><button className="mc-ig" onClick={() => cambia(m => { m.wc = { obj: 1, mov: 1, zon: 1 } })}>Igualar</button></div>
              <BarraGlobal mesa={mesa} TOT={TOT} onCambia={wc => cambia(m => { m.wc = wc })} />
            </div>
            <div className="mc-tres">
              {CAPAS.map(c => {
                const it = itemsDe(mesa, c.k), p = pctCapa(mesa, c.k)
                return <div key={c.k} className="mc-gran">
                  <div className="mc-gcab" style={{ borderTopColor: it.length ? c.c : 'transparent' }} onClick={() => setVelo(c.k)}>
                    <span className="gt">{c.n}{it.length > 0 && <small>{Math.round(p)}% · {minTxt(TOT * p / 100)}</small>}</span>
                    <span className="gs">{c.k === 'obj' ? 'los suyos y los que quieras' : c.k === 'mov' ? 'patrones y planos' : 'tren, zona y etiqueta'}</span>
                  </div>
                  <div className="mc-gp">
                    {!it.length ? <div className="mc-vacio" onClick={() => setVelo(c.k)}>Toca para elegir</div> : <>
                      {it.map(x => {
                        const pi = pctItem(mesa, c.k, x), et = c.k === 'zon' ? mesa.t.filter(e => etZona[x]?.includes(e)) : []
                        return <div key={x} className="mc-fila">
                          <div className="fl"><span className="fn" title={c.k === 'zon' ? nombreZona(x) : x}>{c.k === 'zon' ? nombreZona(x) : x}</span><b>{Math.round(pi)}%</b></div>
                          {et.length > 0 && <div className="et">{et.join(', ')}</div>}
                          <div className="fr"><input type="range" min={0} max={100} value={pi} style={{ background: `linear-gradient(to right,var(--g) ${pi}%,var(--bl) ${pi}%)` }} onChange={e => cambia(m => ponPctItem(m, c.k, x, +e.target.value))} /><span className="fm">{minTxt(TOT * p * pi / 1e4)}</span></div>
                        </div>
                      })}
                      {it.length > 1 && <button className="mc-ig" style={{ marginTop: 6 }} onClick={() => cambia(m => { m.wi[c.k] = {} })}>Igualar</button>}
                    </>}
                  </div>
                </div>
              })}
            </div>
          </>}
        </div>

        {/* ---------- 3 · LO QUE TIENE Y LO QUE PEDIMOS ---------- */}
        <Comparativa mesa={mesa} hechoZpct={hechoZpct} planZona={planZona} mapaHecho={mapaHecho}
          onRank={() => setVelo('rank')} onComp={() => setVelo('comp')} />

        {/* ---------- 4 · REPARTO EN SUS CITAS ---------- */}
        <div className="mc-carta c4">
          <div className="mc-h"><span className="t">Reparto en sus citas</span>
            <span className="s">{hayFases ? plan.fases.l[act].n + ' · ' : ''}{GI.length} citas{FF.length ? ` · ${fechaCorta(FF[0])} → ${fechaCorta(FF[FF.length - 1])}` : ''}</span></div>
          {mesa && <>
            <div className="mc-tres dos">
              <div className="mc-gran"><div className="mc-gcab" style={{ borderTopColor: 'var(--g)' }} onClick={() => setVelo('sesiones')}><span className="gt">Sesiones</span><span className="gs">cuántas y qué lleva cada una</span></div>
                <div className="mc-gp"><div className="mc-res"><b>{mesa.nses}</b> {mesa.nses === 1 ? 'sesión, la misma en todas' : 'sesiones distintas'}</div>
                  <div className="mc-res">{mesa.rep > 1 ? <>Reparte todo cada {mesa.rep}: {bloques(mesa).map(b => b.join('+')).join(' · ')}<br /><b>{frecTxt(mesa.rep)}</b></> : 'Todo en cada una'}</div></div></div>
              <div className="mc-gran"><div className="mc-gcab" style={{ borderTopColor: '#E4572E' }} onClick={() => setVelo('proy')}><span className="gt">Proyección</span><span className="gs">hacia dónde va la intensidad</span></div>
                <div className="mc-gp"><div className="mc-res"><b>{PROGS[mesa.prog][0]}</b></div>
                  <div className="mc-res">{mesa.prog === 1 ? 'se mantiene' : <>+{mesa.proy.m}% en {hayFases ? 'la fase' : 'el ciclo'}{mesa.prog === 2 && <><br />baja {mesa.proy.baja}% cada {mesa.proy.val} {CONDS.find(c => c[0] === mesa.proy.cond)![1]}</>}</>}</div></div></div>
            </div>
            <GraficoProy mesa={mesa} NF={NF} porSemana={porSemanaF} alto={80} />
            <Tiras mesa={mesa} FF={FF} NF={NF} porSemana={porSemanaF} />
            <div className="mc-ley"><span style={{ color: '#E4572E' }}>— proyección</span><span style={{ color: 'var(--g)' }}>- - tendencia</span><span style={{ marginLeft: 'auto', color: 'var(--grl)' }}>debajo, la sesión de cada cita</span></div>
          </>}
        </div>
      </div>)}

      {/* =================== VELOS =================== */}
      {velo && mesa && velo === 'obj' && <VeloCaja titulo="Objetivos" sub="los de borde verde son suyos · toca para elegir" onCerrar={() => setVelo(null)}>
        <Bolas suyos={objSuyos} otros={[...objOtros, ...mesa.extra]} sel={mesa.o}
          onToggle={o => cambia(m => { m.o = m.o.includes(o) ? m.o.filter(x => x !== o) : [...m.o, o] })}
          onNuevo={o => cambia(m => { m.extra.push(o); m.o.push(o) })} />
      </VeloCaja>}

      {velo && mesa && velo === 'mov' && <VeloCaja titulo="Movimientos" sub="toca los que quieras" onCerrar={() => setVelo(null)}>
        <div style={{ overflow: 'auto', height: '100%' }}>
          {[['Patrón', NOM_MOVS], ['Plano', NOM_PLANOS]].map(([t, arr]) => (arr as string[]).length > 0 && <div key={t as string} style={{ marginBottom: 16 }}>
            <div className="mc-lbl">{t}</div>
            <div className="mc-cuads">{(arr as string[]).map(x => <button key={x} className={'mc-cuad' + (mesa.m.includes(x) ? ' on' : '')} onClick={() => cambia(m => { m.m = m.m.includes(x) ? m.m.filter(y => y !== x) : [...m.m, x] })}>{x}</button>)}</div>
          </div>)}
          {!NOM_MOVS.length && <div className="mc-nota">No hay etiquetas de patrón en la biblioteca.</div>}
        </div>
      </VeloCaja>}

      {velo && mesa && velo === 'zon' && <VeloCaja titulo="Zonas" sub="primero el tren, luego la zona y, si quieres, sus etiquetas · si no concretas, se reparte" onCerrar={() => setVelo(null)}>
        <VeloZonas mesa={mesa} etZona={etZona} cambia={cambia} />
      </VeloCaja>}

      {velo && mesa && velo === 'tiempo' && <VeloCaja titulo="Tiempo de trabajo" sub={`${GI.length} sesiones · ${porSemanaF.toFixed(1).replace('.', ',')} por semana · ${Math.round(porMes)} por mes · ${segTxt(minSes)} de trabajo por sesión`} onCerrar={() => setVelo(null)}>
        {!activas(mesa).length ? <div className="mc-nota">Primero elige a qué apunta.</div> :
          <div style={{ overflow: 'auto', height: '100%' }}><table className="mc-tabla"><thead><tr><th></th><th>Por sesión</th><th>Por semana</th><th>Por mes</th><th>{hayFases ? 'Fase' : 'Ciclo'}</th></tr></thead><tbody>
            {activas(mesa).map(c => {
              const mc = minSes * pctCapa(mesa, c.k) / 100
              const col = (x: number) => <><td>{segTxt(x)}</td><td>{segTxt(x * porSemanaF)}</td><td>{segTxt(x * porMes)}</td><td>{segTxt(x * GI.length)}</td></>
              return [<tr key={c.k} className="cap"><td>{c.n} · {Math.round(pctCapa(mesa, c.k))}%</td>{col(mc)}</tr>,
                ...itemsDe(mesa, c.k).map(x => <tr key={c.k + x}><td>{c.k === 'zon' ? nombreZona(x) : x} <span style={{ color: 'var(--grl)', fontSize: 11 }}>{Math.round(pctItem(mesa, c.k, x))}%</span></td>{col(mc * pctItem(mesa, c.k, x) / 100)}</tr>)]
            })}
            <tr className="tot"><td>Total</td><td>{segTxt(minSes)}</td><td>{segTxt(minSes * porSemanaF)}</td><td>{segTxt(minSes * porMes)}</td><td>{segTxt(minSes * GI.length)}</td></tr>
          </tbody></table></div>}
      </VeloCaja>}

      {velo === 'rank' && <VeloCaja titulo="Lo que ha hecho" sub={`los 5 primeros de cada cosa · últimos 3 meses · ${minTxt(mapaHecho.total / 60)} de trabajo`} onCerrar={() => setVelo(null)}>
        <Ranking mapa={mapaHecho} cfg={cfg} regs={regs} ejs={ejs} hechoM={hechoM} hechoP={hechoP} />
      </VeloCaja>}

      {velo === 'comp' && mesa && <VeloCaja titulo="Compensar" sub="trabajar lo que menos se ha trabajado · marca qué quieres relacionar" onCerrar={() => setVelo(null)}>
        <VeloComp plan={plan} dias={dias} minSes={minSes} hechoZ={hechoZ} hechoM={hechoM} objSuyos={objSuyos} nombreFase={hayFases ? plan.fases.l[act].n : 'la mesa'}
          onAplicar={(z: string[], wz: Record<string, number>, m: string[], wm: Record<string, number>, o: string[]) => { cambia(me => { me.z = z; me.t = []; me.m = m; me.o = o; me.wi = { zon: wz, mov: wm, obj: {} } }); setVelo(null) }} />
      </VeloCaja>}

      {velo === 'sesiones' && mesa && <VeloCaja titulo="Sesiones" sub={`sobre sus ${GI.length} citas reales`} onCerrar={() => setVelo(null)}>
        <VeloSesiones mesa={mesa} FF={FF} NF={NF} minSes={minSes} TOT={TOT} cambia={cambia} />
      </VeloCaja>}

      {velo === 'proy' && mesa && <VeloCaja titulo="Proyección" sub="el patrón que sigue la intensidad" onCerrar={() => setVelo(null)}>
        <div className="mc-ctl">
          <div className="mc-f4"><div className="mc-seg">{PROGS.map(([t], k) => <button key={k} className={mesa.prog === k ? 'on' : ''} onClick={() => cambia(m => { m.prog = k as 0 | 1 | 2 })}>{t}</button>)}</div><span style={{ color: 'var(--grl)' }}>{PROGS[mesa.prog][1]}</span></div>
          <div className="mc-f4">{mesa.prog === 1 ? 'Se mantiene la intensidad. Si quieres subirla, lo haces tú en el taller.' : <>
            Mejorar <Num v={mesa.proy.m} on={v => cambia(m => { m.proy.m = v })} /> % en {hayFases ? 'la fase' : 'el ciclo'}
            {mesa.prog === 2 && <> · bajar <Num v={mesa.proy.baja} on={v => cambia(m => { m.proy.baja = v })} /> % cada <Num v={mesa.proy.val} on={v => cambia(m => { m.proy.val = v })} />
              <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={mesa.proy.cond} onChange={e => cambia(m => { m.proy.cond = e.target.value as any })}>{CONDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></>}</>}</div>
          <GraficoProy mesa={mesa} NF={NF} porSemana={porSemanaF} alto={150} />
          <Tiras mesa={mesa} FF={FF} NF={NF} porSemana={porSemanaF} />
          <div className="mc-ley"><span style={{ color: '#E4572E' }}>— proyección</span><span style={{ color: 'var(--g)' }}>- - tendencia</span><span style={{ marginLeft: 'auto', color: 'var(--grl)' }}>el taller propondrá los pesos para seguirla</span></div>
        </div>
      </VeloCaja>}

      {velo === 'fases' && <VeloCaja titulo="Etapas y fases" sub="como en los ciclos: cómo se pasa de una fase a la siguiente" onCerrar={() => setVelo(null)}>
        <VeloFases plan={plan} dias={dias} citas={citas} objetivos={[...objSuyos, ...objOtros]} cambiaPlan={cambiaPlan} />
      </VeloCaja>}

      {velo === 'inicio' && hayFases && <VeloCaja titulo={'Empezar ' + plan.fases.l[act].n} sub={`${GI.length} citas${FF.length ? ` · ${fechaCorta(FF[0])} → ${fechaCorta(FF[FF.length - 1])}` : ''} · ¿cómo la preparamos?`}
        onCerrar={() => { if (!plan.porFase[act]) cambiaPlan(p => { p.porFase[act] = mesaVacia() }); setVelo(null) }}>
        <div className="mc-inicio">
          <button className="mc-op" disabled={!(act > 0 && plan.porFase[act - 1])} onClick={() => { cambiaPlan(p => { p.porFase[act] = clonar(p.porFase[act - 1]) }); setVelo(null) }}>
            <b>Continuar desde {act > 0 ? plan.fases.l[act - 1].n : 'la anterior'}</b><span>Copia lo que preparaste en la fase anterior y lo retocas. La proyección arranca donde acabó.</span></button>
          <button className="mc-op" onClick={() => { cambiaPlan(p => { p.porFase[act] = mesaVacia() }); setVelo(null) }}>
            <b>Empezar de cero</b><span>Mesa en blanco: eliges a qué apunta, sesiones y proyección solo para esta fase.</span></button>
          <div className="mc-op"><b>Ajuste rápido</b><span>Carga uno ya hecho y lo retocas.</span>
            <div>{[['piernas', 'Fuerza de piernas · 2 días'], ['hombro', 'Hombro'], ['general', 'General equilibrado']].map(([v, t]) =>
              <button key={v} className="mc-ig" style={{ margin: '4px 6px 0 0' }} onClick={() => { preset(v); setVelo(null) }}>{t}</button>)}</div></div>
        </div>
      </VeloCaja>}
    </div>
  )
}

// =========================================================================
// PIEZAS
// =========================================================================

function VeloCaja({ titulo, sub, onCerrar, children }: { titulo: string, sub?: string, onCerrar: () => void, children: React.ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onCerrar])
  return (
    <div className="mc-velo">
      <div className="vh"><b>{titulo}</b>{sub && <span>{sub}</span>}<span style={{ flex: 1 }} /><button className="cb-mini" onClick={onCerrar}>✕</button></div>
      <div className="vc">{children}</div>
      <div className="pie"><button className="btn btn-p" onClick={onCerrar}>Listo</button></div>
    </div>
  )
}

function Num({ v, on }: { v: number, on: (n: number) => void }) {
  return <input type="number" className="input" style={{ width: 62, padding: '4px 6px', textAlign: 'right', display: 'inline-block' }} value={v} onChange={e => on(Math.max(0, +e.target.value || 0))} />
}

function Pop({ titulo, filas }: { titulo: string, filas: [string, string][] }) {
  const [on, setOn] = useState(false)
  return <>
    <button className={'cb-btn cb-mini' + (on ? ' on' : '')} title="Datos del alcance" onClick={() => setOn(!on)}>{titulo}</button>
    {on && <div className="cb-btn cb-pop">{filas.map(([a, b]) => <div key={a} className="mc-dato"><span>{a}</span><b>{b}</b></div>)}</div>}
  </>
}

/** Barra global: arrastrar un asa pasa tiempo solo entre las dos capas que separa. */
function BarraGlobal({ mesa, TOT, onCambia }: { mesa: Mesa, TOT: number, onCambia: (wc: Record<Capa, number>) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const a = activas(mesa)
  if (!a.length) return <div className="mc-gbar"><span style={{ margin: 'auto', fontSize: 11.5, color: 'var(--grl)' }}>Elige a qué apunta y aquí se reparte el tiempo</span></div>
  const ps = a.map(c => pctCapa(mesa, c.k))
  let acc = 0
  return <div className="mc-gbar" ref={ref}>
    {a.map((c, i) => { const p = ps[i]; acc += p; const izq = acc; return [
      <div key={c.k} className="mc-gseg" style={{ width: p + '%', background: c.c }}>{c.n} <b>{Math.round(p)}%</b> · {minTxt(TOT * p / 100)}</div>,
      i < a.length - 1 && <div key={c.k + 'a'} className="mc-asa" style={{ left: izq + '%' }} onPointerDown={e => {
        const el = e.currentTarget; el.setPointerCapture(e.pointerId)
        const ini = ps.slice(0, i).reduce((n, v) => n + v, 0), par = ps[i] + ps[i + 1]
        el.onpointermove = ev => {
          const r = ref.current!.getBoundingClientRect()
          const v = Math.max(5, Math.min(par - 5, (ev.clientX - r.left) / r.width * 100 - ini))
          const wc: any = { ...mesa.wc }; a.forEach((x, j) => { wc[x.k] = ps[j] }); wc[a[i].k] = v; wc[a[i + 1].k] = par - v
          onCambia(wc)
        }
        el.onpointerup = () => { el.onpointermove = null }
      }} />] })}
  </div>
}

/** Objetivos flotando: los suyos más grandes y con borde verde. */
function Bolas({ suyos, otros, sel, onToggle, onNuevo }: { suyos: string[], otros: string[], sel: string[], onToggle: (o: string) => void, onNuevo: (o: string) => void }) {
  const caja = useRef<HTMLDivElement>(null)
  const [txt, setTxt] = useState('')
  // La clave es el texto: así marcar una bola no vuelve a lanzar la animación desde cero
  const clave = suyos.join('|') + '#' + otros.join('|')
  const todos = useMemo(() => [...suyos.map(n => ({ n, suyo: true })), ...otros.map(n => ({ n, suyo: false }))], [clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const refs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    const C = caja.current
    if (!C) return
    const W = C.clientWidth, H = C.clientHeight
    const b = todos.map(o => { const r = o.suyo ? 62 : 46; return { r, x: r + Math.random() * Math.max(1, W - 2 * r), y: 60 + r + Math.random() * Math.max(1, H - 60 - 2 * r), vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 } })
    let an = 0
    const paso = () => {
      b.forEach(q => { q.x += q.vx; q.y += q.vy; if (q.x < q.r || q.x > W - q.r) q.vx *= -1; if (q.y < q.r + 50 || q.y > H - q.r) q.vy *= -1; q.x = Math.max(q.r, Math.min(W - q.r, q.x)); q.y = Math.max(q.r + 50, Math.min(H - q.r, q.y)) })
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
        const a = b[i], c = b[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), m = a.r + c.r + 6
        if (d < m && d > 0) { const nx = dx / d, ny = dy / d, e = (m - d) / 2; a.x -= nx * e; a.y -= ny * e; c.x += nx * e; c.y += ny * e; [a.vx, c.vx] = [c.vx, a.vx]; [a.vy, c.vy] = [c.vy, a.vy] }
      }
      b.forEach((q, i) => { const el = refs.current[i]; if (el) el.style.transform = `translate(${q.x - q.r}px,${q.y - q.r}px)` })
      an = requestAnimationFrame(paso)
    }
    paso()
    return () => cancelAnimationFrame(an)
  }, [todos])
  return <div ref={caja} style={{ position: 'relative', height: '100%' }}>
    <div style={{ position: 'absolute', right: 0, top: 0, zIndex: 2, display: 'flex', gap: 6 }}>
      <input className="input" placeholder="Otro objetivo…" value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && txt.trim()) { onNuevo(txt.trim()); setTxt('') } }} />
      <button className="btn btn-p btn-sm" onClick={() => { if (txt.trim()) { onNuevo(txt.trim()); setTxt('') } }}>Añadir</button>
    </div>
    {todos.map((o, i) => <div key={o.n} ref={el => { refs.current[i] = el }} className={'mc-esf' + (o.suyo ? ' suyo' : '') + (sel.includes(o.n) ? ' on' : '')}
      style={{ width: (o.suyo ? 124 : 92), height: (o.suyo ? 124 : 92) }} onClick={() => onToggle(o.n)}>{o.n}{o.suyo && <small>suyo</small>}</div>)}
    {!todos.length && <div className="mc-nota" style={{ paddingTop: 60 }}>No tiene objetivos abiertos. Escribe uno arriba.</div>}
  </div>
}

function VeloZonas({ mesa, etZona, cambia }: { mesa: Mesa, etZona: Record<string, string[]>, cambia: (fn: (m: Mesa) => void) => void }) {
  const entero = (t: string) => ZPLAN.filter(z => z.t === t).every(z => mesa.z.includes(z.k))
  const conEt = ZPLAN.filter(z => mesa.z.includes(z.k))
  return <div className="mc-zcols">
    <div className="zc"><div className="mc-lbl">Tren</div>
      {TRENES.map(t => <button key={t.k} className={'mc-ztren' + (entero(t.k) ? ' on' : '')} onClick={() => cambia(m => {
        const zs = ZPLAN.filter(z => z.t === t.k).map(z => z.k)
        if (entero(t.k)) { m.z = m.z.filter(k => !zs.includes(k)); m.t = m.t.filter(e => !zs.some(k => etZona[k]?.includes(e))) } else m.z = Array.from(new Set([...m.z, ...zs]))
      })}><b>{t.n}</b><span>{t.d}</span></button>)}</div>
    <div className="zc"><div className="mc-lbl">Zona</div>
      {TRENES.map(t => <div key={t.k} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>{t.n}</div>
        {ZPLAN.filter(z => z.t === t.k).map(z => <button key={z.k} className={'mc-zsub' + (mesa.z.includes(z.k) ? ' on' : '')} onClick={() => cambia(m => {
          if (m.z.includes(z.k)) { m.z = m.z.filter(k => k !== z.k); m.t = m.t.filter(e => !etZona[z.k]?.includes(e)) } else m.z = [...m.z, z.k]
        })}>{z.n}</button>)}</div>)}</div>
    <div className="zc"><div className="mc-lbl">Etiquetas del cuerpo</div>
      {conEt.length ? conEt.map(z => <div key={z.k} style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>{z.n}</div>
        {(etZona[z.k] || []).map(e => <button key={e} className={'mc-ch' + (mesa.t.includes(e) ? ' on' : '')} onClick={() => cambia(m => { m.t = m.t.includes(e) ? m.t.filter(x => x !== e) : [...m.t, e] })}>{e}</button>)}</div>)
        : <div className="mc-nota">Elige una zona para ver sus etiquetas.</div>}</div>
  </div>
}

/** Carta 3: el muñeco 3D en el centro y las zonas alrededor (superior a la izquierda, inferior a la derecha). */
function Comparativa({ mesa, hechoZpct, planZona, mapaHecho, onRank, onComp }: any) {
  const [vista, setVista] = useState<'hecho' | 'plan'>('hecho')
  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<MapaCalor3D | null>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearMapaCalor } = await import('@/lib/anim3d/mapaCalor')
        if (!caja.current) return
        const v = await crearMapaCalor(caja.current)
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch { /* sin WebGL: quedan los datos */ }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])
  useEffect(() => {
    const v = visor.current
    if (!v) return
    if (vista === 'hecho') {
      const maxZ = Math.max(0, ...Object.values(mapaHecho.zonas).map((z: any) => z.seg)), maxM = Math.max(0, ...(Object.values(mapaHecho.musculos) as number[]))
      const zonas: Record<string, any> = {}
      ZONAS.forEach(z => { const s = mapaHecho.zonas[z.k]?.seg || 0; if (s > 0) zonas[z.k] = { v: s / maxZ, huesos: z.huesos, off: z.off } })
      v.poner({ zonas, musculos: Object.fromEntries(Object.entries(mapaHecho.musculos).map(([k, s]: any) => [k, maxM ? s / maxM : 0])) })
    } else {
      const mus: Record<string, number> = {}, zonas: Record<string, any> = {}
      const mx = Math.max(1, ...ZPLAN.map(z => planZona(z.k)))
      ZPLAN.forEach(z => { const p = planZona(z.k) / mx; if (!p) return; z.rig.forEach(g => { mus[g] = p }); z.art.forEach(a => { const Z = ZONAS.find(x => x.k === a); if (Z) zonas[a] = { v: p, huesos: Z.huesos, off: Z.off } }) })
      v.poner({ zonas, musculos: mus })
    }
  }, [vista, listo, mapaHecho, mesa]) // eslint-disable-line react-hooks/exhaustive-deps

  const zs = ZPLAN.map(z => ({ ...z, h: hechoZpct[z.k] || 0, p: planZona(z.k) }))
  const mas = [...zs].sort((a, b) => b.h - a.h)[0], menos = [...zs].sort((a, b) => a.h - b.h)[0]
  const aviso = (z: any): [string, string] | null => z.k === mas?.k && z.h > 0 ? ['▲ lo más trabajado', '#E4572E'] : z.k === menos?.k ? ['▼ casi sin tocar', '#C9A227']
    : z.p - z.h >= 20 ? ['↑ sube mucho', 'var(--gd)'] : z.p && z.h - z.p >= 20 ? ['↓ baja mucho', 'var(--gr)'] : null
  const col = (t: string) => zs.filter(z => z.t === t).map(z => { const a = aviso(z); return <div key={z.k} className="mc-call">
    <div className="cn"><b>{z.n}</b>{a && <span style={{ color: a[1] }}>{a[0]}</span>}</div>
    <div className="cb"><i style={{ width: Math.min(100, z.h * 3.2) + '%', background: '#B8BAB5' }} /></div>
    <div className="cb"><i style={{ width: Math.min(100, z.p * 3.2) + '%', background: 'var(--g)' }} /></div>
    <div className="cv">{z.h} → <b>{z.p}%</b></div></div> })
  return <div className="mc-carta c3">
    <div className="mc-h"><span className="t">Lo que tiene y lo que pedimos</span>
      <div className="mc-seg" style={{ marginLeft: 'auto' }}><button className={vista === 'hecho' ? 'on' : ''} onClick={() => setVista('hecho')}>Lo que hizo</button><button className={vista === 'plan' ? 'on' : ''} onClick={() => setVista('plan')}>Lo que pedimos</button></div>
      <button className="cb-mini" style={{ marginLeft: 8 }} title="Ranking: métodos, ejercicios, ejecución…" onClick={onRank}><IcoRank /></button>
      <button className="cb-mini" style={{ marginLeft: 6 }} title="Compensar: trabajar lo que no se trabajó" onClick={onComp}><IcoComp /></button></div>
    <div className="mc-comp">
      <div className="lado">{col('sup')}</div>
      <div ref={caja} className="cuerpo" />
      <div className="lado">{col('inf')}</div>
    </div>
    <div className="mc-ley"><span><i style={{ background: '#B8BAB5' }} />lo que hizo (3 meses)</span><span><i style={{ background: 'var(--g)' }} />lo que pedimos</span></div>
  </div>
}

function Ranking({ mapa, cfg, regs, ejs, hechoM, hechoP }: any) {
  const top = (o: Record<string, number>, nom: (k: string) => string) => {
    const t = Object.values(o).reduce((n: number, v: any) => n + v, 0) || 1
    return Object.entries(o).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ n: nom(k), p: Math.round(v / t * 100), seg: v }))
  }
  const veces: Record<string, number> = {}
  const vistos = new Set<string>()
  regs.forEach((r: any) => { const k = r.ejercicio_id + r.fecha; if (!r.ejercicio_id || vistos.has(k)) return; vistos.add(k); veces[r.ejercicio_id] = (veces[r.ejercicio_id] || 0) + 1 })
  const ejeF: Record<string, number> = {}, ejeE: Record<string, number> = {}
  Object.entries(mapa.porEje as Record<string, number>).forEach(([k, v]) => { const e = cfg.ejecuciones.find((x: any) => x.id === k); (e?.grupo === 'estiramiento' ? ejeE : ejeF)[k] = v })
  const R = [
    { t: 'Métodos', s: '% del tiempo', f: top(mapa.porInt, k => cfg.intensidades.find((i: any) => i.id === k)?.nombre || k) },
    { t: 'Ejercicios', s: 'veces hechas', n: 1, f: Object.entries(veces).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ n: ejs[k]?.nombre || '¿?', p: v, seg: 0 })) },
    { t: 'Ejecución', s: '% del tiempo', f: top(ejeF, k => cfg.ejecuciones.find((e: any) => e.id === k)?.nombre || k) },
    { t: 'Estiramiento', s: '% del tiempo', f: top(ejeE, k => cfg.ejecuciones.find((e: any) => e.id === k)?.nombre || k) },
    { t: 'Movimientos', s: '% del tiempo', f: top(hechoM, k => k) },
    { t: 'Planos', s: '% del tiempo', f: top(hechoP, k => k) },
  ]
  return <div className="mc-ranks">
    {R.map(r => { const mx = r.f[0]?.p || 1; return <div key={r.t} className="rk"><h4>{r.t}<span>{r.s}</span></h4>
      {r.f.length ? r.f.map((x, i) => <div key={x.n} className="mc-rkf"><span className="n">{i + 1}</span>
        <div><div className="nm">{x.n}</div><div className="br"><i style={{ width: x.p / mx * 100 + '%', background: i ? 'var(--g)' : '#E4572E' }} /></div></div>
        <div className="v"><b>{r.n ? x.p + '×' : x.p + '%'}</b>{r.n ? '' : minTxt(x.seg / 60)}</div></div>)
        : <div className="mc-nota">Sin datos en 3 meses.</div>}</div> })}
    <div className="rk"><h4>Lateralidad<span>pendiente</span></h4><div className="mc-nota">Hace falta marcar en cada ejercicio si es bilateral, unilateral o alterno.</div></div>
  </div>
}

function VeloComp({ plan, dias, minSes, hechoZ, hechoM, objSuyos, nombreFase, onAplicar }: any) {
  const act = plan.faseAct
  const previas: number[] = plan.fases.l.length ? plan.fases.l.map((_: any, k: number) => k).filter((k: number) => k < act && plan.porFase[k]) : []
  const [prev, setPrev] = useState(previas.length > 0)
  // Base: lo hecho (en minutos) + lo planificado en fases anteriores si se marca
  const base = useMemo(() => {
    const z: Record<string, number> = {}, m: Record<string, number> = {}
    ZPLAN.forEach(x => { z[x.k] = (hechoZ[x.k] || 0) / 60 })
    Object.entries(hechoM as Record<string, number>).forEach(([k, v]) => { m[k] = v / 60 })
    if (prev) previas.forEach(k => {
      const pf: Mesa = plan.porFase[k], n = citasDeFase(plan, dias, k).length
      ;(['zon', 'mov'] as Capa[]).forEach(c => itemsDe(pf, c).forEach(x => { const v = minSes * n * pctCapa(pf, c) * pctItem(pf, c, x) / 1e4; const o = c === 'zon' ? z : m; o[x] = (o[x] || 0) + v }))
    })
    const pc = (o: Record<string, number>) => { const t = Object.values(o).reduce((n, v) => n + v, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v / t * 100)])) as Record<string, number> }
    return { z: pc(z), m: pc(m) }
  }, [prev, hechoZ, hechoM]) // eslint-disable-line react-hooks/exhaustive-deps
  const med = (o: Record<string, number>) => { const v = Object.values(o).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0 }
  const [selZ, setSelZ] = useState<string[]>(() => ZPLAN.filter(z => base.z[z.k] <= med(base.z)).map(z => z.k))
  const [selM, setSelM] = useState<string[]>(() => Object.keys(base.m).filter(k => base.m[k] <= med(base.m)).sort((a, b) => base.m[a] - base.m[b]).slice(0, 4))
  const [selO, setSelO] = useState<string[]>(objSuyos)
  const mxZ = Math.max(...Object.values(base.z), 0), mxM = Math.max(...Object.values(base.m), 0)
  const prop = (sel: string[], h: Record<string, number>, mx: number) => { const w = (k: string) => mx - (h[k] || 0) + 2, s = sel.reduce((n, k) => n + w(k), 0); return (k: string) => sel.includes(k) && s ? Math.round(w(k) / s * 100) : 0 }
  const pz = prop(selZ, base.z, mxZ), pm = prop(selM, base.m, mxM)
  const tg = (l: string[], set: (x: string[]) => void, k: string) => set(l.includes(k) ? l.filter(x => x !== k) : [...l, k])
  const fila = (on: boolean, nom: string, h: number, p: number, fn: () => void) => <label key={nom} className="mc-rkf" style={{ gridTemplateColumns: '22px 1fr 110px', cursor: 'pointer' }}>
    <input type="checkbox" checked={on} onChange={fn} />
    <div><div className="nm">{nom}</div><div className="br" style={{ background: 'none' }}><i style={{ width: Math.min(100, h * 3) + '%', background: '#B8BAB5' }} /></div><div className="br" style={{ background: 'none', marginTop: 2 }}><i style={{ width: p + '%', background: 'var(--g)' }} /></div></div>
    <div className="v">{h}% → <b style={{ display: 'inline', color: 'var(--gd)' }}>{p}%</b></div></label>
  return <div className="mc-ctl">
    <label className="mc-f4" style={{ cursor: 'pointer' }}><input type="checkbox" checked={prev} disabled={!previas.length} onChange={e => setPrev(e.target.checked)} /> Contar también lo planificado en fases anteriores
      <span style={{ color: 'var(--grl)' }}>{previas.length ? '(' + previas.map(k => plan.fases.l[k].n).join(', ') + ')' : '(no hay fases anteriores preparadas)'}</span></label>
    <div className="mc-ranks">
      <div className="rk"><h4>Zonas<span>hizo → propone</span></h4>{[...ZPLAN].sort((a, b) => base.z[a.k] - base.z[b.k]).map(z => fila(selZ.includes(z.k), z.n, base.z[z.k] || 0, pz(z.k), () => tg(selZ, setSelZ, z.k)))}</div>
      <div className="rk"><h4>Movimientos<span>hizo → propone</span></h4>{Object.keys(base.m).sort((a, b) => base.m[a] - base.m[b]).map(m => fila(selM.includes(m), m, base.m[m] || 0, pm(m), () => tg(selM, setSelM, m)))}
        {!Object.keys(base.m).length && <div className="mc-nota">No hay etiquetas de patrón.</div>}</div>
      <div className="rk"><h4>Objetivos<span>relacionar con</span></h4>
        {objSuyos.map((o: string) => <label key={o} className="mc-rkf" style={{ gridTemplateColumns: '22px 1fr', cursor: 'pointer' }}><input type="checkbox" checked={selO.includes(o)} onChange={() => tg(selO, setSelO, o)} /><div className="nm">{o}</div></label>)}
        {!objSuyos.length && <div className="mc-nota">No tiene objetivos abiertos.</div>}
        <div className="mc-nota" style={{ marginTop: 12 }}>Lo menos trabajado se lleva más tiempo. Al aplicar, se carga en «A qué apunta» de {nombreFase} y lo puedes retocar.</div>
        <button className="btn btn-p" style={{ marginTop: 14, width: '100%' }} onClick={() => onAplicar(selZ, Object.fromEntries(selZ.map(k => [k, pz(k)])), selM, Object.fromEntries(selM.map(k => [k, pm(k)])), selO)}>Aplicar a {nombreFase}</button></div>
    </div>
  </div>
}

function VeloSesiones({ mesa, FF, NF, minSes, TOT, cambia }: { mesa: Mesa, FF: string[], NF: number, minSes: number, TOT: number, cambia: (fn: (m: Mesa) => void) => void }) {
  const sesDe = (i: number) => i % mesa.nses
  const minItem = (x: { k: string, capa: Capa }) => TOT * pctCapa(mesa, x.capa) * pctItem(mesa, x.capa, x.k) / 1e4
  return <div className="mc-ctl">
    <div className="mc-f4">Sesiones distintas <Paso v={mesa.nses} min={1} max={NF} on={v => cambia(m => { m.nses = v; m.rep = Math.min(m.rep, v) })} />
      <span>{mesa.nses === 1 ? 'la misma en todas las citas' : mesa.nses === NF ? 'una distinta en cada cita' : `se turnan: ${LETRA.slice(0, mesa.nses).split('').join(', ')}…`}</span></div>
    <Letras FF={FF} NF={NF} sesDe={sesDe} />
    <div className="mc-f4">Repartir todo el trabajo cada <Paso v={mesa.rep} min={1} max={mesa.nses} on={v => cambia(m => { m.rep = v })} /> sesiones
      <span style={{ color: 'var(--grl)' }}>{mesa.rep === 1 ? '= todo en cada sesión' : ''}</span></div>
    {mesa.nses > 1 && <div className="mc-aviso"><span className="dot" />{mesa.rep === 1 ? <span>Cada sesión trabaja <b>todo</b> lo elegido, con ejercicios distintos en cada una.</span>
      : <span>Bloques: <b>{bloques(mesa).map(b => b.join('+')).join(' · ')}</b>. En cada bloque se hace todo el trabajo; cada cosa se hace <b>{frecTxt(mesa.rep)}</b>.</span>}</div>}
    <div className="mc-sescols">{Array.from({ length: mesa.nses }, (_, si) => {
      const fechas = FF.filter((_, i) => sesDe(i) === si), its = contenido(mesa, si)
      // Cada sesión se llena hasta el trabajo de la cita: lo que lleva se estira o encoge en proporción
      const sumB = its.reduce((n, x) => n + minItem(x), 0), t = (x: any) => sumB ? minItem(x) * minSes / sumB : 0
      return <div key={si} className="mc-sescol" style={{ borderTop: `4px solid ${colSes(si)}` }}>
        <h4 style={{ color: colSes(si) }}>Sesión {LETRA[si]} <span>· {fechas.length} veces</span></h4><div className="cu">{fechas.map(fechaCorta).join(' · ')}</div>
        {its.length ? (['obj', 'zon', 'mov'] as Capa[]).map(c => { const g = its.filter(x => x.capa === c); if (!g.length) return null
          return <div key={c}><div className="it gr">{c === 'obj' ? 'Objetivos' : c === 'zon' ? 'Zonas' : 'Movimientos'}<span>{segTxt(g.reduce((n, x) => n + t(x), 0))}</span></div>
            {g.map(x => <div key={x.k} className="it">{x.n}<span>{segTxt(t(x))}</span></div>)}</div> }) : <div className="mc-nota">Nada elegido aún</div>}
        <div className="it tot">Trabajo<span>{segTxt(its.length ? minSes : 0)}</span></div>
      </div>
    })}</div>
  </div>
}

function Paso({ v, min, max, on }: { v: number, min: number, max: number, on: (n: number) => void }) {
  return <span className="mc-paso"><button disabled={v <= min} onClick={() => on(v - 1)}>−</button><b>{v}</b><button disabled={v >= max} onClick={() => on(v + 1)}>+</button></span>
}

function Letras({ FF, NF, sesDe }: { FF: string[], NF: number, sesDe: (i: number) => number }) {
  return <div className="mc-tira" style={{ gridTemplateColumns: `repeat(${NF},1fr)` }}>{FF.map((f, i) => <div key={i} className="ci" style={{ borderColor: colSes(sesDe(i)) + '66' }}><b style={{ color: colSes(sesDe(i)) }}>{LETRA[sesDe(i)]}</b><span>{NF > 14 ? f.slice(8, 10) : fechaCorta(f)}</span></div>)}</div>
}

function Tiras({ mesa, FF, NF, porSemana }: { mesa: Mesa, FF: string[], NF: number, porSemana: number }) {
  let n = 0
  return <>
    <div className="mc-tira mc-num" style={{ gridTemplateColumns: `repeat(${NF},1fr)` }}>{FF.map((_, i) => { const b = bajaEn(i, mesa.prog, mesa.proy, NF, porSemana); n++; return <div key={i} className={'ci' + (b ? ' desc' : '')}>{b ? '↓ ' + n : n}</div> })}</div>
    <Letras FF={FF} NF={NF} sesDe={i => i % mesa.nses} />
  </>
}

function GraficoProy({ mesa, NF, porSemana, alto }: { mesa: Mesa, NF: number, porSemana: number, alto: number }) {
  const W = 1200, H = 100, X = (i: number) => (i + 0.5) * W / NF, Y = (y: number) => H - 6 - y * (H - 14)
  const m = mesa.proy.m / 100, K = 0.5 / Math.max(m, 0.05), y = (v: number) => Math.max(0.08, Math.min(0.95, 0.35 + (v - 1) * K))
  const pts = Array.from({ length: NF }, (_, i) => curva(mesa.prog, i, NF, mesa.proy, porSemana))
  const pl = (a: number[][]) => a.map(q => q.join(',')).join(' ')
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: alto, marginTop: 6 }}>
    <polyline points={pl(pts.map((c, i) => [X(i), Y(mesa.prog === 1 ? 0.35 : y(c.T))]))} fill="none" stroke="var(--g)" strokeWidth={2} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
    <polyline points={pl(pts.map((c, i) => [X(i), Y(y(c.v))]))} fill="none" stroke="#E4572E" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
  </svg>
}

function VeloFases({ plan, dias, citas, objetivos, cambiaPlan }: any) {
  const F = plan.fases, uni = F.tipo === 'tiempo' ? 'semanas' : F.tipo === 'ses' ? 'citas' : 'citas (estimado)'
  const tot = F.l.reduce((n: number, f: any) => n + (+f.v || 0), 0), cab = F.tipo === 'tiempo' ? Math.ceil(((dias[dias.length - 1] || 0) + 1) / 7) : dias.length
  // Al mover o borrar una fase, lo preparado (y su estado) se mueve con ella
  const mover = (p: PlanCalor, k: number, a: 'del' | 'sub' | 'baj') => {
    const arr = p.fases.l.map((_, j) => [p.porFase[j], p.estadoF[j]] as const) as any[]
    const sw = (j: number) => { [p.fases.l[j], p.fases.l[k]] = [p.fases.l[k], p.fases.l[j]];[arr[j], arr[k]] = [arr[k], arr[j]] }
    if (a === 'del') { p.fases.l.splice(k, 1); arr.splice(k, 1) }
    if (a === 'sub') sw(k - 1)
    if (a === 'baj') sw(k + 1)
    p.porFase = {}; p.estadoF = {}
    arr.forEach(([pf, e], j) => { if (pf) p.porFase[j] = pf; if (e) p.estadoF[j] = e })
    p.faseAct = Math.min(p.faseAct, Math.max(0, p.fases.l.length - 1))
  }
  return <div className="mc-ctl">
    <div className="mc-f4"><div className="mc-seg">{TIPOSF.map(([k, t]) => <button key={k} className={F.tipo === k ? 'on' : ''} onClick={() => cambiaPlan((p: PlanCalor) => { if (k === 'tiempo' && p.fases.tipo !== 'tiempo') p.fases.l.forEach(f => { f.v = Math.max(1, Math.round(f.v / 2)) }); p.fases.tipo = k })}>{t}</button>)}</div>
      <span style={{ color: 'var(--grl)' }}>{TIPOSF.find(x => x[0] === F.tipo)![2]}</span></div>
    <div>{F.l.map((f: any, k: number) => <div key={k} className="mc-fase">
      <span className="dot" style={{ background: COLF[k % COLF.length] }} />
      <input className="input" value={f.n} onChange={e => cambiaPlan((p: PlanCalor) => { p.fases.l[k].n = e.target.value })} />
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="input" type="number" min={1} value={f.v} style={{ width: 64, textAlign: 'right' }} onChange={e => cambiaPlan((p: PlanCalor) => { p.fases.l[k].v = Math.max(1, +e.target.value || 1) })} /><span style={{ fontSize: 12, color: 'var(--gr)' }}>{uni}</span></span>
      {F.tipo === 'eval' ? <select className="input" value={f.o || ''} onChange={e => cambiaPlan((p: PlanCalor) => { p.fases.l[k].o = e.target.value })}><option value="">— se pasa con… —</option>{objetivos.map((o: string) => <option key={o}>{o}</option>)}<option>Test de evaluación</option></select> : <span />}
      <span className="acc"><button disabled={k === 0} onClick={() => cambiaPlan((p: PlanCalor) => mover(p, k, 'sub'))}>↑</button><button disabled={k === F.l.length - 1} onClick={() => cambiaPlan((p: PlanCalor) => mover(p, k, 'baj'))}>↓</button><button onClick={() => cambiaPlan((p: PlanCalor) => mover(p, k, 'del'))}>✕</button></span>
    </div>)}
      <button className="mc-ig" style={{ margin: '10px 0 0', fontSize: 12.5, padding: '6px 14px' }} onClick={() => cambiaPlan((p: PlanCalor) => { p.fases.l.push({ n: 'Fase ' + (p.fases.l.length + 1), v: p.fases.tipo === 'tiempo' ? 1 : 2, o: '' }) })}>+ Añadir fase</button></div>
    {F.l.length > 0 && <>
      <div className="mc-lbl" style={{ margin: '6px 0 0' }}>Cómo caen en sus citas</div>
      <div className="mc-tira" style={{ gridTemplateColumns: `repeat(${Math.max(1, citas.length)},1fr)` }}>{citas.map((c: any, i: number) => { const k = faseDe(plan, dias, i); const col = k >= 0 ? COLF[k % COLF.length] : ''
        return <div key={c.id} className="ci" style={k >= 0 ? { background: col, borderColor: col } : {}}><b style={{ color: k >= 0 ? '#fff' : 'var(--grl)', fontSize: 11 }}>{k >= 0 ? F.l[k].n : 'sin fase'}</b><span style={k >= 0 ? { color: '#fff', opacity: .85 } : {}}>{fechaCorta(c.fecha)}</span></div> })}</div>
      <div className="mc-nota">{tot < cab ? `Quedan ${cab - tot} ${uni.split(' ')[0]} sin fase.` : tot > cab ? 'Las fases suman más que el ciclo: las últimas no caben en estas citas.' : 'Las fases cubren el ciclo entero.'}</div>
    </>}
    {!F.l.length && <div className="mc-nota">Sin fases, todo el ciclo se prepara de una vez. Añade fases para prepararlo por partes.</div>}
  </div>
}

// ---------------- iconos ----------------
const svg = (d: React.ReactNode) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{d}</svg>
const IcoCal = () => svg(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>)
const IcoCapas = () => svg(<><path d="M12 3 3 8l9 5 9-5-9-5z" /><path d="m3 13 9 5 9-5" /></>)
const IcoReloj = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
const IcoRank = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
const IcoComp = () => svg(<path d="M7 4 3 8l4 4M3 8h13a5 5 0 0 1 0 10h-3M17 20l4-4-4-4" />)

// ---------------- estilos (prefijo mc- / cb- para no chocar con el resto de la app) ----------------
const CSS = `
.mc{background:#fff;border-radius:14px;overflow:hidden}
.mc-top{min-height:56px;display:flex;align-items:center;gap:10px;padding:8px 18px;border-bottom:1px solid var(--bd);flex-wrap:wrap}
.mc-chip{font-size:11.5px;padding:3px 10px;border-radius:99px;background:var(--gl);color:var(--gd)}
.mc-guard{font-size:11px;color:var(--grl)}
.mc-fbar{display:flex;gap:6px;flex-wrap:wrap}
.mc-fch{display:flex;align-items:center;gap:7px;padding:5px 12px 5px 8px;border-radius:12px;border:1.5px solid var(--bd);background:#fff;text-align:left;line-height:1.15;font-family:inherit;cursor:pointer}
.mc-fch i{width:10px;height:10px;border-radius:50%}
.mc-fch b{font-size:12.5px;display:block;color:var(--n)}.mc-fch small{font-size:10px;color:var(--grl)}
.mc-fch.on{border-color:currentColor;box-shadow:0 4px 14px rgba(38,40,37,.08)}
.mc-mesa{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:calc(100vh - 76px);min-height:680px}
.mc-carta{padding:14px 20px;overflow:auto;min-width:0;display:flex;flex-direction:column}
.mc-carta.c1{border-right:1px solid var(--bd);border-bottom:1px solid var(--bd)}
.mc-carta.c2{border-bottom:1px solid var(--bd)}
.mc-carta.c3{border-right:1px solid var(--bd)}
.mc-h{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.mc-h .t{font-size:15px;font-weight:600}.mc-h .s{margin-left:auto;font-size:11px;color:var(--grl)}
.mc-lbl{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--grl);margin:10px 0 5px;font-weight:600}
.mc-nota{font-size:11.5px;color:var(--grl);margin-top:6px;line-height:1.4}
.mc-ig{font-size:11px;padding:3px 10px;border-radius:99px;border:1px solid var(--bd);background:#fff;color:var(--gr);cursor:pointer;font-family:inherit}
.mc-ig:hover{border-color:var(--g);color:var(--gd)}
.mc-seg{display:inline-flex;border:1px solid var(--bd);border-radius:10px;overflow:hidden}
.mc-seg button{border:0;background:#fff;padding:5px 11px;font-size:12px;border-right:1px solid var(--bd);cursor:pointer;font-family:inherit}
.mc-seg button:last-child{border-right:0}.mc-seg button.on{background:var(--g);color:#fff}
.mc-dato{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dashed var(--bd);font-size:11.5px}.mc-dato span{color:var(--gr)}
/* cubo */
.cb-escena{perspective:1300px;cursor:grab;touch-action:none;user-select:none;flex:1;min-height:200px;display:grid;place-items:center;position:relative;border-radius:18px}
.cb-escena.grande{position:fixed;inset:28px;z-index:50;background:rgba(255,255,255,.82);backdrop-filter:blur(3px);box-shadow:0 20px 60px rgba(38,40,37,.18);border:1px solid var(--bd)}
.cb-cubo{position:relative;transform-style:preserve-3d}
.cb-f{position:absolute;left:0;top:0;border:1.5px solid var(--g);background:rgba(231,241,242,.55)}
.cb-tag{position:absolute;top:-22px;font-size:10px;font-weight:600;white-space:nowrap}
.cb-fecha{position:absolute;font-size:10px;color:var(--grl);white-space:nowrap}
.cb-haz{position:absolute;transform-origin:0 50%;pointer-events:none;background:linear-gradient(to bottom,#8FA9AD 0%,#fff 38%,#fff 62%,#8FA9AD 100%)}
.cb-btns{position:absolute;left:8px;top:8px;z-index:3;display:flex;gap:6px}
.cb-mini{width:30px;height:30px;border-radius:50%;border:1px solid var(--bd);background:#fff;color:var(--gr);display:inline-grid;place-items:center;font-size:14px;line-height:1;cursor:pointer;font-family:inherit;flex:none}
.cb-mini:hover{border-color:var(--g);color:var(--gd)}.cb-mini.on{background:var(--g);border-color:var(--g);color:#fff}
.cb-pop{position:absolute;left:0;top:38px;background:#fff;border:1px solid var(--bd);border-radius:12px;box-shadow:0 8px 24px rgba(38,40,37,.12);padding:10px 12px;width:270px;cursor:default}
/* a qué apunta */
.mc-glob{margin-bottom:12px}.mc-glob .lin{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:var(--gr)}.mc-glob .lin b{color:var(--n)}.mc-glob .mc-ig{margin-left:auto}
.mc-gbar{position:relative;height:30px;border-radius:10px;overflow:hidden;display:flex;background:var(--bl);touch-action:none;user-select:none}
.mc-gseg{height:100%;display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;min-width:0}
.mc-asa{position:absolute;top:0;bottom:0;width:14px;margin-left:-7px;cursor:ew-resize;display:grid;place-items:center;z-index:2}
.mc-asa::after{content:'';width:4px;height:18px;border-radius:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.15)}
.mc-tres{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex:1;min-height:200px}
.mc-tres.dos{grid-template-columns:repeat(2,1fr);flex:0 0 auto;min-height:0;height:140px}
.mc-gran{border:1.5px solid var(--bd);border-radius:18px;background:#fff;display:flex;flex-direction:column;min-width:0;overflow:hidden;transition:.2s}
.mc-gran:hover{border-color:var(--g);box-shadow:0 8px 24px rgba(90,150,158,.16)}
.mc-gcab{padding:12px 14px 6px;cursor:pointer;border-top:4px solid transparent}
.mc-gcab .gt{font-size:16px;font-weight:600;color:var(--n);display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.mc-gcab .gt small{flex-basis:100%;font-size:11.5px;color:var(--gd);font-weight:600}
.mc-gcab .gs{display:block;font-size:11px;color:var(--grl);margin-top:2px}
.mc-gp{flex:1;padding:4px 14px 10px;overflow:auto;min-height:0}
.mc-vacio{color:var(--grl);font-size:12px;display:grid;place-items:center;height:100%;cursor:pointer}
.mc-fila{padding:5px 0;border-bottom:1px dashed var(--bd)}
.mc-fila .fl{display:flex;align-items:baseline;gap:6px;font-size:12px}.mc-fila .fn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-fila .fl b{color:var(--gd)}.mc-fila .et{font-size:10px;color:var(--grl)}
.mc-fila .fr{display:flex;align-items:center;gap:6px}
.mc-fila input[type=range]{flex:1;min-width:0;-webkit-appearance:none;appearance:none;height:6px;border-radius:6px;background:var(--bl);outline:none;margin:6px 0}
.mc-fila input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--g);border:2px solid #fff;box-shadow:0 0 0 1px var(--g);cursor:pointer}
.mc-fila input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--g);border:2px solid #fff;box-shadow:0 0 0 1px var(--g);cursor:pointer}
.mc-fila .fm{font-size:10.5px;color:var(--grl);white-space:nowrap;min-width:46px;text-align:right}
.mc-res{font-size:12px;color:var(--gr);line-height:1.5}.mc-res b{color:var(--n)}
/* comparativa */
.mc-comp{flex:1;display:grid;grid-template-columns:1fr 180px 1fr;gap:10px;min-height:0}
.mc-comp .cuerpo{position:relative;pointer-events:none;min-height:240px}
.mc-comp .lado{display:flex;flex-direction:column;justify-content:space-around}
.mc-call .cn{display:flex;justify-content:space-between;gap:6px;font-size:12.5px}.mc-call .cn span{font-size:10px;font-weight:600}
.mc-call .cb{height:5px;border-radius:3px;background:var(--bl);margin-top:3px;overflow:hidden}.mc-call .cb i{display:block;height:100%;border-radius:3px}
.mc-call .cv{font-size:10.5px;color:var(--grl);text-align:right}.mc-call .cv b{color:var(--gd)}
.mc-ley{display:flex;gap:12px;font-size:11px;color:var(--gr);margin-top:4px}.mc-ley i{display:inline-block;width:10px;height:5px;border-radius:2px;margin-right:4px;vertical-align:2px}
/* reparto */
.mc-tira{display:grid;gap:3px;margin-top:3px}
.mc-tira .ci{border:1px solid var(--bd);border-radius:8px;padding:3px 0;text-align:center;background:#fff;min-width:0;overflow:hidden}
.mc-tira .ci b{display:block;font-size:14px;line-height:1.1}.mc-tira .ci span{font-size:9.5px;color:var(--grl);white-space:nowrap}
.mc-tira.mc-num .ci{background:var(--g);border:0;color:#fff;font-size:11px;padding:4px 0;border-radius:5px}
.mc-tira.mc-num .ci.desc{background:#A9ABA6}
/* velos */
.mc-velo{position:fixed;inset:28px;z-index:60;background:rgba(255,255,255,.88);backdrop-filter:blur(4px);border:1px solid var(--bd);border-radius:22px;box-shadow:0 20px 60px rgba(38,40,37,.18);display:flex;flex-direction:column;padding:22px 26px}
.mc-velo .vh{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}.mc-velo .vh b{font-size:20px}.mc-velo .vh span{color:var(--gr)}
.mc-velo .vc{flex:1;position:relative;min-height:0;overflow:auto}
.mc-velo .pie{display:flex;justify-content:flex-end;margin-top:12px}
.mc-ctl{display:flex;flex-direction:column;gap:12px}
.mc-f4{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--gr)}
.mc-paso{display:inline-flex;align-items:center;border:1px solid var(--bd);border-radius:10px;overflow:hidden}
.mc-paso button{border:0;background:#fff;width:30px;height:30px;font-size:16px;color:var(--gd);cursor:pointer}.mc-paso button:disabled{color:var(--bd)}
.mc-paso b{min-width:34px;text-align:center;font-size:15px;color:var(--n)}
.mc-aviso{display:flex;gap:8px;align-items:center;padding:8px 12px;border-radius:10px;background:var(--bl);font-size:13px}.mc-aviso .dot{width:8px;height:8px;border-radius:50%;background:var(--g);flex:none}
.mc-sescols{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.mc-sescol{border:1px solid var(--bd);border-radius:14px;padding:12px;background:#fff}
.mc-sescol h4{margin:0 0 2px;font-size:15px}.mc-sescol h4 span{font-size:11px;color:var(--grl);font-weight:400}.mc-sescol .cu{font-size:11px;color:var(--grl);margin-bottom:8px}
.mc-sescol .it{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:4px 0;border-bottom:1px dashed var(--bd)}.mc-sescol .it span{color:var(--grl);white-space:nowrap}
.mc-sescol .it.gr{border:0;margin-top:8px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--grl);font-weight:600}
.mc-sescol .it.tot{border:0;border-top:1.5px solid var(--n);margin-top:6px;font-weight:700}.mc-sescol .it.tot span{color:var(--n)}
.mc-esf{position:absolute;left:0;top:0;border-radius:50%;display:grid;place-items:center;text-align:center;font-size:12px;line-height:1.15;padding:8px;color:var(--gd);border:1.5px solid #cfe2e4;background:radial-gradient(circle at 35% 30%,#fff,var(--gl));cursor:pointer;user-select:none}
.mc-esf.suyo{border-color:var(--g)}.mc-esf.on{color:#fff;border-color:var(--gd);background:radial-gradient(circle at 35% 30%,#8fc0c6,var(--g))}
.mc-esf small{display:block;font-size:9.5px;opacity:.75;margin-top:2px}
.mc-cuads{display:flex;flex-wrap:wrap;gap:10px}
.mc-cuad{width:104px;height:104px;border-radius:14px;border:1.5px solid var(--bd);background:#fff;display:grid;place-items:center;text-align:center;padding:8px;font-size:13px;color:var(--n);cursor:pointer;font-family:inherit}
.mc-cuad.on{background:var(--gl);border-color:var(--g);color:var(--gd);font-weight:600}
.mc-zcols{display:grid;grid-template-columns:220px 1fr 1.3fr;gap:22px}
.mc-ztren{width:100%;border:1.5px solid var(--bd);border-radius:16px;background:#fff;padding:16px;text-align:left;margin-bottom:10px;cursor:pointer;font-family:inherit}
.mc-ztren b{display:block;font-size:16px}.mc-ztren span{font-size:11.5px;color:var(--gr)}.mc-ztren.on{background:var(--gl);border-color:var(--g)}
.mc-zsub{display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:12px;border:1.5px solid var(--bd);background:#fff;font-size:13.5px;cursor:pointer;font-family:inherit}
.mc-zsub.on{background:var(--gl);border-color:var(--g);color:var(--gd);font-weight:600}
.mc-ch{display:inline-block;margin:0 5px 6px 0;padding:5px 11px;border-radius:99px;border:1px solid var(--bd);background:#fff;font-size:12.5px;cursor:pointer;font-family:inherit}
.mc-ch.on{background:var(--gl);border-color:var(--g);color:var(--gd)}
.mc-tabla{width:100%;border-collapse:collapse;font-size:13px}
.mc-tabla th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--grl);font-weight:600;text-align:right;padding:8px 10px;border-bottom:1px solid var(--bd)}
.mc-tabla th:first-child,.mc-tabla td:first-child{text-align:left}
.mc-tabla td{padding:7px 10px;border-bottom:1px dashed var(--bd);text-align:right;white-space:nowrap}
.mc-tabla tr.cap td{font-weight:700;border-bottom:1px solid var(--bd);padding-top:14px}.mc-tabla tr.cap td:first-child{color:var(--gd)}
.mc-tabla tr.tot td{font-weight:700;border-top:2px solid var(--n);border-bottom:0}
.mc-ranks{display:grid;grid-template-columns:repeat(3,1fr);gap:18px 26px;align-content:start}
.mc-ranks .rk h4{margin:0 0 8px;font-size:14px;display:flex;align-items:baseline;gap:8px}.mc-ranks .rk h4 span{font-size:11px;color:var(--grl);font-weight:400}
.mc-rkf{display:grid;grid-template-columns:20px 1fr 70px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px dashed var(--bd)}
.mc-rkf .n{font-size:12px;color:var(--grl);font-weight:700}.mc-rkf .nm{font-size:13px}
.mc-rkf .br{height:6px;border-radius:6px;background:var(--bl);margin-top:4px;overflow:hidden}.mc-rkf .br i{display:block;height:100%;border-radius:4px}
.mc-rkf .v{text-align:right;font-size:12px;color:var(--gr)}.mc-rkf .v b{display:block;color:var(--n);font-size:13px}
.mc-fase{display:grid;grid-template-columns:14px 1fr 160px 220px 96px;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--bd)}
.mc-fase .dot{width:12px;height:12px;border-radius:50%}
.mc-fase .acc{display:flex;gap:4px;justify-content:flex-end}
.mc-fase .acc button{width:28px;height:28px;border-radius:8px;border:1px solid var(--bd);background:#fff;color:var(--gr);cursor:pointer}.mc-fase .acc button:disabled{opacity:.3}
.mc-inicio{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:6px}
.mc-op{min-height:170px;padding:18px;border:1.5px solid var(--bd);border-radius:14px;background:#fff;text-align:left;display:flex;flex-direction:column;gap:6px;font-family:inherit;cursor:pointer}
.mc-op b{font-size:16px;color:var(--n)}.mc-op span{font-size:12.5px;color:var(--gr);line-height:1.35}.mc-op:disabled{opacity:.4;cursor:default}
.mc-op:not(:disabled):hover{border-color:var(--g)}
@media(max-width:900px){.mc-mesa{grid-template-columns:1fr;grid-template-rows:none;height:auto}.mc-carta{min-height:420px;border-right:0!important}.mc-ranks,.mc-inicio,.mc-zcols{grid-template-columns:1fr}}
`
