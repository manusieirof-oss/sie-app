'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { iconTipoClase } from '@/lib/tipos'

export default function ModalEditarCitas({ citas, pacienteNombre, horas=[], salas=['A','B'], tiposClase=[], guardando, onGuardar, onCerrar }: any) {
  const [rows, setRows] = useState<any[]>(
    (citas||[]).slice().sort((a:any,b:any)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).map((c:any)=>({
      id:c.id, paciente_id:c.paciente_id, fecha:c.fecha, hora:(c.hora||'').slice(0,5), sala:c.sala, tipo:c.tipo, estado:c.estado,
    }))
  )
  const HORAS = horas && horas.length>0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const colorTipo = (t:string) => (tiposClase.find((x:any)=>x.valor===t)?.color) || '#5A969E'
  const set = (id:string, k:string, v:string) => setRows(p=>p.map(r=>r.id===id?{...r,[k]:v}:r))

  const orig = (id:string) => (citas||[]).find((c:any)=>c.id===id)
  const cambiada = (r:any) => { const o=orig(r.id); return o && (o.fecha!==r.fecha || (o.hora||'').slice(0,5)!==r.hora || o.sala!==r.sala || o.tipo!==r.tipo) }
  const nCambios = rows.filter(cambiada).length

  const diaSemana = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short'})

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)onCerrar()}}>
      <div className="modal" style={{width:620,maxWidth:'94vw'}}>
        <div className="modal-title">
          <span>Editar sesiones · {pacienteNombre}</span>
          <button className="modal-close" onClick={()=>{if(!guardando)onCerrar()}}>✕</button>
        </div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>Edita día, hora, sala o tipo de varias citas a la vez. La sesión de entrenamiento asignada se mantiene.</div>

        <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 0.9fr 1.3fr',gap:6,fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',padding:'0 4px 6px'}}>
          <div>Día</div><div>Hora</div><div>Sala</div><div>Tipo</div>
        </div>
        <div style={{maxHeight:'52vh',overflowY:'auto'}}>
          {rows.length===0 && <div style={{fontSize:11,color:'var(--grl)',padding:'10px 4px'}}>Este paciente no tiene citas este mes.</div>}
          {rows.map(r=>{
            const cancel = r.estado==='cancelada'
            return (
              <div key={r.id} style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 0.9fr 1.3fr',gap:6,alignItems:'center',padding:'5px 4px',borderRadius:7,marginBottom:3,background:cambiada(r)?'var(--gl)':'transparent',opacity:cancel?0.55:1}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}>
                  <input type="date" className="input" value={r.fecha} onChange={e=>set(r.id,'fecha',e.target.value)} disabled={guardando} style={{fontSize:11,padding:'5px 7px'}}/>
                  <span style={{fontSize:9,color:'var(--grl)',width:24,flexShrink:0,textTransform:'capitalize'}}>{diaSemana(r.fecha)}</span>
                </div>
                <select className="input" value={r.hora} onChange={e=>set(r.id,'hora',e.target.value)} disabled={guardando} style={{fontSize:11,padding:'5px 7px'}}>
                  {!HORAS.includes(r.hora)&&<option value={r.hora}>{r.hora}</option>}
                  {HORAS.map((h:string)=><option key={h} value={h}>{h}</option>)}
                </select>
                <select className="input" value={r.sala} onChange={e=>set(r.id,'sala',e.target.value)} disabled={guardando} style={{fontSize:11,padding:'5px 7px'}}>
                  {!salas.includes(r.sala)&&<option value={r.sala}>{r.sala}</option>}
                  {salas.map((s:string)=><option key={s} value={s}>{s}</option>)}
                </select>
                <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
                  <span style={{display:'inline-flex',color:colorTipo(r.tipo),flexShrink:0}}><Ic name={iconTipoClase(r.tipo,(tiposClase.find((t:any)=>t.valor===r.tipo)||{}).icono)} size={14}/></span>
                  <select className="input" value={r.tipo} onChange={e=>set(r.id,'tipo',e.target.value)} disabled={guardando} style={{fontSize:11,padding:'5px 7px'}}>
                    {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre}</option>)}
                  </select>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{display:'flex',gap:8,marginTop:14,alignItems:'center'}}>
          <span style={{fontSize:10,color:'var(--grl)'}}>{nCambios>0?`${nCambios} cita${nCambios>1?'s':''} con cambios`:'Sin cambios'}</span>
          <div style={{flex:1}}/>
          <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)onCerrar()}} disabled={guardando}>Cancelar</button>
          <button className="btn btn-p" onClick={()=>onGuardar(rows.filter(cambiada))} disabled={guardando||nCambios===0}>
            {guardando?'Guardando…':`✓ Guardar ${nCambios>0?`(${nCambios})`:''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
