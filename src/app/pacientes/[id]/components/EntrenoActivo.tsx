'use client'
import { finalizarSesion, diasActiva, avisoDias, AVISO_DIAS_DEFECTO, partesEnFecha } from '@/lib/sesionViva'
import { VeloFinalizar } from '@/components/SustituirSesion'
import { traerTodo } from '@/lib/paginar'
import { useEffect, useState } from 'react'
import { useColoresSesion, PALETA_SESIONES } from '@/lib/coloresSesion'
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
import EntrenoSistemas from './EntrenoSistemas'
import EntrenoSesiones from './EntrenoSesiones'

// Trozo de pantalla sacado de EntrenoTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function EntrenoActivo(p: any) {
  const { abrirCalendario, citasFuturas, citasPasadas, editaPlan, escalones, evaluaciones, logrados, pacienteId, pinta, pintaMarco, regsPasados, seccion, setVistaPlan, sistemasPac, testsDia, vistaPlan } = p
  // El color de cada sesión, el mismo que en el torno (lib/coloresSesion).
  const coloresPac = useColoresSesion(pacienteId)
  return (<>{seccion==='activo'&&(()=>{
        const total=citasFuturas.length
        const conSes=citasFuturas.filter((c: any)=>c.sesiones).length
        const pct=total>0?Math.round((conSes/total)*100):0
        const sinSesion=citasFuturas.filter((c: any)=>!c.sesiones)


        // El sistema que manda pinta la cita; el tono sube al cambiar de fase, y así
        // el corte entre tramos se ve sin leer nada. Los demas sistemas van de punto.
        const marco = pintaMarco
        const otros = sistemasPac.filter((a: any)=>a!==marco)
        const pintar = pinta

        // Donde cambia la fase, una linea. De TODOS sus sistemas, no solo del
        // marco: el embarazo avanza por trimestres aunque el color lo ponga otro.
        // Los de una sola fase no cortan nada, asi que no dicen nada.
        const cortesEn: Record<string, any[]> = {}
        sistemasPac.forEach((a:any) => {
          const sis = a.sistema
          if (sis == null) return
          let ant: string | null = null
          citasFuturas.forEach((c:any) => {
            const t = faseEn(sis, a, c.fecha, logrados, escalones)
            const id = t ? t.fase.id : null
            if (id !== ant && t) {
              if (cortesEn[c.id] == null) cortesEn[c.id] = []
              cortesEn[c.id].push({ color: sis.color, sistema: sis.nombre, fase: t.fase })
            }
            ant = id
          })
        })

        // La evaluacion de cada dia. Se casa por cita si la tiene apuntada, y si no
        // por fecha: lo que se marca en la tarjeta del sistema es un dia.
        const evalDe = (c: any) => {
          // Su dia general, y tambien cualquier dia al que se haya llevado un test
          // suelto: si ese jueves toca uno, el jueves es dia de evaluacion.
          const sueltos = new Set((testsDia[c.fecha] || []).map((x: any) => x.evaluacionId))
          return evaluaciones.filter((e: any) =>
            (e.cita_id != null && e.cita_id === c.id)
            || (e.cita_id == null && e.fecha === c.fecha)
            || sueltos.has(e.id))
        }
        /** El nombre de la fase que se evalua, buscandolo en el sistema del paciente. */
        const faseDeEval = (e: any) => {
          const a = sistemasPac.find((x: any) => x.id === e.asignacion_id)
          const f = (a?.sistema?.fases || []).find((x: any) => x.id === e.fase_id)
          return { nombre: f?.nombre || 'fase', color: a?.sistema?.color || 'var(--g)' }
        }

        // Lista o vista interactiva: el mismo conmutador pequeño arriba en las dos.
        // Arriba a la derecha, discreto (como los botones de vistas de la ficha): un botón
        // que pasa de Calendario a Vista interactiva, y al lado ir al torno a cambiarlo.
        const VPL = [['calendario','Calendario'],['interactiva','Vista interactiva']] as const
        const iV = Math.max(0, VPL.findIndex(([k])=>k===vistaPlan))
        const conmutador = (
          <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:2,marginBottom:8,flexWrap:'wrap'}}>
            <button type="button" className="btn-suave" onClick={()=>setVistaPlan(VPL[(iV+1)%VPL.length][0])} title="Cambiar la vista">
              <Ic name={vistaPlan==='calendario'?'calendario':'lista'} size={13}/> {VPL[iV][1]}
              <span style={{display:'inline-flex',gap:2,marginLeft:2}}>{VPL.map((_,k)=><i key={k} style={{width:4,height:4,borderRadius:'50%',background:'currentColor',opacity:k===iV?1:.3}}/>)}</span>
            </button>
            {editaPlan && <span style={{width:1,height:14,background:'var(--bd)',margin:'0 4px'}}/>}
            {editaPlan && <button type="button" className="btn-suave" onClick={()=>abrirCalendario()} title="Cambiar sesiones y citas en el torno">
              <Ic name="recuperar" size={13}/> Cambiar en el torno</button>}
          </div>
        )

        // VISTA INTERACTIVA: sus citas como al acabar en el torno. Un color por sesión
        // (en el orden en que salen), la fase del sistema que manda y sus evaluaciones.
        // CAMBIAR: la misma pieza que en la agenda (Programación), con todas sus citas.
        // «Cambiar sesiones» ya no está aquí: para cambiar algo se va al torno.
        if (vistaPlan==='interactiva') {
          const PALETA = PALETA_SESIONES
          const colorSes: Record<string,string> = { ...coloresPac }
          const filas: FilaPieza[] = citasFuturas.map((c:any): FilaPieza=>{
            const fase = marco?.sistema ? faseEn(marco.sistema, marco, c.fecha, logrados, escalones) : null
            return { id: c.id, fecha: c.fecha, hora: c.hora || null, nueva: false,
              ses: c.sesiones ? { nombre: c.sesiones.nombre, color: colorSes[c.sesion_id] || PALETA[0], fase: fase?.fase?.nombre, partes: c.sesiones.partes || [] } : null,
              evs: evalDe(c).map((e:any)=>{ const fd=faseDeEval(e); return { momento: (e.momento==='inicial'?'inicial':'final') as 'inicial'|'final', faseNombre: fd.nombre, color: fd.color, tests: [] } }) }
          }).filter((f: any)=>f.ses||f.evs.length>0)
          /* MISMA SESIÓN DOS VECES EN UNA SEMANA (lunes a domingo), contando lo ya hecho
             esa semana: es lo que en sala resulta repetitivo. Solo avisa. */
          const lunes = (iso:string) => { const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d.toISOString().slice(0,10) }
          const enSemana: Record<string,number> = {}
          ;[...citasPasadas.filter((c:any)=>c.estado==='realizada'), ...citasFuturas].forEach((c:any)=>{ if (c.sesion_id) { const k=lunes(c.fecha)+c.sesion_id; enSemana[k]=(enSemana[k]||0)+1 } })
          filas.forEach(f=>{ const c=citasFuturas.find((x:any)=>x.id===f.id); if (c?.sesion_id && enSemana[lunes(c.fecha)+c.sesion_id]>1) f.aviso=`↻ ${c.sesiones?.nombre||'Esta sesión'} otra vez esta semana` })
          // Las pasadas: lo que se le apuntó cada día, con series × reps (o peso / segundos).
          const detalle = (series:any[]) => { const ss=(series||[]).filter((x:any)=>x&&(x.reps||x.segundos||x.peso||x.banda)); if(!ss.length) return ''
            const x=ss[0]; return `${ss.length}×${x.reps||x.segundos&&x.segundos+'s'||''}${x.peso?' · '+x.peso+'kg':x.banda?' · '+x.banda:''}` }
          const pasadas: FilaPieza[] = citasPasadas.map((c:any): FilaPieza=>({ id:'p'+c.id, fecha:c.fecha, hora:c.hora||null, nueva:false, evs:[],
            ses: c.sesiones ? { nombre:c.sesiones.nombre, color: colorSes[c.sesion_id] || 'var(--gm)', partes: c.sesiones.partes||[] } : { nombre:'Sin sesión', color:'var(--gm)', partes:[] },
            pasada: { vino: c.estado==='realizada', hechos: c.estado==='realizada' ? regsPasados.filter((r:any)=>r.fecha===c.fecha).map((r:any)=>({ nombre: r.ejercicio_nombre||'—', ejercicio_id: r.ejercicio_id, detalle: detalle(r.series) })) : [] } }))
          filas.unshift(...pasadas)
          return (
            <div className="panel">
              {conmutador}
              {filas.length===0
                ? <div className="muted" style={{textAlign:'center',padding:30}}>Ninguna cita por delante tiene sesión todavía.</div>
                : <div style={{maxWidth:620,margin:'0 auto',padding:'6px 0 20px'}}><PiezaCitas filas={filas}/></div>}
            </div>
          )
        }

        // PLANIFICACIÓN COMO EN EL TORNO: la barra de cuántas citas por delante tienen
        // sesión y el calendario (mes pasado, actual y siguiente; o 6 meses, o un año).
        // Para cambiar algo, al torno. Los sistemas van ahora en la pestaña Sesiones.
        return (
        <div className="panel">
          {conmutador}
          <div className="sec">
            <div className="sec-h">
              <span className="sh-l">
                <span className="ct-l"><Ic name="calendario" size={13}/> Citas por delante</span>
                {total>0 && <span className="sh-r">{conSes} de {total} con sesión · {pct}%</span>}
              </span>
            </div>
            {total>0 && (
              <div style={{height:6,background:'var(--bm)',borderRadius:99,overflow:'hidden',marginBottom:16}}>
                <div style={{height:'100%',background:'var(--g)',borderRadius:99,width:pct+'%',transition:'width .3s'}}/>
              </div>
            )}
            {total===0&&<div className="muted" style={{marginBottom:12}}>Sin citas futuras programadas</div>}
            <CalendarioCitasPaciente pacienteId={pacienteId} puedeEditar={editaPlan}/>
          </div>
        </div>
        )
      })()}</>)
}
