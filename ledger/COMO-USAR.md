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
