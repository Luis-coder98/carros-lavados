/**
 * Receptor de respaldos para la app "Carros Lavados".
 *
 * Se pega en https://script.google.com y se publica como "Aplicación web".
 * Guarda los datos en la carpeta "Carros Lavados - Respaldos" de tu Google Drive:
 *   - ultimo-respaldo.json        → siempre la versión más reciente
 *   - respaldo-AAAA-MM-DD.json    → una copia por día
 *
 * Ver INSTRUCCIONES.md para los pasos.
 */

// ⚠️ Cambia esta clave por una tuya y pon la MISMA en la app (Ajustes → Google Drive).
const SECRET = 'CAMBIA-ESTA-CLAVE';

const FOLDER_NAME = 'Carros Lavados - Respaldos';
const LATEST = 'ultimo-respaldo.json';

/** Recibe un respaldo desde la app. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const body = JSON.parse(e.postData.contents);
    const check = checkSecret(body.secret);
    if (check) return reply(check);

    const data = body.data;
    if (!data || !Array.isArray(data.entries)) return reply({ ok: false, error: 'Datos inválidos' });

    const day = /^\d{4}-\d{2}-\d{2}$/.test(body.day)
      ? body.day
      : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const json = JSON.stringify(data, null, 2);
    const folder = getFolder();
    writeFile(folder, LATEST, json);
    writeFile(folder, 'respaldo-' + day + '.json', json);

    return reply({ ok: true, savedAt: new Date().toISOString(), count: data.entries.length });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Devuelve el último respaldo (para restaurar en un teléfono nuevo). */
function doGet(e) {
  try {
    const secret = e && e.parameter && e.parameter.secret;
    if (!secret) return reply({ ok: true, msg: 'Receptor de Carros Lavados activo' });
    const check = checkSecret(secret);
    if (check) return reply(check);

    const files = getFolder().getFilesByName(LATEST);
    if (!files.hasNext()) return reply({ ok: true, data: null, count: 0 });
    const file = files.next();
    const data = JSON.parse(file.getBlob().getDataAsString());
    return reply({ ok: true, data: data, count: data.entries.length, savedAt: file.getLastUpdated().toISOString() });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

/** Ejecuta esta función una vez desde el editor para dar permisos y crear la carpeta. */
function probar() {
  const folder = getFolder();
  Logger.log('Todo bien. Carpeta lista: ' + folder.getUrl());
}

function checkSecret(secret) {
  if (SECRET === 'CAMBIA-ESTA-CLAVE') return { ok: false, error: 'Cambia la clave SECRET en el script' };
  if (secret !== SECRET) return { ok: false, error: 'clave' };
  return null;
}

function getFolder() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function writeFile(folder, name, content) {
  const it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(content);
  else folder.createFile(name, content, 'application/json');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
