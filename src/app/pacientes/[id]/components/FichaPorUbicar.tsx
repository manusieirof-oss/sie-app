'use client'
import { usePuede } from '@/lib/permisos'
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
import { LBL_PAGO, empiezaDespues, mesDeBono, nombreMes } from './FichaTab'

// Trozo de pantalla sacado de FichaTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function FichaPorUbicar(p: any) {
  // Bonos y pagos: solo direccion o encargada los cambian. Los demas ven que bono tiene.
  const esDir = usePuede()('direccion')
  const { bono, bonoLabel, bonosSesiones, estadoPago, onCambioSesiones, onRenovarSesiones, onRetirarSesiones, pac, setMenuPago, setMenuTipo, setModalBono, tiposClase, ubicar } = p
  return (<>{ubicar && <div className="g2">
        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="finanzas" size={13}/> Bono y cuota</span></div>
          {bono ? (
            <>
              <div style={{fontSize:14,color:'var(--n)'}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:2}}>
                Mes {mesDeBono(bono)}
                {/* Que no esta pagado se entiende distinto si el mes no ha llegado. */}
                {empiezaDespues(bono) && (
                  <span style={{color:'var(--gd)'}}> · empieza en {nombreMes(bono)}</span>
                )}
                {bono.descuento_tipo && bono.descuento_valor > 0 && (
                  <> · descuento {bono.descuento_tipo==='porcentaje'?`${bono.descuento_valor}%`:`${bono.descuento_valor}€`}{bono.descuento_motivo?` (${bono.descuento_motivo})`:''}</>
                )}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10,flexWrap:'wrap'}}>
                {esDir && <>
                <button className={`chip-ed ${estadoPago==='impago'?'chip-ed-r':estadoPago==='pendiente'?'chip-ed-a':''}`} title="Cobrar o cambiar el estado"
                  onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuPago({ x:r.left, y:r.bottom+4 })}}>
                  {LBL_PAGO[estadoPago]||'—'} <Ic name="abajo" size={12}/>
                </button>
                <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>Cambiar bono</button>
                </>}
              </div>

            </>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              {/* Con un bono de sesiones debajo, "Sin cuota mensual + Asignar bono" parecia
                  decir que no tenia bono. Ahora la cuota va en su linea y se dice que no tiene. */}
              {bonosSesiones.length > 0
                ? <><span style={{fontSize:11.5,color:'var(--gr)',width:110}}>Cuota mensual</span><span className="muted">No tiene</span></>
                : <span className="muted">Sin bono activo</span>}
              <span style={{flex:1}}/>
              {esDir && <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>{bonosSesiones.length > 0 ? '+ Asignar cuota o bono' : '+ Asignar bono'}</button>}
            </div>
          )}

          {/* BONOS POR SESIONES. FUERA DEL `if` DE LA CUOTA.
              Estaban dentro, y por eso quien tenía sesiones compradas pero NINGUNA cuota
              mensual —alguien que solo viene a individuales, o que empieza el mes que
              viene— no las veía por ningún lado: la ficha entraba por la rama de "sin
              bono activo" y ese bloque no llegaba a pintarse. El bono estaba guardado y
              la vista lo devolvía; simplemente no había nada que lo dibujara.

              Son cosas independientes: la cuota es lo que se factura cada mes y las
              sesiones son una compra suelta. Que una dependa de la otra para verse era
              atarlas sin motivo.

              Las restantes no salen de ningún contador: se cuentan desde sus citas cada
              vez que se abre la ficha. Cambiar una cita de "vino" a "canceló" devuelve la
              sesión sola. */}
          {bonosSesiones.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:12}}>
              {/* RENOVAR SOLO DESDE EL ÚLTIMO. Si ya tiene otro bono de su misma clase
                  (individual o de clases) que empezó después, el viejo no ofrece renovar
                  —ya está renovado— y, si está acabado, se pliega en una línea. Los que
                  siguen en uso van primero; los acabados, debajo. */}
              {(() => {
                const individual = (b:any) => esBonoIndividual({ id: b.tipo, nombre: bonoLabel?.[b.tipo] || b.tipo })
                const conNuevo = (bs:any) => bonosSesiones.some((o:any) => o.bono_id !== bs.bono_id && individual(o) === individual(bs)
                  && String(o.fecha_inicio || '') > String(bs.fecha_inicio || ''))
                const acabado = (bs:any) => bs.caducado || bs.restantes <= 0
                const plegar = (bs:any) => conNuevo(bs) && acabado(bs)
                return [...bonosSesiones].sort((a:any, b:any) => Number(plegar(a)) - Number(plegar(b))).map((bs:any)=>(
                  <SesionesBono key={bs.bono_id} bono={bs} nombre={bonoLabel?.[bs.tipo] || bs.tipo} plegado={plegar(bs)}
                    onRenovar={!esDir || conNuevo(bs) ? undefined : onRenovarSesiones} onRetirar={esDir ? onRetirarSesiones : undefined} onCambio={onCambioSesiones}/>
                ))
              })()}
            </div>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><span className="ct-l"><Ic name="etiqueta" size={13}/> Tipo de clase</span></div>
          <button className="chip-ed" title="Cambiar el tipo de clase"
            onClick={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();setMenuTipo({ x:r.left, y:r.bottom+4 })}}>
            <Ic name={iconTipoClase(pac.tipo_clase, tiposClase.find((t:any)=>t.valor===pac.tipo_clase)?.icono)} size={12}/>
            {pac.tipo_clase ? nombreTipoClase(tiposClase, pac.tipo_clase) : 'Sin asignar'}
            <Ic name="abajo" size={12}/>
          </button>
          <div style={{fontSize:12,color:'var(--gr)',marginTop:8,lineHeight:1.5}}>
            Se usa como tipo por defecto al darle cita nueva desde la agenda.
          </div>
          {/* LA SALA, junto al tipo de clase: las dos dicen cómo es su clase. Antes iba
              suelta al final, debajo del horario. */}
          <div className="sec-h" style={{marginTop:18}}><span className="ct-l"><Ic name="ubicacion" size={13}/> Sala</span></div>
          <div style={{paddingTop:8}}><CambiarSala pacienteId={pac.id}/></div>
        </div>
      </div>}</>)
}
