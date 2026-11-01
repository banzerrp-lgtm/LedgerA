# Paso 2 — Base de datos local
Adjuntar: PROYECTO.md, DATOS.md

## Objetivo
Crear la base en IndexedDB con Dexie y las funciones para guardar, leer, editar y borrar.

## Al terminar debe existir
- `src/db/db.js` con todas las tablas de DATOS.md, versión 1 y los índices necesarios.
- Función genérica para crear registros que ponga id, creado, modificado y eliminado.
- Funciones de borrado lógico (a papelera) y restauración.
- Lectura que ignore los eliminados por defecto.
- Solicitud de almacenamiento persistente al navegador.
- Tipos de trabajo iniciales: Documento, Presentación, Otro.
- Pruebas de las funciones básicas.

## Prueba manual
Crear un registro desde la consola, recargar y comprobar que sigue ahí; ponerlo en modo avión y comprobar lo mismo.

## Cierre
Commit y ESTADO.md.
