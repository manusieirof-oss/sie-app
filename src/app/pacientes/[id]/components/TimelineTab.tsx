'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

// Definicion de tipos de evento: icono, color, etiqueta y familia para el filtro
const TIPOS: Record<string,{icono:string,color:string,label:string,familia:string}> = {
  valoracion_inicial: {icono:'valoracion', color:'var(--g)',   label:'Valoración inicial', familia:'valoraciones'},
  revaloracion:       {icono:'recuperar',  color:'var(--g)',   label:'Revaloración',       familia:'valoraciones'},
  patologia:          {icono:'patologia',  color:'#B05A5A',    label:'Patología',          familia:'clinico'},
  patologia_resuelta: {icono:'ok',         color:'var(--g)',   label:'Patología resuelta', familia:'clinico'},
  molestia:           {icono:'molestia',   color:'#B05A5A',    label:'Molestia',           familia:'clinico'},
  molestia_resuelta:  {icono:'ok',         color:'var(--g)',   label:'Molestia resuelta',  familia:'clinico'},
  medicamento:        {icono:'medicamento',color:'#6B7FC4',    label:'Medicamento',        familia:'clinico'},
  plantillas:         {icono:'plantillas', color:'#6B7FC4',    label:'Plantillas',         familia:'clinico'},
  deporte:            {icono:'deporte',    color:'#3E7179',    label:'Deporte',            familia:'clinico'},
  escala:             {icono:'progreso',   color:'#6B7FC4',    label:'Escalas',            familia:'clinico'},
  test:               {icono:'buscar',     color:'#B05A5A',    label:'Test',               familia:'clinico'},
  alergia:            {icono:'alergia',    color:'#B05A5A',    label:'Alergia',            familia:'clinico'},
  intolerancia:       {icono:'intolerancia',color:'var(--amb)',label:'Intolerancia',       familia:'clinico'},
  alerta_abierta:     {icono:'alerta',     color:'var(--red)', label:'Alerta abierta',     familia:'alertas'},
  alerta_cerrada:     {icono:'ok',         color:'var(--g)',   label:'Alerta cerrada',     familia:'alertas'},
  nota:               {icono:'nota',       color:'var(--amb)', label:'Nota',               familia:'notas'},
  pausa:              {icono:'pausa',      color:'var(--amb)', label:'Pausa',              familia:'admin'},
  baja:               {icono:'altabaja',   color:'var(--red)', label:'Baja',               familia:'admin'},
  reactivacion:       {icono:'play',       color:'var(--g)',   label:'Reactivación',       familia:'admin'},
  cambio_tipo_clase:  {icono:'cambio',     color:'#6B7FC4',    label:'Cambio de clase',    familia:'admin'},
  pago_bono:          {icono:'euro',       color:'var(--gd)',  label:'Pago de bono',       familia:'pagos'},
  cambio_bono:        {icono:'etiqueta',   color:'var(--gd)',  label:'Cambio de bono',     familia:'pagos'},
  entrenamiento:      {icono:'entreno',    color:'#3E7179',    label:'Entrenamiento',      familia:'entreno'},
}

// Un tono por familia, bien separados en el círculo cromático y todos desaturados
// para no salirse de la paleta. El color aquí identifica el filtro; el de TIPOS
// (más abajo, por evento) sigue codificando estado: rojo problema, verde resuelto.
const FAMILIAS: Record<string,{icono:string,label:string,color:string}> = {
  valoraciones: {icono:'valoracion', label:'Valoraciones', color:'#5A969E'}, // verde SIE
  clinico:      {icono:'patologia',  label:'Clínico',      color:'#B05A5A'}, // rojo
  alertas:      {icono:'alerta',     label:'Alertas',      color:'#C4703F'}, // terracota
  notas:        {icono:'nota',       label:'Notas',        color:'#C9A84C'}, // ámbar
  pagos:        {icono:'euro',       label:'Pagos',        color:'#6E9457'}, // verde musgo
  entreno:      {icono:'entreno',    label:'Entreno',      color:'#A0689C'}, // malva
  admin:        {icono:'ajustes',    label:'Gestión',      color:'#6B7FC4'}, // azul violeta
}

export default function TimelineTab({ pacienteId }: { pacienteId: string }) {
  const [eventos, setEventos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [familiasOcultas, setFamiliasOcultas] = useState<Set<string>>(new Set())
  const [periodo, setPeriodo] = useState<'todo'|'12m'|'3m'>('todo')

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

  // Sin tildes ni mayúsculas, para comparar títulos con etiquetas de forma fiable.
  const norm = (s: string) => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')

  // La mayoría de títulos ya arrancan por su etiqueta ("Molestia: Lumbar", "Baja del
  // servicio"). Solo se muestra la etiqueta cuando el título no la contiene ya.
  function etiquetaUtil(titulo: string, label: string) {
    if (!titulo) return false
    return !norm(titulo).includes(norm(label))
  }

  // Solo se muestra en valoraciones: ahí la pregunta no es "cuándo fue" sino "cuánto hace".
  function haceCuanto(f: string) {
    if (!f) return ''
    const meses = Math.floor((Date.now()-new Date(f+'T12:00:00').getTime())/(1000*60*60*24*30.44))
    if (meses < 1) return 'este mes'
    if (meses === 1) return 'hace 1 mes'
    if (meses < 12) return `hace ${meses} meses`
    const a = Math.floor(meses/12)
    return a === 1 ? 'hace 1 año' : `hace ${a} años`
  }

  // Corte por periodo. Se aplica antes que el filtro de familias, para que los
  // contadores de los chips reflejen lo que hay dentro del periodo elegido.
  const corte = (() => {
    if (periodo === 'todo') return null
    const d = new Date()
    d.setMonth(d.getMonth() - (periodo === '3m' ? 3 : 12))
    return d.toISOString().split('T')[0]
  })()
  const enPeriodo = corte ? eventos.filter(ev => ev.fecha && ev.fecha >= corte) : eventos

  function nFamilia(fam: string) {
    return enPeriodo.filter(ev => (TIPOS[ev.tipo]?.familia||'')===fam).length
  }

  const visibles = enPeriodo.filter(ev => !familiasOcultas.has(TIPOS[ev.tipo]?.familia||''))

  // Agrupación por mes, conservando el orden descendente que ya trae la consulta.
  const meses: { clave: string, label: string, eventos: any[] }[] = []
  visibles.forEach(ev => {
    const clave = (ev.fecha||'').slice(0,7)
    let g = meses[meses.length-1]
    if (!g || g.clave !== clave) {
      const d = new Date(clave+'-01T12:00:00')
      const txt = isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleDateString('es-ES',{month:'long',year:'numeric'})
      g = { clave, label: txt.charAt(0).toUpperCase()+txt.slice(1), eventos: [] }
      meses.push(g)
    }
    g.eventos.push(ev)
  })

  // Meses completos sin ningún evento entre dos grupos consecutivos.
  function hueco(claveNueva: string, claveVieja: string) {
    if (!claveNueva || !claveVieja) return 0
    const [aA,mA] = claveNueva.split('-').map(Number)
    const [aB,mB] = claveVieja.split('-').map(Number)
    if (!aA || !aB) return 0
    return Math.max(0, (aA*12+mA) - (aB*12+mB) - 1)
  }

  if (loading) return <div className="loading">Cargando historial...</div>

  return (
    <div>
      {/* FILTRO POR FAMILIAS */}
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:14,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'8px 12px'}}>
        <span style={{fontSize:11,color:'var(--gr)',marginRight:2}}>Filtrar</span>
        {Object.entries(FAMILIAS).map(([fam,info])=>{
          const oculta = familiasOcultas.has(fam)
          const n = nFamilia(fam)
          return (
            <span key={fam} onClick={()=>toggleFamilia(fam)} style={{fontSize:11,padding:'3px 10px',borderRadius:99,border:`1px solid ${oculta?'var(--bd)':info.color}`,cursor:'pointer',background:oculta?'var(--w)':info.color,color:oculta?'var(--grl)':'#fff',display:'flex',alignItems:'center',gap:4,opacity:oculta?.55:1,textDecoration:oculta?'line-through':'none'}}>
<Ic name={info.icono} size={11}/> {info.label} <b style={{fontWeight:600}}>{n}</b>
            </span>
          )
        })}

        <span style={{width:1,height:18,background:'var(--bd)',margin:'0 3px'}}/>
        <span style={{fontSize:11,color:'var(--gr)',marginRight:2}}>Periodo</span>
        {([['todo','Todo'],['12m','12 meses'],['3m','3 meses']] as const).map(([v,l])=>(
          <span key={v} onClick={()=>setPeriodo(v)} style={{fontSize:11,padding:'3px 10px',borderRadius:99,border:`1px solid ${periodo===v?'var(--gd)':'var(--bd)'}`,cursor:'pointer',background:periodo===v?'var(--gd)':'var(--w)',color:periodo===v?'#fff':'var(--gr)'}}>
            {l}
          </span>
        ))}
      </div>

      <div className="panel">
      {eventos.length===0 && (
        <div style={{textAlign:'center',padding:40,color:'var(--gr)',fontSize:13}}>Sin historial aún. Los sucesos del paciente aparecerán aquí.</div>
      )}
      {eventos.length>0 && visibles.length===0 && (
        <div style={{textAlign:'center',padding:30,color:'var(--gr)',fontSize:13}}>Sin eventos con los filtros activos.</div>
      )}

      <div style={{position:'relative',paddingLeft:38}}>
        {visibles.length>0 && <div style={{position:'absolute',left:15,top:0,bottom:0,width:2,background:'var(--bm)',borderRadius:2}}/>}

        {meses.map((grupo,gi) => (
          <div key={grupo.clave||gi}>
            {/* Hueco: meses enteros sin nada. Sin esto, un salto de un año se ve igual que uno de un día. */}
            {gi>0 && hueco(meses[gi-1].clave, grupo.clave)>0 && (
              <div style={{position:'relative',margin:'0 0 14px',paddingLeft:2}}>
                <span style={{position:'absolute',left:-27,top:3,width:8,height:8,borderRadius:'50%',background:'var(--w)',border:'2px solid var(--bm)'}}/>
                <span style={{fontSize:11,color:'var(--gr)',fontStyle:'italic'}}>
                  {hueco(meses[gi-1].clave, grupo.clave)===1 ? '1 mes sin eventos' : `${hueco(meses[gi-1].clave, grupo.clave)} meses sin eventos`}
                </span>
              </div>
            )}

            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:10,position:'relative'}}>
              <span style={{position:'absolute',left:-30,width:14,height:14,borderRadius:'50%',background:'var(--bm)',border:'2px solid var(--w)'}}/>
              <span style={{fontSize:11,fontWeight:600,color:'var(--gr)',letterSpacing:'.6px',textTransform:'uppercase',background:'var(--bl)',borderRadius:99,padding:'2px 11px'}}>{grupo.label}</span>
              <span style={{fontSize:11,color:'var(--gr)'}}>{grupo.eventos.length===1?'1 evento':`${grupo.eventos.length} eventos`}</span>
            </div>

            {grupo.eventos.map(ev => {
          const exp = expandidos.has(ev.id)
          const t = TIPOS[ev.tipo] || {icono:'nota', color:'var(--bd)', label:ev.tipo, familia:''}
          return (
            <div key={ev.id} style={{position:'relative',marginBottom:12}}>
              {/* El icono ES el marcador de la línea: antes había además un punto del mismo color. */}
              <div style={{position:'absolute',left:-38,top:6,width:30,height:30,borderRadius:'50%',background:'var(--w)',border:'2px solid var(--w)',display:'flex',alignItems:'center',justifyContent:'center',color:t.color,zIndex:1,overflow:'hidden'}}>
                {/* Capa aparte para el tinte: t.color puede ser var(--x) y no admite alfa concatenada. */}
                <div style={{position:'absolute',inset:0,background:t.color,opacity:.14}}/>
                <span style={{position:'relative',display:'inline-flex'}}><Ic name={t.icono} size={15}/></span>
              </div>
              {/* Sin borde por evento: el marcador y la línea ya los separan.
                  Al desplegar se tiñe de arena, que es lo que antes hacía el borde de color. */}
              <div className={`tl-ev ${exp?'tl-on':''} ${ev.descripcion?'tl-click':''}`}
                onClick={()=>ev.descripcion&&toggle(ev.id)}
                style={{padding:'6px 11px',marginLeft:-11,marginRight:-11}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'var(--n)'}}>{ev.titulo || t.label}</div>
                    <div style={{fontSize:12,color:'var(--gr)',marginTop:2}}>
                      {etiquetaUtil(ev.titulo, t.label) ? `${t.label} · ` : ''}{formatFecha(ev.fecha)}
                      {t.familia==='valoraciones' && <span style={{color:'var(--gd)',fontWeight:500}}> · {haceCuanto(ev.fecha)}</span>}
                    </div>
                  </div>
                  {ev.descripcion && (
                    <span style={{display:'inline-flex',color:'var(--grl)',flexShrink:0,transform:exp?'rotate(180deg)':'none',transition:'transform .15s'}}>
                      <Ic name="abajo" size={15}/>
                    </span>
                  )}
                </div>
                {exp && ev.descripcion && (
                  <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--bm)',fontSize:13,color:'var(--n)',lineHeight:1.6,whiteSpace:'pre-line'}}>{ev.descripcion}</div>
                )}
              </div>
            </div>
          )
            })}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
