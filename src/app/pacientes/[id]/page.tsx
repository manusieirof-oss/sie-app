'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import FichaTab from './components/FichaTab'
import { useParams, useRouter } from 'next/navigation'

function EntrenoTab({ pacienteId, sesiones, supabase, onRefresh }: { pacienteId: string, sesiones: any[], supabase: any, onRefresh: () => void }) {
  const [seccion, setSeccion] = useState<'activo'|'sesiones'|'historial'>('activo')
  const [citasFuturas, setCitasFuturas] = useState<any[]>([])
  const [sesionesDisp, setSesionesDisp] = useState<any[]>([])
  const [sesionesHistorial, setSesionesHistorial] = useState<any[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [sesionAsignar, setSesionAsignar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [modalSesion, setModalSesion] = useState(false)
  const [editandoSesion, setEditandoSesion] = useState<any>(null)
  const [formSesion, setFormSesion] = useState({ nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:''},{nombre:'Parte principal',ejercicios:''},{nombre:'Vuelta a la calma',ejercicios:''}] })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from('citas').select('*, sesiones:sesion_id(id,nombre,partes)').eq('paciente_id', pacienteId).gte('fecha', hoy).neq('estado','cancelada').order('fecha').order('hora'),
      supabase.from('sesiones').select('id,nombre,descripcion,created_at').eq('paciente_id', pacienteId).order('created_at',{ascending:false}),
    ])
    const todasCitas = c||[]
    const todasSesiones = s||[]
    
    // Citas con sesión asignada = plan activo
    setCitasFuturas(todasCitas)
    
    // Sesiones sin cita asignada = pendientes
    setSesionesDisp(todasSesiones)
    
    // Historial: citas pasadas con sesión
    const { data: hist } = await supabase.from('citas').select('*, sesiones:sesion_id(id,nombre)').eq('paciente_id', pacienteId).lt('fecha', hoy).order('fecha',{ascending:false}).limit(30)
    setSesionesHistorial(hist||[])
  }

  async function asignarEnBloque() {
    if (!sesionAsignar || seleccionadas.length===0) { alert('Selecciona citas y una sesión'); return }
    setGuardando(true)
    for (const citaId of seleccionadas) {
      await supabase.from('citas').update({ sesion_id: sesionAsignar }).eq('id', citaId)
    }
    setSeleccionadas([]); setSesionAsignar(''); setGuardando(false)
    cargarDatos(); onRefresh()
  }

  function toggleCita(id: string) {
    setSeleccionadas(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }

  async function guardarSesion() {
    if (!formSesion.nombre) { alert('Escribe un nombre'); return }
    setGuardando(true)
    const partes = formSesion.partes.map(p=>({nombre:p.nombre, ejercicios:p.ejercicios.split('\n').filter(Boolean)}))
    if (editandoSesion) {
      await supabase.from('sesiones').update({ nombre:formSesion.nombre, descripcion:formSesion.descripcion, partes }).eq('id',editandoSesion.id)
    } else {
      await supabase.from('sesiones').insert({ paciente_id:pacienteId, nombre:formSesion.nombre, descripcion:formSesion.descripcion, partes, estado:'lista' })
    }
    setModalSesion(false); setEditandoSesion(null)
    setFormSesion({ nombre:'', descripcion:'', partes:[{nombre:'Calentamiento',ejercicios:''},{nombre:'Parte principal',ejercicios:''},{nombre:'Vuelta a la calma',ejercicios:''}] })
    setGuardando(false); cargarDatos()
  }

  async function duplicarSesion(s: any) {
    await supabase.from('sesiones').insert({ paciente_id:pacienteId, nombre:s.nombre+' (copia)', descripcion:s.descripcion, partes:s.partes||[], estado:'lista' })
    cargarDatos()
  }

  async function eliminarSesion(id: string) {
    if (!confirm('¿Eliminar esta sesión?')) return
    await supabase.from('sesiones').delete().eq('id',id)
    cargarDatos()
  }

  function abrirEditarSesion(s: any) {
    setEditandoSesion(s)
    setFormSesion({
      nombre: s.nombre||'',
      descripcion: s.descripcion||'',
      partes: (s.partes||[{nombre:'Calentamiento',ejercicios:[]},{nombre:'Parte principal',ejercicios:[]},{nombre:'Vuelta a la calma',ejercicios:[]}]).map((p:any)=>({nombre:p.nombre, ejercicios:Array.isArray(p.ejercicios)?p.ejercicios.join('\n'):p.ejercicios||''}))
    })
    setModalSesion(true)
  }

  const citasConSesion = citasFuturas.filter(c=>c.sesiones)
  const citasSinSesion = citasFuturas.filter(c=>!c.sesiones)

  return (
    <div>
      {/* SECCIONES */}
      <div style={{display:'flex',gap:4,marginBottom:12,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3}}>
        {([['activo','📋 Plan activo',citasFuturas.length],['sesiones','📋 Sesiones',sesionesDisp.length],['historial','📂 Historial',sesionesHistorial.length]] as const).map(([k,l,n])=>(
          <button key={k} onClick={()=>setSeccion(k)}
            style={{flex:1,fontSize:10,padding:'6px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:seccion===k?'var(--w)':'transparent',color:seccion===k?'var(--n)':'var(--grl)',fontWeight:seccion===k?500:300,boxShadow:seccion===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
            {l} <span style={{fontSize:9,padding:'1px 6px',borderRadius:99,background:seccion===k?'var(--g)':'var(--bm)',color:seccion===k?'#fff':'var(--grl)'}}>{n}</span>
          </button>
        ))}
      </div>

      {/* PLAN ACTIVO */}
      {seccion==='activo' && (
        <div>
          {/* BARRA PROGRESO */}
          {(()=>{
            const total = citasFuturas.length
            const conSes = citasFuturas.filter(c=>c.sesiones).length
            const pct = total>0?Math.round((conSes/total)*100):0
            return total>0?(
              <div style={{marginBottom:10,padding:'8px 12px',background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontSize:10,color:'var(--n)'}}>Sesiones asignadas</span>
                  <span style={{fontSize:10,fontWeight:500,color:'var(--g)'}}>{conSes}/{total} · {pct}%</span>
                </div>
                <div style={{height:6,background:'var(--bm)',borderRadius:99,overflow:'hidden'}}>
                  <div style={{height:'100%',background:'var(--g)',borderRadius:99,width:pct+'%',transition:'width .3s'}}/>
                </div>
              </div>
            ):null
          })()}
          {seleccionadas.length>0 && (
            <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:'var(--rl)',padding:'10px 13px',marginBottom:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span style={{fontSize:11,color:'var(--n)'}}>{seleccionadas.length} citas seleccionadas</span>
              <select className="input" style={{flex:1,minWidth:200}} value={sesionAsignar} onChange={e=>setSesionAsignar(e.target.value)}>
                <option value="">Seleccionar sesión pendiente...</option>
                {sesionesDisp.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <button className="btn btn-p btn-sm" onClick={asignarEnBloque} disabled={guardando}>{guardando?'⏳':'✓ Asignar'}</button>
              <button className="btn btn-d btn-sm" onClick={()=>setSeleccionadas([])}>✕</button>
            </div>
          )}
          <div style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
            {citasFuturas.length===0 && <div style={{padding:20,textAlign:'center',fontSize:11,color:'var(--grl)'}}>Sin citas futuras programadas</div>}
            {citasFuturas.map((c,i)=>{
              const sel = seleccionadas.includes(c.id)
              const tieneSesion = !!c.sesiones
              const fecha = new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})
              return (
                <div key={c.id} onClick={()=>toggleCita(c.id)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<citasFuturas.length-1?'1px solid var(--bl)':'none',cursor:'pointer',background:sel?'var(--gl)':'var(--w)'}}
                  onMouseOver={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='rgba(90,150,158,.04)'}}
                  onMouseOut={e=>{if(!sel)(e.currentTarget as HTMLElement).style.background='var(--w)'}}>
                  <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {sel&&<span style={{fontSize:10,color:'#fff',fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{fecha} · {c.hora?.slice(0,5)} · Sala {c.sala}</div>
                    {tieneSesion ? (
                      <div style={{display:'flex',alignItems:'center',gap:5,marginTop:1}}>
                        <span style={{fontSize:9,color:'var(--g)'}}>📋 {c.sesiones.nombre}</span>
                        <button onClick={e=>{e.stopPropagation();supabase.from('citas').update({sesion_id:null}).eq('id',c.id).then(()=>cargarDatos())}}
                          style={{fontSize:8,color:'var(--grl)',background:'none',border:'none',cursor:'pointer',padding:'0 3px'}}>✕</button>
                      </div>
                    ) : (
                      <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Sin sesión asignada</div>
                    )}
                  </div>
                  <div style={{width:8,height:8,borderRadius:'50%',background:tieneSesion?'var(--g)':'var(--bm)',flexShrink:0}}/>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SESIONES */}
      {seccion==='sesiones' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button className="btn btn-p btn-sm" onClick={()=>{setEditandoSesion(null);setFormSesion({nombre:'',descripcion:'',partes:[{nombre:'Calentamiento',ejercicios:''},{nombre:'Parte principal',ejercicios:''},{nombre:'Vuelta a la calma',ejercicios:''}]});setModalSesion(true)}}>+ Nueva sesión</button>
          </div>
          {sesionesDisp.length===0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>No hay sesiones creadas. Crea la primera.</div>
          ) : sesionesDisp.map(s=>{
            const citasAsignadas = citasFuturas.filter(c=>c.sesion_id===s.id)
            const asignada = citasAsignadas.length>0
            return (
              <div key={s.id} className="card">
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{s.nombre}</div>
                    {s.descripcion&&<div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{s.descripcion}</div>}
                  </div>
                  <span style={{fontSize:8,padding:'2px 8px',borderRadius:99,background:asignada?'var(--gl)':'var(--ambl)',color:asignada?'var(--gd)':'#7A5800',fontWeight:500,whiteSpace:'nowrap'}}>
                    {asignada?`✓ ${citasAsignadas.length} cita${citasAsignadas.length>1?'s':''} asignada${citasAsignadas.length>1?'s':''}`:' Sin asignar'}
                  </span>
                </div>
                {/* PARTES */}
                {(s.partes||[]).slice(0,2).map((p:any,pi:number)=>(
                  <div key={pi} style={{fontSize:9,color:'var(--grl)',marginBottom:2}}>
                    <span style={{fontWeight:500,color:'var(--gr)'}}>{p.nombre}:</span> {(p.ejercicios||[]).slice(0,2).join(' · ')}{(p.ejercicios||[]).length>2?` +${(p.ejercicios||[]).length-2} más`:''}
                  </div>
                ))}
                <div style={{display:'flex',gap:5,marginTop:8}}>
                  <button className="btn btn-s btn-sm" onClick={()=>abrirEditarSesion(s)}>✏️ Editar</button>
                  <button className="btn btn-t btn-sm" onClick={()=>duplicarSesion(s)}>⧉ Duplicar</button>
                  <button className="btn btn-d btn-sm" onClick={()=>eliminarSesion(s.id)}>🗑</button>
                </div>
              </div>
            )
          })}

          {/* MODAL SESION */}
          {modalSesion&&(
            <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSesion(false)}}>
              <div className="modal" style={{width:500}}>
                <div className="modal-title">{editandoSesion?'Editar sesión':'Nueva sesión'}<button className="modal-close" onClick={()=>setModalSesion(false)}>✕</button></div>
                <div className="field"><label>Nombre *</label><input className="input" value={formSesion.nombre} onChange={e=>setFormSesion(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
                <div className="field"><label>Descripción / objetivo</label><input className="input" value={formSesion.descripcion} onChange={e=>setFormSesion(p=>({...p,descripcion:e.target.value}))} placeholder="ej. Fuerza tren inferior sin impacto"/></div>
                {formSesion.partes.map((parte,pi)=>(
                  <div key={pi} style={{marginBottom:8,border:'1px solid var(--bd)',borderRadius:'var(--rl)',overflow:'hidden'}}>
                    <div style={{display:'flex',alignItems:'center',padding:'7px 10px',background:'var(--bl)',borderBottom:'1px solid var(--bd)'}}>
                      <input style={{flex:1,fontSize:10,fontWeight:500,color:'var(--n)',background:'transparent',border:'none',outline:'none',fontFamily:'system-ui'}}
                        value={parte.nombre} onChange={e=>setFormSesion(prev=>{const p=[...prev.partes];p[pi]={...p[pi],nombre:e.target.value};return{...prev,partes:p}})}/>
                      {formSesion.partes.length>1&&<button onClick={()=>setFormSesion(prev=>({...prev,partes:prev.partes.filter((_,i)=>i!==pi)}))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>}
                    </div>
                    <div style={{padding:8}}>
                      <textarea className="input" style={{minHeight:80,fontSize:11}} value={parte.ejercicios}
                        placeholder="Escribe los ejercicios uno por línea&#10;ej: Sentadilla búlgara · 4x10 · 20kg&#10;Puente glúteo · 3x30seg"
                        onChange={e=>setFormSesion(prev=>{const p=[...prev.partes];p[pi]={...p[pi],ejercicios:e.target.value};return{...prev,partes:p}})}/>
                    </div>
                  </div>
                ))}
                <button className="btn btn-t btn-sm" onClick={()=>setFormSesion(prev=>({...prev,partes:[...prev.partes,{nombre:'Nueva parte',ejercicios:''}]}))}>+ Añadir parte</button>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="btn btn-d btn-sm" onClick={()=>setModalSesion(false)}>Cancelar</button>
                  <div style={{flex:1}}/>
                  <button className="btn btn-p" onClick={guardarSesion} disabled={guardando}>{guardando?'⏳ Guardando...':'💾 Guardar sesión'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {seccion==='historial' && (
        <div>
          {sesionesHistorial.length===0 ? (
            <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin historial aún</div>
          ) : sesionesHistorial.map((c,i)=>{
            const badgeColor = c.estado==='realizada'?{bg:'var(--gl)',color:'var(--gd)',txt:'✓ Realizada'}:c.estado==='cancelada'?{bg:'var(--bm)',color:'var(--gr)',txt:'Cancelada'}:{bg:'var(--redl)',color:'var(--red)',txt:'Falta'}
            return (
              <div key={c.id} className="card">
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    {c.sesiones?.nombre && <div style={{fontSize:11,fontWeight:400,color:'var(--n)',marginBottom:2}}>📋 {c.sesiones.nombre}</div>}
                    <div style={{fontSize:9,color:'var(--grl)'}}>
                      {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short',year:'numeric'})} · {c.hora?.slice(0,5)} · Sala {c.sala}
                    </div>
                  </div>
                  <span style={{fontSize:8,padding:'2px 8px',borderRadius:99,background:badgeColor.bg,color:badgeColor.color,fontWeight:500}}>{badgeColor.txt}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FichaPacientePage() {
  const { id } = useParams()
  const router = useRouter()
  const [tab, setTab] = useState('ficha')
  const [pac, setPac] = useState<any>(null)
  const [bono, setBono] = useState<any>(null)
  const [molestias, setMolestias] = useState<any[]>([])
  const [patologias, setPatologias] = useState<any[]>([])
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [escalas, setEscalas] = useState<any[]>([])
  const [tests, setTests] = useState<any[]>([])
  const [recuperaciones, setRecuperaciones] = useState<any[]>([])
  const [testsDisp, setTestsDisp] = useState<any[]>([])
  const [citas, setCitas] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [modalBono, setModalBono] = useState(false)
  const [modalPausa, setModalPausa] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ tipo:'esencial', estado_pago:'pendiente' })
  const [pausa, setPausa] = useState({ desde: new Date().toISOString().split('T')[0], hasta: '' })
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [modalRegistrarTest, setModalRegistrarTest] = useState(false)
  const [testSeleccionado, setTestSeleccionado] = useState('')
  const [resultadoTest, setResultadoTest] = useState('positivo')
  const [obsTest, setObsTest] = useState('')
  const [fechaRevTest, setFechaRevTest] = useState('')
  const [itemsTest, setItemsTest] = useState<{nombre:string,tiene_grados:boolean,marcado:boolean,grados:string}[]>([])
  const [ladoTest, setLadoTest] = useState('bilateral')
  const [testSeleccionadoObj, setTestSeleccionadoObj] = useState<any>(null)
  const [procesando, setProcesando] = useState(false)

  const resultadosRef = useRef<HTMLDivElement>(null)

  function generarPDF() {
    if (!pac) return
    const realizadas = citas.filter((c:any)=>c.estado==='realizada').length
    const faltas = citas.filter((c:any)=>c.estado==='falta').length
    const canceladas = citas.filter((c:any)=>c.estado==='cancelada').length
    const recuperadas = recuperaciones.filter((r:any)=>r.estado==='recuperada').length
    const total = realizadas + faltas
    const pct = total>0 ? Math.round((realizadas/total)*100) : 0
    const fecha = new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})

    // DONUT SVG
    const radio = 15.9
    const circunferencia = 2 * Math.PI * radio
    const dashR = total>0 ? (realizadas/total)*100 : 0
    const dashF = total>0 ? (faltas/total)*100 : 0
    const donutSVG = `<svg viewBox="0 0 36 36" width="120" height="120" style="transform:rotate(-90deg)">
      <circle cx="18" cy="18" r="${radio}" fill="none" stroke="#EBF4F5" stroke-width="3"/>
      <circle cx="18" cy="18" r="${radio}" fill="none" stroke="#5A969E" stroke-width="3"
        stroke-dasharray="${dashR} ${100-dashR}" stroke-linecap="round"/>
      ${faltas>0?`<circle cx="18" cy="18" r="${radio}" fill="none" stroke="#B05A5A" stroke-width="3"
        stroke-dasharray="${dashF} ${100-dashF}" stroke-dashoffset="${-dashR}" stroke-linecap="round"/>`:''}
    </svg>`

    // BARRAS POR MES
    const mesesMap: Record<string,{r:number,f:number}> = {}
    citas.forEach((c:any)=>{
      const m = c.fecha?.slice(0,7); if(!m) return
      if(!mesesMap[m]) mesesMap[m]={r:0,f:0}
      if(c.estado==='realizada') mesesMap[m].r++
      if(c.estado==='falta') mesesMap[m].f++
    })
    const meses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
    const maxM = Math.max(...meses.map(([,v])=>v.r+v.f),1)
    const barWidth = 40
    const barGap = 10
    const svgW = meses.length*(barWidth+barGap)
    const barrasSVG = meses.length>0 ? `<svg width="${svgW}" height="100" viewBox="0 0 ${svgW} 100">
      ${meses.map(([mes,datos],i)=>{
        const x = i*(barWidth+barGap)
        const hR = Math.round((datos.r/maxM)*70)
        const hF = Math.round((datos.f/maxM)*70)
        const [,m] = mes.split('-')
        const nm = new Date(2024,parseInt(m)-1,1).toLocaleDateString('es-ES',{month:'short'})
        return `<rect x="${x+5}" y="${90-hR}" width="${barWidth-10}" height="${hR}" fill="#5A969E" rx="2"/>
        ${datos.f>0?`<rect x="${x+5}" y="${90-hR-hF}" width="${barWidth-10}" height="${hF}" fill="#B05A5A" rx="2" opacity="0.7"/>`:''}
        <text x="${x+barWidth/2}" y="98" text-anchor="middle" font-size="8" fill="#888">${nm}</text>
        <text x="${x+barWidth/2}" y="${85-hR-hF-2}" text-anchor="middle" font-size="7" fill="#444">${datos.r+datos.f>0?Math.round((datos.r/(datos.r+datos.f))*100)+'%':''}</text>`
      }).join('')}
    </svg>` : '<p style="color:#888;font-size:11px">Sin datos de meses</p>'

    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#262825;padding:30px;max-width:700px;margin:0 auto}
      h1{font-size:22px;font-weight:300;margin-bottom:4px}
      h2{font-size:11px;font-weight:700;color:#5A969E;margin:24px 0 10px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #EBF4F5;padding-bottom:6px}
      .meta{font-size:11px;color:#888;margin-bottom:24px}
      .row{display:flex;gap:20px;align-items:center;margin-bottom:16px}
      .donut-wrap{position:relative;width:120px;height:120px;flex-shrink:0}
      .donut-label{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
      .donut-pct{font-size:20px;font-weight:300;color:#262825}
      .donut-sub{font-size:8px;color:#888}
      .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1}
      .card{background:#f5f3ef;border-radius:6px;padding:10px;text-align:center}
      .val{font-size:22px;font-weight:300}
      .lbl{font-size:8px;color:#888;margin-top:2px}
      .test{padding:8px 12px;background:#f5f3ef;border-radius:5px;margin-bottom:5px}
      .tn{font-size:12px;font-weight:500;margin-bottom:3px}
      .td{font-size:10px;color:#666}
      .pos{color:#B05A5A;font-weight:600} .neg{color:#5A969E;font-weight:600}
      .legend{display:flex;gap:16px;margin-top:8px}
      .leg-item{display:flex;align-items:center;gap:4px;font-size:9px;color:#888}
      .leg-dot{width:8px;height:8px;border-radius:50%}
      .footer{margin-top:30px;font-size:9px;color:#bbb;border-top:1px solid #eee;padding-top:10px;text-align:center}
      @media print{body{padding:15px}}
    </style></head><body>
    <h1>${pac.nombre} ${pac.apellidos}${pac.nombre_clinica?' ('+pac.nombre_clinica+')':''}</h1>
    <div class="meta">
      ${pac.fecha_nacimiento?Math.floor((Date.now()-new Date(pac.fecha_nacimiento).getTime())/(1000*60*60*24*365.25))+' años · ':''}
      ${pac.tipo_clase||''} · Informe generado el ${fecha}
    </div>

    <h2>Asistencia global</h2>
    <div class="row">
      <div class="donut-wrap">
        ${donutSVG}
        <div class="donut-label"><div class="donut-pct">${pct}%</div><div class="donut-sub">asistencia</div></div>
      </div>
      <div class="grid4">
        <div class="card"><div class="val" style="color:#5A969E">${realizadas}</div><div class="lbl">Realizadas</div></div>
        <div class="card"><div class="val" style="color:#B05A5A">${faltas}</div><div class="lbl">Faltas</div></div>
        <div class="card"><div class="val" style="color:#888">${canceladas}</div><div class="lbl">Canceladas</div></div>
        <div class="card"><div class="val" style="color:#C9A84C">${recuperadas}</div><div class="lbl">Recuperadas</div></div>
      </div>
    </div>

    <h2>Asistencia por mes</h2>
    ${barrasSVG}
    <div class="legend">
      <div class="leg-item"><div class="leg-dot" style="background:#5A969E"></div>Realizadas</div>
      <div class="leg-item"><div class="leg-dot" style="background:#B05A5A;opacity:.7"></div>Faltas</div>
    </div>

    ${pac.peso_kg||pac.altura_cm ? `<h2>Datos físicos</h2>
    <div class="grid4" style="max-width:300px">
      ${pac.peso_kg?`<div class="card"><div class="val">${pac.peso_kg}</div><div class="lbl">Peso (kg)</div></div>`:''}
      ${pac.altura_cm?`<div class="card"><div class="val">${pac.altura_cm}</div><div class="lbl">Altura (cm)</div></div>`:''}
      ${pac.peso_kg&&pac.altura_cm?`<div class="card"><div class="val">${Math.round(pac.peso_kg/Math.pow(pac.altura_cm/100,2)*10)/10}</div><div class="lbl">IMC</div></div>`:''}
    </div>` : ''}

    ${tests.length>0 ? `<h2>Tests funcionales</h2>
    ${tests.map((t:any)=>`<div class="test">
      <div class="tn">${t.tests?.nombre||'Test'}${t.lado&&t.lado!=='bilateral'?' · <span style="font-weight:300;color:#888">'+t.lado+'</span>':''}</div>
      <div class="td">
        <span class="${t.resultado==='positivo'?'pos':'neg'}">${t.resultado==='positivo'?'+ Positivo':'− Negativo'}</span>
        &nbsp;·&nbsp;${new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
        ${(t.items_resultado||[]).filter((i:any)=>i.marcado).map((i:any)=>
          `<br>☑ ${i.nombre}${i.grados?' · <strong>'+i.grados+'°</strong>':''}`
        ).join('')}
      </div>
    </div>`).join('')}` : ''}

    ${escalas.length>0 ? `<h2>Últimas escalas</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:#f5f3ef"><th style="padding:6px 10px;text-align:left">Fecha</th><th style="padding:6px 10px">Borg</th><th style="padding:6px 10px">Estrés</th></tr>
      ${[...escalas].slice(0,5).map((e:any)=>`<tr style="border-bottom:1px solid #f0ede8">
        <td style="padding:5px 10px">${new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td style="padding:5px 10px;text-align:center">${e.borg}/10</td>
        <td style="padding:5px 10px;text-align:center">${e.estres}/10</td>
      </tr>`).join('')}
    </table>` : ''}

    <div class="footer">SIE · Gestión Clínica · ${fecha}</div>
    </body></html>`

    const ventana = window.open('', '_blank')
    if (ventana) {
      ventana.document.write(html)
      ventana.document.close()
      setTimeout(()=>ventana.print(), 500)
    }
  }

  const mes = new Date().getMonth()+1
  const anio = new Date().getFullYear()

  useEffect(() => { if(id) cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: p },{ data: b },{ data: m },{ data: pat },{ data: med },{ data: esc },{ data: _rt },{ data: c },{ data: s }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id',id).single(),
      supabase.from('bonos').select('*').eq('paciente_id',id).eq('activo',true).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('molestias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('patologias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('medicamentos').select('*').eq('paciente_id',id),
      supabase.from('escalas').select('*').eq('paciente_id',id).order('fecha',{ascending:false}).limit(5),
      supabase.from('resultados_tests').select('*, tests(nombre,descripcion)').eq('paciente_id',id).order('fecha',{ascending:false}),
      supabase.from('citas').select('id,fecha,hora,sala,tipo,estado,sesion_id,notas').eq('paciente_id',id).order('fecha',{ascending:false}).limit(50),
      supabase.from('sesiones').select('*').eq('paciente_id',id).order('created_at',{ascending:false}).limit(5),
    ])
    const [{ data: t }, { data: td }] = await Promise.all([
      supabase.from('resultados_tests').select('*, tests(nombre,descripcion)').eq('paciente_id',id).order('fecha',{ascending:false}),
      supabase.from('tests').select('*').order('nombre'),
    ])
    setPac(p); setBono(b); setMolestias(m||[]); setPatologias(pat||[])
    setMedicamentos(med||[]); setEscalas(esc||[]); setCitas(c||[]); setSesiones(s||[])
    setTests(t||[]); setTestsDisp(td||[])
    const { data: rec } = await supabase.from('recuperaciones').select('id,estado,fecha_falta,fecha_limite,cita_recuperacion_id').eq('paciente_id',id).order('fecha_falta',{ascending:false})
    setRecuperaciones(rec||[])
    setForm(p||{})
    setLoading(false)
  }

  async function guardarEdicion() {
    await supabase.from('pacientes').update({
      nombre:form.nombre, apellidos:form.apellidos, nombre_clinica:form.nombre_clinica||null, telefono:form.telefono,
      email:form.email, dni:form.dni, altura_cm:form.altura_cm,
      peso_kg:form.peso_kg, tipo_clase:form.tipo_clase, notas:form.notas
    }).eq('id',id)
    setEditando(false); cargar()
  }

  function seleccionarTest(testId: string) {
    setTestSeleccionado(testId)
    const t = testsDisp.find((t:any)=>t.id===testId)
    setTestSeleccionadoObj(t||null)
    if (t && t.items && t.items.length>0) {
      setItemsTest(t.items.map((item:any)=>({...item,marcado:false,grados:''})))
    } else {
      setItemsTest([])
    }
    // Calcular fecha de revisión automáticamente
    if (t && t.frecuencia_meses) {
      const hoy = new Date()
      hoy.setMonth(hoy.getMonth() + t.frecuencia_meses)
      setFechaRevTest(hoy.toISOString().split('T')[0])
    } else {
      setFechaRevTest('')
    }
  }

  function calcularResultado(): string {
    if (itemsTest.length===0) return resultadoTest
    const marcados = itemsTest.filter(i=>i.marcado).length
    if (testSeleccionadoObj?.logica==='todos') {
      return marcados===itemsTest.length?'positivo':'negativo'
    }
    return marcados>0?'positivo':'negativo'
  }

  async function registrarTest() {
    if (!testSeleccionado) { alert('Selecciona un test'); return }
    const resultado = itemsTest.length>0 ? calcularResultado() : resultadoTest
    await supabase.from('resultados_tests').insert({
      paciente_id: id,
      test_id: testSeleccionado,
      fecha: new Date().toISOString().split('T')[0],
      resultado,
      observaciones: obsTest,
      fecha_repeticion: fechaRevTest || null,
      lado: ladoTest,
      items_resultado: itemsTest.map(i=>({nombre:i.nombre,marcado:i.marcado,grados:i.grados,tiene_grados:i.tiene_grados})),
    })
    setModalRegistrarTest(false)
    setTestSeleccionado(''); setResultadoTest('positivo'); setObsTest(''); setFechaRevTest('')
    setItemsTest([]); setLadoTest('bilateral'); setTestSeleccionadoObj(null)
    cargar()
  }

  async function registrarTestAntiguo() {
    if (!testSeleccionado) { alert('Selecciona un test'); return }
    await supabase.from('resultados_tests').insert({
      paciente_id: id,
      test_id: testSeleccionado,
      fecha: new Date().toISOString().split('T')[0],
      resultado: resultadoTest,
      observaciones: obsTest,
      fecha_repeticion: fechaRevTest || null,
    })
    setModalRegistrarTest(false)
    setTestSeleccionado(''); setResultadoTest('positivo'); setObsTest(''); setFechaRevTest('')
    cargar()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoFoto(true)
    const ext = file.name.split('.').pop()
    const path = `${id}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) { alert('Error al subir foto: ' + error.message); setSubiendoFoto(false); return }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    await supabase.from('pacientes').update({ foto_url: publicUrl }).eq('id', id)
    setSubiendoFoto(false)
    cargar()
  }

  async function darDeBaja() {
    if (!confirm(`¿Dar de baja a ${pac.nombre} ${pac.apellidos}?\n\nSus datos se conservan pero se eliminarán TODAS sus citas futuras automáticamente.`)) return
    setProcesando(true)
    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('citas').delete().eq('paciente_id',id).gte('fecha',hoy).eq('estado','programada')
    await supabase.from('pacientes').update({ estado:'baja' }).eq('id',id)
    setProcesando(false)
    alert('✓ Paciente dado de baja. Sus citas futuras han sido eliminadas.')
    router.push('/pacientes')
  }

  async function aplicarPausa() {
    if (!pausa.hasta) { alert('Indica la fecha de vuelta'); return }
    if (pausa.hasta <= pausa.desde) { alert('La fecha de vuelta debe ser posterior a la de inicio'); return }
    setProcesando(true)
    const { data: citasPausa } = await supabase.from('citas').select('id').eq('paciente_id',id).gte('fecha',pausa.desde).lte('fecha',pausa.hasta).eq('estado','programada')
    if (citasPausa && citasPausa.length > 0) {
      await supabase.from('citas').update({ estado:'cancelada' }).eq('paciente_id',id).gte('fecha',pausa.desde).lte('fecha',pausa.hasta).eq('estado','programada')
    }
    await supabase.from('pacientes').update({ estado:'pausa', notas:(pac.notas||'')+`\n[PAUSA: ${pausa.desde} → ${pausa.hasta}]` }).eq('id',id)
    setProcesando(false)
    setModalPausa(false)
    alert(`✓ Pausa aplicada. ${citasPausa?.length||0} citas canceladas del ${pausa.desde} al ${pausa.hasta}.\nEl paciente se reactivará automáticamente al volver.`)
    cargar()
  }

  async function reactivar() {
    if (!confirm(`¿Reactivar a ${pac.nombre} ${pac.apellidos}?`)) return
    await supabase.from('pacientes').update({ estado:'activo' }).eq('id',id)
    alert('✓ Paciente reactivado. Recuerda crear sus nuevas citas en la agenda.')
    cargar()
  }

  async function eliminarPaciente() {
    if (!confirm(`¿Eliminar DEFINITIVAMENTE a ${pac.nombre} ${pac.apellidos}?\n\nEsta acción NO se puede deshacer. Se borrarán todos sus datos, citas y sesiones.`)) return
    if (!confirm('Segunda confirmación: ¿estás completamente seguro?')) return
    setProcesando(true)
    await supabase.from('pacientes').delete().eq('id',id)
    router.push('/pacientes')
  }

  async function toggleMolestia(molId: string, activa: boolean) {
    await supabase.from('molestias').update({ activa:!activa }).eq('id',molId); cargar()
  }

  async function crearBono() {
    if (bono) await supabase.from('bonos').update({ activo:false }).eq('id',bono.id)
    const diasMap: Record<string,number> = { esencial:2, progreso:3, avanzado:4, avanzado_mas1:5 }
    await supabase.from('bonos').insert({ paciente_id:id, tipo:nuevoBono.tipo, dias_semana:diasMap[nuevoBono.tipo], estado_pago:nuevoBono.estado_pago, mes, anio, fecha_inicio:new Date().toISOString().split('T')[0], activo:true })
    setModalBono(false); cargar()
  }

  async function cambiarPago(estado: string) {
    if (!bono) return
    await supabase.from('bonos').update({ estado_pago:estado }).eq('id',bono.id); cargar()
  }

  const edad = pac?.fecha_nacimiento ? Math.floor((Date.now()-new Date(pac.fecha_nacimiento).getTime())/(1000*60*60*24*365.25)) : null
  const iniciales = pac ? `${pac.nombre?.[0]||''}${pac.apellidos?.[0]||''}`.toUpperCase() : ''
  const bonoLabel: Record<string,string> = { esencial:'Esencial · 2d/sem', progreso:'Progreso · 3d/sem', avanzado:'Avanzado · 4d/sem', avanzado_mas1:'Avanzado +1 · 5d/sem' }
  const pagoBadge: Record<string,string> = { pagado:'badge-g', pendiente:'badge-pen', impago:'badge-imp' }
  const pagoLabel: Record<string,string> = { pagado:'✓ Pagado', pendiente:'⏳ Pendiente', impago:'⚠ Impago' }
  const estadoColor: Record<string,string> = { activo:'var(--g)', baja:'var(--red)', pausa:'var(--amb)' }
  const estadoLabel: Record<string,string> = { activo:'● Activo', baja:'○ Baja', pausa:'⏸ Pausa' }

  if (loading) return <div className="loading">Cargando ficha...</div>
  if (!pac) return <div className="loading">Paciente no encontrado</div>

  return (
    <>
      {/* CABECERA */}
      <div className="pat-header">
        <div style={{position:'relative',flexShrink:0}}>
          {pac.foto_url ? (
            <img src={pac.foto_url} alt={pac.nombre} style={{width:46,height:46,borderRadius:'50%',objectFit:'cover',border:'1.5px solid var(--g)'}}/>
          ) : (
            <div className="pat-avatar">{iniciales}</div>
          )}
          <label style={{position:'absolute',bottom:-4,right:-4,width:20,height:20,borderRadius:'50%',background:'var(--g)',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'2px solid var(--n)'}}>
            {subiendoFoto?'⏳':'📷'}
            <input type="file" accept="image/*" onChange={subirFoto} style={{display:'none'}}/>
          </label>
        </div>

        <div style={{flex:1}}>
          {editando ? (
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input className="input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Nombre"/>
              <input className="input" value={form.apellidos||''} onChange={e=>setForm((p:any)=>({...p,apellidos:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Apellidos"/>
              <input className="input" value={form.nombre_clinica||''} onChange={e=>setForm((p:any)=>({...p,nombre_clinica:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Nombre en clínica (ej. Manu)"/>
            </div>
          ) : (
            <>
              <div className="pat-name">{pac.nombre} {pac.apellidos}</div>
              {pac.nombre_clinica&&<div style={{fontSize:11,color:'var(--gm)',fontWeight:300,marginTop:1}}>"{pac.nombre_clinica}"</div>}
            </>
          )}
          <div className="pat-meta">{edad?`${edad} años · `:''}{pac.altura_cm?`${pac.altura_cm} cm · `:''}{pac.peso_kg?`${pac.peso_kg} kg`:''}</div>
          <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
            <span style={{fontSize:8,fontWeight:500,padding:'2px 8px',borderRadius:99,background:'rgba(255,255,255,.1)',color:estadoColor[pac.estado]||'var(--g)'}}>
              {estadoLabel[pac.estado]||'● Activo'}
            </span>
            {bono && <span className="badge badge-b">{bonoLabel[bono.tipo]||bono.tipo}</span>}
            {bono && <span className={`badge ${pagoBadge[bono.estado_pago]||'badge-b'}`}>{pagoLabel[bono.estado_pago]}</span>}
          </div>
        </div>

        <div style={{display:'flex',gap:5,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button className="btn btn-s btn-sm" onClick={()=>router.push('/pacientes')}>← Listado</button>
          {editando ? (
            <>
              <button className="btn btn-d btn-sm" onClick={()=>setEditando(false)}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={guardarEdicion}>💾 Guardar</button>
            </>
          ) : (
            <button className="btn btn-p btn-sm" onClick={()=>setEditando(true)}>✎ Editar</button>
          )}
          {pac.estado==='activo' && <>
            <button className="btn btn-t btn-sm" onClick={()=>setModalPausa(true)}>⏸ Pausa</button>
            <button className="btn btn-d btn-sm" onClick={darDeBaja} disabled={procesando}>○ Dar de baja</button>
          </>}
          {(pac.estado==='baja'||pac.estado==='pausa') && (
            <button className="btn btn-p btn-sm" onClick={reactivar} disabled={procesando}>▶ Reactivar</button>
          )}
          <button className="btn btn-d btn-sm" onClick={eliminarPaciente} disabled={procesando} style={{background:'var(--red)',color:'#fff',borderColor:'var(--red)'}}>
            {procesando?'⏳':'🗑 Eliminar'}
          </button>
        </div>
      </div>

      {/* AVISO BAJA/PAUSA */}
      {pac.estado!=='activo' && (
        <div style={{background:pac.estado==='baja'?'var(--redl)':'var(--ambl)',border:`1px solid ${pac.estado==='baja'?'var(--red)':'var(--amb)'}`,borderRadius:'var(--rl)',padding:'10px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:16}}>{pac.estado==='baja'?'○':'⏸'}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:500,color:pac.estado==='baja'?'var(--red)':'#7A5800'}}>
              {pac.estado==='baja'?'Paciente dado de baja':'Paciente en pausa temporal'}
            </div>
            <div style={{fontSize:10,color:pac.estado==='baja'?'var(--red)':'#7A5800',fontWeight:300}}>
              {pac.estado==='baja'?'Sus citas futuras fueron eliminadas. Pulsa Reactivar si vuelve.':'Sus citas del periodo de pausa fueron canceladas.'}
            </div>
          </div>
          <button className="btn btn-p btn-sm" onClick={reactivar}>▶ Reactivar</button>
        </div>
      )}

      {/* TABS */}
      <div className="tabs">
        {[['ficha','📋 Ficha'],['salud','❤️ Salud'],['entreno','🏋 Entrenamiento'],['resultados','📊 Resultados']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* TAB FICHA */}
      {tab==='ficha' && (
        <FichaTab
          pac={pac}
          bono={bono}
          citas={citas}
          recuperaciones={recuperaciones}
          editando={editando}
          form={form}
          setForm={setForm}
          setModalBono={setModalBono}
          bonoLabel={bonoLabel}
          mes={mes}
          anio={anio}
        />
      )}

      {tab==='salud' && (
        <div className="g2">
          <div>
            <div className="card">
              <div className="card-title">Molestias y dolores <button className="btn btn-s btn-sm" onClick={async()=>{const zona=prompt('Zona / localización:');if(!zona)return;const eva=prompt('Intensidad EVA (0-10):');await supabase.from('molestias').insert({paciente_id:id,zona,tipo:'molestia',eva:parseInt(eva||'5'),activa:true});cargar()}}>+ Añadir</button></div>
              {molestias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias registradas</div>}
              {molestias.map(m=>(
                <div key={m.id} style={{borderRadius:7,padding:'8px 10px',marginBottom:5,border:'1px solid',borderColor:m.activa?'#F5C8C8':'var(--gm)',backgroundColor:m.activa?'var(--redl)':'var(--gl)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.zona}</div>
                      <div style={{fontSize:9,color:'var(--grl)'}}>EVA {m.eva}/10 · {m.tipo?.replace('_',' ')}</div>
                    </div>
                    <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:m.activa?'var(--redl)':'var(--gl)',color:m.activa?'var(--red)':'var(--gd)'}}>
                      {m.activa?'● Activa':'✓ Resuelta'}
                    </span>
                    <button className="toggle" style={{background:m.activa?'var(--red)':'var(--g)'}} onClick={()=>toggleMolestia(m.id,m.activa)}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">Patologías <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Nombre de la patología:');if(!nombre)return;await supabase.from('patologias').insert({paciente_id:id,nombre,estado:'activa'});cargar()}}>+ Añadir</button></div>
              {patologias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas</div>}
              {patologias.map(p=>(
                <div key={p.id} className="ri">
                  <div style={{width:7,height:7,borderRadius:'50%',background:p.estado==='activa'?'var(--red)':p.estado==='cronica'?'var(--amb)':'var(--g)',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{p.nombre}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>{p.estado}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card">
              <div className="card-title">Escalas Borg y estrés <button className="btn btn-s btn-sm" onClick={async()=>{const borg=prompt('Borg · bienestar (0-10):');const estres=prompt('Estrés (0-10):');if(!borg||!estres)return;await supabase.from('escalas').insert({paciente_id:id,fecha:new Date().toISOString().split('T')[0],borg:parseInt(borg),estres:parseInt(estres)});cargar()}}>+ Hoy</button></div>
              {escalas.map(e=>(
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontSize:9,color:'var(--grl)',width:50,fontWeight:300}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:44}}>Borg</span>
                      <div style={{flex:1,height:4,background:'var(--bm)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:'var(--g)',width:`${(e.borg/10)*100}%`}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:24,textAlign:'right'}}>{e.borg}/10</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:44}}>Estrés</span>
                      <div style={{flex:1,height:4,background:'var(--bm)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:e.estres>6?'var(--red)':'var(--amb)',width:`${(e.estres/10)*100}%`}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:24,textAlign:'right'}}>{e.estres}/10</span>
                    </div>
                  </div>
                </div>
              ))}
              {escalas.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin escalas registradas</div>}
            </div>
            <div className="card">
              <div className="card-title">Medicamentos <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Medicamento:');if(!nombre)return;const freq=prompt('Frecuencia:');await supabase.from('medicamentos').insert({paciente_id:id,nombre,frecuencia:freq||''});cargar()}}>+ Añadir</button></div>
              {medicamentos.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin medicamentos registrados</div>}
              {medicamentos.map(m=>(
                <div key={m.id} className="ri">
                  <div style={{width:7,height:7,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
                  <div><div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.nombre}</div><div style={{fontSize:9,color:'var(--grl)'}}>{m.frecuencia}</div></div>
                </div>
              ))}
            </div>
            <div className="card" style={{gridColumn:'1/-1'}}>
              <div className="card-title">
                Tests funcionales
                <button className="btn btn-s btn-sm" onClick={()=>setModalRegistrarTest(true)}>+ Registrar test</button>
              </div>
              {tests.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin tests registrados</div>}
              {tests.length>0 && (() => {
                // Agrupar tests por test_id + lado
                const grupos: Record<string, any[]> = {}
                tests.forEach(t => {
                  const key = `${t.test_id}_${t.lado||'bilateral'}`
                  if (!grupos[key]) grupos[key] = []
                  grupos[key].push(t)
                })
                const gruposArr = Object.values(grupos)
                const positivos = gruposArr.filter(g=>g[0].resultado==='positivo')
                const negativos = gruposArr.filter(g=>g[0].resultado==='negativo')
                return (
                  <div className="g2">
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--red)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>● Positivos / Activos</div>
                      {positivos.length===0 && <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Sin tests positivos</div>}
                      {positivos.map((grupo,gi)=>{
                        const t = grupo[0]
                        const anteriores = grupo.slice(1)
                        return (
                          <div key={gi} style={{padding:'7px 10px',background:'var(--redl)',borderRadius:6,border:'1px solid #F5C8C8',marginBottom:6}}>
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+t.lado.charAt(0).toUpperCase()+t.lado.slice(1):''}</div>
                                <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · {grupo.length} {grupo.length===1?'registro':'registros'}</div>
                              </div>
                              <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--redl)',color:'var(--red)',border:'1px solid var(--red)'}}>+ Positivo</span>
                              <button onClick={async()=>{await supabase.from('resultados_tests').update({resultado:'negativo'}).eq('id',t.id);cargar()}} style={{fontSize:8,padding:'2px 6px',borderRadius:3,border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui'}}>→ Negativo</button>
                            </div>
                            {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((item:any,ii:number)=>(
                              <div key={ii} style={{fontSize:9,color:'var(--red)',marginTop:3,display:'flex',alignItems:'center',gap:5}}>
                                <span>☑</span><span>{item.nombre}{item.grados?' · '+item.grados+'°':''}</span>
                              </div>
                            ))}
                            {t.observaciones&&<div style={{fontSize:9,color:'var(--gr)',marginTop:4,fontStyle:'italic'}}>{t.observaciones}</div>}
                            {t.fecha_repeticion&&<div style={{fontSize:9,color:'var(--amb)',marginTop:2}}>⏰ Revisión: {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>}
                            {anteriores.length>0&&(
                              <details style={{marginTop:6}}>
                                <summary style={{fontSize:9,color:'var(--grl)',cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:4}}>
                                  <span>▸ Historial ({anteriores.length} {anteriores.length===1?'vez anterior':'veces anteriores'})</span>
                                </summary>
                                <div style={{marginTop:5,paddingLeft:8,borderLeft:'2px solid #F5C8C8'}}>
                                  {anteriores.map((ant,ai)=>(
                                    <div key={ai} style={{marginBottom:5,padding:'5px 8px',background:'rgba(255,255,255,.6)',borderRadius:4}}>
                                      <div style={{fontSize:9,fontWeight:400,color:'var(--n)',marginBottom:2}}>{new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--g)'}}>{ant.resultado==='positivo'?'+ Positivo':'− Negativo'}</span></div>
                                      {(ant.items_resultado||[]).filter((i:any)=>i.marcado).map((item:any,ii:number)=>(
                                        <div key={ii} style={{fontSize:8,color:'var(--gr)'}}>☑ {item.nombre}{item.grados?' · '+item.grados+'°':''}</div>
                                      ))}
                                      {ant.observaciones&&<div style={{fontSize:8,color:'var(--grl)',fontStyle:'italic'}}>{ant.observaciones}</div>}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>✓ Negativos / Resueltos</div>
                      {negativos.length===0 && <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Sin tests negativos</div>}
                      {negativos.map((grupo,gi)=>{
                        const t = grupo[0]
                        const anteriores = grupo.slice(1)
                        return (
                          <div key={gi} style={{padding:'7px 10px',background:'var(--gl)',borderRadius:6,border:'1px solid var(--gm)',marginBottom:6}}>
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+t.lado.charAt(0).toUpperCase()+t.lado.slice(1):''}</div>
                                <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · {grupo.length} {grupo.length===1?'registro':'registros'}</div>
                              </div>
                              <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',border:'1px solid var(--gm)'}}>− Negativo</span>
                            </div>
                            {t.observaciones&&<div style={{fontSize:9,color:'var(--gr)',marginTop:3,fontStyle:'italic'}}>{t.observaciones}</div>}
                            {anteriores.length>0&&(
                              <details style={{marginTop:6}}>
                                <summary style={{fontSize:9,color:'var(--grl)',cursor:'pointer',listStyle:'none',display:'flex',alignItems:'center',gap:4}}>
                                  <span>▸ Historial ({anteriores.length} {anteriores.length===1?'vez anterior':'veces anteriores'})</span>
                                </summary>
                                <div style={{marginTop:5,paddingLeft:8,borderLeft:'2px solid var(--gm)'}}>
                                  {anteriores.map((ant,ai)=>(
                                    <div key={ai} style={{marginBottom:5,padding:'5px 8px',background:'rgba(255,255,255,.6)',borderRadius:4}}>
                                      <div style={{fontSize:9,fontWeight:400,color:'var(--n)',marginBottom:2}}>{new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--g)'}}>{ant.resultado==='positivo'?'+ Positivo':'− Negativo'}</span></div>
                                      {ant.observaciones&&<div style={{fontSize:8,color:'var(--grl)',fontStyle:'italic'}}>{ant.observaciones}</div>}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB ENTRENAMIENTO */}
      {tab==='entreno' && (
        <EntrenoTab pacienteId={String(id)} sesiones={sesiones} supabase={supabase} onRefresh={cargar}/>
      )}

      {tab==='resultados' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
            <button className="btn btn-p btn-sm" onClick={generarPDF}>📄 Imprimir / Guardar PDF</button>
          </div>
          {(()=>{
            // DATOS DE ASISTENCIA
            const realizadas = citas.filter((c:any)=>c.estado==='realizada').length
            const faltas = citas.filter((c:any)=>c.estado==='falta').length
            const canceladas = citas.filter((c:any)=>c.estado==='cancelada').length
            const total = realizadas + faltas
            const pctAsistencia = total>0 ? Math.round((realizadas/total)*100) : 0

            // ASISTENCIA POR MES
            const mesesMap: Record<string,{realizadas:number,faltas:number}> = {}
            citas.forEach((c:any)=>{
              const mes = c.fecha?.slice(0,7)
              if (!mes) return
              if (!mesesMap[mes]) mesesMap[mes] = {realizadas:0,faltas:0}
              if (c.estado==='realizada') mesesMap[mes].realizadas++
              if (c.estado==='falta') mesesMap[mes].faltas++
            })
            const meses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
            const maxMes = Math.max(...meses.map(([,v])=>v.realizadas+v.faltas), 1)

            return (
              <div>
                {/* DONUT ASISTENCIA */}
                <div className="g2" style={{marginBottom:16}}>
                  <div className="card" style={{textAlign:'center'}}>
                    <div className="card-title">Asistencia global</div>
                    <div style={{position:'relative',width:120,height:120,margin:'10px auto'}}>
                      <svg viewBox="0 0 36 36" style={{width:120,height:120,transform:'rotate(-90deg)'}}>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bm)" strokeWidth="3"/>
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--g)" strokeWidth="3"
                          strokeDasharray={`${pctAsistencia} ${100-pctAsistencia}`}
                          strokeDashoffset="0" strokeLinecap="round"/>
                        {faltas>0&&<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--red)" strokeWidth="3"
                          strokeDasharray={`${Math.round((faltas/total)*100)} ${100-Math.round((faltas/total)*100)}`}
                          strokeDashoffset={`${-pctAsistencia}`} strokeLinecap="round"/>}
                      </svg>
                      <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                        <div style={{fontSize:20,fontWeight:300,color:'var(--n)'}}>{pctAsistencia}%</div>
                        <div style={{fontSize:8,color:'var(--grl)'}}>asistencia</div>
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:4}}>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:'var(--g)'}}/>
                        <span style={{fontSize:9,color:'var(--grl)'}}>{realizadas} realizadas</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:'var(--red)'}}/>
                        <span style={{fontSize:9,color:'var(--grl)'}}>{faltas} faltas</span>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-title">Resumen</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      {[
                        ['Realizadas',realizadas,'var(--g)'],
                        ['Faltas',faltas,'var(--red)'],
                        ['Canceladas',canceladas,'var(--grl)'],
                        ['Recuperadas',recuperaciones.filter((r:any)=>r.estado==='recuperada').length,'var(--amb)'],
                      ].map(([l,v,c])=>(
                        <div key={String(l)} style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                          <div style={{fontSize:22,fontWeight:300,color:c as string}}>{v}</div>
                          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* BARRAS POR MES */}
                <div className="card" style={{marginBottom:16}}>
                  <div className="card-title">Asistencia por mes</div>
                  {meses.length===0 ? (
                    <div style={{fontSize:10,color:'var(--grl)'}}>Sin datos suficientes</div>
                  ) : (
                    <div style={{display:'flex',alignItems:'flex-end',gap:8,height:100,padding:'10px 0'}}>
                      {meses.map(([mes,datos])=>{
                        const pct = Math.round((datos.realizadas/(datos.realizadas+datos.faltas||1))*100)
                        const alturaR = Math.round((datos.realizadas/maxMes)*80)
                        const alturaF = Math.round((datos.faltas/maxMes)*80)
                        const [anio,m] = mes.split('-')
                        const nombreMes = new Date(parseInt(anio),parseInt(m)-1,1).toLocaleDateString('es-ES',{month:'short'})
                        return (
                          <div key={mes} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                            <div style={{fontSize:8,color:'var(--grl)',marginBottom:2}}>{pct}%</div>
                            <div style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:80,gap:1}}>
                              {datos.faltas>0&&<div style={{width:'70%',height:alturaF,background:'var(--red)',borderRadius:'2px 2px 0 0',opacity:.7}}/>}
                              <div style={{width:'70%',height:alturaR,background:'var(--g)',borderRadius:'2px 2px 0 0'}}/>
                            </div>
                            <div style={{fontSize:8,color:'var(--grl)',marginTop:2,textTransform:'capitalize'}}>{nombreMes}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div style={{display:'flex',gap:12,marginTop:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,background:'var(--g)',borderRadius:1}}/><span style={{fontSize:8,color:'var(--grl)'}}>Realizadas</span></div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,background:'var(--red)',borderRadius:1,opacity:.7}}/><span style={{fontSize:8,color:'var(--grl)'}}>Faltas</span></div>
                  </div>
                </div>

                <div style={{fontSize:9,color:'var(--grl)',textAlign:'center',fontWeight:300}}>ℹ️ Las citas se actualizan a las 00:00</div>

                {/* BLOQUE ESCALAS */}
                {escalas.length>0 && (
                  <div className="card" style={{marginTop:16,marginBottom:16}}>
                    <div className="card-title">Evolución escalas</div>
                    <div className="g2">
                      {/* BORG */}
                      <div>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Esfuerzo percibido (Borg)</div>
                        <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
                          {[...escalas].reverse().slice(-6).map((e:any,i:number)=>{
                            const h = Math.round((e.borg/10)*70)
                            return (
                              <div key={e.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                                <div style={{fontSize:7,color:'var(--n)',fontWeight:500}}>{e.borg}</div>
                                <div style={{width:'80%',height:h,background:'var(--g)',borderRadius:'2px 2px 0 0',minHeight:4}}/>
                                <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      {/* ESTRÉS */}
                      <div>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Nivel de estrés</div>
                        <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
                          {[...escalas].reverse().slice(-6).map((e:any,i:number)=>{
                            const h = Math.round((e.estres/10)*70)
                            return (
                              <div key={e.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                                <div style={{fontSize:7,color:'var(--n)',fontWeight:500}}>{e.estres}</div>
                                <div style={{width:'80%',height:h,background:'var(--amb)',borderRadius:'2px 2px 0 0',minHeight:4}}/>
                                <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* EVOLUCIÓN PESO */}
                {pac?.peso_kg && (
                  <div className="card" style={{marginBottom:16}}>
                    <div className="card-title">Datos físicos actuales</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}>
                      {[['Peso',pac.peso_kg,'kg'],['Altura',pac.altura_cm,'cm'],['IMC',pac.peso_kg&&pac.altura_cm?Math.round(pac.peso_kg/Math.pow(pac.altura_cm/100,2)*10)/10:'—','']].map(([l,v,u])=>(
                        <div key={String(l)} style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px'}}>
                          <div style={{fontSize:20,fontWeight:300,color:'var(--n)'}}>{v}{u&&<span style={{fontSize:10,color:'var(--grl)',marginLeft:2}}>{u}</span>}</div>
                          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BLOQUE TESTS */}
                {tests.length>0 && (
                  <div className="card" style={{marginTop:16}}>
                    <div className="card-title">Evolución de tests funcionales</div>
                    {(()=>{
                      // Agrupar por test_id + lado
                      const grupos: Record<string,any[]> = {}
                      tests.forEach((t:any)=>{
                        const key = `${t.test_id}_${t.lado||'bilateral'}`
                        if (!grupos[key]) grupos[key]=[]
                        grupos[key].push(t)
                      })
                      return Object.values(grupos).map((grupo:any[],gi:number)=>{
                        const sorted = [...grupo].sort((a,b)=>a.fecha.localeCompare(b.fecha))
                        const ultimo = sorted[sorted.length-1]
                        const primero = sorted[0]
                        const mejoro = primero.resultado==='positivo' && ultimo.resultado==='negativo'
                        const empeoro = primero.resultado==='negativo' && ultimo.resultado==='positivo'
                        const ladoStr = ultimo.lado&&ultimo.lado!=='bilateral'?' · '+ultimo.lado.charAt(0).toUpperCase()+ultimo.lado.slice(1):''
                        return (
                          <div key={gi} style={{marginBottom:10,padding:'9px 11px',background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ultimo.tests?.nombre||'Test'}{ladoStr}</div>
                                <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{sorted.length} {sorted.length===1?'registro':'registros'}</div>
                              </div>
                              {mejoro&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',fontWeight:500}}>✓ Mejorado</span>}
                              {empeoro&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--redl)',color:'var(--red)',fontWeight:500}}>⚠ Empeorado</span>}
                              <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:ultimo.resultado==='positivo'?'var(--redl)':'var(--gl)',color:ultimo.resultado==='positivo'?'var(--red)':'var(--gd)',fontWeight:500}}>
                                {ultimo.resultado==='positivo'?'+ Positivo':'− Negativo'}
                              </span>
                            </div>
                            {/* LÍNEA TEMPORAL */}
                            <div style={{display:'flex',alignItems:'center',gap:2,overflowX:'auto',paddingBottom:2}}>
                              {sorted.map((t:any,ti:number)=>(
                                <div key={t.id} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                                  <div style={{textAlign:'center'}}>
                                    <div style={{width:10,height:10,borderRadius:'50%',background:t.resultado==='positivo'?'var(--red)':'var(--g)',margin:'0 auto 2px'}}/>
                                    <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                                  </div>
                                  {ti<sorted.length-1&&<div style={{width:16,height:1,background:'var(--bm)',flexShrink:0}}/>}
                                </div>
                              ))}
                            </div>
                            {/* ÍTEMS CON GRADOS DEL ÚLTIMO REGISTRO */}
                            {(ultimo.items_resultado||[]).filter((i:any)=>i.marcado&&i.grados).length>0&&(
                              <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid var(--bm)'}}>
                                {(ultimo.items_resultado||[]).filter((i:any)=>i.marcado&&i.grados).map((item:any,ii:number)=>(
                                  <div key={ii} style={{fontSize:9,color:'var(--red)',display:'flex',alignItems:'center',gap:4}}>
                                    <span>☑</span><span>{item.nombre}: <strong>{item.grados}°</strong></span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* MODAL REGISTRAR TEST */}
      {modalRegistrarTest && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalRegistrarTest(false)}}>
          <div className="modal" style={{width:460}}>
            <div className="modal-title">Registrar test<button className="modal-close" onClick={()=>setModalRegistrarTest(false)}>✕</button></div>
            <div className="g2">
              <div className="field"><label>Test *</label>
                <select className="input" value={testSeleccionado} onChange={e=>seleccionarTest(e.target.value)}>
                  <option value="">Seleccionar test...</option>
                  {testsDisp.map((t:any)=><option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="field"><label>Lado</label>
                <select className="input" value={ladoTest} onChange={e=>setLadoTest(e.target.value)}>
                  <option value="bilateral">Bilateral</option>
                  <option value="derecho">Derecho</option>
                  <option value="izquierdo">Izquierdo</option>
                </select>
              </div>
            </div>

            {/* IMAGEN Y VIDEO DEL TEST */}
            {testSeleccionadoObj && (testSeleccionadoObj.imagen_url||testSeleccionadoObj.descripcion) && (
              <div style={{background:'var(--bl)',borderRadius:7,padding:'9px 11px',marginBottom:10,display:'flex',gap:10,alignItems:'flex-start'}}>
                {testSeleccionadoObj.imagen_url&&<img src={testSeleccionadoObj.imagen_url} alt={testSeleccionadoObj.nombre} style={{width:60,height:60,objectFit:'cover',borderRadius:5,flexShrink:0}}/>}
                <div style={{flex:1}}>
                  {testSeleccionadoObj.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,lineHeight:1.4}}>{testSeleccionadoObj.descripcion}</div>}
                  {testSeleccionadoObj.video_url&&<a href={testSeleccionadoObj.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:'var(--g)',display:'block',marginTop:4}}>🎥 Ver vídeo del test ↗</a>}
                </div>
              </div>
            )}

            {/* ÍTEMS CON CHECKBOXES */}
            {itemsTest.length>0 ? (
              <div className="field">
                <label>Ítems de evaluación
                  <span style={{fontSize:9,fontWeight:300,color:'var(--grl)',marginLeft:6,textTransform:'none',letterSpacing:0}}>
                    {testSeleccionadoObj?.logica==='todos'?'Todos marcados = Positivo':'Cualquier ítem marcado = Positivo'}
                  </span>
                </label>
                {itemsTest.map((item,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:item.marcado?'var(--redl)':'var(--bl)',borderRadius:6,border:`1px solid ${item.marcado?'#F5C8C8':'var(--bd)'}`,marginBottom:4,transition:'all .15s'}}>
                    <input type="checkbox" checked={item.marcado} onChange={e=>{const its=[...itemsTest];its[i]={...its[i],marcado:e.target.checked};setItemsTest(its)}} style={{width:16,height:16,accentColor:'var(--red)',flexShrink:0,cursor:'pointer'}}/>
                    <span style={{flex:1,fontSize:11,fontWeight:item.marcado?400:300,color:'var(--n)'}}>{item.nombre}</span>
                    {item.tiene_grados && item.marcado && (
                      <div style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                        <input type="number" value={item.grados} onChange={e=>{const its=[...itemsTest];its[i]={...its[i],grados:e.target.value};setItemsTest(its)}}
                          style={{width:52,fontSize:11,padding:'2px 5px',border:'1px solid var(--red)',borderRadius:4,background:'var(--redl)',color:'var(--red)',textAlign:'center',fontFamily:'system-ui'}}
                          placeholder="0"/>
                        <span style={{fontSize:10,color:'var(--red)',fontWeight:500}}>°</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* RESULTADO CALCULADO */}
                <div style={{marginTop:8,padding:'7px 11px',borderRadius:6,background:calcularResultado()==='positivo'?'var(--redl)':'var(--gl)',border:`1px solid ${calcularResultado()==='positivo'?'var(--red)':'var(--gm)'}`,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:11,fontWeight:500,color:calcularResultado()==='positivo'?'var(--red)':'var(--gd)'}}>
                    {calcularResultado()==='positivo'?'+ Resultado: Positivo':'− Resultado: Negativo'}
                  </span>
                  <span style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>calculado automáticamente</span>
                </div>
              </div>
            ) : testSeleccionado ? (
              <div className="field"><label>Resultado</label>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  {[['positivo','+ Positivo','var(--red)','var(--redl)'],['negativo','− Negativo','var(--g)','var(--gl)']].map(([v,l,c,bg])=>(
                    <div key={v} onClick={()=>setResultadoTest(v)} style={{flex:1,padding:'10px',borderRadius:'var(--rl)',border:`2px solid ${resultadoTest===v?c:'var(--bd)'}`,background:resultadoTest===v?bg:'var(--w)',cursor:'pointer',textAlign:'center',transition:'all .15s'}}>
                      <div style={{fontSize:12,fontWeight:500,color:resultadoTest===v?c:'var(--grl)'}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="field"><label>Observaciones libres</label>
              <textarea className="input" value={obsTest} onChange={e=>setObsTest(e.target.value)} placeholder="Notas adicionales sobre el resultado..." style={{minHeight:50}}/>
            </div>
            <div className="field">
              <label style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>Fecha de revisión</span>
                {testSeleccionadoObj?.frecuencia_meses && <span style={{fontSize:9,color:'var(--g)',fontWeight:300}}>Predeterminada: {testSeleccionadoObj.frecuencia_meses} meses</span>}
              </label>
              <input type="date" className="input" value={fechaRevTest} onChange={e=>setFechaRevTest(e.target.value)} min={new Date().toISOString().split('T')[0]}/>
              {fechaRevTest && <div style={{fontSize:9,color:'var(--grl)',marginTop:3,fontWeight:300}}>
                Revisión el {new Date(fechaRevTest+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
              </div>}
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalRegistrarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={registrarTest}>💾 Guardar resultado</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BONO */}
      {modalBono && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBono(false)}}>
          <div className="modal">
            <div className="modal-title">Asignar bono<button className="modal-close" onClick={()=>setModalBono(false)}>✕</button></div>
            <div className="field"><label>Tipo de bono</label>
              <select className="input" value={nuevoBono.tipo} onChange={e=>setNuevoBono(p=>({...p,tipo:e.target.value}))}>
                <option value="esencial">Esencial · 2 días/semana</option>
                <option value="progreso">Progreso · 3 días/semana</option>
                <option value="avanzado">Avanzado · 4 días/semana</option>
                <option value="avanzado_mas1">Avanzado +1 · 5 días/semana</option>
              </select>
            </div>
            <div className="field"><label>Estado de pago</label>
              <select className="input" value={nuevoBono.estado_pago} onChange={e=>setNuevoBono(p=>({...p,estado_pago:e.target.value}))}>
                <option value="pendiente">⏳ Pendiente</option>
                <option value="pagado">✓ Pagado</option>
                <option value="impago">⚠ Impago</option>
              </select>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalBono(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearBono}>✓ Asignar bono</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAUSA */}
      {modalPausa && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalPausa(false)}}>
          <div className="modal">
            <div className="modal-title">⏸ Pausa temporal<button className="modal-close" onClick={()=>setModalPausa(false)}>✕</button></div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,fontWeight:300}}>
              Las citas del periodo seleccionado se cancelarán automáticamente. El paciente podrá reactivarse cuando vuelva.
            </div>
            <div className="g2">
              <div className="field"><label>Desde</label><input type="date" className="input" value={pausa.desde} onChange={e=>setPausa(p=>({...p,desde:e.target.value}))}/></div>
              <div className="field"><label>Hasta (fecha de vuelta)</label><input type="date" className="input" value={pausa.hasta} onChange={e=>setPausa(p=>({...p,hasta:e.target.value}))}/></div>
            </div>
            <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,padding:'8px 11px',fontSize:10,color:'#7A5800',marginBottom:12}}>
              ⚠ Se cancelarán todas las citas programadas entre esas fechas. Para reactivar al paciente entra en su ficha y pulsa ▶ Reactivar.
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-s btn-sm" onClick={()=>setModalPausa(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={aplicarPausa} disabled={procesando}>
                {procesando?'⏳ Aplicando...':'⏸ Aplicar pausa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
