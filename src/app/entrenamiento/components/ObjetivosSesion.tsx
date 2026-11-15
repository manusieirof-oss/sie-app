'use client'
import { apuntarHistorial, resumenCambios } from '@/lib/sesionViva'
import { useConfigTrabajo, nombresEjecucion, nombresCapacidad, sugerenciaCapacidad } from '@/lib/usarTrabajo'
import { ejecucionPorTiempo, segundosDeEjecucion } from '@/lib/trabajo'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { capacidadPorReps, textoDescanso } from '@/lib/capacidades'
import { MODOS_PARTE, TIPOS_TIEMPO, modoParte, registrarSesion, LADOS, itemDeEjercicio, adaptarALaParte } from '@/lib/sesiones'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import { similaresA, crearEjercicioRapido } from '@/lib/ejercicios'
import { categoriaDe } from '@/lib/etiquetas'
import { contraindicacionesDe, motivoDe, type Contraindicacion } from '@/lib/contraindicaciones'
import { contiene } from '@/lib/texto'
import { aplicarAjustes, calcularAjustes, sinAjustes } from '@/lib/ajustesCita'
import SelectorObjetivos from './SelectorObjetivos'
import HojaLibre from '@/components/HojaLibre'
import { traerTodo } from '@/lib/paginar'
import { leerHoja, hojaVacia, objetivosDeHoja, type Hoja } from '@/lib/hoja'
import { objetivosDeEjercicio, cruceObjetivo } from '@/lib/ejercicioObjetivos'
import { camposSerie, ajustesMedida, COLOR_BANDA, partesMedida, idMedida } from '@/lib/medida'
import CapaBiblioteca from './CapaBiblioteca'
import ParteEjercicios from './ParteEjercicios'
import ParteVacia from './ParteVacia'

// Trozo de pantalla sacado de ModalEditarSesion.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function ObjetivosSesion(p: any) {
  const { ejsDeObj, etiquetas, movsSel, objetivosDisp, objetivosSel, objsDestacar, setEligiendoObj, setObjHover, setObjetivosSel, tocadoAparte } = p
  return (<>{objetivosDisp.length>0&&(
            <div style={{display:'flex',alignItems:'flex-start',gap:9,flexWrap:'wrap'}}>
              {/* Plegado por defecto: los objetivos se eligen una vez y luego solo
                  estorban mientras montas los ejercicios, que es el trabajo real. */}
              <span title="Objetivos que cubre la sesión" style={{display:'inline-flex',color:'var(--gd)',paddingTop:7}}><Ic name="objetivo" size={15}/></span>
              {/* SIEMPRE A LA VISTA: cada objetivo con su «−» para quitarlo y un «+» para añadir. */}
              {(
              <div style={{display:'flex',gap:6,flexWrap:'wrap',flex:1,minWidth:200,alignItems:'flex-start'}}>
                {/* En MONEDAS, igual que en la ficha del paciente y en las sesiones: un
                    objetivo se reconoce por su foto, y dibujarlo distinto en cada pantalla
                    obliga a reconocerlo otra vez en cada una. */}
                {/* ORDEN FIJO: cada objetivo se queda en su sitio y se enciende o se apaga ahí.
                    Antes los marcados pasaban delante y los demás se corrían, así que al tocar
                    el de la derecha parecía que se iban marcando de izquierda a derecha. */}
                {[...objsDestacar, ...objetivosSel.filter((id: any)=>!objsDestacar.includes(id))].map(id=>{
                  const o = objetivosDisp.find((x:any)=>x.id===id)
                  if (!o) return null
                  const on = objetivosSel.includes(id)
                  const alternar = () => { tocadoAparte.current = true; setObjetivosSel((prev: any)=>prev.includes(id)?prev.filter((x: any)=>x!==id):[...prev,id]) }
                  // Cuántos ejercicios de la sesión lo trabajan: sin marcar y con alguno, se
                  // enciende un poco (merece la pena marcarlo); marcado y con ninguno, aviso.
                  const nEj = ejsDeObj(o).length
                  return (
                    <span key={id} title={on ? `${o.nombre} · en la sesión${(movsSel[id]||[]).length ? ' · '+(movsSel[id]||[]).map((m:string)=>etiquetas.find((x:any)=>x.id===m)?.nombre||m).join(' · ') : ''}` : `${o.nombre} · pulsa para añadirlo`}
                      onMouseEnter={()=>setObjHover(id)} onMouseLeave={()=>setObjHover((h: any)=>h===id?null:h)}
                      style={{position:'relative',display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,width:76}}>
                      <button type="button" onClick={on ? undefined : alternar}
                        title={on ? undefined : nEj>0 ? `Lo trabaja${nEj===1?'':'n'} ${nEj} ejercicio${nEj===1?'':'s'} de la sesión · toca para añadirlo` : 'Ningún ejercicio de la sesión lo trabaja todavía'}
                        style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',padding:0,
                          cursor:on?'default':'pointer',opacity:on?1:nEj>0?.75:.4}}>
                        <MonedaObjetivo objetivo={o}/>
                        <span className="obj-mon-g">{o.nombre}</span>
                        <span title={on && nEj===0 ? 'Está en la sesión, pero ningún ejercicio lo trabaja' : undefined}
                          style={{fontSize:9.5,lineHeight:1,color: on && nEj===0 ? '#B07A12' : 'var(--grl)', fontWeight: on && nEj===0 ? 600 : 400}}>
                          {nEj} ej.
                        </span>
                      </button>
                      {on && (
                        <button type="button" title="Quitar este objetivo" onClick={alternar}
                          style={{position:'absolute',top:-4,right:8,width:18,height:18,borderRadius:'50%',border:'1px solid var(--bd)',background:'#fff',
                            color:'var(--gr)',cursor:'pointer',fontSize:13,lineHeight:1,display:'grid',placeItems:'center',padding:0}}>−</button>
                      )}
                    </span>
                  )
                })}
                <span style={{display:'inline-flex',flexDirection:'column',alignItems:'center',gap:3,width:76}}>
                  <button type="button" title="Añadir objetivo" onClick={()=>setEligiendoObj(true)}
                    style={{width:42,height:42,borderRadius:'50%',border:'1.5px dashed var(--gm)',background:'#fff',color:'var(--gd)',cursor:'pointer',fontSize:20,lineHeight:1,display:'grid',placeItems:'center'}}>+</button>
                  <span className="obj-mon-g">Añadir</span>
                </span>
              </div>
              )}
            </div>
          )}</>)
}
