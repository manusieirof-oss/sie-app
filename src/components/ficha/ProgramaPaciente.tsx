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
  const v = (citas || []).map(c => { const s = Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones; return volumen(s?.partes) || 1 })
  // Grosor: 1 normal; 0 donde faltó (el haz se estrecha).
  const t = (citas || []).map(c => c.estado === 'falta' ? 0 : 1)
  const faltas = (citas || []).filter(c => c.estado === 'falta').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16, marginBottom: 16 }}>
      <div className="sec" style={{ marginBottom: 0 }}>
        <div className="sec-h"><span className="ct-l"><Ic name="calendario" size={13}/> Su programación</span>
          <span className="sh-r" style={{ fontSize: 11.5, color: 'var(--grl)' }}>
            {alerta ? <span style={{ color: 'var(--red)' }}>con alerta · </span> : null}{faltas ? `${faltas} falta${faltas === 1 ? '' : 's'} en 8 semanas` : 'sin faltas en 8 semanas'}</span></div>
        <div style={{ height: 260, display: 'flex' }}>
          {citas === null ? <div style={{ margin: 'auto', fontSize: 12, color: 'var(--grl)' }}>Cargando…</div>
            : n < 2 ? <div style={{ margin: 'auto', fontSize: 13, color: 'var(--grl)' }}>Aún no tiene citas para dibujarla.</div>
            : <CuboAlcance conEstilo n={n} hoy={iHoy} marcas={[]} sombras={[]} linea={{ v, t }}
                fechaIni={fCorta(citas![0].fecha)} fechaFin={fCorta(citas![n - 1].fecha)} botones={null}
                colorHaz={alerta ? '#D99A9A' : '#5A969E'}/>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--grl)' }}>Gíralo con el dedo; doble toque para verlo grande. Más alto, más trabajo; más fino, faltó.</div>
      </div>
      <div className="sec" style={{ marginBottom: 0 }}>
        <div className="sec-h"><span className="ct-l"><Ic name="cuerpo" size={13}/> Lo que tiene para entrenar</span></div>
        <MapaTrabajo pacienteId={pacienteId} programado/>
      </div>
    </div>
  )
}
