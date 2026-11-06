'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO, sumarDias } from '@/lib/fechas'
import NebulosaPrograma from '@/components/ficha/NebulosaPrograma'
import MapaTrabajo from '@/components/MapaTrabajo'
import CuerpoSalud, { type VistaSalud } from '@/components/ficha/CuerpoSalud'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// LA FICHA, DE UN VISTAZO: su programación y lo que tiene para entrenar.
//
//   · El CUBO del calor con su haz de luz: un punto por cita (las últimas 8 semanas y
//     lo que tiene por delante). La altura es cuánto trabajo lleva la sesión; donde
//     FALTÓ, el haz se estrecha. Si tiene alertas activas, el haz se tiñe de rojo
//     atenuado; si no, el color de la clínica.
//   · El CUERPO 3D con lo que tiene PROGRAMADO (MapaTrabajo en modo programado).
// ---------------------------------------------------------------------------

const fCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')

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

/* EL BOTÓN DE VISTAS DEL CUERPO, como en la biblioteca y la agenda: un toque, la
   siguiente. Se recuerda en este aparato. */
type VistaCuerpo = 'entrenar' | VistaSalud
const VISTAS: { k: VistaCuerpo, t: string, ic: string }[] = [
  { k: 'entrenar', t: 'Para entrenar', ic: 'entreno' }, { k: 'dolor', t: 'Dolor ahora', ic: 'molestia' },
  { k: 'operaciones', t: 'Operaciones', ic: 'cruz' }, { k: 'patologias', t: 'Patologías', ic: 'patologia' },
]

export default function ProgramaPaciente({ pacienteId, alerta }: { pacienteId: string, alerta: boolean }) {
  const [citas, setCitas] = useState<any[] | null>(null)
  const [vista, setVistaE] = useState<VistaCuerpo>('entrenar')
  useEffect(() => { try { const v = localStorage.getItem('ficha_cuerpo') as VistaCuerpo; if (VISTAS.some(x => x.k === v)) setVistaE(v) } catch {} }, [])
  const vistaAct = VISTAS.find(x => x.k === vista) || VISTAS[0]
  const siguiente = () => { const n = VISTAS[(VISTAS.indexOf(vistaAct) + 1) % VISTAS.length].k; setVistaE(n); try { localStorage.setItem('ficha_cuerpo', n) } catch {} }
  useEffect(() => {
    const hoy = hoyISO()
    ;(async () => {
      const [{ data }, { data: rec }] = await Promise.all([
        supabase.from('citas').select('id,fecha,hora,estado,sesiones:sesion_id(partes)')
          .eq('paciente_id', pacienteId).gte('fecha', sumarDias(hoy, -56)).in('estado', ['realizada', 'falta', 'cancelada', 'programada'])
          .order('fecha').order('hora'),
        // Las que son RECUPERACIÓN (clase de más): ensanchan el cubo.
        supabase.from('recuperaciones').select('cita_recuperacion_id').eq('paciente_id', pacienteId).not('cita_recuperacion_id', 'is', null),
      ])
      const extra = new Set((rec || []).map((r: any) => r.cita_recuperacion_id))
      setCitas((data || []).filter((c: any) => c.estado !== 'programada' || c.fecha >= hoy).map((c: any) => ({ ...c, extra: extra.has(c.id) })))
    })()
  }, [pacienteId])

  const hoy = hoyISO()
  const n = citas?.length || 0
  const iHoy = Math.max(0, citas ? citas.findIndex(c => c.fecha >= hoy) : 0)
  const ses = (c: any) => Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones
  // ALTURA del haz: cuánto trabajo; GROSOR: la intensidad; el CUBO se estrecha donde faltó.
  const v = suavizar((citas || []).map(c => volumen(ses(c)?.partes) || 1))
  const t = suavizar((citas || []).map(c => intensidad(ses(c)?.partes)).map(x => x * x)).map(x => x)
  /* EL CUBO: más estrecho si faltó o canceló, más ancho si vino de más (recuperación o
     una clase más esa semana de las que suele venir). */
  const porSemana: Record<string, number> = {}
  const semana = (f: string) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.toISOString().slice(0, 10) }
  ;(citas || []).filter(c => c.estado !== 'cancelada').forEach(c => { const k = semana(c.fecha); porSemana[k] = (porSemana[k] || 0) + 1 })
  const cuentas = Object.values(porSemana).sort((a, b) => a - b)
  const habitual = cuentas.length ? cuentas[Math.floor(cuentas.length / 2)] : 0
  const vistas: Record<string, number> = {}
  // Sutil: una falta lo deja al 80% y una de más al 112%, y se reparte con sus vecinas.
  const bruta = (citas || []).map(c => {
    if (c.estado === 'falta' || c.estado === 'cancelada') return 0.8
    const k = semana(c.fecha); vistas[k] = (vistas[k] || 0) + 1
    return c.extra || (habitual && vistas[k] > habitual) ? 1.12 : 1
  })
  const escala = bruta.map((x, i) => 0.25 * (bruta[i - 1] ?? x) + 0.5 * x + 0.25 * (bruta[i + 1] ?? x))
  // Las mismas listas mientras no cambien las citas: si no, la nebulosa se rehacía entera en cada pintado.
  const datos = useMemo(() => ({ v, t, escala }), [citas]) // eslint-disable-line react-hooks/exhaustive-deps
  const faltas = (citas || []).filter(c => c.estado === 'falta' || c.estado === 'cancelada').length

  return (
    // Uno debajo del otro: lado a lado, el cubo se quedaba con un hueco blanco enorme
    // al lado del cuerpo, que es mucho más alto.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      <div className="sec" style={{ marginBottom: 0 }}>
        <div className="sec-h"><span className="ct-l"><Ic name="calendario" size={13}/> Su programación</span>
          <span className="sh-r" style={{ fontSize: 11.5, color: 'var(--grl)' }}>
            {alerta ? <span style={{ color: 'var(--red)' }}>con alerta · </span> : null}{faltas ? `${faltas} falta${faltas === 1 ? '' : 's'} o cancelada${faltas === 1 ? '' : 's'} en 8 semanas` : 'sin faltas en 8 semanas'}</span></div>
        <div style={{ height: 250, display: 'flex' }}>
          {citas === null ? <div style={{ margin: 'auto', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>
            : n < 2 ? <div style={{ margin: 'auto', fontSize: 13, color: 'var(--grl)' }}>Aún no tiene citas para dibujarla.</div>
            : <NebulosaPrograma trabajo={datos.v} intens={datos.t} escala={datos.escala} hoy={iHoy} alerta={alerta}
                fechaIni={fCorta(citas![0].fecha)} fechaFin={fCorta(citas![n - 1].fecha)}/>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--grl)' }}>Gírala con el dedo. Más alto, más trabajo; más grueso, más intenso; la niebla se estrecha donde faltó o canceló y se abre si vino de más. El aro naranja es hoy.</div>
      </div>
      <div className="sec" style={{ marginBottom: 0 }}>
        <div className="sec-h"><span className="ct-l"><Ic name="cuerpo" size={13}/> Su cuerpo</span>
          <button type="button" className="chip-sel on" onClick={siguiente} title="Cambiar lo que enseña el cuerpo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0 }}>
            <Ic name={vistaAct.ic} size={13}/> {vistaAct.t}
            <span style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>{VISTAS.map(x => <i key={x.k} style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: x.k === vista ? 1 : .3 }}/>)}</span>
          </button></div>
        {vista === 'entrenar' ? <MapaTrabajo pacienteId={pacienteId} programado/> : <CuerpoSalud pacienteId={pacienteId} vista={vista}/>}
      </div>
    </div>
  )
}
