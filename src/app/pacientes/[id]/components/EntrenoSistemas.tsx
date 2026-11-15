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

// Trozo de pantalla sacado de EntrenoTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function EntrenoSistemas(p: any) {
  const { cargarDatos, escalones, logrados, pacienteId, seccion, setSistemasPac, setTodosSistemas, sistemasPac, todosSistemas } = p
  return (<>{seccion==='sesiones'&&(
        <div className="panel">
          <SistemasPaciente pacienteId={pacienteId} asignaciones={sistemasPac} logrados={logrados} escalones={escalones}
            onCambio={()=>{sistemasDePaciente(pacienteId).then(setSistemasPac);historialSistemas(pacienteId).then(setTodosSistemas)}}
            onRecargar={cargarDatos}/>

          {/* POR DONDE HA PASADO. Un sistema que se quita no se borra, y saber que
              ya hizo una readaptacion entera es lo primero antes de ponerle otra. */}
          {(() => {
            const pasados = todosSistemas.filter((a: any)=>a.activo===false)
            if (pasados.length===0) return null
            return (
              <div className="sec">
                <div className="sec-h">
                  <span className="sh-l"><span className="ct-l"><Ic name="carpeta" size={13}/> Ya terminados</span></span>
                  <span className="sh-r">{pasados.length}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {pasados.map((a: any)=>{
                    const sis=a.sistema
                    if (!sis) return null
                    const t=tramos(sis,a)
                    const ini=a.fecha_inicio
                    const fin=t.length>0 ? t[t.length-1].hasta : null
                    const corto=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})
                    return (
                      <div key={a.id} style={{display:'flex',alignItems:'center',gap:9,background:'var(--w)',
                        border:'1px solid var(--bd)',borderLeft:`4px solid ${sis.color}`,borderRadius:7,
                        padding:'7px 11px 7px 9px',opacity:.75}}>
                        <span style={{width:24,height:24,borderRadius:6,background:sis.color,color:'#fff',
                          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          {sis.icono ? <Ic name={sis.icono} size={12}/> : null}
                        </span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:'var(--n)'}}>{sis.nombre}</div>
                          <div style={{fontSize:11,color:'var(--gr)'}}>
                            {(sis.fases||[]).length} fase{(sis.fases||[]).length===1?'':'s'}
                            {ini && ` · desde el ${corto(ini)}`}
                            {fin && ` hasta el ${corto(fin)}`}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}</>)
}
