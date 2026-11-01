# Paso 11 — PWA offline y publicación
Adjuntar: PROYECTO.md

## Objetivo
Instalar la app en el Android y que funcione en modo avión.

## Al terminar debe existir
- Manifest con nombre "Ledger", colores e íconos de 192 y 512 px (a partir del logo).
- Service worker generado con vite-plugin-pwa y precaché de toda la app.
- Aviso "Hay una versión nueva, toca para actualizar".
- Publicación gratis en Cloudflare Pages o Firebase Hosting.
- Probado en el celular: instalar desde Chrome, abrir sin internet, crear un encargo.

## Nota
El service worker exige HTTPS. En el celular solo se prueba bien con la versión publicada, no con la dirección local de la red.

## Cierre
Commit y ESTADO.md.
