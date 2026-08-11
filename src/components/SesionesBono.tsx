'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import {
  type BonoSesiones, estadoDe, LBL_ESTADO, COLOR_ESTADO, resumenDe, UMBRAL_POCAS, bonosDe,
} from '@/lib/bonoSesiones'

// Cuántas sesiones le quedan de un bono. Se pinta donde haga falta: la ficha del
// paciente, la lista y el panel de la agenda.
//
// Los números vienen ya calculados de `v_bonos_sesiones`, que los cuenta desde
// las citas. Este componente no suma ni resta nada: si lo hiciera, sería una
// segunda forma de contar el consumo y acabaría discrepando de la primera.

export default function SesionesBono({ bono, nombre, compacto, onRenovar }: {
  bono: BonoSesiones
  nombre?: string
  compacto?: boolean
  /** Renovar: crea otro bono igual y abre el cobro. Solo aparece si se acabó. */
  onRenovar?: (bono: BonoSesiones) => void
}) {
  const estado = estadoDe(bono)
  const color = COLOR_ESTADO[estado]
  const total = bono.sesiones_totales || 0
  const gastadas = Math.min(bono.gastadas, total)
  const reservadas = Math.min(bono.reservadas, Math.max(0, total - gastadas))
  const pctGast = total ? (gastadas / total) * 100 : 0
  const pctRes = total ? (reservadas / total) * 100 : 0

  if (compacto) {
    return (
      <span title={resumenDe(bono)} style={{fontSize:10,fontWeight:600,color,whiteSpace:'nowrap'}}>
        {Math.max(0, bono.restantes)}/{total}
      </span>
    )
  }

  return (
    <div style={{border:`1px solid ${estado==='ok'?'var(--bd)':color}`,borderRadius:8,padding:'11px 13px',
                 background: estado==='ok' ? 'var(--w)' : estado==='pocas' ? 'var(--ambl)' : 'var(--redl)'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:500,color:'var(--n)'}}>{nombre || 'Bono de sesiones'}</div>
          <div style={{fontSize:9,color:'var(--grl)'}}>{resumenDe(bono)}</div>
        </div>
        <div style={{fontSize:20,fontWeight:300,color}}>{Math.max(0, bono.restantes)}</div>
        <div style={{fontSize:9,color:'var(--grl)'}}>de {total}</div>
      </div>

      {/* Gastadas en sólido, reservadas rayadas. La distinción importa: seis
          restantes de las que cuatro ya están citadas no son seis disponibles. */}
      <div style={{height:8,borderRadius:99,background:'var(--bm)',overflow:'hidden',display:'flex'}}>
        <div style={{width:`${pctGast}%`,background:color}}/>
        <div style={{width:`${pctRes}%`,background:color,opacity:.35}}/>
      </div>

      <div style={{display:'flex',gap:10,marginTop:6,fontSize:9,color:'var(--grl)',flexWrap:'wrap'}}>
        <span>{gastadas} usadas</span>
        {reservadas > 0 && <span>{reservadas} ya citadas</span>}
        {bono.libres > 0 ? <span style={{color:'var(--gd)',fontWeight:600}}>{bono.libres} por citar</span>
                         : <span style={{color:'var(--red)',fontWeight:600}}>nada libre</span>}
        {bono.ultima && <span style={{marginLeft:'auto'}}>última: {new Date(bono.ultima+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>}
      </div>

      {estado !== 'ok' && (
        <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${color}33`,fontSize:9.5,color,display:'flex',alignItems:'center',gap:5,lineHeight:1.5}}>
          <Ic name="alerta" size={11}/>
          {estado === 'caducado' ? <span><strong>{LBL_ESTADO[estado]}.</strong> Le quedaban {Math.max(0,bono.restantes)} sin usar. Puedes dejárselas gastar igual: la app avisa, no impide.</span>
           : estado === 'agotado' ? <span><strong>{LBL_ESTADO[estado]}.</strong> Toca ofrecerle uno nuevo.</span>
           : <span>Le quedan {bono.restantes} {bono.restantes===1?'sesión':'sesiones'}. Buen momento para hablar de la renovación.</span>}
        </div>
      )}

      {/* El botón va donde está el aviso, no en una pantalla aparte: el momento
          de renovar es este, mirando que se acabó. También sale con "pocas",
          porque lo que interesa es renovar ANTES de que se quede a cero y haya
          que mandarle a casa. */}
      {onRenovar && estado !== 'ok' && (
        <button className="btn btn-p btn-sm" style={{marginTop:8,width:'100%'}} onClick={()=>onRenovar(bono)}>
          <Ic name="euro" size={12}/> Renovar y cobrar
        </button>
      )}
    </div>
  )
}

/** Aviso corto para cabeceras y listas: solo aparece si hay algo que decir. */
export function AvisoSesiones({ bonos }: { bonos: BonoSesiones[] }) {
  const alerta = bonos.filter(b => estadoDe(b) !== 'ok')
  if (!alerta.length) return null
  const caducados = alerta.filter(b => estadoDe(b) === 'caducado').length
  const agotados = alerta.filter(b => estadoDe(b) === 'agotado').length
  const pocas = alerta.length - caducados - agotados
  const partes = [
    agotados && `${agotados} agotado${agotados>1?'s':''}`,
    caducados && `${caducados} caducado${caducados>1?'s':''}`,
    pocas && `${pocas} con ${UMBRAL_POCAS} o menos`,
  ].filter(Boolean)
  return (
    <span style={{fontSize:9,color:'var(--red)',fontWeight:600,display:'inline-flex',alignItems:'center',gap:3}}>
      <Ic name="alerta" size={10}/> {partes.join(' · ')}
    </span>
  )
}

/**
 * Cuántas sesiones le quedarían al paciente si se crean estas citas.
 *
 * Va DENTRO del modal de nueva cita, no en un aviso posterior: el momento de
 * saber que le quedan dos sesiones y estás citando cuatro es antes de darle a
 * crear, no después. Y avisa, no impide: si quieres citarle de más porque va a
 * renovar, se cita y ya.
 */
export function AvisoBonoEnCita({ pacienteId, nCitas = 1 }: { pacienteId?: string, nCitas?: number }) {
  const [bonos, setBonos] = useState<BonoSesiones[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    if (!pacienteId) { setBonos([]); setError(null); return }
    bonosDe(pacienteId).then(r => {
      if (!vivo) return
      setError(r.ok ? null : r.error)
      setBonos(r.bonos)
    })
    return () => { vivo = false }
  }, [pacienteId])

  // Un fallo de lectura se dice. Callarlo haría creer que no tiene bonos.
  if (error) return (
    <div style={{fontSize:9,color:'var(--red)',marginBottom:8,display:'flex',alignItems:'center',gap:4}}>
      <Ic name="alerta" size={10}/> No se han podido leer sus bonos de sesiones: {error}
    </div>
  )

  // Sin bonos de sesiones no hay nada que decir: viene por cuota mensual.
  const vivos = bonos.filter(b => !b.caducado && b.restantes > 0)
  if (!bonos.length) return null

  const libres = vivos.reduce((s, b) => s + Math.max(0, b.libres), 0)
  const faltan = Math.max(0, nCitas - libres)
  const color = faltan > 0 ? 'var(--amb)' : 'var(--gd)'

  return (
    <div style={{background: faltan>0?'var(--ambl)':'var(--gl)', border:`1px solid ${faltan>0?'var(--amb)':'var(--gm)'}`,
                 borderRadius:'var(--rl)', padding:'8px 11px', marginBottom:8, fontSize:9.5, color, lineHeight:1.6}}>
      <div style={{display:'flex',alignItems:'center',gap:5,fontWeight:600,marginBottom:2}}>
        <Ic name={faltan>0?'alerta':'ok'} size={11}/> Bono de sesiones
      </div>
      {libres > 0
        ? <>Le quedan <strong>{libres}</strong> {libres===1?'sesión':'sesiones'} sin citar. {nCitas>1 && <>Estás creando <strong>{nCitas}</strong>.</>}</>
        : <>No le queda <strong>ninguna sesión</strong> sin citar.</>}
      {faltan > 0 && <> {faltan} {faltan===1?'quedará fuera del bono':'quedarán fuera del bono'} y {faltan===1?'no descontará':'no descontarán'} nada. Se crean igual.</>}
    </div>
  )
}
