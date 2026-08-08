'use client'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import { rutaDeAsignacion } from '@/lib/asignarCita'

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
      {(sesionDetalle.partes||[]).map((parte:any,pi:number)=>(
        <div key={pi} style={{marginBottom:10}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6,paddingBottom:4,borderBottom:'1px solid var(--bm)'}}>{parte.nombre}</div>
          {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
            <div key={ei} style={{marginBottom:8,background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:7,padding:'7px 9px'}}>
                {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:40,height:40,objectFit:'cover',borderRadius:5,flexShrink:0}}/>:<div style={{width:40,height:40,background:'var(--bm)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)',flexShrink:0}}><Ic name="fuerza" size={18}/></div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>{ej.nombre}</div>
                  <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                    {ej.variante&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                    {ej.capacidad&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                  </div>
                </div>
                {ej.video_url&&<a href={ej.video_url} target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',color:'var(--g)',flexShrink:0}}><Ic name="play" size={15}/></a>}
              </div>
              <div style={{padding:'5px 9px 7px',borderTop:'1px solid var(--bm)'}}>
                <div style={{display:'flex',gap:5,alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:9,color:'var(--grl)',width:42,flexShrink:0}}>Series</span>
                  <div style={{fontSize:11,padding:'2px 7px',background:'var(--w)',borderRadius:4,border:'1px solid var(--bd)',minWidth:32,textAlign:'center'}}>{ej.series||'—'}</div>
                  <span style={{fontSize:9,color:'var(--grl)',marginLeft:4,width:32,flexShrink:0}}>Reps</span>
                  <div style={{fontSize:11,padding:'2px 7px',background:'var(--w)',borderRadius:4,border:'1px solid var(--bd)',minWidth:32,textAlign:'center'}}>{ej.reps||'—'}</div>
                  <span style={{fontSize:9,color:'var(--grl)',marginLeft:4,width:24,flexShrink:0}}>Kg</span>
                  <input type="number" value={pesos[ej.ejercicio_id]||ej.peso||''} onChange={e=>setPesos((p:any)=>({...p,[ej.ejercicio_id]:e.target.value}))}
                    onBlur={()=>guardarAnotacion(ej.ejercicio_id)}
                    style={{width:48,fontSize:11,padding:'2px 5px',border:'1px solid var(--g)',borderRadius:4,background:'var(--gl)',color:'var(--gd)',textAlign:'center',fontFamily:'system-ui'}}
                    placeholder={ej.peso||'0'}/>
                </div>
                {ej.tiempo&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:5,display:'flex',alignItems:'center',gap:3}}><Ic name="reloj" size={10}/> {ej.tiempo} seg</div>}
                <textarea value={anotaciones[ej.ejercicio_id]||''} onChange={e=>setAnotaciones((p:any)=>({...p,[ej.ejercicio_id]:e.target.value}))}
                  onBlur={()=>guardarAnotacion(ej.ejercicio_id)}
                  style={{width:'100%',fontSize:10,padding:'5px 7px',border:'1px solid var(--bd)',borderRadius:4,background:'var(--w)',color:'var(--n)',resize:'none',height:44,fontFamily:'system-ui',lineHeight:1.4}}
                  placeholder="Anotación..."/>
                {guardandoAnot===ej.ejercicio_id&&<div style={{fontSize:8,color:'var(--g)',marginTop:2}}>Guardando...</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
