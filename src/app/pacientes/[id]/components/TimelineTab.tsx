'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Definicion de tipos de evento: icono, color, etiqueta y familia para el filtro
const TIPOS: Record<string,{icono:string,color:string,label:string,familia:string}> = {
  valoracion_inicial: {icono:'📋', color:'var(--g)',   label:'Valoración inicial', familia:'clinico'},
  revaloracion:       {icono:'🔄', color:'var(--g)',   label:'Revaloración',       familia:'clinico'},
  patologia:          {icono:'🩺', color:'#B05A5A',    label:'Patología',          familia:'clinico'},
  patologia_resuelta: {icono:'✅', color:'var(--g)',   label:'Patología resuelta', familia:'clinico'},
  molestia:           {icono:'🤕', color:'#B05A5A',    label:'Molestia',           familia:'clinico'},
  molestia_resuelta:  {icono:'✅', color:'var(--g)',   label:'Molestia resuelta',  familia:'clinico'},
  medicamento:        {icono:'💊', color:'#6B7FC4',    label:'Medicamento',        familia:'clinico'},
  plantillas:         {icono:'🦶', color:'#6B7FC4',    label:'Plantillas',         familia:'clinico'},
  deporte:            {icono:'🏃', color:'#3E7179',    label:'Deporte',            familia:'clinico'},
  alerta_abierta:     {icono:'⚠️', color:'var(--red)', label:'Alerta abierta',     familia:'alertas'},
  alerta_cerrada:     {icono:'✅', color:'var(--g)',   label:'Alerta cerrada',     familia:'alertas'},
  nota:               {icono:'📝', color:'var(--amb)', label:'Nota',               familia:'notas'},
  pausa:              {icono:'⏸', color:'var(--amb)', label:'Pausa',              familia:'admin'},
  baja:               {icono:'○', color:'var(--red)', label:'Baja',               familia:'admin'},
  reactivacion:       {icono:'▶', color:'var(--g)',   label:'Reactivación',       familia:'admin'},
  cambio_tipo_clase:  {icono:'🔀', color:'#6B7FC4',    label:'Cambio de clase',    familia:'admin'},
  pago_bono:          {icono:'💶', color:'var(--gd)',  label:'Pago de bono',       familia:'pagos'},
  cambio_bono:        {icono:'🎟', color:'var(--gd)',  label:'Cambio de bono',     familia:'pagos'},
  entrenamiento:      {icono:'🏋', color:'#3E7179',    label:'Entrenamiento',      familia:'entreno'},
}

const FAMILIAS: Record<string,{label:string,color:string}> = {
  clinico: {label:'🩺 Clínico', color:'#B05A5A'},
  alertas: {label:'⚠️ Alertas', color:'var(--red)'},
  notas:   {label:'📝 Notas',   color:'var(--amb)'},
  admin:   {label:'⚙️ Gestión', color:'#6B7FC4'},
  pagos:   {label:'💶 Pagos',   color:'var(--gd)'},
  entreno: {label:'🏋 Entreno', color:'#3E7179'},
}

export default function TimelineTab({ pacienteId }: { pacienteId: string }) {
  const [eventos, setEventos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [familiasOcultas, setFamiliasOcultas] = useState<Set<string>>(new Set())

  useEffect(() => { cargar() }, [pacienteId])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('eventos_paciente').select('*').eq('paciente_id', pacienteId).order('fecha', {ascending:false}).order('created_at', {ascending:false})
    setEventos(data||[])
    setLoading(false)
  }

  function toggle(id: string) {
    setExpandidos(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function toggleFamilia(fam: string) {
    setFamiliasOcultas(prev => { const next = new Set(prev); if (next.has(fam)) next.delete(fam); else next.add(fam); return next })
  }

  function formatFecha(f: string) {
    if (!f) return '—'
    return new Date(f+'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'long', year:'numeric'})
  }

  // Contar eventos por familia (sobre el total, no sobre lo filtrado)
  function nFamilia(fam: string) {
    return eventos.filter(ev => (TIPOS[ev.tipo]?.familia||'')===fam).length
  }

  const visibles = eventos.filter(ev => !familiasOcultas.has(TIPOS[ev.tipo]?.familia||''))

  if (loading) return <div className="loading">Cargando historial...</div>

  return (
    <div>
      {/* FILTRO POR FAMILIAS */}
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:14,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px'}}>
        <span style={{fontSize:9,color:'var(--grl)',marginRight:2}}>Filtrar</span>
        {Object.entries(FAMILIAS).map(([fam,info])=>{
          const oculta = familiasOcultas.has(fam)
          const n = nFamilia(fam)
          return (
            <span key={fam} onClick={()=>toggleFamilia(fam)} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:`1px solid ${oculta?'var(--bd)':info.color}`,cursor:'pointer',background:oculta?'var(--w)':info.color,color:oculta?'var(--grl)':'#fff',display:'flex',alignItems:'center',gap:4,opacity:oculta?.55:1,textDecoration:oculta?'line-through':'none'}}>
              {info.label} <b style={{fontWeight:600}}>{n}</b>
            </span>
          )
        })}
      </div>

      {eventos.length===0 && (
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>Sin historial aún. Los sucesos del paciente aparecerán aquí.</div>
      )}
      {eventos.length>0 && visibles.length===0 && (
        <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin eventos con los filtros activos.</div>
      )}

      <div style={{position:'relative',paddingLeft:24}}>
        {visibles.length>0 && <div style={{position:'absolute',left:8,top:0,bottom:0,width:2,background:'var(--bm)',borderRadius:2}}/>}

        {visibles.map(ev => {
          const exp = expandidos.has(ev.id)
          const t = TIPOS[ev.tipo] || {icono:'•', color:'var(--bd)', label:ev.tipo, familia:''}
          return (
            <div key={ev.id} style={{position:'relative',marginBottom:12}}>
              <div style={{position:'absolute',left:-20,top:10,width:12,height:12,borderRadius:'50%',background:t.color,border:'2px solid var(--w)',zIndex:1}}/>
              <div style={{background:'var(--w)',border:`1px solid ${exp?t.color:'var(--bd)'}`,borderRadius:'var(--rl)',overflow:'hidden'}}>
                <div onClick={()=>ev.descripcion&&toggle(ev.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',cursor:ev.descripcion?'pointer':'default'}}
                  onMouseOver={e=>{if(ev.descripcion)(e.currentTarget as HTMLElement).style.background='var(--bl)'}}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <span style={{fontSize:14}}>{t.icono}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ev.titulo || t.label}</div>
                    <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{t.label} · {formatFecha(ev.fecha)}</div>
                  </div>
                  {ev.descripcion && <span style={{fontSize:10,color:'var(--grl)'}}>{exp?'▲':'▼'}</span>}
                </div>
                {exp && ev.descripcion && (
                  <div style={{padding:'10px 12px',borderTop:'1px solid var(--bl)',fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.6,whiteSpace:'pre-line'}}>{ev.descripcion}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
