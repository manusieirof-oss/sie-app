'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// EL AVATAR: la célula SIE en 3D (public/app-avatar/celula.html), dentro de la app. Se le
// pasa su asistencia del último mes (su ánimo) y, si tiene clase en unas horas, la hora
// para que salgan el ángel y el demonio. Datos: app_avatar() (sql/app-11-avatar.sql).
export default function Avatar() {
  const [src, setSrc] = useState('')
  const [pct, setPct] = useState<number | null>(null)
  useEffect(() => {
    supabase.rpc('app_avatar').then(({ data }) => {
      if (!data) return
      setPct(data.pct)
      // El ángel y el demonio, una vez por cita (no cada vez que abre la app).
      let cita = data.cita || ''
      try { const k = 'capp_dilema_' + new Date().toDateString() + cita; if (cita && localStorage.getItem(k)) cita = ''; else if (cita) localStorage.setItem(k, '1') } catch {}
      setSrc(`/app-avatar/celula.html?modo=app&pct=${data.pct}${cita ? `&cita=${encodeURIComponent(cita)}` : ''}`)
    })
  }, [])
  if (!src) return null
  const animo = pct == null ? '' : pct >= 70 ? '¡En forma! Sigue así.' : pct >= 40 ? 'Ni fu ni fa: ven un poco más a clase.' : 'Se ha ido al sofá… ¡vuelve a clase!'
  return (
    <section className="capp-avatar" aria-label="Tu célula">
      <iframe src={src} title="Tu célula SIE" loading="lazy"/>
      <p><b>{pct}%</b> de asistencia este mes. {animo}</p>
    </section>
  )
}
