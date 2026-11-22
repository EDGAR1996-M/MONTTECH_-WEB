'use strict';

const $ = selector => document.querySelector(selector);
const state = { csrfToken: '', clients: [], projects: [], requests: [] };
const requestStateLabels = { new: 'Nueva', contacted: 'Contactada', quoted: 'Cotizada', closed: 'Cerrada' };
const projectStateLabels = { planned: 'Planeado', in_progress: 'En progreso', completed: 'Completado', paused: 'En pausa' };

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

async function getCsrfToken() {
  const response = await fetch('/api/csrf', { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo iniciar una sesión segura.');
  state.csrfToken = data.token;
}

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = state.csrfToken;
  const response = await fetch(url, { ...options, method, headers, credentials: 'same-origin' });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}

function showAdmin(admin) {
  $('#login-view').hidden = true;
  $('#admin-view').hidden = false;
  $('#admin-email').textContent = admin.email;
}

function showLogin() {
  $('#admin-view').hidden = true;
  $('#login-view').hidden = false;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);
}

function addCell(row, value, className = '') {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = value == null || value === '' ? '—' : String(value);
  row.appendChild(cell);
  return cell;
}

function addButton(container, label, action, id, type = 'secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button small ${type}`;
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  container.appendChild(button);
}

function setEmptyState(selector, empty, hasItems) {
  $(selector).hidden = hasItems;
  empty.hidden = !hasItems;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(button => button.classList.toggle('active', button.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.hidden = panel.id !== `panel-${name}`;
  });
}

function renderSummary(summary) {
  $('#stat-clients').textContent = summary.counts.clients;
  $('#stat-projects').textContent = summary.counts.projects;
  $('#stat-requests').textContent = summary.counts.requests;
  $('#stat-new-requests').textContent = summary.counts.new_requests;
  const body = $('#recent-requests');
  body.replaceChildren();
  summary.recentRequests.forEach(item => {
    const row = document.createElement('tr');
    addCell(row, item.client_name);
    addCell(row, item.service);
    addCell(row, formatDate(item.created_at));
    const cell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'status-pill';
    badge.textContent = requestStateLabels[item.status] || item.status;
    cell.appendChild(badge);
    row.appendChild(cell);
    body.appendChild(row);
  });
  setEmptyState('#recent-empty', body, summary.recentRequests.length > 0);
}

function renderClients() {
  const body = $('#clients-list');
  body.replaceChildren();
  const search = $('#client-search').value.trim().toLocaleLowerCase();
  const matches = state.clients.filter(client =>
    [client.name, client.email, client.company].some(value => (value || '').toLocaleLowerCase().includes(search))
  );
  matches.forEach(client => {
    const row = document.createElement('tr');
    addCell(row, client.name);
    addCell(row, [client.email, client.phone].filter(Boolean).join('\n'));
    addCell(row, client.company);
    const actions = document.createElement('td');
    const group = document.createElement('div');
    group.className = 'row-actions';
    addButton(group, 'Editar', 'edit-client', client.id);
    addButton(group, 'Eliminar', 'delete-client', client.id, 'danger');
    actions.appendChild(group);
    row.appendChild(actions);
    body.appendChild(row);
  });
  setEmptyState('#clients-empty', body, matches.length > 0);
  updateProjectClientOptions();
}

function updateProjectClientOptions() {
  const select = $('#project-client');
  const selected = select.value;
  select.replaceChildren(new Option('Sin cliente asociado', ''));
  state.clients.forEach(client => select.add(new Option(client.name, client.id)));
  if (state.clients.some(client => client.id === selected)) select.value = selected;
}

function renderProjects() {
  const body = $('#projects-list');
  body.replaceChildren();
  state.projects.forEach(project => {
    const row = document.createElement('tr');
    addCell(row, project.name);
    addCell(row, project.clientName);
    addCell(row, projectStateLabels[project.status] || project.status);
    addCell(row, (project.technologies || []).join(', '));
    const actions = document.createElement('td');
    const group = document.createElement('div');
    group.className = 'row-actions';
    addButton(group, 'Editar', 'edit-project', project.id);
    addButton(group, 'Eliminar', 'delete-project', project.id, 'danger');
    actions.appendChild(group);
    row.appendChild(actions);
    body.appendChild(row);
  });
  setEmptyState('#projects-empty', body, state.projects.length > 0);
}

function renderRequests() {
  const body = $('#requests-list');
  body.replaceChildren();
  const search = $('#request-search').value.trim().toLocaleLowerCase();
  const matches = state.requests.filter(item =>
    [item.name, item.email, item.service, item.message].some(value => (value || '').toLocaleLowerCase().includes(search))
  );
  matches.forEach(item => {
    const row = document.createElement('tr');
    const customer = document.createElement('td');
    customer.textContent = item.name;
    const email = document.createElement('span');
    email.className = 'subtext';
    email.textContent = item.email || 'Sin correo';
    customer.appendChild(email);
    const message = document.createElement('span');
    message.className = 'subtext request-message';
    message.textContent = item.message;
    customer.appendChild(message);
    row.appendChild(customer);
    addCell(row, item.service);
    addCell(row, formatDate(item.createdAt));
    const stateCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'request-state';
    select.dataset.requestId = item.id;
    Object.entries(requestStateLabels).forEach(([value, label]) => {
      const option = new Option(label, value);
      option.selected = value === item.status;
      select.add(option);
    });
    stateCell.appendChild(select);
    row.appendChild(stateCell);
    const actionCell = document.createElement('td');
    addButton(actionCell, 'Guardar', 'save-request', item.id, 'secondary');
    row.appendChild(actionCell);
    body.appendChild(row);
  });
  setEmptyState('#requests-empty', body, matches.length > 0);
}

async function loadAdminData() {
  const [summary, clients, projects, requests] = await Promise.all([
    api('/api/admin/summary'),
    api('/api/admin/clients'),
    api('/api/admin/projects'),
    api('/api/admin/requests')
  ]);
  state.clients = clients.clients;
  state.projects = projects.projects;
  state.requests = requests.requests;
  renderSummary(summary);
  renderClients();
  renderProjects();
  renderRequests();
}

function resetClientForm() {
  $('#client-form').reset();
  $('#client-id').value = '';
  $('#client-form-title').textContent = 'Agregar cliente';
  $('#client-cancel').hidden = true;
}

function resetProjectForm() {
  $('#project-form').reset();
  $('#project-id').value = '';
  $('#project-form-title').textContent = 'Agregar proyecto';
  $('#project-cancel').hidden = true;
}

function beginClientEdit(id) {
  const client = state.clients.find(item => item.id === id);
  if (!client) return;
  $('#client-id').value = client.id;
  $('#client-name').value = client.name;
  $('#client-email').value = client.email || '';
  $('#client-phone').value = client.phone || '';
  $('#client-company').value = client.company || '';
  $('#client-notes').value = client.notes || '';
  $('#client-form-title').textContent = 'Editar cliente';
  $('#client-cancel').hidden = false;
  $('#client-name').focus();
}

function beginProjectEdit(id) {
  const project = state.projects.find(item => item.id === id);
  if (!project) return;
  $('#project-id').value = project.id;
  $('#project-name').value = project.name;
  $('#project-client').value = project.clientId || '';
  $('#project-description').value = project.description || '';
  $('#project-technologies').value = (project.technologies || []).join(', ');
  $('#project-status').value = project.status;
  $('#project-form-title').textContent = 'Editar proyecto';
  $('#project-cancel').hidden = false;
  $('#project-name').focus();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  showMessage($('#login-message'), '');
  try {
    const form = new FormData(event.currentTarget);
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') })
    });
    state.csrfToken = result.csrfToken;
    showAdmin(result.admin);
    await loadAdminData();
    switchTab('overview');
  } catch (error) {
    const target = $('#admin-view').hidden ? $('#login-message') : $('#app-message');
    showMessage(target, error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#logout-button').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    showLogin();
    $('#login-form').reset();
    showMessage($('#app-message'), '');
    await getCsrfToken();
  } catch (error) {
    showMessage($('#app-message'), error.message, true);
  }
});

document.querySelectorAll('.tab').forEach(button => {
  button.addEventListener('click', () => switchTab(button.dataset.tab));
});

document.querySelector('[data-open-tab="requests"]').addEventListener('click', () => switchTab('requests'));
$('#client-search').addEventListener('input', renderClients);
$('#request-search').addEventListener('input', renderRequests);
$('#client-cancel').addEventListener('click', resetClientForm);
$('#project-cancel').addEventListener('click', resetProjectForm);

$('#client-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = $('#client-id').value;
  const payload = Object.fromEntries(form.entries());
  delete payload.clientId;
  try {
    await api(id ? `/api/admin/clients/${id}` : '/api/admin/clients', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetClientForm();
    await loadAdminData();
    showMessage($('#app-message'), id ? 'Cliente actualizado.' : 'Cliente agregado.');
  } catch (error) {
    showMessage($('#app-message'), error.message, true);
  }
});

$('#project-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = $('#project-id').value;
  const payload = Object.fromEntries(form.entries());
  payload.technologies = payload.technologies.split(',').map(value => value.trim()).filter(Boolean);
  try {
    await api(id ? `/api/admin/projects/${id}` : '/api/admin/projects', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    });
    resetProjectForm();
    await loadAdminData();
    showMessage($('#app-message'), id ? 'Proyecto actualizado.' : 'Proyecto agregado.');
  } catch (error) {
    showMessage($('#app-message'), error.message, true);
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'edit-client') return beginClientEdit(id);
    if (action === 'edit-project') return beginProjectEdit(id);
    if (action === 'delete-client' || action === 'delete-project') {
      const type = action === 'delete-client' ? 'cliente' : 'proyecto';
      if (!window.confirm(`¿Eliminar este ${type}? Esta acción no se puede deshacer.`)) return;
      await api(`/api/admin/${action === 'delete-client' ? 'clients' : 'projects'}/${id}`, { method: 'DELETE' });
      await loadAdminData();
      showMessage($('#app-message'), `${type[0].toUpperCase()}${type.slice(1)} eliminado.`);
    }
    if (action === 'save-request') {
      const select = document.querySelector(`select[data-request-id="${CSS.escape(id)}"]`);
      await api(`/api/admin/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: select.value })
      });
      await loadAdminData();
      showMessage($('#app-message'), 'Estado de solicitud actualizado.');
    }
  } catch (error) {
    showMessage($('#app-message'), error.message, true);
  }
});

$('#download-report').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch('/api/admin/reports.csv', { credentials: 'same-origin' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || 'No se pudo descargar el informe.');
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'monttech-informe-administrativo.csv';
    link.click();
    URL.revokeObjectURL(url);
    showMessage($('#app-message'), 'Informe descargado.');
  } catch (error) {
    showMessage($('#app-message'), error.message, true);
  } finally {
    button.disabled = false;
  }
});

async function initialize() {
  let authenticated = false;
  try {
    await getCsrfToken();
    const result = await api('/api/auth/me');
    state.csrfToken = result.csrfToken;
    showAdmin(result.admin);
    authenticated = true;
    await loadAdminData();
  } catch (error) {
    if (authenticated) {
      showMessage($('#app-message'), error.message, true);
    } else {
      showLogin();
      if (!error.message.includes('Inicia sesión') && !error.message.includes('no es válida')) {
        showMessage($('#login-message'), error.message, true);
      }
    }
  }
}

initialize();
