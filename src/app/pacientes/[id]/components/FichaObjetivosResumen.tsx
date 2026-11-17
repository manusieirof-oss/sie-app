'use client'
import ProgramaPaciente from '@/components/ficha/ProgramaPaciente'
import { traerTodo } from '@/lib/paginar'
import { HorarioDeseado } from '@/components/AgendaHuecos'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { esBonoIndividual } from '@/lib/bonoSesiones'
import SesionesBono from '@/components/SesionesBono'
import { iconTipoClase, nombreTipoClase } from '@/lib/tipos'
import { guardarVias, retratoDe } from '@/lib/objetivos'
import { VIAS, viasDe, marcarVia, quitarVia, type ViaOrigen } from '@/lib/viasObjetivo'
import { urgenciaDe, COLOR_URGENCIA, textoRevision, fijarRevision,
         confirmarAMano } from '@/lib/mantenimiento'
import { quietoDesde, hace, porParado } from '@/lib/antiguedad'
import { conteoPorObjetivo, testsDeObjetivo, type Evaluador } from '@/lib/objetivosTests'
import { tieneBarra } from '@/lib/tests'
import { sistemasDePaciente } from '@/lib/sistemas'
import { soloVigentes } from '@/lib/linaje'
import ModalObjetivo from '@/app/entrenamiento/components/ModalObjetivo'
import ModalEditarSesion from '@/app/entrenamiento/components/ModalEditarSesion'
import MedidasObjetivo from './MedidasObjetivo'
import DosisObjetivo from './DosisObjetivo'
import { ordenAnatomico } from '@/lib/anatomia'
import { hoyISO } from '@/lib/fechas'
import SelectorObjetivos from '@/app/entrenamiento/components/SelectorObjetivos'
import TrabajoObjetivo from './TrabajoObjetivo'
import { porRecuperar } from '@/lib/recuperaciones'
import HorarioFavorito from './HorarioFavorito'
import CambiarSala from './CambiarSala'
import FichaPorUbicar from './FichaPorUbicar'
import { fmtLargo, haceCuanto } from './FichaTab'

// Trozo de pantalla sacado de FichaTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function FichaObjetivosResumen(p: any) {
  const { filtroVia, hayObjetivos, objPide, objetivosActivos, objetivosLogrados, objetivosTrabajo, orden, pintarMoneda, resumen, setBuscarObj, setFiltroVia, setModalAnadir, setOrden, setPideTexto, setSelObj, setViaAnadir, setZonaObj, tipoVal, valoracion } = p
  return (<>{resumen && hayObjetivos && (() => {
        const ordenVia = (o:any) => {
          const vs = viasDe(o)
          const i = VIAS.findIndex(v => vs.includes(v.valor))
          return i < 0 ? VIAS.length : i
        }
        const porVia = (lista:any[]) => [...lista].sort((a:any,b:any)=>
          orden==='parado'
            ? porParado(a,b) || String(a.nombre||'').localeCompare(String(b.nombre||''))
            : ordenVia(a)-ordenVia(b) || String(a.nombre||'').localeCompare(String(b.nombre||'')))

        const visibles = porVia(filtroVia
          ? objetivosActivos.filter((o:any)=>viasDe(o).includes(filtroVia as ViaOrigen))
          : objetivosActivos)
        // Lo que escribió en la valoración y todavía no es un objetivo de verdad.
        const pendientesPide = (filtroVia === '' || filtroVia === 'pide')
          ? objPide.filter((t:string)=>objetivosTrabajo.some((x:any)=>x.pide_texto===t) === false)
          : []

        return (
        <div className="sec">
          <div className="sec-h">
            <span className="ct-l"><Ic name="objetivo" size={13}/> Objetivos</span>
            <span className="sh-r" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              {VIAS.map(v=>{
                const n = objetivosActivos.filter((o:any)=>viasDe(o).includes(v.valor)).length
                  + (v.valor==='pide' ? objPide.filter((t:string)=>objetivosTrabajo.some((x:any)=>x.pide_texto===t)===false).length : 0)
                return (
                  <button key={v.valor} type="button" title={v.ayuda}
                    onClick={()=>setFiltroVia((f: any)=>f===v.valor?'':v.valor)}
                    style={{fontSize:10,padding:'2px 9px',borderRadius:99,cursor:'pointer',fontFamily:'inherit',
                      opacity:n===0?.45:1,
                      background:filtroVia===v.valor?v.fondo:'transparent',
                      color:filtroVia===v.valor?v.color:'var(--gr)',
                      border:`1px solid ${filtroVia===v.valor?v.color:'var(--bd)'}`}}>
                    {v.nombre} · {n}
                  </button>
                )
              })}
              {/* LO MAS PARADO PRIMERO. La fila estaba ordenada por via, que dice de
                  donde sale cada uno pero no cual lleva medio ano sin que le pase
                  nada. Ver `lib/antiguedad`. */}
              <button type="button" title="Ordenar por el que lleva más tiempo sin que le pase nada"
                onClick={()=>setOrden((x: any)=>x==='parado'?'via':'parado')}
                style={{fontSize:10,padding:'2px 9px',borderRadius:99,cursor:'pointer',fontFamily:'inherit',
                  background:orden==='parado'?'var(--gl)':'transparent',
                  color:orden==='parado'?'var(--gd)':'var(--gr)',
                  border:`1px solid ${orden==='parado'?'var(--gm)':'var(--bd)'}`}}>
                lo más parado
              </button>
              <button className="btn btn-t btn-sm"
                data-guia="ficha-objetivo" onClick={()=>{setSelObj([]);setBuscarObj('');setZonaObj('');setPideTexto(null);setViaAnadir('plan');setModalAnadir(true)}}>
                <Ic name="mas" size={12}/> Añadir
              </button>
            </span>
          </div>

          {valoracion?.fecha && (
            <div className="sec-sub" style={{marginBottom:6}}>
              Lo que pide sale de la {tipoVal.toLowerCase()} del {fmtLargo(valoracion.fecha)}, {haceCuanto(valoracion.fecha)}
            </div>
          )}

          {objetivosTrabajo.length===0 && pendientesPide.length===0 && (
            <div className="muted">Sin objetivos todavía</div>
          )}
          {objetivosTrabajo.length>0 && visibles.length===0 && pendientesPide.length===0 && (
            <div className="muted">
              {objetivosActivos.length===0 ? 'Todos los objetivos logrados' : 'Ninguno por esa vía'}
            </div>
          )}

          {(visibles.length>0 || pendientesPide.length>0) && (
            <div className="obj-rej">
              {visibles.map(pintarMoneda)}
              {/* Los deseos que aún no son objetivo, en la misma fila y al final: son lo
                  que queda por convertir, no una categoría aparte. */}
              {pendientesPide.map((t:string,i:number)=>(
                <div key={'p'+i} className="obj-mon-b" title={t + ' · hazlo objetivo para poder medirlo'}
                  onClick={()=>{ setPideTexto(t); setViaAnadir('pide'); setSelObj([]); setBuscarObj(''); setModalAnadir(true) }}>
                  <span className="obj-moneda g pide"><b>{(t||'?').trim().charAt(0).toUpperCase()}</b></span>
                  <span className="obj-mon-g">{t}</span>
                  <span style={{fontSize:10,color:'#7B4E86'}}>+ hacerlo objetivo</span>
                </div>
              ))}
            </div>
          )}


          {objetivosLogrados.length>0 && (
            <details style={{marginTop:9}}>
              <summary className="det-sum">
                <Ic name="trofeo" size={12} style={{verticalAlign:'-2px',marginRight:5}}/>
                Logrados · {objetivosLogrados.length}
              </summary>
              <div style={{marginTop:6}}>
                <div className="obj-rej">{porVia(objetivosLogrados).map(pintarMoneda)}</div>
              </div>
            </details>
          )}

          {valoracion?.deseo && (
            <div style={{marginTop:9,padding:'8px 10px',background:'var(--ambl)',fontSize:12,color:'#7A5800',display:'flex',gap:6,alignItems:'flex-start'}}>
              <span style={{display:'inline-flex',flexShrink:0,marginTop:1}}><Ic name="estrella" size={12}/></span>{valoracion.deseo}
            </div>
          )}
        </div>
        )
      })()}</>)
}
