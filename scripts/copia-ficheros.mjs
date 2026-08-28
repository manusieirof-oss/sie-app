/**
 * Copia de los ficheros de Storage: imágenes, fotos de pacientes y documentos.
 *
 * El volcado de la base de datos NO los incluye. Guarda las RUTAS de los ficheros, así que
 * restaurar solo la base dejaría la app con todas las imágenes rotas y los informes de los
 * pacientes inaccesibles.
 *
 * Necesita la SERVICE ROLE KEY, no la anon: dos de los tres buckets son privados y con la
 * clave pública no se pueden listar. Esa clave salta las políticas de seguridad, así que
 * se pasa por variable de entorno y no se escribe en ningún fichero.
 *
 *   SUPABASE_URL='https://xxx.supabase.co' \
 *   SUPABASE_SERVICE_KEY='...' \
 *   node scripts/copia-ficheros.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
const DESTINO = process.env.SIE_DESTINO
  || join(homedir(), 'Desktop', 'copias-sie', `ficheros-${new Date().toISOString().slice(0, 10)}`)

if (!URL || !KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY.')
  console.error('Las sacas de Supabase → Project Settings → API Keys.')
  console.error('La service_role es secreta: no la subas a ningún sitio ni la pegues en un chat.')
  process.exit(1)
}

const sb = createClient(URL, KEY)
const BUCKETS = ['fotos', 'pacientes-fotos', 'documentos']

/**
 * Storage no da un listado plano: hay que recorrer carpeta a carpeta. Se reconoce que algo
 * es carpeta porque viene sin `id`.
 */
async function listar(bucket, prefijo = '') {
  const salida = []
  const TAM = 100
  for (let desde = 0; ; desde += TAM) {
    const { data, error } = await sb.storage.from(bucket)
      .list(prefijo, { limit: TAM, offset: desde })
    if (error) throw new Error(`${bucket}/${prefijo}: ${error.message}`)
    if (!data?.length) break
    for (const it of data) {
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name
      if (it.id) salida.push(ruta)
      else salida.push(...await listar(bucket, ruta))
    }
    if (data.length < TAM) break
  }
  return salida
}

let total = 0, fallos = 0

for (const bucket of BUCKETS) {
  let rutas
  try {
    rutas = await listar(bucket)
  } catch (e) {
    // Un bucket que no existe en esta instalación no es un fallo; cualquier otra cosa sí.
    console.error(`\n${bucket}: no se ha podido leer — ${e.message}`)
    fallos++
    continue
  }

  console.log(`\n${bucket}: ${rutas.length} ficheros`)
  for (const ruta of rutas) {
    const { data, error } = await sb.storage.from(bucket).download(ruta)
    if (error) { console.error(`  falló ${ruta}: ${error.message}`); fallos++; continue }
    const destino = join(DESTINO, bucket, ruta)
    await mkdir(dirname(destino), { recursive: true })
    await writeFile(destino, Buffer.from(await data.arrayBuffer()))
    total++
    if (total % 25 === 0) process.stdout.write(`  ${total} descargados\r`)
  }
}

console.log(`\n\n${total} ficheros en ${DESTINO}`)
if (fallos > 0) {
  console.error(`${fallos} fallaron. La copia está INCOMPLETA: revísalos antes de fiarte de ella.`)
  process.exit(1)
}
console.log('Recuerda: pacientes-fotos y documentos llevan datos de salud. Guárdalo cifrado.')
