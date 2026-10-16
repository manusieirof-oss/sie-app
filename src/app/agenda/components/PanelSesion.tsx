'use client'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import { rutaDeAsignacion } from '@/lib/asignarCita'
import TarjetasSesion from './TarjetasSesion'

export default function PanelSesion({ panelPac, sesionDetalle, sesionesPaciente, loadingSesion, mostrarSesiones, setMostrarSesiones, anotaciones, setAnotaciones, pesos, setPesos, guardandoAnot, guardarAnotacion, asignarSesion }: any) {
  const router = useRouter()

  /**
   * Ir a buscar una sesión fuera. Mismo camino que desde el taller.
   *
   * Antes, si el paciente no tenía ninguna, aquí solo había un enlace a "crear sesión": la
   * biblioteca entera quedaba fuera de alcance desde la agenda, que es donde más se mira.
   * Y crear se ha quitado a propósito — se crea en la ficha del paciente y en la
   * biblioteca, no en tres sitios.
   */
  const buscarFuera = (destino: 'ficha' | 'biblioteca') => {
    const p = panelPac?.pacientes || {}
    router.push(rutaDeAsignacion(destino, {
      pacienteId: panelPac?.paciente_id,
      citaId: panelPac?.id,
      etiqueta: (p.nombre_clinica || `${p.nombre || ''} ${p.apellidos || ''}`).trim()
        + (panelPac?.hora ? ' · ' + String(panelPac.hora).slice(0, 5) : ''),
      volver: '/agenda',
    }))
  }

  const BotonesFuera = () => (
    <div style={{display:'flex',gap:6,marginTop:8}}>
      <button className="btn btn-s btn-sm" style={{flex:1,justifyContent:'center'}} onClick={()=>buscarFuera('ficha')}>Sus sesiones</button>
      <button className="btn btn-s btn-sm" style={{flex:1,justifyContent:'center'}} onClick={()=>buscarFuera('biblioteca')}>Biblioteca</button>
    </div>
  )

  if (loadingSesion) return <div className="loading">Cargando...</div>

  if (mostrarSesiones) return (
    <div style={{padding:11}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Seleccionar sesión</div>
        <button className="btn btn-s btn-sm" onClick={()=>setMostrarSesiones(false)}>← Volver</button>
      </div>
      {sesionesPaciente.length===0?(
        <div style={{textAlign:'center',padding:'10px 0',color:'var(--grl)',fontSize:10}}>
          Este paciente no tiene sesiones propias.
        </div>
      ):sesionesPaciente.map((s:any)=>(
        <button key={s.id} onClick={()=>asignarSesion(s.id)}
          style={{width:'100%',textAlign:'left',padding:'10px 12px',background:sesionDetalle?.id===s.id?'var(--gl)':'var(--bl)',borderRadius:7,border:`1.5px solid ${sesionDetalle?.id===s.id?'var(--g)':'var(--bd)'}`,marginBottom:6,cursor:'pointer',fontFamily:'system-ui',display:'block'}}>
          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>{s.nombre}</div>
          {s.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>{s.descripcion}</div>}
          <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{(s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)} ejercicios</div>
          {sesionDetalle?.id===s.id&&<div style={{fontSize:9,color:'var(--g)',fontWeight:600,marginTop:3}}>✓ Asignada</div>}
        </button>
      ))}
      <BotonesFuera/>
    </div>
  )

  if (!sesionDetalle) return (
    <div style={{padding:'30px 11px 11px'}}>
      <div style={{textAlign:'center',marginBottom:16}}>
        <div style={{marginBottom:8,color:'var(--grl)'}}><Ic name="valoracion" size={28} strokeWidth={1.5}/></div>
        <div style={{fontSize:11,color:'var(--grl)',fontWeight:300,marginBottom:14}}>Sin sesión asignada</div>
        <button className="btn btn-p" style={{width:'100%',justifyContent:'center'}} onClick={()=>setMostrarSesiones(true)}>Asignar sesión</button>
      </div>
    </div>
  )

  return (
    <div style={{padding:11}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{sesionDetalle.nombre}</div>
          {sesionDetalle.descripcion&&<div style={{fontSize:9,color:'var(--grl)',fontWeight:300,marginTop:1}}>{sesionDetalle.descripcion}</div>}
        </div>
        <button className="btn btn-t btn-sm" onClick={()=>setMostrarSesiones(true)}>Cambiar</button>
      </div>
      {/* Los ejercicios en tarjetas de imagen: ver TarjetasSesion. */}
      <TarjetasSesion partes={sesionDetalle.partes} pesos={pesos} setPesos={setPesos} anotaciones={anotaciones}
        setAnotaciones={setAnotaciones} guardarAnotacion={guardarAnotacion} guardandoAnot={guardandoAnot}/>
    </div>
  )
}
