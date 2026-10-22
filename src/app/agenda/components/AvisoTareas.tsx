'use client'
import { useRef, useState } from 'react'
import Flotante from '@/app/taller/Flotante'

// ---------------------------------------------------------------------------
// TAREAS CON FECHA, A LA VISTA. El panel de tareas pasaba desapercibido: si no se
// abria, nadie se enteraba. Ahora una tarea con fecha pone una exclamacion roja en
// ese dia (dia, semana y mes) y avisa al dar citas para ese dia. Al pulsar se ve
// que hay que hacer y se puede dar por hecha alli mismo.
// Hoy cuenta tambien lo que se quedo sin hacer de dias anteriores.
// ---------------------------------------------------------------------------

/** Las pendientes de ese dia (y, si es hoy, las vencidas). */
export function tareasDelDia(tareas: any[], f: string, hoy: string) {
  return (tareas || []).filter(t => {
    if (t.completada || !t.fecha_limite) return false
    const d = String(t.fecha_limite).slice(0, 10)
    return d === f || (f === hoy && d < hoy)
  })
}

function Lista({ lista, hoy, perfiles, completarTarea }: any) {
  const nombre = (uid: string) => (perfiles || []).find((p: any) => p.user_id === uid)?.nombre
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lista.map((t: any) => {
        const d = String(t.fecha_limite).slice(0, 10)
        return (
          <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {completarTarea && <span onClick={e => { e.stopPropagation(); completarTarea(t.id, true) }} title="Marcar hecha"
              style={{ width: 16, height: 16, borderRadius: 4, border: '2px solid var(--bm)', cursor: 'pointer', flexShrink: 0, marginTop: 1, background: 'var(--w)' }}/>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--n)', lineHeight: 1.35 }}>{t.titulo}</div>
              <div style={{ fontSize: 10.5, color: 'var(--grl)' }}>
                {t.asignado_a ? (nombre(t.asignado_a) || '—') : 'Para todos'}
                {d < hoy && <b style={{ color: '#C0504D', marginLeft: 6 }}>vencida {new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</b>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** La exclamacion roja. Se pinta solo si ese dia hay algo. */
export default function AvisoTareas({ tareas, fecha, hoy, perfiles, completarTarea, tam = 16 }: {
  tareas: any[], fecha: string, hoy: string, perfiles?: any[], completarTarea?: (id: string, v: boolean) => void, tam?: number
}) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const lista = tareasDelDia(tareas, fecha, hoy)
  if (!lista.length) return null
  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => !v) }}
        title={`${lista.length} tarea${lista.length > 1 ? 's' : ''} para este día`}
        style={{ minWidth: tam, height: tam, borderRadius: 99, border: 0, background: '#C0504D', color: '#fff', fontWeight: 800,
          fontSize: tam * 0.68, lineHeight: 1, padding: lista.length > 1 ? '0 5px' : 0, cursor: 'pointer', fontFamily: 'inherit',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2, flexShrink: 0, boxShadow: '0 1px 4px rgba(192,80,77,.35)' }}>
        !{lista.length > 1 ? <span style={{ fontSize: tam * 0.55 }}>{lista.length}</span> : null}
      </button>
      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)} ancho={270}>
        <div onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#C0504D', letterSpacing: .5, textTransform: 'uppercase', marginBottom: 8 }}>
            Tareas · {new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <Lista lista={lista} hoy={hoy} perfiles={perfiles} completarTarea={completarTarea}/>
        </div>
      </Flotante>
    </>
  )
}

/** Aviso grande, para el formulario de nueva cita: al dar citas ese dia, se ve. */
export function BannerTareas({ tareas, fecha, hoy, perfiles }: { tareas: any[], fecha: string, hoy: string, perfiles?: any[] }) {
  const lista = tareasDelDia(tareas, fecha, hoy)
  if (!fecha || !lista.length) return null
  return (
    <div style={{ background: '#FBEAEA', border: '1px solid #E8B4B2', borderRadius: 10, padding: '9px 12px', margin: '0 0 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#C0504D', marginBottom: 6 }}>! Ese día hay {lista.length} tarea{lista.length > 1 ? 's' : ''}</div>
      <Lista lista={lista} hoy={hoy} perfiles={perfiles}/>
    </div>
  )
}
