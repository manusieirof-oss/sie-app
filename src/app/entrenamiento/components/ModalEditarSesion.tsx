'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { CAPACIDADES, REGIMENES, capacidadPorReps, repsPorCapacidad, descansoPorCapacidad, textoDescanso } from '@/lib/capacidades'
import { MODOS_PARTE, TIPOS_TIEMPO, modoParte, registrarSesion } from '@/lib/sesiones'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { similaresA } from '@/lib/ejercicios'

/**
 * Valor que se lee como etiqueta y se cambia al pulsarlo. Un `select` gris pesa lo
 * mismo esté relleno o vacío; aquí el dato se ve de un vistazo y el caret dice que
 * se puede tocar. Es el patrón `.chip-ed` que ya usa la ficha del paciente.
 */
function ChipMenu({ valor, opciones, onElegir, clase = '', vacio = '—', titulo }: {
  valor?: string
  opciones: string[]
  onElegir: (v: string) => void
  clase?: string
  vacio?: string
  titulo?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abierto])

  return (
    <div style={{ position: 'relative' }} ref={caja}>
      <button type="button" title={titulo} onClick={() => setAbierto(v => !v)}
        className={`chip-ed ${valor ? clase : 'chip-ed-n'}`} style={{ maxWidth: '100%' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{valor || vacio}</span>
        <Ic name="abajo" size={10} />
      </button>
      {abierto && (
        <div className="menu-flot" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4 }}>
          {opciones.map(o => (
            <button key={o} type="button" className="menu-it"
              onClick={() => { onElegir(o); setAbierto(false) }}>
              {valor === o && <Ic name="check" size={12} />}
              <span style={{ marginLeft: valor === o ? 0 : 20 }}>{o}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModalEditarSesion({ sesion, ejercicios, etiquetas = [], onGuardado, onCerrar, pacientes }: {
  sesion: any
  ejercicios: any[]
  etiquetas?: any[]
  onGuardado: () => void
  onCerrar: () => void
  pacientes?: any[]
}) {
  const [pacienteSel, setPacienteSel] = useState(sesion.paciente_id || '')
  const [busquedaPacModal, setBusquedaPacModal] = useState('')
  const [formSesion, setFormSesion] = useState({
    nombre: sesion.nombre || '',
    descripcion: sesion.descripcion || '',
    partes: sesion.partes || [],
  })
  const [parteActiva, setParteActiva] = useState(0)
  const [abrirBib, setAbrirBib] = useState(false)
  const [selBib, setSelBib] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [objetivosDisp, setObjetivosDisp] = useState<any[]>([])
  const [objetivosSel, setObjetivosSel] = useState<string[]>([])
  const [buscarObj, setBuscarObj] = useState('')
  const [abrirObj, setAbrirObj] = useState(false)
  const [verObj, setVerObj] = useState(false)
  const refObj = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const { data: objs } = await supabase.from('objetivos').select('id,nombre,color').eq('activo',true).order('nombre')
      setObjetivosDisp(objs||[])
      if (sesion.id) {
        const { data: rel } = await supabase.from('sesiones_objetivos').select('objetivo_id').eq('sesion_id', sesion.id)
        setObjetivosSel((rel||[]).map((r:any)=>r.objetivo_id))
      }
    })()
  }, [sesion.id])

  // El buscador de objetivos se cierra al pinchar fuera o con Escape. Obligar a volver
  // al botón para cerrarlo dejaba el panel tapando la pantalla.
  useEffect(() => {
    if (!abrirObj) return
    function fuera(e: MouseEvent) {
      if (refObj.current && !refObj.current.contains(e.target as Node)) { setAbrirObj(false); setBuscarObj('') }
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') { setAbrirObj(false); setBuscarObj('') }
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc) }
  }, [abrirObj])

  const parte = formSesion.partes[parteActiva]

  /**
   * Cómo se mide el ejercicio: por repeticiones, por tiempo o las dos.
   * Lo dice la biblioteca. Las sesiones antiguas no lo guardaban, así que se busca
   * por `ejercicio_id`; si tampoco aparece, se enseñan ambos campos y no se oculta
   * nada que pudiera estar ya relleno.
   */
  function medida(ej: any): string {
    if (ej?.tipo_medida) return ej.tipo_medida
    const bib = ejercicios.find((e:any)=>e.id===ej?.ejercicio_id)
    return bib?.tipo_medida || 'peso_tiempo'
  }

  // Ejercicios que comparten etiqueta con el último añadido a esta parte. Es la
  // pregunta real al montar una sesión: "¿qué más tengo para esto?".
  const ultimo = (parte?.ejercicios||[]).slice(-1)[0]
  const similares = (() => {
    if (!ultimo?.ejercicio_id) return []
    const base = ejercicios.find((e:any)=>e.id===ultimo.ejercicio_id)
    if (!base) return []
    const yaPuestos = new Set((parte?.ejercicios||[]).map((x:any)=>x.ejercicio_id))
    // Por músculo y patrón, no por material: ver lib/ejercicios.ts.
    return similaresA(ejercicios, base, 6, etiquetas).filter((e:any)=>!yaPuestos.has(e.id))
  })()

  function editarParte(cambios: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteActiva] = { ...partes[parteActiva], ...cambios }
      return { ...prev, partes }
    })
  }

  function editarEjercicio(ei: number, cambios: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const ejercicios = [...(partes[parteActiva].ejercicios||[])]
      ejercicios[ei] = { ...ejercicios[ei], ...cambios }
      partes[parteActiva] = { ...partes[parteActiva], ejercicios }
      return { ...prev, partes }
    })
  }

  function addEjercicio(ej: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      // tipo_medida se copia de la biblioteca: dice si el ejercicio va por
      // repeticiones o por tiempo, y así no se piden los dos a la vez.
      const configEj = { ejercicio_id:ej.id, nombre:ej.nombre, variante:'Bilateral', capacidad:'', regimen:'Concéntrico', series:'3', reps:'', peso:'', tiempo:'', nota:'', imagen_url:ej.imagen_url||'', variantes_disp:ej.variantes||[], tipo_medida:ej.tipo_medida||'peso_reps' }
      partes[parteActiva] = { ...partes[parteActiva], ejercicios: [...(partes[parteActiva].ejercicios||[]), configEj] }
      return { ...prev, partes }
    })
  }

  function quitarEjercicio(parteIdx: number, ejIdx: number) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: partes[parteIdx].ejercicios.filter((_:any, i:number) => i !== ejIdx) }
      return { ...prev, partes }
    })
  }

  async function guardarSesion() {
    if (!formSesion.nombre) { alert('El nombre es obligatorio'); return }
    const esNueva = !sesion.id
    const pid = sesion.paciente_id || pacienteSel || null
    setGuardando(true)
    let sesionId = sesion.id
    const campos = {
      nombre: formSesion.nombre, descripcion: formSesion.descripcion,
      partes: formSesion.partes,
    }
    if (esNueva) {
      const { data, error } = await supabase.from('sesiones')
        .insert({ ...campos, paciente_id:pid, estado:'lista' })
        .select('id').single()
      if (error || !data) { alert('Error al crear la sesión'); setGuardando(false); return }
      sesionId = data.id
      // Crear desde aquí dejaba la sesión sin evento, mientras que crearla desde la
      // ficha sí lo registraba: el historial dependía de por dónde hubieras entrado.
      if (pid) await registrarSesion(pid, `Sesión creada: ${formSesion.nombre}`)
    } else {
      const { error } = await supabase.from('sesiones').update(campos).eq('id', sesionId)
      if (error) { alert('No se pudo guardar la sesión: '+error.message); setGuardando(false); return }
    }

    // Objetivos: se calcula la diferencia en vez de borrar todo y reinsertar. Si el
    // insert fallaba después del delete, la sesión se quedaba sin ningún objetivo y
    // nadie se enteraba. Ahora un fallo deja lo que ya había.
    const { data: actuales } = await supabase.from('sesiones_objetivos')
      .select('objetivo_id').eq('sesion_id', sesionId)
    const previos: string[] = (actuales||[]).map((r:any)=>r.objetivo_id)
    const aAnadir = objetivosSel.filter(id=>!previos.includes(id))
    const aQuitar = previos.filter(id=>!objetivosSel.includes(id))

    if (aAnadir.length>0) {
      const { error } = await supabase.from('sesiones_objetivos')
        .insert(aAnadir.map(oid=>({ sesion_id:sesionId, objetivo_id:oid })))
      if (error) { alert('La sesión se guardó, pero sus objetivos no: '+error.message); setGuardando(false); onGuardado(); onCerrar(); return }
    }
    if (aQuitar.length>0) {
      await supabase.from('sesiones_objetivos').delete().eq('sesion_id', sesionId).in('objetivo_id', aQuitar)
    }

    setGuardando(false)
    onGuardado()
    onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      {/* Alto fijo, no "lo que ocupe el contenido". Con una sesión vacía el modal se
          encogía a cuatro dedos y la biblioteca, que se abre dentro, salía del mismo
          tamaño: no cabían ni dos filas de ejercicios. Además evita que el modal pegue
          saltos según vas añadiendo. */}
      <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'90vw',maxWidth:1100,height:'min(86vh, 860px)',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.15)'}}>
        {/* CABECERA */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            {!sesion.id && !sesion.paciente_id && pacientes && (
              <div style={{position:'relative',marginBottom:6}}>
                {pacienteSel ? (() => {
                  const p = pacientes.find((x:any)=>x.id===pacienteSel)
                  return (
                    <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 9px',border:'1px solid var(--bd)',borderRadius:6,background:'var(--bl)',fontSize:13}}>
                      <span style={{flex:1,color:'var(--n)'}}>{p?.nombre} {p?.apellidos}{p?.nombre_clinica?<span style={{color:'var(--gr)',fontSize:12}}> · {p.nombre_clinica}</span>:null}</span>
                      <button title="Quitar el paciente" onClick={()=>{setPacienteSel('');setBusquedaPacModal('')}} style={{color:'var(--gr)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="cerrar" size={13}/></button>
                    </div>
                  )
                })() : (
                  <>
                    <input className="input" value={busquedaPacModal} onChange={e=>setBusquedaPacModal(e.target.value)} placeholder="Paciente (opcional · vacío = plantilla)" style={{width:'100%'}}/>
                    {busquedaPacModal && (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,marginTop:4,border:'1px solid var(--bd)',borderRadius:6,maxHeight:200,overflowY:'auto',background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
                        {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPacModal.toLowerCase())).slice(0,20).map((p:any)=>(
                          <div key={p.id} onClick={()=>{setPacienteSel(p.id);setBusquedaPacModal('')}} style={{padding:'7px 10px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                            {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--gr)',fontSize:12}}> · {p.nombre_clinica}</span>:null}
                          </div>
                        ))}
                        {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPacModal.toLowerCase())).length===0 && (
                          <div style={{padding:'7px 10px',fontSize:12,color:'var(--gr)'}}>Sin resultados</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <input className="input" value={formSesion.nombre} onChange={e=>setFormSesion(p=>({...p,nombre:e.target.value}))} placeholder="Nombre de la sesión *" style={{fontSize:14,fontWeight:400,border:'none',background:'transparent',padding:'0',outline:'none',width:'100%'}} autoFocus/>
            <input className="input" value={formSesion.descripcion} onChange={e=>setFormSesion(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción / motivo (opcional)" style={{fontSize:13,color:'var(--gr)',border:'none',background:'transparent',padding:'0',outline:'none',width:'100%',marginTop:3}}/>
          </div>
          <button className="btn btn-p" onClick={guardarSesion} disabled={guardando}>{guardando?'Guardando…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
          <button className="modal-close" onClick={onCerrar} aria-label="Cerrar"><Ic name="cerrar" size={14}/></button>
        </div>

        {/* OBJETIVOS */}
        <div style={{padding:'10px 18px',borderBottom:'1px solid var(--bd)',background:'var(--bl)'}}>
          {objetivosDisp.length>0&&(
            <div style={{display:'flex',alignItems:'flex-start',gap:9,flexWrap:'wrap'}}>
              {/* Plegado por defecto: los objetivos se eligen una vez y luego solo
                  estorban mientras montas los ejercicios, que es el trabajo real. */}
              <button type="button" className="et-mini" onClick={()=>setVerObj(v=>!v)}
                style={{background:'none',border:'none',cursor:'pointer',padding:'5px 0 0',fontFamily:'inherit'}}>
                <Ic name="objetivo" size={12}/> Objetivos que cubre
                <span style={{color:'var(--gd)',fontWeight:400,textTransform:'none',letterSpacing:0}}>
                  {' · '}{objetivosSel.length || 'ninguno'}
                </span>
                <Ic name="abajo" size={11} style={{transform:verObj?'rotate(180deg)':'none',transition:'transform .12s'}}/>
              </button>

              {/* Solo se pintan los elegidos. Pintar el catálogo entero funcionaba con
                  ocho objetivos y deja de funcionar con doscientos: el resto se busca. */}
              {verObj && (
              <div style={{display:'flex',gap:5,flexWrap:'wrap',flex:1,minWidth:200}}>
                {objetivosSel.map(id=>{
                  const o = objetivosDisp.find((x:any)=>x.id===id)
                  if (!o) return null
                  return (
                    <button key={id} type="button" className="chip-obj" title="Quitar"
                      onClick={()=>setObjetivosSel(prev=>prev.filter(x=>x!==id))}
                      style={{borderColor:o.color||'var(--g)',background:o.color||'var(--g)',color:'#fff'}}>
                      {o.nombre}<Ic name="cerrar" size={11} style={{verticalAlign:'-1px',marginLeft:5}}/>
                    </button>
                  )
                })}
                <div style={{position:'relative'}} ref={refObj}>
                  <button type="button" className="chip-obj" style={{borderStyle:'dashed'}}
                    onClick={()=>setAbrirObj(v=>!v)}>+ Añadir</button>
                  {abrirObj && (
                    <div className="pop-busca">
                      <input className="input" autoFocus value={buscarObj} onChange={e=>setBuscarObj(e.target.value)}
                        placeholder="Buscar objetivo…"/>
                      <div style={{maxHeight:190,overflowY:'auto',marginTop:6}}>
                        {objetivosDisp
                          .filter((o:any)=>!objetivosSel.includes(o.id))
                          .filter((o:any)=>!buscarObj || (o.nombre||'').toLowerCase().includes(buscarObj.toLowerCase()))
                          .slice(0,40)
                          .map((o:any)=>(
                            <div key={o.id} className="pop-it"
                              onClick={()=>{setObjetivosSel(prev=>[...prev,o.id]);setBuscarObj('');setAbrirObj(false)}}>
                              <span style={{width:9,height:9,borderRadius:'50%',background:o.color||'var(--g)',flexShrink:0}}/>
                              {o.nombre}
                            </div>
                          ))}
                        {objetivosDisp.filter((o:any)=>!objetivosSel.includes(o.id) && (!buscarObj || (o.nombre||'').toLowerCase().includes(buscarObj.toLowerCase()))).length===0 && (
                          <div style={{padding:'7px 10px',fontSize:13,color:'var(--gr)'}}>Sin resultados</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',position:'relative'}}>
          {/* IZQUIERDA — PARTES */}
          <div style={{overflowY:'auto',padding:14,flex:1}}>
            <div style={{display:'flex',gap:4,marginBottom:10,flexWrap:'wrap',alignItems:'center'}}>
              {formSesion.partes.map((p:any,i:number)=>(
                <button key={i} onClick={()=>setParteActiva(i)}
                  className={`chip-obj ${parteActiva===i?'on':''}`} style={parteActiva===i?{borderColor:'var(--g)',background:'var(--g)',color:'#fff'}:undefined}>
                  {p.nombre} <span style={{opacity:.7}}>({(p.ejercicios||[]).length})</span>
                </button>
              ))}
              <button onClick={()=>{setFormSesion(p=>({...p,partes:[...p.partes,{nombre:`Parte ${p.partes.length+1}`,ejercicios:[]}]}));setParteActiva(formSesion.partes.length)}}
                className="chip-obj" style={{borderStyle:'dashed'}}>
                + Parte
              </button>
            </div>

            {/* NOMBRE Y RECORRIDO DE LA PARTE, en una sola línea. Antes eran tres filas
                —pestañas, nombre y una caja con el modo— y se comían el alto que
                necesitan los ejercicios, que es donde de verdad se trabaja.
                El modo vive en la parte y no en la sesión porque un entrenamiento normal
                mezcla: calentamiento suelto, bloque principal en circuito, accesorios
                sueltos otra vez. */}
            {formSesion.partes.length>0 && (
              <div className="parte-bar">
                <input value={parte?.nombre||''} onChange={e=>editarParte({nombre:e.target.value})}
                  className="parte-nom" placeholder="Nombre de la parte"/>

                <ChipMenu valor={modoParte(parte?.modo).nombre}
                  opciones={MODOS_PARTE.map(m=>m.nombre)}
                  titulo={modoParte(parte?.modo).ayuda}
                  onElegir={n=>{
                    const m = MODOS_PARTE.find(x=>x.nombre===n)
                    if (m) editarParte({modo:m.id})
                  }}/>

                {parte?.modo==='circuito' && (
                  <label className="par-in" title="Cuántas veces se recorre el bloque entero">
                    <input type="number" min={1} value={parte?.vueltas||''} placeholder="—"
                      onChange={e=>editarParte({vueltas:e.target.value})}/>
                    <span>vueltas</span>
                  </label>
                )}

                {parte?.modo==='tiempo' && (
                  <>
                    <ChipMenu valor={(TIPOS_TIEMPO.find(t=>t.id===(parte?.tipo_tiempo||'emom'))||TIPOS_TIEMPO[0]).nombre}
                      opciones={TIPOS_TIEMPO.map(t=>t.nombre)} clase="chip-ed-a"
                      titulo="Qué manda el reloj"
                      onElegir={n=>{
                        const t = TIPOS_TIEMPO.find(x=>x.nombre===n)
                        if (t) editarParte({tipo_tiempo:t.id})
                      }}/>
                    <label className="par-in" title="Duración total del bloque">
                      <input type="number" min={1} value={parte?.minutos||''} placeholder="—"
                        onChange={e=>editarParte({minutos:e.target.value})}/>
                      <span>min</span>
                    </label>
                    {parte?.tipo_tiempo==='intervalos' && (
                      <label className="par-in" title="Segundos de trabajo y de descanso, por ejemplo 40/20">
                        <input value={parte?.intervalo||''} placeholder="40/20" style={{width:52}}
                          onChange={e=>editarParte({intervalo:e.target.value})}/>
                        <span>trab./desc.</span>
                      </label>
                    )}
                  </>
                )}

                {/* Descanso del RECORRIDO, distinto del de entre series de un ejercicio.
                    Qué separa depende del modo, así que cambia la etiqueta, no el campo. */}
                {parte?.modo!=='tiempo' && (
                  <label className="par-in" title="Descanso del recorrido, distinto del descanso entre series de cada ejercicio">
                    <input type="number" min={0} step={5} value={parte?.descanso||''} placeholder="seg"
                      onChange={e=>editarParte({descanso:e.target.value})}/>
                    <span>{parte?.modo==='circuito' ? 'entre vueltas'
                      : parte?.modo==='superserie' ? 'entre grupos' : 'entre ejercicios'}</span>
                  </label>
                )}

                <div style={{flex:1}}/>
                {formSesion.partes.length>1&&(
                  <button title="Eliminar esta parte" className="fila-x" style={{opacity:1}}
                    onClick={()=>{setFormSesion(prev=>({...prev,partes:prev.partes.filter((_:any,i:number)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}>
                    <Ic name="papelera" size={14}/>
                  </button>
                )}
              </div>
            )}

            {(formSesion.partes[parteActiva]?.ejercicios||[]).length===0?(
              <div style={{textAlign:'center',padding:30,color:'var(--gr)',fontSize:13,border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)'}}>
                Sin ejercicios todavía
              </div>
            ):(
              <div className="tabla-ej">
                <div className="ej-cab">
                  <span>Ejercicio</span>
                  <span>Cómo se hace</span>
                  <span className="c">Series</span>
                  <span className="c">Reps · s</span>
                  <span className="c">Peso</span>
                  <span className="c">Descanso</span>
                  <span/>
                </div>

                {(formSesion.partes[parteActiva]?.ejercicios||[]).map((ej:any,ei:number)=>{
                  const med = medida(ej)
                  return (
                  <div key={ei} className="ej-row">
                    <div className="ej-nom">
                      {parte?.modo==='superserie' && (
                        <select value={ej.grupo||'A'} onChange={e=>editarEjercicio(ei,{grupo:e.target.value})}
                          style={{width:44,textAlign:'center',fontWeight:600,color:'var(--gd)',flexShrink:0}}
                          title="Los ejercicios del mismo grupo se hacen seguidos">
                          {['A','B','C','D','E'].map(g=><option key={g} value={g}>{g}</option>)}
                        </select>
                      )}
                      {ej.imagen_url
                        ? <img src={ej.imagen_url} alt={ej.nombre} className="ej-img"/>
                        : <div className="ej-img ej-img-no"><Ic name="fuerza" size={26}/></div>}
                      {/* Nombre y variante centrados contra la foto, y el nombre parte
                          en varias líneas antes que estrujar la columna de datos. */}
                      <div style={{minWidth:0}}>
                        <div className="ej-txt">{ej.nombre}</div>
                        {/* La ejecución la marca el EJERCICIO, no la sesión: se enseña
                            pero no se toca. Si hace falta otra, se elige otro ejercicio
                            de la biblioteca. Por eso es `.badge` y no `.chip-ed`, que en
                            este sistema significa "esto se puede cambiar". */}
                        {ej.variante && (
                          <div className="ej-sub">
                            <span className="badge badge-g" title="Lo define el ejercicio en la biblioteca">
                              {ej.variante}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Régimen y capacidad juntos: los dos dicen cómo se trabaja,
                        no cuánto. Van antes de los números por eso mismo. */}
                    <div className="celda apilada" data-l="Cómo se hace">
                      <ChipMenu valor={ej.regimen||'Concéntrico'} opciones={[...REGIMENES]}
                        titulo="Cómo trabaja el músculo: concéntrico al acortarse, excéntrico al frenar, isométrico sin moverse"
                        onElegir={v=>editarEjercicio(ei,{regimen:v})}/>
                      <ChipMenu valor={ej.capacidad} opciones={CAPACIDADES.map(c=>c.nombre)}
                        clase="chip-ed-a" vacio="Capacidad" titulo="Capacidad que se entrena"
                        onElegir={cap=>{
                          const rep=repsPorCapacidad(cap)
                          const desc=descansoPorCapacidad(cap)
                          // El descanso sugerido se recalcula mientras no lo hayas
                          // tocado tú. Antes solo miraba si estaba vacío, así que en
                          // cuanto se autocompletaba una vez ya no volvía a cambiar.
                          editarEjercicio(ei,{capacidad:cap,...(rep?{reps:rep}:{}),...(desc&&!ej.descanso_manual?{descanso:desc}:{})})
                        }}/>
                    </div>

                    <div className="celda" data-l="Series">
                      <input type="number" className="c" value={ej.series||''} placeholder="3"
                        title="Cuántas veces se repite el ejercicio"
                        onChange={e=>editarEjercicio(ei,{series:e.target.value})}/>
                    </div>

                    {/* Una sola columna: repeticiones o duración, según cómo se mida
                        el ejercicio en la biblioteca. Nunca las dos. */}
                    <div className="celda" data-l={med==='tiempo'?'Duración · s':'Repeticiones'}>
                      {med==='tiempo'
                        ? <input type="number" className="c" value={ej.tiempo||''} placeholder="seg"
                            title="Lo que dura cada serie, en segundos"
                            onChange={e=>editarEjercicio(ei,{tiempo:e.target.value})}/>
                        : <input type="number" className="c" value={ej.reps||''} placeholder="10"
                            title="Repeticiones en cada serie"
                            onChange={e=>{
                              const val=e.target.value
                              const cap=capacidadPorReps(val)
                              editarEjercicio(ei,{reps:val,...(cap?{capacidad:cap}:{})})
                            }}/>}
                    </div>

                    <div className="celda" data-l="Peso · kg">
                      {med==='tiempo'
                        ? <span className="vacio" title="Este ejercicio no se mide con carga">—</span>
                        : <input type="number" className="c" value={ej.peso||''} placeholder="kg"
                            title="Carga en kilos"
                            onChange={e=>editarEjercicio(ei,{peso:e.target.value})}/>}
                    </div>

                    <div className="celda" data-l="Descanso · s">
                      <input type="number" step={5} className="c" value={ej.descanso||''} placeholder="seg"
                        title="Descanso entre series, en segundos"
                        onChange={e=>editarEjercicio(ei,{descanso:e.target.value,descanso_manual:true})}/>
                    </div>

                    <button title="Quitar el ejercicio" className="fila-x" style={{opacity:1}}
                      onClick={()=>quitarEjercicio(parteActiva,ei)}><Ic name="cerrar" size={13}/></button>

                    {/* La nota, entera y debajo de todo. Metida entre los campos se
                        quedaba en un hueco estrecho donde no cabía nada. */}
                    <div className="ej-nota">
                      <span>Nota</span>
                      <input value={ej.nota||''} onChange={e=>editarEjercicio(ei,{nota:e.target.value})}
                        placeholder="Lo que haya que recordar de este ejercicio"/>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            {/* La biblioteca se abre a ráfagas: metes cuatro ejercicios y luego pasas
                el rato ajustando series. Como panel fijo se comía un tercio del ancho
                todo el tiempo para algo que usas veinte segundos. */}
            {formSesion.partes.length>0 && (
              <button className="btn btn-s" style={{marginTop:12,width:'100%',justifyContent:'center'}}
                onClick={()=>{setSelBib([]);setAbrirBib(true)}}>
                <Ic name="mas" size={13}/> Añadir ejercicios desde la biblioteca
              </button>
            )}
          </div>

          {abrirBib && (
            <div className="capa-bib">
              <div className="capa-bib-h">
                <span style={{fontSize:14,color:'var(--n)',flex:1}}>
                  Biblioteca
                  <span style={{fontSize:13,color:'var(--gr)'}}> · añadir a {parte?.nombre || 'la parte'}</span>
                </span>
                <button className="btn btn-p" disabled={selBib.length===0}
                  style={selBib.length===0?{opacity:.5,cursor:'default'}:undefined}
                  onClick={()=>{
                    // De golpe y en el orden en que se marcaron, no el del catálogo.
                    selBib.forEach(id=>{
                      const e = ejercicios.find((x:any)=>x.id===id)
                      if (e) addEjercicio(e)
                    })
                    setSelBib([]); setAbrirBib(false)
                  }}>
                  <Ic name="check" size={13}/> Añadir{selBib.length>0?` ${selBib.length}`:''}
                </button>
                <button className="modal-close" aria-label="Cerrar biblioteca"
                  onClick={()=>{setSelBib([]);setAbrirBib(false)}}><Ic name="cerrar" size={16}/></button>
              </div>
              <div className="capa-bib-c">
                <ExploradorEjercicios
                  ejercicios={ejercicios}
                  etiquetas={etiquetas}
                  seleccion={selBib}
                  onAlternar={(e:any)=>setSelBib(prev=>prev.includes(e.id)?prev.filter(x=>x!==e.id):[...prev,e.id])}
                  sugeridos={ultimo ? { titulo:`Parecidos a ${ultimo.nombre}`, items:similares } : undefined}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
