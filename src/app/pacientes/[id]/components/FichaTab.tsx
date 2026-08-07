'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { iconTipoClase, nombreTipoClase } from '@/lib/tipos'
import Consentimientos from './Consentimientos'
import { guardarVias } from '@/lib/objetivos'
import MetasObjetivo from './MetasObjetivo'
import { cambiarFase } from '@/lib/metas'
import { ordenAnatomico } from '@/lib/anatomia'

const TIPOS_AL: Record<string,string> = {dolor:'Dolor / molestia',lesion:'Lesión',cita_medica:'Cita médica',personal:'Situación personal',duda:'Duda / consulta',otro:'Otro'}
const LBL_PAGO: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }
const DOT_PAGO: Record<string,string> = { pagado:'var(--g)', pendiente:'var(--amb)', impago:'var(--red)' }

const fmtDia = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})
const fmtLargo = (f:string) => new Date(f+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})

function haceCuanto(f:string) {
  const meses = Math.floor((Date.now()-new Date(f+'T12:00:00').getTime())/(1000*60*60*24*30.44))
  if (meses < 1) return 'este mes'
  if (meses === 1) return 'hace 1 mes'
  if (meses < 12) return `hace ${meses} meses`
  const a = Math.floor(meses/12)
  return a === 1 ? 'hace 1 año' : `hace ${a} años`
}

export default function FichaTab({ pac, bono, recuperaciones, editando, form, setForm, setModalBono, bonoLabel, mes, anio, alertas, cerrarAlerta, cambiarPago, tiposClase = [], cambiarTipoClase }: any) {
  const [valoracion, setValoracion] = useState<any>(null)
  const [objetivosTrabajo, setObjetivosTrabajo] = useState<any[]>([])
  const [menuTipo, setMenuTipo] = useState<any>(null)
  const [menuPago, setMenuPago] = useState<any>(null)
  const [anamnesisAbierta, setAnamnesisAbierta] = useState(false)
  const [guardandoVia, setGuardandoVia] = useState<string|null>(null)
  const [metas, setMetas] = useState<any[]>([])
  const [resultadosTests, setResultadosTests] = useState<any[]>([])
  const [testsLib, setTestsLib] = useState<any[]>([])
  const [etiquetasLib, setEtiquetasLib] = useState<any[]>([])
  const [modalAnadir, setModalAnadir] = useState(false)
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [buscarObj, setBuscarObj] = useState('')
  const [selObj, setSelObj] = useState<string[]>([])
  const [famObj, setFamObj] = useState('')
  const [zonaObj, setZonaObj] = useState('')

  /**
   * Asigna varios objetivos de golpe.
   *
   * De uno en uno obligaba a abrir y cerrar el modal por cada uno, y lo normal es poner
   * tres o cuatro a la vez: al valorar un hombro salen fuerza, movilidad y algún
   * cualitativo del mismo tirón.
   *
   * Nacen SIN vías y sin metas: un objetivo métrico se cierra por sus metas, y ponerle una
   * vía de relleno haría que `estaLogrado` lo diera por cumplido en cuanto alguien la
   * marcara, sin haber medido nada.
   */
  async function anadirObjetivos(lista:any[]) {
    if (lista.length===0) return
    setGuardandoVia('anadir')
    const { error } = await supabase.from('pacientes_objetivos').insert(
      lista.map((o:any)=>({ paciente_id: pac.id, objetivo_id: o.id, origen: 'manual', vias: [],
        fase_actual: o.tipo==='fase' ? 1 : null })))
    setGuardandoVia(null)
    if (error) { alert(error.message); return }
    // Un solo evento con el total: abrir cuatro objetivos a la vez es una decisión, no
    // cuatro hitos en la cronología.
    await supabase.from('eventos_paciente').insert({
      paciente_id: pac.id, tipo: 'objetivo',
      titulo: lista.length===1
        ? `Objetivo abierto: ${lista[0].nombre}`
        : `${lista.length} objetivos abiertos`,
      descripcion: lista.length===1 ? 'Añadido desde la ficha' : lista.map((o:any)=>o.nombre).join(', '),
      fecha: new Date().toISOString().split('T')[0],
    })
    setModalAnadir(false); setBuscarObj(''); setSelObj([]); cargarObjetivos()
  }

  function cargarObjetivos() {
    if (!pac?.id) return
    supabase.from('pacientes_objetivos').select('objetivo_id, origen, vias, logrado, fecha_logrado, fase_actual, objetivos(id,nombre,color,descripcion,tipo,metrica,movimientos,fases)').eq('paciente_id', pac.id).then(({data}) => {
      setObjetivosTrabajo((data||[]).map((r:any)=>({...r.objetivos, origen:r.origen, vias:r.vias||[], logrado:r.logrado, fecha_logrado:r.fecha_logrado, fase_actual:r.fase_actual})).filter((o:any)=>o.id))
    })
    // Las metas y las mediciones con las que se evalúan. Van juntas porque `estadoDeMeta`
    // necesita las dos y traerlas por separado abriría la puerta a pintar con datos viejos.
    supabase.from('objetivos_metas').select('*').eq('paciente_id', pac.id).order('created_at')
      .then(({data}) => setMetas(data||[]))
    supabase.from('resultados_tests').select('test_id,lado,fecha,items_resultado').eq('paciente_id', pac.id)
      .then(({data}) => setResultadosTests(data||[]))
    supabase.from('tests').select('id,nombre,items,etiquetas_relacionadas').order('nombre').then(({data}) => setTestsLib(data||[]))
    supabase.from('etiquetas').select('id,nombre').then(({data}) => setEtiquetasLib(data||[]))
    supabase.from('objetivos').select('id,nombre,descripcion,color,tipo,metrica,movimientos,fases,articulacion_id')
      .eq('activo', true).order('nombre').then(({data}) => setCatalogo(data||[]))
  }

  useEffect(() => {
    if (pac?.id) {
      supabase.from('valoraciones').select('*').eq('paciente_id', pac.id).order('fecha', {ascending: false}).limit(1).then(({data}) => {
        if (data && data.length > 0) {
          const v = data[0]
          const eg = v.estado_general ? JSON.parse(v.estado_general) : {}
          setValoracion({...v, ...eg})
        }
      })
      cargarObjetivos()
    }
  }, [pac?.id])

  // Cierre manual de una vía. Lo automático (test negativo, ítem del taller) cubre
  // el caso normal, pero hay vías que se resuelven fuera de la app —el paciente ya
  // no tiene dolor, se decide dar por bueno el gesto— y sin esto no había forma de
  // cerrar un objetivo. Se marca la vía, no el objetivo: así el "logrado" sigue
  // saliendo de la misma regla y no hay dos verdades.
  // Objetivos sin ninguna vía: filas anteriores al modelo de vías. Como "logrado"
  // exige que todas las vías estén resueltas y no hay ninguna, jamás podrían cerrarse.
  // Se les crea una vía de cierre manual en vez de tocar `logrado` a mano, para que
  // la regla siga siendo la única que decide y el objetivo se pueda reabrir igual.
  async function cerrarSinVias(o:any) {
    const via = { tipo:'manual', ref:'', etiqueta:'Cierre manual', resuelto:true,
      fecha_resuelto:new Date().toISOString().split('T')[0] }
    setGuardandoVia(o.id)
    const r = await guardarVias(pac.id, o.id, [via], { logradoAntes: !!o.logrado, contexto: 'la ficha' })
    setGuardandoVia(null)
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); return }
    cargarObjetivos()
  }

  async function toggleVia(o:any, vi:number) {
    const vias = (Array.isArray(o.vias)?o.vias:[]).map((v:any,i:number)=>
      i===vi ? {...v, resuelto:!v.resuelto, fecha_resuelto:!v.resuelto?new Date().toISOString().split('T')[0]:null} : v)
    setGuardandoVia(o.id)
    const r = await guardarVias(pac.id, o.id, vias, { logradoAntes: !!o.logrado, contexto: 'la ficha' })
    setGuardandoVia(null)
    if (!r.ok) { alert('No se pudo guardar: ' + r.error); return }
    cargarObjetivos()
  }

  // Los logrados se apartan a un desplegable: el bloque tiene que enseñar en qué se
  // trabaja ahora. El hito no se pierde —queda su evento en el historial— y desde
  // aquí se puede reabrir tocando una vía.
  const objetivosActivos = objetivosTrabajo.filter((o:any)=>!o.logrado)
  const objetivosLogrados = objetivosTrabajo.filter((o:any)=>o.logrado)
    .sort((a:any,b:any)=>(b.fecha_logrado||'').localeCompare(a.fecha_logrado||''))

  const pintarObjetivo = (o:any) => {
    const vias = Array.isArray(o.vias)?o.vias:[]
    const pendientes = vias.filter((v:any)=>!v.resuelto).length
    return (
      <div key={o.id} className="obj-t" style={{borderLeftColor:o.logrado?'var(--gm)':(o.color||'var(--g)')}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:7}}>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:o.logrado?'var(--gr)':'var(--n)',textDecoration:o.logrado?'line-through':'none'}}>{o.nombre}</div>
            {o.descripcion && <div style={{fontSize:12,color:'var(--gr)',marginTop:2,lineHeight:1.4}}>{o.descripcion}</div>}
          </div>
          {o.logrado
            ? <span style={{fontSize:12,color:'var(--gd)',flexShrink:0,display:'inline-flex',alignItems:'center',gap:3}}><Ic name="check" size={12}/>Logrado</span>
            : (vias.length>0 && <span style={{fontSize:12,color:'var(--gr)',flexShrink:0}}>{pendientes} de {vias.length}</span>)
          }
        </div>
        {o.logrado && o.fecha_logrado && <div style={{fontSize:12,color:'var(--gd)',marginTop:2}}>el {fmtDia(o.fecha_logrado)}</div>}
        {/* Los métricos se cierran con metas, no con vías: el número lo pone una medición.
            Por eso no se les ofrece "dar por logrado" a secas. */}
        {o.tipo==='metrico' && !o.logrado && (
          <MetasObjetivo
            pacienteId={pac.id}
            objetivo={o}
            metas={metas.filter((m:any)=>m.objetivo_id===o.id)}
            resultados={resultadosTests}
            tests={testsLib}
            etiquetas={etiquetasLib}
            onCambio={cargarObjetivos}
          />
        )}
        {/* La barra se pulsa para cambiar de fase. Antes solo se pintaba: era un
            indicador de progreso que no se podía mover. Lo normal es decidirlo al montar
            la tanda nueva, y desde allí se avisa, pero el gesto vive aquí. */}
        {o.tipo==='fase' && o.fases > 0 && !o.logrado && (
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6}}>
            {Array.from({length:o.fases}).map((_,i)=>(
              <button key={i} disabled={guardandoVia===o.id}
                title={`Pasar a la fase ${i+1}${i+1===o.fase_actual?' (es la actual)':''}`}
                onClick={async()=>{
                  setGuardandoVia(o.id)
                  await cambiarFase(pac.id, o.id, i+1, o.nombre)
                  setGuardandoVia(null); cargarObjetivos()
                }}
                style={{
                  flex:1,height:7,borderRadius:3,border:'none',padding:0,cursor:'pointer',
                  background: i < (o.fase_actual||0) ? (o.color||'var(--g)') : 'var(--bm)',
                }}/>
            ))}
            <span style={{fontSize:12,color:'var(--gr)',flexShrink:0}}>
              {o.fase_actual ? `Fase ${o.fase_actual} de ${o.fases}` : 'Sin empezar'}
            </span>
            {/* La última fase no cierra el objetivo sola: "mantenimiento y prevención" no
                se acaba nunca. Cerrarlo es una decisión, no una consecuencia. */}
            {o.fase_actual >= o.fases && (
              <button className="btn btn-t btn-sm" disabled={guardandoVia===o.id}
                onClick={()=>cerrarSinVias(o)}>Dar por logrado</button>
            )}
          </div>
        )}
        {vias.length===0 && !o.logrado && o.tipo!=='metrico' && o.tipo!=='fase' && (
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'var(--gr)'}}>Sin nada que marcar · no vino de un test ni de un ejercicio</span>
            <button className="btn btn-t btn-sm" disabled={guardandoVia===o.id} onClick={()=>cerrarSinVias(o)}>
              Dar por logrado
            </button>
          </div>
        )}
        {vias.length>0 && (
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:6}}>
            {vias.map((v:any,vi:number)=>(
              <button key={vi} type="button" disabled={guardandoVia===o.id}
                onClick={()=>toggleVia(o,vi)}
                title={v.resuelto
                  ? `Resuelto${v.fecha_resuelto?' el '+fmtLargo(v.fecha_resuelto):''} · pulsa para reabrir`
                  : 'Pendiente · pulsa para darla por resuelta'}
                className={`pill pill-o pill-b ${v.resuelto?'on':''}`}
                style={{textDecoration:v.resuelto?'line-through':'none'}}>
                <Ic name={v.resuelto ? 'check' : v.tipo==='test'||v.tipo==='test_item' ? 'buscar' : v.tipo==='ejecucion' ? 'fuerza' : 'editar'}
                  size={10} style={{verticalAlign:'-1px',marginRight:3}}/>{v.etiqueta||v.tipo}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const recPendientes = (recuperaciones||[]).filter((r:any)=>r.estado==='pendiente')
  const recVence = recPendientes.map((r:any)=>r.fecha_limite).filter(Boolean).sort()[0]
  const hayAtencion = (alertas?.length>0) || recPendientes.length>0 || bono?.estado_pago==='impago'
  const objPide = valoracion?.objetivos || []
  // El bloque se pinta SIEMPRE, aunque esté vacío. Antes se escondía si no había nada, y
  // desde que se pueden añadir a mano eso dejaba sin salida al paciente sin objetivos, que
  // es justo al que hay que ponérselos. Los estados vacíos ya dicen lo suyo.
  const hayObjetivos = true
  const anamLarga = (valoracion?.anamnesis||'').length > 260
  // La valoración cargada es siempre la más reciente: puede ser la inicial o una revaloración.
  const tipoVal = valoracion?.tipo==='revaloracion' ? 'Revaloración' : 'Valoración inicial'

  return (
    <div className="panel">
      {/* 1. LO QUE REQUIERE ATENCIÓN — no se pinta si el paciente está en orden */}
      {hayAtencion && (
        <div className="atencion">
          <div className="at-h"><Ic name="alerta" size={16}/> Requiere atención</div>
          {(alertas||[]).map((a:any)=>(
            <div key={a.id} className="at-i">
              <div style={{flex:1}}>
                {TIPOS_AL[a.tipo]||a.tipo}
                {a.afecta_sesion && <span style={{color:'var(--red)',fontSize:12,marginLeft:6}}>· afecta sesión</span>}
                {a.descripcion && <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{a.descripcion}</div>}
              </div>
              <button onClick={()=>cerrarAlerta(a.id)} style={{fontSize:11,color:'var(--gd)',background:'none',border:'1px solid var(--g)',borderRadius:6,padding:'2px 9px',cursor:'pointer',flexShrink:0}}>Cerrar</button>
            </div>
          ))}
          {recPendientes.length>0 && (
            <div className="at-i">
              {recPendientes.length===1 ? '1 clase sin recuperar' : `${recPendientes.length} clases sin recuperar`}
              {recVence && <span style={{color:'var(--gr)',fontSize:12,marginLeft:6}}>· la primera vence el {fmtDia(recVence)}</span>}
            </div>
          )}
          {bono?.estado_pago==='impago' && (
            <div className="at-i">Cuota de {mes}/{anio} marcada como impago</div>
          )}
        </div>
      )}

      {/* 2. NOTAS FIJAS — contexto que hay que saber antes de la sesión */}
      {editando ? (
        <div className="card">
          <div className="field" style={{marginBottom:0}}>
            <label><span className="ct-l"><Ic name="pin" size={11}/> Notas</span> <span className="subt">· información del paciente</span></label>
            <textarea className="input" value={form.notas_fijas||''} onChange={e=>setForm((p:any)=>({...p,notas_fijas:e.target.value}))} style={{minHeight:60}} placeholder="ej. Viene en silla de ruedas · Prefiere entrenar de pie"/>
          </div>
        </div>
      ) : pac.notas_fijas ? (
        <div className="nota-fija">
          <span style={{display:'inline-flex',color:'var(--g)',flexShrink:0,marginTop:1}}><Ic name="pin" size={14}/></span>
          {pac.notas_fijas}
        </div>
      ) : null}

      {/* 3. OBJETIVOS — el bloque principal, a ancho completo */}
      {hayObjetivos && (
        <div className="sec">
          <div className="sec-h">
            <span className="ct-l"><Ic name="objetivo" size={13}/> Objetivos</span>
          </div>
          <div className="g2">
            <div>
              <div className="sec-sub">
                Lo que pide
                {valoracion?.fecha && <> · {tipoVal.toLowerCase()} del {fmtLargo(valoracion.fecha)}, {haceCuanto(valoracion.fecha)}</>}
              </div>
              {objPide.length===0 && !valoracion?.deseo && <div className="muted">Sin objetivos recogidos</div>}
              {objPide.map((o:string,i:number)=>(
                <div key={i} style={{fontSize:13,color:'var(--n)',lineHeight:1.9,display:'flex',gap:8}}>
                  <span style={{color:'var(--gr)',flexShrink:0}}>{i+1}.</span>{o}
                </div>
              ))}
              {valoracion?.deseo && (
                <div style={{marginTop:9,padding:'8px 10px',background:'var(--ambl)',fontSize:12,color:'#7A5800',display:'flex',gap:6,alignItems:'flex-start'}}>
                  <span style={{display:'inline-flex',flexShrink:0,marginTop:1}}><Ic name="estrella" size={12}/></span>{valoracion.deseo}
                </div>
              )}
            </div>
            <div>
              <div className="sec-sub" style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{flex:1}}>Lo que prescribimos · de tests y ejercicios</span>
                {/* Hasta ahora solo llegaban solos, cuando un test daba positivo. Los
                    métricos casi nunca vienen de ahí: se deciden mirando una medición. */}
                <button className="btn btn-t btn-sm" onClick={()=>{setSelObj([]);setBuscarObj('');setFamObj('');setZonaObj('');setModalAnadir(true)}}>
                  <Ic name="mas" size={12}/> Añadir
                </button>
              </div>
              {objetivosTrabajo.length===0 && <div className="muted">Sin objetivos de trabajo</div>}
              {objetivosActivos.length===0 && objetivosLogrados.length>0 && <div className="muted">Todos los objetivos logrados</div>}
              {objetivosActivos.map(pintarObjetivo)}
              {objetivosLogrados.length>0 && (
                <details style={{marginTop:objetivosActivos.length>0?9:0}}>
                  <summary className="det-sum">
                    <Ic name="trofeo" size={12} style={{verticalAlign:'-2px',marginRight:5}}/>
                    Logrados · {objetivosLogrados.length}
                  </summary>
                  <div style={{marginTop:6}}>{objetivosLogrados.map(pintarObjetivo)}</div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AÑADIR OBJETIVO · hasta ahora solo llegaban solos, desde un test o desde el taller */}
      {modalAnadir && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalAnadir(false)}}>
          <div className="modal">
            <div className="modal-title">
              Añadir objetivo
              <button className="modal-close" onClick={()=>setModalAnadir(false)}><Ic name="cerrar" size={15}/></button>
            </div>
            <input className="input" autoFocus value={buscarObj} placeholder="Buscar en la biblioteca…"
              onChange={e=>setBuscarObj(e.target.value)} style={{marginBottom:8}}/>

            {/* Los filtros a la vista, no escondidos tras el buscador: con 36 fichas lo
                normal es no saber cómo se llama la que buscas pero sí de qué zona es. */}
            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
              {[['metrico','Medibles'],['fase','Por fases'],['cualitativo','Cualitativos']].map(([v,l])=>(
                <button key={v} className={`chip-sel ${famObj===v?'on':''}`}
                  onClick={()=>setFamObj(famObj===v?'':v)}>{l}</button>
              ))}
            </div>
            {(() => {
              const zonas = Array.from(new Set(catalogo.map((o:any)=>o.articulacion_id).filter(Boolean)))
                .map((id:any)=>({ id, nombre: etiquetasLib.find((e:any)=>e.id===id)?.nombre || '' }))
                .filter((z:any)=>z.nombre)
                .sort((a:any,b:any)=>ordenAnatomico(a.nombre,b.nombre))
              if (zonas.length===0) return null
              return (
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
                  <button className={`chip-sel ${!zonaObj?'on':''}`} onClick={()=>setZonaObj('')}>Todas</button>
                  {zonas.map((z:any)=>(
                    <button key={z.id} className={`chip-sel ${zonaObj===z.id?'on':''}`}
                      onClick={()=>setZonaObj(zonaObj===z.id?'':z.id)}>{z.nombre}</button>
                  ))}
                </div>
              )
            })()}

            <div style={{maxHeight:'46vh',overflowY:'auto',display:'grid',gap:3}}>
              {(() => {
                const q = buscarObj.trim().toLowerCase()
                const yaTiene = new Set(objetivosTrabajo.map((o:any)=>o.id))
                const lista = catalogo.filter((o:any)=>
                  (!q || o.nombre.toLowerCase().includes(q) || (o.descripcion||'').toLowerCase().includes(q)) &&
                  (!famObj || (o.tipo||'cualitativo')===famObj) &&
                  (!zonaObj || o.articulacion_id===zonaObj))
                if (lista.length===0) return <div className="muted">Ninguno coincide.</div>
                return lista.map((o:any)=>{
                  const tiene = yaTiene.has(o.id)
                  const sel = selObj.includes(o.id)
                  return (
                    <div key={o.id}
                      onClick={()=>{ if(!tiene) setSelObj(s=>sel?s.filter(x=>x!==o.id):[...s,o.id]) }}
                      className="fila-p"
                      style={{borderLeftColor:o.color||'var(--g)',display:'flex',alignItems:'center',gap:8,
                        textAlign:'left',cursor:tiene?'default':'pointer',opacity:tiene?.5:1,
                        background:sel?'var(--gl)':'transparent'}}>
                      <span className={`chk ${sel?'on':''}`} style={{flexShrink:0,visibility:tiene?'hidden':'visible'}}>
                        {sel&&<Ic name="check" size={12}/>}
                      </span>
                      <span style={{flex:1,minWidth:0}}>
                        <span style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:'var(--n)'}}>
                          {o.nombre}
                          {o.tipo==='metrico' && o.metrica && <span className="pill pill-o on">{o.metrica==='fuerza'?'Fuerza':'Movilidad'}</span>}
                          {o.tipo==='fase' && <span className="pill pill-soft">{o.fases} fases</span>}
                        </span>
                        {o.descripcion && (
                          <span style={{display:'block',fontSize:12,color:'var(--gr)',lineHeight:1.4,marginTop:2}}>
                            {o.descripcion.slice(0,110)}{o.descripcion.length>110?'…':''}
                          </span>
                        )}
                      </span>
                      {tiene && <span style={{fontSize:12,color:'var(--gd)',flexShrink:0}}>Ya lo tiene</span>}
                    </div>
                  )
                })
              })()}
            </div>

            <div style={{display:'flex',gap:7,alignItems:'center',marginTop:10}}>
              <span style={{flex:1,fontSize:12,color:'var(--gr)',lineHeight:1.5}}>
                {selObj.length===0
                  ? 'Los medibles se abren sin metas: las pones después.'
                  : `${selObj.length} seleccionado${selObj.length>1?'s':''}`}
              </span>
              <button className="btn btn-t btn-sm" onClick={()=>setModalAnadir(false)}>Cancelar</button>
              <button className="btn btn-p" disabled={selObj.length===0||guardandoVia==='anadir'}
                onClick={()=>anadirObjetivos(catalogo.filter((o:any)=>selObj.includes(o.id)))}>
                {guardandoVia==='anadir' ? 'Añadiendo…' : `Añadir${selObj.length>0?' '+selObj.length:''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. BONO Y TIPO DE CLASE — cada cosa en su columna */}
      <div className="g2">
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="finanzas" size={13}/> Bono y cuota</span></div>
          {bono ? (
            <>
              <div style={{fontSize:14,color:'var(--n)'}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:2}}>
                Mes {mes}/{anio}
                {bono.descuento_tipo && bono.descuento_valor > 0 && (
                  <> · descuento {bono.descuento_tipo==='porcentaje'?`${bono.descuento_valor}%`:`${bono.descuento_valor}€`}{bono.descuento_motivo?` (${bono.descuento_motivo})`:''}</>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,flexWrap:'wrap'}}>
                <button className={`chip-ed ${bono.estado_pago==='impago'?'chip-ed-r':bono.estado_pago==='pendiente'?'chip-ed-a':''}`} title="Cambiar el estado de pago"
                  onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPago({ x:r.left, y:r.bottom+4 })}}>
                  {LBL_PAGO[bono.estado_pago]||'—'} <Ic name="abajo" size={12}/>
                </button>
                <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>Cambiar bono</button>
              </div>
            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <span className="muted">Sin bono activo</span>
              <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>+ Asignar bono</button>
            </div>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="etiqueta" size={13}/> Tipo de clase</span></div>
          <button className="chip-ed" title="Cambiar el tipo de clase"
            onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuTipo({ x:r.left, y:r.bottom+4 })}}>
            <Ic name={iconTipoClase(pac.tipo_clase, tiposClase.find((t:any)=>t.valor===pac.tipo_clase)?.icono)} size={12}/>
            {pac.tipo_clase ? nombreTipoClase(tiposClase, pac.tipo_clase) : 'Sin asignar'}
            <Ic name="abajo" size={12}/>
          </button>
          <div style={{fontSize:12,color:'var(--gr)',marginTop:8,lineHeight:1.5}}>
            Se usa como tipo por defecto al darle cita nueva desde la agenda.
          </div>
        </div>
      </div>

      {/* 5. ANAMNESIS */}
      {valoracion?.anamnesis && (
        <div className="sec">
          <div className="sec-h">
            <span className="ct-l"><Ic name="anamnesis" size={13}/> Anamnesis</span>
            {valoracion.fecha && <span className="sh-r">{tipoVal} del {fmtLargo(valoracion.fecha)} · {haceCuanto(valoracion.fecha)}</span>}
          </div>
          <div style={{fontSize:13,color:'var(--n)',lineHeight:1.7,whiteSpace:'pre-line'}}>
            {anamLarga && !anamnesisAbierta ? valoracion.anamnesis.slice(0,260).trimEnd()+'…' : valoracion.anamnesis}
          </div>
          {anamLarga && (
            <button onClick={()=>setAnamnesisAbierta(v=>!v)} style={{fontSize:12,color:'var(--gd)',background:'none',border:'none',padding:'6px 0 0',cursor:'pointer',fontFamily:'inherit'}}>
              {anamnesisAbierta?'Ver menos':'Ver más'}
            </button>
          )}
          <div style={{fontSize:12,color:'var(--gr)',marginTop:9,display:'flex',gap:18,flexWrap:'wrap'}}>
            {valoracion.trabajo && <span className="ct-l"><Ic name="trabajo" size={12}/> {valoracion.trabajo}{valoracion.tipo_jornada?' · '+valoracion.tipo_jornada:''}</span>}
            {valoracion.hace_deporte && valoracion.deportes?.length>0 && <span className="ct-l"><Ic name="deporte" size={12}/> {valoracion.deportes.join(', ')}</span>}
          </div>
        </div>
      )}

      {/* 6. NOTAS DEL PLAN */}
      {valoracion?.notas_plan && (
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="nota" size={13}/> Notas del plan</span></div>
          <div style={{fontSize:13,color:'var(--n)',lineHeight:1.7,whiteSpace:'pre-line'}}>{valoracion.notas_plan}</div>
        </div>
      )}

      {/* 7. PREFERENCIAS DE HORARIO */}
      {valoracion && (valoracion.dias_asistencia||valoracion.franja) && (
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="reloj" size={13}/> Preferencias de horario</span></div>
          {valoracion.dias_asistencia && (
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:7}}>
              {valoracion.dias_asistencia.split(',').filter(Boolean).map((d:string)=><span key={d} className="pill pill-g">{d}</span>)}
            </div>
          )}
          {valoracion.franja && <div style={{fontSize:12,color:'var(--gr)'}}>Franja: {valoracion.franja==='manana'?'Mañanas':valoracion.franja==='tarde'?'Tardes':valoracion.franja==='noche'?'Noches':'Flexible'}</div>}
        </div>
      )}

      <Consentimientos pacienteId={pac.id} nombre={`${pac.nombre} ${pac.apellidos}`.trim()} dni={pac.dni}/>

      {/* MENÚ TIPO DE CLASE */}
      {menuTipo && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuTipo(null)}/>
          <div className="menu-flot" style={{left:menuTipo.x,top:menuTipo.y}}>
            {tiposClase.map((t:any)=>(
              <button key={t.valor} className="menu-it" onClick={()=>{setMenuTipo(null);cambiarTipoClase?.(t.valor)}}>
                <Ic name={iconTipoClase(t.valor,t.icono)} size={14}/>{t.nombre}
                {pac.tipo_clase===t.valor && <span style={{marginLeft:'auto',color:'var(--g)',display:'inline-flex'}}><Ic name="check" size={13}/></span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* MENÚ ESTADO DE PAGO */}
      {menuPago && (
        <>
          <div style={{position:'fixed',inset:0,zIndex:59}} onClick={()=>setMenuPago(null)}/>
          <div className="menu-flot" style={{left:menuPago.x,top:menuPago.y}}>
            {['pagado','pendiente','impago'].map(v=>(
              <button key={v} className="menu-it" onClick={()=>{setMenuPago(null);cambiarPago(v)}}>
                <span style={{width:7,height:7,borderRadius:'50%',background:DOT_PAGO[v],flexShrink:0}}/>
                {LBL_PAGO[v]}
                {bono?.estado_pago===v && <span style={{marginLeft:'auto',color:'var(--g)',display:'inline-flex'}}><Ic name="check" size={13}/></span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
