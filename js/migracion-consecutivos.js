// ═══════════════════════════════
// MIGRACIÓN ÚNICA — numeración manual → consecutivo automático (2026-07-22)
// ═══════════════════════════════
// Este archivo es una herramienta de un solo uso, no parte permanente del aplicativo.
// Bórralo (y su <script> en cotizaciones.html) después de correr la migración con éxito.
//
// Uso: con la app abierta y con tu sesión iniciada, abre la consola del navegador y escribe:
//   migrarConsecutivosCotizaciones()      → solo MUESTRA el plan (agrupado, ordenado,
//                                            con el número nuevo que le tocaría a cada una).
//                                            No escribe nada en Supabase todavía.
//   migrarConsecutivosCotizaciones(true)  → ejecuta de verdad: renumera cada cotización
//                                            existente (guardando el número viejo en
//                                            cot.numeroAnterior) y reamarra las Órdenes de
//                                            Servicio que ya apuntaban a esos números viejos.
//
// IMPORTANTE: correr esto ANTES de crear cualquier cotización nueva con el consecutivo
// automático (a partir de C100001) — si no, el plan de numeración se cruza. La función se
// niega a correr si detecta que ya existe alguna cotización nueva sin migrar.
//
// Agrupa por número (todas las versiones V1/V2/V3... de una misma cotización comparten un
// solo consecutivo nuevo), ordena los grupos por fecha (la más antigua primero) y les asigna
// C100001, C100002... en ese orden. Es seguro correrla más de una vez: las cotizaciones que
// ya tengan numeroAnterior (ya migradas) se saltan solas.
async function migrarConsecutivosCotizaciones(ejecutar = false) {
  const yaNuevas = COTIZACIONES.filter(c => !c.numeroAnterior && (parseInt((c.numero || '').replace(/\D/g, '')) || 0) >= 100001);
  if (yaNuevas.length) {
    console.warn(`⚠️ Hay ${yaNuevas.length} cotización(es) ya creada(s) con el consecutivo nuevo antes de migrar las viejas: ${yaNuevas.map(c => c.numero).join(', ')}. Corre esta migración ANTES de crear cotizaciones nuevas — si ya no se puede, avisa antes de continuar.`);
    return;
  }

  const grupos = {};
  COTIZACIONES.forEach(c => {
    if (c.numeroAnterior) return; // ya migrada en una corrida anterior
    if (!grupos[c.numero]) grupos[c.numero] = [];
    grupos[c.numero].push(c);
  });
  const listaGrupos = Object.values(grupos).sort((a, b) => {
    const fa = a[0].fecha || '', fb = b[0].fecha || '';
    if (fa !== fb) return fa < fb ? -1 : 1;
    const na = parseInt((a[0].numero || '').replace(/\D/g, '')) || 0;
    const nb = parseInt((b[0].numero || '').replace(/\D/g, '')) || 0;
    return na - nb;
  });

  if (!listaGrupos.length) {
    console.log('No hay cotizaciones pendientes de migrar — todas ya tienen numeroAnterior, o no hay ninguna.');
    return;
  }

  let siguiente = 100001;
  const plan = listaGrupos.map(versiones => ({
    numeroAnterior: versiones[0].numero,
    numeroNuevo: 'C' + (siguiente++),
    versiones,
  }));

  console.table(plan.map(p => ({
    anterior: p.numeroAnterior,
    nuevo: p.numeroNuevo,
    fecha: p.versiones[0].fecha,
    cliente: p.versiones[0].cliente?.nombre || '',
    versiones: p.versiones.length,
  })));

  if (!ejecutar) {
    console.log(`Vista previa de ${plan.length} cotización(es) a renumerar. Nada se escribió todavía — corre migrarConsecutivosCotizaciones(true) para ejecutar de verdad.`);
    return plan;
  }

  for (const { numeroAnterior, numeroNuevo, versiones } of plan) {
    for (const v of versiones) {
      const version = v.version || 'V1';
      const actualizada = { ...v, numero: numeroNuevo, numeroAnterior };
      const { error: errInsert } = await sb.from('cotizaciones').insert({
        numero: numeroNuevo,
        version,
        estado: v.estado,
        cliente: v.cliente,
        items: v.items,
        condiciones: v.condiciones,
        datos: actualizada,
        modificado: new Date().toISOString(),
      });
      if (errInsert) { console.error(`✗ Error insertando ${numeroNuevo} ${version} (antes ${numeroAnterior}):`, errInsert.message); continue; }
      const { error: errDelete } = await sb.from('cotizaciones').delete().eq('numero', numeroAnterior).eq('version', version);
      if (errDelete) console.error(`⚠️ Se insertó ${numeroNuevo} ${version} pero no se pudo borrar el registro viejo ${numeroAnterior} ${version} (queda duplicado, revisar a mano):`, errDelete.message);
    }
    // Reamarrar las Órdenes de Servicio que ya apuntaban al número viejo.
    const ordenesLigadas = (typeof ORDENES !== 'undefined' ? ORDENES : []).filter(o => o.cotizacion === numeroAnterior);
    for (const o of ordenesLigadas) {
      const actualizada = { ...o, cotizacion: numeroNuevo };
      const { error } = await sb.from('ordenes_servicio').update({ datos: actualizada, modificado: new Date().toISOString() }).eq('numero', o.numero);
      if (error) console.error(`✗ Error reamarrando la OS ${o.numero} a ${numeroNuevo}:`, error.message);
    }
    console.log(`✓ ${numeroAnterior} → ${numeroNuevo} (${versiones.length} versión${versiones.length > 1 ? 'es' : ''}${ordenesLigadas.length ? `, ${ordenesLigadas.length} OS reamarrada(s)` : ''})`);
  }

  console.log('Migración terminada. Recarga la página (F5) para ver los números nuevos reflejados en toda la app.');
}
