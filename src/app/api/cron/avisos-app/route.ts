import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// AVISOS DE LA APP DE CLIENTES. Tarea automática de cada día a las 12:00 (vercel.json):
// la víspera de cada cita, el bono que se acaba y, los miércoles, el sobre de cromos.
// Qué mandar lo decide la base (app_avisos_hoy, sql/app-9-avisos.sql); aquí solo se
// envía y se apunta para no repetirlo.
//
// Variables en Vercel: VAPID_PUBLIC_KEY y NEXT_PUBLIC_VAPID_PUBLIC_KEY (la misma, la
// pública), VAPID_PRIVATE_KEY (la privada), y las de siempre (CRON_SECRET, Supabase).

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, servicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!url || !servicio || !pub || !priv) return NextResponse.json({ error: 'Faltan variables (Supabase o VAPID).' }, { status: 500 })
  webpush.setVapidDetails('mailto:info@esieiro.es', pub, priv)
  const adm = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data, error } = await adm.rpc('app_avisos_hoy')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let enviados = 0, fallidos = 0
  for (const a of (data || []) as any[]) {
    let alguno = false
    for (const sub of (a.suscripciones || [])) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, url: a.url }))
        alguno = true
      } catch (e: any) {
        // 404/410: ese móvil ya no existe o quitó los avisos. Fuera.
        if (e?.statusCode === 404 || e?.statusCode === 410) await adm.from('app_push').delete().eq('endpoint', sub.endpoint)
        else fallidos++
      }
    }
    if (alguno) { enviados++; await adm.from('app_avisos_enviados').insert({ paciente_id: a.paciente_id, clave: a.clave }) }
  }
  return NextResponse.json({ ok: true, enviados, fallidos })
}
