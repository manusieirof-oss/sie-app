'use client'

export default function PasoResumen({ form, testsValoracion, guardando, finalizar, firmaAceptada, imagenesAceptada, firmaCanvas }: any) {
  const hp = form.horario_pref || {}
  const FR:Record<string,string> = {manana:'Mañana',tarde:'Tarde',noche:'Noche',flexible:'Flexible'}
  const edad = form.fecha_nacimiento ? Math.floor((Date.now()-new Date(form.fecha_nacimiento).getTime())/(365.25*24*3600*1000)) : null

  function resumenHorario() {
    if (hp.modo==='general') {
      const dias = form.dias_asistencia ? form.dias_asistencia.split(',').join(' · ') : '—'
      return `${dias} · ${FR[hp.franja_general]||FR[form.franja]||'—'}${hp.hora_exacta?` · ${hp.hora_exacta}`:''}`
    }
    if (hp.modo==='por_dia') {
      const fd = hp.franjas_dia||{}
      const partes = Object.keys(fd).map(d=>`${d}: ${FR[fd[d]]||fd[d]}${hp.horas_dia?.[d]?` (${hp.horas_dia[d]})`:''}`)
      return partes.length?partes.join(' · '):'Sin días marcados'
    }
    if (hp.modo==='alterno') {
      return hp.alterno==='turnos'?'Turnos (variable)':'Semana mañana / Semana tarde'
    }
    return '—'
  }

  return (
    <div className="g2">
      <div>
        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>👤 Paciente</div>
          <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:3}}>{form.nombre||'(existente)'} {form.apellidos}</div>
          <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>{form.tipo_clase_def} · Bono {form.bono?.replace('_',' ')}</div>
          {(form.telefono||form.email)&&<div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>{form.telefono}{form.telefono&&form.email&&' · '}{form.email}</div>}
          {(edad!=null||form.altura_cm||form.peso_kg)&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{edad!=null&&`${edad} años`}{edad!=null&&(form.altura_cm||form.peso_kg)&&' · '}{form.altura_cm&&`${form.altura_cm} cm`}{form.altura_cm&&form.peso_kg&&' · '}{form.peso_kg&&`${form.peso_kg} kg`}</div>}
          {form.dni&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>DNI: {form.dni}</div>}
          {form.como_nos_conocio&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Nos conoció por: {form.como_nos_conocio}</div>}
        </div>

        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🗓 Horario preferido</div>
          <div style={{fontSize:10,color:'var(--n)',fontWeight:300}}>{resumenHorario()}</div>
          {hp.notas_horario&&<div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>📝 {hp.notas_horario}</div>}
        </div>

        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🎯 Objetivos</div>
          {[form.objetivo1,form.objetivo2,form.objetivo3].filter(Boolean).map((o,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:6,padding:'4px 7px',background:'var(--gl)',borderRadius:5,marginBottom:3,fontSize:10}}>
              <div style={{width:15,height:15,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:8,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>{o}
            </div>
          ))}
          {form.deseo&&<div style={{marginTop:6,padding:'6px 8px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800'}}>⭐ {form.deseo}</div>}
        </div>

        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🔍 Tests</div>
          {testsValoracion.length===0?<div style={{fontSize:10,color:'var(--grl)'}}>Sin tests</div>:testsValoracion.flatMap((tv:any,i:number)=>{
            const lados = tv.lados || {}
            const conDato = Object.keys(lados).filter(k=>lados[k] && lados[k].resultado && lados[k].resultado!=='sin_realizar')
            if (!conDato.length) return [(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 7px',background:'var(--bl)',borderRadius:4,marginBottom:3,fontSize:10}}>
                <span>⚪</span><span style={{fontWeight:500}}>{tv.nombre}</span><span style={{color:'var(--grl)',fontSize:9}}>· sin resultado</span>
              </div>
            )]
            return conDato.map((k:string)=>(
              <div key={i+'-'+k} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 7px',background:lados[k].resultado==='positivo'?'var(--redl)':'var(--gl)',borderRadius:4,marginBottom:3,fontSize:10}}>
                <span>{lados[k].resultado==='positivo'?'🔴':'🟢'}</span>
                <span style={{fontWeight:500}}>{tv.nombre}</span>
                <span style={{color:'var(--grl)',fontSize:9}}>· {k}</span>
              </div>
            ))
          })}
        </div>

        {form.notas_plan&&<div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>📝 Plan</div>
          <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{form.notas_plan}</div>
        </div>}
      </div>

      <div>
        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>📋 Anamnesis</div>
          <div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5}}>{form.anamnesis||'No registrada'}</div>
          {form.trabajo&&<div style={{marginTop:6,fontSize:9,color:'var(--grl)'}}>Trabajo: {form.trabajo}{form.tipo_jornada&&' · '+form.tipo_jornada}</div>}
          {form.hace_deporte&&form.deportes?.length>0&&<div style={{marginTop:4,fontSize:9,color:'var(--grl)'}}>Deportes: {form.deportes.join(', ')}</div>}
        </div>

        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🗺 Molestias</div>
          {form.molestias.length===0?<div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias</div>:form.molestias.map((m:any,i:number)=>(
            <div key={i} style={{display:'flex',gap:7,marginBottom:4,fontSize:10}}>
              <span style={{color:'var(--red)',fontWeight:500}}>{m.zona}</span>
              <span style={{color:'var(--grl)'}}>EVA {m.eva}/10</span>
              {m.lado&&m.lado!=='bilateral'&&<span style={{color:'var(--grl)'}}>· {m.lado}</span>}
            </div>
          ))}
        </div>

        {(form.medicacion.length>0||form.alergias.length>0||form.intolerancias.length>0||form.plantillas)&&<div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>💊 Salud y hábitos</div>
          {form.medicacion.length>0&&<div style={{marginBottom:5}}><div style={{fontSize:9,color:'var(--grl)',marginBottom:3}}>Medicación:</div><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{form.medicacion.map((m:any,i:number)=><span key={i} style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'var(--gl)',border:'1px solid var(--gm)',color:'var(--gd)'}}>{m.nombre}{m.frecuencia&&' · '+m.frecuencia}</span>)}</div></div>}
          {form.alergias.length>0&&<div style={{marginBottom:5}}><div style={{fontSize:9,color:'var(--grl)',marginBottom:3}}>Alergias:</div><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{form.alergias.map((a:string,i:number)=><span key={i} style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'var(--redl)',border:'1px solid #F5C8C8',color:'var(--red)'}}>{a}</span>)}</div></div>}
          {form.intolerancias.length>0&&<div style={{marginBottom:5}}><div style={{fontSize:9,color:'var(--grl)',marginBottom:3}}>Intolerancias:</div><div style={{display:'flex',flexWrap:'wrap',gap:3}}>{form.intolerancias.map((a:string,i:number)=><span key={i} style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'var(--ambl)',border:'1px solid var(--amb)',color:'#7A5800'}}>{a}</span>)}</div></div>}
          {form.plantillas&&<div style={{fontSize:9,color:'var(--grl)'}}>🦶 Plantillas: {form.tipo_plantilla||'Sí'}</div>}
        </div>}

        {(form.patologias.length>0||form.operaciones.length>0)&&<div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>🏥 Historial</div>
          {form.patologias.map((p:any,i:number)=><div key={i} style={{fontSize:10,color:'var(--n)',marginBottom:2}}>🏥 {p.nombre} · <span style={{color:'var(--grl)'}}>{p.estado}</span>{p.tiene_informe&&' · 📄'}</div>)}
          {form.operaciones.map((op:any,i:number)=><div key={i} style={{fontSize:10,color:'var(--n)',marginBottom:2}}>🔪 {op.nombre}{op.anio&&' · '+op.anio}{op.tiene_informe&&' · 📄'}</div>)}
        </div>}

        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>📊 Escalas</div>
          <div style={{display:'flex',gap:12,fontSize:10}}>
            <div><span style={{color:'var(--grl)'}}>Bienestar: </span><span style={{fontWeight:500,color:'var(--g)'}}>{form.borg}/10</span></div>
            <div><span style={{color:'var(--grl)'}}>Estrés: </span><span style={{fontWeight:500,color:'var(--red)'}}>{form.estres}/10</span></div>
          </div>
        </div>

        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:7,padding:'10px 12px',marginBottom:7}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.5,textTransform:'uppercase',marginBottom:8}}>✍️ Consentimientos</div>
          <div style={{display:'flex',flexDirection:'column',gap:3,fontSize:10}}>
            <div style={{color:firmaAceptada?'var(--gd)':'var(--grl)'}}>{firmaAceptada?'✓':'○'} Datos personales</div>
            <div style={{color:imagenesAceptada?'var(--gd)':'var(--grl)'}}>{imagenesAceptada?'✓':'○'} Uso de imágenes (seguimiento)</div>
            <div style={{color:'var(--grl)'}}>Firma: {firmaCanvas?'✓ registrada':'pendiente'}</div>
          </div>
        </div>

        <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:7,padding:'10px 12px',marginBottom:12,fontSize:10,color:'var(--gd)'}}>
          ✓ Todos los datos quedarán guardados en la ficha del paciente.
        </div>
        <button className="btn btn-p" style={{width:'100%',justifyContent:'center',padding:'11px',fontSize:13}} onClick={finalizar} disabled={guardando}>
          {guardando?'Guardando...':'✓ Guardar valoración completa'}
        </button>
      </div>
    </div>
  )
}
