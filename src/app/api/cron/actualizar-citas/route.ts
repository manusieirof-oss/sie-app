import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { hoyISO } from '@/lib/fechas'

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

  const hoy = hoyISO()

  const { data, error } = await supabase
    .from('citas')
    .update({ estado: 'realizada' })
    .eq('estado', 'programada')
    .lt('fecha', hoy)

  if (error) return NextResponse.json({ error }, { status: 500 })

  // Devolver a activo a quien ya ha vuelto de su pausa. La ficha promete que
  // "se reactivará automáticamente al volver" y hasta ahora no lo hacía nadie:
  // el paciente se quedaba en pausa para siempre.
  const { data: reactivados, error: errPausa } = await supabase.rpc('reactivar_pausas')
  if (errPausa) {
    // El paso de las citas ya ha ido bien; se informa del fallo sin fingir que
    // todo salió, porque quien no vuelve de la pausa no aparece en la agenda.
    return NextResponse.json({ ok: true, fecha: hoy, reactivados: null, error_pausas: errPausa.message }, { status: 207 })
  }

  // Bajas y "puede volver" que llegan a su fecha. Ver sql/estados_programados.sql:
  // se apuntan por adelantado y se aplican aquí, para que quien avisa el día 10
  // de que lo deja a fin de mes siga dando sus clases hasta fin de mes.
  const { data: aplicados, error: errEstados } = await supabase.rpc('aplicar_estados_programados')
  if (errEstados) {
    return NextResponse.json({ ok: true, fecha: hoy, reactivados, aplicados: null, error_estados: errEstados.message }, { status: 207 })
  }
  // Los que ya estaban en ese estado por otro camino: se les quita la marca
  // para que no se queden en la lista de previstas eternamente.
  await supabase.rpc('limpiar_estados_programados_cumplidos')

  return NextResponse.json({ ok: true, fecha: hoy, reactivados, aplicados: aplicados ?? [] })
}
