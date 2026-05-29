'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TimelineTab({ pacienteId }: { pacienteId: string }) {
  const [eventos, setEventos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [modalNota, setModalNota] = useState(false)
  const [nuevaNota, setNuevaNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [pacienteId])

  async function cargar() {
    setLoading(true)
    const [{ data: vals }, { data: notas }, { data: escalas }] = await Promise.all([
      supabase.from('valoraciones').select('*').eq('paciente_id', pacienteId).order('fecha', {ascending: false}),
      supabase.from('notas').select('*').eq('paciente_id', pacienteId).order('fecha', {ascending: false}),
      supabase.from('escalas').select('*').eq('paciente_id', pacienteId).order('fecha', {ascending: false}).limit(20),
    ])

    const evs: any[] = []

    ;(vals||[]).forEach((v, idx) => {
      const eg = v.estado_general ? JSON.parse(v.estado_general) : {}
      evs.push({
        id: 'val_'+v.id,
        tipo: idx===(vals!.length-1)?'valoracion_inicial':'revaloracion',
        fecha: v.fecha,
        datos: { ...v, ...eg }
      })
    })

    ;(notas||[]).forEach(n => {
      evs.push({ id: 'nota_'+n.id, tipo: 'nota', fecha: n.fecha || n.created_at?.split('T')[0], datos: n })
    })

    ;(escalas||[]).forEach(e => {
      evs.push({ id: 'escala_'+e.id, tipo: 'escala', fecha: e.fecha, datos: e })
    })

    evs.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    setEventos(evs)
    setLoading(false)
  }

  async function guardarNota() {
    if (!nuevaNota.trim()) return
    setGuardando(true)
    await supabase.from('notas').insert({ paciente_id: pacienteId, texto: nuevaNota, tipo: 'clinica', fecha: new Date().toISOString().split('T')[0], visible_agenda: false })
    setNuevaNota(''); setModalNota(false); setGuardando(false); cargar()
  }

  function toggle(id: string) {
    setExpandidos(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function formatFecha(f: string) {
    if (!f) return '—'
    return new Date(f+'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'long', year:'numeric'})
  }

  if (loading) return <div className="loading">Cargando historial...</div>

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button className="btn btn-p btn-sm" onClick={()=>setModalNota(true)}>+ Añadir nota</button>
      </div>

      {eventos.length===0 && (
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin historial aún.</div>
      )}

      <div style={{position:'relative',paddingLeft:24}}>
        <div style={{position:'absolute',left:8,top:0,bottom:0,width:2,background:'var(--bm)',borderRadius:2}}/>

        {eventos.map(ev => {
          const exp = expandidos.has(ev.id)
          const iconos: Record<string,string> = { valoracion_inicial:'📋', revaloracion:'🔄', nota:'📝', escala:'📊' }
          const colores: Record<string,string> = { valoracion_inicial:'var(--g)', revaloracion:'var(--g)', nota:'var(--amb)', escala:'#6B7FC4' }

          return (
            <div key={ev.id} style={{position:'relative',marginBottom:12}}>
              <div style={{position:'absolute',left:-20,top:10,width:12,height:12,borderRadius:'50%',background:colores[ev.tipo]||'var(--bd)',border:'2px solid var(--w)',zIndex:1}}/>
              <div style={{background:'var(--w)',border:`1px solid ${exp?colores[ev.tipo]:'var(--bd)'}`,borderRadius:'var(--rl)',overflow:'hidden'}}>
                <div onClick={()=>toggle(ev.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',cursor:'pointer'}}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--bl)'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <span style={{fontSize:14}}>{iconos[ev.tipo]||'•'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>
                      {ev.tipo==='valoracion_inicial'&&'Valoración inicial'}
                      {ev.tipo==='revaloracion'&&'Revaloración'}
                      {ev.tipo==='nota'&&(ev.datos.texto?.slice(0,60)+(ev.datos.texto?.length>60?'...':''))}
                      {ev.tipo==='escala'&&`Escala · Borg ${ev.datos.borg}/10 · Estrés ${ev.datos.estres}/10`}
                    </div>
                    <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{formatFecha(ev.fecha)}</div>
                  </div>
                  <span style={{fontSize:10,color:'var(--grl)'}}>{exp?'▲':'▼'}</span>
                </div>

                {exp && (
                  <div style={{padding:'0 12px 12px',borderTop:'1px solid var(--bl)'}}>
                    {(ev.tipo==='valoracion_inicial'||ev.tipo==='revaloracion') && (
                      <div style={{paddingTop:10}}>
                        {ev.datos.anamnesis&&<div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>Anamnesis</div><div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{ev.datos.anamnesis}</div>{ev.datos.trabajo&&<div style={{marginTop:4,fontSize:9,color:'var(--grl)'}}>💼 {ev.datos.trabajo}{ev.datos.tipo_jornada&&' · '+ev.datos.tipo_jornada}</div>}{ev.datos.hace_deporte&&ev.datos.deportes?.length>0&&<div style={{marginTop:2,fontSize:9,color:'var(--grl)'}}>🏃 {ev.datos.deportes.join(', ')}</div>}</div>}
                        {ev.datos.objetivos?.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>Objetivos</div>{ev.datos.objetivos.map((o:string,i:number)=><div key={i} style={{display:'flex',gap:6,padding:'3px 7px',background:'var(--gl)',borderRadius:4,marginBottom:2,fontSize:10}}><span style={{color:'var(--g)',fontWeight:600}}>{i+1}.</span>{o}</div>)}{ev.datos.deseo&&<div style={{marginTop:5,padding:'5px 8px',background:'var(--ambl)',borderRadius:4,fontSize:9,color:'#7A5800'}}>⭐ {ev.datos.deseo}</div>}</div>}
                        {ev.datos.notas_plan&&<div style={{marginBottom:10}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>Plan</div><div style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{ev.datos.notas_plan}</div></div>}
                        <div style={{display:'flex',gap:12,fontSize:9,color:'var(--grl)'}}><span>Borg: {ev.datos.borg}/10</span><span>Estrés: {ev.datos.estres}/10</span></div>
                      </div>
                    )}
                    {ev.tipo==='nota'&&<div style={{paddingTop:10,fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.6,whiteSpace:'pre-line'}}>{ev.datos.texto}</div>}
                    {ev.tipo==='escala'&&<div style={{paddingTop:10,display:'flex',gap:20}}><div><div style={{fontSize:9,color:'var(--grl)',marginBottom:3}}>Bienestar</div><div style={{fontSize:20,fontWeight:300,color:'var(--g)'}}>{ev.datos.borg}<span style={{fontSize:10}}>/10</span></div></div><div><div style={{fontSize:9,color:'var(--grl)',marginBottom:3}}>Estrés</div><div style={{fontSize:20,fontWeight:300,color:'var(--red)'}}>{ev.datos.estres}<span style={{fontSize:10}}>/10</span></div></div></div>}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modalNota&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNota(false)}}>
          <div className="modal">
            <div className="modal-title">Nueva nota clínica<button className="modal-close" onClick={()=>setModalNota(false)}>✕</button></div>
            <div className="field"><label>Nota *</label><textarea className="input" style={{minHeight:100}} value={nuevaNota} onChange={e=>setNuevaNota(e.target.value)} autoFocus placeholder="ej. El paciente comenta mejoría en la zona lumbar..."/></div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalNota(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarNota} disabled={guardando}>{guardando?'⏳':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
