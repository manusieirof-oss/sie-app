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
  return (
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
  )
}
