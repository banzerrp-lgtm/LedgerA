# Ledger by One — Documento maestro

> Pega este archivo al inicio de cada conversación con una IA. Es corto a propósito.
> Para el detalle, la IA recibirá solo el archivo que el paso actual pida (DATOS.md o DISENO.md).

## 1. Qué es
Ledger es una app para emprendedores y freelancers que reciben encargos informales (documentos, presentaciones, afiches...). Resuelve tres olvidos: quién pidió qué, en cuánto se acordó y cuánto falta cobrar. Registrar un encargo debe tomar menos de un minuto.

- Producto de la empresa One (Network Outstanding). Nombre de trabajo: Ledger (verificar marca antes de vender).
- Idioma: solo español. Moneda por defecto: bolivianos (Bs), configurable.
- Primero es para uso personal del autor. Después se vende a conocidos.

## 2. Decisiones técnicas (ya tomadas, no reabrir)
| Parte | Decisión |
|---|---|
| Tipo de app | PWA (web instalable en Android). Funciona sin internet. |
| Lenguaje | HTML + CSS + JavaScript (módulos ES). Sin framework (nada de React/Vue). |
| Herramienta de build | Vite (plantilla vanilla) + vite-plugin-pwa |
| Base de datos local | IndexedDB mediante Dexie.js. Los datos viven en el celular. |
| Pruebas | Vitest, solo para la lógica de cálculo (saldos, fechas, formato) |
| Excel | SheetJS (exportar) |
| Hosting | Gratis: Cloudflare Pages o Firebase Hosting (sin dominio propio) |
| Etapa vendible | Firebase Auth (login Google) + Firestore (solo lista de licencias) + API de Drive con permiso `drive.file` para respaldo |
| Android APK | Opcional y posterior (Capacitor). No es prioridad. |

Los datos de negocio de cada usuario NUNCA van a un servidor propio: solo celular y su Drive.

## 3. Reglas de oro para la IA
1. Trabaja solo en el paso actual. No toques archivos fuera de él sin avisar antes.
2. Antes de escribir código, lista los archivos que vas a crear o modificar.
3. No agregues librerías ni cambies el stack sin pedir permiso.
4. Montos: números enteros en centavos. Nunca decimales flotantes.
5. Fechas de entrega: texto local `AAAA-MM-DD` y hora opcional `HH:MM`. Sin zonas horarias.
6. Nada se borra de verdad al principio: se marca `eliminado` y va a la papelera.
7. Colores solo con variables CSS (ver DISENO.md). Nunca colores fijos en componentes.
8. Todo cálculo de dinero o fechas va en `src/logic/` con pruebas.
9. Mobile first (360 px de ancho), botones de al menos 44 px, textos de 16 px.
10. Datos en IndexedDB. `localStorage` solo para la preferencia de tema.
11. Textos de la interfaz en español, frases cortas, sin tecnicismos.
12. Comenta el código en español y, al final, explica lo hecho para alguien que aprende.
13. Muestra solo los archivos modificados (completos si tienen menos de 150 líneas).
14. Al terminar, redacta la actualización para ESTADO.md.

## 4. Pantallas
Navegación inferior de 4 botones: Inicio, Encargos, Deudores, Más. Botón principal "+ Nuevo encargo" siempre visible.
- Inicio: Por entregar, Te deben, Próximas entregas.
- Encargos: lista con búsqueda y filtros. Detalle con líneas, pagos, ubicaciones y cambios.
- Deudores: por cliente, qué debe y por cuál trabajo entregado.
- Más: Clientes, Terminados (historial y portafolio), Estadísticas, Tipos de trabajo, Papelera, Ajustes.

## 5. Funciones por etapa
- MVP: clientes, tipos de trabajo con hasta 4 niveles, pedidos con varias líneas, pagos con modalidad y método, entregas con colores y prioridad, cancelaciones y devoluciones, papelera, respaldo exportable.
- Siguiente: deudores, ficha de cliente, historial con buscador, ubicaciones del trabajo.
- Después: estadísticas, modo portafolio, registro de cambios pedidos.
- Vendible: login Google, licencias y panel de administrador, respaldo en Drive, exportar a Excel.

## 6. Fuera de alcance por ahora
PIN o contraseña de la app, varios idiomas, notificaciones push, fotos y archivos adjuntos, sincronización simultánea entre dos celulares, APK, pagos dentro de la app.

## 7. Estructura de carpetas
```
ledger/
  index.html  package.json  vite.config.js
  public/          iconos y manifest
  src/
    main.js  router.js
    styles/        tokens.css  base.css  components.css
    db/            db.js  y un archivo por tabla
    logic/         saldos.js  entregas.js  formato.js
    views/         una por pantalla
    components/    piezas reutilizables
  tests/
  docs/            estos .md
```

## 8. Glosario
- Pedido: la conversación con un cliente. Contiene varias líneas.
- Línea: un trabajo concreto dentro de un pedido, con su precio, fecha y estado.
- Por cobrar: todo lo que falta cobrar, esté entregado o no.
- Deuda exigible: lo ya entregado y aún no pagado.
- Saldo a favor: lo que el cliente pagó de más.
