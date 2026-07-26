'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { iconTipoClase, nombreTipoClase } from '@/lib/tipos'
import Consentimientos from './Consentimientos'
import { guardarVias } from '@/lib/objetivos'

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

  function cargarObjetivos() {
    if (!pac?.id) return
    supabase.from('pacientes_objetivos').select('objetivo_id, origen, vias, logrado, fecha_logrado, objetivos(id,nombre,color,descripcion)').eq('paciente_id', pac.id).then(({data}) => {
      setObjetivosTrabajo((data||[]).map((r:any)=>({...r.objetivos, origen:r.origen, vias:r.vias||[], logrado:r.logrado, fecha_logrado:r.fecha_logrado})).filter((o:any)=>o.id))
    })
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
        {vias.length===0 && !o.logrado && (
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
  const hayObjetivos = objPide.length>0 || valoracion?.deseo || objetivosTrabajo.length>0
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
              <div className="sec-sub">Lo que prescribimos · de tests y ejercicios</div>
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
