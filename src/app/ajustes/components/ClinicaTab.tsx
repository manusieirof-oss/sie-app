'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'

export default function ClinicaTab({ ajustes, set }: any) {
  let salas: string[] = ['A','B']
  try { const s = ajustes.clinica_salas ? JSON.parse(ajustes.clinica_salas) : null; if (Array.isArray(s) && s.length) salas = s } catch {}
  const setSalas = (arr:string[]) => set('clinica_salas', JSON.stringify(arr))
  const [nuevaSala, setNuevaSala] = useState('')
  const anadirSala = () => {
    const n = nuevaSala.trim()
    if (!n || salas.includes(n)) return
    setSalas([...salas, n]); setNuevaSala('')
  }

  // ---- Festivos, cierres y vacaciones ----
  let eventos: any[] = []
  try { const e = ajustes.eventos_calendario ? JSON.parse(ajustes.eventos_calendario) : null; if (Array.isArray(e)) eventos = e } catch {}
  const setEventos = (arr:any[]) => set('eventos_calendario', JSON.stringify(arr))
  const [ev, setEv] = useState({ tipo:'festivo', titulo:'', fecha_inicio:'', fecha_fin:'', anual:false })
  const META:Record<string,{label:string,color:string,bg:string}> = {
    festivo:{label:'Festivo local',color:'#9E4E74',bg:'#F7E5EE'},
    cierre:{label:'Cierre clínica',color:'var(--gr)',bg:'var(--bm)'},
    vacaciones:{label:'Vacaciones',color:'#4A557E',bg:'#E9ECF5'},
  }
  const anadirEvento = () => {
    if (!ev.titulo.trim() || !ev.fecha_inicio) return
    const nuevo = { tipo:ev.tipo, titulo:ev.titulo.trim(), fecha_inicio:ev.fecha_inicio, fecha_fin:ev.fecha_fin||ev.fecha_inicio, anual:ev.anual }
    setEventos([...eventos, nuevo].sort((a,b)=>(a.fecha_inicio.slice(5)).localeCompare(b.fecha_inicio.slice(5))))
    setEv({ tipo:ev.tipo, titulo:'', fecha_inicio:'', fecha_fin:'', anual:ev.anual })
  }
  const fmt = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})

  return (
    <>
    <div className="card">
      <div className="card-title"><span className="ct-l"><Ic name="clinica"/> Datos de la clínica</span></div>
      <div className="g2">
        <div className="field" style={{gridColumn:'1/-1'}}>
          <label>Nombre de la clínica</label>
          <input className="input" value={ajustes.clinica_nombre||''} onChange={e=>set('clinica_nombre',e.target.value)} placeholder="SIE Clínica"/>
        </div>
        <div className="field"><label>Hora de apertura</label><input className="input" type="time" value={ajustes.agenda_inicio||'08:00'} onChange={e=>set('agenda_inicio',e.target.value)}/></div>
        <div className="field"><label>Hora de cierre</label><input className="input" type="time" value={ajustes.agenda_fin||'21:30'} onChange={e=>set('agenda_fin',e.target.value)}/></div>
        <div className="field"><label>Duración de la clase (minutos)</label><input className="input" type="number" value={ajustes.clinica_duracion_clase||'50'} onChange={e=>set('clinica_duracion_clase',e.target.value)}/></div>
        <div className="field"><label>Tiempo de cambio entre grupos (minutos)</label><input className="input" type="number" value={ajustes.clinica_tiempo_cambio||'10'} onChange={e=>set('clinica_tiempo_cambio',e.target.value)}/></div>
        <div className="field"><label>Máximo personas por sala</label><input className="input" type="number" value={ajustes.clinica_max_personas_sala||'6'} onChange={e=>set('clinica_max_personas_sala',e.target.value)}/></div>
        <div className="field"><label>Pausa mediodía — inicio</label><input className="input" type="time" value={ajustes.clinica_pausa_inicio||'12:30'} onChange={e=>set('clinica_pausa_inicio',e.target.value)}/></div>
        <div className="field"><label>Pausa mediodía — fin</label><input className="input" type="time" value={ajustes.clinica_pausa_fin||'15:30'} onChange={e=>set('clinica_pausa_fin',e.target.value)}/></div>
      </div>

      <div style={{borderTop:'1px solid var(--bd)',marginTop:6,paddingTop:14}}>
        <label style={{display:'block',fontSize:10,fontWeight:500,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Salas</label>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Salas que aparecen en la agenda (columnas y filtro) y al crear una cita.</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          {salas.map((s,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
              <span style={{fontSize:11,color:'var(--n)'}}>Sala {s}</span>
              {salas.length>1&&<button onClick={()=>setSalas(salas.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}} title="Quitar sala">✕</button>}
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6}}>
          <input className="input" value={nuevaSala} onChange={e=>setNuevaSala(e.target.value)} placeholder="Nombre de la sala, ej. C o Box 1" style={{flex:1,fontSize:11}}
            onKeyDown={e=>{if(e.key==='Enter')anadirSala()}}/>
          <button className="btn btn-p btn-sm" onClick={anadirSala}>+ Añadir</button>
        </div>
        <div style={{fontSize:9,color:'var(--grl)',marginTop:8,display:'flex',alignItems:'flex-start',gap:4}}><Ic name="info" size={11}/> <span>Renombrar o quitar una sala no mueve las citas ya creadas en ella. Recomendado: añadir salas nuevas y no renombrar A/B si ya tienes citas.</span></div>
      </div>
    </div>

    <div className="card">
      <div className="card-title"><span className="ct-l"><Ic name="calendario"/> Festivos, cierres y vacaciones</span></div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Se marcan en la vista Mes de la agenda. Los festivos nacionales y de Galicia ya vienen puestos; aquí añades los locales de Poio (o cambios), cierres de la clínica y vacaciones de trabajadores.</div>

      <div style={{marginBottom:12}}>
        {eventos.length===0 && <div style={{fontSize:10,color:'var(--grl)',marginBottom:8}}>Sin eventos añadidos.</div>}
        {eventos.map((e:any,i:number)=>{
          const m = META[e.tipo] || META.festivo
          const rango = e.fecha_fin && e.fecha_fin!==e.fecha_inicio ? `${fmt(e.fecha_inicio)} – ${fmt(e.fecha_fin)}` : fmt(e.fecha_inicio)
          return (
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,background:'var(--bl)',border:'1px solid var(--bd)',marginBottom:5}}>
              <span style={{fontSize:8,fontWeight:600,color:m.color,background:m.bg,borderRadius:99,padding:'3px 9px',flexShrink:0}}>{m.label}</span>
              <span style={{fontSize:11,color:'var(--n)',flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.titulo}</span>
              <span style={{fontSize:10,color:'var(--grl)',flexShrink:0}}>{rango}{e.anual?' · cada año':''}</span>
              <button onClick={()=>setEventos(eventos.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer',flexShrink:0}} title="Quitar">✕</button>
            </div>
          )
        })}
      </div>

      <label style={{display:'flex',alignItems:'center',gap:7,fontSize:10,color:'var(--gr)',marginBottom:9,cursor:'pointer'}}>
        <input type="checkbox" checked={ev.anual} onChange={e=>setEv(p=>({...p,anual:e.target.checked}))}/>
        Se repite cada año (festivos y cierres fijos; deja sin marcar las vacaciones)
      </label>
      <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:8,alignItems:'end'}}>
        <div className="field" style={{margin:0}}>
          <label>Tipo</label>
          <select className="input" value={ev.tipo} onChange={e=>setEv(p=>({...p,tipo:e.target.value}))} style={{fontSize:11}}>
            <option value="festivo">Festivo local</option>
            <option value="cierre">Cierre clínica</option>
            <option value="vacaciones">Vacaciones</option>
          </select>
        </div>
        <div className="field" style={{margin:0}}>
          <label>{ev.tipo==='vacaciones'?'Trabajador':ev.tipo==='cierre'?'Motivo':'Nombre del festivo'}</label>
          <input className="input" value={ev.titulo} onChange={e=>setEv(p=>({...p,titulo:e.target.value}))} placeholder={ev.tipo==='vacaciones'?'Ej. Ana':ev.tipo==='cierre'?'Ej. Cierre agosto':'Ej. Virxe da Mercé'} style={{fontSize:11}}/>
        </div>
        <div className="field" style={{margin:0}}>
          <label>Desde</label>
          <input className="input" type="date" value={ev.fecha_inicio} onChange={e=>setEv(p=>({...p,fecha_inicio:e.target.value}))} style={{fontSize:11}}/>
        </div>
        <div className="field" style={{margin:0,display:'flex',gap:6,alignItems:'end'}}>
          <div style={{flex:1}}>
            <label>Hasta <span style={{textTransform:'none',fontWeight:400}}>(opcional)</span></label>
            <input className="input" type="date" value={ev.fecha_fin} onChange={e=>setEv(p=>({...p,fecha_fin:e.target.value}))} style={{fontSize:11}}/>
          </div>
          <button className="btn btn-p btn-sm" onClick={anadirEvento} style={{flexShrink:0}}>+ Añadir</button>
        </div>
      </div>
    </div>
    </>
  )
}
