# Paso 14 — Versión vendible (login, licencias, respaldo en Drive)
Adjuntar: PROYECTO.md, DATOS.md. Dividir en 4 conversaciones.

Antes de empezar, revisar los límites y requisitos vigentes de Firebase y de Google (pantalla de consentimiento, modo producción, política de privacidad), porque cambian.

## 14a — Firebase y login
Crear el proyecto Firebase, activar Authentication con Google y conectar la app. Mostrar pantalla de inicio de sesión.

## 14b — Licencias
Colección `licencias` con documento por correo: activo, fecha_alta, vence (opcional), nota, ultimo_acceso. La app consulta su licencia, la recuerda y la vuelve a verificar con internet cada cierto tiempo (por ejemplo 30 días).

## 14c — Reglas y panel de administrador
Reglas de seguridad de Firestore: el comprador lee solo su documento y actualiza solo ultimo_acceso; solo el correo del administrador lee y escribe todo. Panel visible solo para el administrador: contador de activos, lista con correo, alta, vencimiento y último acceso, y botones agregar, revocar, renovar y editar nota. Sin Cloud Functions (exigen plan de pago). Revisar las reglas con calma antes de usarlas.

## 14d — Respaldo en Drive
Subir y restaurar el archivo de respaldo con el permiso `drive.file`. Botón "Conectar con Google", "Sincronizar" y "Restaurar desde Drive" con confirmación. Política de privacidad y términos en una página sencilla.

## Cierre de cada parte
Commit y ESTADO.md.
