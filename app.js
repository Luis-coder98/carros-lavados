/* Carros Lavados — registro diario/semanal/mensual de lavados.
 * Todo se guarda en localStorage del navegador (sin servidor).
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'carros-lavados.v1';
  const DRIVE_KEY = 'carros-lavados.drive';
  const DEFAULTS = { pct: 25, weekStart: 1, currency: '$', driveUrl: '', driveSecret: '' };
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------- Estado ----------
  let state = load();
  let editingId = null;
  let viewDay = todayStr();
  let viewWeek = todayStr();
  let viewMonth = todayStr().slice(0, 7);

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (raw && Array.isArray(raw.entries)) {
        return { settings: { ...DEFAULTS, ...raw.settings }, entries: raw.entries };
      }
    } catch (e) { /* datos corruptos o storage bloqueado */ }
    return { settings: { ...DEFAULTS }, entries: [] };
  }
  // backup=false para cambios que no deben subirse a Drive (p. ej. configurar el enlace)
  function save(backup = true) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('⚠️ No se pudo guardar en este navegador'); }
    if (backup && driveOn()) { drive.dirty = true; saveDrive(); scheduleDrive(); renderDriveStatus(); }
  }

  // ---------- Respaldo automático en Google Drive (vía Google Apps Script) ----------
  let drive = loadDrive();
  let driveTimer = null, driveBusy = false;

  function loadDrive() {
    const base = { dirty: false, lastOk: null, lastCount: 0, lastError: null };
    try { return { ...base, ...JSON.parse(localStorage.getItem(DRIVE_KEY)) }; } catch (e) { return base; }
  }
  function saveDrive() { try { localStorage.setItem(DRIVE_KEY, JSON.stringify(drive)); } catch (e) { /* nada */ } }
  function driveOn() { return !!(state.settings.driveUrl && state.settings.driveSecret); }
  function backupPayload() {
    const { driveUrl, driveSecret, ...settings } = state.settings; // la clave no viaja dentro del respaldo
    return { settings, entries: state.entries, exportedAt: new Date().toISOString() };
  }
  function driveErrorText(err, out) {
    if (out && out.error === 'clave') return 'La clave no coincide con la del script';
    if (out && out.error) return out.error;
    if (err instanceof SyntaxError) return 'El enlace no responde bien (¿termina en /exec y el acceso es "Cualquier usuario"?)';
    return 'Sin conexión o enlace incorrecto';
  }
  async function driveCall(method, body, keepalive = false) {
    const s = state.settings;
    const url = method === 'GET'
      ? s.driveUrl + (s.driveUrl.includes('?') ? '&' : '?') + 'secret=' + encodeURIComponent(s.driveSecret)
      : s.driveUrl;
    // Sin cabeceras personalizadas → petición "simple" (text/plain), que Apps Script acepta sin CORS preflight.
    const res = await fetch(url, method === 'GET' ? {} : { method: 'POST', body, keepalive });
    let out;
    try { out = await res.json(); } catch (e) { throw new Error(driveErrorText(e)); }
    if (!out.ok) throw new Error(driveErrorText(null, out));
    return out;
  }
  function scheduleDrive(delay = 2500) {
    if (!driveOn()) return;
    clearTimeout(driveTimer);
    driveTimer = setTimeout(() => { driveTimer = null; backupToDrive(); }, delay);
  }
  async function backupToDrive(manual = false, keepalive = false) {
    if (!driveOn()) { if (manual) toast('Primero conecta tu Google Drive'); return; }
    // Nunca pisar el respaldo de Drive con una lista vacía de forma automática
    if (!state.entries.length && !manual) { drive.dirty = false; saveDrive(); renderDriveStatus(); return; }
    if (driveBusy) { scheduleDrive(3000); return; }
    if (!manual && navigator.onLine === false) { renderDriveStatus(); return; }
    driveBusy = true; drive.dirty = false;
    renderDriveStatus('⏳ Respaldando…');
    try {
      const body = JSON.stringify({ secret: state.settings.driveSecret, day: todayStr(), data: backupPayload() });
      const out = await driveCall('POST', body, keepalive && body.length < 60000);
      drive.lastOk = out.savedAt || new Date().toISOString();
      drive.lastCount = out.count; drive.lastError = null;
      if (manual) toast('☁️ Respaldo guardado en Drive');
    } catch (err) {
      drive.dirty = true; drive.lastError = err.message;
      if (manual) toast('⚠️ ' + err.message);
    } finally {
      driveBusy = false; saveDrive(); renderDriveStatus();
    }
  }
  function niceDateTime(iso) {
    const d = new Date(iso);
    const day = toStr(d) === todayStr() ? 'hoy' : toStr(d) === addDays(todayStr(), -1) ? 'ayer' : shortDate(toStr(d));
    return `${day} ${d.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })}`;
  }
  function renderDriveStatus(busyText) {
    const el = $('drive-status');
    $('drive-actions').classList.toggle('hidden', !driveOn());
    let text, cls = '';
    if (!driveOn()) text = 'Respaldo automático desactivado.';
    else if (busyText) text = busyText;
    else if (drive.lastError) {
      text = `⚠️ ${drive.lastError}. Se reintentará solo.` + (drive.lastOk ? ` Último respaldo bueno: ${niceDateTime(drive.lastOk)}.` : '');
      cls = 'err';
    } else if (drive.dirty) text = '⏳ Hay cambios pendientes de respaldar (se envían al tener internet).';
    else if (drive.lastOk) { text = `✅ Último respaldo: ${niceDateTime(drive.lastOk)} (${drive.lastCount} carros)`; cls = 'ok'; }
    else text = 'Conectado. Aún no hay respaldos.';
    el.textContent = text;
    el.className = 'drive-status small ' + cls;
    renderHeader();
  }
  function renderHeader() {
    let icon = '';
    if (driveOn()) icon = drive.lastError ? ' · ☁️⚠️' : drive.dirty ? ' · ☁️⏳' : ' · ☁️✓';
    $('today-label').textContent = `Mi %: ${state.settings.pct}%${icon}`;
  }
  async function connectDrive(ev) {
    ev.preventDefault();
    const url = $('d-url').value.trim(), secret = $('d-secret').value.trim();
    if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) { alert('El enlace debe ser el de tu Apps Script (https://script.google.com/…/exec).'); return; }
    if (!secret) { alert('Escribe la clave secreta que pusiste en el script.'); return; }
    state.settings.driveUrl = url; state.settings.driveSecret = secret;
    drive = { dirty: false, lastOk: null, lastCount: 0, lastError: null };
    save(false); saveDrive();
    renderDriveStatus('⏳ Conectando con tu Drive…');
    try {
      const remote = await driveCall('GET');
      // Si Drive tiene más carros que este teléfono (teléfono nuevo / datos borrados), ofrecer restaurar
      if (remote.data && remote.count > state.entries.length &&
          confirm(`Tu Drive tiene un respaldo con ${remote.count} carros (este teléfono tiene ${state.entries.length}).\n¿Restaurarlo en este teléfono?`)) {
        applyBackup(remote.data, false);
        drive.lastOk = remote.savedAt; drive.lastCount = remote.count;
        saveDrive(); renderDriveStatus(); toast('✅ Datos restaurados desde Drive');
        return;
      }
      toast('✅ Conectado a Google Drive');
      if (state.entries.length) await backupToDrive(true);
      else renderDriveStatus();
    } catch (err) {
      drive.lastError = err.message; saveDrive(); renderDriveStatus();
      alert('No se pudo conectar: ' + err.message);
    }
  }
  async function restoreFromDrive() {
    renderDriveStatus('⏳ Buscando respaldo en Drive…');
    try {
      const remote = await driveCall('GET');
      renderDriveStatus();
      if (!remote.data) { alert('Todavía no hay respaldos en tu Drive.'); return; }
      if (!confirm(`Respaldo de Drive del ${niceDateTime(remote.savedAt)} con ${remote.count} carros.\nEste teléfono tiene ${state.entries.length}.\n¿Reemplazar los datos de este teléfono?`)) return;
      applyBackup(remote.data, false);
      toast('✅ Datos restaurados desde Drive');
    } catch (err) { renderDriveStatus(); alert('No se pudo restaurar: ' + err.message); }
  }

  // ---------- Fechas (siempre en hora local, formato YYYY-MM-DD) ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function toStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function todayStr() { return toStr(new Date()); }
  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); }
  function weekStartOf(s) {
    const d = parse(s);
    const diff = (d.getDay() - state.settings.weekStart + 7) % 7;
    d.setDate(d.getDate() - diff);
    return toStr(d);
  }
  function niceDate(s, withYear = false) {
    const d = parse(s);
    return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}` + (withYear ? ` ${d.getFullYear()}` : '');
  }
  function shortDate(s) { const d = parse(s); return `${d.getDate()}/${pad(d.getMonth() + 1)}`; }

  // ---------- Cálculos ----------
  const round2 = n => Math.round(n * 100) / 100;
  function myCut(e) { return round2(e.price * e.pct / 100); }
  function summarize(list) {
    const s = { count: list.length, gross: 0, cut: 0, tips: 0 };
    for (const e of list) { s.gross += e.price; s.cut += myCut(e); s.tips += e.tip || 0; }
    s.gross = round2(s.gross); s.cut = round2(s.cut); s.tips = round2(s.tips);
    s.total = round2(s.cut + s.tips);
    return s;
  }
  const byDate = d => state.entries.filter(e => e.date === d);
  const inRange = (from, to) => state.entries.filter(e => e.date >= from && e.date <= to);
  function money(n) { return state.settings.currency + (n || 0).toFixed(2); }

  // ---------- Utilidades UI ----------
  const $ = id => document.getElementById(id);
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  let toastTimer;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function statsHTML(s, label = 'Me toca') {
    return `
      <div class="stat big"><div class="k">${label}</div><div class="v">${money(s.total)}</div></div>
      <div class="stat"><div class="k">Carros</div><div class="v">${s.count}</div></div>
      <div class="stat"><div class="k">Total lavados</div><div class="v">${money(s.gross)}</div></div>
      <div class="stat"><div class="k">Mi comisión</div><div class="v">${money(s.cut)}</div></div>
      <div class="stat"><div class="k">Propinas</div><div class="v">${money(s.tips)}</div></div>`;
  }
  function topValues(key, n) {
    const counts = new Map();
    for (const e of state.entries) {
      const v = e[key];
      if (v === undefined || v === '' || v === 0) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
  }
  async function copyText(text) {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ text }); return;
      }
      await navigator.clipboard.writeText(text);
      toast('📋 Resumen copiado');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      prompt('Copia el resumen:', text);
    }
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Formulario ----------
  function updatePreview() {
    const price = parseFloat($('f-price').value) || 0;
    const tip = parseFloat($('f-tip').value) || 0;
    const pct = editingId ? state.entries.find(e => e.id === editingId).pct : state.settings.pct;
    $('f-preview').textContent = price || tip
      ? `Te toca: ${money(round2(price * pct / 100))} (${pct}%) + ${money(tip)} propina = ${money(round2(price * pct / 100 + tip))}`
      : '';
  }
  function resetForm() {
    editingId = null;
    $('car-form').reset();
    $('f-date').value = viewDay;
    $('form-title').textContent = 'Agregar carro';
    $('f-submit').textContent = 'Guardar';
    $('f-cancel').classList.add('hidden');
    updatePreview();
  }
  function startEdit(id) {
    const e = state.entries.find(x => x.id === id);
    if (!e) return;
    editingId = id;
    $('f-brand').value = e.brand;
    $('f-price').value = e.price;
    $('f-tip').value = e.tip || '';
    $('f-date').value = e.date;
    $('f-note').value = e.note || '';
    $('form-title').textContent = 'Editar carro';
    $('f-submit').textContent = 'Guardar cambios';
    $('f-cancel').classList.remove('hidden');
    updatePreview();
    $('car-form').scrollIntoView({ behavior: 'smooth' });
  }
  function onSubmit(ev) {
    ev.preventDefault();
    const brand = $('f-brand').value.trim();
    const price = round2(parseFloat($('f-price').value));
    const tip = round2(parseFloat($('f-tip').value) || 0);
    const date = $('f-date').value;
    const note = $('f-note').value.trim();
    if (!brand || !(price >= 0) || !date) return;
    const prettyBrand = brand.charAt(0).toUpperCase() + brand.slice(1);

    if (editingId) {
      Object.assign(state.entries.find(e => e.id === editingId), { brand: prettyBrand, price, tip, date, note });
      toast('✏️ Carro actualizado');
    } else {
      state.entries.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date, time: new Date().toTimeString().slice(0, 5),
        brand: prettyBrand, price, tip, note, pct: state.settings.pct,
      });
      toast(`✅ ${prettyBrand} guardado`);
    }
    save();
    viewDay = date;
    resetForm();
    renderAll();
    $('f-brand').focus();
  }
  function removeEntry(id) {
    const e = state.entries.find(x => x.id === id);
    if (!e || !confirm(`¿Borrar ${e.brand} (${money(e.price)})?`)) return;
    state.entries = state.entries.filter(x => x.id !== id);
    if (editingId === id) resetForm();
    save(); renderAll(); toast('🗑️ Borrado');
  }

  // ---------- Vistas ----------
  function renderDay() {
    const list = byDate(viewDay).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    $('day-title').textContent = viewDay === todayStr() ? `Hoy · ${niceDate(viewDay)}` : niceDate(viewDay, true);
    $('day-summary').innerHTML = statsHTML(summarize(list), 'Me toca hoy');
    $('day-list').innerHTML = list.length ? list.map((e, i) => `
      <li>
        <div class="info">
          <div class="brand">${i + 1}. ${esc(e.brand)}</div>
          <div class="meta">${e.time || ''} · ${money(e.price)} × ${e.pct}%${e.tip ? ` · propina ${money(e.tip)}` : ''}${e.note ? ` · ${esc(e.note)}` : ''}</div>
        </div>
        <div class="earn">${money(myCut(e) + (e.tip || 0))}</div>
        <div class="actions">
          <button data-edit="${e.id}" aria-label="Editar">✏️</button>
          <button data-del="${e.id}" aria-label="Borrar">🗑️</button>
        </div>
      </li>`).join('') : '<li class="empty">Sin carros registrados este día</li>';
  }

  function weekText(from, to) {
    const s = summarize(inRange(from, to));
    const lines = [`🚗 Semana ${shortDate(from)} al ${shortDate(to)}`];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ds = summarize(byDate(d));
      if (ds.count) lines.push(`${DAYS[parse(d).getDay()]} ${shortDate(d)}: ${ds.count} carros · ${money(ds.total)}`);
    }
    lines.push('', `Carros: ${s.count}`, `Total lavados: ${money(s.gross)}`,
      `Mi comisión: ${money(s.cut)}`, `Propinas: ${money(s.tips)}`, `💰 Me toca: ${money(s.total)}`);
    return lines.join('\n');
  }
  function renderWeek() {
    const from = weekStartOf(viewWeek), to = addDays(from, 6);
    $('week-title').textContent = `${shortDate(from)} — ${shortDate(to)}`;
    const payday = (() => { // primer domingo desde el fin de semana
      let d = to; while (parse(d).getDay() !== 0) d = addDays(d, 1); return d;
    })();
    $('week-payday').textContent = `Día de pago: ${niceDate(payday)}`;
    $('week-summary').innerHTML = statsHTML(summarize(inRange(from, to)), 'Pago de la semana');
    let rows = '';
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const s = summarize(byDate(d));
      rows += `<tr class="${d === todayStr() ? 'today' : ''}" data-goto="${d}">
        <td>${DAYS[parse(d).getDay()].slice(0, 3)} ${shortDate(d)}</td>
        <td>${s.count}</td><td>${money(s.cut)}</td><td>${money(s.tips)}</td><td>${money(s.total)}</td></tr>`;
    }
    const t = summarize(inRange(from, to));
    $('week-table').innerHTML = `
      <thead><tr><th>Día</th><th>Carros</th><th>Comisión</th><th>Propina</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Semana</td><td>${t.count}</td><td>${money(t.cut)}</td><td>${money(t.tips)}</td><td>${money(t.total)}</td></tr></tfoot>`;
  }

  function monthRange(ym) {
    const [y, m] = ym.split('-').map(Number);
    return [`${ym}-01`, toStr(new Date(y, m, 0))];
  }
  function monthText(ym) {
    const [from, to] = monthRange(ym);
    const s = summarize(inRange(from, to));
    const [y, m] = ym.split('-').map(Number);
    return [`🚗 Resumen de ${MONTHS[m - 1]} ${y}`, `Carros: ${s.count}`, `Total lavados: ${money(s.gross)}`,
      `Mi comisión: ${money(s.cut)}`, `Propinas: ${money(s.tips)}`, `💰 Ganado: ${money(s.total)}`].join('\n');
  }
  function renderMonth() {
    const [from, to] = monthRange(viewMonth);
    const [y, m] = viewMonth.split('-').map(Number);
    $('month-title').textContent = `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${y}`;
    const list = inRange(from, to);
    $('month-summary').innerHTML = statsHTML(summarize(list), 'Ganado en el mes');

    // Semanas (solo los días que caen dentro del mes)
    let rows = '';
    for (let ws = weekStartOf(from); ws <= to; ws = addDays(ws, 7)) {
      const a = ws < from ? from : ws, b = addDays(ws, 6) > to ? to : addDays(ws, 6);
      const s = summarize(inRange(a, b));
      rows += `<tr data-week="${a}"><td>${shortDate(a)} — ${shortDate(b)}</td><td>${s.count}</td><td>${money(s.total)}</td></tr>`;
    }
    $('month-weeks').innerHTML = `<thead><tr><th>Semana</th><th>Carros</th><th>Me toca</th></tr></thead><tbody>${rows}</tbody>`;

    // Marcas
    const brands = new Map();
    for (const e of list) {
      const b = brands.get(e.brand) || { n: 0, gross: 0 };
      b.n++; b.gross += e.price; brands.set(e.brand, b);
    }
    const brandRows = [...brands.entries()].sort((a, b) => b[1].n - a[1].n)
      .map(([name, b]) => `<tr><td>${esc(name)}</td><td>${b.n}</td><td>${money(b.gross)}</td></tr>`).join('');
    $('month-brands').innerHTML = brandRows
      ? `<thead><tr><th>Marca</th><th>Carros</th><th>Total lavado</th></tr></thead><tbody>${brandRows}</tbody>`
      : '<tbody><tr><td class="muted">Sin datos este mes</td></tr></tbody>';
  }

  function renderChips() {
    const brands = topValues('brand', 8);
    $('brand-list').innerHTML = brands.map(b => `<option value="${esc(b)}">`).join('');
    $('brand-chips').innerHTML = brands.map(b => `<button type="button" class="chip" data-brand="${esc(b)}">${esc(b)}</button>`).join('');
    $('price-chips').innerHTML = topValues('price', 5).sort((a, b) => a - b)
      .map(p => `<button type="button" class="chip" data-price="${p}">${money(p)}</button>`).join('');
  }

  function renderSettings() {
    $('s-pct').value = state.settings.pct;
    $('s-weekstart').value = state.settings.weekStart;
    $('s-currency').value = state.settings.currency;
    $('s-apply-all').checked = false;
    $('d-url').value = state.settings.driveUrl;
    $('d-secret').value = state.settings.driveSecret;
    renderDriveStatus();
  }

  function renderAll() {
    renderHeader();
    renderDay(); renderWeek(); renderMonth(); renderChips(); updatePreview();
  }

  function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${name}`));
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'ajustes') renderSettings();
    window.scrollTo(0, 0);
  }

  // ---------- Exportar / importar ----------
  function exportCSV() {
    const head = ['Fecha', 'Hora', 'Marca', 'Precio', 'Porcentaje', 'Mi comision', 'Propina', 'Total para mi', 'Nota'];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [...state.entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(e => [e.date, e.time, e.brand, e.price, e.pct, myCut(e), e.tip || 0, round2(myCut(e) + (e.tip || 0)), e.note].map(q).join(';'));
    download(`carros-lavados-${todayStr()}.csv`, '﻿' + [head.map(q).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    download(`respaldo-carros-${todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json');
  }
  // Reemplaza los datos por los de un respaldo, conservando la conexión a Drive de este teléfono.
  function applyBackup(data, backup) {
    const cur = state.settings, old = data.settings || {};
    state = {
      settings: { ...DEFAULTS, ...old, driveUrl: cur.driveUrl || old.driveUrl || '', driveSecret: cur.driveSecret || old.driveSecret || '' },
      entries: data.entries,
    };
    save(backup); renderSettings(); renderAll();
  }
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.entries)) throw new Error('formato');
        if (!confirm(`El respaldo tiene ${data.entries.length} carros. ¿Reemplazar los datos actuales?`)) return;
        applyBackup(data, true); toast('✅ Respaldo restaurado');
      } catch (e) { alert('El archivo no es un respaldo válido.'); }
    };
    reader.readAsText(file);
  }

  // ---------- Eventos ----------
  function bind() {
    $('car-form').addEventListener('submit', onSubmit);
    $('f-cancel').addEventListener('click', resetForm);
    ['f-price', 'f-tip'].forEach(id => $(id).addEventListener('input', updatePreview));

    $('brand-chips').addEventListener('click', e => {
      const b = e.target.dataset.brand; if (b) { $('f-brand').value = b; $('f-price').focus(); }
    });
    $('price-chips').addEventListener('click', e => {
      const p = e.target.dataset.price; if (p) { $('f-price').value = p; updatePreview(); }
    });
    $('day-list').addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.edit) startEdit(btn.dataset.edit);
      if (btn.dataset.del) removeEntry(btn.dataset.del);
    });

    $('day-prev').onclick = () => { viewDay = addDays(viewDay, -1); if (!editingId) $('f-date').value = viewDay; renderDay(); };
    $('day-next').onclick = () => { viewDay = addDays(viewDay, 1); if (!editingId) $('f-date').value = viewDay; renderDay(); };
    $('week-prev').onclick = () => { viewWeek = addDays(viewWeek, -7); renderWeek(); };
    $('week-next').onclick = () => { viewWeek = addDays(viewWeek, 7); renderWeek(); };
    const shiftMonth = n => {
      const [y, m] = viewMonth.split('-').map(Number);
      viewMonth = toStr(new Date(y, m - 1 + n, 1)).slice(0, 7); renderMonth();
    };
    $('month-prev').onclick = () => shiftMonth(-1);
    $('month-next').onclick = () => shiftMonth(1);

    // Tocar un día en la semana → ver ese día; tocar una semana en el mes → ver esa semana
    $('week-table').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-goto]'); if (!tr) return;
      viewDay = tr.dataset.goto; $('f-date').value = viewDay; renderDay(); showTab('hoy');
    });
    $('month-weeks').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-week]'); if (!tr) return;
      viewWeek = tr.dataset.week; renderWeek(); showTab('semana');
    });

    $('week-share').onclick = () => { const f = weekStartOf(viewWeek); copyText(weekText(f, addDays(f, 6))); };
    $('month-share').onclick = () => copyText(monthText(viewMonth));

    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

    $('settings-form').addEventListener('submit', e => {
      e.preventDefault();
      const pct = parseFloat($('s-pct').value);
      if (!(pct >= 0 && pct <= 100)) { alert('El porcentaje debe estar entre 0 y 100'); return; }
      state.settings.pct = pct;
      state.settings.weekStart = Number($('s-weekstart').value);
      state.settings.currency = $('s-currency').value.trim() || '$';
      if ($('s-apply-all').checked) {
        if (!confirm(`¿Cambiar a ${pct}% TODOS los carros ya registrados (${state.entries.length})?`)) return;
        state.entries.forEach(x => { x.pct = pct; });
      }
      save(); renderSettings(); renderAll(); toast('✅ Ajustes guardados');
    });

    $('export-csv').onclick = exportCSV;
    $('export-json').onclick = exportJSON;
    $('import-json').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
    $('wipe').onclick = () => {
      if (!confirm('¿Borrar TODOS los carros registrados? Esto no se puede deshacer.')) return;
      if (!confirm('¿Seguro? Te recomiendo descargar un respaldo antes.')) return;
      state.entries = []; save(); renderAll(); toast('Datos borrados');
    };

    // Google Drive
    $('drive-form').addEventListener('submit', connectDrive);
    $('drive-now').onclick = () => {
      if (!state.entries.length && !confirm('No hay carros en este teléfono. ¿Enviar un respaldo vacío a Drive?')) return;
      backupToDrive(true);
    };
    $('drive-restore').onclick = restoreFromDrive;
    $('drive-off').onclick = () => {
      if (!confirm('¿Desconectar el respaldo automático? Tus archivos en Drive no se borran.')) return;
      state.settings.driveUrl = ''; state.settings.driveSecret = '';
      drive = { dirty: false, lastOk: null, lastCount: 0, lastError: null };
      save(false); saveDrive(); renderSettings(); toast('Respaldo automático desactivado');
    };
    window.addEventListener('online', () => { if (drive.dirty) scheduleDrive(1000); });
    document.addEventListener('visibilitychange', () => {
      if (!driveOn()) return;
      if (document.visibilityState === 'hidden' && driveTimer) {
        // Al cerrar o minimizar la app, enviar ya lo pendiente
        clearTimeout(driveTimer); driveTimer = null; backupToDrive(false, true);
      } else if (document.visibilityState === 'visible' && drive.dirty) scheduleDrive(1000);
    });

    // Si la app queda abierta y cambia el día, volver a "hoy"
    let lastToday = todayStr();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && todayStr() !== lastToday) {
        lastToday = viewDay = viewWeek = todayStr(); viewMonth = lastToday.slice(0, 7);
        if (!editingId) $('f-date').value = viewDay;
        renderAll();
      }
    });
  }

  // ---------- Inicio ----------
  bind();
  resetForm();
  renderAll();
  renderSettings();
  if (drive.dirty) scheduleDrive(1500);
  // Pedir al navegador que no borre los datos de la app por falta de espacio
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
