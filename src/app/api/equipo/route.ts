import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// EL EQUIPO: dar de alta trabajadores desde la propia app.
//
// Crear usuarios de Supabase pide la clave de servicio, que se salta RLS y puede con
// todo. Por eso vive aquí, en el servidor, y solo se usa después de comprobar que
// quien llama es dirección (perfiles.rol = 'admin'). Así el día de mañana el dueño de
// otra clínica añade a su gente sin entrar nunca en Supabase.
//
// No se manda invitación por correo: el correo de Supabase de serie solo llega a los
// miembros del proyecto, así que a un trabajador nuevo no le llegaría. En su lugar se
// genera una contraseña provisional que dirección le pasa en mano o por WhatsApp, y
// él la cambia en «Mi cuenta».
//
// Variable en Vercel: SUPABASE_SERVICE_ROLE_KEY (la misma que usa el cron).

export const dynamic = 'force-dynamic'

// Sin caracteres que se confunden al dictarla (0/O, 1/l/I) y con los cuatro tipos que
// pide «Mi cuenta», para que se pueda quedar con ella si quiere.
function provisional() {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ', min = 'abcdefghijkmnpqrstuvwxyz', num = '23456789', sim = '!#$%&*+?'
  const todos = may + min + num
  const r = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length]
  const trozos = [r(may), r(min), r(num), r(sim), ...Array.from({ length: 10 }, () => r(todos))]
  for (let i = trozos.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [trozos[i], trozos[j]] = [trozos[j], trozos[i]] }
  return trozos.join('')
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon) return NextResponse.json({ error: 'Falta la configuración de Supabase en el servidor.' }, { status: 500 })
  if (!servicio) return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.' }, { status: 500 })

  // ¿Quién llama? Con su propio token, y su perfil leído con RLS normal.
  const auth = req.headers.get('authorization') || ''
  const tk = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!tk) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${tk}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await sb.auth.getUser(tk)
  if (!user?.id) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
  const { data: yo } = await sb.from('perfiles').select('rol').eq('user_id', user.id).maybeSingle()
  if (yo?.rol !== 'admin') return NextResponse.json({ error: 'Solo dirección puede gestionar el equipo.' }, { status: 403 })

  const adm = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } })
  let cuerpo: any = {}
  try { cuerpo = await req.json() } catch { /* sin cuerpo */ }

  try {
    // ---- LISTA: el correo y el último acceso de cada uno (no están en perfiles) ----
    if (cuerpo.accion === 'lista') {
      const { data, error } = await adm.auth.admin.listUsers({ perPage: 200 })
      if (error) throw error
      const usuarios: Record<string, { email: string | null, ultimo: string | null }> = {}
      data.users.forEach(u => { usuarios[u.id] = { email: u.email || null, ultimo: u.last_sign_in_at || null } })
      return NextResponse.json({ usuarios })
    }

    // ---- CREAR: usuario + perfil, y la contraseña provisional para dársela ----
    if (cuerpo.accion === 'crear') {
      const email = String(cuerpo.email || '').trim().toLowerCase()
      const nombre = String(cuerpo.nombre || '').trim()
      const rol = cuerpo.rol === 'admin' ? 'admin' : 'usuario'
      // Nivel de entrenador (lib/permisos): 1 eventual, 2 entrenador, 3 encargado/a.
      const nivel = [1, 2, 3].includes(Number(cuerpo.nivel)) ? Number(cuerpo.nivel) : 1
      if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 })
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'El correo no parece válido.' }, { status: 400 })
      const password = provisional()
      // email_confirm: sin esto le pediría confirmar un correo que no le va a llegar.
      const { data, error } = await adm.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } })
      if (error) {
        const ya = /already|registered|exists/i.test(error.message)
        return NextResponse.json({ error: ya ? 'Ya hay una cuenta con ese correo.' : error.message }, { status: 400 })
      }
      const uid = data.user.id
      const permisos = rol === 'admin' ? { finanzas: true, cobros: true } : { finanzas: false, cobros: cuerpo.cobros === true }
      // Si hay un disparador que ya crea el perfil al registrarse, se completa ese;
      // si no, se crea aquí. Así funciona en las dos instalaciones.
      const { data: hay } = await adm.from('perfiles').select('id').eq('user_id', uid).maybeSingle()
      const { error: e2 } = hay
        ? await adm.from('perfiles').update({ nombre, rol, permisos, nivel }).eq('id', hay.id)
        : await adm.from('perfiles').insert({ user_id: uid, nombre, rol, permisos, nivel })
      if (e2) {
        // Sin perfil la cuenta quedaría a medias: se deshace para poder repetir.
        await adm.auth.admin.deleteUser(uid)
        throw e2
      }
      return NextResponse.json({ email, password })
    }

    // ---- NUEVA CONTRASEÑA: para quien la olvidó ----
    if (cuerpo.accion === 'reiniciar') {
      const { data: p } = await adm.from('perfiles').select('user_id').eq('id', cuerpo.perfilId).maybeSingle()
      if (!p?.user_id) return NextResponse.json({ error: 'No encuentro a esa persona.' }, { status: 404 })
      const password = provisional()
      const { error } = await adm.auth.admin.updateUserById(p.user_id, { password })
      if (error) throw error
      return NextResponse.json({ password })
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error inesperado.' }, { status: 500 })
  }
}
