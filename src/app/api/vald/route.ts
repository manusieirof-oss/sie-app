import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// PUENTE CON VALD (DynaMo).
//
// Vive en el servidor A PROPÓSITO: el clientId/clientSecret de VALD dan acceso a
// TODOS los datos de la clínica en VALD Hub. Si llegaran al navegador cualquiera
// con la URL del chunk los tendría. Aquí solo se usan tras comprobar la sesión, y lo
// que se escribe en Supabase va con el token del usuario, así que RLS sigue mandando.
//
// Variables en Vercel (Settings → Environment Variables):
//   VALD_CLIENT_ID, VALD_CLIENT_SECRET   → las del correo de bienvenida de VALD
//   VALD_REGION                           → 'euw' (Europa), 'use' o 'aue'. Por defecto euw.
//   VALD_TENANT_ID (opcional)             → si no está, se usa el primero de la cuenta.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TOKEN_URL = 'https://auth.prd.vald.com/oauth/token'
const region = () => (process.env.VALD_REGION || 'euw').trim()
const base = (srv: string) => `https://prd-${region()}-api-${srv}.valdperformance.com`

// El token dura horas y pedirlo tiene límite: se guarda en memoria mientras la
// función siga viva. Si Vercel la recicla, se pide otro y ya está.
let tokenCache: { t: string, hasta: number } | null = null
async function token(): Promise<string> {
  if (tokenCache && tokenCache.hasta > Date.now() + 60_000) return tokenCache.t
  const id = process.env.VALD_CLIENT_ID, secreto = process.env.VALD_CLIENT_SECRET
  if (!id || !secreto) throw new Error('Faltan VALD_CLIENT_ID y VALD_CLIENT_SECRET en Vercel.')
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secreto, audience: 'vald-api-external' }),
  })
  if (!r.ok) throw new Error(`VALD no acepta las credenciales (${r.status}). Revisa clientId/clientSecret.`)
  const j = await r.json()
  tokenCache = { t: j.access_token, hasta: Date.now() + (Number(j.expires_in) || 3600) * 1000 }
  return tokenCache.t
}

async function vald(url: string, init: RequestInit = {}): Promise<{ status: number, json: any }> {
  const t = await token()
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } })
  if (r.status === 204) return { status: 204, json: null }
  const texto = await r.text()
  if (!r.ok) throw new Error(`VALD respondió ${r.status} en ${new URL(url).pathname}${texto ? ': ' + texto.slice(0, 200) : ''}`)
  try { return { status: r.status, json: texto ? JSON.parse(texto) : null } } catch { return { status: r.status, json: null } }
}

let tenantCache: string | null = null
async function tenant(): Promise<string> {
  if (process.env.VALD_TENANT_ID) return process.env.VALD_TENANT_ID.trim()
  if (tenantCache) return tenantCache
  const { json } = await vald(`${base('externaltenants')}/tenants`)
  const lista = Array.isArray(json) ? json : json?.tenants || []
  const id = lista[0]?.id || lista[0]?.tenantId
  if (!id) throw new Error('La cuenta de VALD no tiene ninguna organización (tenant).')
  tenantCache = id
  return id
}

async function perfiles(tid: string, filtro: Record<string, string> = {}) {
  const q = new URLSearchParams({ tenantId: tid, ...filtro })
  const { json } = await vald(`${base('externalprofile')}/profiles?${q}`)
  return ((json?.profiles || (Array.isArray(json) ? json : [])) as any[]).map(p => ({
    profileId: p.profileId, syncId: p.syncId || null, externalId: p.externalId || null,
    givenName: p.givenName || '', familyName: p.familyName || '', dateOfBirth: (p.dateOfBirth || '').slice(0, 10) || null,
  }))
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return NextResponse.json({ error: 'Falta la configuración de Supabase en el servidor.' }, { status: 500 })
  const auth = req.headers.get('authorization') || ''
  const tk = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!tk) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 })
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${tk}` } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await sb.auth.getUser(tk)
  if (!user?.id) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })

  let cuerpo: any = {}
  try { cuerpo = await req.json() } catch { /* sin cuerpo */ }

  try {
    const tid = await tenant()

    // ---- PERFILES: la lista de VALD, para emparejar en la ficha ----
    if (cuerpo.accion === 'perfiles') return NextResponse.json({ perfiles: await perfiles(tid) })

    // ---- CREAR: da de alta (o actualiza) al paciente en VALD desde SIE ----
    // El syncId es el id del paciente en SIE: si se vuelve a pulsar, VALD actualiza el
    // mismo perfil en vez de duplicarlo, y si ya existía con su email o nombre+fecha,
    // lo reconoce y lo enlaza (así lo describe VALD).
    if (cuerpo.accion === 'crear') {
      const { data: p, error } = await sb.from('pacientes').select('id,nombre,apellidos,fecha_nacimiento,sexo,email,vald_profile_id').eq('id', cuerpo.pacienteId).maybeSingle()
      if (error || !p) return NextResponse.json({ error: 'No encuentro al paciente.' }, { status: 404 })
      if (p.vald_profile_id) return NextResponse.json({ profileId: p.vald_profile_id })
      const faltan = [!p.nombre && 'nombre', !p.apellidos && 'apellidos', !p.fecha_nacimiento && 'fecha de nacimiento', !p.sexo && 'sexo'].filter(Boolean)
      if (faltan.length) return NextResponse.json({ error: `Para crearlo en VALD falta en su ficha: ${faltan.join(', ')}.` }, { status: 400 })
      await vald(`${base('externalprofile')}/profiles/import`, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: tid, syncId: p.id, externalId: p.id,
          givenName: p.nombre, familyName: p.apellidos,
          dateOfBirth: `${p.fecha_nacimiento}T00:00:00.000Z`,
          email: p.email || undefined,
          sex: p.sexo === 'mujer' ? 'Female' : 'Male',
          isCreatedByUserOver18YearsOld: true,
        }),
      })
      // La importación no siempre devuelve el id: se busca por el syncId.
      const [nuevo] = await perfiles(tid, { syncId: p.id })
      if (!nuevo?.profileId) return NextResponse.json({ error: 'VALD lo ha recibido pero aún no aparece. Prueba en un minuto.' }, { status: 202 })
      await sb.from('pacientes').update({ vald_profile_id: nuevo.profileId }).eq('id', p.id)
      return NextResponse.json({ profileId: nuevo.profileId })
    }

    // ---- SINCRONIZAR: trae los tests de DynaMo nuevos o cambiados ----
    // Es de toda la clínica, no de un paciente: se guarda por perfil de VALD y cada
    // ficha enseña los suyos. Se sigue desde la fecha de modificación de la última
    // vez, así que solo baja lo nuevo.
    if (cuerpo.accion === 'sincronizar') {
      const { data: aj } = await sb.from('ajustes').select('valor').eq('clave', 'vald_modificado_desde').maybeSingle()
      let desde = aj?.valor || '2015-01-01T00:00:00Z'
      const t0 = Date.now()
      let traidos = 0, quedan = false
      for (let pagina = 0; ; pagina++) {
        // Vercel corta a los 60 s: se para antes y la pantalla vuelve a llamar.
        if (Date.now() - t0 > 40_000) { quedan = true; break }
        const q = new URLSearchParams({ TenantId: tid, ModifiedFromUtc: desde })
        const { status, json } = await vald(`${base('extdynamo')}/v1/test/tests-by-modified-date?${q}`)
        const tests: any[] = status === 204 ? [] : json?.tests || []
        if (!tests.length) break
        const filas = tests.map(t => ({
          id: t.id, profile_id: t.athleteId || t.profileId || null,
          fecha: t.startTimeUTC || null, categoria: t.testCategory || null,
          region: t.bodyRegion || null, movimiento: t.movement || null,
          posicion: t.customPosition || t.position || null, lateralidad: t.laterality || null,
          resumen: t.repetitionTypeSummaries || [], asimetrias: t.asymmetries || [], ratios: t.ratios || [],
          modificado: t.modifiedDateUtc || null,
          // Sin las repeticiones una a una ni las curvas: pesan mucho y no se enseñan.
          datos: { ...t, repetitions: undefined },
          traido: new Date().toISOString(),
        })).filter(f => f.id)
        const { error } = await sb.from('vald_tests').upsert(filas, { onConflict: 'id' })
        if (error) throw new Error('No se han podido guardar los tests: ' + error.message)
        traidos += filas.length
        const ultimo = tests[tests.length - 1]?.modifiedDateUtc
        // Si la fecha no avanza, VALD ya no tiene nada más nuevo: parar, no dar vueltas.
        if (!ultimo || ultimo === desde) break
        desde = ultimo
        await sb.from('ajustes').upsert({ clave: 'vald_modificado_desde', valor: desde }, { onConflict: 'clave' })
        if (pagina > 200) break
      }
      await sb.from('ajustes').upsert({ clave: 'vald_ultima_sync', valor: new Date().toISOString() }, { onConflict: 'clave' })
      return NextResponse.json({ traidos, quedan })
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error con VALD.' }, { status: 502 })
  }
}
