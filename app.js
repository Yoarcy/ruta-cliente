const STORAGE_KEY = 'rutaCliente.clients.v1';
const SUPABASE_URL = 'https://tlhtudtxygfagpenghbo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YucTepmrIvv3UcJUOZ5yOg_o5ijeQjZ';
const SUPABASE_TABLE = 'clientes';
const $ = (id) => document.getElementById(id);
let clients = loadClients();
let cloudReady = Boolean(SUPABASE_URL && SUPABASE_KEY);
let searchTimer = null;

const screens = document.querySelectorAll('.screen');
document.querySelectorAll('[data-go]').forEach((btn) => btn.addEventListener('click', () => showScreen(btn.dataset.go)));
$('gpsBtn')?.addEventListener('click', captureGps);
$('clientForm')?.addEventListener('submit', saveClient);
$('clearFormBtn')?.addEventListener('click', clearForm);
$('searchInput').addEventListener('input', scheduleSearch);
document.addEventListener('click', (event) => {
  const btn = event.target.closest('.mapsme-btn');
  if (!btn) return;
  event.preventDefault();
  openMapsMe(btn.dataset.clientId);
});
$('dialogClose').addEventListener('click', () => $('messageDialog').close());
$('dialogAction')?.addEventListener('click', () => {
  const action = $('dialogAction').dataset.action;
  $('messageDialog').close();
  if (action === 'app-settings') openAppSettings();
  if (action === 'location-settings') openLocationSettings();
});
$('topMenuBtn')?.addEventListener('click', () => $('topMenuDialog').showModal());
$('topMenuClose')?.addEventListener('click', () => $('topMenuDialog').close());
$('cloudDescriptionCancel')?.addEventListener('click', () => $('cloudDescriptionDialog').close());
$('cloudDescriptionSave')?.addEventListener('click', uploadJamazonToCloudAfterDescription);

refreshStats();
renderResults();
loadCloudSummary();

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
  if (id === 'search') setTimeout(() => $('searchInput').focus(), 80);
}

function loadClients() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function persist(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  refreshStats(options.statusText);
  if (!options.skipRender) renderResults();
}
function refreshStats(statusText) {
  $('totalClients').textContent = clients.length;
  if ($('menuTotalClients')) $('menuTotalClients').textContent = clients.length;
  const label = statusText || (cloudReady ? 'Nube' : 'Local');
  if ($('lastSync')) $('lastSync').textContent = label;
  if ($('menuDbStatus')) $('menuDbStatus').textContent = label;
}
function normalize(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function showMessage(title, text, action) {
  $('dialogTitle').textContent = title;
  $('dialogText').textContent = text;
  const actionBtn = $('dialogAction');
  if (actionBtn) {
    if (action) {
      actionBtn.textContent = action.label;
      actionBtn.dataset.action = action.id;
      actionBtn.hidden = false;
    } else {
      actionBtn.textContent = '';
      actionBtn.dataset.action = '';
      actionBtn.hidden = true;
    }
  }
  $('messageDialog').showModal();
}
function captureGps() {
  if (!navigator.geolocation) return showMessage('GPS no disponible', 'Este equipo no permite capturar ubicación GPS.', { id: 'location-settings', label: 'Abrir ubicación' });
  $('gpsStatus').textContent = 'Buscando ubicación actual...';
  $('gpsBtn').disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $('latitude').value = pos.coords.latitude.toFixed(7);
      $('longitude').value = pos.coords.longitude.toFixed(7);
      $('gpsStatus').textContent = `Ubicación capturada. Precisión aproximada: ${Math.round(pos.coords.accuracy)} m.`;
      $('gpsBtn').disabled = false;
    },
    (error) => {
      $('gpsBtn').disabled = false;
      $('gpsStatus').textContent = 'No se pudo capturar el GPS. Revisa permisos o escribe las coordenadas manualmente.';
      const denied = error && error.code === 1;
      showMessage(
        denied ? 'Permiso de ubicación' : 'GPS no disponible',
        denied
          ? 'Activa la ubicación para Ruta Cliente. Toca “Abrir ajustes”, entra en Permisos > Ubicación y marca “Permitir solo mientras se usa la app”.'
          : 'Activa el GPS del teléfono y vuelve a intentar. Si estás dentro de una casa, acércate a una ventana.',
        { id: denied ? 'app-settings' : 'location-settings', label: denied ? 'Abrir ajustes' : 'Abrir ubicación' }
      );
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}
function openAppSettings() {
  try {
    if (window.RutaClienteAndroid?.openAppSettings) return window.RutaClienteAndroid.openAppSettings();
    window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:com.drex.rutacliente;end';
  } catch (error) {
    showMessage('Ajustes de la app', 'Abre Ajustes de Android > Apps > Ruta Cliente > Permisos > Ubicación y marca permitir.');
  }
}
function openLocationSettings() {
  try {
    if (window.RutaClienteAndroid?.openLocationSettings) return window.RutaClienteAndroid.openLocationSettings();
    window.location.href = 'intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;end';
  } catch (error) {
    showMessage('Ubicación del teléfono', 'Activa la ubicación/GPS desde los ajustes rápidos del teléfono y vuelve a intentar.');
  }
}
async function saveClient(event) {
  event.preventDefault();
  const lat = Number($('latitude').value.replace(',', '.'));
  const lon = Number($('longitude').value.replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return showMessage('Coordenadas inválidas', 'Revisa latitud y longitud antes de guardar.');

  const id = $('clientId').value || crypto.randomUUID();
  const existing = clients.findIndex((client) => client.id === id);
  const client = {
    id,
    fullName: $('fullName').value.trim(),
    identity: $('identity').value.trim(),
    phone: $('identity').value.trim(),
    description: $('description').value.trim(),
    latitude: lat,
    longitude: lon,
    updatedAt: new Date().toISOString(),
  };
  if (existing >= 0) clients[existing] = client;
  else clients.unshift(client);
  persist();

  const savedInCloud = await saveCloudClient(client, existing >= 0);
  clearForm();
  showMessage(
    'Cliente guardado',
    savedInCloud
      ? 'La información quedó guardada en la nube y también en este dispositivo.'
      : 'La información quedó guardada en este dispositivo. La nube queda pendiente hasta completar la clave pública de Supabase.'
  );
  showScreen('home');
}
function clearForm() {
  $('clientForm').reset();
  $('clientId').value = '';
  $('gpsStatus').textContent = 'Puedes capturar por GPS o escribir/ajustar las coordenadas manualmente.';
}
function editClient(id) {
  const client = clients.find((item) => item.id === id);
  if (!client) return;
  $('clientId').value = client.id;
  $('fullName').value = client.fullName;
  $('identity').value = client.identity;
  $('description').value = client.description || '';
  $('latitude').value = client.latitude;
  $('longitude').value = client.longitude;
  showScreen('capture');
}
async function deleteClient(id) {
  const client = clients.find((item) => item.id === id);
  if (!client) return;
  if (!confirm(`¿Borrar a ${client.fullName}?`)) return;
  clients = clients.filter((item) => item.id !== id);
  persist();
  await deleteCloudClient(id);
}
function scheduleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchClients, 230);
}
async function searchClients() {
  const query = normalize($('searchInput').value);
  if (!query) {
    clients = loadClients();
    renderResults();
    return;
  }
  if (cloudReady) {
    $('results').innerHTML = emptyState('Buscando coincidencias en la nube...');
    const cloudResults = await searchCloudClients(query);
    if (cloudResults) clients = cloudResults;
  }
  renderResults();
}
function renderResults() {
  const query = normalize($('searchInput').value);
  const results = $('results');
  if (!query) {
    results.innerHTML = emptyState('Escribe parte del nombre para buscar clientes. No se cargará la lista completa.');
    return;
  }
  const list = clients
    .filter((client) => normalize(client.fullName).includes(query))
    .slice(0, 20);
  if (!list.length) {
    results.innerHTML = emptyState('Ese cliente no existe aún en la base de datos.');
    return;
  }
  results.innerHTML = list.map((client) => `
    <article class="result-card">
      <div class="result-top">
        <div>
          <h3>${escapeHtml(client.fullName)}</h3>
          <small>Teléfono: ${escapeHtml(client.phone || client.identity || '-')}</small>
        </div>
        <span class="badge">GPS</span>
      </div>
      ${client.description ? `<p class="hint">${escapeHtml(client.description)}</p>` : ''}
      <div class="result-actions">
        <button type="button" class="primary-btn mapsme-btn" data-client-id="${client.id}" aria-label="Abrir en MAPS.ME" title="Abrir en MAPS.ME">
          <span class="mapsme-like-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#mwmBg)"/>
              <path d="M16 25s7-6.15 7-12.1A7 7 0 0 0 9 12.9C9 18.85 16 25 16 25Z" fill="white" fill-opacity=".96"/>
              <circle cx="16" cy="12.8" r="2.65" fill="#1c8cff"/>
              <path d="M10.5 22.3c1.55 1.15 3.35 1.72 5.5 1.72s3.95-.57 5.5-1.72" stroke="#dff7ff" stroke-width="1.45" stroke-linecap="round" opacity=".95"/>
              <defs>
                <linearGradient id="mwmBg" x1="5" y1="4" x2="28" y2="29" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#27E0FF"/>
                  <stop offset=".52" stop-color="#168BFF"/>
                  <stop offset="1" stop-color="#2457E8"/>
                </linearGradient>
              </defs>
            </svg>
          </span>
        </button>
        <button class="ghost" onclick="editClient('${client.id}')">Modificar</button>
        <button class="danger-btn" onclick="deleteClient('${client.id}')">Borrar</button>
      </div>
    </article>`).join('');
}
function emptyState(text) {
  return `<article class="result-card"><h3>Sin resultados</h3><p class="hint">${text}</p><button class="ghost" onclick="showScreen('home')">Regresar al principio</button></article>`;
}
function openMapsMe(id) {
  const client = clients.find((item) => item.id === id);
  if (!client) return showMessage('Cliente no encontrado', 'No pude encontrar ese cliente en la base local.');
  const label = encodeURIComponent(client.fullName);
  const lat = String(client.latitude).replace(',', '.');
  const lon = String(client.longitude).replace(',', '.');
  const geoUrl = `geo:${lat},${lon}?q=${lat},${lon}(${label})`;
  const fallbackUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;

  window.location.href = geoUrl;

  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      showMessage('Abrir mapa', 'Si estás en PC puede que MAPS.ME no abra enlaces geo:. En Android debe abrir con MAPS.ME si está instalado.');
      console.info('Fallback mapa:', fallbackUrl);
    }
  }, 900);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}
function toDbClient(client) {
  return {
    id: client.id,
    nombre_completo: client.fullName,
    telefono: client.phone || client.identity || '',
    descripcion: client.description || '',
    latitud: client.latitude,
    longitud: client.longitude,
  };
}
function fromDbClient(row) {
  return {
    id: row.id,
    fullName: row.nombre_completo,
    identity: row.telefono || row.identidad || '',
    phone: row.telefono || row.identidad || '',
    description: row.descripcion || '',
    latitude: row.latitud,
    longitude: row.longitud,
    updatedAt: row.actualizado_en || row.creado_en || new Date().toISOString(),
  };
}
async function loadCloudSummary() {
  if (!cloudReady) {
    refreshStats('Local');
    return;
  }
  refreshStats('Nube');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=id`, {
      method: 'HEAD',
      headers: supabaseHeaders({ Prefer: 'count=exact' }),
    });
    const total = response.headers.get('content-range')?.split('/')?.[1];
    if (total && total !== '*') {
      $('totalClients').textContent = total;
      if ($('menuTotalClients')) $('menuTotalClients').textContent = total;
    }
  } catch (error) {
    console.error('Error leyendo resumen Supabase:', error);
    refreshStats('Local');
  }
}
async function searchCloudClients(query) {
  if (!cloudReady) return null;
  try {
    const safeQuery = encodeURIComponent(`*${query.replace(/[,*()]/g, ' ')}*`);
    const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=*&nombre_completo=ilike.${safeQuery}&order=nombre_completo.asc&limit=20`;
    const response = await fetch(url, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(await response.text());
    refreshStats('Nube');
    return (await response.json()).map(fromDbClient);
  } catch (error) {
    console.error('Error buscando en Supabase:', error);
    refreshStats('Local');
    return null;
  }
}
async function saveCloudClient(client, exists) {
  if (!cloudReady) return false;
  try {
    const method = exists ? 'PATCH' : 'POST';
    const url = exists
      ? `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(client.id)}`
      : `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
    const response = await fetch(url, {
      method,
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(toDbClient(client)),
    });
    if (!response.ok) throw new Error(await response.text());
    refreshStats('Nube');
    return true;
  } catch (error) {
    console.error('Error guardando en Supabase:', error);
    refreshStats('Local');
    return false;
  }
}
async function deleteCloudClient(id) {
  if (!cloudReady) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    });
    if (!response.ok) throw new Error(await response.text());
    refreshStats('Nube');
    return true;
  } catch (error) {
    console.error('Error borrando en Supabase:', error);
    refreshStats('Local');
    return false;
  }
}

// --- Jamazon Call web module inside Ruta Cliente / MessPro ---
const JAMAZON_STORAGE_KEY = 'messpro.jamazon.rows.v1';
const JAMAZON_META_KEY = 'messpro.jamazon.meta.v1';
const JAMAZON_PENDING_KEY = 'messpro.jamazon.pendingCloud.v1';
const JAMAZON_TOWN_FILTER_KEY = 'messpro.jamazon.townFilter.v1';
let jamazonRows = loadJamazonRows();
let jamazonMeta = loadJamazonMeta();
let jamazonSelected = null;
let jamazonGps = null;
let jamazonPendingCloud = loadJamazonPendingCloud();
let jamazonSearchTimer = null;

initJamazonModule();

function initJamazonModule() {
  if (!$('jamazonExcel')) return;
  $('jamazonExcel').addEventListener('change', importJamazonExcel);
  const savedTownFilter = loadJamazonTownFilter();
  if ($('jamazonTownFilter') && savedTownFilter) $('jamazonTownFilter').value = savedTownFilter;
  $('jamazonSearch').addEventListener('input', scheduleJamazonSearch);
  $('jamazonTownFilter')?.addEventListener('input', handleJamazonTownInput);
  $('jamazonTownFilter')?.addEventListener('change', handleJamazonTownInput);
  $('jamazonTownSelect')?.addEventListener('change', handleJamazonTownSelect);
  $('jamazonMatches')?.addEventListener('click', handleJamazonCardClick);
  $('jzCallBtn')?.addEventListener('click', callJamazonClient);
  $('jzSmsBtn')?.addEventListener('click', smsJamazonClient);
  $('jzGpsBtn')?.addEventListener('click', captureJamazonGps);
  $('jzCloudBtn')?.addEventListener('click', saveJamazonToCloud);
  $('jzSendMessageBtn')?.addEventListener('click', prepareJamazonMessage);
  $('jzMessageText')?.addEventListener('input', updateJamazonSmsCounter);
  updateJamazonSmsCounter();
  renderJamazonFileState();
  renderJamazonSummary();
  renderJamazonMatches();
  window.addEventListener('online', flushJamazonPendingCloud);
  window.addEventListener('focus', continueJamazonSmsQueue);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) continueJamazonSmsQueue(); });
  document.addEventListener('pointerdown', closeJamazonMessageBoxOnOutsideTap);
  flushJamazonPendingCloud();
}

const JAMAZON_MUNICIPIOS = [
  'Arroyo Naranjo', 'Boyeros', 'Centro Habana', 'Cerro', 'Cotorro', 'Diez de Octubre', 'Guanabacoa', 'Habana del Este', 'Habana Vieja', 'La Lisa', 'Marianao', 'Playa', 'Plaza de la Revolución', 'Regla', 'San Miguel del Padrón',
  'Alquízar', 'Artemisa', 'Bahía Honda', 'Bauta', 'Caimito', 'Candelaria', 'Guanajay', 'Güira de Melena', 'Mariel', 'San Antonio de los Baños', 'San Cristóbal',
  'Batabanó', 'Bejucal', 'Güines', 'Jaruco', 'Madruga', 'Melena del Sur', 'Nueva Paz', 'Quivicán', 'San José de las Lajas', 'San Nicolás', 'Santa Cruz del Norte'
];
function loadJamazonTownFilter() {
  try { return localStorage.getItem(JAMAZON_TOWN_FILTER_KEY) || ''; }
  catch { return ''; }
}
function persistJamazonTownFilter() {
  try { localStorage.setItem(JAMAZON_TOWN_FILTER_KEY, $('jamazonTownFilter')?.value || ''); }
  catch (error) { console.error('No se pudo guardar filtro de municipios:', error); }
}
function handleJamazonTownSelect(event) {
  const town = event.target.value;
  if (!town) return;
  const input = $('jamazonTownFilter');
  const current = input.value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  if (!current.some((item) => normalize(item) === normalize(town))) current.push(town);
  input.value = current.join('; ') + '; ';
  event.target.value = '';
  persistJamazonTownFilter();
  scheduleJamazonSearch();
}
function handleJamazonTownInput(event) {
  const input = event.target;
  const value = input.value;
  const parts = value.split(/[;,]/);
  const last = (parts.pop() || '').trim();
  const exact = JAMAZON_MUNICIPIOS.find((town) => normalize(town) === normalize(last));
  if (exact && !/[;,]\s*$/.test(value)) {
    const previous = parts.map((item) => item.trim()).filter(Boolean);
    const next = previous.concat(exact).join('; ') + '; ';
    input.value = next;
  }
  scheduleJamazonSearch();
}
function closeJamazonMessageBoxOnOutsideTap(event) {
  const box = document.querySelector('.jamazon-message-box[open]');
  if (!box) return;
  if (box.contains(event.target)) return;
  box.open = false;
}
function scheduleJamazonSearch() {
  jamazonSelected = null;
  jamazonGps = null;
  if ($('jamazonSelected')) $('jamazonSelected').hidden = true;
  if ($('jamazonMatches')) $('jamazonMatches').hidden = false;
  if ($('jzGpsStatus')) $('jzGpsStatus').textContent = 'Selecciona cliente y captura GPS antes de guardar en nube.';
  clearTimeout(jamazonSearchTimer);
  jamazonSearchTimer = setTimeout(renderJamazonMatches, 180);
}
function loadJamazonRows() {
  try { return JSON.parse(localStorage.getItem(JAMAZON_STORAGE_KEY)) || []; }
  catch { return []; }
}
function loadJamazonMeta() {
  try { return JSON.parse(localStorage.getItem(JAMAZON_META_KEY)) || {}; }
  catch { return {}; }
}
function loadJamazonPendingCloud() {
  try { return JSON.parse(localStorage.getItem(JAMAZON_PENDING_KEY)) || []; }
  catch { return []; }
}
function renderJamazonFileState() {
  const label = $('jamazonFileName');
  if (!label) return;
  if (jamazonRows.length) {
    const names = Array.isArray(jamazonMeta?.files) && jamazonMeta.files.length
      ? jamazonMeta.files.map((file) => file.name).join(', ')
      : (jamazonMeta?.fileName || jamazonRows[0]?.fuente || 'Excel guardado');
    label.textContent = `${names} · ${jamazonRows.length} órdenes cargadas`;
  } else {
    label.textContent = 'Ningún Excel cargado';
  }
}
function persistJamazonMeta() {
  localStorage.setItem(JAMAZON_META_KEY, JSON.stringify(jamazonMeta || {}));
}
function persistJamazonPendingCloud() {
  localStorage.setItem(JAMAZON_PENDING_KEY, JSON.stringify(jamazonPendingCloud));
}
function persistJamazonRows() {
  try {
    localStorage.setItem(JAMAZON_STORAGE_KEY, JSON.stringify(jamazonRows));
    persistJamazonMeta();
  } catch (error) {
    console.error('No se pudo guardar el Excel localmente:', error);
    showMessage('Excel cargado solo temporalmente', 'El teléfono no dejó guardar este Excel para reabrirlo después. Si pasa de nuevo, avísame para dividir/optimizar la base.');
  }
}
async function importJamazonExcel(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  $('jamazonFileName').textContent = files.length === 1 ? files[0].name : `${files.length} archivos seleccionados`;
  try {
    const importedRows = [];
    const importedFiles = [];
    for (const file of files) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const parsed = parseJamazonRows(rows, files.length > 1 ? `${file.name} / ${sheetName}` : file.name);
        importedRows.push(...parsed);
      }
      importedFiles.push({ name: file.name, importedAt: new Date().toISOString() });
    }
    jamazonRows = importedRows;
    jamazonMeta = { fileName: importedFiles.map((file) => file.name).join(', '), files: importedFiles, importedAt: new Date().toISOString(), rows: jamazonRows.length };
    persistJamazonRows();
    jamazonSelected = null;
    jamazonGps = null;
    if ($('jamazonSelected')) $('jamazonSelected').hidden = true;
    if ($('jamazonMatches')) $('jamazonMatches').hidden = false;
    renderJamazonFileState();
    renderJamazonSummary();
    renderJamazonMatches();
    showMessage('Excel importado', `Se cargaron ${jamazonRows.length} órdenes desde ${files.length} archivo(s).`);
  } catch (error) {
    console.error(error);
    showMessage('Error importando Excel', error.message || 'No pude leer ese archivo.');
  } finally {
    event.target.value = '';
  }
}
function parseJamazonRows(rows, sourceName) {
  let headerIndex = -1;
  let headers = [];
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const normalized = rows[i].map(normalizeJamazonHeader);
    if (normalized.includes('numero') || normalized.includes('telefono') || normalized.includes('nombre') || normalized.includes('id_excel')) {
      headerIndex = i;
      headers = normalized;
      break;
    }
  }
  if (headerIndex < 0) throw new Error('No encontré encabezados útiles en el Excel.');
  const out = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const item = { fuente: sourceName };
    row.forEach((value, index) => {
      const key = headers[index];
      if (!key) return;
      item[key] = cleanJamazonCell(value);
    });
    if (!item.numero && !item.telefono && !item.nombre && !item.id_excel) continue;
    item.numero = item.numero || '';
    item.id_excel = item.id_excel || '';
    item.municipio = item.municipio || '';
    item.direccion = item.direccion || '';
    item.telefono = item.telefono || '';
    item.nombre = item.nombre || '';
    item.peso = item.peso || '';
    item.descripcion = item.descripcion || '';
    out.push(item);
  }
  return out;
}
function normalizeJamazonHeader(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === '#') return 'numero';
  const s = normalize(value).replace(/[\s_\-.:#]/g, '');
  if (['id', 'identificador', 'factura'].includes(s)) return 'id_excel';
  if (['numero', 'no', 'nro', 'orden', 'num', 'numeroorden'].includes(s)) return 'numero';
  if (['telefono', 'telef', 'celular', 'phone'].includes(s)) return 'telefono';
  if (['direccion', 'dir'].includes(s)) return 'direccion';
  if (['municipio', 'ciudad'].includes(s)) return 'municipio';
  if (['nombre', 'nombredeldestinatario', 'cliente', 'destinatario'].includes(s)) return 'nombre';
  if (['peso', 'pesolb', 'pesolbs', 'libras'].includes(s)) return 'peso';
  if (['descripcion', 'referencia', 'nota', 'notas'].includes(s)) return 'descripcion';
  return s;
}
function cleanJamazonCell(value) {
  let text = String(value ?? '').trim();
  if (text.endsWith('.0')) text = text.slice(0, -2);
  return text;
}
function renderJamazonSummary() {
  if (!$('jamazonSummary')) return;
  const totalWeight = jamazonRows.reduce((sum, row) => sum + parseJamazonWeight(row.peso), 0);
  const byTown = new Map();
  for (const row of jamazonRows) {
    const town = row.municipio || 'Sin municipio';
    const current = byTown.get(town) || { count: 0, weight: 0 };
    current.count += 1;
    current.weight += parseJamazonWeight(row.peso);
    byTown.set(town, current);
  }
  let text = `Clientes: ${jamazonRows.length} | Peso total: ${formatJamazonWeight(totalWeight)}`;
  if (jamazonPendingCloud.length) text += `\nPendientes de nube: ${jamazonPendingCloud.length}`;
  if (byTown.size) {
    text += '\nClientes y peso por municipio:';
    for (const [town, data] of byTown) text += `\n- ${town}: ${data.count} clientes | Peso: ${formatJamazonWeight(data.weight)}`;
  }
  $('jamazonSummary').textContent = text;
}
function parseJamazonWeight(value) {
  const n = Number(String(value || '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
function formatJamazonWeight(value) {
  return Number(value || 0).toLocaleString('es', { maximumFractionDigits: 2 });
}
function renderJamazonMatches() {
  const box = $('jamazonMatches');
  if (!box) return;
  box.hidden = false;
  const query = $('jamazonSearch').value.trim();
  if (!jamazonRows.length) {
    box.innerHTML = emptyState('Importa primero el Excel del día.');
    return;
  }
  if (!query) {
    box.innerHTML = emptyState('Escribe número o nombre para buscar.');
    return;
  }
  const scopedRows = getJamazonRowsForTownFilter();
  if (!scopedRows.length) {
    box.innerHTML = emptyState('No encontré órdenes para ese municipio.');
    return;
  }
  const matches = searchJamazonRows(query, scopedRows).slice(0, 50);
  if (!matches.length) {
    box.innerHTML = emptyState('No encontré coincidencias en el municipio/Excel cargado.');
    return;
  }
  box.innerHTML = matches.map((row) => renderJamazonCard(row, false)).join('');
}
function getJamazonRowsForTownFilter() {
  const raw = $('jamazonTownFilter')?.value || '';
  const towns = raw.split(/[;,]/).map((item) => normalize(item)).filter(Boolean);
  if (!towns.length) return jamazonRows;
  return jamazonRows.filter((row) => {
    const town = normalize(row.municipio || '');
    return towns.some((wanted) => town.includes(wanted));
  });
}
function searchJamazonRows(query, rows = jamazonRows) {
  const q = String(query || '').trim();
  const qNorm = normalize(q);
  const qCompact = qNorm.replace(/\s+/g, '');
  const qDigits = q.replace(/\D/g, '');
  const isNumericQuery = !!qDigits && qDigits.length === q.replace(/\s+/g, '').length;
  const numeroExact = [];
  const numeroPrefix = [];
  const facturaExact = [];
  const factura4 = [];
  const nameMatches = [];

  for (const row of rows) {
    const numero = String(row.numero || '');
    const factura = String(row.id_excel || '');
    const nombre = String(row.nombre || '');
    const nombreNorm = normalize(nombre);
    const numeroDigits = numero.replace(/\D/g, '');
    const facturaCompact = normalize(factura).replace(/\s+/g, '');
    const facturaLast4 = getJamazonFacturaLast4(factura);
    const nombreCompact = nombreNorm.replace(/\s+/g, '');

    if (isNumericQuery) {
      // Regla Jamazon: si hay columna #, los números cortos buscan esa columna.
      // La factura solo entra por coincidencia exacta o por sus 4 últimos dígitos completos.
      if (numeroDigits && numeroDigits === qDigits) { numeroExact.push(row); continue; }
      if (numeroDigits && numeroDigits.startsWith(qDigits)) { numeroPrefix.push(row); continue; }
      if (facturaCompact && facturaCompact === qCompact) { facturaExact.push(row); continue; }
      if (qDigits.length === 4 && facturaLast4 === qDigits) { factura4.push(row); continue; }
      continue;
    }

    const numeroCompact = normalize(numero).replace(/\s+/g, '');
    const exactTextMatch = (!!numeroCompact && numeroCompact === qCompact)
      || (!!facturaCompact && facturaCompact === qCompact)
      || (!!nombreNorm && nombreNorm === qNorm);
    if (exactTextMatch) { numeroExact.push(row); continue; }

    if ((!!qNorm && nombreNorm.includes(qNorm))
      || (!!qCompact && (numeroCompact.includes(qCompact) || facturaCompact.includes(qCompact) || nombreCompact.includes(qCompact)))) {
      nameMatches.push(row);
    }
  }
  if (isNumericQuery && numeroExact.length) return numeroExact.concat(facturaExact);
  return numeroExact.concat(numeroPrefix, facturaExact, factura4, nameMatches);
}
function getJamazonFacturaLast4(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const beforeSuffix = text.replace(/[-\s]*[01]\s*$/i, '');
  const digits = beforeSuffix.replace(/\D/g, '');
  return digits.slice(-4);
}
function renderJamazonCard(row, selected) {
  const index = jamazonRows.indexOf(row);
  const hasGps = row.latitud && row.longitud;
  return `
    <article class="result-card jamazon-match ${selected ? 'selected' : ''}" data-jz-index="${index}">
      <div class="result-top">
        <div>
          <h3>${escapeHtml(row.nombre || 'Sin nombre')}</h3>
          <small>Número: ${escapeHtml(row.numero || '-')} | Factura: ${escapeHtml(row.id_excel || '-')}</small>
        </div>
        <span class="badge">${escapeHtml(row.municipio || 'Jamazon')}</span>
      </div>
      <p class="hint">${escapeHtml(row.direccion || 'Sin dirección')}</p>
      <p class="hint">Teléfono: ${escapeHtml(row.telefono || '-')} · Peso: ${escapeHtml(row.peso || '-')}</p>
      ${hasGps ? `<p class="hint">GPS: ${Number(row.latitud).toFixed(7)}, ${Number(row.longitud).toFixed(7)}</p>` : ''}
      <div class="jamazon-actions card-actions">
        <button class="ghost jz-card-action" data-action="call" type="button">Llamar</button>
        <button class="ghost jz-card-action" data-action="sms" type="button">Mensaje</button>
      </div>
      <div class="jamazon-icon-actions card-icon-actions">
        <button class="icon-action-btn mapsme-action jz-card-action" data-action="gps" type="button" aria-label="Capturar ubicación" title="Capturar ubicación">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="8" fill="url(#jzMapBgCard)"/><path d="M16 25s7-6.15 7-12.1A7 7 0 0 0 9 12.9C9 18.85 16 25 16 25Z" fill="white" fill-opacity=".96"/><circle cx="16" cy="12.8" r="2.65" fill="#1c8cff"/><defs><linearGradient id="jzMapBgCard" x1="5" y1="4" x2="28" y2="29"><stop stop-color="#27E0FF"/><stop offset=".52" stop-color="#168BFF"/><stop offset="1" stop-color="#2457E8"/></linearGradient></defs></svg>
        </button>
        <button class="icon-action-btn cloud-action jz-card-action" data-action="cloud" type="button" aria-label="Guardar en nube" title="Guardar en nube" ${hasGps ? '' : 'disabled'}>
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M11.5 24h12.2a5.3 5.3 0 0 0 .5-10.58A8.2 8.2 0 0 0 8.3 11.5 6.4 6.4 0 0 0 11.5 24Z" fill="url(#jzCloudBgCard)"/><path d="M16 12v8m0 0 3-3m-3 3-3-3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="jzCloudBgCard" x1="7" y1="8" x2="27" y2="25"><stop stop-color="#22D3EE"/><stop offset=".55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#EC4899"/></linearGradient></defs></svg>
        </button>
      </div>
    </article>`;
}
function handleJamazonCardClick(event) {
  const card = event.target.closest('.jamazon-match');
  if (!card) return;
  const index = Number(card.dataset.jzIndex);
  const actionBtn = event.target.closest('.jz-card-action');
  selectJamazonRow(index);
  if (!actionBtn) return;
  event.preventDefault();
  event.stopPropagation();
  const action = actionBtn.dataset.action;
  if (action === 'call') callJamazonClient();
  if (action === 'sms') smsJamazonClient();
  if (action === 'gps') captureJamazonGps();
  if (action === 'cloud') saveJamazonToCloud();
}
function selectJamazonRow(index) {
  jamazonSelected = jamazonRows[index];
  jamazonGps = jamazonSelected?.latitud && jamazonSelected?.longitud
    ? { latitude: Number(jamazonSelected.latitud), longitude: Number(jamazonSelected.longitud), accuracy: 0 }
    : null;
  if (!jamazonSelected) return;
  const box = $('jamazonMatches');
  if (box) {
    box.innerHTML = '';
    box.hidden = true;
  }
  const selectedBox = $('jamazonSelected');
  if (selectedBox) selectedBox.hidden = false;
  $('jzName').textContent = jamazonSelected.nombre || 'Sin nombre';
  $('jzMeta').textContent = `Número: ${jamazonSelected.numero || '-'} | Factura: ${jamazonSelected.id_excel || '-'}`;
  if ($('jzTownBadge')) $('jzTownBadge').textContent = jamazonSelected.municipio || 'Sin municipio';
  $('jzAddress').textContent = `Municipio: ${jamazonSelected.municipio || '-'}
Dirección: ${jamazonSelected.direccion || '-'}`;
  $('jzPhone').textContent = `Teléfono: ${jamazonSelected.telefono || '-'}`;
  $('jzWeight').textContent = `Peso: ${jamazonSelected.peso || '-'}`;
  if ($('jzMessageAll')) $('jzMessageAll').checked = false;
  if ($('jzCloudBtn')) $('jzCloudBtn').disabled = !jamazonGps;
  $('jzGpsStatus').textContent = jamazonGps
    ? 'Cliente seleccionado con GPS. Puedes subirlo a la nube.'
    : 'Cliente seleccionado. Captura GPS antes de guardar en nube.';
}
function callJamazonClient() {
  if (!jamazonSelected?.telefono) return showMessage('Sin teléfono', 'Ese cliente no tiene teléfono en el Excel.');
  window.location.href = `tel:${encodeURIComponent(jamazonSelected.telefono)}`;
}
function smsJamazonClient() {
  if (!jamazonSelected?.telefono) return showMessage('Sin teléfono', 'Ese cliente no tiene teléfono en el Excel.');
  const body = $('jzMessageText')?.value || '';
  window.location.href = `sms:${encodeURIComponent(jamazonSelected.telefono)}${body ? `?body=${encodeURIComponent(body)}` : ''}`;
}
function updateJamazonSmsCounter() {
  const counter = $('jzSmsCounter');
  const text = $('jzMessageText')?.value || '';
  if (!counter) return;
  const gsm7 = /^[\n\r\t @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\\[~\]|€]*$/.test(text);
  const length = Array.from(text).length;
  const singleLimit = gsm7 ? 160 : 70;
  const multiLimit = gsm7 ? 153 : 67;
  const segments = length === 0 ? 0 : (length <= singleLimit ? 1 : Math.ceil(length / multiLimit));
  const currentLimit = segments <= 1 ? singleLimit : multiLimit * segments;
  counter.textContent = `${segments} ${segments === 1 ? 'mensaje' : 'mensajes'} · ${length}/${currentLimit} caracteres`;
  counter.classList.toggle('warning', segments > 1);
}

function prepareJamazonMessage() {
  const text = $('jzMessageText')?.value.trim() || '';
  if (!text) return showMessage('Mensaje vacío', 'Escribe el mensaje que quieres enviar.');
  if ($('jzMessageAll')?.checked) {
    const phones = [...new Set(jamazonRows.map((row) => row.telefono).filter(Boolean))];
    if (!phones.length) return showMessage('Sin teléfonos', 'No hay teléfonos en el Excel cargado.');
    const first = phones[0];
    localStorage.setItem('messpro.jamazon.smsQueue.v1', JSON.stringify({ phones, text, index: 1, active: true }));
    showMessage('Mensaje masivo preparado', `Se preparó una cola de ${phones.length} teléfonos. Android abrirá el primero; al volver a la app podrás abrir el siguiente.`);
    window.location.href = `sms:${encodeURIComponent(first)}?body=${encodeURIComponent(text)}`;
    return;
  }
  smsJamazonClient();
}
function continueJamazonSmsQueue() {
  let queue;
  try { queue = JSON.parse(localStorage.getItem('messpro.jamazon.smsQueue.v1') || 'null'); }
  catch { queue = null; }
  if (!queue?.active || !Array.isArray(queue.phones)) return;
  if (queue.index >= queue.phones.length) {
    localStorage.removeItem('messpro.jamazon.smsQueue.v1');
    showMessage('Mensajes completados', 'Ya se abrió la cola completa de mensajes.');
    return;
  }
  const next = queue.phones[queue.index];
  const remaining = queue.phones.length - queue.index;
  const openNext = confirm(`Quedan ${remaining} mensajes por abrir. ¿Abrir el próximo SMS?`);
  if (!openNext) return;
  queue.index += 1;
  localStorage.setItem('messpro.jamazon.smsQueue.v1', JSON.stringify(queue));
  window.location.href = `sms:${encodeURIComponent(next)}?body=${encodeURIComponent(queue.text || '')}`;
}
function captureJamazonGps() {
  if (!navigator.geolocation) return showMessage('GPS no disponible', 'Este equipo no permite capturar ubicación GPS.', { id: 'location-settings', label: 'Abrir ubicación' });
  $('jzGpsStatus').textContent = 'Buscando ubicación actual...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      jamazonGps = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
      if (jamazonSelected) {
        jamazonSelected.latitud = jamazonGps.latitude;
        jamazonSelected.longitud = jamazonGps.longitude;
        persistJamazonRows();
      }
      renderJamazonMatchesForSelected();
      $('jzGpsStatus').textContent = `GPS capturado y agregado al cliente: ${jamazonGps.latitude.toFixed(7)}, ${jamazonGps.longitude.toFixed(7)} · precisión ${Math.round(jamazonGps.accuracy)} m.`;
    },
    (error) => {
      const denied = error && error.code === 1;
      $('jzGpsStatus').textContent = 'No se pudo capturar GPS.';
      showMessage(
        denied ? 'Permiso de ubicación' : 'GPS no disponible',
        denied ? 'Activa ubicación para la app en Ajustes > Permisos.' : 'Activa el GPS y vuelve a intentar.',
        { id: denied ? 'app-settings' : 'location-settings', label: denied ? 'Abrir ajustes' : 'Abrir ubicación' }
      );
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}
async function saveJamazonToCloud() {
  if (!jamazonSelected) return showMessage('Sin cliente', 'Selecciona primero un cliente del Excel.');
  if (!jamazonGps && !(jamazonSelected.latitud && jamazonSelected.longitud)) return showMessage('Falta GPS', 'Captura primero la ubicación actual.');
  $('cloudDescriptionText').value = jamazonSelected.descripcion || '';
  $('cloudDescriptionDialog').showModal();
}
async function uploadJamazonToCloudAfterDescription() {
  if (!jamazonSelected) return $('cloudDescriptionDialog').close();
  const description = $('cloudDescriptionText').value.trim();
  jamazonSelected.descripcion = description;
  persistJamazonRows();
  $('cloudDescriptionDialog').close();
  const client = buildJamazonCloudClient(jamazonSelected);
  const ok = await saveCloudClient(client, false);
  if (ok) {
    clients.unshift(client);
    persist({ statusText: 'Nube', skipRender: true });
    showMessage('Guardado en nube', 'Cliente guardado en Supabase.');
  } else {
    jamazonPendingCloud.push(client);
    persistJamazonPendingCloud();
    renderJamazonSummary();
    showMessage('Guardado pendiente', 'No hay conexión o Supabase falló. Dejé la operación pendiente para exportarla cuando vuelva la conexión.');
  }
}
function buildJamazonCloudClient(row) {
  const phone = row.telefono || '';
  return {
    id: crypto.randomUUID(),
    fullName: row.nombre || `Cliente ${row.numero || phone || 'Jamazon'}`,
    identity: phone,
    phone,
    description: row.descripcion || '',
    latitude: Number(row.latitud ?? jamazonGps?.latitude),
    longitude: Number(row.longitud ?? jamazonGps?.longitude),
    updatedAt: new Date().toISOString(),
  };
}
async function flushJamazonPendingCloud() {
  if (!jamazonPendingCloud.length || !cloudReady || !navigator.onLine) return;
  const remaining = [];
  for (const client of jamazonPendingCloud) {
    const ok = await saveCloudClient(client, false);
    if (ok) clients.unshift(client);
    else remaining.push(client);
  }
  jamazonPendingCloud = remaining;
  persistJamazonPendingCloud();
  persist({ statusText: remaining.length ? 'Pendiente' : 'Nube', skipRender: true });
  renderJamazonSummary();
}
function renderJamazonMatchesForSelected() {
  if (!jamazonSelected) return;
  const box = $('jamazonMatches');
  if (box) box.innerHTML = renderJamazonCard(jamazonSelected, true);
}
function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}
function sameLastDigits(a, b, n) {
  return a.length >= n && b.length >= n && a.slice(-n) === b.slice(-n);
}
