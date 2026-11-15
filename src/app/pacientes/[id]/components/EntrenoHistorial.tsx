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

// Trozo de pantalla sacado de EntrenoTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function EntrenoHistorial(p: any) {
  const { filtroHist, limHist, pinta, porMes, recuperacionDe, registrosDe, seccion, sesionesHistorial, setFiltroHist, setLimHist, setVerSesion, verHist } = p
  return (<>{seccion==='historial'&&verHist==='sesiones'&&(()=>{
        const nRe = sesionesHistorial.filter((c:any)=>c.estado==='realizada').length
        const nFa = sesionesHistorial.filter((c:any)=>c.estado==='falta').length
        const nCa = sesionesHistorial.filter((c:any)=>c.estado==='cancelada').length
        const filtros = [
          {k:'realizada', l:'Realizadas', n:nRe},
          {k:'falta', l:'Faltas', n:nFa},
          {k:'cancelada', l:'Canceladas', n:nCa},
        ].filter(f=>f.n>0)
        // Las canceladas quedan fuera por defecto: una cita anulada con antelación no
        // es historial de entrenamiento, no se entrenó nada. Se llega a ellas por su chip.
        const lista = filtroHist
          ? sesionesHistorial.filter((c:any)=>c.estado===filtroHist)
          : sesionesHistorial.filter((c:any)=>c.estado!=='cancelada')
        return (
        <div className="panel">
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="carpeta" size={13}/> Citas pasadas</span>
                {/* Lo primero que se mira y había que contarlo a ojo. */}
                {sesionesHistorial.length>0 && (
                  <span className="sh-r">
                    {nRe} realizada{nRe===1?'':'s'}{nFa>0?` · ${nFa} falta${nFa===1?'':'s'}`:''}{nCa>0?` · ${nCa} cancelada${nCa===1?'':'s'}`:''}
                  </span>
                )}
              </span>
              {filtros.length>1 && (
                <span style={{display:'inline-flex',gap:5,flexWrap:'wrap'}}>
                  {filtros.map(f=>(
                    <button key={f.k} className={`chip-sel ${filtroHist===f.k?'on':''}`}
                      onClick={()=>setFiltroHist(filtroHist===f.k?'':f.k)}>
                      {f.l} · {f.n}
                    </button>
                  ))}
                </span>
              )}
            </div>
            {sesionesHistorial.length===0&&<div className="muted">Sin historial aún</div>}
            {sesionesHistorial.length>0 && lista.length===0 && (
              <div className="muted">
                {filtroHist ? 'Ninguna cita con ese estado.' : 'Solo hay citas canceladas. Están en su filtro.'}
              </div>
            )}
            {porMes(lista).map((g: any)=>(
              <div key={g.mes}>
                <div className="sep-mes">{g.mes}</div>
                {g.citas.map((c:any)=>{
                  const est=c.estado==='realizada'?{cl:'pill-o on',txt:'Realizada',borde:'var(--g)'}
                    :c.estado==='cancelada'?{cl:'pill-soft',txt:'Cancelada',borde:'var(--bd)'}
                    :{cl:'pill-r',txt:'Falta',borde:'var(--red)'}
                  const tieneSes=!!c.sesiones
                  const reg=registrosDe(c)
                  return (
                    <div key={c.id} className={`fila-p ${tieneSes?'test-clic':''}`}
                      style={{borderLeftColor:pinta(c.fecha)?.color||est.borde, background:pinta(c.fecha)?.fondo}}
                      onClick={async ()=>{ if(!tieneSes) return
                        // La sesion crece: lo que tocaba ESE dia es la foto de entonces, no la de hoy.
                        const fotos = await partesEnFecha(c.sesion_id, c.fecha)
                        const base = fotos ? { ...c.sesiones, partes: fotos } : c.sesiones
                        setVerSesion({sesion:aplicarAjustes(base,c.ajustes), ejecutado:reg}) }}>
                      <div style={{flex:1}}>
                        {tieneSes
                          ? <div style={{fontSize:13,color:'var(--n)',display:'flex',alignItems:'center',gap:5}}><Ic name="valoracion" size={12}/> {c.sesiones.nombre}{c.sesiones.fija && <span title="Fija: no corre con las demás"> 🔒</span>}</div>
                          : <div style={{fontSize:13,color:'var(--gr)'}}>Sin sesión</div>}
                        <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>
                          {new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)} · Sala {c.sala}
                        </div>
                        {/* Lo que ese dia se cambio respecto al plan. Queda aqui para
                            siempre: es el registro de lo que de verdad tocaba hacer. */}
                        {tieneSes && !sinAjustes(c.ajustes) && (
                          <div style={{marginTop:3,display:'flex',flexWrap:'wrap',gap:5}}>
                            {resumenAjustes(c.sesiones, c.ajustes).map((r:any)=>(
                              <span key={r.clave} style={{fontSize:10,padding:'1px 8px',borderRadius:99,
                                background:'var(--ambl)',border:'1px solid var(--amb)',color:'#7A5800'}}
                                title={r.cambios.map((x:any)=>`${x.campo}: ${x.de||'—'} → ${x.a||'—'}`).join('\n')}>
                                {r.nombre} · {r.cambios.map((x:any)=>x.a||'—').join(', ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* El papel en una recuperación: si esta falta se recuperó o si
                          esta cita es la recuperación de otra. El dato ya estaba en la
                          base y no se veía donde se mira la falta. */}
                      {(() => {
                        const r = recuperacionDe(c)
                        return r ? <span className={`pill ${r.clase}`} style={{flexShrink:0}}>{r.txt}</span> : null
                      })()}
                      {/* Que se registró trabajo ese día es más informativo que el
                          estado de la cita: "realizada" solo dice que vino. */}
                      {reg.length>0 && (
                        <span className="pill pill-o on" style={{flexShrink:0,display:'inline-flex',alignItems:'center',gap:4}}
                          title="Series y pesos anotados desde el taller. Pulsa para verlos.">
                          <Ic name="check" size={10}/> {reg.length} ejercicio{reg.length>1?'s':''} anotado{reg.length>1?'s':''}
                        </span>
                      )}
                      <span className={`pill ${est.cl}`} style={{flexShrink:0}}>{est.txt}</span>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Antes cortaba a 30 y no había forma de ver más: con dos clases por
                semana eso son menos de cuatro meses de historial accesible. */}
            {sesionesHistorial.length>=limHist && (
              <button className="btn btn-s btn-sm" style={{marginTop:10}}
                onClick={()=>setLimHist((n: any)=>n+60)}>Ver más citas</button>
            )}
          </div>
        </div>
        )
      })()}</>)
}
