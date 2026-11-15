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
import { ChipMenu } from './ModalEditarSesion'

// Trozo de pantalla sacado de ModalEditarSesion.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function ParteVacia(p: any) {
  const { conLetras, editarParte, formSesion, parte, parteActiva, setFormSesion, setParteActiva } = p
  return (<>{formSesion.partes.length>0 && (parte?.ejercicios||[]).length===0 && (
              <div className="parte-bar">
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

                {/* LAS PAUSAS, CON SU NOMBRE DELANTE. En superserie y circuito hay dos y no se
                    sabía cuál era cuál: primero la de pasar de un ejercicio al siguiente,
                    luego la de acabar la vuelta. Vacío = sin pausa. */}
                {(parte?.modo==='circuito'||parte?.modo==='superserie') && (
                  <label className="par-in" title="Lo que se descansa al cambiar de ejercicio dentro de la vuelta. Déjalo vacío si se encadenan sin parar.">
                    <span style={{display:'inline-flex',alignItems:'center',gap:3,color:'var(--gr)',marginRight:4}}><Ic name="pausa" size={11}/> Entre ejercicios</span>
                    <input type="number" min={0} step={5} value={parte?.transicion||''} placeholder="0"
                      onChange={e=>editarParte({transicion:e.target.value})}/>
                    <span>s</span>
                  </label>
                )}
                {parte?.modo!=='tiempo' && (
                  <label className="par-in" title="En circuito y superserie es el descanso del recorrido. Con los ejercicios sueltos es el descanso general: vale para todos salvo los que traigan el suyo.">
                    <span style={{display:'inline-flex',alignItems:'center',gap:3,color:'var(--gr)',marginRight:4}}><Ic name="pausa" size={11}/> {parte?.modo==='circuito' ? 'Entre vueltas'
                      : parte?.modo==='superserie' ? 'Al acabar cada vuelta' : 'Entre series'}</span>
                    <input type="number" min={0} step={5} value={parte?.descanso||''} placeholder="0"
                      onChange={e=>editarParte({descanso:e.target.value})}/>
                    <span>s</span>
                  </label>
                )}

                {/* SUPERSERIES: de cuántos en cuántos van. Elegido, las letras se ponen solas. */}
                {parte?.modo==='superserie' && (
                  <span className="par-in" title="Cuántos ejercicios forman cada grupo. Con un número, las letras (A, B…) se ponen solas por orden; «a mano», las eliges tú.">
                    <span style={{color:'var(--gr)',marginRight:4}}>Grupos de</span>
                    {([2,3,4,0] as const).map(n=>{
                      const on = n===0 ? !parte?.tam_grupo : Number(parte?.tam_grupo)===n
                      return <button key={n} type="button" onClick={()=>{
                        setFormSesion((prev: any)=>{
                          const partes=[...prev.partes]; const pa={ ...partes[parteActiva], tam_grupo: n||null }
                          partes[parteActiva]={ ...pa, ejercicios: conLetras(pa, pa.ejercicios||[]) }
                          return { ...prev, partes }
                        })
                      }} style={{border:`1px solid ${on?'var(--gd)':'var(--bd)'}`,background:on?'var(--gl)':'var(--w)',color:on?'var(--gd)':'var(--gr)',
                        borderRadius:99,padding:'2px 9px',fontSize:12,cursor:'pointer',fontFamily:'inherit',marginRight:3,fontWeight:on?600:400}}>{n===0?'a mano':n}</button>
                    })}
                  </span>
                )}

                <div style={{flex:1}}/>
                {formSesion.partes.length>1&&(
                  <button title="Eliminar esta parte" className="ic-acc peligro"
                    onClick={()=>{setFormSesion((prev: any)=>({...prev,partes:prev.partes.filter((_:any,i:number)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}>
                    <Ic name="papelera" size={14}/>
                  </button>
                )}
              </div>
            )}</>)
}
