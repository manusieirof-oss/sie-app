// ---------------------------------------------------------------------------
// UN EXCEL DE VERDAD (.xlsx), SIN LIBRERIAS.
//
// El listado para la gestoria salia en CSV, y el CSV depende de como lo abra cada
// Excel: el de castellano leia "49.5" como texto y no lo sumaba (septiembre de 2026
// daba 8298 EUR en vez de 8500,50) y las tildes salian rotas. Un .xlsx guarda los
// numeros como numeros y el texto en UTF-8, asi que se ve igual en cualquier Excel,
// Numbers o LibreOffice.
//
// Un .xlsx es un ZIP con unos pocos XML. Se escribe el ZIP sin comprimir (metodo
// "store"), que cualquier lector admite y evita meter una dependencia para esto.
// ---------------------------------------------------------------------------

export type Columna = { clave: string, titulo: string, numero?: boolean, ancho?: number }

const esc = (s: any) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Caracteres de control: XML no los admite y Excel daria el fichero por corrupto.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

/** A, B, ... Z, AA, AB... */
const letra = (n: number) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }

function hojaXml(cols: Columna[], filas: any[], totales: boolean) {
  const r: string[] = []
  // Cabecera en negrita (estilo 2).
  r.push(`<row r="1">${cols.map((c, i) => `<c r="${letra(i)}1" t="inlineStr" s="2"><is><t>${esc(c.titulo)}</t></is></c>`).join('')}</row>`)
  filas.forEach((f, k) => {
    const n = k + 2
    r.push(`<row r="${n}">${cols.map((c, i) => {
      const v = f[c.clave]
      const ref = `${letra(i)}${n}`
      if (c.numero && v !== null && v !== undefined && v !== '' && isFinite(Number(v)))
        return `<c r="${ref}" s="1"><v>${Number(v)}</v></c>`
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
    }).join('')}</row>`)
  })
  if (totales && filas.length > 0) {
    const n = filas.length + 2
    // Formulas y no el numero ya sumado: si en la gestoria tocan una fila, el total sigue cuadrando.
    r.push(`<row r="${n}">${cols.map((c, i) => {
      const ref = `${letra(i)}${n}`
      if (i === 0) return `<c r="${ref}" t="inlineStr" s="2"><is><t>Total</t></is></c>`
      if (!c.numero) return ''
      return `<c r="${ref}" s="3"><f>SUM(${letra(i)}2:${letra(i)}${n - 1})</f></c>`
    }).join('')}</row>`)
  }
  const anchos = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho || 14}" customWidth="1"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos}</cols><sheetData>${r.join('')}</sheetData></worksheet>`
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

// --- ZIP sin comprimir -------------------------------------------------------
const TABLA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(b: Uint8Array) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }

function zip(ficheros: { nombre: string, datos: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  for (const f of ficheros) {
    const nombre = enc.encode(f.nombre), datos = enc.encode(f.datos), crc = crc32(datos)
    const h = new DataView(new ArrayBuffer(30))
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true)
    h.setUint16(8, 0, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true)
    h.setUint32(14, crc, true); h.setUint32(18, datos.length, true); h.setUint32(22, datos.length, true)
    h.setUint16(26, nombre.length, true); h.setUint16(28, 0, true)
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true)
    c.setUint32(16, crc, true); c.setUint32(20, datos.length, true); c.setUint32(24, datos.length, true)
    c.setUint16(28, nombre.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true)
    c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, offset, true)
    partes.push(new Uint8Array(h.buffer), nombre, datos)
    central.push(new Uint8Array(c.buffer), nombre)
    offset += 30 + nombre.length + datos.length
  }
  const tamCentral = central.reduce((a, b) => a + b.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, ficheros.length, true); fin.setUint16(10, ficheros.length, true)
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true)
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const out = new Uint8Array(todo.reduce((a, b) => a + b.length, 0))
  let p = 0; for (const t of todo) { out.set(t, p); p += t.length }
  return out
}

/** Los bytes del .xlsx: una hoja, cabecera en negrita y, si se pide, fila de totales. */
export function xlsx(nombreHoja: string, cols: Columna[], filas: any[], opciones: { totales?: boolean } = {}): Uint8Array {
  const hoja = esc(nombreHoja).slice(0, 31) || 'Hoja1'
  return zip([
    { nombre: '[Content_Types].xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { nombre: '_rels/.rels', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${hoja}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', datos: ESTILOS },
    { nombre: 'xl/worksheets/sheet1.xml', datos: hojaXml(cols, filas, !!opciones.totales) },
  ])
}

/** Descarga los bytes como fichero .xlsx. */
export function descargarXlsx(bytes: Uint8Array, nombreFichero: string) {
  const url = URL.createObjectURL(new Blob([bytes as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a'); a.href = url; a.download = nombreFichero; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
