'use client'
import { Ic } from '@/lib/icons'
import EscalaSlider, { textoEscala } from '@/components/EscalaSlider'

export default function PasoAnamnesis({ form, up, tiposJornada, deportesOpts, tiposPlantilla, modo='inicial', previo=null }: any) {
  // En la revaloración el deporte y las plantillas se preguntan en el paso de
  // completar, junto al resto del historial: aquí solo estarían por segunda vez.
  const esRevaloracion = modo === 'revaloracion'
  const anterior = previo?.valoracion || null
  return (
    <div>
      <div className="card" style={{marginBottom:8}}>
        <div className="card-title">{esRevaloracion?'Anamnesis de hoy · cómo se encuentra':'Anamnesis inicial · motivo de consulta'}</div>
        <textarea className="input" style={{minHeight:110,fontSize:13,lineHeight:1.6}} placeholder={esRevaloracion?'¿Cómo está desde la última valoración? Qué ha mejorado, qué sigue igual, qué ha aparecido...':'¿Por qué empieza en SIE? Situación actual, historial, expectativas...'} value={form.anamnesis} onChange={e=>up('anamnesis',e.target.value)}/>
        <div className="g2" style={{marginTop:8}}>
          <div className="field"><label>Trabajo / profesión</label><input className="input" value={form.trabajo} onChange={e=>up('trabajo',e.target.value)} placeholder="ej. Administrativo, enfermera..."/></div>
          <div className="field"><label>Tipo de jornada</label>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
              {tiposJornada.map((j:string)=>(
                <span key={j} onClick={()=>up('tipo_jornada',j)} style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${form.tipo_jornada===j?'var(--g)':'var(--bd)'}`,background:form.tipo_jornada===j?'var(--g)':'var(--w)',color:form.tipo_jornada===j?'#fff':'var(--gr)',cursor:'pointer'}}>{j}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="g2" style={{marginBottom:8}}>
        <div className="card">
          <div className="card-title">Objetivos del paciente</div>
          {/* Lo que se marcó la vez anterior, para escribir los de hoy sabiendo de
              dónde se viene. Es una copia visual: no se arrastra a la nueva ficha. */}
          {esRevaloracion && (anterior?.objetivos||[]).length>0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:4}}>Se marcó entonces</div>
              {(anterior.objetivos||[]).map((o:string,i:number)=>(
                <div key={i} style={{fontSize:10,color:'var(--grl)',padding:'3px 8px',background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:5,marginBottom:3}}>{o}</div>
              ))}
            </div>
          )}
          <div className="field"><label>Objetivo 1</label><input className="input" value={form.objetivo1} onChange={e=>up('objetivo1',e.target.value)} placeholder="ej. Reducir dolor de espalda"/></div>
          <div className="field"><label>Objetivo 2</label><input className="input" value={form.objetivo2} onChange={e=>up('objetivo2',e.target.value)} placeholder="ej. Ganar fuerza"/></div>
          <div className="field"><label>Objetivo 3</label><input className="input" value={form.objetivo3} onChange={e=>up('objetivo3',e.target.value)} placeholder="ej. Perder peso"/></div>
          <div className="field"><label>Si pudiera concederle un deseo ¿cuál sería?</label><textarea className="input" style={{minHeight:60}} value={form.deseo} onChange={e=>up('deseo',e.target.value)} placeholder="ej. Poder jugar con mis hijos sin dolor..."/></div>
        </div>
        <div className="card">
          <div className="card-title">Escalas</div>
          <EscalaSlider label="Borg · bienestar general" valor={form.borg} onCambio={v=>up('borg',v)}
            izquierda="0 Mal" derecha="10 Perfecto"/>
          <EscalaSlider label="Nivel de estrés" valor={form.estres} onCambio={v=>up('estres',v)} color="var(--red)"
            izquierda="0 Sin estrés" derecha="10 Máximo"/>
          {esRevaloracion && anterior && (anterior.borg!=null||anterior.estres!=null) && (
            <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
              En la valoración anterior: bienestar {textoEscala(anterior.borg)} · estrés {textoEscala(anterior.estres)}
            </div>
          )}
        </div>
      </div>
      {!esRevaloracion && (<div className="g2">
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="deporte"/> ¿Practica algún deporte?</span></div>
          <div style={{display:'flex',gap:8,marginBottom:form.hace_deporte?10:0}}>
            {([['No',false],['Sí',true]] as const).map(([l,v])=>(
              <span key={String(l)} onClick={()=>up('hace_deporte',v)} style={{flex:1,padding:'8px',borderRadius:6,border:`1.5px solid ${form.hace_deporte===v?'var(--g)':'var(--bd)'}`,background:form.hace_deporte===v?'var(--gl)':'var(--w)',color:form.hace_deporte===v?'var(--gd)':'var(--gr)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:form.hace_deporte===v?500:300}}>{l}</span>
            ))}
          </div>
          {form.hace_deporte===true&&(
            <>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:6}}>Selecciona los deportes que practica</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {deportesOpts.map((d:string)=>{
                  const sel=form.deportes.includes(d)
                  return <span key={d} onClick={()=>up('deportes',sel?form.deportes.filter((x:string)=>x!==d):[...form.deportes,d])} style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'var(--w)',color:sel?'#fff':'var(--gr)',cursor:'pointer'}}>{d}</span>
                })}
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="plantillas"/> ¿Usa plantillas?</span></div>
          <div style={{display:'flex',gap:8,marginBottom:form.plantillas?10:0}}>
            {([['No',false],['Sí',true]] as const).map(([l,v])=>(
              <span key={String(l)} onClick={()=>up('plantillas',v)} style={{flex:1,padding:'8px',borderRadius:6,border:`1.5px solid ${form.plantillas===v?'var(--g)':'var(--bd)'}`,background:form.plantillas===v?'var(--gl)':'var(--w)',color:form.plantillas===v?'var(--gd)':'var(--gr)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:form.plantillas===v?500:300}}>{l}</span>
            ))}
          </div>
          {form.plantillas===true&&(
            <div className="g2">
              <div className="field"><label>Pie izquierdo</label>
                <select className="input" value={form.plantilla_izq||''} onChange={e=>up('plantilla_izq',e.target.value)}>
                  <option value="">—</option>
                  {tiposPlantilla.map((t:string)=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>Pie derecho</label>
                <select className="input" value={form.plantilla_der||''} onChange={e=>up('plantilla_der',e.target.value)}>
                  <option value="">—</option>
                  {tiposPlantilla.map((t:string)=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>)}
    </div>
  )
}
