'use client'

export default function PasoPaciente({ form, up, pacientes, comoNosConocioOpts, firmaCanvas, setFirmaCanvas, firmaAceptada, setFirmaAceptada, dibujando, setDibujando }: any) {
  return (
    <div className="g2">
      <div className="card">
        <div className="card-title">¿Es un paciente existente o nuevo?</div>
        <div className="field"><label>Paciente existente (opcional)</label>
          <select className="input" value={form.paciente_id} onChange={e=>up('paciente_id',e.target.value)}>
            <option value="">— Paciente nuevo —</option>
            {pacientes.map((p:any)=><option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
          </select>
        </div>
        {!form.paciente_id && (
          <>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',margin:'8px 0 6px'}}>Datos del nuevo paciente</div>
            <div className="g2">
              <div className="field"><label>Nombre *</label><input className="input" value={form.nombre} onChange={e=>up('nombre',e.target.value)}/></div>
              <div className="field"><label>Apellidos *</label><input className="input" value={form.apellidos} onChange={e=>up('apellidos',e.target.value)}/></div>
              <div className="field"><label>Nombre en clínica</label><input className="input" value={form.nombre_clinica||''} onChange={e=>up('nombre_clinica',e.target.value)} placeholder="ej. Manu"/></div>
              <div className="field"><label>Teléfono</label><input className="input" value={form.telefono} onChange={e=>up('telefono',e.target.value)}/></div>
              <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={e=>up('email',e.target.value)}/></div>
              <div className="field"><label>DNI</label><input className="input" value={form.dni} onChange={e=>up('dni',e.target.value)}/></div>
              <div className="field"><label>F. nacimiento</label><input className="input" type="date" value={form.fecha_nacimiento} onChange={e=>up('fecha_nacimiento',e.target.value)}/></div>
              <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={form.altura_cm} onChange={e=>up('altura_cm',e.target.value)}/></div>
              <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={form.peso_kg} onChange={e=>up('peso_kg',e.target.value)}/></div>
            </div>
          </>
        )}
      </div>
      <div>
        <div className="card">
          <div className="card-title">¿Cómo nos conoció?</div>
          <select className="input" value={form.como_nos_conocio} onChange={e=>up('como_nos_conocio',e.target.value)}>
            <option value="">Seleccionar...</option>
            {comoNosConocioOpts.map((op:string)=><option key={op} value={op}>{op}</option>)}
          </select>
        </div>
        <div className="card">
          <div className="card-title">Consentimiento de datos</div>
          <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 11px',fontSize:9,color:'var(--gd)',lineHeight:1.6,marginBottom:10}}>
            Autorizo a SIE a tratar mis datos personales y de salud con fines terapéuticos, de acuerdo con el RGPD y la LOPD-GDD. Los datos no serán cedidos a terceros sin consentimiento expreso.
          </div>
          <div style={{marginBottom:10}}>
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
          <div onClick={()=>setFirmaAceptada((p:boolean)=>!p)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:6,border:`1.5px solid ${firmaAceptada?'var(--g)':'var(--bd)'}`,background:firmaAceptada?'var(--gl)':'var(--w)',cursor:'pointer'}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${firmaAceptada?'var(--g)':'var(--bd)'}`,background:firmaAceptada?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              {firmaAceptada&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:10,color:'var(--n)',fontWeight:300}}>He leído y acepto el tratamiento de mis datos personales</span>
          </div>
          {(firmaCanvas||firmaAceptada)&&<div style={{marginTop:6,fontSize:9,color:'var(--gd)',background:'var(--gl)',borderRadius:4,padding:'4px 8px'}}>✓ Consentimiento registrado · {new Date().toLocaleDateString('es-ES')}</div>}
        </div>
      </div>
    </div>
  )
}
