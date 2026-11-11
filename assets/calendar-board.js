(function (global) {
  const CATEGORIES = [
    ['folga', 'Folga', '#8e8e93'],
    ['reuniao', 'Reunião', '#d97706'],
    ['viagem', 'Viagem', '#7c3aed'],
    ['externa', 'Atividade externa', '#15803d'],
    ['visita', 'Visita institucional', '#1e3a8a'],
    ['capacitacao', 'Capacitação', '#0f766e'],
    ['planejamento', 'Planejamento', '#0369a1'],
    ['administrativo', 'Compromisso administrativo', '#475569'],
    ['institucional', 'Evento institucional', '#1e3a8a'],
    ['outro', 'Outro', '#64748b']
  ];
  const state = {
    cursor: new Date(),
    mode: 'month',
    events: {},
    filters: { person: '', project: '', category: '', city: '', type: '' },
    filtersOpen: false,
    hidden: {},
    error: ''
  };

  function data() { return global.IACData; }
  function iac() { return global.IAC || {}; }
  function esc(value) { return data().esc(value); }
  function courseTone(row) {
    if (!row || row.kind !== 'curso') return colorOf(row && row.category);
    if (row.phase === 'termino') return '#FF3B30';
    if (row.phase === 'andamento') return '#f5b400';
    return '#007AFF';
  }
  function colorOf(category) {
    if (category === 'curso') return '#007AFF';
    if (category === 'demanda') return '#b45309';
    const found = CATEGORIES.find((item) => item[0] === category);
    return found ? found[2] : '#64748b';
  }
  function labelOf(category) {
    if (category === 'curso') return 'Curso';
    if (category === 'demanda') return 'Prazo';
    const found = CATEGORIES.find((item) => item[0] === category);
    return found ? found[1] : 'Evento';
  }
  function isWeekend(date) { const day = date.getDay(); return day === 0 || day === 6; }
  function keyOf(date) { return global.IACDates.civilDateKey(date); }
  function parseKey(key) { return global.IACDates.parseCivilDate(key); }

  function eachWeekday(startKey, endKey, visit) {
    const start = parseKey(startKey);
    const end = parseKey(endKey || startKey);
    if (!start || !end) return;
    const cursor = new Date(start.getTime());
    while (cursor <= end) {
      if (!isWeekend(cursor)) visit(keyOf(cursor), new Date(cursor.getTime()));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  function courses() {
    const list = typeof global.__iacGetCourses === 'function' ? global.__iacGetCourses() : [];
    return (list || []).filter((course) => course && (course.dataInicio || course.dataFim) && String(course.status || '').toLowerCase().indexOf('cancel') === -1);
  }

  function demands() {
    return global.IACDemands ? global.IACDemands.list().filter((item) => item.dueDate) : [];
  }

  function eventList() {
    return Object.keys(state.events).map((id) => Object.assign({ id }, state.events[id])).filter((item) => item && item.title);
  }

  function occursOn(item, key) {
    if (item.date && String(item.date).slice(0, 10) === key && !item.startDate) {
      const date = parseKey(key);
      return date && !isWeekend(date);
    }
    const start = item.startDate || item.date;
    const end = item.endDate || item.startDate || item.date;
    if (!start) return false;
    let hit = false;
    eachWeekday(String(start).slice(0, 10), String(end).slice(0, 10), (day) => { if (day === key) hit = true; });
    return hit;
  }

  function entriesOn(key) {
    const rows = [];
    if (!state.hidden.curso) {
      courses().forEach((course) => {
        const start = global.IACDates.civilDateKey(course.dataInicio);
        const end = global.IACDates.civilDateKey(course.dataFim || course.dataInicio);
        if (!start) return;
        if (state.filters.city && String(course.municipio || '') !== state.filters.city) return;
        if (state.filters.project && String(course.lote || '') !== state.filters.project) return;
        let hit = false;
        eachWeekday(start, end, (day) => { if (day === key) hit = true; });
        if (!hit) return;
        let phase = 'andamento';
        if (start === key && end === key) phase = 'unico';
        else if (start === key) phase = 'inicio';
        else if (end === key) phase = 'termino';
        rows.push({
          kind: 'curso',
          id: course.id,
          category: 'curso',
          title: course.tipologia || course.idCurso || 'Turma',
          subtitle: [course.idCurso, course.municipio, course.status].filter(Boolean).join(' · '),
          startDate: start,
          endDate: end,
          phase: phase,
          allDay: true,
          course
        });
      });
    }
    if (!state.hidden.demanda) {
      demands().forEach((item) => {
        if (item.dueDate !== key) return;
        if (state.filters.person && !(item.responsibleIds && item.responsibleIds[state.filters.person])) return;
        rows.push({
          kind: 'demanda',
          id: item.id,
          category: 'demanda',
          title: item.title,
          subtitle: global.IACDemands.dueState(item) === 'concluida' ? 'Concluída' : 'Prazo da demanda',
          startDate: item.dueDate,
          allDay: true,
          done: global.IACDemands.dueState(item) === 'concluida',
          demand: item
        });
      });
    }
    eventList().forEach((item) => {
      if (state.hidden[item.category]) return;
      if (state.filters.category && item.category !== state.filters.category) return;
      if (state.filters.person && !(item.responsibleIds && item.responsibleIds[state.filters.person]) && !(item.participants && item.participants[state.filters.person]) && item.createdBy !== state.filters.person) return;
      if (state.filters.project && String(item.projectId || '') !== state.filters.project) return;
      if (state.filters.type === 'curso' || state.filters.type === 'demanda') return;
      if (state.filters.type && state.filters.type !== 'manual') return;
      if (!occursOn(item, key)) return;
      const mine = data().uid();
      const privateEvent = item.visibility === 'particular' && item.createdBy !== mine && !(item.participants && item.participants[mine]) && !data().isRoot();
      rows.push({
        kind: 'evento',
        id: item.id,
        category: item.category || 'outro',
        title: privateEvent && item.category === 'folga' ? 'Indisponível' : item.title,
        subtitle: privateEvent ? '' : (item.location || ''),
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        allDay: item.allDay !== false && !item.startTime,
        event: item,
        privateEvent
      });
    });
    if (state.filters.type === 'curso') return rows.filter((row) => row.kind === 'curso');
    if (state.filters.type === 'demanda') return rows.filter((row) => row.kind === 'demanda');
    return rows;
  }

  function shift(step) {
    const cursor = state.cursor;
    if (state.mode === 'month') cursor.setMonth(cursor.getMonth() + step);
    else if (state.mode === 'week') cursor.setDate(cursor.getDate() + (step * 7));
    else cursor.setDate(cursor.getDate() + step);
    while (state.mode !== 'month' && isWeekend(cursor)) cursor.setDate(cursor.getDate() + (step >= 0 ? 1 : -1));
    render();
  }

  function render() {
    const host = document.getElementById('content-calendario');
    if (!host || host.classList.contains('hidden')) return;
    const rawTitle = state.mode === 'month'
      ? state.cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : (state.mode === 'week' ? 'Semana de ' + state.cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : state.cursor.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }));
    const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
    const logged = !!(iac().isLoggedIn);
    const modes = [['month', 'Mês'], ['week', 'Semana'], ['day', 'Dia'], ['list', 'Lista']];
    host.innerHTML =
      '<div class="iac-page"><section class="iac-cal"><div class="iac-cal-bar"><div class="iac-cal-nav"><button class="iac-icon-btn" type="button" id="iac-cal-prev" aria-label="Anterior">‹</button><h2 class="iac-cal-title">' + esc(title) + '</h2><button class="iac-icon-btn" type="button" id="iac-cal-next" aria-label="Próximo">›</button></div>' +
      '<div class="iac-cal-nav"><button class="iac-btn secondary" type="button" id="iac-cal-today">Hoje</button><div class="iac-seg">' + modes.map((item) => '<button type="button" data-mode="' + item[0] + '" class="' + (state.mode === item[0] ? 'on' : '') + '">' + item[1] + '</button>').join('') + '</div>' +
      '<button class="iac-btn secondary" type="button" id="iac-cal-filter-toggle">' + (state.filtersOpen ? 'Fechar filtros' : 'Filtros') + '</button>' +
      (logged ? '<button class="iac-btn" type="button" id="iac-event-new">Novo evento</button>' : '') + '</div></div>' +
      legend() + filters() + '</section><p class="iac-status' + (state.error ? ' error' : '') + '">' + esc(state.error) + '</p>' + view() + '</div>';
    host.querySelector('#iac-cal-prev').onclick = () => shift(-1);
    host.querySelector('#iac-cal-next').onclick = () => shift(1);
    host.querySelector('#iac-cal-today').onclick = () => { state.cursor = new Date(); while (isWeekend(state.cursor)) state.cursor.setDate(state.cursor.getDate() + 1); render(); };
    host.querySelector('#iac-cal-filter-toggle').onclick = () => { state.filtersOpen = !state.filtersOpen; render(); };
    host.querySelectorAll('[data-mode]').forEach((button) => { button.onclick = () => { state.mode = button.getAttribute('data-mode'); render(); }; });
    const create = host.querySelector('#iac-event-new');
    if (create) create.onclick = () => openForm();
    host.querySelectorAll('[data-open]').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        openEntry(button.getAttribute('data-open'));
      };
    });
    host.querySelectorAll('[data-hide]').forEach((button) => {
      button.onclick = () => { state.hidden[button.getAttribute('data-hide')] = !state.hidden[button.getAttribute('data-hide')]; render(); };
    });
    ['person', 'city', 'type'].forEach((key) => {
      const input = document.getElementById('iac-cal-' + key);
      if (!input) return;
      input.value = state.filters[key];
      input.onchange = () => { state.filters[key] = input.value; render(); };
    });
  }

  function legend() {
    const phases = [['Início', '#007AFF'], ['Andamento', '#f5b400'], ['Término', '#FF3B30']];
    const items = [['demanda', 'Prazos', '#b45309'], ['reuniao', 'Reuniões', '#d97706'], ['folga', 'Folgas', '#8e8e93']];
    const courseOff = state.hidden.curso ? ' off' : '';
    return '<div class="iac-legend">' + phases.map((item) => '<button type="button" data-hide="curso" class="' + courseOff + '"><i style="background:' + item[1] + '"></i>' + item[0] + '</button>').join('') +
      items.map((item) => '<button type="button" data-hide="' + item[0] + '" class="' + (state.hidden[item[0]] ? 'off' : '') + '"><i style="background:' + item[2] + '"></i>' + item[1] + '</button>').join('') + '</div>';
  }

  function filters() {
    const people = data().people();
    const cities = Array.from(new Set(courses().map((course) => course.municipio).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return '<div class="iac-cal-filters' + (state.filtersOpen ? ' open' : '') + '"><label>Pessoa<select id="iac-cal-person"><option value="">Todas</option>' + Object.keys(people).map((id) => '<option value="' + esc(id) + '">' + esc(people[id].name) + '</option>').join('') + '</select></label>' +
      '<label>Município<select id="iac-cal-city"><option value="">Todos</option>' + cities.map((city) => '<option>' + esc(city) + '</option>').join('') + '</select></label>' +
      '<label>Mostrar<select id="iac-cal-type"><option value="">Tudo</option><option value="curso">Cursos</option><option value="manual">Eventos</option><option value="demanda">Prazos</option></select></label></div>';
  }

  function view() {
    if (state.mode === 'list') return listView();
    if (state.mode === 'day') return dayView(state.cursor);
    if (state.mode === 'week') return grid(weekDays(state.cursor), 'week');
    return grid(monthDays(state.cursor), '');
  }

  function weekDays(anchor) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + mondayOffset);
    return Array.from({ length: 5 }, (_, index) => {
      const item = new Date(date.getTime());
      item.setDate(date.getDate() + index);
      return item;
    });
  }

  function monthDays(anchor) {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    const mondayOffset = first.getDay() === 0 ? -6 : 1 - first.getDay();
    start.setDate(first.getDate() + mondayOffset);
    const days = [];
    for (let week = 0; week < 6; week += 1) {
      const row = [];
      for (let index = 0; index < 5; index += 1) {
        const item = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (week * 7) + index);
        row.push(item);
      }
      if (week > 0 && row.every((item) => item.getMonth() !== anchor.getMonth())) break;
      days.push.apply(days, row);
    }
    return days;
  }

  function grid(days, extra) {
    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const head = extra === 'week' ? '' : '<div class="iac-weekdays"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span></div>';
    return '<div class="iac-cal">' + head + '<div class="iac-cal-grid ' + extra + '">' + days.filter((date) => !isWeekend(date)).map((date) => {
      const key = keyOf(date);
      const outside = extra !== 'week' && date.getMonth() !== state.cursor.getMonth();
      const today = key === keyOf(new Date());
      const rows = entriesOn(key);
      return '<div class="iac-day' + (outside ? ' outside' : '') + (today ? ' today' : '') + '" data-open="day:' + key + '">' +
        (extra === 'week' ? '<span class="dow">' + names[date.getDay()] + '</span>' : '') +
        '<strong>' + date.getDate() + '</strong>' +
        dayBits(key, rows, 3) +
        '</div>';
    }).join('') + '</div></div>';
  }

  function dayView(date) {
    if (isWeekend(date)) return '<div class="iac-card iac-empty">O calendário mostra apenas dias úteis, de segunda a sexta.</div>';
    const key = keyOf(date);
    const rows = entriesOn(key);
    const full = rows.filter((row) => row.phase !== 'andamento');
    const ongoing = rows.some((row) => row.phase === 'andamento');
    return '<div class="iac-card"><h3>' + esc(date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })) + '</h3><div class="iac-list">' +
      (full.length ? full.map(detailCard).join('') : '') +
      (ongoing ? '<div class="iac-ongoing"><span class="iac-span"></span><p>Curso em andamento</p></div>' : '') +
      (!full.length && !ongoing ? '<div class="iac-empty">Nenhum compromisso neste dia.</div>' : '') +
      '</div></div>';
  }

  function detailCard(row) {
    const mark = markOf(row);
    return '<button class="iac-note" type="button" data-open="' + esc(row.kind + ':' + row.id) + '" style="text-align:left;border-left:4px solid ' + courseTone(row) + '"><strong>' + esc(row.title) + '</strong>' +
      (mark ? '<em class="iac-mark">' + mark + '</em>' : '') +
      '<div>' + esc(row.subtitle || labelOf(row.category)) + (row.startTime ? ' · ' + esc(row.startTime) + (row.endTime ? '–' + row.endTime : '') : '') + '</div></button>';
  }

  function listView() {
    const start = new Date();
    const rows = [];
    for (let index = 0; index < 21; index += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      if (isWeekend(date)) continue;
      entriesOn(keyOf(date)).forEach((row) => {
        if (row.phase === 'andamento') return;
        rows.push(Object.assign({ day: keyOf(date) }, row));
      });
    }
    return '<div class="iac-list">' + (rows.length ? rows.map((row) => '<button class="iac-card" type="button" data-open="' + esc(row.kind + ':' + row.id) + '" style="text-align:left;border-left:4px solid ' + courseTone(row) + '"><span class="iac-pill">' + esc(global.IACDates.formatCivilDate(row.day)) + '</span> <strong>' + esc(row.title) + '</strong><div class="iac-status">' + esc(markOf(row) || labelOf(row.category)) + '</div></button>').join('') : '<div class="iac-card iac-empty">Nenhum início ou término nos próximos dias úteis.</div>') + '</div>';
  }

  function markOf(row) {
    if (row.phase === 'inicio') return 'Início';
    if (row.phase === 'termino') return 'Término';
    if (row.phase === 'unico') return 'Início · Término';
    return '';
  }

  function dayBits(key, rows, limit) {
    const full = rows.filter((row) => row.phase !== 'andamento');
    const ongoing = rows.some((row) => row.phase === 'andamento');
    const shown = full.slice(0, limit);
    const more = full.length - shown.length;
    return shown.map(chip).join('') +
      (more > 0 ? '<button class="iac-chip more" data-open="day:' + key + '" type="button">+' + more + '</button>' : '') +
      (ongoing ? '<span class="iac-span" title="Curso em andamento"></span>' : '');
  }

  function chip(row) {
    const mark = markOf(row);
    const tone = row.phase === 'unico'
      ? 'linear-gradient(90deg,#007AFF 0 50%,#FF3B30 50% 100%)'
      : courseTone(row);
    const style = 'background:' + tone + ';color:#fff' + (row.done ? ';opacity:.55;text-decoration:line-through' : '');
    return '<button class="iac-chip" style="' + style + '" type="button" data-open="' + esc(row.kind + ':' + row.id) + '"><span>' + esc(row.title) + '</span>' + (mark ? '<em>' + mark + '</em>' : '') + '</button>';
  }

  function upcoming() {
    const today = keyOf(new Date());
    const soon = addDays(today, 7);
    const starting = courses().filter((course) => {
      const start = global.IACDates.civilDateKey(course.dataInicio);
      return start && start >= today && start <= soon;
    }).length;
    const ending = courses().filter((course) => {
      const end = global.IACDates.civilDateKey(course.dataFim);
      return end && end >= today && end <= soon;
    }).length;
    const todayCount = entriesOn(today).length;
    return '<div class="iac-card"><h3>Próximos compromissos</h3><div class="iac-row"><span class="iac-pill">Hoje: ' + todayCount + '</span><span class="iac-pill">Cursos começando: ' + starting + '</span><span class="iac-pill">Cursos terminando: ' + ending + '</span></div></div>';
  }

  function addDays(key, amount) {
    const date = parseKey(key);
    date.setDate(date.getDate() + amount);
    return keyOf(date);
  }

  function openEntry(token) {
    const parts = String(token || '').split(':');
    const kind = parts[0];
    const id = parts.slice(1).join(':');
    if (kind === 'day') {
      state.mode = 'day';
      state.cursor = parseKey(id) || new Date();
      render();
      return;
    }
    if (kind === 'curso') {
      if (typeof global.openCoursePage === 'function') global.openCoursePage(id);
      return;
    }
    if (kind === 'demanda' && global.IACDemands) {
      global.IACDemands.open(id);
      return;
    }
    const item = state.events[id];
    if (item) openForm(item);
  }

  function conflicts(candidate, ignoreId) {
    const found = [];
    const people = Object.keys(candidate.responsibleIds || {}).concat(Object.keys(candidate.participants || {}));
    eachWeekday(candidate.startDate, candidate.endDate || candidate.startDate, (key) => {
      entriesOn(key).forEach((row) => {
        if (row.kind === 'evento' && row.id === ignoreId) return;
        const samePerson = !people.length || people.some((id) => {
          if (row.kind === 'demanda') return row.demand && row.demand.responsibleIds && row.demand.responsibleIds[id];
          if (row.kind === 'evento') return (row.event.responsibleIds && row.event.responsibleIds[id]) || (row.event.participants && row.event.participants[id]);
          if (row.kind === 'curso') return String(row.course.instrutor || '').toLowerCase().indexOf(String(data().personName(id) || '').toLowerCase()) !== -1;
          return false;
        });
        if (!samePerson && !(candidate.location && row.event && row.event.location && candidate.location === row.event.location)) return;
        if (overlaps(candidate, row)) found.push(key + ' · ' + row.title);
      });
    });
    return found;
  }

  function overlaps(candidate, row) {
    if (candidate.allDay || row.allDay || !candidate.startTime || !row.startTime) return true;
    const a = toMinutes(candidate.startTime);
    const b = toMinutes(candidate.endTime || candidate.startTime) || a + 60;
    const c = toMinutes(row.startTime);
    const d = toMinutes(row.endTime || row.startTime) || c + 60;
    return a < d && c < b;
  }

  function toMinutes(value) {
    if (!value || String(value).indexOf(':') === -1) return null;
    const parts = String(value).split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function openForm(item) {
    const current = item || { category: 'reuniao', allDay: true, visibility: 'compartilhado', responsibleIds: {}, participants: {} };
    const people = data().people();
    const modal = document.createElement('div');
    modal.className = 'iac-modal';
    modal.innerHTML = '<div class="iac-backdrop"></div><div class="iac-dialog"><div class="iac-head"><h2>' + (item ? 'Evento' : 'Novo evento') + '</h2><button class="iac-btn secondary" data-close="1" type="button">Fechar</button></div>' +
      '<form class="iac-form" id="iac-event-form"><label>Título<input name="title" required maxlength="140" value="' + esc(current.title || '') + '"></label>' +
      '<div class="split"><label>Categoria<select name="category">' + CATEGORIES.map((entry) => '<option value="' + entry[0] + '"' + (current.category === entry[0] ? ' selected' : '') + '>' + entry[1] + '</option>').join('') + '</select></label>' +
      '<label>Visibilidade<select name="visibility"><option value="compartilhado"' + (current.visibility !== 'particular' ? ' selected' : '') + '>Compartilhado</option><option value="particular"' + (current.visibility === 'particular' ? ' selected' : '') + '>Particular</option></select></label></div>' +
      '<label>Descrição<textarea name="description" rows="3">' + esc(current.description || '') + '</textarea></label>' +
      '<div class="split"><label>Início<input type="date" name="startDate" required value="' + esc((current.startDate || current.date || '').slice(0, 10)) + '"></label><label>Término<input type="date" name="endDate" value="' + esc((current.endDate || current.startDate || current.date || '').slice(0, 10)) + '"></label></div>' +
      '<div class="split"><label>Horário inicial<input type="time" name="startTime" value="' + esc(current.startTime || '') + '"></label><label>Horário final<input type="time" name="endTime" value="' + esc(current.endTime || '') + '"></label></div>' +
      '<label><input type="checkbox" name="allDay"' + (current.allDay !== false && !current.startTime ? ' checked' : '') + '> Dia inteiro</label>' +
      '<label>Responsável<select name="owner">' + Object.keys(people).map((id) => '<option value="' + esc(id) + '"' + (current.responsibleIds && current.responsibleIds[id] ? ' selected' : '') + '>' + esc(people[id].name) + '</option>').join('') + '</select></label>' +
      '<label>Participantes<select name="participants" multiple size="4">' + Object.keys(people).map((id) => '<option value="' + esc(id) + '"' + (current.participants && current.participants[id] ? ' selected' : '') + '>' + esc(people[id].name) + '</option>').join('') + '</select></label>' +
      '<div class="split"><label>Local<input name="location" value="' + esc(current.location || '') + '"></label><label>Projeto<input name="projectId" value="' + esc(current.projectId || '') + '"></label></div>' +
      '<p class="iac-status error" id="iac-event-error"></p><div class="iac-row"><button class="iac-btn" type="submit">Salvar</button>' + (item ? '<button class="iac-btn danger" type="button" id="iac-event-delete">Excluir</button>' : '') + '</div></form></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick = () => modal.remove();
    modal.querySelector('.iac-backdrop').onclick = () => modal.remove();
    const remove = modal.querySelector('#iac-event-delete');
    if (remove) remove.onclick = async () => {
      if (!confirm('Excluir este evento?')) return;
      await data().write('calendarEvents/' + item.id, null);
      if (iac().logAction) iac().logAction('Evento excluído', {}, { module: 'Calendário', entityType: 'event', entityId: item.id, entityName: item.title, origin: 'Calendário' });
      if (global.IACNotify) global.IACNotify.push(Object.keys(item.participants || {}), { title: 'Evento cancelado', description: item.title, category: 'calendario', relatedType: 'event', relatedId: item.id });
      modal.remove();
    };
    modal.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById('iac-event-error');
      try {
        const startDate = form.startDate.value;
        const endDate = form.endDate.value || startDate;
        if (!startDate) throw new Error('Informe a data inicial.');
        if (endDate < startDate) throw new Error('A data final não pode ser anterior à inicial.');
        if (isWeekend(parseKey(startDate)) || isWeekend(parseKey(endDate))) throw new Error('O expediente é de segunda a sexta.');
        const participants = {};
        Array.from(form.participants.selectedOptions || []).forEach((option) => { participants[option.value] = true; });
        const responsibleIds = {};
        if (form.owner.value) responsibleIds[form.owner.value] = true;
        const record = {
          title: form.title.value.trim(),
          category: form.category.value,
          description: form.visibility.value === 'particular' ? '' : form.description.value.trim(),
          startDate, endDate,
          startTime: form.allDay.checked ? '' : form.startTime.value,
          endTime: form.allDay.checked ? '' : form.endTime.value,
          allDay: form.allDay.checked || !form.startTime.value,
          responsibleIds, participants,
          location: form.location.value.trim(),
          projectId: form.projectId.value.trim(),
          visibility: form.visibility.value,
          createdBy: (item && item.createdBy) || data().uid(),
          createdAt: item ? item.createdAt : data().stamp(),
          updatedAt: data().stamp()
        };
        if (!record.title) throw new Error('Informe o título.');
        const found = conflicts(record, item && item.id);
        if (found.length && !confirm('Há sobreposição:\n' + found.slice(0, 6).join('\n') + '\n\nDeseja salvar mesmo assim?')) return;
        const id = item ? item.id : data().newId();
        await data().write('calendarEvents/' + id, record);
        if (form.visibility.value === 'particular' && form.description.value.trim()) {
          await data().write('privateNotes/' + id, { text: form.description.value.trim(), createdBy: data().uid() });
        }
        if (iac().logAction) iac().logAction(item ? 'Evento editado' : 'Evento criado', {}, {
          module: 'Calendário', entityType: 'event', entityId: id, entityName: record.title, origin: 'Calendário',
          changes: item && iac().diffPlain ? iac().diffPlain(item, record, ['title', 'category', 'startDate', 'endDate', 'startTime', 'endTime', 'location']) : null
        });
        if (global.IACNotify && record.visibility !== 'particular') {
          global.IACNotify.push(Object.keys(participants).filter((idPerson) => idPerson !== data().uid()), {
            title: item ? 'Evento alterado' : 'Novo evento compartilhado',
            description: record.title,
            category: 'calendario',
            relatedType: 'event',
            relatedId: id
          });
        }
        modal.remove();
        data().toast('Evento salvo.', 'success');
      } catch (err) {
        error.textContent = err.message || 'Não foi possível salvar.';
      }
    };
  }

  let watched = false;
  function watch() {
    if (watched || !global.firebaseModules || !global.database) return;
    watched = true;
    global.firebaseModules.onValue(global.firebaseModules.ref(global.database, 'calendarEvents'), (snap) => {
      const value = snap.exists() ? (snap.val() || {}) : {};
      const next = {};
      Object.keys(value).forEach((key) => {
        const item = value[key];
        if (!item || typeof item !== 'object') return;
        const id = item.id || key;
        next[id] = Object.assign({ id }, item);
      });
      state.events = next;
      const host = document.getElementById('content-calendario');
      if (host && !host.classList.contains('hidden')) render();
      document.dispatchEvent(new CustomEvent('iac-calendar'));
    });
  }

  document.addEventListener('firebase-ready', watch);
  document.addEventListener('iac-auth-changed', () => { watch(); if (global.IACNotify) global.IACNotify.scanDeadlines(); });
  document.addEventListener('iac-demands', () => {
    const host = document.getElementById('content-calendario');
    if (host && !host.classList.contains('hidden')) render();
  });
  if (global.firebaseModules && global.database) watch();

  global.IACCalendar = {
    render,
    events: function () { return eventList(); },
    entriesOn,
    focus: function (dateKey) {
      const date = parseKey(String(dateKey || '').slice(0, 10));
      if (date) {
        state.cursor = date;
        state.mode = 'month';
      }
      const host = document.getElementById('content-calendario');
      if (host && !host.classList.contains('hidden')) render();
    },
    todayCount: function () { return entriesOn(keyOf(new Date())).length; }
  };
})(window);
