'use client'
import { cargarReglas, reglasDe, nombreRegla } from '@/lib/reglasClinicas'
import { nombreConRama } from '@/lib/etiquetas'
import { altaEnVald } from '@/lib/vald'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarBonosTipos, quitarBono, BonoTipo, cuotaVigenteDe } from '@/lib/bonos'
import FichaTab from './components/FichaTab'
import { textoMomento, esEmbarazo } from '@/lib/momento'
import BarraMomento from '@/components/BarraMomento'
import Documentos from './components/Documentos'
import Consentimientos from './components/Consentimientos'
import { listarDocumentos } from '@/lib/documentos'
import { consentimientosVigentes, CONSENTIMIENTOS } from '@/lib/consentimientos'
import TimelineTab from './components/TimelineTab'
import SaludTab from './components/SaludTab'
import ResultadosTab from './components/ResultadosTab'
import EntrenoTab from './components/EntrenoTab'
import { Ic } from '@/lib/icons'
import { nombreTipoClase, cargarTiposClase, TIPOS_CLASE_FALLBACK } from '@/lib/tipos'
import { subirFotoPaciente, urlFotoPaciente } from '@/lib/fotos'
import { registrarResultadoTest, textoMedida, esSuma, ladoOpuesto } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import ModalCobro from '@/components/ModalCobro'
import { cargarTarifas } from '@/lib/tarifas'
import { bonosDe, renovarBonoSesiones, type BonoSesiones } from '@/lib/bonoSesiones'
import { programarEstado, anularProgramacion, estadoDe as situacionDe, ESTADOS_PACIENTE, textoDesde } from '@/lib/estadosPaciente'
import ModalRealizarTest, { ladoVacio } from '@/components/ModalRealizarTest'
import { asistencia } from '@/lib/resultados'
import { leerLista } from '@/lib/listasPaciente'
import { cerrarAlerta as cerrarAlertaLib } from '@/lib/alertas'
import ModalAlertasCita from '@/app/agenda/components/ModalAlertasCita'
import ModalBono from '../components/ModalBono'
import { borrarPaciente, siguePaciente } from '@/lib/borrarPaciente'
import { cerrarCuotasFuturas } from '@/lib/estadosPaciente'
import { useParams, useRouter } from 'next/navigation'
import { hoyISO } from '@/lib/fechas'
import { usePuede } from '@/lib/permisos'
import { traerTodo } from '@/lib/paginar'
import { recuperacionAlCambiarEstado, recuperacionAlEliminar } from '@/lib/recuperaciones'
import { soltarDelBono, atarCitaABono } from '@/lib/bonoSesiones'

// Trozo de pantalla sacado de page.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function ModalSalida(p: any) {
  const { guardarSalida, modalSalida, opcionesSalida, procesando, salida, setModalSalida, setSalida } = p
  return (<>{modalSalida && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalSalida(false)}}>
          <div className="modal" style={{maxWidth:430}}>
            <div className="modal-title">
              <span className="ct-l"><Ic name="calendario" size={16}/> {salida.estado==='activo' ? 'Programar vuelta' : 'Programar salida'}</span>
              <button className="modal-close" onClick={()=>setModalSalida(false)}>✕</button>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,lineHeight:1.6}}>
              {salida.estado==='activo'
                ? <>Hasta ese día <strong>no cambia nada</strong>: no cuenta como cliente ni se le
                    cobra. Esa fecha vuelve a estar activo solo, sin tocarle ninguna cita.
                    El bono se le asigna aparte, con su propia fecha de inicio.</>
                : <>Hasta ese día, <strong>no cambia nada</strong>: sigue en la agenda, se le
                    cobra el mes y aparece en las listas. A partir de esa fecha se aplica
                    solo y se le cancelan las citas.</>}
            </div>

            <div className="field">
              <label>{salida.estado==='activo' ? '¿Qué se programa?' : '¿Qué pasa con esta persona?'}</label>
              {/* Mismas palabras y mismos iconos que el menú de los tres puntos.
                  Si allí pone "Puede volver" y aquí "Lo deja, pero puede volver",
                  parecen dos cosas distintas y hay que pararse a comprobar que no
                  lo son. Y en el mismo orden, por lo mismo. */}
              <div style={{display:'flex',gap:6}}>
                {opcionesSalida.map(([v,l,ic]: any)=>(
                  <button key={v} type="button" onClick={()=>setSalida((p: any)=>({...p,estado:v}))}
                    style={{flex:1,padding:'8px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                            border:`1.5px solid ${salida.estado===v?'var(--g)':'var(--bd)'}`,
                            background:salida.estado===v?'var(--g)':'var(--w)',
                            color:salida.estado===v?'#fff':'var(--gr)'}}>
                    <Ic name={ic} size={13}/> {l}
                  </button>
                ))}
              </div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4,lineHeight:1.5}}>
                {situacionDe(salida.estado).ayuda}
              </div>
            </div>

            <div className="field">
              <label>{salida.estado==='activo' ? 'Primer día que vuelve *' : 'Primer día que ya no viene *'}</label>
              <input type="date" className="input" value={salida.desde}
                min={hoyISO()}
                onChange={e=>setSalida((p: any)=>({...p,desde:e.target.value}))}/>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>
                {salida.estado==='activo'
                  ? 'Ese día amanece activo. Acuérdate de asignarle el bono y de ponerle citas.'
                  : 'Su última clase es el día ANTERIOR a este. Si lo deja a final de agosto, pon el 1 de septiembre. Las citas de ese día en adelante se cancelan.'}
              </div>
            </div>

            <div className="field">
              <label>Motivo (opcional)</label>
              <input className="input" placeholder={salida.estado==='activo' ? 'ej. vuelve tras la lesión' : 'ej. se muda, lesión, precio'}
                value={salida.motivo} onChange={e=>setSalida((p: any)=>({...p,motivo:e.target.value}))}/>
            </div>

            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalSalida(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarSalida} disabled={procesando||!salida.desde}>
                {procesando?'…':'✓ Programar'}
              </button>
            </div>
          </div>
        </div>
      )}</>)
}
