'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// EL AVATAR: la célula SIE en 3D (public/app-avatar/celula.html), dentro de la app. Se le
// pasa su asistencia del último mes (su ánimo) y, en grande, sus medallas, sus objetivos y
// su ropa. Lo que no ha visto aún (una medalla nueva, un objetivo logrado) sale con su
// ceremonia la primera vez que la abre en grande; se recuerda en este móvil. Si tiene
// clase en unas horas, el ángel y el demonio. Datos: app_avatar() (sql/app-12-…).

const leer = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const guardar = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export default function Avatar({ grande = false }: { grande?: boolean }) {
  const [src, setSrc] = useState('')
  const [datos, setDatos] = useState<any>(null)
  const marco = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    supabase.rpc('app_avatar').then(({ data }) => {
      if (!data) return
      setDatos(data)
      // El ángel y el demonio solo en grande, y una vez por cita (no cada vez que la abre).
      let cita = grande ? (data.cita || '') : ''
      try { const k = 'capp_dilema_' + new Date().toDateString() + cita; if (cita && localStorage.getItem(k)) cita = ''; else if (cita) localStorage.setItem(k, '1') } catch {}
      setSrc(`/app-avatar/celula.html?modo=app&pct=${data.pct}${grande ? '&panel=1' : '&mini=1'}${cita ? `&cita=${encodeURIComponent(cita)}` : ''}`)
    })
  }, [grande])

  // La célula avisa cuando está lista: entonces se le mandan sus cosas. Y guarda la ropa.
  useEffect(() => {
    if (!datos) return
    const oir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== marco.current?.contentWindow) return
      if (e.data?.tipo === 'sie-ropa') guardar('capp_ropa', e.data.equipo)
      if (e.data?.tipo !== 'sie-listo') return
      const vistasMed: string[] = leer('capp_med_vistas') || [], vistosObj: string[] = leer('capp_obj_vistos') || []
      const meds: string[] = datos.medallas || [], logrados = (datos.objetivos || []).filter((o: any) => o.hecho).map((o: any) => o.nombre)
      marco.current?.contentWindow?.postMessage({
        tipo: 'sie-datos', medallas: meds, objetivos: datos.objetivos || [], ropa: leer('capp_ropa'),
        // Lo nuevo solo se celebra en grande; en la pequeña todo sale ya puesto.
        nuevasMed: grande ? meds.filter(m => !vistasMed.includes(m)) : [],
        nuevosObj: grande ? logrados.filter((n: string) => !vistosObj.includes(n)) : [],
      }, location.origin)
      if (grande) { guardar('capp_med_vistas', meds); guardar('capp_obj_vistos', logrados) }
    }
    window.addEventListener('message', oir)
    return () => window.removeEventListener('message', oir)
  }, [datos, grande])

  if (!src) return null
  const pct = datos?.pct
  const animo = pct == null ? '' : pct >= 70 ? '¡En forma! Sigue así.' : pct >= 40 ? 'Ni fu ni fa: ven un poco más a clase.' : 'Se ha ido al sofá… ¡vuelve a clase!'
  const novedades = (datos?.medallas || []).filter((m: string) => !(leer('capp_med_vistas') || []).includes(m)).length
    + (datos?.objetivos || []).filter((o: any) => o.hecho && !(leer('capp_obj_vistos') || []).includes(o.nombre)).length
  if (grande) return (
    <section className="capp-avatar grande" aria-label="Tu célula">
      <iframe ref={marco} src={src} title="Tu célula SIE"/>
      <p><b>{pct}%</b> de asistencia este mes. {animo}</p>
    </section>
  )
  // En el inicio, pequeña y al final: se toca para verla en grande.
  return (
    <a href="/app/celula" className="capp-avatar-mini" aria-label="Ver tu célula">
      <iframe ref={marco} src={src} title="Tu célula SIE" loading="lazy" tabIndex={-1}/>
      <span><b>Tu célula</b>{pct}% de asistencia este mes. {animo}
        <em>{novedades ? `¡Tiene ${novedades} ${novedades === 1 ? 'novedad' : 'novedades'}! Ábrela` : 'Ver en grande'}</em></span>
    </a>
  )
}
