import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// El cliente se crea DENTRO del handler, no al cargar el módulo. Con la clave de
// servicio fuera (que es lo normal en local: .env.local solo tiene la anónima),
// crearlo arriba rompía `next build` al recopilar los datos de página. El build
// pasaba en Vercel, donde la variable sí existe, así que el error solo aparecía
// en el portátil y parecía cosa del último cambio.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.' }, { status: 500 })
  }
  const supabase = createClient(url, clave)

  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('citas')
    .update({ estado: 'realizada' })
    .eq('estado', 'programada')
    .lt('fecha', hoy)

  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ ok: true, fecha: hoy })
}
