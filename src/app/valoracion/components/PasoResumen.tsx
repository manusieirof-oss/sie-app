'use client'
import { Ic } from '@/lib/icons'
import { nombreTipoClase } from '@/lib/tipos'
import { textoEscala } from '@/components/EscalaSlider'
import { textoMedida } from '@/lib/tests'

/**
 * El resumen de la valoración, y el informe que sale de él.
 *
 * EL CONTENIDO SE DEFINE UNA VEZ. `secciones()` devuelve qué se enseña y en qué orden;
 * la pantalla lo pinta con las clases de la app y el informe lo pinta como HTML para
 * imprimir. Tenerlo dos veces —una para ver y otra para el PDF— acaba en un informe que
 * dice algo distinto de lo que había en pantalla, que es la peor forma de fallar: nadie
 * lo nota hasta que el papel está en manos del paciente.
 *
 * Tipografía 13/12 y `.panel`, como Ficha, Historial y Salud. La valoración se había
 * quedado con las cajas grises y el 9/10/11 px de antes.
 */

const FR: Record<string, string> = { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche', flexible: 'Flexible' }

type Fila = { k: string; v: string }
type Seccion = { titulo: string; icono: string; texto?: string; filas?: Fila[]; lista?: string[]; vacio?: string }

function secciones(form: any, testsValoracion: any[], tiposClaseOpts: any[], esRevaloracion: boolean): Seccion[] {
  const hp = form.horario_pref || {}
  const out: Seccion[] = []

  out.push({
    titulo: esRevaloracion ? 'Cómo se encuentra' : 'Motivo de consulta',
    icono: 'anamnesis',
    texto: form.anamnesis || '',
    vacio: 'No se anotó nada.',
  })

  const objetivos = [form.objetivo1, form.objetivo2, form.objetivo3].filter(Boolean)
  if (objetivos.length || form.deseo) {
    out.push({
      titulo: 'Lo que quiere conseguir', icono: 'objetivo',
      lista: objetivos,
      texto: form.deseo ? `Deseo: ${form.deseo}` : undefined,
    })
  }

  out.push({
    titulo: 'Escalas', icono: 'progreso',
    filas: [
      { k: 'Bienestar general', v: textoEscala(form.borg) },
      { k: 'Nivel de estrés', v: textoEscala(form.estres) },
    ],
  })

  // Los tests, lado a lado y con lo medido: es la parte del informe que de verdad se
  // consulta después.
  const filasTests: Fila[] = []
  testsValoracion.forEach((tv: any) => {
    const lados = tv.lados || {}
    const conDato = Object.keys(lados).filter(k => lados[k]?.resultado && lados[k].resultado !== 'sin_realizar')
    if (!conDato.length) { filasTests.push({ k: tv.nombre, v: 'Sin pasar' }); return }
    conDato.forEach(k => {
      const d = lados[k]
      const marcados = (d.items_resultado || []).filter((i: any) => i.marcado)
        .map((i: any) => { const m = textoMedida(i); return i.nombre + (m ? ` (${m})` : '') })
      const lado = k === 'bilateral' ? '' : ` · ${k}`
      filasTests.push({
        k: tv.nombre + lado,
        v: (d.resultado === 'positivo' ? 'Positivo' : 'Negativo') + (marcados.length ? ` — ${marcados.join(', ')}` : ''),
      })
    })
  })
  out.push({ titulo: 'Tests', icono: 'test', filas: filasTests, vacio: 'No se pasó ninguno.' })

  if ((form.molestias || []).length) {
    out.push({
      titulo: 'Molestias', icono: 'molestia',
      filas: form.molestias.map((m: any) => ({
        k: m.zona + (m.lado && m.lado !== 'bilateral' ? ` · ${m.lado}` : ''),
        v: [m.eva == null ? 'Sin EVA' : `EVA ${m.eva}/10`, m.tipo?.replace('_', ' '), m.cuando].filter(Boolean).join(' · '),
      })),
    })
  }

  const clinico: Fila[] = []
  if ((form.patologias || []).length) clinico.push({ k: 'Patologías', v: form.patologias.map((p: any) => p.nombre + (p.estado ? ` (${p.estado})` : '')).join(', ') })
  if ((form.operaciones || []).length) clinico.push({ k: 'Operaciones', v: form.operaciones.map((o: any) => o.nombre + (o.anio ? ` ${o.anio}` : '')).join(', ') })
  if ((form.medicacion || []).length) clinico.push({ k: 'Medicación', v: form.medicacion.map((m: any) => m.nombre + (m.frecuencia ? ` (${m.frecuencia})` : '')).join(', ') })
  if ((form.alergias || []).length) clinico.push({ k: 'Alergias', v: form.alergias.join(', ') })
  if ((form.intolerancias || []).length) clinico.push({ k: 'Intolerancias', v: form.intolerancias.join(', ') })
  if (clinico.length) out.push({ titulo: esRevaloracion ? 'Añadido hoy al historial' : 'Historial clínico', icono: 'patologia', filas: clinico })

  const contexto: Fila[] = []
  if (form.trabajo) contexto.push({ k: 'Trabajo', v: form.trabajo + (form.tipo_jornada ? ` · ${form.tipo_jornada}` : '') })
  if (form.hace_deporte && (form.deportes || []).length) contexto.push({ k: 'Deportes', v: form.deportes.join(', ') })
  if (form.plantillas) contexto.push({ k: 'Plantillas', v: [form.plantilla_izq && `Izq: ${form.plantilla_izq}`, form.plantilla_der && `Der: ${form.plantilla_der}`].filter(Boolean).join(' · ') || 'Sí' })
  if (contexto.length) out.push({ titulo: 'Contexto', icono: 'deporte', filas: contexto })

  if (!esRevaloracion) {
    const dias = form.dias_asistencia ? form.dias_asistencia.split(',').join(' · ') : '—'
    const horario = hp.modo === 'por_dia'
      ? Object.keys(hp.franjas_dia || {}).map(d => `${d}: ${FR[hp.franjas_dia[d]] || hp.franjas_dia[d]}`).join(' · ') || 'Sin días marcados'
      : hp.modo === 'alterno'
        ? (hp.alterno === 'turnos' ? 'Turnos (variable)' : 'Semana mañana / Semana tarde')
        : `${dias} · ${FR[hp.franja_general] || FR[form.franja] || '—'}${hp.hora_exacta ? ` · ${hp.hora_exacta}` : ''}`
    out.push({
      titulo: 'Plan', icono: 'calendario',
      filas: [
        { k: 'Tipo de clase', v: nombreTipoClase(tiposClaseOpts, form.tipo_clase_def) || '—' },
        { k: 'Bono', v: (form.bono || '').replace('_', ' ') },
        { k: 'Horario preferido', v: horario },
        ...(hp.notas_horario ? [{ k: 'Notas de horario', v: hp.notas_horario }] : []),
        ...(form.notas_plan ? [{ k: 'Notas', v: form.notas_plan }] : []),
      ],
    })
  }

  return out
}

/**
 * El pie del informe.
 *
 * Lo pide la clínica y conviene que lo lea su gestoría, igual que los textos de
 * consentimiento: aquí solo se deja escrito para qué sirve el papel y para qué no.
 */
const AVISO_INFORME = 'Este documento recoge las mediciones y observaciones realizadas durante la valoración en la clínica, y sirve para diseñar y seguir el programa de entrenamiento. Tiene carácter informativo y de uso interno: no es un informe médico ni un diagnóstico, y no tiene validez oficial fuera de la clínica.'

export default function PasoResumen({ form, testsValoracion, guardando, finalizar, firmaAceptada, imagenesAceptada, firmaCanvas, tiposClaseOpts = [], modo = 'inicial', clinica = {} }: any) {
  const esRevaloracion = modo === 'revaloracion'
  const secs = secciones(form, testsValoracion, tiposClaseOpts, esRevaloracion)
  const nombre = `${form.nombre || ''} ${form.apellidos || ''}`.trim() || 'Paciente'
  const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const edad = form.fecha_nacimiento ? Math.floor((Date.now() - new Date(form.fecha_nacimiento).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  const sinPasar = testsValoracion.filter((tv: any) => tv.previo && !Object.keys(tv.lados || {}).some((k: string) => tv.lados[k]?.resultado && tv.lados[k].resultado !== 'sin_realizar'))

  /** El informe para imprimir o guardar como PDF, con el membrete de la clínica. */
  function imprimir() {
    const esc = (t: string) => String(t ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
    const bloques = secs.map(s => {
      let cuerpo = ''
      if (s.texto && !s.filas && !s.lista) cuerpo = `<p class="txt">${esc(s.texto)}</p>`
      if (s.lista?.length) cuerpo += '<ul>' + s.lista.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>'
      if (s.texto && (s.filas || s.lista)) cuerpo += `<p class="txt">${esc(s.texto)}</p>`
      if (s.filas?.length) cuerpo += '<table>' + s.filas.map(f => `<tr><th>${esc(f.k)}</th><td>${esc(f.v)}</td></tr>`).join('') + '</table>'
      if (!cuerpo) cuerpo = `<p class="txt vacio">${esc(s.vacio || '—')}</p>`
      return `<h2>${esc(s.titulo)}</h2>${cuerpo}`
    }).join('')

    const html = `<html><head><meta charset="utf-8"><title>Valoración · ${esc(nombre)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#262825;padding:34px 40px;max-width:760px;margin:0 auto;font-size:12px;line-height:1.6}
      .cab{display:flex;align-items:center;gap:16px;border-bottom:2px solid #5A969E;padding-bottom:14px;margin-bottom:18px}
      .cab img{max-height:56px;max-width:180px;object-fit:contain}
      .cab .n{font-size:19px;font-weight:600;color:#5A969E;letter-spacing:.5px}
      .cab .t{font-size:11px;color:#888;margin-top:2px}
      h1{font-size:17px;font-weight:400;margin:0 0 2px}
      .meta{font-size:11px;color:#888;margin-bottom:22px}
      h2{font-size:10px;font-weight:700;color:#5A969E;margin:20px 0 7px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #EBF4F5;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin:0}
      th{text-align:left;font-weight:400;color:#888;width:34%;padding:3px 10px 3px 0;vertical-align:top}
      td{padding:3px 0;vertical-align:top}
      ul{margin:0 0 6px;padding-left:18px} li{margin-bottom:2px}
      .txt{margin:0 0 6px;white-space:pre-line}
      .vacio{color:#aaa}
      .aviso{margin-top:30px;padding-top:12px;border-top:1px solid #e6e2dc;font-size:9.5px;color:#777;line-height:1.55}
      .pie{margin-top:10px;font-size:9px;color:#aaa;text-align:center}
      @media print{body{padding:0}}
    </style></head><body>
      <div class="cab">
        ${clinica.logo ? `<img src="${esc(clinica.logo)}" alt="">` : ''}
        <div><div class="n">${esc(clinica.nombre || 'SIE')}</div><div class="t">Informe de ${esRevaloracion ? 'revaloración' : 'valoración inicial'}</div></div>
      </div>
      <h1>${esc(nombre)}</h1>
      <div class="meta">${[edad != null ? `${edad} años` : '', form.dni ? `DNI ${esc(form.dni)}` : '', hoy].filter(Boolean).join(' · ')}</div>
      ${bloques}
      <div class="aviso">${AVISO_INFORME}</div>
      <div class="pie">${esc(clinica.nombre || 'SIE')} · ${hoy}</div>
    </body></html>`

    const v = window.open('', '_blank')
    if (!v) { alert('El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes para este sitio.'); return }
    v.document.write(html); v.document.close()
    setTimeout(() => v.print(), 400)
  }

  return (
    <div className="panel">
      {/* CABECERA */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 20, fontWeight: 400, color: 'var(--n)', lineHeight: 1.2 }}>{nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3 }}>
            {esRevaloracion ? 'Revaloración' : 'Valoración inicial'} · {hoy}
            {edad != null && ` · ${edad} años`}
            {form.altura_cm && ` · ${form.altura_cm} cm`}
            {form.peso_kg && ` · ${form.peso_kg} kg`}
          </div>
        </div>
        <button className="btn btn-s btn-sm" onClick={imprimir}>
          <Ic name="informe" size={13} /> Informe en PDF
        </button>
      </div>

      {/* CONTENIDO · dos columnas en pantalla ancha, una en tablet */}
      <div className="g2" style={{ alignItems: 'start' }}>
        {[secs.filter((_, i) => i % 2 === 0), secs.filter((_, i) => i % 2 === 1)].map((col, ci) => (
          <div key={ci}>
            {col.map(s => (
              <div className="sec" key={s.titulo}>
                <div className="sec-h"><span className="sh-l"><Ic name={s.icono} size={13} /> {s.titulo}</span></div>
                {s.texto && !s.filas && !s.lista && (
                  <div style={{ fontSize: 13, color: s.texto ? 'var(--n)' : 'var(--gr)', fontWeight: 300, lineHeight: 1.65, whiteSpace: 'pre-line' }}>{s.texto}</div>
                )}
                {!!s.lista?.length && s.lista.map((x, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--gl)', color: 'var(--gd)', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, color: 'var(--n)', fontWeight: 300 }}>{x}</span>
                  </div>
                ))}
                {s.lista && s.texto && <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 6, fontStyle: 'italic' }}>{s.texto}</div>}
                {!!s.filas?.length && s.filas.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: i < s.filas!.length - 1 ? '1px solid var(--bl)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--gr)', width: '38%', flexShrink: 0 }}>{f.k}</span>
                    <span style={{ fontSize: 13, color: 'var(--n)', fontWeight: 300, flex: 1 }}>{f.v}</span>
                  </div>
                ))}
                {!s.texto && !s.lista?.length && !s.filas?.length && <div className="muted">{s.vacio || '—'}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CONSENTIMIENTOS · solo en la inicial: en la revaloración siguen vigentes */}
      {!esRevaloracion && (
        <div className="sec">
          <div className="sec-h"><span className="sh-l"><Ic name="firmar" size={13} /> Consentimientos</span></div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ color: firmaAceptada ? 'var(--gd)' : 'var(--gr)' }}>{firmaAceptada ? '✓' : '○'} Datos personales</span>
            <span style={{ color: imagenesAceptada ? 'var(--gd)' : 'var(--gr)' }}>{imagenesAceptada ? '✓' : '○'} Uso de imágenes</span>
            <span style={{ color: firmaCanvas ? 'var(--gd)' : 'var(--red)' }}>{firmaCanvas ? '✓ Firmado' : 'Sin firma'}</span>
          </div>
        </div>
      )}

      {/* Los tests que se trajeron por estar abiertos y no se han pasado no se registran.
          Se dice aquí, antes de guardar, no después. */}
      {esRevaloracion && sinPasar.length > 0 && (
        <div style={{ background: 'var(--ambl)', border: '1px solid var(--amb)', borderRadius: 'var(--rl)', padding: '11px 14px', marginBottom: 14, fontSize: 12, color: '#8A6410' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontWeight: 500 }}><Ic name="alerta" size={13} /> {sinPasar.length} test{sinPasar.length > 1 ? 's' : ''} sin pasar</div>
          <div style={{ fontWeight: 300, lineHeight: 1.55 }}>{sinPasar.map((t: any) => t.nombre).join(', ')}. Seguirán abiertos: no se guarda nada de ellos.</div>
        </div>
      )}

      <button className="btn btn-p" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14 }} onClick={finalizar} disabled={guardando}>
        {guardando ? 'Guardando…' : esRevaloracion ? '✓ Guardar revaloración' : '✓ Guardar valoración'}
      </button>
    </div>
  )
}
