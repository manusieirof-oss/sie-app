'use client'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import type { Encargo } from '@/lib/asignarCita'

/**
 * La franja que se ve cuando has llegado aquí desde el taller a asignar una sesión.
 *
 * Va arriba y ocupa: si no se nota, se te olvida a qué habías venido y acabas navegando
 * por la ficha sin asignar nada. Es el mismo criterio de siempre — el aviso va donde se
 * toma la decisión.
 */
export default function BarraAsignacion({ encargo }: { encargo: Encargo }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '9px 13px',
      borderRadius: 'var(--rl)', background: 'var(--gl)', border: '1px solid var(--g)', fontSize: 11, color: 'var(--gd)' }}>
      <Ic name="taller" size={14} />
      <span>
        {encargo.citaId
          ? <>Eligiendo la sesión de <b>{encargo.etiqueta || 'la cita'}</b>. Pulsa <b>Traer</b> en la que quieras y se le asigna a esa cita.</>
          : <>Eligiendo una sesión para <b>{encargo.etiqueta || 'el paciente'}</b>. Pulsa <b>Traer</b> y se le queda copiada.</>}
      </span>
      <div style={{ flex: 1 }} />
      <button className="btn btn-t btn-sm" onClick={() => router.push(encargo.volver)} style={{ fontSize: 10 }}>
        Volver sin traer
      </button>
    </div>
  )
}
