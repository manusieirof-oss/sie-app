'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// EL AVATAR: la célula SIE en 3D (public/app-avatar/celula.html), dentro de la app. Se le
// pasa su asistencia del último mes (su ánimo) y, si tiene clase en unas horas, la hora
// para que salgan el ángel y el demonio. Datos: app_avatar() (sql/app-11-avatar.sql).
export default function Avatar({ grande = false }: { grande?: boolean }) {
  const [src, setSrc] = useState('')
  const [pct, setPct] = useState<number | null>(null)
  useEffect(() => {
    supabase.rpc('app_avatar').then(({ data }) => {
      if (!data) return
      setPct(data.pct)
      // El ángel y el demonio solo en grande, y una vez por cita (no cada vez que la abre).
      let cita = grande ? (data.cita || '') : ''
      try { const k = 'capp_dilema_' + new Date().toDateString() + cita; if (cita && localStorage.getItem(k)) cita = ''; else if (cita) localStorage.setItem(k, '1') } catch {}
      setSrc(`/app-avatar/celula.html?modo=app&pct=${data.pct}${grande ? '' : '&mini=1'}${cita ? `&cita=${encodeURIComponent(cita)}` : ''}`)
    })
  }, [grande])
  if (!src) return null
  const animo = pct == null ? '' : pct >= 70 ? '¡En forma! Sigue así.' : pct >= 40 ? 'Ni fu ni fa: ven un poco más a clase.' : 'Se ha ido al sofá… ¡vuelve a clase!'
  if (grande) return (
    <section className="capp-avatar grande" aria-label="Tu célula">
      <iframe src={src} title="Tu célula SIE"/>
      <p><b>{pct}%</b> de asistencia este mes. {animo}</p>
    </section>
  )
  // En el inicio, pequeña y al final: se toca para verla en grande.
  return (
    <a href="/app/celula" className="capp-avatar-mini" aria-label="Ver tu célula">
      <iframe src={src} title="Tu célula SIE" loading="lazy" tabIndex={-1}/>
      <span><b>Tu célula</b>{pct}% de asistencia este mes. {animo}<em>Ver en grande</em></span>
    </a>
  )
}
