# ☁️ Respaldo automático en Google Drive

Se configura **una sola vez** (unos 5 minutos). Es más cómodo hacerlo desde la computadora.

## 1. Crear el receptor

1. Entra a **https://script.google.com** con tu cuenta de Google → **Nuevo proyecto**.
2. Arriba a la izquierda, cambia el nombre "Proyecto sin título" por **Respaldo Carros Lavados**.
3. Borra todo el código que aparece en `Código.gs` y pega el contenido de [`Respaldo.gs`](Respaldo.gs).
4. En la línea `const SECRET = 'CAMBIA-ESTA-CLAVE';` cambia `CAMBIA-ESTA-CLAVE` por una clave tuya, por ejemplo `lavados-Luis-8472`. **Anótala**, la vas a necesitar en la app.
5. Haz clic en 💾 **Guardar**.

## 2. Dar permiso a tu Drive

1. Arriba, en el menú de funciones, elige **probar** y haz clic en ▶️ **Ejecutar**.
2. Te pedirá permisos → **Revisar permisos** → elige tu cuenta.
3. Saldrá **"Google no ha verificado esta aplicación"**. Es normal: la app eres tú mismo.
   Haz clic en **Configuración avanzada** → **Ir a Respaldo Carros Lavados (no seguro)** → **Permitir**.
4. Abajo debe aparecer: `Todo bien. Carpeta lista: ...`. En tu Drive ya existe la carpeta **Carros Lavados - Respaldos**.

## 3. Publicarlo

1. Arriba a la derecha: **Implementar** → **Nueva implementación**.
2. En el engranaje ⚙️ junto a "Seleccionar tipo", elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** Yo (tu correo)
   - **Quién tiene acceso:** **Cualquier usuario**. Es necesario para que el teléfono pueda enviar los datos sin iniciar sesión. La clave secreta es lo que impide que otros lo usen.
4. **Implementar** → copia la **URL de la aplicación web**. Termina en `/exec`.

## 4. Conectar la app

1. En el celular, abre la app → **⚙️ Ajustes** → **Respaldo automático en Google Drive**.
2. Pega la URL y escribe tu clave → **Conectar**.
3. Debe aparecer ✅ **Último respaldo: ...**

Desde ahí, cada vez que agregues, edites o borres un carro se hace la copia sola. Si no hay internet, se reintenta cuando vuelva la señal.

## Teléfono nuevo o datos borrados

Instala la app, ve a Ajustes → Google Drive, pon la misma URL y clave → **Conectar**. La app detecta que en Drive hay más carros y te ofrece restaurarlos.

## Si algún día modificas el script

Usa **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar**. Así se mantiene la misma URL.

## Notas

- **Nunca subas tu clave a GitHub.** Solo va en el editor de Apps Script y en la app.
- Las copias diarias ocupan muy poco espacio. Puedes borrar las viejas de la carpeta cuando quieras.
