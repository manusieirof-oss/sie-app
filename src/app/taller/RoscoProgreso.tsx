'use client'
import { useEffect, useState } from 'react'
import { useConfigTrabajo } from '@/lib/usarTrabajo'
import { segundosPrevistosTaller, vecesHechas, minutos } from '@/lib/tiempoSesion'

// ---------------------------------------------------------------------------
// CUÁNTO DE SU SESIÓN SUELE HACER (cabecera del taller y editor de la sesión).
// El rosco es la media de lo que hace de verdad frente a lo previsto: si la sesión son
// 40 min de trabajo y de media hace 28, 70 %. Ver lib/tiempoSesion.
// ---------------------------------------------------------------------------

export function RoscoTiempo({ previsto, veces }: { previsto: number, veces: number[] | null }) {
  if (!previsto) return null
  const total = veces?.length || 0
  const media = total ? veces!.reduce((a, b) => a + b, 0) / total : 0
  const pct = total ? Math.min(100, Math.round(media / previsto * 100)) : 0
  const R = 22, C = 2 * Math.PI * R
  const color = pct >= 90 ? 'var(--g)' : pct >= 70 ? 'var(--amb)' : 'var(--red)'
  return (
    <div title={total ? `Sesión prevista: ${minutos(previsto)} min de trabajo. De media hace ${minutos(media)} min (${total} veces).` : 'Aún no se ha hecho esta sesión'}
      style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--bl)" strokeWidth="6"/>
        {total > 0 && <circle cx="28" cy="28" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${C * pct / 100} ${C}`} transform="rotate(-90 28 28)"/>}
        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--n)">{total ? `${pct}%` : '—'}</text>
      </svg>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--n)' }}>{minutos(previsto)} min de trabajo previstos</div>
        <div style={{ fontSize: 12, color: 'var(--gr)' }}>
          {veces === null ? '…' : total ? `hace ${minutos(media)} min de media · ${total} ${total === 1 ? 'vez' : 'veces'}` : 'aún no se ha hecho'}
        </div>
      </div>
    </div>
  )
}

/** En el taller: lo previsto con sus series de hoy y las veces que la hizo ESTA persona. */
export default function RoscoProgreso({ pacienteId, sesionId, datos, fecha, partes }: {
  pacienteId: string, sesionId: string, datos: any[], fecha: string, partes?: any[]
}) {
  const cfg = useConfigTrabajo()
  const [veces, setVeces] = useState<number[] | null>(null)
  useEffect(() => {
    let vivo = true
    vecesHechas(cfg, sesionId, partes || datos.map(e => ({ ejercicios: [{ ejercicio_id: e.ejercicio_id, descanso: e.plan?.descanso }] })), fecha, pacienteId)
      .then(v => { if (vivo) setVeces(v) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, sesionId, fecha, cfg])
  return <RoscoTiempo previsto={segundosPrevistosTaller(cfg, datos)} veces={veces}/>
}
