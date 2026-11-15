'use client'
import { finalizarSesion, diasActiva, avisoDias, AVISO_DIAS_DEFECTO, partesEnFecha } from '@/lib/sesionViva'
import { VeloFinalizar } from '@/components/SustituirSesion'
import { traerTodo } from '@/lib/paginar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ModalEditarCita from '@/app/agenda/components/ModalEditarCita'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import { usePuede } from '@/lib/permisos'
import EvaluacionEjecucion from './EvaluacionEjecucion'
import DetalleSesion from './DetalleSesion'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { Ic } from '@/lib/icons'
import BarraAsignacion from '@/components/BarraAsignacion'
import { encargoDeLaUrl, asignarSesionYVolver, rutaDeAsignacion, type Encargo } from '@/lib/asignarCita'
import { useRouter } from 'next/navigation'
import CalendarioCitasPaciente from '@/components/CalendarioCitasPaciente'
import { horasDeAgenda } from '@/lib/generarHoras'
import { TIPOS_CLASE_FALLBACK, parseTiposClase } from '@/lib/tipos'
import { duplicarSesion as duplicarSesionLib, registrarSesion, modoDeSesion } from '@/lib/sesiones'
import { agrupaPorLinaje, evolucionarPrograma, evolucionarDesde, marcarFija, esVigente, versionDe, linajeDe } from '@/lib/linaje'
import { hoyISO } from '@/lib/fechas'
import { estadoRecuperacion } from '@/lib/recuperaciones'
import { cambiarEstadoDeCita, moverCita, eliminarCitaDel } from '@/lib/gestionCita'
import HistorialAjustes from '@/app/entrenamiento/components/HistorialAjustes'
import SistemasPaciente from './SistemasPaciente'
import PiezaCitas, { type FilaPieza } from '@/components/PiezaCitas'
import { testsPorDia } from '@/lib/evaluaciones'
import { sistemasDePaciente, historialSistemas, logradosDe, escalonesDe, Asignacion, faseEn, principalDe, tinte, alfaDeFase, tramos, textoDuracion } from '@/lib/sistemas'
import { sinAjustes, resumenAjustes, aplicarAjustes } from '@/lib/ajustesCita'
import { useImagenes, imagenDe, idsDeSesiones } from '@/lib/imagenEjercicio'
import EntrenoHistorial from './EntrenoHistorial'
import EntrenoSistemas from './EntrenoSistemas'

// Trozo de pantalla sacado de EntrenoTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function EntrenoSesiones(p: any) {
  const { abrirCalendario, abrirDetalle, abrirObjsDe, alternarFija, asignarYVolver, avisoN, citasFuturas, crearSesionNueva, deSistema, editaPlan, encargo, estadoSesion, fotosDeSesion, guardando, imgs, nombrePaciente, objsDeSesion, pacienteId, reciboTanda, routerAsig, seccion, sesionesDisp, setHistorialDe, setReciboTanda, setSoloActivas, setVerFinalizadas, soloActivas, verFinalizadas } = p
  return (<>{seccion==='sesiones'&&(
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="lista" size={13}/> Sesiones del paciente</span>
                {editaPlan && <button className="btn btn-s btn-sm" onClick={()=>routerAsig.push(rutaDeAsignacion('biblioteca', {
                  pacienteId, etiqueta: nombrePaciente || 'este paciente',
                  volver: `/pacientes/${pacienteId}?tab=entreno`,
                }))}>Traer de la biblioteca</button>}
                {editaPlan && <button className="btn btn-p btn-sm" onClick={crearSesionNueva}>+ Nueva sesión</button>}
                {/* Solo tiene sentido si hay programa en marcha: sin citas futuras con
                    sesión, no hay nada de lo que hacer una versión siguiente. */}
                {editaPlan && citasFuturas.length>0 && sesionesDisp.length>0 && (
                  <button className="btn btn-sm" onClick={()=>abrirCalendario()} disabled={guardando}
                    title="Coloca las sesiones en las citas futuras siguiendo una rotación">
                    <Ic name="calendario" size={12}/> Repartir en las citas
                  </button>
                )}
              </span>
              {/* Las cumplidas se apagan pero siguen ahí, porque son el historial de lo
                  que funcionó. Este filtro es para cuando estorban. */}
              {sesionesDisp.some((s: any)=>estadoSesion(s)==='cumplida') && (
                <button className={`chip-sel ${soloActivas?'on':''}`} onClick={()=>setSoloActivas((v: any)=>!v)}>
                  Ocultar las de objetivos logrados
                </button>
              )}
            </div>
            {reciboTanda && (
              <div className="fila-p" style={{borderLeftColor:reciboTanda.mal?'var(--amb)':'var(--g)',marginBottom:12,display:'flex',alignItems:'flex-start',gap:8}}>
                <span style={{flex:1,fontSize:13,color:'var(--n)',lineHeight:1.5}}>{reciboTanda.texto}</span>
                <button onClick={()=>setReciboTanda(null)} aria-label="Cerrar"
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--gr)',flexShrink:0}}>
                  <Ic name="cerrar" size={13}/>
                </button>
              </div>
            )}
            {encargo && <BarraAsignacion encargo={encargo}/>}
            {sesionesDisp.length===0?<div className="muted">No hay sesiones creadas.</div>:(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
                {/* Agrupadas por linaje: se ve la versión vigente de cada sesión y las
                    anteriores se despliegan desde ella. Sin esto, a los tres meses hay
                    ocho tarjetas llamadas "Empujes" y ninguna dice cuál manda. */}
                {/* SESIONES VIVAS: una por objetivo o necesidad, que crecen. Las finalizadas
                    (y las tandas antiguas, de antes de este cambio) van abajo, solo para
                    consultar. */}
                {agrupaPorLinaje(sesionesDisp)
                  .filter(l=>!l.vigente.finalizada_en)
                  .filter(l=>!soloActivas || estadoSesion(l.vigente)!=='cumplida')
                  .map(({vigente:s})=>{
                  const citasAsignadas=citasFuturas.filter((c: any)=>c.sesion_id===s.id); const asignada=citasAsignadas.length>0
                  const nEj=(s.partes||[]).reduce((a:number,p:any)=>a+(p.ejercicios||[]).length,0); const nP=(s.partes||[]).length
                  const sis=deSistema(s)
                  return (
                    <div key={s.id} onClick={()=>abrirDetalle(s)}
                      className={`tarj-s est-${estadoSesion(s)}`}
                      style={{minWidth:0,overflow:'hidden',...(sis?{background:tinte(sis.color,.12),borderColor:tinte(sis.color,.45)}:{})}}
                      title={estadoSesion(s)==='cumplida'
                        ? 'Sus objetivos ya están logrados'
                        : estadoSesion(s)==='activa' ? 'Trabaja objetivos aún abiertos' : undefined}>
                      {/* Las fotos son lo único que distingue una sesión de otra de un
                          vistazo: los nombres se autogeneran y "2 partes · 8 ejercicios"
                          es inventario, no contenido. */}
                      {fotosDeSesion(s).length>0 && (
                        <div className="tira-ej">
                          {fotosDeSesion(s).map((f:any,i:number)=>(
                            imagenDe(f, imgs)
                              ? <img key={i} src={imagenDe(f, imgs)} alt={f.nombre} title={f.nombre}/>
                              : <span key={i} className="sin" title={f.nombre}><Ic name="fuerza" size={16}/></span>
                          ))}
                          {nEj>fotosDeSesion(s).length && (
                            <span className="mas">+{nEj-fotosDeSesion(s).length}</span>
                          )}
                        </div>
                      )}
                      {encargo && (
                        <button className="btn btn-p btn-sm" style={{width:'100%',marginBottom:7,fontSize:11}}
                          onClick={e=>{e.stopPropagation();asignarYVolver(s)}}>
                          Traer esta y volver
                        </button>
                      )}
                      <div style={{display:'flex',alignItems:'flex-start',gap:7}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:'var(--n)'}}>{s.nombre}{s.fija && <span title="Fija: no corre con las demás"> 🔒</span>}</div>
                          {s.descripcion&&<div style={{fontSize:12,color:'var(--gr)',marginTop:2,lineHeight:1.4}}>{s.descripcion.slice(0,70)}{s.descripcion.length>70?'…':''}</div>}
                        </div>
                        <button className="pill pill-soft" title="Historial de cambios por dia"
                          onClick={e=>{e.stopPropagation();setHistorialDe(s)}}
                          style={{border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',flexShrink:0,padding:'3px 7px'}}>
                          <Ic name="carpeta" size={12}/>
                        </button>
                        <span className={`pill ${asignada?'pill-o on':'pill-soft'}`} style={{flexShrink:0}}>
                          {asignada?`${citasAsignadas.length} cita${citasAsignadas.length>1?'s':''}`:'Sin asignar'}
                        </span>
                      </div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8,alignItems:'center'}}>
                        {/* Calculado de las partes, nunca guardado en la sesión. */}
                        {sis && (
                          <span className="pill" title={`${sis.sistema} · ${sis.fase}`}
                            style={{background:tinte(sis.color,.16),color:sis.color,border:`1px solid ${tinte(sis.color,.5)}`,
                              // Nombres de fase largos se salian de la tarjeta.
                              maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {sis.fase}
                          </span>
                        )}
                        {nEj>0 && <span className="pill pill-o on">{modoDeSesion(s.partes).nombre}</span>}
                        <span className="pill pill-soft">{nEj} {nEj===1?'ejercicio':'ejercicios'}</span>
                        {/* "Tanda" y no "versión": un número junto al nombre se lee como
                            un nivel, y que suba no dice que haya progresado, dice que le
                            montaste una programación nueva. Se cuenta del linaje. */}
                        {/* AVISO: lleva mucho activa (Ajustes). Solo recuerda mirarla: cerrarla lo
                            decide quien la lleva, una recuperacion no va por calendario. */}
                        {diasActiva(s) >= avisoN && (
                          <span className="pill" title="Lleva mucho tiempo activa: ¿toca finalizarla y pasar a la siguiente?"
                            style={{background:'var(--ambl)',color:'#7A5800',border:'1px solid var(--amb)'}}>⏱ {diasActiva(s)} días</span>
                        )}
                        {/* Fija = fuera de las tandas nuevas. Se marca la excepción, no
                            la norma: lo habitual es que todo evolucione. */}
                        <button className={`pill ${s.fija?'pill-o on':'pill-soft'}`}
                          onClick={e=>{e.stopPropagation();alternarFija(s)}}
                          title={s.fija
                            ? 'Fija: no corre con las citas (faltas, recuperaciones). Pulsa para quitar el candado.'
                            : 'Pulsa para fijarla: se queda en sus citas aunque las demás corran.'}
                          style={{border:'none',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:3,opacity:s.fija?1:.5}}>
                          <Ic name="pin" size={10}/> {s.fija?'Fija':''}
                        </button>
                        {/* Con diez sesiones acumuladas, cuál es la reciente importa más
                            que cuántas partes tiene. */}
                        {s.created_at && (
                          <span style={{fontSize:12,color:'var(--gr)',marginLeft:'auto'}}>
                            {new Date(s.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                          </span>
                        )}
                      </div>
                      {/* QUÉ TRABAJA ESTA SESIÓN, y el botón para decirlo.
                          Es el eslabón que faltaba en la cadena: el test abre objetivos, la
                          sesión los trabaja, y al repetir el test se vuelve a valorar. Sin
                          poder engancharlos desde aquí había que entrar a editar la sesión
                          para algo que se decide mirando la ficha. */}
                      <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6,alignItems:'center'}}>
                        {objsDeSesion(s).map((o:any)=>(
                          <MonedaObjetivo key={o.id} objetivo={o} tam="mini"/>
                        ))}
                        <button className="btn btn-t btn-sm" style={{fontSize:11}}
                          onClick={e=>{e.stopPropagation();abrirObjsDe(s)}}
                          title="Elegir qué objetivos del paciente trabaja esta sesión">
                          <Ic name="mas" size={11}/> Objetivos
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* FINALIZADAS: cerradas con su historia. Incluye las tandas de antes. */}
            {(() => {
              const vig = new Set(agrupaPorLinaje(sesionesDisp).filter(l=>!l.vigente.finalizada_en).map(l=>l.vigente.id))
              const fin = sesionesDisp.filter((x:any)=>!vig.has(x.id)).sort((a:any,b:any)=>String(b.finalizada_en||b.created_at||'').localeCompare(String(a.finalizada_en||a.created_at||'')))
              if (!fin.length) return null
              return (
                <div style={{marginTop:14}}>
                  <button className="chip-sel" onClick={()=>setVerFinalizadas((v: any)=>!v)}>
                    Finalizadas · {fin.length} {verFinalizadas?'▴':'▾'}
                  </button>
                  {verFinalizadas && (
                    <div style={{display:'grid',gap:4,marginTop:8}}>
                      {fin.map((x:any)=>(
                        <button key={x.id} onClick={()=>abrirDetalle(x)}
                          style={{display:'flex',alignItems:'center',gap:8,background:'var(--w)',border:'1px solid var(--bd)',borderRadius:10,padding:'7px 10px',cursor:'pointer',textAlign:'left',fontFamily:'inherit',opacity:.8}}>
                          <span style={{flex:1,minWidth:0,fontSize:13,color:'var(--n)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{x.nombre}</span>
                          <span style={{fontSize:12,color:'var(--gr)',flexShrink:0}}>
                            {x.created_at && new Date(x.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                            {' → '}{x.finalizada_en ? new Date(x.finalizada_en).toLocaleDateString('es-ES',{day:'numeric',month:'short'}) : 'tanda anterior'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}</>)
}
