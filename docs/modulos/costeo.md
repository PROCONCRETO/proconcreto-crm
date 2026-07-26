# Módulo: Costeo de Productos

Módulo nuevo (2026-07-26), construido a partir del Excel real "COSTOS MAESTRO 2026_V2" que ya usaba la empresa. Se está armando por partes — este archivo se actualiza a medida que se agregan las siguientes pantallas (Listado de Insumos/Materias Primas, Amortización de Maquinaria y Equipos, Costeo de Producto).

## Archivos

- `js/costeo-mano-obra.js` — costo de mano de obra por clase salarial + cuadrillas productivas.
- `sql/2026-07-26_costeo_mano_obra.sql` — DDL de las tablas nuevas. **Hay que correrlo una sola vez** en el SQL Editor de Supabase antes de que esta pantalla pueda guardar datos (yo no tengo acceso para crear tablas).

## Pantallas (`ir()` en `navegacion.js`, módulo `costeo`)

`costeo-mo` (Costo de Mano de Obra) — única por ahora.

## Datos

Tablas Supabase nuevas (patrón `datos` JSONB, igual al resto de la app):

- `parametros_mo`: **un solo registro** (`id = 1` fijo). Guarda los valores que cambian con la ley — S.M.M.L.V., subsidio de transporte, días laborados al año y horas semanales (para el valor/día y valor/hora, ver más abajo), y los % de prestaciones sociales/seguridad social/parafiscales (cesantía, intereses cesantía, vacaciones, prima, pensión, salud, ARL, SENA, caja de compensación), más la lista de ítems de dotación (nombre, valor unitario, cantidad/año — igual para todas las clases, ver más abajo).
- `clases_salariales`: una fila por clase (`nombre` único, ej. "Clase 1 (Ayudante)"), con `multiplicador` (múltiplo del S.M.M.L.V.) y `aplicaSubsidioTransporte` (booleano, por si algún día se agrega una clase que gane más de 2 S.M.M.L.V. y no le aplique).
- `cuadrillas_productivas`: una fila por cuadrilla (`nombre` único, ej. "Cuadrilla Tipo 3: 1 Oficial + 3 Ayudantes"), con `roles: [{ rol, personas, clase }]` — `personas` puede ser fraccionaria (ej. 0.1 para un supervisor compartido entre varias cuadrillas).

## Fórmula de costo real de una clase salarial (`calcularCosteoClase()`)

Basada en la fórmula del Excel original (`MOD`), verificada al peso contra sus valores reales, con un ajuste deliberado en Vacaciones y en el divisor del valor/día (ver más abajo, decisión del 2026-07-26, ya no es una réplica literal del Excel en ese punto):

- `A` = S.M.M.L.V. × multiplicador (mensual); anual = A × 12.
- `B` = subsidio de transporte (mensual, si `aplicaSubsidioTransporte`); mismo valor para toda clase que lo tenga.
- `C` = A + B (mensual); anual = C × 12.
- `D` (base seguridad social y parafiscales) = A anual — **no** incluye el subsidio de transporte.
- `E` (base cesantía) = C anual — **sí** incluye el subsidio de transporte.
- Cesantía anual = E × (días cesantía / 365). Intereses sobre cesantía = Cesantía × %. Vacaciones = A mensual × %. Prima = C mensual × %.
- Dotación anual = suma de (valor unitario × cantidad/año) de `parametros_mo.dotacion` — **simplificación**: en el Excel original la cantidad de cada ítem de dotación variaba un poco por clase (ej. más pares de guantes para las clases más operativas); aquí se dejó un solo valor de cantidad por ítem, igual para todas las clases, para no tener que mantener una matriz ítem×clase por una diferencia de menos del 1% del costo total. Si en algún momento se necesita esa precisión, se puede agregar cantidad por clase.
- Pensión, Salud, ARL, Aporte ordinario (SENA), Subsidio familiar (caja de compensación) = D × su % respectivo.
- **Valor real anual = C anual + prestaciones sociales (SIN vacaciones) + dotación + seguridad social + parafiscales.** Mensual = anual/12. Semana = anual/52. Hora = semana / horas semanales legales (`parametros_mo.horasSemanales`, 42 desde jul-2026 en Colombia).
- **Valor/día = valor real anual / `parametros_mo.diasLaboradosAno`** (220 por defecto — días realmente trabajados al año, después de descontar sábados, domingos, festivos y vacaciones). Antes del 2026-07-26 el divisor era "días hábiles del mes" (20) aplicado al valor mensual; se cambió a un divisor anual real a pedido del usuario.
- **Vacaciones ya NO se suma al valor real anual** (sí se sigue calculando y mostrando en el discriminado, marcada como informativa): como el divisor `diasLaboradosAno` ya resta los días de vacaciones (15 hábiles/año por ley) de los días disponibles para repartir el costo, sumarla también como concepto de costo sería contar el mismo sobrecosto dos veces.

## Discriminado de costos (botón ➕ en cada clase)

Modal con cada concepto de costo (salario, subsidio, cesantía, intereses, vacaciones, prima, dotación, pensión, salud, ARL, parafiscales) y **dos lecturas de porcentaje** lado a lado: "% del costo" (sobre el costo real total = 100%) y "% del salario" (sobre el salario base = 100%, muestra el sobrecosto que agrega cada concepto por encima del sueldo — el total da el factor prestacional real, ~180-190% del salario). La fila de Vacaciones aparece en cursiva y sin "% del costo" (guion) porque es informativa, no está incluida en el total.

## Cuadrillas productivas

Cada cuadrilla suma, para cada rol, `personas × valorRealMensual` de la clase asignada a ese rol — igual que `CAP.MO` en el Excel (ej. una cuadrilla de "1 Oficial + 3 Ayudantes" también reparte fracciones de Almacenista/Supervisor compartidas). El valor/día sale de `(total mensual × 12) / diasLaboradosAno`, mismo criterio que el valor/día de una clase salarial.

## Pendiente (próximas pantallas del módulo)

- **Listado de referencia de insumos y materias primas** — de la pestaña `LIST.REF` del Excel.
- **Amortización de maquinaria y equipos** — de la pestaña `MAQ-EQUPO` (depreciación por vida útil o por uso/golpes, según la máquina).
- **Costeo de producto** — de la pestaña `FICHAS NUEVAS`, combinando materias primas + estas cuadrillas + máquinas + otros CIF para sacar el costo de producción por producto, que alimentará el catálogo de Productos ya existente (`productos` en Supabase, usado en Cotizaciones/Producción/Logística) — la pestaña `LISTA PRECIOS` del Excel es justamente ese catálogo.
- Sin resolver todavía: qué hacer con las pestañas `BD MEZCLA` / `BD MEZCLA AMOBLAMIENTO` / `BD MEZCLA COLUMBIA` / `BD MEZCLA PRETENSADOS` del Excel (posible relación con Diseño de Mezcla de Calidad, a confirmar).
