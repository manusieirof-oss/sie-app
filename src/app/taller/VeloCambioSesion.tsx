'use client'
import { COLOR_MOMENTO, textoMomento } from '@/lib/momento'
import BarraMomento from '@/components/BarraMomento'
import ChipPulso, { NombrePulso } from '@/components/ChipPulso'
import CaraPaciente from '@/components/CaraPaciente'
import MetodoParte from './MetodoParte'
import { cargarMetodos, aplicarMetodo, METODOS_DEFECTO, type ValoresMetodo } from '@/lib/metodos'
import { pulsoActivo, hayPulso } from '@/lib/pulsoVivo'
import { apuntarHistorial } from '@/lib/sesionViva'
import { avisosDeCondiciones } from '@/lib/avisosZona'
import { cargarReglas } from '@/lib/reglasClinicas'
import { planDeCarga, admitePropuesta, proponerSeries } from '@/lib/propuestaCarga'
import { useState, useRef, useEffect } from 'react'
import TodosTaller from './TodosTaller'
import { VeloCita, VeloAnadir } from './GestionCita'
import { usePuede } from '@/lib/permisos'
import { supabase } from '@/lib/supabase'
import { modoParte, textoModo, descansoDeParte, transicionDeParte, descansoEfectivo, duplicarSesion, itemDeEjercicio } from '@/lib/sesiones'
import { textoDescanso } from '@/lib/capacidades'
import { repetidosSemana, type Repetido, diasDeFalta } from '@/lib/repetidosSemana'
import { enModoPractica } from '@/lib/practica'
import { partesMedida } from '@/lib/medida'
import { normalizar } from '@/lib/texto'
import { alternarItem, itemMarcado } from '@/lib/ejecucion'
import { guardarVias, abrirObjetivo, resolverVia } from '@/lib/objetivos'
import { pacientesDelDia, horasDelDia, horaActual } from '@/lib/taller'
import { rutaDeAsignacion } from '@/lib/asignarCita'
import { MOTIVOS_CAMBIO, nombreMotivo, cambiosDeCitas, registrarCambio, type CambioSesion } from '@/lib/cambioSesion'
import { useRouter } from 'next/navigation'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { aplicarAjustes, sinAjustes } from '@/lib/ajustesCita'
import { avisarGuia } from '@/lib/guiaEventos'
import { testsPorDia } from '@/lib/evaluaciones'
import { testsPorConfirmar, confirmarAMano } from '@/lib/mantenimiento'
import { registrarResultadoTest, ladoOpuesto } from '@/lib/tests'
import { sugerirObjetivos } from '@/lib/ejercicioObjetivos'
import PulsoClase from './PulsoClase'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'
import RejillaParte from './RejillaParte'
import ExploradorEjercicios from '@/components/ExploradorEjercicios'
import { igualesA } from '@/lib/ejercicios'
import { traerTodo } from '@/lib/paginar'
import IconosContexto from './IconosContexto'
import HojaLibre from '@/components/HojaLibre'
import { leerHoja, registrosDeHoja, type Hoja } from '@/lib/hoja'
import { CAMPOS_MEDIDA, CAMPOS_SERIE, serieLlena, antesDeClase, sinEjerciciosBorrados, cerrarBorrador, guardarBorradorEjercicio, clavePendiente, apuntarPendiente, quitarPendiente, cuantosPendientes, leerPendientes, enviarPendientes } from './guardarTaller'
import ClaseEnCurso from './ClaseEnCurso'
import CabeceraTaller from './CabeceraTaller'

// Trozo de pantalla sacado de ModoClase.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function VeloCambioSesion(p: any) {
  const { cambiando, fecha, router, setCambiando, setSeleccion } = p
  return (<>{cambiando && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setCambiando(null)}}>
          <div className="modal" style={{width:460}}>
            <div className="modal-title">
              Cambiar la sesión
              <button className="modal-close" onClick={()=>setCambiando(null)}>✕</button>
            </div>
            <div style={{fontSize:11,color:'var(--gr)',marginBottom:14}}>
              Tenía puesta <b style={{fontWeight:600,color:'var(--n)'}}>«{cambiando.antesNombre || 'una sesión'}»</b>.
              Queda anotado en su historial junto con lo que elijas.
            </div>
            <div className="field">
              {/* SOLO UNA NOTA. Antes habia que elegir un motivo de una lista y, en
                  "Otro", escribir: demasiado para algo que se decide en la sala. */}
              <label>Nota (opcional)</label>
              <textarea className="input" value={cambiando.nota} autoFocus
                onChange={e=>setCambiando((p:any)=>({...p,nota:e.target.value}))}
                placeholder="Ej: fue a correr por la mañana y no tiene bien las piernas"
                style={{minHeight:56,fontSize:12}}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10,alignItems:'center'}}>
              <button className="btn btn-d btn-sm" onClick={()=>setCambiando(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              {/* El cambio queda anotado con la sesion de antes y la de despues; la nota
                  es opcional. */}
              <button className="btn btn-p btn-sm"
                onClick={async ()=>{
                  const c = { ...cambiando, motivo: cambiando.motivo || 'nota' }
                  setCambiando(null)
                  if (c.destino === 'quitar') {
                    const { error } = await supabase.from('citas').update({ sesion_id: null }).eq('id', c.encargo.citaId)
                    if (error) { alert('No se ha podido quitar la sesión: ' + error.message); return }
                    await registrarCambio({ citaId: c.encargo.citaId, pacienteId: c.encargo.pacienteId, fecha,
                      antesId: c.antesId, antesNombre: c.antesNombre, despuesId: null, despuesNombre: null,
                      motivo: c.motivo, nota: c.nota })
                    setSeleccion((prev: any) => prev.map((s: any) => s.citaId === c.encargo.citaId
                      ? { ...s, sesionId: '', datos: [], cargado: false, objetivosSesion: [] } : s))
                    return
                  }
                  router.push(rutaDeAsignacion(c.destino, {
                    ...c.encargo,
                    antesId: c.antesId, antesNombre: c.antesNombre,
                    motivo: c.motivo, nota: c.nota.trim() || undefined,
                  }))
                }}>
                {cambiando.destino === 'quitar' ? 'Quitar la sesión' : 'Elegir la nueva sesión'}
              </button>
            </div>
            {!cambiando.motivo && (
              <div style={{fontSize:10,color:'var(--grl)',marginTop:7,textAlign:'right'}}>
                Marca un motivo para continuar.
              </div>
            )}
          </div>
        </div>
      )}</>)
}
