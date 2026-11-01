# Ledger — Guía visual

## Marca
Logo: cubo isométrico con rombo azul arriba y letras L y E blancas en las caras, sobre negro (assets/logo-ledger-provisional.png). Es hermano del logo de One: misma estructura, color propio. Leyenda "by One" en verde de One. Cabecera negra en ambos modos.

## Tipografía
Fuente del sistema, sin descargas: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Base 16 px, títulos 20 px, notas 13 px mínimo. Sin selector de tipografía ni de tamaño.

## Colores (variables CSS en `src/styles/tokens.css`)
```css
:root {
  --bg:#F3F5F9; --card:#FFFFFF; --text:#131722; --text-2:#5A6475;
  --accent:#1F4FFF; --on-accent:#FFFFFF; --header:#0B0B0B; --on-header:#FFFFFF;
  --border:#DDE2EC; --danger:#D93636; --warn:#E8A400; --ok:#2E9E3A; --one-green:#0BAF14;
}
:root[data-theme="dark"] {
  --bg:#151922; --card:#1F2531; --text:#EEF1F7; --text-2:#A5AEC0;
  --accent:#5B86FF; --on-accent:#0B1020; --header:#0B0B0B; --on-header:#FFFFFF;
  --border:#2E3647; --danger:#FF6B6B; --warn:#F2C14E; --ok:#4CD964; --one-green:#34C23F;
}
```
Tema: "auto" (sigue al celular con `prefers-color-scheme`), "claro" u "oscuro". Se guarda en localStorage y se aplica con `data-theme` en `<html>`. Los valores son punto de partida: se ajustan probándolos en el celular.

## Componentes
- Cabecera negra con logo pequeño y título de la pantalla.
- Tarjetas blancas (o `--card`), radio 12 px, borde fino `--border`.
- Tarjeta de entrega: barra lateral de 4 px con el color de urgencia, título del trabajo, cliente, día y hora, precio (en cursiva si es el sugerido sin editar) y etiqueta de texto.
- Resumen superior de Inicio: dos tarjetas (Por entregar, Te deben).
- Botón principal en azul, uno por pantalla. Botones secundarios con borde.
- Navegación inferior de 4 íconos con texto. Botón "+ Nuevo encargo" flotante sobre ella.
- Aviso inferior "Eliminado. Deshacer".
- Estados vacíos con invitación ("Registra tu primer encargo") y un botón.

## Pantalla de inicio (referencia)
Cabecera → dos resúmenes → "Próximas entregas" con tarjetas ordenadas según DATOS.md → navegación. No debe verse vacía: si no hay datos, mostrar el estado vacío con el botón principal.

## Accesibilidad
Contraste suficiente en ambos modos, color acompañado de texto, áreas táctiles de 44 px, etiquetas en los campos.
