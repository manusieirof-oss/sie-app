'use client'

export default function PasoPlan({ form, up, tiposClaseOpts=[], bonosOpts=[] }: any) {
  const hp = form.horario_pref || {modo:'general',franja_general:'manana',franjas_dia:{},alterno:'manana_tarde',hora_exacta:'',notas_horario:''}
  const upHp = (k:string, v:any) => up('horario_pref', {...hp, [k]:v})

  const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']
  const FRANJAS = [['manana','☀️ Mañana'],['tarde','🌤 Tarde'],['noche','🌙 Noche'],['flexible','🔄 Flexible']] as const

  return (
    <div className="g2">
      <div>
        <div className="card">
          <div className="card-title">Tipo de clase definitivo</div>
          <div className="g3">
            {tiposClaseOpts.map((tc:any)=>(
              <div key={tc.valor} onClick={()=>up('tipo_clase_def',tc.valor)} style={{border:`1.5px solid ${form.tipo_clase_def===tc.valor?'var(--g)':'var(--bd)'}`,borderRadius:'var(--rl)',padding:10,textAlign:'center',cursor:'pointer',background:form.tipo_clase_def===tc.valor?'var(--gl)':'var(--w)',transition:'all .15s'}}>
                <div style={{fontSize:20,marginBottom:4}}>{tc.icono}</div>
                <div style={{fontSize:10,fontWeight:400}}>{tc.nombre}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Bono definitivo</div>
          {bonosOpts.map((b:any)=>(
            <div key={b.id} onClick={()=>up('bono',b.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1.5px solid ${form.bono===b.id?'var(--g)':'var(--bd)'}`,background:form.bono===b.id?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:4,transition:'all .15s'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{b.nombre}</div>
                <div style={{fontSize:9,color:'var(--grl)'}}>{b.descripcion}</div>
              </div>
              {form.bono===b.id&&<div style={{width:16,height:16,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>✓</div>}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-title">Horario preferido</div>

          {/* MODO DE HORARIO */}
          <div className="field"><label>Modo</label>
            <div style={{display:'flex',gap:5,marginTop:4}}>
              {([['general','General'],['por_dia','Por día'],['alterno','Alterno']] as const).map(([v,l])=>(
                <div key={v} onClick={()=>upHp('modo',v)} style={{flex:1,padding:'7px',borderRadius:6,border:`1.5px solid ${hp.modo===v?'var(--g)':'var(--bd)'}`,background:hp.modo===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:hp.modo===v?500:300,color:hp.modo===v?'var(--gd)':'var(--grl)'}}>{l}</div>
              ))}
            </div>
          </div>

          {/* MODO GENERAL */}
          {hp.modo==='general' && (
            <>
              <div className="field"><label>Días de asistencia</label>
                <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
                  {DIAS.map(d=>{
                    const dias=form.dias_asistencia?form.dias_asistencia.split(','):[]
                    const sel=dias.includes(d)
                    return <span key={d} onClick={()=>{const curr=form.dias_asistencia?form.dias_asistencia.split(',').filter(Boolean):[];const next=sel?curr.filter((x:string)=>x!==d):[...curr,d];up('dias_asistencia',next.join(','))}} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:`1.5px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'var(--w)',color:sel?'#fff':'var(--gr)',cursor:'pointer',fontSize:10,fontWeight:sel?600:300}}>{d}</span>
                  })}
                </div>
              </div>
              <div className="field"><label>Franja horaria</label>
                <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
                  {FRANJAS.map(([v,l])=>(
                    <span key={v} onClick={()=>{upHp('franja_general',v);up('franja',v)}} style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${hp.franja_general===v?'var(--g)':'var(--bd)'}`,background:hp.franja_general===v?'var(--g)':'var(--w)',color:hp.franja_general===v?'#fff':'var(--gr)',cursor:'pointer'}}>{l}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* MODO POR DÍA */}
          {hp.modo==='por_dia' && (
            <div className="field"><label>Franja preferida por día</label>
              <div style={{marginTop:4}}>
                {DIAS.map(d=>{
                  const franjaDia = hp.franjas_dia?.[d] || ''
                  return (
                    <div key={d} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                      <span style={{width:28,fontSize:11,fontWeight:500,color:franjaDia?'var(--n)':'var(--grl)'}}>{d}</span>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',flex:1}}>
                        {FRANJAS.map(([v,l])=>(
                          <span key={v} onClick={()=>{const fd={...(hp.franjas_dia||{})};if(fd[d]===v){delete fd[d]}else{fd[d]=v}upHp('franjas_dia',fd)}} style={{fontSize:9,padding:'3px 8px',borderRadius:99,border:`1px solid ${franjaDia===v?'var(--g)':'var(--bd)'}`,background:franjaDia===v?'var(--g)':'var(--w)',color:franjaDia===v?'#fff':'var(--grl)',cursor:'pointer'}}>{l}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>Pulsa la franja de cada día que asiste. Deja en blanco los días que no.</div>
              </div>
            </div>
          )}

          {/* MODO ALTERNO */}
          {hp.modo==='alterno' && (
            <div className="field"><label>Alternancia por semanas</label>
              <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
                {([['manana_tarde','Semana mañana / Semana tarde'],['tarde_manana','Semana tarde / Semana mañana']] as const).map(([v,l])=>(
                  <div key={v} onClick={()=>upHp('alterno',v)} style={{flex:1,minWidth:140,padding:'8px',borderRadius:6,border:`1.5px solid ${hp.alterno===v?'var(--g)':'var(--bd)'}`,background:hp.alterno===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:hp.alterno===v?500:300,color:hp.alterno===v?'var(--gd)':'var(--grl)'}}>{l}</div>
                ))}
              </div>
              <div className="field" style={{marginTop:8}}><label>Días de asistencia</label>
                <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
                  {DIAS.map(d=>{
                    const dias=form.dias_asistencia?form.dias_asistencia.split(','):[]
                    const sel=dias.includes(d)
                    return <span key={d} onClick={()=>{const curr=form.dias_asistencia?form.dias_asistencia.split(',').filter(Boolean):[];const next=sel?curr.filter((x:string)=>x!==d):[...curr,d];up('dias_asistencia',next.join(','))}} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:`1.5px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'var(--w)',color:sel?'#fff':'var(--gr)',cursor:'pointer',fontSize:10,fontWeight:sel?600:300}}>{d}</span>
                  })}
                </div>
              </div>
            </div>
          )}

          {/* HORA EXACTA (todos los modos) */}
          <div className="field"><label>Hora exacta preferida (opcional)</label>
            <input className="input" type="time" value={hp.hora_exacta||''} onChange={e=>upHp('hora_exacta',e.target.value)}/>
          </div>

          {/* NOTAS DE HORARIO */}
          <div className="field"><label>Notas de horario (opcional)</label>
            <input className="input" value={hp.notas_horario||''} onChange={e=>upHp('notas_horario',e.target.value)} placeholder="ej. no puede antes de las 17h"/>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Notas del plan</div>
          <textarea className="input" style={{minHeight:120}} value={form.notas_plan} onChange={e=>up('notas_plan',e.target.value)}
            placeholder={`Resumen orientativo:\n· Objetivos: ${form.objetivo1||'—'}\n· Tipo de trabajo propuesto\n· Limitaciones a considerar\n· Progresión`}/>
        </div>
      </div>
    </div>
  )
}
