'use client'
import PanelSesion from './PanelSesion'

export default function ModalEntrenoCita({ verEntrenoCita, sesionDetalle, sesionesPaciente, loadingSesion, mostrarSesiones, setMostrarSesiones, anotaciones, setAnotaciones, pesos, setPesos, guardandoAnot, guardarAnotacion, asignarSesion, alertasPaciente=[], onCerrar }: any) {
  if (!verEntrenoCita) return null
  const alertasSesion = (alertasPaciente||[]).filter((a:any)=>a.paciente_id===verEntrenoCita.paciente_id && a.afecta_sesion)
  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{width:420,maxHeight:'85vh',overflowY:'auto'}}>
        <div className="modal-title">
          Entrenamiento · {verEntrenoCita.pacientes?.nombre} {verEntrenoCita.pacientes?.apellidos}
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>
        {alertasSesion.length>0&&(
          <div style={{background:'var(--redl)',border:'1px solid #F5C8C8',borderRadius:8,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--red)',letterSpacing:.5,textTransform:'uppercase',marginBottom:5,display:'flex',alignItems:'center',gap:5}}>⚠️ A tener en cuenta en la sesión</div>
            {alertasSesion.map((a:any)=>(
              <div key={a.id} style={{fontSize:10,color:'var(--n)',marginBottom:3}}>· {a.descripcion}<span style={{fontSize:8,color:'var(--grl)',marginLeft:5}}>({a.fecha_inicio})</span></div>
            ))}
          </div>
        )}
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
