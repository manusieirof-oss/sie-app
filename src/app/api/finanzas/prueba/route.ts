import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PLANES_PRUEBA, BONOS_TIPOS_PRUEBA, GASTOS_PRUEBA, BONOS_PRUEBA } from './datos'

// Datos del banco de pruebas de Finanzas.
//
// Vive en el servidor A PROPÓSITO. Son las facturas reales de 2026 escritas a
// mano en un fichero, así que no las protege RLS como al resto de la app: si el
// fichero se importara desde la pantalla, Next lo metería en el JavaScript que
// se descarga el navegador y cualquiera con la URL del chunk tendría la cuenta
// de resultados. Aquí no sale de aquí sin comprobar antes quién pregunta.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ error: 'Falta la configuración de Supabase en el servidor.' }, { status: 500 })
  }

  // El token lo manda la pantalla; es el de la sesión que ya tiene el navegador.
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: errUser } = await supabase.auth.getUser(token)
  if (errUser || !user?.id) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  // Mismo criterio que /finanzas. Si un día cambia allí, tiene que cambiar aquí:
  // son los dos únicos sitios que deciden quién ve dinero.
  const { data: perfil, error: errPerfil } = await supabase
    .from('perfiles').select('rol,permisos').eq('user_id', user.id).maybeSingle()

  // Un fallo leyendo el perfil no es un "no tienes permiso": es que no se sabe.
  // Decirlo, en vez de devolver un 403 que mandaría a buscar el problema donde no está.
  if (errPerfil) {
    return NextResponse.json({ error: `No se ha podido comprobar el permiso: ${errPerfil.message}` }, { status: 500 })
  }

  const autorizado = perfil?.rol === 'admin' || (perfil?.permisos as any)?.finanzas === true
  if (!autorizado) {
    return NextResponse.json({ error: 'Sin permiso para ver finanzas.' }, { status: 403 })
  }

  return NextResponse.json(
    { planes: PLANES_PRUEBA, bonosTipos: BONOS_TIPOS_PRUEBA, gastos: GASTOS_PRUEBA, bonos: BONOS_PRUEBA },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
