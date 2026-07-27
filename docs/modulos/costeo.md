# Módulo: Costeo de Productos

Módulo nuevo (2026-07-26), construido a partir del Excel real "COSTOS MAESTRO 2026_V2" que ya usaba la empresa. Se está armando por partes — este archivo se actualiza a medida que se agregan las siguientes pantallas (Listado de Insumos/Materias Primas, Amortización de Maquinaria y Equipos, Costeo de Producto).

## Archivos

- `js/costeo-mano-obra.js` — costo de mano de obra por clase salarial + cuadrillas productivas.
- `sql/2026-07-26_costeo_mano_obra.sql` — DDL de las tablas nuevas. **Hay que correrlo una sola vez** en el SQL Editor de Supabase antes de que esta pantalla pueda guardar datos (yo no tengo acceso para crear tablas).

## Pantallas (`ir()` en `navegacion.js`, módulo `costeo`)

`costeo-mo` (Costo de Mano de Obra) — única por ahora.

## Datos

Tablas Supabase nuevas (patrón `datos` JSONB, igual al resto de la app):

- `parametros_mo`: **un solo registro** (`id = 1` fijo). Guarda los valores que cambian con la ley — S.M.M.L.V., subsidio de transporte, días laborados al año y horas semanales (para el valor/día y valor/hora, ver más abajo), y los % de prestaciones sociales/seguridad social/parafiscales (cesantía, intereses cesantía, prima, pensión, salud, ARL, SENA, caja de compensación — **no** vacaciones, ver más abajo por qué), más la lista de ítems de dotación (nombre, valor unitario, cantidad/año — igual para todas las clases, ver más abajo).
- `clases_salariales`: una fila por clase (`nombre` único, ej. "Clase 1 (Ayudante)"), con `multiplicador` (múltiplo del S.M.M.L.V.) y `aplicaSubsidioTransporte` (booleano, por si algún día se agrega una clase que gane más de 2 S.M.M.L.V. y no le aplique).
- `cuadrillas_productivas`: una fila por cuadrilla (`nombre` único, ej. "Cuadrilla Tipo 3: 1 Oficial + 3 Ayudantes"), con `roles: [{ rol, personas, clase }]` — `personas` puede ser fraccionaria (ej. 0.1 para un supervisor compartido entre varias cuadrillas).

## Fórmula de costo real de una clase salarial (`calcularCosteoClase()`)

Basada en la fórmula del Excel original (`MOD`), verificada al peso contra sus valores reales, con un ajuste deliberado en el divisor del valor/día (ver más abajo, decisión del 2026-07-26, ya no es una réplica literal del Excel en ese punto):

- `A` = S.M.M.L.V. × multiplicador (mensual); anual = A × 12.
- `B` = subsidio de transporte (mensual, si `aplicaSubsidioTransporte`); mismo valor para toda clase que lo tenga.
- `C` = A + B (mensual); anual = C × 12.
- `D` (base seguridad social y parafiscales) = A anual — **no** incluye el subsidio de transporte.
- `E` (base cesantía) = C anual — **sí** incluye el subsidio de transporte.
- Cesantía anual = E × (días cesantía / 365). Intereses sobre cesantía = Cesantía × %. Prima = C mensual × %.
- Dotación anual = suma de (valor unitario × cantidad/año) de `parametros_mo.dotacion` — **simplificación**: en el Excel original la cantidad de cada ítem de dotación variaba un poco por clase (ej. más pares de guantes para las clases más operativas); aquí se dejó un solo valor de cantidad por ítem, igual para todas las clases, para no tener que mantener una matriz ítem×clase por una diferencia de menos del 1% del costo total. Si en algún momento se necesita esa precisión, se puede agregar cantidad por clase.
- Pensión, Salud, ARL, Aporte ordinario (SENA), Subsidio familiar (caja de compensación) = D × su % respectivo.
- **Valor real anual = C anual + cesantía + intereses cesantía + prima + dotación + seguridad social + parafiscales.** Mensual = anual/12. Semana = anual/52. Hora = semana / horas semanales legales (`parametros_mo.horasSemanales`, 42 desde jul-2026 en Colombia).
- **Valor/día = valor real anual / días laborados netos**, donde días laborados netos = `parametros_mo.diasLaboradosAno` (220 por defecto — días realmente trabajados al año, después de descontar sábados, domingos, festivos, días de vacaciones y por certificado de votación) **menos** `parametros_mo.ausentismoDias` (9 por defecto — ajuste por incapacidades, calamidades y permisos), con un piso de 1 día (`_diasLaboradosNeto()`). Antes del 2026-07-26 el divisor era "días hábiles del mes" (20) aplicado al valor mensual; se cambió a un divisor anual real a pedido del usuario. El campo "Días laborados netos" se muestra en vivo en Parámetros generales (`_actualizarDiasNetosMO()`) y en el resumen del discriminado de cada clase, para que quede claro qué número se está usando de verdad.

### Por qué Vacaciones no se modela como concepto de costo (decisión final, verificada con flujo de caja real)

Este punto se discutió varias veces antes de asentarse (incluso se llegó a implementar "sí súmalo" e "inclúyelo pero solo informativo" en el camino) — vale la pena dejar la razón completa por escrito para no volver a darle vueltas. `parametros_mo` ya **no tiene** un campo de % de vacaciones, y `calcularCosteoClase()` no calcula ningún valor de vacaciones — se quitó del todo, no solo de la suma.

El salario que un empleado devenga durante sus 15 días hábiles de vacaciones **no es plata extra**: es el mismo salario mensual de siempre (el salario se paga igual los 12 meses del año, haya o no vacaciones dentro de ese mes) — a diferencia de la Prima o la Cesantía, que sí son pagos adicionales reales exigidos por ley. La plata real que la empresa gasta al año en un empleado es exactamente: salario + subsidio transporte + cesantía + intereses + prima + dotación + seguridad social + parafiscales — ni un peso más ni uno menos.

El renglón "Vacaciones" del Excel original (A mensual × 50%) era un parche para compensar que su propio divisor ("20 días hábiles del mes", equivalente a 240 días/año) **no restaba los días de vacaciones** de los días disponibles para repartir el costo — sin ese parche, dividir por un divisor inflado habría subestimado el costo real por día. Ahora que el divisor `diasLaboradosAno` (220) sí resta los días de vacaciones de verdad, ese parche ya no hace falta: sumarlo aparte (aunque fuera solo como referencia informativa) y también restar esos días del divisor invitaba a confusión sobre si se estaba cobrando el mismo efecto dos veces, así que se quitó por completo del modelo. (Verificación numérica: para la Clase 1 del Excel original, el gasto real anual sin ningún renglón de vacaciones es $37.532.945 — sumarle igual un renglón de "vacaciones" de $875.500 habría inflado el total a $38.408.445, que no es plata que la empresa realmente desembolse.)

## Discriminado de costos (botón ➕ en cada clase)

Modal con cada concepto de costo (salario, subsidio, cesantía, intereses, prima, dotación, pensión, salud, ARL, parafiscales) y **dos lecturas de porcentaje** lado a lado: "% del costo" (sobre el costo real total = 100%) y "% del salario" (sobre el salario base = 100%, muestra el sobrecosto que agrega cada concepto por encima del sueldo — el total da el factor prestacional real, ~170-180% del salario).

## Cuadrillas productivas

Cada cuadrilla suma, para cada rol, `personas × valorRealMensual` de la clase asignada a ese rol — igual que `CAP.MO` en el Excel (ej. una cuadrilla de "1 Oficial + 3 Ayudantes" también reparte fracciones de Almacenista/Supervisor compartidas). El valor/día sale de `(total mensual × 12) / diasLaboradosAno`, mismo criterio que el valor/día de una clase salarial.

## Pendiente (próximas pantallas del módulo)

- **Listado de referencia de insumos y materias primas** — de la pestaña `LIST.REF` del Excel.
- **Amortización de maquinaria y equipos** — de la pestaña `MAQ-EQUPO` (depreciación por vida útil o por uso/golpes, según la máquina).
- **Costeo de producto** — de la pestaña `FICHAS NUEVAS`, combinando materias primas + estas cuadrillas + máquinas + otros CIF para sacar el costo de producción por producto, que alimentará el catálogo de Productos ya existente (`productos` en Supabase, usado en Cotizaciones/Producción/Logística) — la pestaña `LISTA PRECIOS` del Excel es justamente ese catálogo.
- Sin resolver todavía: qué hacer con las pestañas `BD MEZCLA` / `BD MEZCLA AMOBLAMIENTO` / `BD MEZCLA COLUMBIA` / `BD MEZCLA PRETENSADOS` del Excel (posible relación con Diseño de Mezcla de Calidad, a confirmar).
