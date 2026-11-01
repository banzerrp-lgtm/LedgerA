# Estado del proyecto (actualiza al terminar cada paso)

Último paso terminado: 00 - Preparación del entorno
Fecha: 2026-10-31

## Hecho
- Se validó que Node.js y npm están instalados.
- Se creó la carpeta `ledger` con una app Vite vanilla.
- Se instalaron las dependencias base: `dexie`, `vite-plugin-pwa` y `vitest`.
- Se dejó creada la estructura de carpetas del proyecto y la documentación base en `docs/`.
- Se verificó que la app se levanta con `npm run dev` y responde en `http://localhost:5173/`.
- Se inicializó Git y se realizó el primer commit con el mensaje `paso 0`.

## Archivos importantes creados
- `package.json`
- `vite.config.js`
- `index.html`
- `src/main.js`
- `src/styles/`
- `src/db/db.js`
- `src/logic/formato.js`
- `public/manifest.webmanifest`
- `docs/README.md`

## Decisiones tomadas durante el desarrollo
- Se usó una app Vite vanilla sin framework, siguiendo la decisión del proyecto.
- Se añadió Dexie para el almacenamiento local con IndexedDB.
- Se configuró PWA básica con `vite-plugin-pwa` para dejar la app lista para instalarse.

## Pendiente o con errores conocidos
- El repositorio local quedó listo, pero en este entorno no hay autenticación/CLI de GitHub disponible para crear y empujar el remoto en GitHub.
- Si deseas, el siguiente paso es conectar el repositorio remoto con la URL correcta y hacer `git push origin main`.

## Siguiente paso
PASO-01
