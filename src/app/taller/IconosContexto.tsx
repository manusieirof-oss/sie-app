'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Flotante from './Flotante'

// ---------------------------------------------------------------------------
// LO QUE HAY QUE SABER DE ESTE PACIENTE, EN LA CABECERA
//
// El detalle se abria EN LINEA, al lado de los iconos, asi que al pulsar uno
// se ensanchaba la fila y se movia el taller entero. Ahora flota anclado al
// icono y nada se mueve.
//
// Y los objetivos no llevan icono generico: llevan su moneda, la misma esfera
// que en la ficha, porque es asi como se reconocen.
// ---------------------------------------------------------------------------

type Grupo = { k: string, icon: string, label: string, items: any[], color: string }

/** La misma esfera que en la ficha: con su foto si la tiene, y si no la inicial. */
function Bola({ o, tam = 34 }: { o: any, tam?: number }) {
  const base: any = { width: tam, height: tam, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    border: '2px solid var(--w)', boxShadow: '0 2px 6px rgba(38,40,37,.25)' }
  if (o?.imagen_url) {
    return (
      <span title={o?.nombre} style={{ ...base, background: 'var(--bl)' }}>
        <img src={o.imagen_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
      </span>
    )
  }
  return (
    <span title={o?.nombre} style={{ ...base,
      fontSize: tam > 26 ? 14 : 11, color: '#fff', textShadow: '0 1px 2px #23474D',
      background: 'radial-gradient(circle at 33% 28%, #fff 0%, #A8CDD1 20%, #3E7179 58%, #23474D 100%)',
      boxShadow: 'inset -3px -5px 9px rgba(35,71,77,.33), 0 2px 6px rgba(38,40,37,.25)' }}>
      {String(o?.nombre || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

function Boton({ g, abierto, onPulsar }: { g: Grupo, abierto: boolean, onPulsar: () => void }) {
  const ancla = useRef<HTMLSpanElement>(null)
  return (
    <>
      <span ref={ancla} onClick={onPulsar} title={g.label}
        style={{ width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
          background: abierto ? g.color : 'var(--w)', color: abierto ? '#fff' : g.color,
          border: '2px solid ' + g.color, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 9, fontWeight: 600, position: 'relative' }}>
        <Ic name={g.icon} size={17}/>
        <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17,
          borderRadius: '50%', background: g.color, color: '#fff', fontSize: 10, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          border: '2px solid var(--w)' }}>{g.items.length}</span>
      </span>
      <Flotante abierto={abierto} ancla={ancla} onCerrar={onPulsar} ancho={272}>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', textTransform: 'uppercase',
          letterSpacing: .4, marginBottom: 6 }}>{g.label}</div>
        {g.items.map((it: any, i: number) => (
          <div key={i} style={{ fontSize: 12, color: 'var(--n)', padding: '4px 0', lineHeight: 1.45 }}>
            · {it.nombre || it.titulo || it.texto || it.descripcion || '—'}
            {it.zona && <span style={{ color: 'var(--grl)' }}> · {it.zona}</span>}
          </div>
        ))}
      </Flotante>
    </>
  )
}

export default function IconosContexto({ ctx = {}, sesionId }: any) {
  const [abierto, setAbierto] = useState('')
  const [verObjs, setVerObjs] = useState(false)
  const anclaObjs = useRef<HTMLSpanElement>(null)
  /* Los objetivos se leen AQUI y no se reciben hechos: venian de una cache por
     sesion que se quedaba con el valor de antes de tocar la sesion, y entonces
     no salia nada sin saber por que. */
  const [objetivos, setObjetivos] = useState<any[]>([])

  useEffect(() => {
    let vivo = true
    if (!sesionId) { setObjetivos([]); return }
    ;(async () => {
      const { data: rel } = await supabase.from('sesiones_objetivos')
        .select('objetivo_id').eq('sesion_id', sesionId)
      const ids = (rel || []).map((r: any) => r.objetivo_id).filter(Boolean)
      if (ids.length === 0) { if (vivo) setObjetivos([]); return }
      const { data } = await supabase.from('objetivos').select('id,nombre,imagen_url').in('id', ids)
      if (vivo) setObjetivos(data || [])
    })()
    return () => { vivo = false }
  }, [sesionId])

  const grupos: Grupo[] = [
    { k: 'patologias', icon: 'patologia', label: 'Patologías', items: ctx.patologias || [], color: 'var(--red)' },
    { k: 'molestias', icon: 'molestia', label: 'Molestias', items: ctx.molestias || [], color: 'var(--amb)' },
    { k: 'alertas', icon: 'alerta', label: 'Alertas', items: ctx.alertas || [], color: 'var(--red)' },
  ].filter(g => g.items.length > 0)

  if (grupos.length === 0 && objetivos.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      {objetivos.length > 0 && (
        <span ref={anclaObjs} onClick={() => setVerObjs(v => v === false)}
          title="Objetivos de la sesión"
          style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          {objetivos.slice(0, 3).map((o: any, i: number) => (
            <span key={o.id || i} style={{ marginLeft: i === 0 ? 0 : -11 }}><Bola o={o}/></span>
          ))}
          {objetivos.length > 3 && (
            <span style={{ marginLeft: 5, fontSize: 11, color: 'var(--gr)' }}>+{objetivos.length - 3}</span>
          )}
        </span>
      )}
      <Flotante abierto={verObjs} ancla={anclaObjs} onCerrar={() => setVerObjs(false)} ancho={272}>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--grl)', textTransform: 'uppercase',
          letterSpacing: .4, marginBottom: 7 }}>Objetivos de la sesión</div>
        {objetivos.map((o: any, i: number) => (
          <div key={o.id || i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0' }}>
            <Bola o={o} tam={26}/>
            <span style={{ fontSize: 12.5 }}>{o.nombre}</span>
          </div>
        ))}
      </Flotante>

      {grupos.map(g => (
        <Boton key={g.k} g={g} abierto={abierto === g.k}
          onPulsar={() => setAbierto(a => a === g.k ? '' : g.k)}/>
      ))}
    </div>
  )
}
