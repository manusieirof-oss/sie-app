import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// APP DE CLIENTES: EL ENLACE PARA ENTRAR.
//
// Dirección o encargado pulsa «App» en la ficha y sale un enlace para mandar por
// WhatsApp. Al abrirlo, el cliente entra en su app sin contraseña y se queda dentro.
//
// - La primera vez se le crea un usuario con un correo inventado (c-<ficha>@clientes.sie):
//   así no choca con el correo de nadie del equipo ni hace falta que tenga correo.
// - El enlace sirve un rato (lo que diga Supabase, normalmente 1 hora). Si caduca, se
//   genera otro desde la ficha. Una vez dentro, la sesión dura.
// - Se construye el enlace con el token y lo comprueba la propia app (/app/entrar), así
//   no hace falta tocar las direcciones permitidas de Supabase.
//
// Pide SUPABASE_SERVICE_ROLE_KEY en Vercel (la misma que el alta del equipo).

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !servicio) return NextResponse.json({ error: 'Falta la configuración de Supabase en el servidor.' }, { status: 500 })

  // ¿Quién lo pide? Con su propio token: tiene que ser dirección o encargado.
  const auth = req.headers.get('authorization') || ''
  const tk = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!tk) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${tk}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await sb.auth.getUser(tk)
  if (!user?.id) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  const { data: yo } = await sb.from('perfiles').select('rol').eq('user_id', user.id).maybeSingle()
  if (yo?.rol !== 'admin') return NextResponse.json({ error: 'Solo dirección o encargado dan acceso a la app.' }, { status: 403 })

  let cuerpo: any = {}
  try { cuerpo = await req.json() } catch { /* sin cuerpo */ }
  const pacienteId = String(cuerpo.paciente_id || '')
  const adm = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } })

  try {
    const { data: pac } = await adm.from('pacientes').select('id,nombre,practica').eq('id', pacienteId).maybeSingle()
    if (!pac) return NextResponse.json({ error: 'No encuentro esa ficha.' }, { status: 404 })
    if (pac.practica) return NextResponse.json({ error: 'Es un paciente de práctica.' }, { status: 400 })

    // ---- QUITAR el acceso: se borra su usuario (la ficha no se toca) ----
    if (cuerpo.accion === 'quitar') {
      const { data: ya } = await adm.from('clientes_app').select('user_id').eq('paciente_id', pacienteId).maybeSingle()
      if (ya?.user_id) await adm.auth.admin.deleteUser(ya.user_id)
      return NextResponse.json({ ok: true })
    }

    // ---- ENLACE: crea el usuario si no lo tiene y genera uno nuevo ----
    const email = `c-${pac.id}@clientes.sie`
    const { data: ya } = await adm.from('clientes_app').select('user_id').eq('paciente_id', pacienteId).maybeSingle()
    if (!ya) {
      const { data: nuevo, error } = await adm.auth.admin.createUser({ email, email_confirm: true, user_metadata: { cliente: true } })
      if (error) throw error
      const { error: e2 } = await adm.from('clientes_app').insert({ user_id: nuevo.user.id, paciente_id: pac.id })
      if (e2) { await adm.auth.admin.deleteUser(nuevo.user.id); throw e2 }
    }
    const { data: link, error } = await adm.auth.admin.generateLink({ type: 'magiclink', email })
    if (error) throw error
    const origen = req.headers.get('origin') || new URL(req.url).origin
    return NextResponse.json({ enlace: `${origen}/app/entrar?t=${encodeURIComponent(link.properties.hashed_token)}`, nombre: pac.nombre })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'No se ha podido.' }, { status: 500 })
  }
}
