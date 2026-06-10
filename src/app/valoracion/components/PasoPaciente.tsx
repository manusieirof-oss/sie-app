'use client'
import { useState } from 'react'
import { TEXTO_DATOS, TEXTO_IMAGENES } from '@/lib/textosLegales'

export default function PasoPaciente({ form, up, pacientes, comoNosConocioOpts, firmaCanvas, setFirmaCanvas, firmaAceptada, setFirmaAceptada, imagenesAceptada, setImagenesAceptada, dibujando, setDibujando }: any) {
  const [docAbierto, setDocAbierto] = useState<null|'datos'|'imagenes'>(null)

  return (
    <div className="g2">
      <div className="card">
        <div className="card-title">¿Es un paciente existente o nuevo?</div>
        <div className="field"><label>Paciente existente (opcional)</label>
          <select className="input" value={form.paciente_id} onChange={e=>up('paciente_id',e.target.value)}>
            <option value="">— Paciente nuevo —</option>
            {pacientes.map((p:any)=>(<option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>))}
          </select>
        </div>
        <div className="g2">
          <div className="field"><label>Nombre *</label><input className="input" value={form.nombre} onChange={e=>up('nombre',e.target.value)}/></div>
          <div className="field"><label>Apellidos</label><input className="input" value={form.apellidos} onChange={e=>up('apellidos',e.target.value)}/></div>
        </div>
        <div className="field"><label>Nombre clínica (opcional)</label><input className="input" value={form.nombre_clinica} onChange={e=>up('nombre_clinica',e.target.value)}/></div>
        <div className="g2">
          <div className="field"><label>Teléfono</label><input className="input" value={form.telefono} onChange={e=>up('telefono',e.target.value)}/></div>
          <div className="field"><label>Email</label><input className="input" value={form.email} onChange={e=>up('email',e.target.value)}/></div>
        </div>
        <div className="g2">
          <div className="field"><label>DNI</label><input className="input" value={form.dni} onChange={e=>up('dni',e.target.value)}/></div>
          <div className="field"><label>Fecha nacimiento</label><input className="input" type="date" value={form.fecha_nacimiento} onChange={e=>up('fecha_nacimiento',e.target.value)}/></div>
        </div>
        <div className="g2">
          <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={form.altura_cm} onChange={e=>up('altura_cm',e.target.value)}/></div>
          <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={form.peso_kg} onChange={e=>up('peso_kg',e.target.value)}/></div>
        </div>
        <div className="field"><label>¿Cómo nos conoció?</label>
          <select className="input" value={form.como_nos_conocio} onChange={e=>up('como_nos_conocio',e.target.value)}>
            <option value="">—</option>
            {comoNosConocioOpts.map((o:string)=>(<option key={o} value={o}>{o}</option>))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Consentimientos</div>

        {/* FIRMA */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Firma del paciente</div>
          <div style={{position:'relative',border:`2px solid ${firmaCanvas?'var(--g)':'var(--bd)'}`,borderRadius:6,background:'var(--w)',overflow:'hidden'}}>
            <canvas id="firma-canvas" width={400} height={120} style={{display:'block',width:'100%',height:120,cursor:'crosshair',touchAction:'none'}}
              onMouseDown={e=>{setDibujando(true);const c=e.currentTarget;const ctx=c.getContext('2d')!;const r=c.getBoundingClientRect();const sx=c.width/r.width;ctx.beginPath();ctx.moveTo((e.clientX-r.left)*sx,(e.clientY-r.top)*sx)}}
              onMouseMove={e=>{if(!dibujando)return;const c=e.currentTarget;const ctx=c.getContext('2d')!;const r=c.getBoundingClientRect();const sx=c.width/r.width;ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#262825';ctx.lineTo((e.clientX-r.left)*sx,(e.clientY-r.top)*sx);ctx.stroke()}}
              onMouseUp={e=>{setDibujando(false);setFirmaCanvas(e.currentTarget.toDataURL())}}
              onTouchStart={e=>{e.preventDefault();setDibujando(true);const c=e.currentTarget;const ctx=c.getContext('2d')!;const r=c.getBoundingClientRect();const sx=c.width/r.width;const t=e.touches[0];ctx.beginPath();ctx.moveTo((t.clientX-r.left)*sx,(t.clientY-r.top)*sx)}}
              onTouchMove={e=>{e.preventDefault();if(!dibujando)return;const c=e.currentTarget;const ctx=c.getContext('2d')!;const r=c.getBoundingClientRect();const sx=c.width/r.width;const t=e.touches[0];ctx.lineWidth=2;ctx.lineCap='round';ctx.strokeStyle='#262825';ctx.lineTo((t.clientX-r.left)*sx,(t.clientY-r.top)*sx);ctx.stroke()}}
              onTouchEnd={e=>{setDibujando(false);setFirmaCanvas(e.currentTarget.toDataURL())}}
            />
            {!firmaCanvas&&<div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:10,color:'var(--grl)',pointerEvents:'none'}}>Firma aquí con el dedo o ratón</div>}
          </div>
          {firmaCanvas&&<button className="btn btn-t btn-sm" style={{marginTop:5}} onClick={()=>{const c=document.getElementById('firma-canvas') as HTMLCanvasElement;c.getContext('2d')!.clearRect(0,0,c.width,c.height);setFirmaCanvas('')}}>🗑 Borrar firma</button>}
        </div>

        {/* CONSENTIMIENTO DATOS (obligatorio) */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
          <span style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>Protección de datos *</span>
          <button className="btn btn-t btn-sm" onClick={()=>setDocAbierto('datos')}>📄 Leer documento</button>
        </div>
        <div onClick={()=>setFirmaAceptada((p:boolean)=>!p)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:6,border:`1.5px solid ${firmaAceptada?'var(--g)':'var(--bd)'}`,background:firmaAceptada?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:12}}>
          <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${firmaAceptada?'var(--g)':'var(--bd)'}`,background:firmaAceptada?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {firmaAceptada&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
          </div>
          <span style={{fontSize:10,color:'var(--n)',fontWeight:300}}>He leído y acepto el tratamiento de mis datos personales</span>
        </div>

        {/* CONSENTIMIENTO IMÁGENES (opcional) */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
          <span style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>Uso de imágenes (opcional)</span>
          <button className="btn btn-t btn-sm" onClick={()=>setDocAbierto('imagenes')}>📄 Leer documento</button>
        </div>
        <div onClick={()=>setImagenesAceptada((p:boolean)=>!p)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:6,border:`1.5px solid ${imagenesAceptada?'var(--g)':'var(--bd)'}`,background:imagenesAceptada?'var(--gl)':'var(--w)',cursor:'pointer'}}>
          <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${imagenesAceptada?'var(--g)':'var(--bd)'}`,background:imagenesAceptada?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {imagenesAceptada&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
          </div>
          <span style={{fontSize:10,color:'var(--n)',fontWeight:300}}>He leído y acepto el tratamiento de imágenes para seguimiento</span>
        </div>

        {(firmaCanvas||firmaAceptada||imagenesAceptada)&&<div style={{marginTop:8,fontSize:9,color:'var(--gd)',background:'var(--gl)',borderRadius:4,padding:'4px 8px'}}>✓ Consentimiento registrado · {new Date().toLocaleDateString('es-ES')}</div>}
      </div>

      {/* MODAL LECTURA DOCUMENTO */}
      {docAbierto && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setDocAbierto(null)}}>
          <div className="modal" style={{maxWidth:620,maxHeight:'80vh',display:'flex',flexDirection:'column'}}>
            <div className="modal-title">
              {docAbierto==='datos'?'Protección de datos':'Uso de imágenes'}
              <button className="modal-close" onClick={()=>setDocAbierto(null)}>✕</button>
            </div>
            <div style={{overflowY:'auto',fontSize:11,lineHeight:1.7,color:'var(--n)',whiteSpace:'pre-wrap',padding:'4px 2px'}}>
              {docAbierto==='datos'?TEXTO_DATOS:TEXTO_IMAGENES}
            </div>
            <div style={{display:'flex',gap:8,marginTop:12,justifyContent:'flex-end'}}>
              <button className="btn btn-d btn-sm" onClick={()=>setDocAbierto(null)}>Cerrar</button>
              <button className="btn btn-p btn-sm" onClick={()=>{
                if(docAbierto==='datos')setFirmaAceptada(true); else setImagenesAceptada(true);
                setDocAbierto(null)
              }}>✓ He leído y acepto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
