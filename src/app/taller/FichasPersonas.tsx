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
import VeloCambioSesion from './VeloCambioSesion'
import VeloSustituir from './VeloSustituir'

// Trozo de pantalla sacado de ModoClase.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function FichasPersonas(p: any) {
  const { activo, editaAgenda, enOtros, hora, nombreCorto, progreso, seleccion, setActivo, setAnadiendoPac, setCitaVelo, solo, vista } = p
  return (<>{seleccion.length>0 && vista==='uno' && (
        <div data-guia="taller-personas" style={{position:'sticky',top:0,zIndex:20,display:'flex',gap:6,flexWrap:'wrap',
          marginBottom:12,background:'var(--bl)',padding:'8px 0'}}>
          {/* Sin caja blanca: sobre el fondo de la página, como los pulsómetros. El fondo
              sigue siendo opaco (el de la página) para tapar lo que pasa por debajo. */}
          {/* Se queda fija al bajar: con cinco personas en la sala, volver arriba
              para cambiar de paciente es el scroll que mas se repite. */}
          {seleccion.map((s: any)=>{
            const nGuardados = s.datos.filter((e:any)=>e.guardado).length
            const estado = s.finalizado ? 'fin' : (nGuardados>0 ? 'curso' : 'nada')
            const colorEstado = estado==='fin' ? 'var(--g)' : estado==='curso' ? 'var(--amb)' : 'var(--bm)'
            const activoChip = activo===s.paciente.id
            return (
            <div key={s.paciente.id} onClick={()=>{ if (activo===s.paciente.id) { setCitaVelo(s.paciente.id); avisarGuia('cita') } else { setActivo(s.paciente.id); avisarGuia('persona') } }}
              title={(s.paciente?.momento?textoMomento(s.paciente)+' · ':'')+(estado==='fin'?'Finalizado':estado==='curso'?'En curso, sin finalizar':'Sin empezar')}
              /* EL SELECCIONADO VA EN OSCURO, el guardado en verde claro. Antes los dos
                 iban en el verde de la app (relleno uno, claro el otro) y en la sala se
                 confundian: no se sabia si estabas en ese paciente o si ya estaba hecho. */
              /* CON MOMENTO (embarazo, postoperatorio…): fondo amarillo suave, para verlo
                 antes de empezar. El seleccionado sigue en oscuro y el guardado en verde. */
              style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px 3px 3px',borderRadius:99,cursor:'pointer',
                border:`1.5px solid ${activoChip?'var(--n)':(estado==='fin'?'var(--g)':s.paciente?.momento?COLOR_MOMENTO.borde:'var(--bd)')}`,
                background:activoChip?'var(--n)':(estado==='fin'?'var(--gl)':s.paciente?.momento?COLOR_MOMENTO.fondo:'var(--w)'),
                color:activoChip?'var(--w)':(estado==='fin'?'var(--gd)':'var(--gr)'),
                boxShadow:activoChip?'0 2px 6px rgba(0,0,0,.18)':'none'}}>
              {/* LA PERSONA: su cara (con el aro del color de cómo va) y su nombre de clínica.
                  Tocada otra vez, o en «▾», abre su cita: falta, sala e incidencias. */}
              <span style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:'var(--gm)',color:'var(--gd)',
                display:'grid',placeItems:'center',fontSize:10,fontWeight:600,boxShadow:`0 0 0 2px ${colorEstado}`}}><CaraPaciente p={s.paciente}/></span>
              {s.finalizado&&<span style={{fontSize:9}}>✓</span>}
              {enOtros[s.paciente.id] && (
                <span title={'Abierto también en: ' + enOtros[s.paciente.id].join(', ')}
                  style={{width:8,height:8,borderRadius:99,flexShrink:0,background:'#D4A24E',boxShadow:'0 0 0 2px #fff'}}/>
              )}
              {/* La hora solo con «Todo el día»: con una franja elegida todos son de la misma. */}
              {s.hora&&!hora&&<span style={{fontSize:8,opacity:.75}}>{s.hora}</span>}
              {!s.sesionId&&<span style={{fontSize:8,opacity:.9}} title="Sin sesión">◦</span>}
              <span style={{fontSize:12.5,fontWeight:500,textDecoration:s.estado==='falta'?'line-through':'none',opacity:s.estado==='falta'?.55:1}}>{nombreCorto(s.paciente)}</span>
              {!s.finalizado&&progreso(s)&&<span style={{fontSize:8,opacity:.8}}>{progreso(s)}</span>}
              <ChipPulso pid={s.paciente?.id}/>
              {/* Su sesión pide pulsómetro: un corazón pequeño, para ponérselo al llegar. */}
              {s.pulsometro && !hayPulso(s.paciente?.id) && <span title="Hoy lleva pulsómetro" style={{ color: '#B05A5A', fontSize: 11 }}>♥</span>}
              {activoChip && <span onClick={e=>{ e.stopPropagation(); setCitaVelo(s.paciente.id) }} title="Su cita: falta, sala e incidencias"
                style={{fontSize:11,padding:'0 2px 0 4px',opacity:.85}}>▾</span>}
            </div>
            )
          })}
          {/* Añadir a alguien que viene sin cita: junto a las personas, no arriba. */}
          {!solo && editaAgenda && <button onClick={()=>setAnadiendoPac(true)} title="Añadir a alguien a esta clase"
              style={{display:'flex',alignItems:'center',gap:4,padding:'5px 12px',borderRadius:99,cursor:'pointer',fontFamily:'inherit',
                border:'1.5px dashed var(--gm)',background:'transparent',color:'var(--gd)',fontSize:10.5,fontWeight:600}}>＋ Añadir</button>}
        </div>
      )}</>)
}
