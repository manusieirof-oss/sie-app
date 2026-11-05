'use client'
import { Velo, BloqueAlertas } from '@/app/taller/GestionCita'

/**
 * ALERTAS DESDE LA AGENDA. Es el mismo bloque que el del taller (velo de la cita), con
 * el mismo aspecto: antes aquí era un desplegable y en el taller botones, y parecían
 * dos cosas distintas.
 */
export default function ModalAlertasCita({ verAlertasCita, onCambio, onCerrar }: {
  verAlertasCita: any, onCambio?: () => void, onCerrar: () => void
}) {
  if (!verAlertasCita) return null
  const p = verAlertasCita.pacientes
  const nombre = p ? `${p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`}`.trim() : 'Paciente'
  const hora = verAlertasCita.hora ? String(verAlertasCita.hora).slice(0, 5) : ''
  return (
    <Velo titulo={nombre} sub={hora ? `Cita de las ${hora}${verAlertasCita.sala ? ' · sala ' + verAlertasCita.sala : ''}` : undefined} onCerrar={onCerrar}>
      <BloqueAlertas pacienteId={verAlertasCita.paciente_id} onCambio={onCambio}/>
      <div className="gc-pie"><button className="btn btn-p btn-sm" onClick={onCerrar}>Listo</button></div>
    </Velo>
  )
}
