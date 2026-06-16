'use client'
import PanelDatos from './PanelDatos'

export default function ModalDatosCita({ verDatosCita, guardando, cambiarEstado, horas, onCerrar }: any) {
  if (!verDatosCita) return null
  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{width:380,maxHeight:'85vh',overflowY:'auto'}}>
        <div className="modal-title">
          {verDatosCita.pacientes?.nombre} {verDatosCita.pacientes?.apellidos}
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>
        <PanelDatos panelPac={verDatosCita} editandoCita={null} setEditandoCita={()=>{}} guardando={guardando} guardarEdicionCita={()=>{}} cambiarEstado={cambiarEstado} horas={horas}/>
      </div>
    </div>
  )
}
