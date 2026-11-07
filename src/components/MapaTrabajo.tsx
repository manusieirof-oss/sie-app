'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { traerTodo } from '@/lib/paginar'
import { textoSegundos } from '@/lib/trabajo'
import { useConfigTrabajo } from '@/components/TrabajoEjercicio'
import { ZONAS, indices, calcularMapa, cargaSemanal, COLOR_LADO, type Registro } from '@/lib/mapaTrabajo'
import { RAMPA, colorCalor } from '@/lib/rampaCalor'
import type { MapaCalor3D } from '@/lib/anim3d/mapaCalor'
import { zonasDe } from '@/components/ficha/CuerpoSalud'

/**
 * MAPA DE TRABAJO del paciente (Resultados › Mapa).
 *
 * El cuerpo girando con cada zona teñida por su parte del trabajo hecho en la sala.
 * Arriba se filtra por periodo, intensidad y ejecución; tocar una zona la acerca y
 * enseña su reparto por movimiento, intención y ejercicios. La capa "combinada" suma
 * también lo que el ejercicio mueve de forma secundaria (a medio peso).
 * El icono de la carga abre minutos por semana, tonelaje y aviso de pico.
 *
 * En la ficha va con una LENTE (el botón de vistas de entreno):
 *   · trabajo      — el calor de siempre;
 *   · intensidad   — cada zona con el color de la intensidad que más trabaja;
 *   · lateralidad  — bilateral, unilateral o alterno, mezclado según lo que pese cada uno;
 *   · tiempo/reps  — el calor contando solo lo que va por segundos o solo por repes.
 */
export type LenteEntreno = 'ahora' | 'trabajo' | 'intensidad' | 'lateralidad' | 'tiempo' | 'reps'

/* AHORA: lo que está entrenando ahora mismo. El calor de los músculos es lo que ha HECHO
   de verdad (registros de la sala) con sus sesiones actuales —las que tiene puestas en
   las próximas citas y la de su última clase—, no lo que falta por hacer. Y encima, como
   esferas, lo que tiene ACTIVO: molestias (rojo) y patologías sin resolver (ámbar), cada
   una en su lado. */
const COL_AHORA = { molestia: '#C0392B', patologia: '#D4A017' }
type Activo = { tipo: 'molestia' | 'patologia', titulo: string, detalle: string, zonas: string[], lado?: string, v: number }
async function sesionesActuales(pacienteId: string): Promise<string[]> {
  const hoy = new Date().toISOString().slice(0, 10)
  const [{ data: fut }, { data: ult }] = await Promise.all([
    supabase.from('citas').select('sesion_id').eq('paciente_id', pacienteId).eq('estado', 'programada').gte('fecha', hoy).not('sesion_id', 'is', null),
    supabase.from('citas').select('sesion_id').eq('paciente_id', pacienteId).eq('estado', 'realizada').not('sesion_id', 'is', null).order('fecha', { ascending: false }).limit(1),
  ])
  return Array.from(new Set([...(fut || []), ...(ult || [])].map((c: any) => c.sesion_id)))
}

/** Mezcla de colores pesada por los segundos de cada uno. */
function mezclar(por: Record<string, number>, color: (k: string) => string) {
  let r = 0, g = 0, b = 0, w = 0
  Object.entries(por).forEach(([k, s]) => { const c = color(k); if (!/^#[0-9a-f]{6}$/i.test(c)) return
    r += parseInt(c.slice(1, 3), 16) * s; g += parseInt(c.slice(3, 5), 16) * s; b += parseInt(c.slice(5, 7), 16) * s; w += s })
  if (!w) return undefined
  const h = (x: number) => Math.round(x / w).toString(16).padStart(2, '0')
  return '#' + h(r) + h(g) + h(b)
}

const PERIODOS: [string, string, number | null][] = [['4s', '4 semanas', 28], ['3m', '3 meses', 91], ['6m', '6 meses', 182], ['todo', 'Todo', null]]

/* LO PROGRAMADO, COMO SI SE HUBIERA HECHO (ficha del paciente): sus próximas citas con
   sesión se convierten en "registros" con las series y reps del plan, y el cuerpo enseña
   lo que tiene para entrenar. Misma cuenta que lo hecho (calcularMapa). */
async function registrosProgramados(pacienteId: string): Promise<Registro[]> {
  const { aplicarAjustes } = await import('@/lib/ajustesCita')
  const hoy = new Date().toISOString().slice(0, 10)
  const { data } = await supabase.from('citas').select('fecha,sesion_id,ajustes,sesiones:sesion_id(partes)')
    .eq('paciente_id', pacienteId).gte('fecha', hoy).eq('estado', 'programada').not('sesion_id', 'is', null).order('fecha')
  const out: Registro[] = []
  ;(data || []).forEach((c: any) => {
    const ses = aplicarAjustes(Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones, c.ajustes)
    ;(ses?.partes || []).forEach((p: any) => (p?.ejercicios || []).forEach((it: any) => {
      if (!it?.ejercicio_id) return
      const n = Math.max(1, parseInt(String(it.series || p.series || p.vueltas || 3)) || 3)
      const serie = { reps: it.reps || '', segundos: it.tiempo || it.segundos || '' }
      out.push({ fecha: c.fecha, ejercicio_id: it.ejercicio_id, series: Array.from({ length: n }, () => serie), regimen: it.regimen || null, sesion_id: c.sesion_id, lado: it.lado || null })
    }))
  })
  return out
}

export default function MapaTrabajo({ pacienteId, programado = false, lente = 'trabajo' }: { pacienteId: string,
  /** Ficha: lo que tiene programado (próximas citas), no lo hecho. */
  programado?: boolean, lente?: LenteEntreno }) {
  const cfg = useConfigTrabajo()
  const [periodo, setPeriodo] = useState('3m')
  const [regs, setRegs] = useState<Registro[] | null>(null)
  const [ejs, setEjs] = useState<Record<string, any>>({})
  const [ets, setEts] = useState<any[]>([])
  const [fInt, setFInt] = useState<string[]>([])
  const [fEje, setFEje] = useState<string[]>([])
  const [combinada, setCombinada] = useState(false)
  const [zona, setZona] = useState<string | null>(null)
  const [encima, setEncima] = useState<string | null>(null)
  const [verCarga, setVerCarga] = useState(false)
  // Los filtros de intención y ejecución, escondidos tras un icono: eran tres filas de
  // pastillas encima del cuerpo y tapaban lo importante.
  const [verFiltros, setVerFiltros] = useState(false)
  const [fallo, setFallo] = useState('')
  const ahora = lente === 'ahora'
  const [activos, setActivos] = useState<Activo[]>([])
  const [nAhora, setNAhora] = useState<{ sesiones: number, sinSesiones: boolean }>({ sesiones: 0, sinSesiones: false })

  // Todo lo anotado del paciente (paginado) y los ejercicios que salen en ello.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      setRegs(null)
      const sesIds = ahora ? await sesionesActuales(pacienteId) : []
      if (ahora) setNAhora({ sesiones: sesIds.length, sinSesiones: !sesIds.length })
      const [{ filas }, et] = await Promise.all([
        // Ahora: lo hecho con sus sesiones actuales. Sin sesiones puestas, sus últimas 4 semanas.
        ahora ? (sesIds.length
            ? traerTodo((d, h) => supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen,sesion_id').eq('paciente_id', pacienteId).in('sesion_id', sesIds).order('id').range(d, h))
            : traerTodo((d, h) => supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen,sesion_id').eq('paciente_id', pacienteId).gte('fecha', new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10)).order('id').range(d, h)))
        : programado ? registrosProgramados(pacienteId).then(filas => ({ filas }))
          : traerTodo((d, h) => supabase.from('registros_ejercicio').select('fecha,ejercicio_id,series,regimen,sesion_id').eq('paciente_id', pacienteId).order('id').range(d, h)),
        supabase.from('etiquetas').select('id,nombre,categoria,padre_id'),
      ])
      const ids = Array.from(new Set((filas || []).map((r: any) => r.ejercicio_id).filter(Boolean)))
      const mapa: Record<string, any> = {}
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('ejercicios').select('id,nombre,trabajo,anatomia,tipo_medida').in('id', ids.slice(i, i + 200))
        ;(data || []).forEach((e: any) => { mapa[e.id] = e })
      }
      if (!vivo) return
      setEts(et.data || []); setEjs(mapa); setRegs(filas || [])
    })()
    return () => { vivo = false }
  }, [pacienteId, ahora]) // eslint-disable-line react-hooks/exhaustive-deps
  // Lo que tiene ACTIVO ahora (solo en «Ahora»).
  useEffect(() => {
    if (!ahora) { setActivos([]); return }
    ;(async () => {
      const [{ data: mol }, { data: pat }] = await Promise.all([
        supabase.from('molestias').select('zona,eva,lado').eq('paciente_id', pacienteId).eq('activa', true),
        supabase.from('patologias').select('nombre,zona,estado,lado').eq('paciente_id', pacienteId).neq('estado', 'resuelta'),
      ])
      const lado = (l?: string) => l && l !== 'no_aplica' ? l : ''
      setActivos([
        ...(mol || []).map((m: any) => ({ tipo: 'molestia' as const, titulo: m.zona, detalle: [m.eva != null ? `EVA ${m.eva}/10` : '', lado(m.lado)].filter(Boolean).join(' · '), zonas: zonasDe(m.zona), lado: m.lado, v: m.eva != null ? 0.4 + 0.6 * m.eva / 10 : 0.6 })),
        ...(pat || []).map((p: any) => ({ tipo: 'patologia' as const, titulo: p.nombre, detalle: [p.estado === 'cronica' ? 'crónica' : 'activa', lado(p.lado)].filter(Boolean).join(' · '), zonas: zonasDe(`${p.zona || ''} ${p.nombre}`), lado: p.lado, v: p.estado === 'cronica' ? 0.55 : 0.8 })),
      ])
    })()
  }, [pacienteId, ahora])

  const idx = useMemo(() => indices(ets), [ets])
  const enPeriodo = useMemo(() => {
    const dias = PERIODOS.find(p => p[0] === periodo)?.[2]
    if (!regs) return []
    if (ahora) return regs
    if (!dias) return regs
    // Programado: hacia delante (las próximas N semanas); hecho: hacia atrás.
    if (programado) { const hasta = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10); return regs.filter(r => r.fecha <= hasta) }
    const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
    return regs.filter(r => r.fecha >= desde)
  }, [regs, periodo, programado, ahora])
  const medida = lente === 'tiempo' ? 'tiempo' as const : lente === 'reps' ? 'reps' as const : undefined
  const m = useMemo(() => calcularMapa(enPeriodo, ejs, idx, cfg, { int: fInt, eje: fEje, combinada, medida }), [enPeriodo, ejs, idx, cfg, fInt, fEje, combinada, medida])
  const carga = useMemo(() => cargaSemanal(regs || [], ejs, cfg), [regs, ejs, cfg])

  const enZonas = Object.values(m.zonas).reduce((n, z) => n + z.seg, 0)
  const ranking = ZONAS.map(z => ({ z, seg: m.zonas[z.k]?.seg || 0 })).filter(x => x.seg > 0).sort((a, b) => b.seg - a.seg)
  const pct = (s: number, de = enZonas) => (de ? Math.round(s / de * 100) : 0)

  // ── El cuerpo ──
  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<MapaCalor3D | null>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearMapaCalor } = await import('@/lib/anim3d/mapaCalor')
        if (!caja.current) return
        // En «Ahora» las esferas llevan «zona|lado|tipo»: se queda la zona.
        const v = await crearMapaCalor(caja.current, { zona: k => setZona(k ? k.split('|')[0] : null), encima: k => setEncima(k ? k.split('|')[0] : null) })
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch (e: any) { setFallo(e?.message || 'No se pudo abrir el cuerpo 3D') }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])
  useEffect(() => {
    if (!visor.current) return
    const maxZ = Math.max(0, ...Object.values(m.zonas).map(z => z.seg))
    const maxM = Math.max(0, ...Object.values(m.musculos))
    const zonas: Record<string, any> = {}
    // Intensidad y lateralidad pintan cada zona con SU color; los músculos se apagan
    // para que el tinte del calor no se confunda con esos colores.
    const conColor = lente === 'intensidad' || lente === 'lateralidad'
    const colorZona = (Z: any) => lente === 'intensidad' ? mezclar(Z.porInt, k => cfg.intensidades.find(i => i.id === k)?.color || '')
      : lente === 'lateralidad' ? mezclar(Z.porLado, k => COLOR_LADO[k] || '') : undefined
    if (ahora) {
      // Músculos = lo entrenado; esferas = lo activo, cada cosa en su lado.
      activos.forEach(a => a.zonas.forEach(k => {
        const z = ZONAS.find(x => x.k === k); if (!z) return
        const l = a.lado === 'izquierdo' ? 'I' : a.lado === 'derecho' ? 'D' : ''
        const pares = z.huesos.some((h: string) => h.endsWith('D')) && z.huesos.some((h: string) => h.endsWith('I'))
        const huesos = pares && l ? z.huesos.filter((h: string) => h.endsWith(l)) : z.huesos
        const c = `${k}|${pares ? l || 'C' : 'C'}|${a.tipo}`
        zonas[c] = { v: Math.max(zonas[c]?.v || 0, a.v), huesos, off: a.tipo === 'patologia' ? [(z.off || [0, 0, 0])[0], (z.off || [0, 0, 0])[1] + 2, (z.off || [0, 0, 0])[2]] : z.off, color: COL_AHORA[a.tipo] }
      }))
    } else
    ZONAS.forEach(z => { const Z = m.zonas[z.k], s = Z?.seg || 0; if (s > 0) zonas[z.k] = { v: s / maxZ, huesos: z.huesos, off: z.off, color: colorZona(Z) } })
    visor.current.poner({ zonas, musculos: conColor ? {} : Object.fromEntries(Object.entries(m.musculos).map(([k, s]) => [k, maxM ? s / maxM : 0])) })
  }, [m, listo, lente, activos]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { visor.current?.enfocar(zona) }, [zona, listo])

  // ── Piezas ──
  const nombreEt = (id: string) => id === 'sin' ? 'Sin movimiento' : (idx.porId[id]?.nombre || '—')
  const int = (id: string) => cfg.intensidades.find(i => i.id === id)
  const eje = (id: string) => cfg.ejecuciones.find(i => i.id === id)
  const chip = (on: boolean, color?: string): React.CSSProperties => ({
    // Discretos, como los atajos de la nebulosa. Los de color (intensidades) llevan un
    // fondo suave de su color cuando están encendidos.
    fontSize: 11.5, fontWeight: on ? 600 : 500, padding: color ? '3px 10px' : '3px 6px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    border: color ? `1px solid ${on ? color : 'var(--bd)'}` : 'none', background: on && color ? color + '22' : 'transparent', color: on ? (color ? 'var(--n)' : 'var(--gd)') : 'var(--grl)',
    textDecoration: on && !color ? 'underline' : 'none', textUnderlineOffset: 4,
  })
  const barras = (o: Record<string, number>, nombre: (k: string) => string, color: (k: string) => string, total: number, max = 8) => {
    const l = Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, max)
    if (!l.length) return <div style={{ fontSize: 12, color: 'var(--grl)' }}>—</div>
    return l.map(([k, s]) => (
      <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 38px', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre(k)}</span>
        <span style={{ height: 7, borderRadius: 9, background: 'var(--bl)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct(s, total)}%`, background: color(k) }}/></span>
        <span style={{ textAlign: 'right', color: 'var(--gr)' }}>{pct(s, total)}%</span>
      </div>
    ))
  }
  // Ejecución y movimiento en gris: el verde ya es el cuerpo y los cálidos son el calor y
  // las intensidades; con otro color de barra se confundían.
  const titulo = (t: string) => <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--grl)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '14px 0 6px' }}>{t}</div>

  const Z = zona ? m.zonas[zona] : null
  // Lateralidad de todo el cuerpo: la suma de la de cada zona.
  const porLadoTotal: Record<string, number> = {}
  Object.values(m.zonas).forEach(z => Object.entries(z.porLado || {}).forEach(([k, s]) => { porLadoTotal[k] = (porLadoTotal[k] || 0) + s }))
  const zDef = ZONAS.find(z => z.k === zona)

  return (
    // En la ficha (programado) sin tarjeta ni sombra, y el muñeco con el mismo ancho que
    // en salud (.cuerpo2/.cuerpo3) para que al cambiar de vista no salte.
    <div style={programado ? {} : { background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(38,40,37,.07)', padding: 16 }}>
      <div className={programado ? 'cuerpo2' : undefined} style={programado ? undefined : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }}>
        {/* El cuerpo */}
        <div>
          <div ref={caja} style={{ position: 'relative', height: 500, borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
            {(!listo || regs === null) && !fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>}
            {fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>{fallo}</div>}
            {encima && !zona && <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 12, background: 'var(--n)', color: '#fff', padding: '3px 9px', borderRadius: 99 }}>
              {ZONAS.find(z => z.k === encima)?.n} · {pct(m.zonas[encima]?.seg || 0)}%</div>}
            {zona && <button type="button" className="btn btn-s btn-sm" style={{ position: 'absolute', top: 10, left: 10 }} onClick={() => setZona(null)}>← Todo el cuerpo</button>}
          </div>
              {/* Periodo, capa y carga: DEBAJO del muñeco, encima de la barra de color. Los
                  filtros flotan hacia arriba: si empujaran, el muñeco se movería y marea. */}
          <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 34, marginTop: 6 }}>
            {!ahora && PERIODOS.map(([k, t]) => <button key={k} type="button" style={chip(periodo === k)} onClick={() => setPeriodo(k)}>{t}</button>)}
            <span style={{ width: 10 }}/>
            <button type="button" style={chip(!combinada)} onClick={() => setCombinada(false)} title="Solo lo principal (★) de cada ejercicio">Principal</button>
            <button type="button" style={chip(combinada)} onClick={() => setCombinada(true)} title="También lo secundario, a medio peso">Combinada</button>
            <span style={{ flex: 1 }}/>
            <button type="button" onClick={() => setVerFiltros(v => !v)} title="Filtrar por intención y ejecución" className="btn-vista"
              style={{ padding: '7px 11px', color: verFiltros || fInt.length || fEje.length ? 'var(--gd)' : 'var(--gr)', borderColor: verFiltros ? 'var(--g)' : undefined }}>
              <Ic name="filtro" size={16}/>{fInt.length + fEje.length > 0 ? ` ${fInt.length + fEje.length}` : ''}
            </button>
            {!programado && <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setVerCarga(!verCarga)} title="Carga de trabajo"
                style={{ border: '1px solid var(--bd)', background: carga.pico ? '#FDEDE8' : '#fff', borderRadius: 99, width: 30, height: 30, cursor: 'pointer', display: 'grid', placeItems: 'center', color: carga.pico ? '#C0392B' : 'var(--gr)' }}>
                <Ic name="progreso" size={14}/>
              </button>
              {verCarga && <PanelCarga carga={carga} onCerrar={() => setVerCarga(false)}/>}
            </div>}
          </div>
          {/* Filtros de intención (desplegables con el icono) */}
          {verFiltros && <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid var(--bd)', borderRadius: 14, boxShadow: '0 8px 28px rgba(38,40,37,.12)', padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {cfg.intensidades.map(i => <button key={i.id} type="button" style={chip(fInt.includes(i.id), i.color)} onClick={() => setFInt(fInt.includes(i.id) ? fInt.filter(x => x !== i.id) : [...fInt, i.id])}>{i.nombre}</button>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10, alignItems: 'center' }}>
            {cfg.ejecuciones.map(e => <button key={e.id} type="button" style={chip(fEje.includes(e.id))} onClick={() => setFEje(fEje.includes(e.id) ? fEje.filter(x => x !== e.id) : [...fEje, e.id])}>{e.nombre}</button>)}
            {(fInt.length > 0 || fEje.length > 0) && <button type="button" className="btn btn-t btn-sm" onClick={() => { setFInt([]); setFEje([]) }}>Quitar filtros</button>}
          </div>
          </div>}
          </div>
          {/* La leyenda cambia con la lente: colores propios o la rampa del calor. */}
          {ahora
            ? <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--gr)', marginTop: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Músculos: lo hecho <span style={{ width: 70, height: 6, borderRadius: 9, background: `linear-gradient(90deg,${RAMPA.join(',')})` }}/></span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: COL_AHORA.molestia }}/>Molestia</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: COL_AHORA.patologia }}/>Patología</span>
              </div>
            : lente === 'intensidad' || lente === 'lateralidad'
            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--gr)', marginTop: 6 }}>
                {(lente === 'intensidad' ? cfg.intensidades.filter(i => m.porInt[i.id]).map(i => [i.nombre, i.color]) : Object.entries(COLOR_LADO)).map(([t, c]) =>
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: c }}/>{t}</span>)}
                <span style={{ color: 'var(--grl)' }}>· más grande, más trabajo</span>
              </div>
            : <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--grl)', marginTop: 6 }}>
                {lente === 'tiempo' ? 'Solo lo que va por tiempo · ' : lente === 'reps' ? 'Solo lo que va por repes · ' : ''}Menos <span style={{ flex: 1, height: 6, borderRadius: 9, background: `linear-gradient(90deg,${RAMPA.join(',')})` }}/> Más
              </div>}
        </div>

        {/* El reparto */}
        <div>
          {ahora && <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--grl)', marginBottom: 6 }}>{nAhora.sinSesiones ? 'Sin sesiones puestas: lo hecho en las últimas 4 semanas.' : `Lo hecho con sus ${nAhora.sesiones} sesi${nAhora.sesiones === 1 ? 'ón' : 'ones'} actuales.`}</div>
            {activos.length > 0 && <>{titulo('Activo ahora')}{activos.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, padding: '2px 0' }}>
                <i style={{ width: 9, height: 9, borderRadius: '50%', background: COL_AHORA[a.tipo], flex: 'none' }}/>
                <span style={{ color: 'var(--n)', fontWeight: 500 }}>{a.titulo}</span><span style={{ color: 'var(--gr)', fontSize: 12 }}>{a.detalle}{!a.zonas.length ? ' · sin zona en el cuerpo' : ''}</span>
              </div>))}</>}
          </div>}
          {regs !== null && m.total === 0 && <div style={{ fontSize: 13, color: 'var(--grl)', padding: '20px 0' }}>{ahora ? 'Aún no ha hecho nada con sus sesiones actuales' : programado ? 'Nada programado con sesión en este periodo' : 'Nada anotado en la sala en este periodo'}{fInt.length || fEje.length ? ' con estos filtros' : ''}.</div>}
          {!Z && m.total > 0 && <>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Dato n={textoSegundos(m.total)} t="de trabajo"/>
              <Dato n={String(m.sesiones)} t="sesiones"/>
              {m.liberacion > 0 && <Dato n={textoSegundos(m.liberacion)} t="liberación"/>}
            </div>
            {m.estimado > 0 && <div style={{ fontSize: 11.5, color: 'var(--grl)', marginTop: 4 }}>{pct(m.estimado, m.total)}% estimado ("aguanta lo que puedas" sin tiempo apuntado)</div>}
            {m.sinAnatomia > 0 && <div style={{ fontSize: 11.5, color: '#8A6410', marginTop: 4 }}>{textoSegundos(m.sinAnatomia)} de ejercicios sin anatomía: no salen en el cuerpo</div>}
            {titulo('Por zona · toca una para verla')}
            {ranking.map(({ z, seg }) => (
              <button key={z.k} type="button" onClick={() => setZona(z.k)}
                style={{ display: 'grid', gridTemplateColumns: '1fr 140px 38px', gap: 8, alignItems: 'center', width: '100%', border: 'none', background: encima === z.k ? 'var(--bl)' : 'transparent', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left' }}>
                <span>{z.n}</span>
                <span style={{ height: 8, borderRadius: 9, background: 'var(--bl)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct(seg)}%`, background: colorCalor(0.25 + 0.75 * seg / (ranking[0]?.seg || 1)) }}/></span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{pct(seg)}%</span>
              </button>
            ))}
            {lente === 'lateralidad' && <>{titulo('Lateralidad')}{barras(porLadoTotal, k => k, k => COLOR_LADO[k] || '#bbb', m.total)}</>}
            {titulo('Intención')}
            {barras(m.porInt, k => int(k)?.nombre || 'Sin intensidad', k => int(k)?.color || '#bbb', m.total)}
            {titulo('Ejecución')}
            {barras(m.porEje, k => eje(k)?.nombre || k, () => '#9A9C97', m.total)}
          </>}
          {Z && zDef && <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{zDef.n}</div>
              <div style={{ fontSize: 22, color: colorCalor(0.8) }}>{pct(Z.seg)}%</div>
              <div style={{ fontSize: 12, color: 'var(--grl)' }}>{textoSegundos(Z.seg)}</div>
            </div>
            {Object.keys(Z.porArt).length > 1 && <>{titulo('Articulación')}{barras(Z.porArt, nombreEt, () => 'var(--gd)', Z.seg)}</>}
            {lente === 'lateralidad' && <>{titulo('Lateralidad')}{barras(Z.porLado, k => k, k => COLOR_LADO[k] || '#bbb', Z.seg)}</>}
            {titulo('Movimiento')}
            {barras(Z.porMov, nombreEt, () => '#6E716C', Z.seg)}
            {titulo('Intención')}
            {barras(Z.porInt, k => int(k)?.nombre || 'Sin intensidad', k => int(k)?.color || '#bbb', Z.seg)}
            {titulo('Ejecución')}
            {barras(Z.porEje, k => eje(k)?.nombre || k, () => '#9A9C97', Z.seg)}
            {titulo('Ejercicios que más aportan')}
            {barras(Z.porEj, k => ejs[k]?.nombre || '—', () => 'var(--gl)', Z.seg, 6)}
          </>}
        </div>
      </div>
    </div>
  )
}

function Dato({ n, t }: { n: string, t: string }) {
  return <div><div style={{ fontSize: 20, fontWeight: 600, color: 'var(--n)' }}>{n}</div><div style={{ fontSize: 11, color: 'var(--grl)' }}>{t}</div></div>
}

/** La carga, discreta: minutos por semana, tonelaje y aviso si la última sube mucho. */
function PanelCarga({ carga, onCerrar }: { carga: ReturnType<typeof cargaSemanal>, onCerrar: () => void }) {
  const max = Math.max(1, ...carga.min)
  const sem = carga.min.map((v, i) => ({ v, kg: carga.kg[i], t: i === 0 ? 'Esta' : `-${i}` })).reverse()
  return (
    <div style={{ position: 'absolute', right: 0, top: 36, zIndex: 20, width: 280, background: '#fff', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,.15)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>Carga semanal</b>
        <button type="button" className="btn btn-t btn-sm" onClick={onCerrar} style={{ padding: '1px 6px' }}><Ic name="cerrar" size={10}/></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {sem.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }} title={`${s.v} min · ${s.kg} kg`}>
            <div style={{ height: Math.max(2, s.v / max * 64), background: i === sem.length - 1 ? (carga.pico ? '#E4572E' : 'var(--g)') : 'var(--gl)', borderRadius: 4 }}/>
            <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 3 }}>{s.t}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
        Esta semana: <b>{carga.min[0]} min</b>{carga.kg[0] ? ` · ${carga.kg[0].toLocaleString('es-ES')} kg movidos` : ''}<br/>
        Media de las 4 anteriores: {carga.media} min
      </div>
      {carga.pico && <div style={{ fontSize: 12, color: '#C0392B', marginTop: 6 }}>Sube un {Math.round((carga.ratio! - 1) * 100)}% sobre su media: ojo con el pico de carga.</div>}
    </div>
  )
}
