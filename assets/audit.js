(function (global) {
  const PAGE = 25;
  const state = {
    rows: [],
    filtered: [],
    page: 0,
    loading: false,
    error: '',
    selected: null,
    presetUser: '',
    filters: { user: '', module: '', action: '', query: '', from: '', to: '', entity: '' }
  };

  function data() { return global.IACData; }
  function iac() { return global.IAC || {}; }
  function esc(value) { return data().esc(value); }

  function when(log) {
    const raw = log.createdAt || log.timestamp;
    const date = typeof raw === 'number' ? new Date(raw) : new Date(raw || 0);
    if (isNaN(date.getTime())) return { date: '—', time: '—', obj: null };
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      obj: date
    };
  }

  function changesOf(log) {
    const raw = log.changes || (log.details && log.details.changes) || null;
    if (!raw || typeof raw !== 'object') return [];
    return Object.keys(raw).map((key) => {
      const value = raw[key] || {};
      return {
        field: value.field || key,
        before: value.before !== undefined ? value.before : value.from,
        after: value.after !== undefined ? value.after : value.to
      };
    });
  }

  function textOf(value) {
    if (value == null || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function canSeeAll() {
    return !!(iac().isRootAdmin && iac().isRootAdmin()) || !!(iac().hasPerm && iac().hasPerm('audit_read'));
  }

  async function load() {
    const modules = global.firebaseModules;
    const user = iac().currentUser;
    if (!modules || !global.database || !user) {
      state.rows = [];
      state.error = 'Faça login para consultar o histórico.';
      return;
    }
    state.loading = true;
    state.error = '';
    try {
      const path = canSeeAll() ? 'actionLogs' : ('userLogs/' + user.uid);
      const snap = await modules.get(modules.ref(global.database, path));
      const value = snap.exists() ? (snap.val() || {}) : {};
      state.rows = Object.keys(value).map((id) => Object.assign({ id }, value[id])).filter((item) => item.action || item.timestamp || item.createdAt);
      state.rows.sort((a, b) => {
        const aa = typeof a.createdAt === 'number' ? a.createdAt : new Date(a.timestamp || 0).getTime();
        const bb = typeof b.createdAt === 'number' ? b.createdAt : new Date(b.timestamp || 0).getTime();
        return bb - aa;
      });
    } catch (error) {
      state.error = 'Sem permissão para ler a auditoria. Publique as regras do banco.';
      console.warn(error);
      state.rows = [];
    } finally {
      state.loading = false;
      applyFilters();
    }
  }

  function applyFilters() {
    const filters = state.filters;
    const query = filters.query.trim().toLowerCase();
    state.filtered = state.rows.filter((log) => {
      const stamp = when(log).obj;
      if (filters.user && String(log.actorUid || log.userId || '') !== filters.user && String(log.actorName || log.userName || '').toLowerCase().indexOf(filters.user.toLowerCase()) === -1) return false;
      if (filters.module && String(log.module || '') !== filters.module) return false;
      if (filters.action && String(log.action || '').toLowerCase().indexOf(filters.action.toLowerCase()) === -1) return false;
      if (filters.entity && String(log.entityId || '') !== filters.entity && String(log.entityName || '').toLowerCase().indexOf(filters.entity.toLowerCase()) === -1) return false;
      const key = stamp && global.IACDates ? global.IACDates.civilDateKey(stamp) : '';
      if (filters.from && key && key < filters.from) return false;
      if (filters.to && key && key > filters.to) return false;
      if (!query) return true;
      const blob = [log.actorName, log.userName, log.action, log.module, log.entityName, log.entityId, log.origin].join(' ').toLowerCase();
      return blob.indexOf(query) !== -1;
    });
    const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    render();
  }

  function modulesList() {
    const set = new Set();
    state.rows.forEach((log) => { if (log.module) set.add(log.module); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function pageRows() {
    const start = state.page * PAGE;
    return state.filtered.slice(start, start + PAGE);
  }

  function render() {
    const host = document.getElementById('content-auditoria');
    if (!host || host.classList.contains('hidden')) return;
    const pages = Math.max(1, Math.ceil(state.filtered.length / PAGE));
    const rows = pageRows();
    host.innerHTML =
      '<div class="iac-page"><button class="iac-btn secondary" type="button" id="iac-audit-back">← Configurações</button><div class="iac-head"><div><h2>Auditoria</h2><p>Quem alterou o quê, com o valor anterior e o novo. O histórico não é apagado junto com o registro.</p></div>' +
      '<div class="iac-row"><button class="iac-btn secondary" type="button" id="iac-audit-refresh">Atualizar</button><button class="iac-btn secondary" type="button" id="iac-audit-xls">Excel</button><button class="iac-btn" type="button" id="iac-audit-pdf">PDF</button></div></div>' +
      '<div class="iac-card iac-filters">' +
      '<label>Funcionário<select id="iac-audit-user"><option value="">Todos</option></select></label>' +
      '<label>Módulo<select id="iac-audit-module"><option value="">Todos</option>' + modulesList().map((item) => '<option>' + esc(item) + '</option>').join('') + '</select></label>' +
      '<label>Operação<input id="iac-audit-action" value="' + esc(state.filters.action) + '" placeholder="editou, excluiu..."></label>' +
      '<label>De<input id="iac-audit-from" type="date" value="' + esc(state.filters.from) + '"></label>' +
      '<label>Até<input id="iac-audit-to" type="date" value="' + esc(state.filters.to) + '"></label>' +
      '<label>Registro<input id="iac-audit-entity" value="' + esc(state.filters.entity) + '" placeholder="Nome ou ID"></label>' +
      '<label>Palavra-chave<input id="iac-audit-query" value="' + esc(state.filters.query) + '" placeholder="Pesquisar no histórico"></label>' +
      '</div><p class="iac-status' + (state.error ? ' error' : '') + '">' + esc(state.loading ? 'Carregando...' : (state.error || (state.filtered.length + ' registro(s)'))) + '</p>' +
      '<div class="iac-card iac-table-wrap">' + (rows.length ? '<table class="iac-table"><thead><tr><th>Funcionário</th><th>Ação</th><th>Módulo</th><th>Registro</th><th>Data</th><th>Horário</th></tr></thead><tbody>' +
        rows.map((log) => {
          const moment = when(log);
          return '<tr data-id="' + esc(log.id) + '"><td>' + esc(log.actorName || log.userName || '—') + '</td><td>' + esc(log.action) + '</td><td>' + esc(log.module || '—') + '</td><td>' + esc(log.entityName || log.entityId || '—') + '</td><td>' + moment.date + '</td><td>' + moment.time + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="iac-empty">Nenhuma operação encontrada com esses filtros.</div>') +
      '</div><div class="iac-row"><button class="iac-btn secondary" type="button" id="iac-audit-prev"' + (state.page <= 0 ? ' disabled' : '') + '>Anterior</button><span class="iac-status">Página ' + (state.page + 1) + ' de ' + pages + '</span><button class="iac-btn secondary" type="button" id="iac-audit-next"' + (state.page >= pages - 1 ? ' disabled' : '') + '>Próxima</button></div></div>';
    bind();
  }

  function bind() {
    const userSelect = document.getElementById('iac-audit-user');
    if (userSelect) {
      const names = {};
      state.rows.forEach((log) => {
        const key = log.actorUid || log.userId || log.actorName || log.userName;
        if (key) names[key] = log.actorName || log.userName || key;
      });
      Object.keys(names).sort((a, b) => names[a].localeCompare(names[b], 'pt-BR')).forEach((key) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = names[key];
        if (state.filters.user === key) option.selected = true;
        userSelect.appendChild(option);
      });
      userSelect.onchange = () => { state.filters.user = userSelect.value; state.page = 0; applyFilters(); };
    }
    const moduleSelect = document.getElementById('iac-audit-module');
    if (moduleSelect) {
      moduleSelect.value = state.filters.module;
      moduleSelect.onchange = () => { state.filters.module = moduleSelect.value; state.page = 0; applyFilters(); };
    }
    wire('iac-audit-action', 'action');
    wire('iac-audit-entity', 'entity');
    wire('iac-audit-query', 'query');
    const from = document.getElementById('iac-audit-from');
    const to = document.getElementById('iac-audit-to');
    if (from) from.onchange = () => { state.filters.from = from.value; state.page = 0; applyFilters(); };
    if (to) to.onchange = () => { state.filters.to = to.value; state.page = 0; applyFilters(); };
    const back = document.getElementById('iac-audit-back');
    if (back) back.onclick = () => { if (typeof global.switchTab === 'function') global.switchTab('settings'); };
    const refresh = document.getElementById('iac-audit-refresh');
    if (refresh) refresh.onclick = () => load();
    const prev = document.getElementById('iac-audit-prev');
    const next = document.getElementById('iac-audit-next');
    if (prev) prev.onclick = () => { state.page -= 1; render(); };
    if (next) next.onclick = () => { state.page += 1; render(); };
    const host = document.getElementById('content-auditoria');
    if (host) host.querySelectorAll('tr[data-id]').forEach((row) => {
      row.onclick = () => openDetail(row.getAttribute('data-id'));
    });
    const pdf = document.getElementById('iac-audit-pdf');
    const xls = document.getElementById('iac-audit-xls');
    if (pdf) pdf.onclick = exportPdf;
    if (xls) xls.onclick = exportXls;
  }

  function wire(id, key) {
    const input = document.getElementById(id);
    if (!input) return;
    input.onchange = () => {
      state.filters[key] = input.value;
      state.page = 0;
      applyFilters();
    };
  }

  function openDetail(id) {
    const log = state.rows.find((item) => item.id === id);
    if (!log) return;
    const moment = when(log);
    const changes = changesOf(log);
    const body = changes.length
      ? '<table class="iac-table"><thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead><tbody>' + changes.map((change) => '<tr><td>' + esc(change.field) + '</td><td>' + esc(textOf(change.before)) + '</td><td>' + esc(textOf(change.after)) + '</td></tr>').join('') + '</tbody></table>'
      : '<p class="iac-empty">Esta operação não registrou diferença de campos.</p>';
    const modal = document.createElement('div');
    modal.className = 'iac-modal';
    modal.innerHTML = '<div class="iac-backdrop"></div><div class="iac-dialog"><div class="iac-head"><div><h2>' + esc(log.action) + '</h2><p>' + esc(log.actorName || log.userName || '—') + ' · ' + esc(log.module || '') + ' · ' + moment.date + ' ' + moment.time + '</p></div><button class="iac-btn secondary" type="button">Fechar</button></div><p><strong>Registro:</strong> ' + esc(log.entityName || '—') + (log.entityId ? ' · ' + esc(log.entityId) : '') + '</p><p><strong>Origem:</strong> ' + esc(log.origin || '—') + '</p>' + body + '</div>';
    modal.querySelector('button').onclick = () => modal.remove();
    modal.querySelector('.iac-backdrop').onclick = () => modal.remove();
    document.body.appendChild(modal);
  }

  function exportRows() {
    return state.filtered.map((log) => {
      const moment = when(log);
      const changes = changesOf(log).map((change) => change.field + ': ' + textOf(change.before) + ' → ' + textOf(change.after)).join(' | ');
      return {
        Funcionario: log.actorName || log.userName || '',
        Acao: log.action || '',
        Modulo: log.module || '',
        Registro: log.entityName || '',
        ID: log.entityId || '',
        Data: moment.date,
        Horario: moment.time,
        Origem: log.origin || '',
        Alteracoes: changes
      };
    });
  }

  async function exportXls() {
    if (!(await global.ensureXLSX())) {
      data().toast('Não foi possível carregar a planilha.', 'error');
      return;
    }
    const rows = exportRows();
    const sheet = global.XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Nenhum registro no filtro' }]);
    const book = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(book, sheet, 'Auditoria');
    global.XLSX.writeFile(book, 'auditoria-oportuniza.xlsx');
  }

  async function exportPdf() {
    if (!(await global.ensureJsPDF())) {
      data().toast('Não foi possível carregar o PDF.', 'error');
      return;
    }
    const doc = new global.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Auditoria — Oportuniza IAC', 40, 36);
    doc.setFontSize(9);
    const filterText = 'Período: ' + (state.filters.from || 'início') + ' a ' + (state.filters.to || 'hoje') + ' · Módulo: ' + (state.filters.module || 'todos') + ' · Busca: ' + (state.filters.query || '—');
    doc.text(filterText, 40, 54);
    let y = 76;
    exportRows().slice(0, 80).forEach((row) => {
      const line = [row.Data, row.Horario, row.Funcionario, row.Acao, row.Modulo, row.Registro].join('  ·  ');
      doc.text(line.slice(0, 150), 40, y);
      y += 14;
      if (y > 540) { doc.addPage(); y = 40; }
    });
    doc.save('auditoria-oportuniza.pdf');
  }

  function openForUser(userId, name) {
    state.filters.user = userId || '';
    state.page = 0;
    if (typeof global.switchTab === 'function') global.switchTab('auditoria');
    load().then(() => {
      if (name && !state.filters.user) state.filters.query = name;
    });
  }

  global.IACAudit = {
    render: function () { load(); },
    openForUser,
    recent: function (limit) { return state.rows.slice(0, limit || 8); }
  };
})(window);
