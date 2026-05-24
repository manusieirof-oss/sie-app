import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('citas')
    .update({ estado: 'realizada' })
    .eq('estado', 'programada')
    .lt('fecha', hoy)

  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ ok: true, fecha: hoy })
}
