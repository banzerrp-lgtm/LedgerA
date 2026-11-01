# Cómo trabajar con una IA sin saturarla (plan gratuito)

## Idea central
Nunca le pases todo el proyecto. En cada conversación pasa solo tres cosas:
1. `PROYECTO.md` (corto, contiene las reglas).
2. El archivo del paso actual (`pasos/PASO-XX.md`).
3. Los archivos extra que ese paso pida (`DATOS.md` o `DISENO.md`) y solo los archivos de código que vas a modificar.

## Ciclo para cada paso
1. Haz un commit en Git ("antes del paso X").
2. Abre una conversación nueva con la IA.
3. Pega los archivos del paso con el mensaje de abajo.
4. Prueba el resultado en el navegador y en tu Android.
5. Si funciona: commit ("paso X terminado") y actualiza `ESTADO.md`. Si falla: vuelve al commit anterior y pide que corrija solo el error.
6. Cierra la conversación. El siguiente paso empieza en una conversación nueva.

## Mensaje de inicio (plantilla)
```
Eres mi mentor de programación. Estoy aprendiendo y construyo la app Ledger.
Lee PROYECTO.md y el paso que adjunto. Sigue las reglas de oro.
Trabaja solo este paso. Antes de escribir código, dime qué archivos vas a crear o modificar.
Después del código, explícame cada parte como si fuera nuevo en programación.
Estado actual del proyecto: [pega ESTADO.md]
[Pega aquí PROYECTO.md, el PASO-XX.md y, si lo pide, DATOS.md o DISENO.md]
```

## Si la IA se queda sin espacio a mitad de un paso
- Pídele: "Resume en 10 líneas lo hecho y lo que falta" y pega ese resumen en `ESTADO.md`.
- Continúa en una conversación nueva con PROYECTO.md, el paso y ese resumen.
- Divide el paso: pide una sola pantalla o una sola función por mensaje.

## Cómo ahorrar espacio
- Pega solo los archivos que se modificarán, no toda la carpeta.
- Pide cambios como "solo la función X", no el archivo entero, si es largo.
- Cuando algo falle, pega el mensaje de error completo y solo el archivo implicado.
- No pidas varias pantallas a la vez.

## Aprender mientras la IA escribe
- Pide siempre la explicación al final de cada bloque.
- Antes de aceptar un cambio, lee qué archivos tocó.
- Una vez por semana escribe tú una parte pequeña sin IA (un botón, un filtro).
- Si no entiendes algo, no avances: pregunta.

## Dónde vigilar a la IA
- Dinero y fechas: exige pruebas (Vitest) y revisa los casos de borde (adelantos, cancelaciones, saldo a favor, cambio de día).
- Reglas de seguridad de Firebase: no las aceptes sin revisarlas con calma.
- Cambios que no pediste: por eso existen los commits.
- Versiones de librerías: si algo da error, pega el mensaje completo.

## Respaldar y exportar datos
En **Más → Ajustes → Respaldo y exportación**:
- «Descargar respaldo JSON» guarda todas las tablas, incluidos los elementos de la papelera. Conserva ese archivo fuera del celular para poder recuperarlo.
- «Importar respaldo JSON» valida el archivo y pide confirmación. Al continuar, reemplaza los datos locales de ese celular.
- «Exportar a Excel» descarga un libro con una hoja por tabla; sirve para consultar datos, no para restaurarlos.

Los datos se procesan en el dispositivo y no se envían a un servidor.

## Consultar estadísticas
En **Más → Estadísticas**, elige semana, mes o año. El total cuenta los pagos por su fecha: los cobros suman y las devoluciones restan. Se compara con el periodo calendario anterior. La pantalla también muestra el saldo actual por cobrar, los cinco clientes con más cobros netos y el desglose por tipo de trabajo.

## Preparar el acceso con Google (paso 14a)
1. Crea un proyecto en Firebase Console y registra una aplicación web.
2. En **Authentication → Sign-in method**, activa Google.
3. En los dominios autorizados de Authentication, agrega `localhost` para pruebas y el dominio real de publicación.
4. Copia `.env.example` como `.env.local` y completa `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID` con la configuración de la aplicación web de Firebase. Son valores de configuración del cliente, no claves privadas; `.env.local` no se versiona.
5. Antes de publicar el acceso para compradores, configura la pantalla de consentimiento y la marca de Google, los datos de contacto y la política de privacidad requerida para la publicación y verificación aplicables. Mientras no existan datos de Firebase válidos, Ledger bloquea el acceso y muestra instrucciones; no hay un modo que omita el login.

El acceso con Google solicita solo el perfil básico y el correo; no pide permisos de Drive ni otros scopes en esta parte. En hosting distinto de Firebase se utiliza una ventana emergente, según las recomendaciones de Firebase para evitar problemas del flujo de redirección con almacenamiento entre sitios. El inicio de sesión inicial requiere conexión; Firebase conserva la sesión localmente para permitir abrir la app sin conexión después.

El paso 14a solo autentica cuentas; aún no comprueba licencias. La autorización de compradores y las reglas de Firestore corresponden a los pasos 14b y 14c.

## Publicar en Firebase Hosting
El proyecto ya está asociado al ID Firebase `ledger-d50e9` mediante `.firebaserc`. No es necesario ejecutar `firebase init`: `firebase.json` publica `dist`, conserva el fallback SPA y evita cachear la página, el manifest y el service worker.

1. Completa `ledger/.env.local` con `.env.example`.
2. Desde la carpeta `ledger`, ejecuta `firebase login` y autoriza tu cuenta en la ventana de Google.
3. Ejecuta `npm run deploy`. El comando comprueba la configuración de Firebase, compila la PWA y publica solo Hosting. No publiques mientras el acceso de Google no funcione y no estén listos los requisitos de privacidad y consentimiento para tu audiencia.
4. En Firebase Console, copia el dominio de Hosting a **Authentication → Settings → Authorized domains**; después prueba Google Sign-In, instalar la PWA, modo avión y creación de un encargo.

## Publicar Ledger en Cloudflare Pages
La carpeta `ledger` está preparada para una publicación estática:

1. Sube el repositorio a GitHub y crea un proyecto de Pages conectado al repositorio.
2. Usa `ledger` como directorio raíz del proyecto.
3. Configura el comando de compilación `npm run build` y el directorio de salida `dist`.
4. Después del despliegue, abre la dirección HTTPS asignada por Pages.
5. En Android, abre esa dirección en Chrome, usa «Instalar aplicación» y verifica el uso en modo avión.

El despliegue requiere acceso a una cuenta de Cloudflare y no se ejecuta desde el repositorio. La carpeta `public` incluye las reglas de rutas SPA y cabeceras para que Cloudflare Pages entregue correctamente las rutas y compruebe el service worker al buscar actualizaciones.
