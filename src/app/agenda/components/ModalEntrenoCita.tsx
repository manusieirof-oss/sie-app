'use client'
import PanelSesion from './PanelSesion'

export default function ModalEntrenoCita({ verEntrenoCita, sesionDetalle, sesionesPaciente, loadingSesion, mostrarSesiones, setMostrarSesiones, anotaciones, setAnotaciones, pesos, setPesos, guardandoAnot, guardarAnotacion, asignarSesion, onCerrar }: any) {
  if (!verEntrenoCita) return null
  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{width:420,maxHeight:'85vh',overflowY:'auto'}}>
        <div className="modal-title">
          Entrenamiento · {verEntrenoCita.pacientes?.nombre} {verEntrenoCita.pacientes?.apellidos}
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>
        <PanelSesion
          panelPac={verEntrenoCita}
          sesionDetalle={sesionDetalle}
          sesionesPaciente={sesionesPaciente}
          loadingSesion={loadingSesion}
          mostrarSesiones={mostrarSesiones}
          setMostrarSesiones={setMostrarSesiones}
          anotaciones={anotaciones}
          setAnotaciones={setAnotaciones}
          pesos={pesos}
          setPesos={setPesos}
          guardandoAnot={guardandoAnot}
          guardarAnotacion={guardarAnotacion}
          asignarSesion={asignarSesion}
        />
      </div>
    </div>
  )
}
