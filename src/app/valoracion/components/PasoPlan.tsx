'use client'
import { Ic } from '@/lib/icons'
import AgendaHuecos from '@/components/AgendaHuecos'
import { iconTipoClase } from '@/lib/tipos'

import { textoModalidad, esAsignable, SOLO_VALORACION } from '@/lib/bonoSesiones'
import { PROGRESIONES } from '@/lib/sistemas'

export default function PasoPlan({ form, up, tiposClaseOpts=[], bonosOpts=[] }: any) {
  const hp = form.horario_pref || {modo:'general',franja_general:'manana',franjas_dia:{},alterno:'manana_tarde',hora_exacta:'',notas_horario:''}
  const upHp = (k:string, v:any) => up('horario_pref', {...hp, [k]:v})

  const DIAS = ['Lu','Ma','Mi','Ju','Vi','Sa','Do']
  const FRANJAS = [['manana','Mañana'],['tarde','Tarde'],['noche','Noche'],['flexible','Flexible']] as const

  return (
    <div className="g2">
      <div>
        <div className="card">
          <div className="card-title">Tipo de clase definitivo</div>
          <div className="g3">
            {tiposClaseOpts.map((tc:any)=>{
              const sel=form.tipo_clase_def===tc.valor
              const col=tc.color||'#5A969E'
              return (
                <div key={tc.valor} onClick={()=>up('tipo_clase_def',tc.valor)} style={{border:`1.5px solid ${sel?col:'var(--bd)'}`,borderRadius:'var(--rl)',padding:10,textAlign:'center',cursor:'pointer',background:sel?(col+'22'):'var(--w)',transition:'all .15s'}}>
                  <div style={{marginBottom:5,display:'flex',justifyContent:'center',color:col}}><Ic name={iconTipoClase(tc.valor,tc.icono)} size={22}/></div>
                  <div style={{fontSize:11,fontWeight:sel?500:400}}>{tc.nombre}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Qué contrata</div>
          {/* EN CUADRADITOS: los bonos caben de un vistazo sin bajar. Y al final "Solo
              valoración", para quien viene a valorarse y no contrata nada: no se le abre
              bono ni cuota (page.tsx lo salta igual que una venta suelta). */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:5}}>
            {[...bonosOpts, { id: SOLO_VALORACION, nombre: 'Solo valoración', _solo: true }].map((b:any)=>{
              const sel = form.bono===b.id
              return (
                <div key={b.id} onClick={()=>up('bono',b.id)} title={b._solo ? 'Solo se valora: no contrata bono' : [textoModalidad(b), b.descripcion].filter(Boolean).join(' · ')}
                  style={{position:'relative',padding:'7px 6px',borderRadius:6,textAlign:'center',cursor:'pointer',transition:'all .15s',
                          border:`1.5px ${b._solo?'dashed':'solid'} ${sel?'var(--g)':'var(--bd)'}`,background:sel?'var(--gl)':'var(--w)'}}>
                  <div style={{fontSize:10.5,fontWeight:sel?500:400,color:'var(--n)',lineHeight:1.25}}>{b.nombre}</div>
                  {/* Los días salen del bono de Ajustes (antes, de un mapa fijo que no cuadraba). */}
                  <div style={{fontSize:8.5,color:'var(--grl)',marginTop:2}}>{b._solo ? 'sin bono' : textoModalidad(b)}</div>
                  {sel&&<div style={{position:'absolute',top:3,right:4,fontSize:9,color:'var(--g)'}}>✓</div>}
                </div>
              )
            })}
          </div>
          {/* Una venta suelta no deja nada detrás, y eso hay que decirlo ANTES de
              guardar: si no, se espera ver a esa persona en Cobros el mes que viene. */}
          {form.bono!==SOLO_VALORACION && !esAsignable(bonosOpts.find((b:any)=>b.id===form.bono)) && (
            <div style={{fontSize:9,color:'#7A5800',background:'var(--ambl)',border:'1px solid var(--amb)',
                         borderRadius:6,padding:'8px 11px',marginTop:6,lineHeight:1.6}}>
              <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>
              Es una venta suelta: no se le asigna cuota ni aparecerá en Cobros el mes que viene.
              Se le cobra en el momento, desde Cobros → Cobro suelto.
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-title">Horario y citas
            {/* CUANTO SE AGENDA. Al guardar la valoracion se le ponen ya las citas de lo
                marcado, repetidas cada semana este tiempo. "Solo apuntar" = como antes. */}
            <div className="ag-seg" style={{textTransform:'none',letterSpacing:0}}>
              {[[1,'1 mes'],[2,'2 meses'],[3,'3 meses'],[0,'Solo apuntar']].map(([m,t])=>(
                <button key={m} className={(hp.meses ?? 1)===m?'on':''} onClick={()=>upHp('meses',m)}>{t}</button>
              ))}
            </div>
          </div>

          {/* HORARIO PREFERIDO = LA AGENDA DE HUECOS. Se ve donde hay sitio y se marcan las
              horas que le vienen bien; las llenas quedan como "si hay hueco". Al ponerle las
              citas al acabar, salen ya marcadas. (Antes: modos general / por dia / alterno.) */}
          <AgendaHuecos preferencia={hp.huecos || []} onPreferencia={v => {
            const L = ['Lu','Ma','Mi','Ju','Vi','Sa']
            up('horario_pref', { ...hp, modo: 'huecos', huecos: v })
            // Compatibilidad con lo de antes: dias y franja deducidos de lo marcado.
            up('dias_asistencia', Array.from(new Set(v.map(x => L[x.dia]))).join(','))
            if (v[0]) up('franja', v[0].hora < '15:00' ? 'manana' : 'tarde')
          }}/>
          {(hp.huecos||[]).some((x:any)=>!x.espera) && (
            <div style={{fontSize:12.5,color:(hp.meses ?? 1)?'var(--gd)':'var(--grl)',margin:'8px 0 12px'}}>
              {(hp.meses ?? 1)
                ? <>Al guardar se le ponen las citas de lo marcado durante <b>{hp.meses ?? 1} {(hp.meses ?? 1)===1?'mes':'meses'}</b>. Las de "si hay hueco" quedan solo apuntadas.</>
                : 'Solo se apunta su horario: las citas se ponen después.'}
            </div>
          )}

          {/* NOTAS DE HORARIO */}
          <div className="field"><label>Notas de horario (opcional)</label>
            <input className="input" value={hp.notas_horario||''} onChange={e=>upHp('notas_horario',e.target.value)} placeholder="ej. no puede antes de las 17h"/>
          </div>
        </div>

        {/* PROGRAMA DE ENTRENAMIENTO. Las notas del plan quedaban sueltas en la ficha y el
            ciclo se montaba despues desde cero, volviendo a pensar lo que ya se habia hablado
            con el paciente en la valoracion. Aqui se deja el nombre del ciclo y como va a
            progresar, y la ficha lo ofrece al ponerle el ciclo. No crea el ciclo: al terminar
            la valoracion todavia faltan tests y objetivos, y decidir su contenido aqui seria
            decidir sin los datos. */}
        <div className="card">
          <div className="card-title">Programa de entrenamiento</div>
          <div className="field"><label>Nombre del ciclo (opcional)</label>
            <input className="input" value={form.programa_nombre||''} onChange={e=>up('programa_nombre',e.target.value)}
              placeholder="ej. Lumbar · vuelta a la carga"/>
          </div>
          <div className="field"><label>Cómo progresa (opcional, si ya lo tienes claro)</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {PROGRESIONES.map(p=>(
                <button key={p.valor} type="button" title={p.ayuda}
                  className={`chip-sel ${form.programa_progresion===p.valor?'on':''}`}
                  onClick={()=>up('programa_progresion', form.programa_progresion===p.valor?'':p.valor)}>
                  {p.nombre}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{marginBottom:0}}><label>Notas del plan</label>
          <textarea className="input" style={{minHeight:120}} value={form.notas_plan} onChange={e=>up('notas_plan',e.target.value)}
            placeholder={`Resumen orientativo:\n· Objetivos: ${form.objetivo1||'—'}\n· Tipo de trabajo propuesto\n· Limitaciones a considerar\n· Progresión`}/>
          </div>
        </div>
      </div>
    </div>
  )
}
