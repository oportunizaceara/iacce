(function (global) {
  const state = { items: {}, open: false, error: '' };
  let stop = null;
  let scanning = false;

  function data() { return global.IACData; }
  function iac() { return global.IAC || {}; }
  function esc(value) { return data().esc(value); }
  function prefs() {
    const profile = iac().profile;
    const saved = profile && profile.notifPrefs;
    return {
      demands: !saved || saved.demands !== false,
      calendar: !saved || saved.calendar !== false,
      team: !saved || saved.team !== false
    };
  }

  function list() {
    return Object.keys(state.items).map((id) => Object.assign({ id }, state.items[id]))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function unread() { return list().filter((item) => item.read !== true).length; }

  function badge() {
    const node = document.getElementById('iac-inbox-badge');
    if (!node) return;
    const count = unread();
    node.textContent = count > 99 ? '99+' : String(count);
    node.classList.toggle('hidden', count === 0);
  }

  function watch() {
    if (stop) { stop(); stop = null; }
    const user = iac().currentUser;
    if (!user || !global.firebaseModules || !global.database) {
      state.items = {};
      badge();
      return;
    }
    const reference = global.firebaseModules.ref(global.database, 'notifications/' + user.uid);
    stop = global.firebaseModules.onValue(reference, (snap) => {
      state.items = snap.exists() ? (snap.val() || {}) : {};
      state.error = '';
      badge();
      if (state.open) renderPanel();
      renderSummary();
    }, (error) => {
      state.error = 'Não foi possível ler as notificações.';
      console.warn(error);
    });
  }

  async function push(recipients, payload) {
    const category = payload.category || 'sistema';
    const unique = Array.from(new Set((recipients || []).filter(Boolean)));
    if (!unique.length || !global.firebaseModules) return;
    const updates = {};
    unique.forEach((recipient) => {
      const id = payload.id || data().newId();
      updates['notifications/' + recipient + '/' + id] = {
        recipientUid: recipient,
        actorUid: data().uid(),
        title: payload.title || 'Aviso',
        description: payload.description || '',
        category,
        relatedType: payload.relatedType || '',
        relatedId: payload.relatedId || '',
        read: false,
        createdAt: data().stamp()
      };
    });
    try { await data().patch(updates); }
    catch (error) { console.warn('Notificação não enviada', error); }
  }

  async function mark(id, read) {
    const current = state.items[id];
    if (!current) return;
    await data().write('notifications/' + data().uid() + '/' + id, Object.assign({}, current, { read: read !== false }));
  }

  async function markAll() {
    const updates = {};
    list().forEach((item) => {
      if (item.read) return;
      updates['notifications/' + data().uid() + '/' + item.id + '/read'] = true;
    });
    if (Object.keys(updates).length) await data().patch(updates);
  }

  function openRelated(item) {
    if (item.relatedType === 'demand' && global.IACDemands) {
      if (typeof global.switchTab === 'function') global.switchTab('demandas');
      global.IACDemands.open(item.relatedId);
    } else if (item.relatedType === 'event' && typeof global.switchTab === 'function') {
      global.switchTab('calendario');
    } else if (item.relatedType === 'course' && typeof global.openCoursePage === 'function') {
      global.openCoursePage(item.relatedId);
    }
    mark(item.id, true);
    state.open = false;
    const panel = document.getElementById('iac-inbox');
    if (panel) panel.remove();
  }

  function renderPanel() {
    let panel = document.getElementById('iac-inbox');
    if (!state.open) {
      if (panel) panel.remove();
      return;
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'iac-inbox';
      panel.className = 'iac-card iac-inbox';
      document.body.appendChild(panel);
    }
    const choice = state.filter || '';
    const allowed = prefs();
    const rows = list().filter((item) => {
      if (choice && item.category !== choice) return false;
      if (item.category === 'demandas' && !allowed.demands) return false;
      if (item.category === 'calendario' && !allowed.calendar) return false;
      if (item.category === 'equipe' && !allowed.team) return false;
      return true;
    });
    panel.innerHTML = '<div class="iac-head"><h2>Notificações</h2><button class="iac-btn secondary" type="button" id="iac-inbox-close">Fechar</button></div>' +
      '<div class="iac-row"><button class="iac-btn secondary" type="button" data-filter="">Todas</button><button class="iac-btn secondary" type="button" data-filter="demandas">Demandas</button><button class="iac-btn secondary" type="button" data-filter="calendario">Calendário</button><button class="iac-btn secondary" type="button" data-filter="equipe">Equipe</button><button class="iac-btn" type="button" id="iac-inbox-all">Marcar todas como lidas</button></div>' +
      '<div class="iac-checks"><label><input type="checkbox" data-pref="demands"' + (prefs().demands ? ' checked' : '') + '> Demandas</label><label><input type="checkbox" data-pref="calendar"' + (prefs().calendar ? ' checked' : '') + '> Calendário</label><label><input type="checkbox" data-pref="team"' + (prefs().team ? ' checked' : '') + '> Equipe</label></div>' +
      (state.error ? '<p class="iac-status error">' + esc(state.error) + '</p>' : '') +
      (rows.length ? rows.slice(0, 40).map((item) => {
        const moment = typeof item.createdAt === 'number' ? new Date(item.createdAt).toLocaleString('pt-BR') : '';
        return '<article class="' + (item.read ? '' : 'unread') + '" data-id="' + esc(item.id) + '"><strong>' + esc(item.title) + '</strong><div>' + esc(item.description || '') + '</div><div class="iac-status">' + esc(item.category || '') + ' · ' + esc(moment) + '</div></article>';
      }).join('') : '<div class="iac-empty">Nenhuma notificação.</div>');
    panel.querySelector('#iac-inbox-close').onclick = () => { state.open = false; renderPanel(); };
    panel.querySelector('#iac-inbox-all').onclick = () => markAll();
    panel.querySelectorAll('[data-filter]').forEach((button) => {
      button.onclick = () => { state.filter = button.getAttribute('data-filter'); renderPanel(); };
    });
    panel.querySelectorAll('[data-pref]').forEach((input) => {
      input.onchange = () => savePrefs();
    });
    panel.querySelectorAll('article[data-id]').forEach((article) => {
      article.onclick = () => {
        const item = state.items[article.getAttribute('data-id')];
        if (item) openRelated(Object.assign({ id: article.getAttribute('data-id') }, item));
      };
    });
  }

  async function savePrefs() {
    const panel = document.getElementById('iac-inbox');
    const next = { demands: true, calendar: true, team: true };
    panel.querySelectorAll('[data-pref]').forEach((input) => {
      const key = input.getAttribute('data-pref');
      next[key] = input.checked;
    });
    await data().patch({ ['users/' + data().uid() + '/notifPrefs']: next });
    if (window.__iacProfile) window.__iacProfile.notifPrefs = next;
    data().toast('Preferências salvas.', 'success');
  }

  function open() { state.open = !state.open; renderPanel(); }

  async function once(recipient, id, payload) {
    if (!recipient) return;
    try {
      const existing = await data().read('notifications/' + recipient + '/' + id);
      if (existing) return;
    } catch (error) {
      return;
    }
    await push([recipient], Object.assign({ id }, payload));
  }

  async function scanDeadlines() {
    if (scanning || !iac().isLoggedIn || !data().uid()) return;
    scanning = true;
    try {
      const today = global.IACDates.civilDateKey(new Date());
      const demands = global.IACDemands ? global.IACDemands.list() : [];
      for (const item of demands) {
        const timing = global.IACDemands.dueState(item);
        if (timing !== 'atrasada' && timing !== 'vence_hoje' && timing !== 'prazo_proximo') continue;
        const owners = Object.keys(item.responsibleIds || {});
        for (const owner of owners) {
          await once(owner, 'demand-' + timing + '-' + item.id + '-' + (item.dueDate || today), {
            title: timing === 'atrasada' ? 'Demanda atrasada' : 'Prazo próximo',
            description: item.title,
            category: 'demandas',
            relatedType: 'demand',
            relatedId: item.id
          });
        }
      }
      const courses = typeof global.__iacGetCourses === 'function' ? global.__iacGetCourses() : [];
      (courses || []).forEach((course) => {
        const start = global.IACDates.civilDateKey(course.dataInicio);
        const end = global.IACDates.civilDateKey(course.dataFim);
        const near = (key) => key && key >= today && key <= addDays(today, 7);
        if (near(start)) {
          once(data().uid(), 'course-start-' + course.id + '-' + start, {
            title: 'Curso próximo do início',
            description: course.tipologia || course.idCurso || 'Turma',
            category: 'calendario',
            relatedType: 'course',
            relatedId: course.id
          });
        }
        if (near(end)) {
          once(data().uid(), 'course-end-' + course.id + '-' + end, {
            title: 'Curso próximo do encerramento',
            description: course.tipologia || course.idCurso || 'Turma',
            category: 'calendario',
            relatedType: 'course',
            relatedId: course.id
          });
        }
      });
    } finally {
      scanning = false;
    }
  }

  function addDays(key, amount) {
    const date = global.IACDates.parseCivilDate(key);
    date.setDate(date.getDate() + amount);
    return global.IACDates.civilDateKey(date);
  }

  function renderSummary() {
    const host = document.getElementById('iac-ops-summary');
    if (!host) return;
    if (!iac().isLoggedIn) {
      host.innerHTML = '';
      return;
    }
    const people = data().people();
    const active = Object.keys(people).length;
    const demands = global.IACDemands ? global.IACDemands.counts() : { total: 0, todo: 0, doing: 0, review: 0, waiting: 0, done: 0, late: 0 };
    const courses = typeof global.__iacGetCourses === 'function' ? global.__iacGetCourses() : [];
    const today = global.IACDates.civilDateKey(new Date());
    let running = 0;
    let starting = 0;
    (courses || []).forEach((course) => {
      const start = global.IACDates.civilDateKey(course.dataInicio);
      const end = global.IACDates.civilDateKey(course.dataFim || course.dataInicio);
      if (start && end && start <= today && end >= today) running += 1;
      if (start && start > today && start <= addDays(today, 7)) starting += 1;
    });
    const eventsToday = global.IACCalendar ? global.IACCalendar.todayCount() : 0;
    const recent = (global.IAC && global.__iacGetActionLogs) ? global.__iacGetActionLogs().slice(0, 6) : [];
    host.innerHTML =
      '<section class="iac-card"><h3>Operação da equipe</h3><div class="iac-row"><span class="iac-pill">Ativos no diretório: ' + active + '</span><span class="iac-pill">Compromissos hoje: ' + eventsToday + '</span><span class="iac-pill">Demandas: ' + demands.total + '</span><span class="iac-pill">Concluídas: ' + demands.done + '</span></div></section>' +
      '<section class="iac-card"><h3>Demandas</h3><div class="iac-row"><span class="iac-pill">A fazer: ' + demands.todo + '</span><span class="iac-pill">Em andamento: ' + demands.doing + '</span><span class="iac-pill">Em revisão: ' + demands.review + '</span><span class="iac-pill">Aguardando retorno: ' + demands.waiting + '</span><span class="iac-pill atrasada">Atrasadas: ' + demands.late + '</span></div></section>' +
      '<section class="iac-card"><h3>Calendário</h3><div class="iac-row"><span class="iac-pill">Cursos em andamento: ' + running + '</span><span class="iac-pill">Começam em até 7 dias: ' + starting + '</span><span class="iac-pill">Itens de hoje: ' + eventsToday + '</span></div></section>' +
      '<section class="iac-card"><h3>Atividades recentes</h3>' + (recent.length ? recent.map((log) => '<article class="iac-note"><strong>' + esc(log.userName || log.actorName || '—') + '</strong> · ' + esc(log.action || '') + '<div class="iac-status">' + esc(log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '') + '</div></article>').join('') : '<div class="iac-empty">As operações feitas nesta sessão aparecem aqui. O histórico completo fica em Auditoria.</div>') + '</section>';
  }

  document.addEventListener('iac-auth-changed', () => {
    watch();
    renderSummary();
    setTimeout(scanDeadlines, 1500);
  });
  document.addEventListener('iac-demands', renderSummary);
  document.addEventListener('iac-calendar', renderSummary);
  document.addEventListener('iac-directory', renderSummary);

  global.IACNotify = { push, open, renderSummary, scanDeadlines, unread };
  global.IACOps = { renderSummary };
})(window);
