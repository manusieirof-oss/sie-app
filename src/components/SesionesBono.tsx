'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import {
  type BonoSesiones, estadoDe, LBL_ESTADO, COLOR_ESTADO, resumenDe, UMBRAL_POCAS, bonosDe,
  ESTADOS_QUE_GASTAN, ESTADO_RESERVA,
} from '@/lib/bonoSesiones'

// Cuántas sesiones le quedan de un bono. Se pinta donde haga falta: la ficha del
// paciente, la lista y el panel de la agenda.
//
// Los números vienen ya calculados de `v_bonos_sesiones`, que los cuenta desde
// las citas. Este componente no suma ni resta nada: si lo hiciera, sería una
// segunda forma de contar el consumo y acabaría discrepando de la primera.

export default function SesionesBono({ bono, nombre, compacto, onRenovar, onRetirar }: {
  bono: BonoSesiones
  nombre?: string
  compacto?: boolean
  /** Renovar: crea otro bono igual y abre el cobro. Solo aparece si se acabó. */
  onRenovar?: (bono: BonoSesiones) => void
  /**
   * Retirar el bono. Solo si no está cobrado; lo comprueba `quitarBono`.
   *
   * Antes esto no existía: la cuota mensual sí se podía retirar y los bonos de sesiones
   * no, así que un bono asignado por error solo se quitaba entrando a la base de datos.
   * Y asignar uno por error es fácil justo cuando no se ven en la ficha, que es como
   * salió esto.
   */
  onRetirar?: (bono: BonoSesiones) => void
}) {
  const [retirando, setRetirando] = useState(false)
  const [citas, setCitas] = useState<{ fecha: string, estado: string }[]>([])
  const [pago, setPago] = useState<'cobrado' | 'impago' | 'pendiente' | null>(null)
  const estado = estadoDe(bono)
  const color = COLOR_ESTADO[estado]
  const total = bono.sesiones_totales || 0
  const gastadas = Math.min(bono.gastadas, total)
  const reservadas = Math.min(bono.reservadas, Math.max(0, total - gastadas))
  const restantes = Math.max(0, bono.restantes)
  const libres = Math.max(0, bono.libres)

  // Las fechas de cada sesion y si esta cobrado. Antes la tarjeta solo tenia
  // numeros sueltos ("3 de 4" dos veces, "1 usadas") y no decia si el bono se
  // habia pagado, asi que habia que ir a Cobros para saberlo. Los NUMEROS siguen
  // saliendo de la vista; las citas solo ponen fecha a cada casilla.
  useEffect(() => {
    if (compacto) return
    let vivo = true
    ;(async () => {
      const [c, vp, bo] = await Promise.all([
        supabase.from('citas').select('fecha,estado').eq('bono_id', bono.bono_id)
          .in('estado', [...ESTADOS_QUE_GASTAN, ESTADO_RESERVA]).order('fecha'),
        supabase.from('v_bonos_pago').select('pagado').eq('bono_id', bono.bono_id).maybeSingle(),
        supabase.from('bonos').select('estado_pago').eq('id', bono.bono_id).maybeSingle(),
      ])
      if (!vivo) return
      setCitas((c.data || []) as any)
      // Igual que la cuota: cobrado lo dice el cobro, impago lo marca uno a mano.
      setPago(vp.data?.pagado ? 'cobrado' : bo.data?.estado_pago === 'impago' ? 'impago' : 'pendiente')
    })()
    return () => { vivo = false }
  }, [bono.bono_id, compacto])

  if (compacto) {
    return (
      <span title={resumenDe(bono)} style={{fontSize:10,fontWeight:600,color,whiteSpace:'nowrap'}}>
        {restantes}/{total}
      </span>
    )
  }

  // Una casilla por sesion comprada: primero las gastadas, luego las citadas y
  // el resto en blanco. Asi se lee de un vistazo sin interpretar una barra.
  const hechas = citas.filter(c => (ESTADOS_QUE_GASTAN as readonly string[]).includes(c.estado))
  const citadas = citas.filter(c => c.estado === ESTADO_RESERVA)
  const casillas = Array.from({ length: total }, (_, i) => {
    if (i < gastadas) { const c = hechas[i]; return { tipo: 'usada', fecha: c?.fecha, txt: c?.estado === 'falta' ? 'no vino' : 'hecha' } }
    if (i < gastadas + reservadas) { const c = citadas[i - gastadas]; return { tipo: 'citada', fecha: c?.fecha, txt: 'con cita' } }
    return { tipo: 'libre', fecha: undefined, txt: 'sin cita' }
  })

  const ses = (n: number) => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`
  const frase = restantes <= 0
    ? <>Ha gastado las <b>{total}</b> sesiones.</>
    : reservadas <= 0
      ? <>Le quedan <b>{ses(restantes)}</b>, ninguna con cita.</>
      : libres <= 0
        ? <>Le quedan <b>{ses(restantes)}</b> y {restantes === 1 ? 'ya tiene cita' : 'todas tienen cita'}.</>
        : <>Le quedan <b>{ses(restantes)}</b>: {reservadas === 1 ? 'una ya tiene cita' : `${reservadas} ya tienen cita`} y <b>{libres === 1 ? '1 está sin citar' : `${libres} están sin citar`}</b>.</>

  const semanas = bono.caduca && !bono.caducado
    ? Math.round((new Date(bono.caduca + 'T12:00:00').getTime() - Date.now()) / (7 * 864e5)) : null

  const PILL: Record<string, [string, string, string]> = {
    cobrado: ['Cobrado', 'var(--gl)', 'var(--gd)'],
    pendiente: ['Sin cobrar', 'var(--ambl)', '#8A6410'],
    impago: ['Impago', 'var(--redl)', 'var(--red)'],
  }

  return (
    <div style={{border:`1px solid ${estado==='ok'?'var(--bd)':color}`,borderRadius:10,padding:'13px 15px',
                 background: estado==='ok' ? 'var(--w)' : estado==='pocas' ? 'var(--ambl)' : 'var(--redl)'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>{nombre || 'Bono de sesiones'}</div>
          <div style={{fontSize:11.5,color:'var(--gr)',marginTop:2}}>
            {[bono.fecha_inicio && `Comprado el ${fechaCorta(bono.fecha_inicio)}`,
              bono.caduca && `${bono.caducado ? 'caducó' : 'caduca'} el ${fechaCorta(bono.caduca)}`]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
        {pago && (
          <span style={{fontSize:11,padding:'2px 10px',borderRadius:99,whiteSpace:'nowrap',
                        background:PILL[pago][1],color:PILL[pago][2],border:`1px solid ${PILL[pago][2]}55`}}>
            {PILL[pago][0]}
          </span>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:`repeat(auto-fill,minmax(64px,1fr))`,gap:6,margin:'14px 0 6px'}}
           aria-label={`Las ${total} sesiones del bono`}>
        {casillas.map((c, i) => (
          <div key={i} style={{borderRadius:7,padding:'8px 4px',textAlign:'center',fontSize:11,lineHeight:1.35,
            border: c.tipo==='usada' ? '1px solid var(--gd)' : c.tipo==='citada' ? '1px solid var(--gm)' : '1px dashed var(--bd)',
            background: c.tipo==='usada' ? 'var(--gd)' : c.tipo==='citada' ? 'var(--gl)' : 'var(--w)',
            color: c.tipo==='usada' ? '#fff' : c.tipo==='citada' ? 'var(--gd)' : 'var(--gr)'}}>
            <b style={{display:'block',fontSize:12,fontWeight:600}}>{c.fecha ? fechaCorta(c.fecha) : '—'}</b>{c.txt}
          </div>
        ))}
      </div>
      <div style={{fontSize:13,color:'var(--n)',marginTop:4}}>{frase}</div>

      {estado !== 'ok' && (
        <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${color}33`,fontSize:11,color,display:'flex',alignItems:'center',gap:5,lineHeight:1.5}}>
          <Ic name="alerta" size={11}/>
          {estado === 'caducado' ? <span><strong>{LBL_ESTADO[estado]}.</strong> Le quedaban {restantes} sin usar. Puedes dejárselas gastar igual: la app avisa, no impide.</span>
           : estado === 'agotado' ? <span><strong>{LBL_ESTADO[estado]}.</strong> Toca ofrecerle uno nuevo.</span>
           : <span>Buen momento para hablar de la renovación.</span>}
        </div>
      )}

      {/* El boton va donde esta el aviso: el momento de renovar es este. Tambien
          sale con "pocas", para renovar ANTES de quedarse a cero. */}
      {onRenovar && estado !== 'ok' && (
        <button className="btn btn-p btn-sm" style={{marginTop:8,width:'100%'}} onClick={()=>onRenovar(bono)}>
          <Ic name="euro" size={12}/> Renovar y cobrar
        </button>
      )}

      {/* RETIRAR. Antes era el boton mas grande de la tarjeta y es lo que menos se
          usa; ahora es un enlace en el pie. Pide confirmacion en el sitio y, si el
          bono esta cobrado, lo corta `quitarBono` y explica por que. */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginTop:12,paddingTop:10,
                   borderTop:'1px solid var(--bd)',fontSize:11.5,color:'var(--grl)'}}>
        {retirando ? (
          <>
            <span style={{color:'var(--gr)',flex:1,lineHeight:1.5}}>
              ¿Retirar este bono? {gastadas > 0
                ? `Ya tiene ${gastadas} ${gastadas===1?'sesión gastada':'sesiones gastadas'}: esas citas se quedarán sin bono al que descontar.`
                : 'No se ha gastado ninguna sesión.'}
            </span>
            <button className="btn btn-t btn-sm" style={{fontSize:10}} onClick={()=>setRetirando(false)}>No</button>
            <button className="btn btn-d btn-sm" style={{fontSize:10}} onClick={()=>{setRetirando(false);onRetirar?.(bono)}}>Sí, retirar</button>
          </>
        ) : (
          <>
            <span>{semanas == null ? (bono.caducado ? 'Caducado' : 'Sin caducidad')
                   : semanas <= 0 ? 'Caduca esta semana' : `Caduca en ${semanas} ${semanas===1?'semana':'semanas'}`}</span>
            <span style={{flex:1}}/>
            {onRetirar && (
              <button type="button" onClick={()=>setRetirando(true)}
                style={{font:'inherit',fontSize:11.5,background:'none',border:'none',color:'var(--gr)',cursor:'pointer',textDecoration:'underline',padding:0}}>
                Retirar bono
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const fechaCorta = (f: string) =>
  new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

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
