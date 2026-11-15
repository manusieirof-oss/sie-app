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

// Trozo de pantalla sacado de ModoClase.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function VeloSustituir(p: any) {
  const { cambiarParaSiempre, cambioSiempre, catalogoEj, editaPlan, etiquetas, quitarDeSuSesion, seleccion, setCambioSiempre, setSustituyendo, sustituir, sustituyendo } = p
  return (<>{sustituyendo && (
        <div className="modal-bg" style={{zIndex:150}} onClick={e=>{if(e.target===e.currentTarget)setSustituyendo(null)}}>
          <div className="modal" style={{width:'min(900px, 96vw)',maxHeight:'90vh',overflowY:'auto'}}>
            <div className="modal-title">
              Cambiar «{seleccion.find((x:any)=>x.paciente.id===sustituyendo.pid)?.datos?.[sustituyendo.i]?.nombre}»
              <button className="modal-close" onClick={()=>setSustituyendo(null)}>✕</button>
            </div>
            {/* PARA HOY O PARA SIEMPRE. Para siempre (y quitarlo de su sesión), desde el
                nivel 3: el 2 ajusta solo la clase de hoy. */}
            {!editaPlan && <div style={{fontSize:12,color:'var(--gr)',margin:'-4px 0 10px'}}>Solo esta clase: su sesión no cambia.</div>}
            {editaPlan && <>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'-4px 0 10px'}}>
              <div style={{display:'inline-flex',background:'#E8E7E1',borderRadius:99,padding:3}}>
                {([['hoy','Solo hoy'],['siempre','Para siempre']] as const).map(([v,l])=>(
                  <button key={v} onClick={()=>setCambioSiempre(v==='siempre')}
                    style={{border:0,borderRadius:99,padding:'6px 14px',fontSize:13,cursor:'pointer',fontFamily:'inherit',
                      background:(v==='siempre')===cambioSiempre?'#fff':'transparent',color:(v==='siempre')===cambioSiempre?'var(--n)':'var(--gr)',
                      boxShadow:(v==='siempre')===cambioSiempre?'0 1px 4px rgba(0,0,0,.08)':'none'}}>{l}</button>
                ))}
              </div>
              <span style={{fontSize:12,color:'var(--gr)'}}>{cambioSiempre
                ? 'Se cambia en su sesión, con las mismas series y repes, y saldrá así en sus próximas clases.'
                : 'Solo esta clase: su sesión no cambia.'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'0 0 12px',padding:'8px 11px',
              borderRadius:7,background:'var(--redl)',border:'1px solid #E8C4C4'}}>
              <span style={{flex:1,minWidth:200,fontSize:12,color:'var(--gr)'}}>¿No es solo hoy? Quítalo de su sesión y no volverá a salir en sus clases.</span>
              <button className="btn btn-d btn-sm" onClick={()=>quitarDeSuSesion(sustituyendo.pid, sustituyendo.i)}>Quitar de su sesión</button>
            </div>
            </>}
            {catalogoEj.length === 0
              ? <div className="muted" style={{padding:20}}>Cargando ejercicios…</div>
              : <ExploradorEjercicios ejercicios={catalogoEj} etiquetas={etiquetas} botonCrear={false}
                  /* PRIMERO LOS IGUALES: los del mismo movimiento (o parecidos), y el resto
                     de la biblioteca solo si se busca o se filtra. */
                  sugeridos={(()=>{ const e = seleccion.find((x:any)=>x.paciente.id===sustituyendo.pid)?.datos?.[sustituyendo.i]
                    const base = catalogoEj.find((x:any)=>x.id===e?.ejercicio_id)
                    // YA NO EXISTE: los que se le parecen por el nombre (se renombró o se fusionó).
                    if (!base && e?.nombre) {
                      const pal = normalizar(e.nombre).replace(/[·\-]/g, ' ').split(/\s+/).filter((w:string) => w.length > 3)
                      const items = catalogoEj.map((x:any) => ({ x, n: pal.filter((w:string) => normalizar(x.nombre).includes(w)).length }))
                        .filter((o:any) => o.n > 0).sort((a:any, b:any) => b.n - a.n || a.x.nombre.length - b.x.nombre.length).slice(0, 12).map((o:any) => o.x)
                      return items.length ? { titulo: `Parecidos a «${e.nombre}»`, items } : undefined
                    }
                    const r = igualesA(catalogoEj, base, etiquetas)
                    return r.items.length ? r : undefined })()}
                  soloSugeridos
                  /* El nivel 2 cambia solo por similares (y solo hoy). */
                  soloSimilares={!editaPlan}
                  onAbrir={(ej:any)=>cambioSiempre && editaPlan ? cambiarParaSiempre(sustituyendo.pid, sustituyendo.i, ej) : sustituir(sustituyendo.pid, sustituyendo.i, ej)}/>}
          </div>
        </div>
      )}</>)
}
