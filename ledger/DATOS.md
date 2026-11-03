# Ledger — Modelo de datos y reglas de cálculo

## Campos comunes (todas las tablas)
`id` (UUID con crypto.randomUUID), `creado` (ISO UTC), `modificado` (ISO UTC), `eliminado` (boolean), `fecha_eliminado` (ISO o null).

## Tablas
**clientes**: nombre (obligatorio), codigo_pais (por defecto "+591"), telefono (obligatorio), notas. Aviso si ya existe el mismo código y teléfono.

**tipos_trabajo**: nombre, padre_id (null = primer nivel), precio_sugerido (centavos, opcional), activo. Máximo de niveles en ajustes (por defecto 4).

**pedidos**: cliente_id, fecha_pedido, fecha_entrega_general (opcional, se copia a las líneas), modalidad_pago ("adelanto" | "completo_inicio" | "contra_entrega"), adelanto_acordado (centavos), notas.

**lineas**: pedido_id, tipo_id, descripcion, precio_acordado (centavos, copiado del sugerido y editable), nota_descuento (texto libre), fecha_entrega (AAAA-MM-DD), hora_entrega (HH:MM o null), fecha_entrega_original, estado ("pendiente" | "en_proceso" | "entregado" | "cancelado"), fecha_terminado, prioridad (boolean).

**pagos**: pedido_id, linea_id (opcional), monto (centavos, siempre positivo), tipo ("cobro" | "devolucion"), metodo ("efectivo" | "qr" | "transferencia" | "otro"), fecha, nota. El saldo del pedido se calcula como total vigente menos cobros netos; cada pago puede asociarse al pedido completo o a una línea.

Al cancelar una línea, el cobro neto asignado a ella puede devolverse (se registra como pago de tipo `devolucion`) o mantenerse como saldo a favor. Los pagos asociados al pedido se asignan por fecha de entrega para determinar el monto atribuible a cada trabajo.

**ubicaciones**: linea_id, tipo ("drive" | "pc" | "usb" | "correo" | "otro"), enlace_o_ruta, nota. Las rutas de PC son solo texto de referencia.

**cambios**: linea_id, fecha, descripcion, costo_extra (centavos).

En el detalle de cada pedido se pueden registrar varias ubicaciones y cambios por línea. Solo enlaces `http:` y `https:` se muestran como enlaces que se abren; rutas locales y otros textos son referencias sin abrir. El costo extra vacío se guarda como cero.

**ajustes**: clave, valor. Claves: negocio, moneda_simbolo ("Bs"), max_niveles (4), dias_rojo, dias_amarillo, tema ("auto" | "claro" | "oscuro"), ultimo_respaldo.

## Reglas de dinero (en `src/logic/saldos.js`, con pruebas)
Por cliente:
- total_vigente = suma de precio_acordado de líneas no canceladas.
- total_entregado = suma de precio_acordado de líneas con estado entregado.
- cobros_netos = suma de cobros − suma de devoluciones.
- por_cobrar = total_vigente − cobros_netos.
- deuda_exigible = max(0, total_entregado − cobros_netos).
- saldo_a_favor = max(0, cobros_netos − total_vigente).
Los mismos cálculos existen por pedido. Los saldos nunca se guardan, siempre se calculan.
Para aplicar pagos por trabajo: los pagos con `linea_id` se aplican solo a esa línea. Los pagos sin línea se reparten entre las líneas no canceladas, primero las entregadas y luego las pendientes; dentro de cada grupo se ordenan por fecha de entrega y por fecha de creación. Cada línea recibe como máximo su precio acordado. Las devoluciones restan de la línea indicada o del reparto general si no tienen línea. Las líneas canceladas o eliminadas no reciben pagos; cualquier excedente queda como saldo a favor. Todo se calcula en centavos y no se guarda el monto aplicado.

## Estadísticas
- Los ingresos se calculan por fecha del pago, no por fecha de entrega: cobros suman y devoluciones restan.
- Semana significa lunes a domingo; mes y año son periodos calendario. Cada uno se compara con la semana, mes o año calendario anterior.
- El por cobrar actual usa los saldos vigentes por pedido.
- Los mejores clientes muestran el ingreso neto del periodo elegido.
- Los pagos asociados a una línea se atribuyen al tipo de esa línea. Los pagos del pedido se distribuyen entre sus líneas activas en proporción a sus precios; el reparto conserva todos los centavos. Si no hay línea aplicable se agrupan como «Sin tipo».

## Reglas de entregas (en `src/logic/entregas.js`, con pruebas)
Solo líneas pendientes o en proceso. Referencia: hoy en hora local.
- Rojo: vencida, de hoy o de mañana. Las vencidas llevan la etiqueta "VENCIDO".
- Amarillo: pasado mañana.
- Verde: tres días o más.
- Orden: 1) prioridad y vencida, 2) vencidas, 3) por fecha, y dentro del mismo día primero las que tienen hora (por hora) y después las que solo tienen día.
- Sin hora, la entrega vence al terminar el día.
- El color nunca va solo: siempre acompañado de texto ("Hoy", "Mañana", "Pasado mañana", "En 4 días").
- Al reprogramar, fecha_entrega_original no cambia.

## Tipos con niveles
Se puede elegir un tipo solo si no tiene hijos activos. Si tiene hijos, la app pide elegir el siguiente nivel. Al desactivar un tipo se desactivan sus hijos. Renombrar es seguro porque las líneas apuntan al id.

## Papelera
Borrar = eliminado:true y aviso "Eliminado. Deshacer" durante unos segundos. En la papelera se puede restaurar o borrar definitivamente (con confirmación). Si el elemento tiene trabajos asociados, avisar "esto afecta a N trabajos". El borrado definitivo de un cliente, pedido o trabajo incluye sus elementos dependientes y requiere confirmación explícita.

## Formato (en `src/logic/formato.js`, con pruebas)
- Fecha: 31/10/2026. Hora: 15:00 (24 h).
- Monto: Bs 1.200,50 (punto de miles, coma decimal). No depender de Intl: puede no agrupar 4 cifras en español. Escribir la función propia y probarla.

## Migraciones y respaldo
- Cada cambio de tablas sube la versión de Dexie y trae su migración.
- El archivo de respaldo es JSON: `{ schema_version, app_version, exportado, tablas: {...} }`.
- Importar siempre pregunta antes de reemplazar los datos actuales.
