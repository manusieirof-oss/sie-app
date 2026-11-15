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
import ModalSalida from './ModalSalida'

// Trozo de pantalla sacado de page.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
type CosaMomento = any

export default function ModalMomento(p: any) {
  const { editMomento, etiquetasLib, guardarMomento, molestias, operaciones, pac, patologias, setEditMomento } = p
  return (<>{editMomento && (
        <div className="modal-bg" onClick={e=>{ if (e.target===e.currentTarget) setEditMomento(null) }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-title">Su momento<button className="modal-close" onClick={()=>setEditMomento(null)}>✕</button></div>
            <div className="field"><label>En qué momento está</label>
              <input className="input" value={editMomento.texto} autoFocus placeholder="Embarazo, postoperatorio de rodilla, vuelta de lesión…"
                onChange={e=>setEditMomento((m: any)=>m && ({ ...m, texto: e.target.value }))}/>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                {['Embarazo','Postparto','Postoperatorio','Vuelta de lesión','Fase aguda','Mantenimiento'].map(t =>
                  <button key={t} type="button" className={'chip-sel' + (editMomento.texto === t ? ' on' : '')} style={{ textTransform:'none', letterSpacing:0 }}
                    onClick={()=>setEditMomento((m: any)=>m && ({ ...m, texto: t }))}>{t}</button>)}
              </div>
            </div>
            {/* LO QUE TIENE QUE VER: sus patologías, molestias activas y operaciones, para
                ligarlas a este momento (p. ej. Postoperatorio → Ligamento cruzado). */}
            {(() => {
              const opciones: CosaMomento[] = [
                ...(patologias||[]).filter((x:any)=>x.estado!=='resuelta').map((x:any)=>({ tipo:'patologia' as const, id:x.id, nombre:x.nombre })),
                ...(molestias||[]).filter((x:any)=>x.activa).map((x:any)=>({ tipo:'molestia' as const, id:x.id, nombre:x.zona })),
                ...(operaciones||[]).map((x:any)=>({ tipo:'operacion' as const, id:x.id, nombre:x.nombre })),
              ]
              if (!opciones.length) return null
              const puesta = (o: CosaMomento) => editMomento.cosas.some((c: any) => c.tipo===o.tipo && c.id===o.id)
              const ETQ = { patologia:'Patología', molestia:'Molestia', operacion:'Operación' }
              return <div className="field"><label>Tiene que ver con <span style={{ color:'var(--grl)', fontWeight:400 }}>· opcional</span></label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {opciones.map(o => <button key={o.tipo+o.id} type="button" className={'chip-sel' + (puesta(o) ? ' on' : '')} style={{ textTransform:'none', letterSpacing:0 }}
                    onClick={()=>setEditMomento((m: any)=>m && ({ ...m, cosas: puesta(o) ? m.cosas.filter((c: any)=>!(c.tipo===o.tipo && c.id===o.id)) : [...m.cosas, o] }))}>
                    <span style={{ color:'var(--grl)', fontWeight:400 }}>{(ETQ as any)[o.tipo]} ·</span> {o.nombre}</button>)}
                </div></div>
            })()}
            {/* LO QUE DICE CLÍNICO DE ESTE MOMENTO: el propio momento («Embarazo») y sus
                patologías y operaciones, si en Clínico tienen «qué evitar / qué conviene». */}
            {(() => {
              const nombres = [editMomento.texto, ...editMomento.cosas.filter((c: any) => c.tipo !== 'molestia').map((c: any) => c.nombre)].filter(Boolean)
              const rs = nombres.flatMap(n => reglasDe(n))
              const ev = Array.from(new Set(rs.flatMap(r => r.evitar))), co = Array.from(new Set(rs.flatMap(r => r.conviene)))
              const nm = (id: string) => { if (id.includes('+')) return nombreRegla(etiquetasLib, id); const e = etiquetasLib.find((x: any) => x.id === id); return e ? nombreConRama(etiquetasLib, e) : '' }
              if (!ev.length && !co.length) return null
              return <div style={{ fontSize: 12.5, lineHeight: 1.6, background: 'var(--bl)', borderRadius: 10, padding: '8px 11px', marginBottom: 10 }}>
                {ev.length > 0 && <div><b style={{ color: 'var(--red)', fontWeight: 500 }}>Evitar:</b> {ev.map(nm).filter(Boolean).join(', ')}</div>}
                {co.length > 0 && <div><b style={{ color: 'var(--gd)', fontWeight: 500 }}>Conviene:</b> {co.map(nm).filter(Boolean).join(', ')}</div>}
                <div style={{ fontSize: 11, color: 'var(--grl)' }}>Sale de Clínico. En el taller avisa en los ejercicios que lleven algo a evitar.</div>
              </div>
            })()}
            {/* Embarazo: la FPP manda (semana y trimestre salen de ella). Otros: desde y,
                si se sabe, hasta cuándo, para la cuenta atrás. */}
            <div className="g2">
              {!esEmbarazo(editMomento.texto) && <div className="field"><label>Desde</label>
                <input className="input" type="date" value={editMomento.desde} onChange={e=>setEditMomento((m: any)=>m && ({ ...m, desde: e.target.value }))}/></div>}
              <div className="field"><label>{esEmbarazo(editMomento.texto) ? 'Fecha probable de parto (FPP)' : 'Hasta'} <span style={{ color:'var(--grl)', fontWeight:400 }}>{esEmbarazo(editMomento.texto) ? '' : '· opcional'}</span></label>
                <input className="input" type="date" value={editMomento.hasta} onChange={e=>setEditMomento((m: any)=>m && ({ ...m, hasta: e.target.value }))}/></div>
            </div>
            {editMomento.hasta && <div style={{ margin:'2px 0 10px' }}>
              <BarraMomento p={{ momento: editMomento.texto, momento_desde: editMomento.desde, momento_hasta: editMomento.hasta }} ancho={400}/></div>}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              {pac?.momento && <button className="btn btn-d btn-sm" onClick={()=>guardarMomento(null, null)}>Quitar momento</button>}
              <div style={{ flex:1 }}/>
              <button className="btn btn-t btn-sm" onClick={()=>setEditMomento(null)}>Cancelar</button>
              <button className="btn btn-p btn-sm" disabled={!editMomento.texto.trim()} onClick={()=>guardarMomento(editMomento.texto.trim(), editMomento.desde, editMomento.cosas, editMomento.hasta)}>Guardar</button>
            </div>
          </div>
        </div>
      )}</>)
}
