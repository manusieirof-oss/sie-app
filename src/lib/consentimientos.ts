import { supabase } from './supabase'
import { VERSION_TEXTOS, TEXTO_DATOS, TEXTO_IMAGENES, TEXTO_CLINICA } from './textosLegales'
import { hoyISO } from '@/lib/fechas'

// Registro de consentimientos. Antes se firmaba en pantalla y no se guardaba
// nada: el RGPD (art. 7.1) obliga a PODER DEMOSTRAR que se obtuvo, así que un
// consentimiento sin registro es un consentimiento inexistente.
//
// La firma va al bucket privado 'documentos', el mismo de los informes.

const BUCKET = 'documentos'

export type TipoConsentimiento = 'datos' | 'imagenes' | 'clinica'

export const CONSENTIMIENTOS: { tipo: TipoConsentimiento, titulo: string, texto: string }[] = [
  { tipo: 'datos',    titulo: 'Protección de datos',                texto: TEXTO_DATOS },
  { tipo: 'imagenes', titulo: 'Tratamiento de imágenes',            texto: TEXTO_IMAGENES },
  { tipo: 'clinica',  titulo: 'Datos de salud y documentación clínica', texto: TEXTO_CLINICA },
]

export const tituloConsentimiento = (t: string) =>
  CONSENTIMIENTOS.find(c => c.tipo === t)?.titulo || t

export type Consentimiento = {
  id: string
  paciente_id: string
  tipo: TipoConsentimiento
  aceptado: boolean
  fecha: string
  version_texto: string
  firma_ruta: string | null
  // Copia literal de lo firmado. El texto vive en textosLegales.ts, que cambia;
  // guardarlo aquí es lo que permite reproducir el documento años después sin
  // depender del código ni del historial de Git.
  texto: string | null
  paciente_nombre: string | null
  paciente_dni: string | null
}

function dataUrlABlob(dataUrl: string): Blob | null {
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/)
  if (!m) return null
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: m[1] })
}

/**
 * Guarda los consentimientos de una valoración. La firma se sube una sola vez
 * y se referencia desde cada tipo aceptado.
 */
export async function guardarConsentimientos(pacienteId: string, opciones: {
  aceptados: TipoConsentimiento[]
  firmaDataUrl?: string | null
  // Se congelan tal como están al firmar: si luego corrige el DNI, el
  // documento firmado no debe cambiar retroactivamente.
  nombre?: string
  dni?: string
}) {
  let firmaRuta: string | null = null

  if (opciones.firmaDataUrl) {
    const blob = dataUrlABlob(opciones.firmaDataUrl)
    if (blob) {
      const ruta = `${pacienteId}/consentimientos/firma_${Date.now()}.png`
      const { error } = await supabase.storage.from(BUCKET)
        .upload(ruta, blob, { contentType: 'image/png', upsert: false })
      if (error) return { ok: false as const, error: error.message }
      firmaRuta = ruta
    }
  }

  // Se registran TODOS los tipos, aceptados y no aceptados. Que alguien no
  // consienta las imágenes también es un dato que hay que poder demostrar.
  const filas = CONSENTIMIENTOS.map(c => ({
    paciente_id: pacienteId,
    tipo: c.tipo,
    aceptado: opciones.aceptados.includes(c.tipo),
    version_texto: VERSION_TEXTOS,
    firma_ruta: firmaRuta,
    texto: c.texto,
    paciente_nombre: opciones.nombre || null,
    paciente_dni: opciones.dni || null,
  }))

  const { error } = await supabase.from('consentimientos').insert(filas)
  if (error) return { ok: false as const, error: error.message }

  await supabase.from('eventos_paciente').insert({
    paciente_id: pacienteId,
    tipo: 'consentimiento',
    titulo: `Consentimientos firmados (${opciones.aceptados.length} de ${CONSENTIMIENTOS.length})`,
    descripcion: CONSENTIMIENTOS
      .map(c => `${c.titulo}: ${opciones.aceptados.includes(c.tipo) ? 'acepta' : 'NO acepta'}`)
      .join(' · '),
    fecha: hoyISO(),
  })
  return { ok: true as const }
}

// Último estado de cada tipo. Si se vuelve a firmar, manda el más reciente.
export async function consentimientosVigentes(pacienteId: string) {
  const { data, error } = await supabase.from('consentimientos')
    .select('*').eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
  if (error) return { ok: false as const, error: error.message, consentimientos: [] as Consentimiento[] }

  const vistos = new Set<string>()
  const vigentes = (data || []).filter((c: any) => {
    if (vistos.has(c.tipo)) return false
    vistos.add(c.tipo); return true
  })
  return { ok: true as const, consentimientos: vigentes as Consentimiento[] }
}

export async function urlFirma(ruta: string, segundos = 300) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, segundos)
  if (error || !data) return null
  return data.signedUrl
}

const esc = (t: string) => (t || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Reconstruye el documento firmado y lo abre para verlo o imprimirlo.
 * Se arma con lo guardado en la fila (texto, nombre, DNI, fecha), no con el
 * textosLegales.ts actual: si los textos cambian, este documento no cambia.
 */
export async function abrirDocumentoFirmado(c: Consentimiento) {
  if (!c.texto) return { ok: false as const, error: 'Este consentimiento se registró antes de guardar el texto, así que no se puede reconstruir.' }

  const firma = c.firma_ruta ? await urlFirma(c.firma_ruta, 120) : null
  const fecha = new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<html><head><meta charset="utf-8"><title>${esc(tituloConsentimiento(c.tipo))}</title><style>
    body{font-family:-apple-system,system-ui,Arial,sans-serif;color:#262825;max-width:720px;margin:0 auto;padding:36px 30px;line-height:1.6}
    h1{font-size:17px;font-weight:500;margin:0 0 4px}
    .meta{font-size:12px;color:#6B6D6A;border-bottom:1px solid #E0DACE;padding-bottom:14px;margin-bottom:22px}
    .texto{font-size:13px;white-space:pre-line;margin-bottom:26px}
    .estado{display:inline-block;font-size:13px;font-weight:500;padding:5px 14px;border-radius:99px;margin-bottom:22px;
      background:${c.aceptado ? '#EBF4F5' : '#FDF4F4'};color:${c.aceptado ? '#3E7179' : '#B05A5A'}}
    .firma{border-top:1px solid #E0DACE;padding-top:16px;display:flex;gap:30px;align-items:flex-end}
    .firma img{max-width:230px;max-height:100px;display:block}
    .lbl{font-size:12px;color:#6B6D6A;margin-bottom:5px}
    .pie{margin-top:30px;font-size:11px;color:#8A8C88;border-top:1px solid #eee;padding-top:10px}
    @media print{body{padding:16px}}
  </style></head><body>
    <h1>${esc(tituloConsentimiento(c.tipo))}</h1>
    <div class="meta">
      ${esc(c.paciente_nombre || 'Paciente')}${c.paciente_dni ? ' · DNI ' + esc(c.paciente_dni) : ''}
      &nbsp;·&nbsp; Firmado el ${fecha} &nbsp;·&nbsp; Versión del texto ${esc(c.version_texto)}
    </div>
    <div class="estado">${c.aceptado ? 'ACEPTADO' : 'NO ACEPTADO'}</div>
    <div class="texto">${esc(c.texto)}</div>
    <div class="firma">
      <div>
        <div class="lbl">Firma</div>
        ${firma ? `<img src="${firma}" alt="Firma">` : '<div style="font-size:12px;color:#8A8C88">Sin firma registrada</div>'}
      </div>
      <div>
        <div class="lbl">Fecha</div>
        <div style="font-size:13px">${fecha}</div>
      </div>
    </div>
    <div class="pie">SIE · Documento reconstruido a partir del registro de consentimientos. El texto mostrado es el que se firmó, no el vigente hoy.</div>
  </body></html>`

  const v = window.open('', '_blank')
  if (!v) return { ok: false as const, error: 'El navegador bloqueó la ventana. Permite las ventanas emergentes.' }
  v.document.write(html)
  v.document.close()
  return { ok: true as const }
}
