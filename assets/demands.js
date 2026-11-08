(function (global) {
  const DEFAULT_COLUMNS = [
    { id: 'todo', name: 'A fazer', order: 0, closed: false },
    { id: 'doing', name: 'Em andamento', order: 1, closed: false },
    { id: 'done', name: 'Concluído', order: 2, closed: true }
  ];
  const PRIORITIES = [
    ['baixa', 'Baixa'],
    ['media', 'Média'],
    ['alta', 'Alta'],
    ['urgente', 'Urgente']
  ];
  const state = {
    items: {},
    columns: {},
    comments: {},
    view: 'board',
    filters: { query: '', owner: '', creator: '', status: '', priority: '', from: '', to: '', late: false, soon: false },
    dragId: '',
    error: '',
    ready: false,
    detailId: ''
  };
  const listeners = [];

  function data() { return global.IACData; }
  function iac() { return global.IAC || {}; }
  function esc(value) { return data().esc(value); }
  function canManage() {
    return data().isRoot() || data().hasPerm('demands_manage');
  }
  function me() { return data().uid(); }
  function columns() {
    const list = Object.keys(state.columns).map((id) => Object.assign({ id }, state.columns[id]));
    if (!list.length) return DEFAULT_COLUMNS.slice();
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function isClosed(id) {
    const column = columns().find((item) => item.id === id);
    return !!(column && column.closed);
  }
  function dueState(item) {
    if (!item) return 'sem_prazo';
    if (item.completedAt || isClosed(item.columnId)) return 'concluida';
    if (!item.dueDate) return 'sem_prazo';
    const today = global.IACDates.civilDateKey(new Date());
    if (item.dueDate < today) return 'atrasada';
    if (item.dueDate === today) return 'vence_hoje';
    const limit = addBusinessDays(today, 2);
    if (item.dueDate <= limit) return 'prazo_proximo';
    return 'em_dia';
  }
  function addBusinessDays(key, amount) {
    const date = global.IACDates.parseCivilDate(key);
    let left = amount;
    while (left > 0) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) left -= 1;
    }
    return global.IACDates.civilDateKey(date);
  }
  function progress(item) {
    const list = item.checklist ? Object.keys(item.checklist).map((id) => item.checklist[id]) : [];
    if (!list.length) return 0;
    const done = list.filter((entry) => entry && entry.done).length;
    return Math.round((done / list.length) * 100);
  }
  function visible(item) {
    if (!item || item.title == null) return false;
    const filters = state.filters;
    const mine = me();
    if (state.view === 'mine' && !(item.responsibleIds && item.responsibleIds[mine]) && item.createdBy !== mine) return false;
    if (!canManage() && state.view === 'all') {
      if (!(item.responsibleIds && item.responsibleIds[mine]) && item.createdBy !== mine) return false;
    }
    if (filters.owner && !(item.responsibleIds && item.responsibleIds[filters.owner])) return false;
    if (filters.creator && item.createdBy !== filters.creator) return false;
    if (filters.status && item.columnId !== filters.status) return false;
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.from && item.dueDate && item.dueDate < filters.from) return false;
    if (filters.to && item.dueDate && item.dueDate > filters.to) return false;
    const timing = dueState(item);
    if (filters.late && timing !== 'atrasada') return false;
    if (filters.soon && timing !== 'prazo_proximo' && timing !== 'vence_hoje') return false;
    const query = filters.query.trim().toLowerCase();
    if (!query) return true;
    return (String(item.title) + ' ' + String(item.description || '')).toLowerCase().indexOf(query) !== -1;
  }
  function list() {
    return Object.keys(state.items).map((id) => Object.assign({ id }, state.items[id])).filter(visible)
      .sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')));
  }

  function stopListeners() {
    listeners.splice(0).forEach((stop) => { if (typeof stop === 'function') stop(); });
  }

  function track(path, callback) {
    const modules = global.firebaseModules;
    const reference = modules.ref(global.database, path);
    const stop = modules.onValue(reference, callback, (error) => {
      state.error = 'Não foi possível sincronizar as demandas.';
      console.warn(path, error);
    });
    if (typeof stop === 'function') listeners.push(stop);
  }

  function watchIndex() {
    stopListeners();
    if (!global.firebaseModules || !global.database || !me()) return;
    track('demandColumns', (snap) => {
      state.columns = snap.exists() ? (snap.val() || {}) : {};
      paint();
    });
    if (canManage()) {
      track('demands', (snap) => {
        state.items = snap.exists() ? (snap.val() || {}) : {};
        state.ready = true;
        state.error = '';
        paint();
        document.dispatchEvent(new CustomEvent('iac-demands'));
      });
      return;
    }
    track('demandIndex/' + me(), async (snap) => {
      const index = snap.exists() ? (snap.val() || {}) : {};
      const next = {};
      await Promise.all(Object.keys(index).map(async (id) => {
        try {
          const value = await data().read('demands/' + id);
          if (value) next[id] = value;
        } catch (error) {
          console.warn(id, error);
        }
      }));
      state.items = next;
      state.ready = true;
      paint();
      document.dispatchEvent(new CustomEvent('iac-demands'));
    });
  }

  async function ensureColumns() {
    if (!canManage()) return;
    const existing = await data().read('demandColumns');
    if (existing) return;
    const updates = {};
    DEFAULT_COLUMNS.forEach((column) => { updates['demandColumns/' + column.id] = column; });
    await data().patch(updates);
  }

  function namesOf(map) {
    return Object.keys(map || {}).map((id) => data().personName(id)).join(', ') || 'Sem responsável';
  }

  function card(item) {
    const timing = dueState(item);
    const labels = { atrasada: 'Atrasada', vence_hoje: 'Vence hoje', prazo_proximo: 'Prazo próximo', em_dia: 'Em dia', concluida: 'Concluída', sem_prazo: 'Sem prazo' };
    return '<article class="iac-demand ' + timing + '" draggable="true" data-id="' + esc(item.id) + '">' +
      '<strong>' + esc(item.title) + '</strong>' +
      '<div class="meta"><span>' + esc(namesOf(item.responsibleIds)) + '</span><span class="iac-pill ' + esc(item.priority || '') + '">' + esc(labelPriority(item.priority)) + '</span></div>' +
      '<div class="meta"><span>' + esc(item.dueDate ? global.IACDates.formatCivilDate(item.dueDate) : 'Sem prazo') + '</span><span class="iac-pill ' + timing + '">' + labels[timing] + '</span></div>' +
      '<div class="iac-progress"><span style="width:' + progress(item) + '%"></span></div>' +
      '<select class="iac-mobile-only" data-move="' + esc(item.id) + '">' + columns().map((column) => '<option value="' + esc(column.id) + '"' + (column.id === item.columnId ? ' selected' : '') + '>' + esc(column.name) + '</option>').join('') + '</select>' +
      '</article>';
  }

  function labelPriority(value) {
    const found = PRIORITIES.find((item) => item[0] === value);
    return found ? found[1] : 'Sem prioridade';
  }

  function paint() {
    const host = document.getElementById('content-demandas');
    if (!host || host.classList.contains('hidden')) return;
    if (!iac().isLoggedIn) {
      host.innerHTML = '<div class="iac-card iac-empty"><p>Faça login para ver e registrar demandas.</p></div>';
      return;
    }
    const cols = columns();
    const items = list();
    const people = data().people();
    const options = '<option value="">Todos</option>' + Object.keys(people).map((id) => '<option value="' + esc(id) + '">' + esc(personLabel(people[id])) + '</option>').join('');
    host.innerHTML =
      '<div class="iac-page"><div class="iac-head"><div><h2>Demandas</h2><p>Distribuição do trabalho da equipe. Os números mostram concentração, não um ranking.</p></div>' +
      '<div class="iac-row"><button class="iac-btn" type="button" id="iac-demand-new">Nova demanda</button></div></div>' +
      '<div class="iac-row">' +
      ['board', 'Quadro', 'mine', 'Minhas', 'all', 'Todas', 'list', 'Lista', 'panel', 'Painel'].reduce((html, token, index, source) => {
        if (index % 2) return html;
        const id = token;
        const label = source[index + 1];
        if (id === 'all' && !canManage()) return html;
        return html + '<button class="iac-btn ' + (state.view === id ? '' : 'secondary') + '" type="button" data-view="' + id + '">' + label + '</button>';
      }, '') + '</div>' +
      '<div class="iac-card iac-filters"><label>Busca<input id="iac-demand-query" value="' + esc(state.filters.query) + '"></label>' +
      '<label>Responsável<select id="iac-demand-owner">' + options + '</select></label>' +
      '<label>Criador<select id="iac-demand-creator">' + options + '</select></label>' +
      '<label>Etapa<select id="iac-demand-status"><option value="">Todas</option>' + cols.map((column) => '<option value="' + esc(column.id) + '">' + esc(column.name) + '</option>').join('') + '</select></label>' +
      '<label>Prioridade<select id="iac-demand-priority"><option value="">Todas</option>' + PRIORITIES.map((item) => '<option value="' + item[0] + '">' + item[1] + '</option>').join('') + '</select></label>' +
      '<label>De<input type="date" id="iac-demand-from" value="' + esc(state.filters.from) + '"></label>' +
      '<label>Até<input type="date" id="iac-demand-to" value="' + esc(state.filters.to) + '"></label>' +
      '<label>Atrasadas<input type="checkbox" id="iac-demand-late"' + (state.filters.late ? ' checked' : '') + '></label>' +
      '<label>Perto do prazo<input type="checkbox" id="iac-demand-soon"' + (state.filters.soon ? ' checked' : '') + '></label></div>' +
      '<p class="iac-status' + (state.error ? ' error' : '') + '">' + esc(state.error || (state.ready ? items.length + ' demanda(s)' : 'Carregando...')) + '</p>' +
      body(cols, items) + '</div>';
    bind(host);
  }

  function body(cols, items) {
    if (state.view === 'panel') return panel(items);
    if (state.view === 'list') {
      return '<div class="iac-card iac-table-wrap"><table class="iac-table"><thead><tr><th>Título</th><th>Responsável</th><th>Etapa</th><th>Prioridade</th><th>Prazo</th><th>Progresso</th></tr></thead><tbody>' +
        (items.length ? items.map((item) => {
          const column = cols.find((entry) => entry.id === item.columnId);
          return '<tr data-open="' + esc(item.id) + '"><td>' + esc(item.title) + '</td><td>' + esc(namesOf(item.responsibleIds)) + '</td><td>' + esc(column ? column.name : item.columnId) + '</td><td>' + esc(labelPriority(item.priority)) + '</td><td>' + esc(item.dueDate ? global.IACDates.formatCivilDate(item.dueDate) : '—') + '</td><td>' + progress(item) + '%</td></tr>';
        }).join('') : '<tr><td colspan="6">Nenhuma demanda com esses filtros.</td></tr>') +
        '</tbody></table></div>';
    }
    return '<div class="iac-board">' + cols.map((column) => {
      const cards = items.filter((item) => (item.columnId || 'todo') === column.id);
      const late = cards.filter((item) => dueState(item) === 'atrasada').length;
      return '<section class="iac-column" data-column="' + esc(column.id) + '"><header><h3>' + esc(column.name) + '</h3><span class="iac-count">' + cards.length + (late ? ' · ' + late + ' atrasada(s)' : '') + '</span><div class="iac-col-tools">' +
        '<button class="iac-icon" type="button" data-add="' + esc(column.id) + '" title="Adicionar" aria-label="Adicionar demanda"><span>+</span></button>' +
        (canManage() ? '<div class="iac-col-menu"><button class="iac-icon" type="button" data-col-menu aria-label="Editar coluna" title="Editar coluna" aria-expanded="false"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z"/></svg></button><div class="iac-col-pop" hidden><button type="button" data-rename="' + esc(column.id) + '">Renomear</button><button type="button" data-drop-column="' + esc(column.id) + '">Excluir</button></div></div>' : '') +
        '</div></header>' +
        cards.map(card).join('') + '</section>';
    }).join('') + (canManage() ? '<section class="iac-column iac-column-add"><button class="iac-add-column" type="button" id="iac-column-add" title="Nova coluna" aria-label="Nova coluna">+</button></section>' : '') + '</div>';
  }

  function panel(items) {
    const counts = {};
    columns().forEach((column) => { counts[column.name] = 0; });
    counts.Atrasadas = 0;
    const byPerson = {};
    items.forEach((item) => {
      const column = columns().find((entry) => entry.id === item.columnId);
      const name = column ? column.name : 'Outras';
      counts[name] = (counts[name] || 0) + 1;
      if (dueState(item) === 'atrasada') counts.Atrasadas += 1;
      const owners = Object.keys(item.responsibleIds || {});
      (owners.length ? owners : ['sem']).forEach((id) => {
        const label = id === 'sem' ? 'Sem responsável' : data().personName(id);
        byPerson[label] = (byPerson[label] || 0) + 1;
      });
    });
    const max = Math.max(1, ...Object.values(counts));
    const maxPerson = Math.max(1, ...Object.values(byPerson));
    return '<div class="iac-card"><h3>Distribuição por etapa</h3><div class="iac-bars">' + Object.keys(counts).map((name) =>
      '<div class="iac-bar"><span>' + esc(name) + '</span><i style="width:' + Math.round((counts[name] / max) * 100) + '%"></i><b>' + counts[name] + '</b></div>'
    ).join('') + '</div></div><div class="iac-card"><h3>Demandas por responsável</h3><p class="iac-status">Serve para ver sobrecarga e onde a equipe precisa de apoio.</p><div class="iac-bars">' +
      Object.keys(byPerson).sort((a, b) => byPerson[b] - byPerson[a]).map((name) =>
        '<div class="iac-bar"><span>' + esc(name) + '</span><i style="width:' + Math.round((byPerson[name] / maxPerson) * 100) + '%;background:#64748b"></i><b>' + byPerson[name] + '</b></div>'
      ).join('') + '</div></div>';
  }

  function closeColumnMenus() {
    document.querySelectorAll('.iac-col-pop').forEach((pop) => { pop.hidden = true; });
    document.querySelectorAll('[data-col-menu]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  }

  if (!global.__iacColumnMenuBound) {
    global.__iacColumnMenuBound = true;
    document.addEventListener('click', (event) => {
      if (event.target.closest('.iac-col-menu')) return;
      closeColumnMenus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeColumnMenus();
    });
  }

  function bind(host) {
    host.querySelectorAll('[data-view]').forEach((button) => {
      button.onclick = () => { state.view = button.getAttribute('data-view'); paint(); };
    });
    const query = document.getElementById('iac-demand-query');
    if (query) query.onchange = () => { state.filters.query = query.value; paint(); };
    ['owner', 'creator', 'status', 'priority'].forEach((key) => {
      const input = document.getElementById('iac-demand-' + key);
      if (!input) return;
      input.value = state.filters[key];
      input.onchange = () => { state.filters[key] = input.value; paint(); };
    });
    ['from', 'to'].forEach((key) => {
      const input = document.getElementById('iac-demand-' + key);
      if (!input) return;
      input.onchange = () => { state.filters[key] = input.value; paint(); };
    });
    const late = document.getElementById('iac-demand-late');
    const soon = document.getElementById('iac-demand-soon');
    if (late) late.onchange = () => { state.filters.late = late.checked; paint(); };
    if (soon) soon.onchange = () => { state.filters.soon = soon.checked; paint(); };
    const create = document.getElementById('iac-demand-new');
    if (create) create.onclick = () => openForm(null, 'todo');
    host.querySelectorAll('[data-add]').forEach((button) => { button.onclick = () => openForm(null, button.getAttribute('data-add')); });
    host.querySelectorAll('[data-open], .iac-demand').forEach((node) => {
      node.onclick = (event) => {
        if (event.target.closest('select, button')) return;
        openDetail(node.getAttribute('data-open') || node.getAttribute('data-id'));
      };
    });
    host.querySelectorAll('[data-move]').forEach((select) => {
      select.onchange = () => move(select.getAttribute('data-move'), select.value);
    });
    host.querySelectorAll('.iac-demand').forEach((cardNode) => {
      cardNode.ondragstart = (event) => {
        state.dragId = cardNode.getAttribute('data-id');
        event.dataTransfer.setData('text/plain', state.dragId);
      };
    });
    host.querySelectorAll('.iac-column').forEach((column) => {
      column.ondragover = (event) => event.preventDefault();
      column.ondrop = (event) => {
        event.preventDefault();
        const id = event.dataTransfer.getData('text/plain') || state.dragId;
        move(id, column.getAttribute('data-column'));
      };
    });
    host.querySelectorAll('[data-col-menu]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const pop = button.parentElement.querySelector('.iac-col-pop');
        const willOpen = pop.hidden;
        closeColumnMenus();
        pop.hidden = !willOpen;
        button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      };
    });
    host.querySelectorAll('[data-rename]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        closeColumnMenus();
        renameColumn(button.getAttribute('data-rename'));
      };
    });
    host.querySelectorAll('[data-drop-column]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        closeColumnMenus();
        deleteColumn(button.getAttribute('data-drop-column'));
      };
    });
    const addColumn = document.getElementById('iac-column-add');
    if (addColumn) addColumn.onclick = () => renameColumn('');
  }

  function personLabel(person) {
    const name = (person && person.name) || 'Funcionário';
    const mail = person && (person.email || (person.username ? '@' + person.username : ''));
    return mail && mail !== name ? name + ' · ' + mail : name;
  }

  function canAssign() {
    return canManage() || (iac().userRole === 'admin');
  }

  async function assigneeMap() {
    const map = Object.assign({}, data().people());
    try {
      const directory = await data().read('directory');
      Object.keys(directory || {}).forEach((id) => {
        const person = directory[id];
        if (person && person.active !== false) map[id] = Object.assign({ email: '' }, person);
      });
    } catch (error) {
      console.warn('Diretório de usuários indisponível:', error);
    }
    if (data().isRoot() || iac().userRole === 'admin') {
      try {
        const staff = await data().read('users');
        Object.keys(staff || {}).forEach((id) => {
          const person = staff[id];
          if (!person || person.active === false) return;
          map[id] = Object.assign({}, map[id] || {}, {
            name: person.name || (map[id] && map[id].name) || '',
            email: person.email || (map[id] && map[id].email) || '',
            username: person.username || (map[id] && map[id].username) || '',
            active: true
          });
        });
      } catch (error) {
        console.warn('Lista de usuários indisponível:', error);
      }
    }
    const mine = me();
    if (mine && !map[mine]) map[mine] = { name: data().actorName(), email: (iac().currentUser && iac().currentUser.email) || '' };
    return map;
  }

  function openForm(item, columnId) {
    const current = item || { columnId: columnId || 'todo', priority: 'media', responsibleIds: {}, checklist: {} };
    if (!item && !canManage()) current.responsibleIds = {};
    current.responsibleIds[me()] = current.responsibleIds[me()] || !canManage();
    if (!canManage()) current.responsibleIds = { [me()]: true };
    const modal = document.createElement('div');
    modal.className = 'iac-modal';
    modal.innerHTML = '<div class="iac-backdrop"></div><div class="iac-dialog"><div class="iac-head"><h2>' + (item ? 'Editar demanda' : 'Nova demanda') + '</h2><button class="iac-btn secondary" type="button" data-close="1">Fechar</button></div>' +
      '<form class="iac-form" id="iac-demand-form"><label>Título<input name="title" required maxlength="180" value="' + esc(current.title || '') + '"></label>' +
      '<label>Descrição<textarea name="description" rows="3">' + esc(current.description || '') + '</textarea></label>' +
      (canAssign()
        ? '<div class="iac-assign" id="iac-demand-owners"><div class="iac-assign-head"><span>Atribuir</span><b id="iac-assign-count">Você, se ninguém for escolhido</b></div><div class="iac-assign-chips" id="iac-assign-chips"></div><input id="iac-assign-search" type="search" placeholder="Buscar nome ou e-mail" autocomplete="off"><div class="iac-assign-list" id="iac-assign-list"><p class="iac-status">Carregando pessoas...</p></div><div id="iac-assign-values"></div></div>'
        : '<label>Responsável<input value="' + esc(data().actorName()) + '" disabled></label><input type="hidden" name="owners" value="' + esc(me()) + '">') +
      '<label>Prioridade<select name="priority">' + PRIORITIES.map((entry) => '<option value="' + entry[0] + '"' + (current.priority === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>').join('') + '</select></label>' +
      '<div class="split"><label>Início<input type="date" name="startDate" value="' + esc(current.startDate || '') + '"></label><label>Prazo<input type="date" name="dueDate" value="' + esc(current.dueDate || '') + '"></label></div>' +
      '<label>Etapa<select name="columnId">' + columns().map((column) => '<option value="' + esc(column.id) + '"' + ((current.columnId || columnId) === column.id ? ' selected' : '') + '>' + esc(column.name) + '</option>').join('') + '</select></label>' +
      '<p class="iac-status error" id="iac-demand-error"></p><button class="iac-btn" type="submit">Salvar</button></form></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('.iac-backdrop').onclick = () => modal.remove();
    const assignRoot = modal.querySelector('#iac-demand-owners');
    if (assignRoot) {
      const selected = new Set(Object.keys((item && item.responsibleIds) || {}));
      let people = {};
      const search = modal.querySelector('#iac-assign-search');
      const list = modal.querySelector('#iac-assign-list');
      const chips = modal.querySelector('#iac-assign-chips');
      const values = modal.querySelector('#iac-assign-values');
      const count = modal.querySelector('#iac-assign-count');
      const palette = ['#2f6fed', '#0c8f9c', '#6b46d6', '#1b9460', '#d46a32'];
      function tint(name) {
        let n = 0;
        String(name || '').split('').forEach((ch) => { n += ch.charCodeAt(0); });
        return palette[n % palette.length];
      }
      function initials(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        const letters = (parts[0] ? parts[0][0] : '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
        return (letters || '?').toUpperCase();
      }
      function ordered(query) {
        const q = String(query || '').trim().toLowerCase();
        const mine = me();
        return Object.keys(people).filter((id) => {
          if (!q) return true;
          return personLabel(people[id]).toLowerCase().indexOf(q) !== -1;
        }).sort((a, b) => {
          if (a === mine) return -1;
          if (b === mine) return 1;
          const rank = (id) => selected.has(id) ? 0 : 1;
          if (rank(a) !== rank(b)) return rank(a) - rank(b);
          return personLabel(people[a]).localeCompare(personLabel(people[b]), 'pt-BR');
        });
      }
      function paintAssign() {
        const ids = ordered(search.value);
        values.innerHTML = [...selected].map((id) => '<input type="hidden" name="owners" value="' + esc(id) + '">').join('');
        chips.innerHTML = [...selected].map((id) => {
          const name = (people[id] && people[id].name) || 'Pessoa';
          return '<button type="button" class="iac-person-chip" data-unassign="' + esc(id) + '" title="Remover"><i class="iac-avatar" style="--tint:' + tint(name) + '">' + esc(initials(name)) + '</i>' + esc(name) + '</button>';
        }).join('');
        count.textContent = selected.size ? (selected.size === 1 ? '1 pessoa' : selected.size + ' pessoas') : 'Você, se ninguém for escolhido';
        list.innerHTML = ids.length ? ids.map((id) => {
          const person = people[id] || {};
          const name = person.name || 'Funcionário';
          const mail = person.email || (person.username ? '@' + person.username : '');
          return '<button type="button" class="iac-person' + (selected.has(id) ? ' is-on' : '') + '" data-assign="' + esc(id) + '"><i class="iac-avatar" style="--tint:' + tint(name) + '">' + esc(initials(name)) + '</i><span class="who"><b>' + esc(name) + (id === me() ? ' <em>você</em>' : '') + '</b>' + (mail ? '<span>' + esc(mail) + '</span>' : '') + '</span><i class="mark" aria-hidden="true"></i></button>';
        }).join('') : '<p class="iac-status">Nenhuma pessoa com esse nome.</p>';
      }
      list.onclick = (event) => {
        const button = event.target.closest('[data-assign]');
        if (!button) return;
        const id = button.getAttribute('data-assign');
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        paintAssign();
      };
      chips.onclick = (event) => {
        const button = event.target.closest('[data-unassign]');
        if (!button) return;
        selected.delete(button.getAttribute('data-unassign'));
        paintAssign();
      };
      search.oninput = () => paintAssign();
      search.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const first = list.querySelector('[data-assign]');
          if (!first) return;
          const id = first.getAttribute('data-assign');
          if (!selected.has(id)) selected.add(id);
          search.value = '';
          paintAssign();
        } else if (event.key === 'Backspace' && !search.value && selected.size) {
          selected.delete([...selected].pop());
          paintAssign();
        }
      };
      assigneeMap().then((found) => {
        if (!assignRoot.isConnected) return;
        people = found || {};
        paintAssign();
      }).catch(() => {
        if (list.isConnected) list.innerHTML = '<p class="iac-status error">Não foi possível carregar as pessoas.</p>';
      });
    }
    modal.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById('iac-demand-error');
      try {
        const owners = {};
        new FormData(form).getAll('owners').forEach((id) => { if (id) owners[id] = true; });
        if (!canAssign()) owners[me()] = true;
        if (!Object.keys(owners).length) owners[me()] = true;
        if (form.startDate.value && form.dueDate.value && form.dueDate.value < form.startDate.value) {
          throw new Error('O prazo não pode ser anterior ao início.');
        }
        await saveItem(item, {
          title: form.title.value.trim(),
          description: form.description.value.trim(),
          responsibleIds: owners,
          priority: form.priority.value,
          startDate: form.startDate.value,
          dueDate: form.dueDate.value,
          columnId: form.columnId.value
        });
        modal.remove();
        data().toast('Demanda salva.', 'success');
      } catch (err) {
        error.textContent = err.message || 'Não foi possível salvar.';
      }
    };
  }

  async function saveItem(previous, input) {
    if (!input.title) throw new Error('Informe o título.');
    const id = previous ? previous.id : data().newId();
    const nowClosed = isClosed(input.columnId);
    const wasClosed = previous ? isClosed(previous.columnId) : false;
    const record = {
      title: input.title,
      description: input.description || '',
      createdBy: previous ? previous.createdBy : me(),
      createdByName: previous ? (previous.createdByName || data().actorName()) : data().actorName(),
      responsibleIds: input.responsibleIds,
      priority: input.priority || 'media',
      columnId: input.columnId || 'todo',
      startDate: input.startDate || '',
      dueDate: input.dueDate || '',
      checklist: previous ? (previous.checklist || {}) : {},
      projectId: previous ? (previous.projectId || '') : '',
      classId: previous ? (previous.classId || '') : '',
      createdAt: previous ? previous.createdAt : data().stamp(),
      updatedAt: data().stamp(),
      completedAt: nowClosed ? (previous && previous.completedAt ? previous.completedAt : Date.now()) : null
    };
    await data().write('demands/' + id, record);
    const index = {};
    Object.keys(record.responsibleIds).forEach((person) => { index['demandIndex/' + person + '/' + id] = { by: me() }; });
    index['demandIndex/' + record.createdBy + '/' + id] = { by: me() };
    if (previous) {
      Object.keys(previous.responsibleIds || {}).forEach((person) => {
        if (!record.responsibleIds[person] && person !== record.createdBy) index['demandIndex/' + person + '/' + id] = null;
      });
    }
    await data().patch(index);
    const changes = previous && iac().diffPlain ? iac().diffPlain(previous, record, ['title', 'description', 'priority', 'columnId', 'startDate', 'dueDate', 'responsibleIds']) : null;
    if (iac().logAction) {
      iac().logAction(previous ? 'Demanda editada' : 'Demanda criada', { title: record.title }, {
        module: 'Demandas', entityType: 'demand', entityId: id, entityName: record.title, changes, origin: 'Demandas'
      });
    }
    if (global.IACNotify) {
      const recipients = Object.keys(record.responsibleIds).filter((person) => person !== me());
      if (!previous) {
        global.IACNotify.push(recipients, { title: 'Nova demanda', description: record.title, category: 'demandas', relatedType: 'demand', relatedId: id });
      } else if (changes && changes.responsibleIds) {
        global.IACNotify.push(recipients, { title: 'Responsável alterado', description: record.title, category: 'demandas', relatedType: 'demand', relatedId: id });
      } else if (!wasClosed && nowClosed) {
        global.IACNotify.push(recipients.concat(record.createdBy === me() ? [] : [record.createdBy]), { title: 'Demanda concluída', description: record.title, category: 'demandas', relatedType: 'demand', relatedId: id });
      } else if (wasClosed && !nowClosed) {
        global.IACNotify.push(recipients, { title: 'Demanda reaberta', description: record.title, category: 'demandas', relatedType: 'demand', relatedId: id });
      }
    }
    state.items[id] = record;
    paint();
  }

  async function move(id, columnId) {
    const current = state.items[id];
    if (!current || !columnId || current.columnId === columnId) return;
    await saveItem(Object.assign({ id }, current), Object.assign({}, current, { columnId }));
  }

  async function renameColumn(id) {
    if (!canManage()) return;
    const current = id ? state.columns[id] : null;
    const name = prompt(id ? 'Novo nome da coluna' : 'Nome da nova coluna', current ? current.name : '');
    if (!name || !name.trim()) return;
    const columnId = id || data().newId();
    const order = current ? current.order : columns().length;
    await data().write('demandColumns/' + columnId, { name: name.trim(), order, closed: current ? !!current.closed : /conclu/i.test(name) });
    if (iac().logAction) iac().logAction(id ? 'Coluna de demanda editada' : 'Coluna de demanda criada', { name }, { module: 'Demandas', entityType: 'column', entityId: columnId, entityName: name.trim(), origin: 'Kanban' });
  }

  async function deleteColumn(id) {
    if (!canManage()) return;
    const used = Object.keys(state.items).some((key) => state.items[key].columnId === id);
    if (used) {
      data().toast('Mova as demandas desta coluna antes de excluí-la.', 'error');
      return;
    }
    if (!confirm('Excluir esta coluna?')) return;
    await data().write('demandColumns/' + id, null);
  }

  async function openDetail(id) {
    const item = state.items[id];
    if (!item) return;
    state.detailId = id;
    let comments = {};
    try { comments = (await data().read('demandComments/' + id)) || {}; } catch (error) { comments = {}; }
    const history = (global.IACAudit && global.IACAudit.recent) ? [] : [];
    const checks = Object.keys(item.checklist || {}).map((key) => ({ id: key, ...item.checklist[key] }));
    const modal = document.createElement('div');
    modal.className = 'iac-modal';
    modal.id = 'iac-demand-detail';
    modal.innerHTML = '<div class="iac-backdrop"></div><div class="iac-dialog"><div class="iac-head"><div><h2>' + esc(item.title) + '</h2><p>Criada por ' + esc(item.createdByName || data().personName(item.createdBy)) + ' · ' + esc(labelPriority(item.priority)) + ' · ' + esc(dueState(item).replace('_', ' ')) + '</p></div><button class="iac-btn secondary" type="button" data-close="1">Fechar</button></div>' +
      '<p>' + esc(item.description || 'Sem descrição.') + '</p>' +
      '<p><strong>Responsável:</strong> ' + esc(namesOf(item.responsibleIds)) + '</p>' +
      '<div class="iac-row"><button class="iac-btn secondary" type="button" id="iac-demand-edit">Editar</button>' + (item.createdBy === me() || canManage() ? '<button class="iac-btn danger" type="button" id="iac-demand-delete">Excluir</button>' : '') + '</div>' +
      '<h3>Checklist · ' + progress(item) + '%</h3><div id="iac-checks">' + (checks.length ? checks.map((entry) => '<label class="iac-note"><input type="checkbox" data-check="' + esc(entry.id) + '"' + (entry.done ? ' checked' : '') + '> ' + esc(entry.text || '') + '</label>').join('') : '<p class="iac-empty">Nenhuma subtarefa.</p>') + '</div>' +
      '<form id="iac-check-form" class="iac-row"><input name="text" maxlength="180" placeholder="Nova subtarefa" required><button class="iac-btn secondary" type="submit">Adicionar</button></form>' +
      '<h3>Comentários</h3><div id="iac-comments">' + renderComments(comments) + '</div>' +
      '<form id="iac-comment-form" class="iac-form"><label>Comentário<textarea name="content" required maxlength="4000"></textarea></label><label>Responder a<select name="parent"><option value="">Comentário principal</option>' + Object.keys(comments).map((key) => '<option value="' + esc(key) + '">' + esc((comments[key].authorName || '') + ': ' + String(comments[key].content || '').slice(0, 40)) + '</option>').join('') + '</select></label><label>Anexo<input type="file" name="file"></label><p class="iac-status error" id="iac-comment-error"></p><button class="iac-btn" type="submit">Publicar</button></form>' +
      '<h3>Histórico</h3><p class="iac-status">As mudanças desta demanda também entram na auditoria geral.</p></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('.iac-backdrop').onclick = () => modal.remove();
    modal.querySelector('#iac-demand-edit').onclick = () => { modal.remove(); openForm(Object.assign({ id }, item)); };
    const remove = modal.querySelector('#iac-demand-delete');
    if (remove) remove.onclick = async () => {
      if (!confirm('Excluir esta demanda? O histórico de auditoria permanece.')) return;
      await data().write('demands/' + id, null);
      const updates = {};
      Object.keys(item.responsibleIds || {}).concat(item.createdBy).forEach((person) => { updates['demandIndex/' + person + '/' + id] = null; });
      await data().patch(updates);
      if (iac().logAction) iac().logAction('Demanda excluída', {}, { module: 'Demandas', entityType: 'demand', entityId: id, entityName: item.title, origin: 'Demandas' });
      delete state.items[id];
      modal.remove();
      paint();
    };
    modal.querySelectorAll('[data-check]').forEach((input) => {
      input.onchange = async () => {
        const key = input.getAttribute('data-check');
        const checklist = Object.assign({}, item.checklist);
        checklist[key] = Object.assign({}, checklist[key], { done: input.checked });
        item.checklist = checklist;
        state.items[id] = Object.assign({}, state.items[id], { checklist: checklist, updatedAt: data().stamp() });
        await data().write('demands/' + id, state.items[id]);
      };
    });
    modal.querySelector('#iac-check-form').onsubmit = async (event) => {
      event.preventDefault();
      const text = event.currentTarget.text.value.trim();
      if (!text) return;
      const key = data().newId();
      const checklist = Object.assign({}, item.checklist || {});
      checklist[key] = { text, done: false };
      item.checklist = checklist;
      state.items[id] = Object.assign({}, item, { id: id, checklist: checklist, updatedAt: data().stamp() });
      await data().write('demands/' + id, state.items[id]);
      modal.remove();
      openDetail(id);
    };
    modal.querySelector('#iac-comment-form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById('iac-comment-error');
      error.textContent = '';
      try {
        let attachments = null;
        const file = form.file.files && form.file.files[0];
        if (file) {
          if (file.size > 10 * 1024 * 1024) throw new Error('O anexo precisa ter até 10 MB.');
          try { attachments = [await uploadFile(file)]; }
          catch (uploadError) { error.textContent = 'O comentário será salvo sem o arquivo. O Storage pode não estar ativo.'; }
        }
        const commentId = data().newId();
        await data().write('demandComments/' + id + '/' + commentId, {
          demandId: id,
          authorUid: me(),
          authorName: data().actorName(),
          content: form.content.value.trim(),
          parentId: form.parent.value || '',
          attachments,
          createdAt: data().stamp()
        });
        if (iac().logAction) iac().logAction('Comentário em demanda', {}, { module: 'Demandas', entityType: 'demand', entityId: id, entityName: item.title, origin: 'Comentários' });
        const recipients = Object.keys(item.responsibleIds || {}).concat(item.createdBy).filter((person, index, listIds) => person && person !== me() && listIds.indexOf(person) === index);
        if (global.IACNotify) global.IACNotify.push(recipients, { title: 'Novo comentário', description: item.title, category: 'demandas', relatedType: 'demand', relatedId: id });
        modal.remove();
        openDetail(id);
      } catch (err) {
        error.textContent = err.message || 'Não foi possível comentar.';
      }
    };
    void history;
  }

  function renderComments(comments) {
    const listIds = Object.keys(comments);
    if (!listIds.length) return '<p class="iac-empty">Nenhum comentário ainda.</p>';
    return listIds.sort((a, b) => (comments[a].createdAt || 0) - (comments[b].createdAt || 0)).map((key) => {
      const comment = comments[key];
      const moment = typeof comment.createdAt === 'number' ? new Date(comment.createdAt) : new Date();
      const files = (comment.attachments || []).map((file) => '<a href="' + esc(file.url) + '" target="_blank" rel="noopener">' + esc(file.name) + '</a>').join(' ');
      return '<article class="iac-note"><strong>' + esc(comment.authorName || '—') + '</strong> · ' + moment.toLocaleString('pt-BR') + (comment.parentId ? ' · resposta' : '') + '<p>' + esc(comment.content || '') + '</p>' + files + '</article>';
    }).join('');
  }

  async function uploadFile(file) {
    const storageMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
    const storage = storageMod.getStorage(global.firebaseApp);
    const safe = file.name.replace(/[^\w.\-]+/g, '_');
    const path = 'attachments/' + me() + '/' + Date.now() + '-' + safe;
    const reference = storageMod.ref(storage, path);
    await storageMod.uploadBytes(reference, file);
    const url = await storageMod.getDownloadURL(reference);
    return { name: file.name, url, path, size: file.size };
  }

  function counts() {
    const items = Object.keys(state.items).map((id) => state.items[id]);
    const summary = { total: items.length, todo: 0, doing: 0, review: 0, waiting: 0, done: 0, late: 0 };
    items.forEach((item) => {
      const column = columns().find((entry) => entry.id === item.columnId);
      const name = (column && column.name || '').toLowerCase();
      if (item.completedAt || (column && column.closed)) summary.done += 1;
      else if (name.indexOf('revis') !== -1) summary.review += 1;
      else if (name.indexOf('aguard') !== -1 || name.indexOf('retorno') !== -1) summary.waiting += 1;
      else if (name.indexOf('andamento') !== -1) summary.doing += 1;
      else summary.todo += 1;
      if (dueState(item) === 'atrasada') summary.late += 1;
    });
    return summary;
  }

  document.addEventListener('iac-directory', () => {
    const host = document.getElementById('content-demandas');
    if (host && !host.classList.contains('hidden')) paint();
  });

  document.addEventListener('iac-auth-changed', async () => {
    if (!iac().isLoggedIn) {
      stopListeners();
      state.items = {};
      state.ready = false;
      return;
    }
    try { await ensureColumns(); } catch (error) { console.warn(error); }
    watchIndex();
    if (global.IACNotify) global.IACNotify.scanDeadlines();
  });

  global.IACDemands = {
    render: paint,
    list: function () { return Object.keys(state.items).map((id) => Object.assign({ id }, state.items[id])); },
    counts,
    dueState,
    open: function (id) { openDetail(id); }
  };
})(window);
