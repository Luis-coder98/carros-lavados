# 🚗 Carros Lavados

App personal para registrar los carros que lavo cada día y saber cuánto me toca por día, por semana y por mes.

## Qué hace

- **Hoy**: agregar carro (marca, precio, propina, nota). Muestra cuántos carros llevo y cuánto me toca hoy.
  - Botones rápidos con las marcas y precios que más uso.
  - Editar ✏️ o borrar 🗑️ cualquier registro. Flechas ‹ › para ver otros días.
- **Semana**: total de la semana de pago (lunes a domingo por defecto), desglosado por día. Botón para copiar/compartir el resumen.
- **Mes**: total del mes, por semana y por marca.
- **Ajustes**: porcentaje editable (25% por defecto), día de inicio de la semana, moneda, exportar a Excel (CSV), respaldo y restauración.

## Cálculo

```
Mi comisión = precio × porcentaje
Me toca     = mi comisión + propina   (la propina es 100% mía)
```

Cada carro guarda el porcentaje con el que se registró, así que si cambias el % más adelante no se alteran los días anteriores (a menos que marques "aplicar a todos").

## Cómo usarla

- **En la computadora**: doble clic en `index.html`.
- **En el celular**: hay que publicarla en una página web (gratis con GitHub Pages o Netlify Drop). Luego en el navegador del teléfono: *Agregar a pantalla de inicio* y queda como una app que funciona sin internet.

## Datos

Se guardan en el navegador del dispositivo (localStorage). No se comparten entre celular y computadora.

**Respaldo automático en Google Drive:** cada cambio se copia a la carpeta *Carros Lavados - Respaldos* de tu Drive, a través de un pequeño script de Google Apps Script. Configuración (una sola vez): [google-apps-script/INSTRUCCIONES.md](google-apps-script/INSTRUCCIONES.md).

También puedes descargar un respaldo manual (Ajustes → Descargar respaldo).

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura de la app |
| `styles.css` | Diseño (claro/oscuro automático) |
| `app.js` | Toda la lógica |
| `manifest.json`, `sw.js`, `icon.svg` | Para instalarla en el celular y usarla sin internet |
