'use client'

export default function PasoPlan({ form, up, tiposClaseOpts=[], bonosOpts=[] }: any) {
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
          <div className="card-title">Horario</div>
          <div className="field"><label>Días de asistencia</label>
            <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
              {['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d=>{
                const dias=form.dias_asistencia?form.dias_asistencia.split(','):[]
                const sel=dias.includes(d)
                return <span key={d} onClick={()=>{const curr=form.dias_asistencia?form.dias_asistencia.split(',').filter(Boolean):[];const next=sel?curr.filter((x:string)=>x!==d):[...curr,d];up('dias_asistencia',next.join(','))}} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'50%',border:`1.5px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'var(--w)',color:sel?'#fff':'var(--gr)',cursor:'pointer',fontSize:10,fontWeight:sel?600:300}}>{d}</span>
              })}
            </div>
          </div>
          <div className="field"><label>Franja horaria</label>
            <div style={{display:'flex',gap:5,marginTop:4,flexWrap:'wrap'}}>
              {([['manana','☀️ Mañanas'],['tarde','🌤 Tardes'],['noche','🌙 Noches'],['flexible','🔄 Flexible']] as const).map(([v,l])=>(
                <span key={v} onClick={()=>up('franja',v)} style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${form.franja===v?'var(--g)':'var(--bd)'}`,background:form.franja===v?'var(--g)':'var(--w)',color:form.franja===v?'#fff':'var(--gr)',cursor:'pointer'}}>{l}</span>
              ))}
            </div>
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
