'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO, sumarDias } from '@/lib/fechas'
import NebulosaPrograma, { PALETA, COL_CAMBIO, hex, type CitaNeb, type VistaNeb } from '@/components/ficha/NebulosaPrograma'
import MapaTrabajo, { type LenteEntreno } from '@/components/MapaTrabajo'
import CuerpoSalud, { type VistaSalud } from '@/components/ficha/CuerpoSalud'
import { Ic } from '@/lib/icons'
import { useRouter } from 'next/navigation'
import { usePuede } from '@/lib/permisos'

// ---------------------------------------------------------------------------
// LA FICHA, DE UN VISTAZO: su programación y lo que tiene para entrenar.
//
//   · La NEBULOSA con su haz de luz: un punto por cita, de la fecha que se elija en la
//     barra doble de abajo a la otra (desde que empezó hasta lo último programado).
//     Con un botón de vistas, como el del cuerpo: cambios, sesiones, objetivos, molestias.
//     Un toque la abre en grande.
//   · El CUERPO 3D con lo que tiene PROGRAMADO (MapaTrabajo en modo programado).
// ---------------------------------------------------------------------------

const fCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
const fLarga = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }).replace('.', '')
const ms = (f: string) => new Date(f + 'T12:00:00').getTime()
const DIA = 864e5
const dias = (a: string, b: string) => Math.round((ms(b) - ms(a)) / DIA)

/** INTENSIDAD media de una sesión (0..1): por las reps de cada ejercicio, como los tramos
    de capacidad (pocas reps = más intenso); lo que va por tiempo cuenta como suave. */
function intensidad(partes: any[]) {
  const vals: number[] = []
  ;(partes || []).forEach((p: any) => (p?.ejercicios || []).forEach((it: any) => {
    const r = parseInt(String(it?.reps || ''))
    vals.push(!r ? 0.3 : r <= 3 ? 1 : r <= 6 ? 0.85 : r <= 12 ? 0.65 : r <= 20 ? 0.45 : 0.3)
  }))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0.4
}

/* SUAVE: media de cada cita con sus vecinas y raíz para que un día muy cargado no sea un
   pico que se salga; así el haz sube y baja sin dientes de sierra. */
const suavizar = (xs: number[]) => xs.map((_, i) => {
  const ven = xs.slice(Math.max(0, i - 1), i + 2)
  return Math.sqrt(ven.reduce((a, b) => a + b, 0) / ven.length)
})

/** Trabajo aproximado de una sesión: series × (reps, o segundos/3) de todos sus ejercicios. */
function volumen(partes: any[]) {
  let v = 0
  ;(partes || []).forEach((p: any) => (p?.ejercicios || []).forEach((it: any) => {
    const n = parseInt(String(it?.series || p?.series || 3)) || 3
    const r = parseInt(String(it?.reps || '')) || (parseInt(String(it?.tiempo || '')) || 30) / 3
    v += n * r
  }))
  return v
}

/* La HUELLA de una molestia: al quitarse, la zona queda rosada y se va apagando. Cuanto
   más fuerte fue, más tarda en irse: 3 semanas por cada punto de EVA. */
const HUELLA_DIAS_POR_EVA = 21

/* LOS DOS BOTONES DEL CUERPO, como en la biblioteca y la agenda (un toque, la siguiente):
   a la izquierda SALUD y a la derecha ENTRENO. Manda el último que se tocó; tocar el
   apagado lo enciende en su vista, tocar el encendido pasa a la siguiente.
   Se recuerda en este aparato. */
const VISTAS_SALUD: { k: VistaSalud, t: string, ic: string }[] = [
  { k: 'dolor', t: 'Dolor ahora', ic: 'molestia' }, { k: 'operaciones', t: 'Operaciones', ic: 'cruz' },
  { k: 'patologias', t: 'Patologías', ic: 'patologia' }, { k: 'todo', t: 'Toda su salud', ic: 'salud' },
]
const VISTAS_ENTRENO: { k: LenteEntreno, t: string }[] = [
  { k: 'ahora', t: 'Ahora' }, { k: 'trabajo', t: 'Programado' }, { k: 'intensidad', t: 'Intensidad' }, { k: 'lateralidad', t: 'Lateralidad' },
  { k: 'tiempo', t: 'Por segundos' }, { k: 'reps', t: 'Por repeticiones' },
]
// Y el de la nebulosa, igual.
const VISTAS_NEB: { k: VistaNeb, t: string }[] = [
  { k: 'normal', t: 'Normal' }, { k: 'cambios', t: 'Faltas, canceladas y cambios' }, { k: 'sesiones', t: 'Sesiones' },
  { k: 'objetivos', t: 'Objetivos' }, { k: 'molestias', t: 'Molestias' },
]
// Atajos de la barra de fechas: lo último y un poco de lo que viene (un tercio).
const ATAJOS: { k: string, t: string, d: number }[] = [
  { k: 'semana', t: 'Semana', d: 7 }, { k: 'mes', t: 'Mes', d: 30 }, { k: '3m', t: '3 meses', d: 91 }, { k: 'anio', t: 'Año', d: 365 }, { k: 'todo', t: 'Todo', d: 0 },
]

/** El botón de vistas: el nombre y un puntito por vista, encendido el que toca. */
function BotonVistas({ t, n, i, onClick, apagado }: { t: React.ReactNode, n: number, i: number, onClick: () => void, apagado?: boolean }) {
  return (
    // Botón sutil, sin fondo: que se vea que es un botón pero no una píldora.
    <button type="button" className={'btn-vista' + (apagado ? ' apagado' : '')} onClick={onClick} title="Cambiar lo que se ve">
      {t}
      <span style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>{Array.from({ length: n }, (_, k) => <i key={k} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: k === i ? 1 : .3 }}/>)}</span>
    </button>
  )
}
/** Bienestar: alto es bueno. Estrés: alto es malo. */
const colBien = (v: number) => v >= 7 ? ['var(--gd)', 'var(--gl)'] : v >= 4 ? ['#8A6410', 'var(--ambl)'] : ['var(--red)', 'var(--redl)']
const colEstres = (v: number) => colBien(10 - v)
function SolapasDia({ ctx, abierta, setAbierta, onAnotar }: { ctx: any, abierta: string | null, setAbierta: (f: (a: string | null) => string | null) => void
  /** Apuntar algo nuevo: lleva a la revaloración (paso Anamnesis). */
  onAnotar?: () => void }) {
  const e0 = ctx.escalas[0], e1 = ctx.escalas[1]
  const flecha = (k: 'borg' | 'estres') => !e0 || !e1 || e0[k] == null || e1[k] == null || e0[k] === e1[k] ? '' : e0[k] > e1[k] ? ' ↑' : ' ↓'
  const lista: { k: string, ic: string, t: string, col: readonly string[] | string[], vacia: boolean }[] = [
    { k: 'deportes', ic: 'deporte', t: ctx.deportes.length ? `Deportes · ${ctx.deportes.length}` : 'Deportes', col: ['#3F6FA8', '#EEF3FA'], vacia: !ctx.deportes.length },
    { k: 'plantillas', ic: 'plantillas', t: 'Plantillas', col: ['#6B579A', '#F2EEF8'], vacia: !ctx.plant.usa },
    { k: 'bienestar', ic: 'progreso', t: e0?.borg != null ? `Se encuentra ${e0.borg}/10${flecha('borg')}` : 'Cómo se encuentra', col: e0?.borg != null ? colBien(e0.borg) : ['var(--gr)', 'var(--bl)'], vacia: e0?.borg == null },
    { k: 'estres', ic: 'rayo', t: e0?.estres != null ? `Estrés ${e0.estres}/10${flecha('estres')}` : 'Estrés', col: e0?.estres != null ? colEstres(e0.estres) : ['var(--gr)', 'var(--bl)'], vacia: e0?.estres == null },
  ]
  const serie = (k: 'borg' | 'estres') => ctx.escalas.filter((e: any) => e[k] != null)
  const dentro = abierta === 'deportes' ? (ctx.deportes.length ? ctx.deportes.map((d: string, i: number) => <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>· {d}</div>) : <div className="muted">Sin deportes apuntados.</div>)
    : abierta === 'plantillas' ? (ctx.plant.usa ? <div style={{ fontSize: 13, lineHeight: 1.7 }}>Usa plantillas{ctx.plant.izq ? <><br/>Izquierda: {ctx.plant.izq}</> : null}{ctx.plant.der ? <><br/>Derecha: {ctx.plant.der}</> : null}</div> : <div className="muted">No usa plantillas.</div>)
    : abierta === 'bienestar' || abierta === 'estres' ? (() => { const k = abierta === 'bienestar' ? 'borg' : 'estres'; const l = serie(k)
        return l.length ? <>
          <div style={{ fontSize: 12, color: 'var(--grl)', marginBottom: 4 }}>{abierta === 'bienestar' ? 'Cómo se encuentra (alto es bueno)' : 'Estrés (alto es malo)'} · últimos registros</div>
          {l.map((e: any, i: number) => <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '1px 0' }}>
            <span style={{ color: 'var(--grl)', width: 74 }}>{fLarga(e.fecha)}</span><b style={{ fontWeight: 600, color: (k === 'borg' ? colBien : colEstres)(e[k])[0] }}>{e[k]}/10</b></div>)}
        </> : <div className="muted">Sin registros todavía. Se apuntan en Salud.</div> })()
    : null
  return <>
    {/* Pegadas al borde izquierdo, como las de la nebulosa. */}
    <div style={{ position: 'absolute', left: -20, top: 0, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lista.map(x => <button key={x.k} type="button" className={'solapa' + (abierta === x.k ? ' on' : '') + (x.vacia ? ' vacia' : '')} onClick={() => setAbierta(a => a === x.k ? null : x.k)}
        style={{ color: x.col[0], background: x.col[1] }}><Ic name={x.ic} size={12}/> {x.t}</button>)}
    </div>
    {/* Lo abierto, tal cual en el blanco junto al muñeco: solo texto. */}
    {dentro && <div style={{ position: 'absolute', left: 160, top: 0, width: 'min(320px, 45%)', maxHeight: 420, overflow: 'auto', zIndex: 6, background: 'rgba(255,255,255,.92)', padding: '2px 8px' }}>
      <button type="button" onClick={() => setAbierta(() => null)} title="Cerrar" style={{ float: 'right', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gr)', padding: 2 }}><Ic name="cerrar" size={13}/></button>
      {dentro}
      {onAnotar && <button type="button" className="atajo" onClick={onAnotar} style={{ marginTop: 8, paddingLeft: 0 }}>Anotar en la valoración →</button>}
    </div>}
  </>
}
const Pto = ({ c }: { c: number | string }) => <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: typeof c === 'number' ? hex(c) : c, verticalAlign: 'middle', margin: '0 3px 0 8px' }}/>

export default function ProgramaPaciente({ pacienteId, alerta, lateral, ampliado }: { pacienteId: string, alerta: boolean
  /** Columna de la izquierda (alertas, nota, anamnesis apiladas). */
  lateral?: React.ReactNode
  /** Lo que se abre de esa columna: se pinta en el blanco entre ella y la nebulosa. */
  ampliado?: React.ReactNode }) {
  const [citas, setCitas] = useState<any[] | null>(null)
  const [molestias, setMolestias] = useState<any[]>([])
  const [nomObj, setNomObj] = useState<Record<string, string>>({})
  const [modo, setModo] = useState<'entreno' | 'salud'>('entreno')
  const [vSalud, setVSalud] = useState<VistaSalud>('dolor')
  const [vEntreno, setVEntreno] = useState<LenteEntreno>('ahora')
  const [vistaN, setVistaN] = useState<VistaNeb>('normal')
  const [desde, setDesde] = useState(''), [hasta, setHasta] = useState(''), [atajo, setAtajo] = useState<string | null>('3m')
  const [grande, setGrande] = useState(false)
  /* SU DÍA A DÍA, a la izquierda del muñeco como solapas (igual que alertas, nota y
     anamnesis en la nebulosa): deportes, plantillas, cómo se encuentra y estrés. */
  const [ctx, setCtx] = useState<{ deportes: string[], plant: { usa: boolean, izq: string, der: string }, escalas: { fecha: string, borg: number, estres: number }[] } | null>(null)
  const [abiertaCtx, setAbiertaCtx] = useState<string | null>(null)
  const router = useRouter()
  const puedeSalud = usePuede()('editar_salud')
  useEffect(() => {
    ;(async () => {
      const [{ data: dep }, { data: pac }, { data: esc }] = await Promise.all([
        supabase.from('deportes_paciente').select('nombre').eq('paciente_id', pacienteId),
        supabase.from('pacientes').select('usa_plantillas,plantilla_izq,plantilla_der').eq('id', pacienteId).single(),
        supabase.from('escalas').select('fecha,borg,estres').eq('paciente_id', pacienteId).order('fecha', { ascending: false }).limit(10),
      ])
      setCtx({ deportes: (dep || []).map((d: any) => d.nombre), plant: { usa: !!pac?.usa_plantillas, izq: pac?.plantilla_izq || '', der: pac?.plantilla_der || '' }, escalas: esc || [] })
    })()
  }, [pacienteId])
  useEffect(() => { try {
    const vs = localStorage.getItem('ficha_salud') as VistaSalud; if (VISTAS_SALUD.some(x => x.k === vs)) setVSalud(vs)
    // Entreno y su vista no se recuerdan: la ficha abre siempre en «Ahora», que es lo primero que hay que ver.
    const n = localStorage.getItem('ficha_nebulosa') as VistaNeb; if (VISTAS_NEB.some(x => x.k === n)) setVistaN(n)
  } catch {} }, [])
  const guarda = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }
  const iS = Math.max(0, VISTAS_SALUD.findIndex(x => x.k === vSalud)), iE = Math.max(0, VISTAS_ENTRENO.findIndex(x => x.k === vEntreno))
  const tocaSalud = () => {
    if (modo !== 'salud') { setModo('salud'); guarda('ficha_cuerpo_modo', 'salud'); return }
    const n = VISTAS_SALUD[(iS + 1) % VISTAS_SALUD.length].k; setVSalud(n); guarda('ficha_salud', n)
  }
  const tocaEntreno = () => {
    if (modo !== 'entreno') { setModo('entreno'); guarda('ficha_cuerpo_modo', 'entreno'); return }
    const n = VISTAS_ENTRENO[(iE + 1) % VISTAS_ENTRENO.length].k; setVEntreno(n); guarda('ficha_entreno', n)
  }
  const iN = Math.max(0, VISTAS_NEB.findIndex(x => x.k === vistaN))
  const siguienteN = () => { const n = VISTAS_NEB[(iN + 1) % VISTAS_NEB.length].k; setVistaN(n); try { localStorage.setItem('ficha_nebulosa', n) } catch {} }
  // En grande, Escape la cierra.
  useEffect(() => { if (!grande) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setGrande(false) }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [grande])

  useEffect(() => {
    const hoy = hoyISO()
    ;(async () => {
      const [{ data }, { data: rec }, { data: cc }, { data: cs }] = await Promise.all([
        // Todas sus citas: la barra de fechas llega desde que empezó.
        supabase.from('citas').select('id,fecha,hora,estado,sesion_id,sesiones:sesion_id(nombre,partes,sesiones_objetivos(objetivo_id))')
          .eq('paciente_id', pacienteId).in('estado', ['realizada', 'falta', 'cancelada', 'programada'])
          .order('fecha').order('hora'),
        // Las que son RECUPERACIÓN (clase de más): ensanchan la niebla.
        supabase.from('recuperaciones').select('cita_recuperacion_id').eq('paciente_id', pacienteId).not('cita_recuperacion_id', 'is', null),
        // Cambios de día u hora, y cambios de sesión: el historial que ya se guarda.
        supabase.from('cambios_cita').select('cita_id').eq('paciente_id', pacienteId),
        supabase.from('cambios_sesion').select('cita_id').eq('paciente_id', pacienteId),
      ])
      // Molestias con el día en que se quitaron. Si aún no existe esa columna (falta el
      // SQL), se piden sin ella y las ya quitadas solo marcan el día en que empezaron.
      let mol: any = await supabase.from('molestias').select('zona,eva,activa,created_at,resuelta_el').eq('paciente_id', pacienteId)
      if (mol.error) mol = await supabase.from('molestias').select('zona,eva,activa,created_at').eq('paciente_id', pacienteId)
      setMolestias(mol.data || [])
      const extra = new Set((rec || []).map((r: any) => r.cita_recuperacion_id))
      const movidas = new Set((cc || []).map((r: any) => r.cita_id)), cambSes = new Set((cs || []).map((r: any) => r.cita_id))
      const lista = (data || []).filter((c: any) => c.estado !== 'programada' || c.fecha >= hoy)
        .map((c: any) => ({ ...c, extra: extra.has(c.id), movida: movidas.has(c.id), cambioSesion: cambSes.has(c.id) }))
      setCitas(lista)
      // Los nombres de los objetivos que trabajan sus sesiones.
      const ids = Array.from(new Set(lista.flatMap((c: any) => ((Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones)?.sesiones_objetivos || []).map((o: any) => o.objetivo_id))))
      if (ids.length) {
        const { data: ob } = await supabase.from('objetivos').select('id,nombre').in('id', ids)
        setNomObj(Object.fromEntries((ob || []).map((o: any) => [o.id, o.nombre])))
      }
      // Lo que se ve al abrir: los últimos 3 meses y un mes de lo que viene.
      if (lista.length) { const a = lista[0].fecha, z = lista[lista.length - 1].fecha
        setDesde(sumarDias(hoy, -91) < a ? a : sumarDias(hoy, -91)); setHasta(sumarDias(hoy, 30) > z ? z : sumarDias(hoy, 30)) }
    })()
  }, [pacienteId])

  const hoy = hoyISO()
  const T0 = citas?.[0]?.fecha || hoy, T1 = citas?.[citas.length - 1]?.fecha || hoy
  const total = Math.max(1, dias(T0, T1))
  const ponAtajo = (k: string, d: number) => {
    setAtajo(k)
    if (!d) { setDesde(T0); setHasta(T1); return }
    const a = sumarDias(hoy, -d), z = sumarDias(hoy, Math.max(7, Math.round(d / 3)))
    setDesde(a < T0 ? T0 : a); setHasta(z > T1 ? T1 : z)
  }

  // TODO lo que dibuja la nebulosa, para las citas entre las dos fechas.
  const datos = useMemo(() => {
    const vis = (citas || []).filter(c => c.fecha >= desde && c.fecha <= hasta)
    const ses = (c: any) => Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones
    // GROSOR del haz: el tiempo de trabajo (lo que suman sus ejercicios); ALTURA: la intensidad.
    const v = suavizar(vis.map(c => volumen(ses(c)?.partes) || 1))
    const t = suavizar(vis.map(c => intensidad(ses(c)?.partes)).map(x => x * x))
    const vMax = Math.max(1e-6, ...v)
    /* LA NIEBLA: más estrecha si faltó o canceló, más ancha si vino de más (recuperación
       o una clase más esa semana de las que suele venir). Sutil: 80% y 112%. */
    const porSemana: Record<string, number> = {}
    const semana = (f: string) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10) }
    vis.filter(c => c.estado !== 'cancelada').forEach(c => { const k = semana(c.fecha); porSemana[k] = (porSemana[k] || 0) + 1 })
    const cuentas = Object.values(porSemana).sort((a, b) => a - b)
    const habitual = cuentas.length ? cuentas[Math.floor(cuentas.length / 2)] : 0
    const vistas: Record<string, number> = {}
    const bruta = vis.map(c => {
      if (c.estado === 'falta' || c.estado === 'cancelada') return 0.8
      const k = semana(c.fecha); vistas[k] = (vistas[k] || 0) + 1
      return c.extra || (habitual && vistas[k] > habitual) ? 1.12 : 1
    })
    const escala = bruta.map((x, i) => 0.25 * (bruta[i - 1] ?? x) + 0.5 * x + 0.25 * (bruta[i + 1] ?? x))
    // SESIONES: una letra por sesión distinta, en el orden en que aparecen en este tramo.
    const letra: Record<string, string> = {}, nomSes: Record<string, string> = {}, colSes: Record<string, number> = {}
    vis.forEach(c => { if (!c.sesion_id || letra[c.sesion_id]) return
      const n = Object.keys(letra).length, l = n < 26 ? String.fromCharCode(65 + n) : String(n + 1)
      letra[c.sesion_id] = l; nomSes[l] = ses(c)?.nombre || 'Sesión'; colSes[l] = PALETA[n % PALETA.length] })
    // OBJETIVOS: los de su sesión; colores por el que más se trabaja.
    const objsDe = (c: any) => (ses(c)?.sesiones_objetivos || []).map((o: any) => o.objetivo_id as string)
    const cuentaObj: Record<string, number> = {}
    vis.filter(c => c.estado === 'realizada').forEach(c => objsDe(c).forEach((o: string) => { cuentaObj[o] = (cuentaObj[o] || 0) + 1 }))
    vis.forEach(c => objsDe(c).forEach((o: string) => { cuentaObj[o] = cuentaObj[o] || 0 }))
    const colObj: Record<string, number> = {}
    Object.entries(cuentaObj).sort((a, b) => b[1] - a[1]).forEach(([o], k) => { colObj[o] = PALETA[k % PALETA.length] })
    // MOLESTIAS: rojo mientras dura (más cuanto más EVA); al quitarse, la huella.
    const mols = molestias.map(m => ({ ...m, ini: (m.created_at || '').slice(0, 10), fin: m.activa ? null : (m.resuelta_el || (m.created_at || '').slice(0, 10)), eva: m.eva ?? 5 }))
    const rojo = vis.map(c => { let r = 0
      for (const m of mols) {
        if (!m.ini || c.fecha < m.ini) continue
        if (m.fin == null || c.fecha <= m.fin) r = Math.max(r, 0.4 + 0.6 * m.eva / 10)
        else { const dura = Math.max(1, m.eva) * HUELLA_DIAS_POR_EVA, pasa = dias(m.fin, c.fecha); if (pasa < dura) r = Math.max(r, 0.35 * (1 - pasa / dura)) }
      }
      return r })
    const neb: CitaNeb[] = vis.map((c, i) => ({ t: ms(c.fecha), alto: t[i], grueso: v[i] / vMax, escala: escala[i], estado: c.estado,
      movida: c.movida, cambioSesion: c.cambioSesion, ses: letra[c.sesion_id] || '', objs: objsDe(c), rojo: rojo[i] }))
    return { vis, neb, nomSes, colSes, colObj, cuentaObj, mols, iHoy: vis.findIndex(c => c.fecha >= hoy) }
  }, [citas, molestias, desde, hasta]) // eslint-disable-line react-hooks/exhaustive-deps

  const { vis, neb } = datos
  const n = vis.length
  const cuenta = (f: (c: any) => boolean) => vis.filter(f).length

  // Lo que explica cada vista, debajo.
  /* LA LEYENDA, ORDENADA: una línea por cosa (punto, nombre y su número a la derecha) y
     la explicación aparte, pequeña, al final. Seguida en un párrafo no se leía. */
  const Fila = ({ c, t, n }: { c: number | string, t: React.ReactNode, n?: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '2px 0' }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: typeof c === 'number' ? hex(c) : c, transform: 'translateY(1px)' }}/>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--n)' }}>{t}</span>
      {n != null && <b style={{ fontWeight: 600, color: 'var(--n)' }}>{n}</b>}
    </div>
  )
  const Nota = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 6, lineHeight: 1.5 }}>{children}</div>
  const leyenda = (() => {
    if (vistaN === 'normal') return null
    const valida = (c: any) => c.estado !== 'falta' && c.estado !== 'cancelada'
    if (vistaN === 'cambios') return <>
      <Fila c={COL_CAMBIO.falta} t="Faltas" n={cuenta(c => c.estado === 'falta')}/>
      <Fila c={COL_CAMBIO.cancelada} t="Canceladas" n={cuenta(c => c.estado === 'cancelada')}/>
      <Fila c={COL_CAMBIO.movida} t="Cambiadas de día u hora" n={cuenta(c => c.movida && valida(c))}/>
      <Fila c={COL_CAMBIO.sesion} t="Con la sesión cambiada" n={cuenta(c => c.cambioSesion && !c.movida && valida(c))}/>
      <Nota>Cada una, un aro en su día.</Nota></>
    if (vistaN === 'sesiones') return <>
      {Object.entries(datos.nomSes).map(([l, nom]) => <Fila key={l} c={datos.colSes[l]} t={<><b style={{ fontWeight: 600 }}>{l}</b> · {nom}</>} n={cuenta(c => c.estado === 'realizada' && datos.neb[vis.indexOf(c)]?.ses === l)}/>)}
      <Nota>El número, las veces que la ha hecho. La letra encima de cada día dice cuál hizo (× si faltó); las que aún no ha hecho, más claras.{n > 60 ? ' Con tantas citas no caben las letras: acorta las fechas.' : ''}</Nota></>
    if (vistaN === 'objetivos') return Object.keys(datos.colObj).length
      ? <>{Object.keys(datos.colObj).map(o => <Fila key={o} c={datos.colObj[o]} t={nomObj[o] || 'Objetivo'} n={datos.cuentaObj[o]}/>)}
        <Nota>El número, las sesiones hechas que lo trabajan. Cuanto más se trabaja, más grande y más brilla su luz.</Nota></>
      : <Nota>Sus sesiones de estas fechas no tienen objetivos enganchados.</Nota>
    const ms2 = datos.mols.filter(m => m.ini && m.ini <= hasta)
    return ms2.length
      ? <>{ms2.map((m, k) => <Fila key={k} c={m.fin ? '#E3A6A6' : '#C0392B'} t={<>{m.zona} <span style={{ color: 'var(--grl)' }}>· EVA {m.eva}</span></>}
          n={m.fin ? <span style={{ fontWeight: 400, color: 'var(--grl)' }}>{m.resuelta_el ? 'ya pasó' : 'quitada'}</span> : <span style={{ color: '#C0392B' }}>activa</span>}/>)}
        <Nota>Rojo mientras duele, más fuerte cuanto más EVA. Al quitarse queda rosado y se va apagando: cuanto más fuerte fue, más tarda en irse.</Nota></>
      : <Nota>Sin molestias en estas fechas.</Nota>
  })()

  const semanas = Math.round(dias(desde || T0, hasta || T1) / 7)
  const mover = (cual: 'a' | 'z', val: number) => {
    const MIN = 7, f = sumarDias(T0, val)
    setAtajo(null)
    if (cual === 'a') setDesde(val > dias(T0, hasta) - MIN ? sumarDias(hasta, -MIN) : f)
    else setHasta(val < dias(T0, desde) + MIN ? sumarDias(desde, MIN) : f)
  }

  return (
    // Uno debajo del otro: lado a lado, la nebulosa se quedaba con un hueco blanco enorme
    // al lado del cuerpo, que es mucho más alto.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      <div className="sec" style={{ marginBottom: 0, ...(grande ? { position: 'fixed', inset: 16, zIndex: 60, overflow: 'auto', background: 'var(--wh, #fff)', borderRadius: 16, padding: 14, boxShadow: '0 10px 40px rgba(0,0,0,.18)' } : {}) }}>
       {/* La nebulosa ocupa TODO el ancho (la barra de lado a lado). Alertas, nota y
           anamnesis van encima, pegadas al borde izquierdo como solapas: si fueran una
           columna, empujaban la nebulosa y parecían dos cosas distintas. */}
       <div style={{ position: 'relative' }}>
        {!grande && lateral && <div style={{ position: 'absolute', left: -20, top: 0, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>{lateral}</div>}
        <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <BotonVistas t={VISTAS_NEB[iN].t} n={VISTAS_NEB.length} i={iN} onClick={siguienteN}/>
            {grande && <button type="button" className="btn-vista" onClick={() => setGrande(false)}>Cerrar ✕</button>}
        </div>
        <div style={{ height: grande ? 'calc(100vh - 290px)' : 250, minHeight: 250, display: 'flex' }}>
          {citas === null ? <div style={{ margin: 'auto', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>
            : n < 2 ? <div style={{ margin: 'auto', fontSize: 13, color: 'var(--grl)' }}>{(citas.length < 2 ? 'Aún no tiene citas para dibujarla.' : 'En estas fechas no hay citas suficientes: amplía la barra.')}</div>
            : <NebulosaPrograma citas={neb} vista={vistaN} colSes={datos.colSes} colObj={datos.colObj} hoy={datos.iHoy} alerta={alerta}
                fechaIni={fCorta(vis[0].fecha)} fechaFin={fCorta(vis[n - 1].fecha)} onToque={grande ? undefined : () => setGrande(true)}/>}
        </div>
        {citas && citas.length > 1 && <>
          {/* LA BARRA DOBLE: de qué fecha a qué fecha, desde que empezó hasta lo último programado. */}
          <div className="rango2">
            <div className="rango2-base"/>
            <div className="rango2-sel" style={{ left: `${dias(T0, desde) / total * 100}%`, width: `${dias(desde, hasta) / total * 100}%` }}/>
            {hoy >= T0 && hoy <= T1 && <div className="rango2-hoy" style={{ left: `${dias(T0, hoy) / total * 100}%` }}/>}
            <input type="range" min={0} max={total} value={dias(T0, desde)} onChange={e => mover('a', +e.target.value)} aria-label="Desde"/>
            <input type="range" min={0} max={total} value={dias(T0, hasta)} onChange={e => mover('z', +e.target.value)} aria-label="Hasta"/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontWeight: 500, margin: '2px 2px 0' }}>
            <span>{fLarga(desde)}</span><span style={{ color: 'var(--grl)', fontWeight: 400 }}>{semanas < 9 ? `${semanas} semanas` : `${Math.round(semanas / 4.3)} meses`}</span><span>{fLarga(hasta)}</span></div>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', margin: '6px 0 4px' }}>
            {ATAJOS.map(a => <button key={a.k} type="button" className={'atajo' + (atajo === a.k ? ' on' : '')} onClick={() => ponAtajo(a.k, a.d)}>{a.t}</button>)}
          </div>
        </>}
        {/* La leyenda, debajo del botón de vistas y flotando (con scroll si es larga): así
            no empuja nada al cambiar de vista. */}
        {!grande && leyenda && <div style={{ position: 'absolute', right: 0, top: 44, width: 'min(30%, 300px)', maxHeight: 230, overflow: 'auto', zIndex: 4,
          fontSize: 12, lineHeight: 1.4, background: 'rgba(255,255,255,.9)', padding: '4px 6px' }}>{leyenda}</div>}
        {grande && leyenda && <div style={{ fontSize: 11.5, color: 'var(--gr)', lineHeight: 1.6 }}>{leyenda}</div>}
        {/* Lo abierto de la columna izquierda, en el blanco al lado de la nebulosa. */}
        {/* Lo abierto, tal cual en el blanco: solo texto, sin caja ni bordes. */}
        {!grande && ampliado && <div style={{ position: 'absolute', left: 130, top: 0, width: 'min(40%, 440px)', maxHeight: 320, overflow: 'auto', overscrollBehavior: 'contain', zIndex: 5,
          background: 'rgba(255,255,255,.92)', padding: '2px 6px' }}>{ampliado}</div>}
        </div>
       </div>
      </div>
      <div style={{ marginBottom: 0 }}>
        {/* Sin título: los dos botones bastan. Salud a la izquierda, entreno a la derecha. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <BotonVistas t={<><Ic name={VISTAS_SALUD[iS].ic} size={14}/> {VISTAS_SALUD[iS].t}</>} n={VISTAS_SALUD.length} i={iS} onClick={tocaSalud} apagado={modo !== 'salud'}/>
          <BotonVistas t={<><Ic name="entreno" size={14}/> {VISTAS_ENTRENO[iE].t}</>} n={VISTAS_ENTRENO.length} i={iE} onClick={tocaEntreno} apagado={modo !== 'entreno'}/></div>
        <div style={{ position: 'relative' }}>
          {ctx && <SolapasDia ctx={ctx} abierta={abiertaCtx} setAbierta={setAbiertaCtx} onAnotar={puedeSalud ? () => router.push(`/valoracion?paciente=${pacienteId}&paso=Anamnesis`) : undefined}/>}
          {modo === 'entreno' ? <MapaTrabajo pacienteId={pacienteId} programado lente={vEntreno}/> : <CuerpoSalud pacienteId={pacienteId} vista={vSalud}/>}
        </div>
      </div>
    </div>
  )
}
