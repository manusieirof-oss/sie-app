'use client'
import { useState, useEffect } from 'react'
import ModalEditarSesion from './ModalEditarSesion'
import { supabase } from '@/lib/supabase'

type EjercicioSesion = {
  ejercicio_id: string
  nombre: string
  variante: string
  capacidad: string
  series: string
  reps: string
  peso: string
  tiempo: string
  nota: string
  imagen_url?: string
}

type Parte = {
  nombre: string
  ejercicios: EjercicioSesion[]
}

const VARIANTES = ['Bilateral','Unilateral','Alterno','Unipodal','Supino','Prono','Decúbito lateral']
const CAPACIDADES = ['Fuerza','Fuerza máxima','Movilidad','Estiramiento','Resistencia','Propiocepción','Coordinación']

export default function SesionesTab({ sesiones, pacientes, ejercicios, etiquetas, objetivos, cargar, getNombre, pacienteIdInicial }: any) {
  const [buscarSes, setBuscarSes] = useState('')
  const [filtroObjetivos, setFiltroObjetivos] = useState<string[]>([])
  const [sesionVista, setSesionVista] = useState<any>(null)
  const [buscarBiblio, setBuscarBiblio] = useState('')
  const [filtroEtBiblio, setFiltroEtBiblio] = useState<string[]>([])
  const [sesionEditando, setSesionEditando] = useState<any>(null)

  useEffect(() => {
    if (pacienteIdInicial) {
      setSesionEditando({ paciente_id: pacienteIdInicial, nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })
    }
  }, [pacienteIdInicial])

  const ejerciciosFiltrados = ejercicios.filter((e:any) => {
    const matchQ = !buscarBiblio || e.nombre.toLowerCase().includes(buscarBiblio.toLowerCase())
    const matchEt = filtroEtBiblio.length===0 || filtroEtBiblio.every((fid:string)=>(e.etiquetas||[]).includes(fid))
    return matchQ && matchEt
  })

  function objsDeSesion(s:any) {
    const ids = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    return (objetivos||[]).filter((o:any)=>ids.includes(o.id))
  }
  const sesionesFiltradas = sesiones.filter((s:any)=>{
    const q = buscarSes.toLowerCase()
    const matchQ = !buscarSes || (s.nombre||'').toLowerCase().includes(q) || (s.descripcion||'').toLowerCase().includes(q)
    const idsObj = (s.sesiones_objetivos||[]).map((r:any)=>r.objetivo_id)
    const matchObj = filtroObjetivos.length===0 || filtroObjetivos.some(fid=>idsObj.includes(fid))
    return matchQ && matchObj
  })

  return (
    <>
      {/* CABECERA: buscador + nueva */}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
        <input className="input" placeholder="🔍 Buscar por nombre u objetivo..." value={buscarSes} onChange={e=>setBuscarSes(e.target.value)} style={{flex:1,minWidth:200}}/>
        <span style={{fontSize:10,color:'var(--grl)'}}>{sesionesFiltradas.length} sesiones</span>
        <button className="btn btn-p btn-sm" onClick={()=>setSesionEditando({ paciente_id: pacienteIdInicial||'', nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}] })}>+ Nueva sesión</button>
      </div>
      {(objetivos||[]).length>0&&(
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}>
          <span style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>🎯 Objetivo:</span>
          {(objetivos||[]).map((o:any)=>{
            const sel = filtroObjetivos.includes(o.id)
            return (
              <span key={o.id} onClick={()=>setFiltroObjetivos(prev=>prev.includes(o.id)?prev.filter(x=>x!==o.id):[...prev,o.id])}
                style={{fontSize:9,padding:'2px 9px',borderRadius:99,cursor:'pointer',border:`1.5px solid ${sel?(o.color||'var(--g)'):'var(--bd)'}`,background:sel?(o.color||'var(--g)'):'var(--w)',color:sel?'#fff':'var(--gr)'}}>
                {sel?'✓ ':''}{o.nombre}
              </span>
            )
          })}
          {filtroObjetivos.length>0&&<button className="btn btn-t btn-sm" onClick={()=>setFiltroObjetivos([])}>✕ Limpiar</button>}
        </div>
      )}

      {sesionesFiltradas.length===0?(
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
          {sesiones.length===0?'Sin sesiones. Crea la primera con + Nueva sesión.':'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
          {sesionesFiltradas.map((s:any)=>{
            const nEj = (s.partes||[]).reduce((acc:number,p:any)=>acc+(p.ejercicios||[]).length,0)
            const nPartes = (s.partes||[]).length
            return (
              <div key={s.id} onClick={()=>setSesionVista(s)} className="card" style={{cursor:'pointer',display:'flex',flexDirection:'column',gap:8,margin:0}}
                onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:3}}>{s.nombre}</div>
                  {s.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,lineHeight:1.4}}>{s.descripcion.slice(0,90)}{s.descripcion.length>90?'...':''}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:'auto'}}>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{nPartes} {nPartes===1?'parte':'partes'}</span>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{nEj} {nEj===1?'ejercicio':'ejercicios'}</span>
                </div>
                {objsDeSesion(s).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {objsDeSesion(s).map((o:any)=><span key={o.id} style={{fontSize:8,padding:'2px 7px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>🎯 {o.nombre}</span>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL VISTA SESIÓN (solo lectura) */}
      {sesionVista&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setSesionVista(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'92vw',maxWidth:760,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:400,color:'var(--n)'}}>{sesionVista.nombre}</div>
                {sesionVista.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,marginTop:2}}>{sesionVista.descripcion}</div>}
                {objsDeSesion(sesionVista).length>0&&(
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:5}}>
                    {objsDeSesion(sesionVista).map((o:any)=><span key={o.id} style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>🎯 {o.nombre}</span>)}
                  </div>
                )}
              </div>
              <button className="btn btn-s btn-sm" onClick={()=>{const s=sesionVista;setSesionVista(null);setSesionEditando(s)}}>✏️ Editar</button>
              <button onClick={()=>setSesionVista(null)} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              {(sesionVista.partes||[]).map((parte:any,pi:number)=>(
                <div key={pi} style={{marginBottom:10,background:'var(--bl)',borderRadius:6,overflow:'hidden',border:'1px solid var(--bd)'}}>
                  <div style={{padding:'6px 12px',borderBottom:'1px solid var(--bm)',fontSize:11,fontWeight:500,color:'var(--n)'}}>{parte.nombre}</div>
                  {(parte.ejercicios||[]).map((ej:any,ei:number)=>(
                    <div key={ei} style={{padding:'8px 12px',borderBottom:'1px solid var(--bl)',display:'flex',alignItems:'flex-start',gap:10}}>
                      {ej.imagen_url&&<img src={ej.imagen_url} alt={ej.nombre} style={{width:44,height:44,objectFit:'contain',background:'var(--bm)',borderRadius:4,flexShrink:0}}/>}
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{ej.nombre||ej}</div>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {ej.variante&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)'}}>{ej.variante}</span>}
                          {ej.capacidad&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--ambl)',color:'#7A5800'}}>{ej.capacidad}</span>}
                          {ej.series&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.series} series</span>}
                          {ej.reps&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.reps} reps</span>}
                          {ej.peso&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.peso} kg</span>}
                          {ej.tiempo&&<span style={{fontSize:9,padding:'1px 7px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{ej.tiempo} seg</span>}
                        </div>
                        {ej.nota&&<div style={{fontSize:9,color:'var(--amb)',marginTop:3,fontStyle:'italic'}}>📝 {ej.nota}</div>}
                      </div>
                    </div>
                  ))}
                  {(parte.ejercicios||[]).length===0&&<div style={{padding:'6px 12px',fontSize:9,color:'var(--grl)'}}>Sin ejercicios</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sesionEditando&&(
        <ModalEditarSesion
          sesion={sesionEditando}
          ejercicios={ejercicios}
          pacientes={pacientes}
          onGuardado={cargar}
          onCerrar={()=>setSesionEditando(null)}
        />
      )}

    </>
  )
}
