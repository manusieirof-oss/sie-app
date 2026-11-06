'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hoyISO, sumarDias } from '@/lib/fechas'
import CuboAlcance from '@/components/calor/CuboAlcance'
import MapaTrabajo from '@/components/MapaTrabajo'
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

export default function ProgramaPaciente({ pacienteId, alerta }: { pacienteId: string, alerta: boolean }) {
  const [citas, setCitas] = useState<any[] | null>(null)
  useEffect(() => {
    const hoy = hoyISO()
    supabase.from('citas').select('id,fecha,hora,estado,sesiones:sesion_id(partes)')
      .eq('paciente_id', pacienteId).gte('fecha', sumarDias(hoy, -56)).in('estado', ['realizada', 'falta', 'programada'])
      .order('fecha').order('hora').then(({ data }) => setCitas((data || []).filter((c: any) => c.estado !== 'programada' || c.fecha >= hoy)))
  }, [pacienteId])

  const hoy = hoyISO()
  const n = citas?.length || 0
  const iHoy = Math.max(0, citas ? citas.findIndex(c => c.fecha >= hoy) : 0)
  const ses = (c: any) => Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones
  // ALTURA del haz: cuánto trabajo; GROSOR: la intensidad; el CUBO se estrecha donde faltó.
  const v = suavizar((citas || []).map(c => volumen(ses(c)?.partes) || 1))
  const t = suavizar((citas || []).map(c => intensidad(ses(c)?.partes)).map(x => x * x)).map(x => x)
  const estrecho = (citas || []).map(c => c.estado === 'falta')
  const faltas = (citas || []).filter(c => c.estado === 'falta').length

  return (
    // Uno debajo del otro: lado a lado, el cubo se quedaba con un hueco blanco enorme
    // al lado del cuerpo, que es mucho más alto.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      <div className="sec" style={{ marginBottom: 0 }}>
        <div className="sec-h"><span className="ct-l"><Ic name="calendario" size={13}/> Su programación</span>
          <span className="sh-r" style={{ fontSize: 11.5, color: 'var(--grl)' }}>
            {alerta ? <span style={{ color: 'var(--red)' }}>con alerta · </span> : null}{faltas ? `${faltas} falta${faltas === 1 ? '' : 's'} en 8 semanas` : 'sin faltas en 8 semanas'}</span></div>
        <div style={{ height: 210, display: 'flex' }}>
          {citas === null ? <div style={{ margin: 'auto', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>
            : n < 2 ? <div style={{ margin: 'auto', fontSize: 13, color: 'var(--grl)' }}>Aún no tiene citas para dibujarla.</div>
            : <CuboAlcance conEstilo n={n} hoy={iHoy} marcas={[]} sombras={[]} linea={{ v, t }}
                fechaIni={fCorta(citas![0].fecha)} fechaFin={fCorta(citas![n - 1].fecha)} botones={null}
                colorHaz={alerta ? '#D99A9A' : '#5A969E'} estrecho={estrecho}/>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--grl)' }}>Gíralo con el dedo; doble toque para verlo grande. Más alto, más trabajo; más grueso, más intenso; el cubo se estrecha donde faltó.</div>
      </div>
      <div className="sec" style={{ marginBottom: 0 }}>
        <div className="sec-h"><span className="ct-l"><Ic name="cuerpo" size={13}/> Lo que tiene para entrenar</span></div>
        <MapaTrabajo pacienteId={pacienteId} programado/>
      </div>
    </div>
  )
}
