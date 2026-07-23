'use client'
import PanelSesion from './PanelSesion'
import PanelDatos from './PanelDatos'
import { Ic } from '@/lib/icons'

export default function PanelLateral({ panelPac, panelTab, setPanelTab, sesionDetalle, sesionesPaciente, loadingSesion, mostrarSesiones, setMostrarSesiones, anotaciones, setAnotaciones, pesos, setPesos, guardandoAnot, editandoCita, setEditandoCita, guardando, guardarAnotacion, asignarSesion, guardarEdicionCita, cambiarEstado, onCerrar, horas }: any) {
  return (
    <>
      <div onClick={onCerrar} style={{position:'fixed',inset:0,background:'rgba(38,40,37,.12)',zIndex:98}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:'fixed',top:0,right:0,width:320,height:'100vh',background:'var(--w)',borderLeft:'1px solid var(--bd)',zIndex:99,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(38,40,37,.08)'}}>

        {/* CABECERA */}
        <div style={{padding:'10px 13px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'var(--gl)',border:'1.5px solid var(--gm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:500,color:'var(--gd)',flexShrink:0}}>
            {(panelPac.pacientes?.nombre?.[0]||'?')+(panelPac.pacientes?.apellidos?.[0]||'')}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{panelPac.pacientes?.nombre} {panelPac.pacientes?.apellidos}</div>
            <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{panelPac.hora?.slice(0,5)} · Sala {panelPac.sala} · {panelPac.fecha}</div>
          </div>
          <button onClick={onCerrar} style={{width:22,height:22,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--gr)'}}>✕</button>
        </div>

        {/* TABS */}
        <div style={{display:'flex',borderBottom:'1px solid var(--bd)'}}>
          {[['sesion','valoracion','Sesión'],['datos','usuario','Datos']].map(([k,ic,l])=>(
            <button key={k} onClick={()=>{setPanelTab(k);setMostrarSesiones(false)}}
              style={{flex:1,fontSize:11,padding:'8px',textAlign:'center',cursor:'pointer',color:panelTab===k?'var(--g)':'var(--grl)',background:'none',border:'none',borderBottom:panelTab===k?'2px solid var(--g)':'2px solid transparent',fontFamily:'system-ui',fontWeight:panelTab===k?500:400,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><Ic name={ic} size={13}/> {l}</button>
          ))}
        </div>

        {/* CONTENIDO */}
        <div style={{flex:1,overflowY:'auto'}}>
          {panelTab==='sesion' && (
            <PanelSesion
              panelPac={panelPac}
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
          )}
          {panelTab==='datos' && (
            <PanelDatos
              panelPac={panelPac}
              editandoCita={editandoCita}
              setEditandoCita={setEditandoCita}
              guardando={guardando}
              guardarEdicionCita={guardarEdicionCita}
              cambiarEstado={cambiarEstado}
              horas={horas}
            />
          )}
        </div>

        {/* PIE */}
        <div style={{padding:'9px 11px',borderTop:'1px solid var(--bd)',display:'flex',gap:6}}>
          <a href={`/pacientes/${panelPac.paciente_id}`} className="btn btn-p" style={{flex:1,justifyContent:'center',textDecoration:'none',fontSize:10}}>Ver ficha ↗</a>
          <button className="btn btn-s" onClick={onCerrar} style={{fontSize:10}}>Cerrar</button>
        </div>
      </div>
    </>
  )
}
