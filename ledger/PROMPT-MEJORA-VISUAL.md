# Ledger — Prompts de mejora visual (basados en tus capturas)

## Qué se encontró en las capturas
1. **Ícono del celular:** se ve como un cuadrado azul liso, sin logo. Faltan íconos PNG correctos en el manifest.
2. **Cabecera:** repite el título de la pantalla (arriba "Inicio" y abajo otra vez "Encargos"), y el correo con "Cerrar sesión" ocupa mucho y se ve distinto en claro (botón blanco) y en oscuro (gris).
3. **Logo de la cabecera:** tiene su propio cuadro negro puro sobre la cabecera casi negra, y se nota el borde.
4. **Botón "+ Nuevo encargo":** flota en todas las pantallas (Más, Deudores), y en Encargos está duplicado arriba.
5. **Íconos de navegación:** son caracteres de texto (⌂ ▤ $ •••), de distinto estilo y tamaño.
6. **Pantallas vacías:** solo texto plano sobre fondo vacío. "Aún no hay respaldo" suelto, sin jerarquía.
7. **Más:** una tarjeta dentro de otra, con botones sin íconos ni indicación de que se pueden tocar.
8. **Tarjetas:** en modo claro casi no se distinguen del fondo; sin sombra ni profundidad.
9. **Tipografía:** debe cargarse desde el propio proyecto, no desde internet, para que se vea igual sin conexión.

## Cómo usarlo (plan gratuito)
Pega **una parte por conversación**, en orden. Adjunta siempre `PROYECTO.md`, `DISENO.md` y solo los archivos de código que la parte menciona. Haz un commit antes y otro después de cada parte.

Archivos incluidos en `assets/icons/` (ya generados): `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png`, `favicon-32.png` y `logo-header-transparente.png`.

---

## PARTE A — Íconos de la app y logo de cabecera

````
Contexto: app Ledger (PWA, Vite + JavaScript sin framework, vite-plugin-pwa). Lee PROYECTO.md y DISENO.md.
Tarea: SOLO arreglar los íconos de la PWA y el logo de la cabecera. No toques lógica ni base de datos.

Primero lista los archivos que vas a modificar.

1. Copia los archivos de assets/icons/ a public/icons/.
2. En la configuración de vite-plugin-pwa deja el manifest así: name "Ledger", short_name "Ledger", display "standalone", start_url "/", theme_color "#0B0B0B", background_color "#0B0B0B", lang "es", e íconos:
   - icon-192.png (192x192, purpose "any")
   - icon-512.png (512x512, purpose "any")
   - icon-maskable-512.png (512x512, purpose "maskable")
   Declara "any" y "maskable" como entradas separadas, no combinadas.
3. En index.html agrega: <link rel="icon" href="/icons/favicon-32.png">, <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png"> y <meta name="theme-color" content="#0B0B0B">.
4. En la cabecera usa /icons/logo-header-transparente.png (fondo transparente) de 36 px de alto, sin cuadro negro detrás.
5. Asegura que los íconos queden en el precaché del service worker (globPatterns con png, svg, woff2).

Al terminar: explica qué hiciste y recuérdame que debo desinstalar la app del celular y reinstalarla para que Android actualice el ícono.
````

**Prueba:** publica, desinstala Ledger del celular y vuelve a instalarlo desde Chrome. El ícono debe mostrar el cubo.

---

## PARTE B — Tipografía offline y sistema visual

````
Contexto: app Ledger (PWA, Vite + JavaScript sin framework). Lee PROYECTO.md y DISENO.md.
Tarea: SOLO estilos (src/styles/). No cambies lógica, datos ni nombres de funciones.

Primero lista los archivos que vas a modificar.

TIPOGRAFÍA (debe funcionar sin internet)
- Elimina cualquier fuente cargada desde internet (Google Fonts, <link> o @import de URL).
- Instala la fuente en el proyecto: npm install @fontsource-variable/inter
- Impórtala una vez en src/main.js: import '@fontsource-variable/inter';
- font-family global: 'Inter Variable', system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
- Para montos, cantidades y fechas: font-variant-numeric: tabular-nums;
- Escala: texto base 16 px, pequeño 13 px, título de pantalla 22 px (peso 700), título de sección 17 px (peso 600), números destacados 28 px (peso 700). Interlineado 1.4.
- Confirma que el precaché del service worker incluye los .woff2 y que no hay peticiones a fonts.googleapis.com ni fonts.gstatic.com.

TOKENS NUEVOS (agrégalos a tokens.css para claro y oscuro, sin cambiar los existentes)
- --accent-soft: claro rgba(31,79,255,.10) / oscuro rgba(91,134,255,.16)
- --danger-soft, --warn-soft, --ok-soft: el color de estado al 12 % de opacidad
- --radius-md: 12px; --radius-lg: 16px
- --shadow-card: claro "0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)" / oscuro "none"
- Espaciado en múltiplos de 4 px; margen lateral de las pantallas 16 px.

TARJETAS
- Radio 16 px, padding 16 px, borde 1 px --border, sombra --shadow-card.
- En modo oscuro, la tarjeta es un poco más clara que el fondo (--card) y se distingue por el borde.
- Separación entre tarjetas: 12 px.

Verificación: ancho 360 px en modo claro y oscuro, sin colores fijos fuera de tokens.css. Explica al final qué hiciste.
````

**Prueba:** pon el navegador en "Sin conexión" (DevTools → Network → Offline), recarga y comprueba que la letra no cambia.

---

## PARTE C — Cabecera, navegación y botón flotante

````
Contexto: app Ledger (Vite + JavaScript sin framework). Lee PROYECTO.md y DISENO.md.
Tarea: SOLO la estructura visual de cabecera, barra inferior y botón principal. No cambies lógica ni datos.

Primero lista los archivos que vas a modificar.

ÍCONOS
- Crea src/components/icons.js con íconos SVG en línea (estilo Lucide: 24 px, trazo 1.75, extremos redondeados, color currentColor): home, clipboard-list, wallet, layout-grid, plus, sun, moon, monitor, users, tags, check-circle, bar-chart, trash, settings, chevron-right, shield, package, banknote, log-out.
- No uses CDN, fuentes de íconos ni caracteres de texto como ⌂ ▤ $ •••. Todo debe funcionar sin internet.

CABECERA
- Alto 56 px más el área segura superior, fondo --header en ambos modos.
- Izquierda: logo (36 px) + "Ledger" (18 px, peso 700, blanco) y debajo "by One" (12 px, --one-green).
- Derecha: botón de tema (44x44, ícono sol/luna/monitor según el modo; al tocar alterna Automático → Claro → Oscuro, con aria-label) y un círculo de 36 px con la inicial del correo, que abre un menú pequeño con el correo y "Cerrar sesión".
- Quita de la cabecera el correo suelto y el botón "Cerrar sesión".
- El título de cada pantalla ya NO va en la cabecera: va dentro del contenido como título de 22 px.

BARRA INFERIOR
- Alto 64 px más el área segura inferior, fondo --card, borde superior 1 px --border.
- Cuatro ítems: Inicio (home), Encargos (clipboard-list), Deudores (wallet), Más (layout-grid).
- Ítem activo: ícono dentro de una píldora de 56x28 px con --accent-soft, ícono y etiqueta en --accent, etiqueta en peso 600. Inactivo: --text-2. Etiquetas de 12 px.

BOTÓN "+ NUEVO ENCARGO"
- Solo en Inicio y Encargos. Oculto en Deudores, Más y formularios.
- Ícono plus + texto, a 16 px del borde derecho y 16 px sobre la barra inferior. Sombra suave.
- Elimina el botón duplicado de la parte superior de Encargos.
- Todas las pantallas llevan 96 px de relleno inferior para que el botón nunca tape el último elemento.

Verificación: 360 px de ancho, modo claro y oscuro, navegación funcional. Explica al final qué hiciste.
````

---

## PARTE D — Pantallas (Inicio, Encargos, Deudores, Más)

````
Contexto: app Ledger (Vite + JavaScript sin framework). Lee PROYECTO.md y DISENO.md.
Tarea: SOLO el diseño de las pantallas con los datos que ya existen. No agregues funciones nuevas ni cambies cálculos.

Primero lista los archivos que vas a modificar.

COMPONENTE ESTADO VACÍO (reutilizable, src/components/estadoVacio.js)
Círculo de 64 px con --accent-soft y un ícono, título de 17 px, texto de apoyo en --text-2 (máx. 2 líneas), y botón principal opcional. Centrado, con 32 px de margen superior.

INICIO
1. Fecha larga en español como etiqueta pequeña (ej. "domingo, 1 de noviembre") y título "Resumen".
2. Dos tarjetas de resumen en fila: "Por entregar" (ícono package) y "Te deben" (ícono banknote). Cada una con el ícono en un círculo tintado, el número en 28 px y la etiqueta en 13 px. Los montos usan tabular-nums y formato "Bs 1.200,50".
3. Tarjeta de respaldo: ícono shield, "Aún no hay respaldo" (o "Último respaldo: hace X días"), texto "Guarda una copia para no perder tus datos" y botón secundario "Respaldar ahora" que lleva a Ajustes. Si pasaron más de 7 días, usa --warn-soft.
4. Si no hay clientes ni encargos, tarjeta "Primeros pasos" con 3 filas tocables y un círculo de verificación: "Crea tu primer cliente", "Revisa tus tipos de trabajo", "Registra tu primer encargo". Cada fila se marca al cumplirse. Se oculta cuando los tres están hechos.
5. Sección "Próximas entregas" con título de 17 px. Si está vacía, usa el estado vacío: "Sin entregas pendientes" / "Cuando registres un encargo, aparecerá aquí con su color de urgencia." / botón "Registrar encargo".
6. Las tarjetas de entrega (cuando existan) siguen DISENO.md: barra lateral de color, etiqueta de texto y precio.

ENCARGOS
Título "Encargos" en el contenido. Estado vacío: "Todavía no hay encargos" / "Registra tu primer pedido y llévalo al día." / botón "Registrar encargo".

DEUDORES
Título "Deudores". Estado vacío positivo con ícono check-circle en --ok-soft: "Todo al día" / "Nadie te debe nada por ahora."

MÁS
1. Tarjeta de cuenta arriba: círculo con inicial, correo, y "Cerrar sesión" como botón de texto.
2. Tres grupos, cada uno una sola tarjeta con filas separadas por líneas finas (sin tarjetas dentro de tarjetas):
   - Gestión: Clientes (users), Tipos de trabajo (tags)
   - Análisis: Terminados y portafolio (check-circle), Estadísticas (bar-chart)
   - Sistema: Papelera (trash), Ajustes (settings)
3. Cada fila mide 56 px: ícono de 36 px sobre --accent-soft, texto de 16 px y chevron-right a la derecha.
4. Al pie, en 13 px y --text-2: "Ledger v{versión del package.json} · by One".

AJUSTES (si ya existe el selector de tema)
Conviértelo en un control segmentado de tres opciones: Automático, Claro, Oscuro.

Criterios de aceptación
- Ninguna pantalla se ve vacía: siempre hay jerarquía, íconos o una invitación a actuar.
- 360 px de ancho, modo claro y oscuro.
- Áreas táctiles de al menos 44 px.
- Color siempre acompañado de texto.
- Cero colores fijos fuera de tokens.css.
- Funciona sin internet.
Explica al final qué hiciste.
````

---

## Después de cada parte
1. `npm run build` sin errores y prueba en el celular.
2. Compara en modo claro y oscuro, y manda una captura a Claude si algo no te convence.
3. Commit ("mejora visual parte X") y actualiza `ESTADO.md`.
