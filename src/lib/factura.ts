import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// LA FACTURA EN PAPEL
//
// Se pinta SIEMPRE desde la fila de `facturas`, nunca recomponiéndola desde el
// paciente o desde el plan. Los datos del emisor y del destinatario van
// congelados dentro de la factura desde que se emitió, así que este documento
// dice hoy lo mismo que decía entonces aunque el paciente se haya mudado o el
// precio haya subido. Mismo criterio que `abrirDocumentoFirmado` con los
// consentimientos.
//
// Lo único que NO va congelado es el logo, que se lee de Ajustes: no es un dato
// fiscal y guardar una copia de la imagen por cada factura no aporta nada.
// ---------------------------------------------------------------------------

export type FacturaCompleta = {
  factura: any
  lineas: any[]
  cobro: any
  logo: string | null
  nombreComercial: string | null
  rectificada?: { serie: string, numero: number, fecha_expedicion: string } | null
}

export async function cargarFactura(facturaId: string): Promise<{ ok: true, datos: FacturaCompleta } | { ok: false, error: string }> {
  const { data: factura, error } = await supabase.from('facturas').select('*').eq('id', facturaId).maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!factura) return { ok: false, error: 'La factura no existe.' }

  const [rl, rc, ra] = await Promise.all([
    supabase.from('cobro_lineas').select('*').eq('cobro_id', factura.cobro_id).order('orden'),
    supabase.from('cobros').select('*').eq('id', factura.cobro_id).maybeSingle(),
    supabase.from('ajustes').select('clave,valor').in('clave', ['clinica_logo', 'clinica_nombre']),
  ])
  if (rl.error) return { ok: false, error: `No se han podido leer las líneas: ${rl.error.message}` }

  let rectificada = null
  if (factura.rectifica_a) {
    const { data } = await supabase.from('facturas')
      .select('serie,numero,fecha_expedicion').eq('id', factura.rectifica_a).maybeSingle()
    rectificada = data
  }

  const aj = Object.fromEntries((ra.data || []).map((a: any) => [a.clave, a.valor]))
  return {
    ok: true,
    datos: {
      factura, lineas: rl.data || [], cobro: rc.data,
      logo: aj.clinica_logo || null,
      nombreComercial: aj.clinica_nombre || null,
      rectificada,
    },
  }
}

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c] as string))
const eur = (n: any) => `${Number(n).toFixed(2).replace('.', ',')} €`
const fecha = (f: string) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES') : ''

const LBL_PAGO: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  domiciliacion: 'Domiciliación bancaria', otro: 'Otro',
}

export function numeroFactura(f: any) {
  return `${f.serie}/${String(f.numero).padStart(4, '0')}`
}

export function htmlFactura(d: FacturaCompleta): string {
  const f = d.factura
  const esRect = f.tipo === 'rectificativa'
  const simplificada = f.tipo === 'simplificada'

  const filas = d.lineas.map((l: any) => `
    <tr>
      <td>${esc(l.concepto)}${Number(l.cantidad) !== 1 ? `<div class="sub">${esc(l.cantidad)} de mes</div>` : ''}</td>
      <td class="r">${eur(l.base)}</td>
      <td class="r">${esc(l.iva_pct)}%</td>
      <td class="r">${eur(l.cuota_iva)}</td>
      <td class="r">${eur(l.total)}</td>
    </tr>`).join('')

  /**
   * El destinatario.
   *
   * En la COMPLETA es obligatorio con nombre, NIF y domicilio. En la SIMPLIFICADA no hace
   * falta ninguno, pero se pone el nombre si se sabe: al cliente le sirve para saber que
   * es suya, y a ti para encontrarla. Poner el nombre no la convierte en completa —eso
   * exige NIF y domicilio— así que se advierte para que nadie la entregue creyendo que
   * vale para desgravar.
   */
  const destinatario = !simplificada ? `
    <div class="dest">
      <div class="lbl">Destinatario</div>
      <div class="val"><strong>${esc(f.receptor_nombre || '')}</strong><br>
        ${f.receptor_nif ? `NIF ${esc(f.receptor_nif)}<br>` : ''}
        ${esc(f.receptor_direccion || '')}</div>
    </div>` : (f.receptor_nombre ? `
    <div class="dest">
      <div class="lbl">Cliente</div>
      <div class="val"><strong>${esc(f.receptor_nombre)}</strong><br>
        <span style="color:#8A6410">Factura simplificada · sin NIF no sirve para deducir</span></div>
    </div>` : '')

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${numeroFactura(f)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  *{box-sizing:border-box}
  /* En pantalla el documento se ve como una hoja: ancho de A4 y centrado. Sin
     tope se estiraba hasta el ancho de la ventana y en un monitor grande la
     factura salía deformada, aunque al imprimir estuviera bien. */
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a18;font-size:11px;line-height:1.45;
       margin:0;background:#f0efeb;padding:28px 16px}
  .hoja{max-width:186mm;margin:0 auto;background:#fff;padding:22mm 18mm;
        box-shadow:0 2px 14px rgba(0,0,0,.10);border-radius:2px}
  @media print {
    body{background:#fff;padding:0}
    .hoja{max-width:none;margin:0;padding:0;box-shadow:none;border-radius:0}
  }
  .cab{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid ${esRect ? '#C25B5B' : '#1a1a18'};padding-bottom:14px}
  .cab img{max-height:52px;max-width:150px;object-fit:contain;display:block;margin-bottom:8px}
  .marca{font-size:16px;font-weight:600;margin-bottom:6px}
  .emisor{color:#54524c}
  .num{text-align:right;flex-shrink:0}
  .lbl{font-size:8.5px;letter-spacing:.7px;text-transform:uppercase;color:#8a8880;margin-bottom:3px}
  .num .n{font-size:18px;font-weight:600}
  .dest{margin-top:16px}
  .rect{margin-top:14px;padding:9px 12px;background:#FBEDED;border:1px solid #E8C4C4;border-radius:5px;color:#8A3A3A}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{font-size:8.5px;letter-spacing:.7px;text-transform:uppercase;color:#8a8880;text-align:left;padding:0 0 5px;border-bottom:1px solid #e5e3dd;font-weight:600}
  td{padding:7px 0;border-bottom:1px solid #f0efeb;vertical-align:top}
  .r{text-align:right}
  .sub{font-size:9px;color:#8a8880;margin-top:2px}
  .tot{display:flex;justify-content:flex-end;margin-top:14px}
  .tot table{width:250px;margin:0}
  .tot td{border:none;padding:2px 0;color:#54524c}
  .tot .fin td{border-top:1px solid #1a1a18;padding-top:7px;font-weight:600;color:#1a1a18;font-size:15px}
  .pie{margin-top:18px;border-top:1px solid #f0efeb;padding-top:10px;font-size:9.5px;color:#8a8880;display:flex;justify-content:space-between;gap:12px}
  .verifactu{color:#c4c2bc}
  @media print { .noprint{display:none} }
  .noprint{position:fixed;top:12px;right:12px}
  .noprint button{font-family:inherit;font-size:12px;padding:8px 16px;border-radius:6px;border:none;background:#5A969E;color:#fff;cursor:pointer}
</style></head><body>

<div class="noprint"><button onclick="window.print()">Imprimir o guardar en PDF</button></div>

<div class="hoja">
<div class="cab">
  <div>
    ${d.logo ? `<img src="${esc(d.logo)}" alt="">` : ''}
    ${d.nombreComercial ? `<div class="marca">${esc(d.nombreComercial)}</div>` : ''}
    <div class="emisor">
      ${esc(f.emisor_nombre)}<br>
      NIF ${esc(f.emisor_nif)}<br>
      ${esc(f.emisor_direccion || '')}
    </div>
  </div>
  <div class="num">
    ${esRect ? '<div class="lbl" style="color:#C25B5B">Factura rectificativa</div>' : ''}
    <div class="lbl">Factura n.º</div>
    <div class="n">${numeroFactura(f)}</div>
    <div class="lbl" style="margin-top:10px">Expedición</div>
    <div>${fecha(f.fecha_expedicion)}</div>
    ${f.fecha_operacion && f.fecha_operacion !== f.fecha_expedicion
      ? `<div class="lbl" style="margin-top:8px">Operación</div><div>${fecha(f.fecha_operacion)}</div>` : ''}
  </div>
</div>

${destinatario}

${esRect && d.rectificada ? `<div class="rect">
  Rectifica a la factura <strong>${esc(d.rectificada.serie)}/${String(d.rectificada.numero).padStart(4,'0')}</strong>
  de ${fecha(d.rectificada.fecha_expedicion)}.
  ${f.rectifica_motivo ? `<br>Motivo: ${esc(f.rectifica_motivo)}` : ''}
</div>` : ''}

<table>
  <tr><th style="width:48%">Descripción</th><th class="r">Base</th><th class="r">% IVA</th><th class="r">Cuota</th><th class="r">Total</th></tr>
  ${filas}
</table>

<div class="tot"><table>
  <tr><td>Base imponible</td><td class="r">${eur(f.base_total)}</td></tr>
  <tr><td>Cuota IVA</td><td class="r">${eur(f.cuota_total)}</td></tr>
  <tr class="fin"><td>TOTAL</td><td class="r">${eur(f.total)}</td></tr>
</table></div>

<div class="pie">
  <span>${d.cobro?.forma_pago ? `Forma de pago: ${esc(LBL_PAGO[d.cobro.forma_pago] || d.cobro.forma_pago)}` : ''}
    ${d.cobro?.fecha ? ` · ${fecha(d.cobro.fecha)}` : ''}</span>
  <span class="verifactu">[ QR + VERI*FACTU · obligatorio desde jul-2027 ]</span>
</div>
</div>

</body></html>`
}

/** Abre la factura en una ventana aparte, lista para imprimir o guardar en PDF. */
export async function abrirFactura(facturaId: string): Promise<{ ok: boolean, error?: string }> {
  const r = await cargarFactura(facturaId)
  if (!r.ok) return { ok: false, error: r.error }

  // La ventana se abre ANTES de nada en el flujo del clic, si no Safari la
  // bloquea. Como aquí ya hemos hecho un await, puede pasar: se avisa.
  const v = window.open('', '_blank')
  if (!v) return { ok: false, error: 'El navegador ha bloqueado la ventana. Permite las ventanas emergentes para este sitio.' }
  v.document.write(htmlFactura(r.datos))
  v.document.close()
  return { ok: true }
}
