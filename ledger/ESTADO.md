# Estado del proyecto (actualiza al terminar cada paso)

Último paso terminado: 14a - Integración Firebase/Google y primer despliegue de Hosting
Paso en curso: Validación manual de acceso, PWA y funcionamiento online/offline
Fecha: 2026-11-01

## Hecho
- Paso 00: entorno preparado, app Vite creada, dependencias instaladas y primer commit realizado.
- Paso 01: se implementó la identidad visual, navegación por hash, pantallas iniciales y selector de tema.
- El botón flotante global «+ Nuevo encargo» abre el formulario de pedido.
- Paso 02: se definieron las tablas Dexie, operaciones de registros y papelera, carga inicial de tipos y solicitud de almacenamiento persistente.
- Se conectó la inicialización de la base de datos a la app con avisos visibles ante errores o falta de persistencia garantizada.
- Paso 03: lista de clientes, búsqueda por nombre o teléfono, formulario reutilizable, aviso de duplicados y borrado con opción para deshacer.
- Paso 04: catálogo jerárquico de tipos, editor de precio sugerido, límite configurable en Ajustes, desactivación de descendientes y selector reutilizable.
- Paso 05: formulario de pedido con cliente nuevo integrado, múltiples líneas, precio sugerido editable, lista/detalle y cambios individuales de estado y fecha.
- Paso 06: Inicio usa pedidos reales, resume líneas pendientes y saldos, ordena entregas por urgencia y permite priorizar, reprogramar o cancelar vencidas.
- Paso 07: modalidades y adelanto acordado en pedidos; registro, edición, papelera con deshacer y resumen de pagos por pedido o línea.
- Paso 08: cálculo de saldos por pedido/cliente, reparto de pagos sin línea entre trabajos entregados, pantalla Deudores y saldo a favor visible en Clientes.
- Paso 09: cancelar trabajos con opción de devolver el adelanto o conservarlo como saldo a favor; papelera por tipo con restauración y borrado definitivo con confirmación; avisos de trabajos afectados al borrar clientes o tipos.
- Paso 10: historial de trabajos con búsqueda y filtros, ficha del cliente con saldos, ubicaciones y cambios por línea, y resumen de portafolio con periodo y control de privacidad.
- Paso 11 (preparación local): manifest y service worker con precaché, aviso de actualización bajo demanda y archivos de configuración/instrucciones para Cloudflare Pages.
- Validación del paso 11: 50 pruebas automatizadas pasan; la compilación genera el manifest, los dos iconos, los recursos de la app y el service worker con 11 entradas de precaché.
- Paso 12: respaldo JSON versionado con migración desde schema 1, validación antes de reemplazar, exportación de todas las tablas incluidas las eliminadas, importación atómica con confirmación, indicador de antigüedad en Inicio y Excel con una hoja legible por tabla.
- Validación del paso 12: 58 pruebas automatizadas pasan; compilación de producción aprobada; auditoría de dependencias de producción sin vulnerabilidades conocidas.
- Paso 13: pantalla de Estadísticas con cobros netos por semana, mes o año y comparación con el periodo anterior; por cobrar actual; mejores clientes del periodo; ingresos por tipo y dos gráficos interactivos. Los pagos de pedido se distribuyen proporcionalmente por precio y el reparto conserva los centavos.
- Chart.js se instaló como dependencia local y solo se registran los componentes de barras necesarios; los gráficos se incluyen en la compilación PWA, sin recursos desde internet.
- Validación del paso 13: 66 pruebas automatizadas pasan; compilación de producción aprobada; auditoría de dependencias de producción sin vulnerabilidades conocidas.
- Paso 14a (integración local pendiente de credenciales): SDK modular de Firebase Authentication, pantalla de acceso con Google, sesión local persistente, cierre de sesión y bloqueo si falta configuración. Se usa ventana emergente para hosting externo a Firebase y no se solicitan scopes de Drive.
- Se instalaron los paquetes modulares `@firebase/app` y `@firebase/auth` sin incluir Firestore; la auditoría de dependencias de producción reporta cero vulnerabilidades.
- Validación de la integración local 14a: 69 pruebas pasan; compilación PWA aprobada y SDK de autenticación en un chunk separado.
- Se añadió `.env.example`; la configuración real debe completarla el propietario en `.env.local`, que está excluido de Git. No se creó proyecto Firebase ni se publicó la aplicación.
- El propietario compartió el proyecto Firebase `ledger-d50e9`. Hosting queda asociado en `.firebaserc`; se añadió `firebase.json` para `dist`, fallback SPA y cabeceras no-cache de la página/manifest/service worker. `npm run deploy` bloquea la publicación si faltan valores en `.env.local`, y si están presentes compila antes de desplegar.
- Firebase CLI 15.34.2 está instalada globalmente. El propietario activó Google y autorizó `localhost`, `ledger-d50e9.firebaseapp.com` y `ledger-d50e9.web.app` en Authentication.
- Se inició sesión en Firebase CLI como propietario y se confirmó acceso al proyecto activo `ledger-d50e9`.
- Primer despliegue de Firebase Hosting completado en https://ledger-d50e9.web.app. La primera compilación falló por el límite de memoria de Node; el reintento con `NODE_OPTIONS=--max-old-space-size=4096` compiló y publicó los 14 archivos de `dist`.
- Se verificó que el sitio desplegado responde y sirve HTML de Ledger con manifest y recursos de producción.
- Falta comprobar manualmente el flujo de Google en el dominio publicado, la instalación/mode offline en Android y la creación de un encargo. No dar por cerrados los pasos 11/14a hasta validar esos comportamientos.
- Antes de cerrar 14a falta crear/configurar el proyecto Firebase, activar Google, autorizar `localhost` y el dominio publicado, completar configuración del consentimiento/marca aplicable y verificar el inicio/cierre de sesión.
- No se inició un servidor local.

## Archivos importantes creados
- `src/router.js`
- `src/db/db.js`
- `src/db/respaldo.js`
- `src/logic/respaldo.js`
- `src/views/ajustes.js`
- `tests/respaldo.test.js`
- `tests/respaldo-db.test.js`
- `src/logic/estadisticas.js`
- `src/db/estadisticas.js`
- `src/views/estadisticas.js`
- `tests/estadisticas.test.js`
- `src/auth/config.js`
- `src/auth/firebase.js`
- `src/views/login.js`
- `.env.example`
- `tests/firebase-config.test.js`
- `src/components/formulario-cliente.js`
- `src/components/selector-tipo.js`
- `src/logic/clientes.js`
- `src/logic/tipos-trabajo.js`
- `src/db/tipos-trabajo.js`
- `src/db/pedidos.js`
- `src/db/pagos.js`
- `src/db/papelera.js`
- `src/logic/entregas.js`
- `src/logic/pagos.js`
- `src/logic/saldos.js`
- `src/logic/historial.js`
- `src/db/historial.js`
- `tests/entregas.test.js`
- `tests/pagos.test.js`
- `tests/saldos.test.js`
- `tests/papelera.test.js`
- `tests/historial.test.js`
- `src/views/deudores.js`
- `src/views/papelera.js`
- `src/views/terminados.js`
- `src/views/ficha-cliente.js`
- `src/views/encargos.js`
- `src/views/`
- `src/styles/`
- `tests/`

## Decisiones tomadas durante el desarrollo
- Se usó una app Vite vanilla sin framework, siguiendo la decisión del proyecto.
- Se añadió Dexie para el almacenamiento local con IndexedDB.
- Se configuró PWA básica con `vite-plugin-pwa` para dejar la app lista para instalarse.
- El tema automático sigue `prefers-color-scheme`; las preferencias manuales se guardan en `localStorage`.
- Los registros usan UUID y campos comunes; el borrado normal es lógico y las lecturas excluyen eliminados por defecto.
- El límite de niveles de tipos de trabajo se guarda en IndexedDB, en Ajustes, y su valor inicial es 4.
- Cada pedido y sus líneas se guardan en una única transacción; cada línea mantiene su estado y fecha original de entrega.
- La clasificación de entregas usa fechas locales y conserva la fecha original al reprogramar.

## Pendiente o con errores conocidos
- Falta la prueba visual manual de claro/oscuro en navegador, móvil y orientación horizontal.
- Falta la prueba manual de persistencia al recargar y sin conexión.
- Falta la prueba manual de crear, buscar, editar, borrar y deshacer clientes.
- Falta la prueba manual de crear Documento → Informe → Informe técnico y desactivar Documento.
- Falta la prueba manual de crear un pedido con tres líneas y entregar solo una.
- Falta la prueba manual de verificar colores y orden de entregas vencidas, de hoy, mañana y en cinco días.
- Falta la prueba manual de registrar un pedido de Bs 300 con un adelanto de Bs 100 y un pago posterior de Bs 200; verificar saldo cero.
- Falta comparar manualmente los saldos de cliente, trabajos entregados y saldo a favor con un cálculo hecho en papel.
- Falta probar manualmente cancelar un trabajo con adelanto, eligiendo devolución y saldo a favor, y restaurar/borrar elementos desde Papelera.
- Falta probar manualmente los filtros de Terminados, abrir la ficha de cliente, guardar ubicaciones/cambios y revisar el portafolio con privacidad activada/desactivada.
- Falta publicar en Cloudflare Pages y probar la instalación, modo avión y creación de un encargo en Android.
- Falta probar manualmente la descarga de JSON y Excel, y la restauración de un respaldo con confirmación.
- Falta revisar manualmente las estadísticas con datos reales y verificar los gráficos en claro/oscuro.
- No se creó un commit porque el árbol de trabajo ya contenía cambios acumulados de varios pasos.

## Siguiente paso
Abrir https://ledger-d50e9.web.app, probar Google Sign-In y luego instalar la PWA en Android para probar modo avión y crear un encargo. Después continuar con 14b en una conversación separada.
