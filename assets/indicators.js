/* Indicadores do dashboard. Cada número abre a lista exata de cursos que o compõe. */
(function () {
  const buckets = {};

  function listCourses() {
    if (typeof window.__iacGetCourses === 'function') return window.__iacGetCourses() || [];
    return [];
  }

  function escapeHtml(value) {
    if (value == null || value === '') return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dayOf(value) {
    if (typeof window.parseCivilDate !== 'function') return null;
    const date = window.parseCivilDate(value);
    if (!date || isNaN(date.getTime())) return null;
    return date;
  }

  function today() {
    return window.IACDates ? window.IACDates.startOfToday() : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  }

  function norm(status) {
    return String(status || '').trim().toLowerCase();
  }

  function isConcluido(course) {
    const status = norm(course.status);
    return status === 'concluído' || status === 'concluido' || status === 'concluida' || status === 'concluída';
  }

  function isAndamento(course) {
    return norm(course.status).includes('andamento');
  }

  function isPendenteGrupo(course) {
    return !isConcluido(course) && !isAndamento(course);
  }

  function isEmBreve(course) {
    if (typeof window.isCourseEmBreve === 'function') return window.isCourseEmBreve(course);
    if (isConcluido(course) || isAndamento(course)) return false;
    const status = norm(course.status);
    if (status.includes('breve')) return true;
    const inicio = dayOf(course.dataInicio);
    if ((status === 'pendente' || status === '') && inicio) return inicio > today();
    return false;
  }

  function passesPageFilters(course) {
    const id = (document.getElementById('filter-id')?.value || '').trim().toLowerCase();
    const search = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
    const lote = document.getElementById('filter-lote')?.value || '';
    const municipio = document.getElementById('filter-municipio')?.value || '';
    const status = (document.getElementById('filter-status')?.value || '').trim().toLowerCase();
    if (lote && String(course.lote) !== lote) return false;
    if (municipio && String(course.municipio || '') !== municipio) return false;
    if (status) {
      const courseStatus = norm(course.status);
      if (status.includes('andamento')) {
        if (!courseStatus.includes('andamento')) return false;
      } else if (courseStatus !== status) return false;
    }
    if (search && !String(course.tipologia || '').toLowerCase().includes(search)) return false;
    if (id && !String(course.idCurso || '').toLowerCase().includes(id)) return false;
    return true;
  }

  let boardFocus = 'todos';
  let filaOpen = false;
  const compareOpen = { lot: false, city: false };
  const META_KEY = 'iac_meta_cursos';

  function missingFields(course) {
    const missing = [];
    if (!course.tipologia) missing.push('tipologia');
    if (course.lote == null || course.lote === '') missing.push('lote');
    if (!course.municipio) missing.push('município');
    if (!course.cargaHoraria) missing.push('carga horária');
    if (!dayOf(course.dataInicio)) missing.push('início');
    if (!dayOf(course.dataFim)) missing.push('término');
    return missing;
  }

  function hasInstructor(course) {
    return !!(course.instrutorId || (course.instrutor && String(course.instrutor).trim()));
  }

  function concludentesDe(course) {
    const value = Number(course.concludentes);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function percent(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  function monthKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
  }

  function monthLabel(key) {
    const parts = key.split('-');
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    const label = date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    return label.replace('.', '');
  }

  function everyone() {
    if (typeof window.__iacGetCourses === 'function') return window.__iacGetCourses() || [];
    return [];
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function inRecentDays(date, days) {
    if (!date) return false;
    const hoje = today();
    return date >= addDays(hoje, 1 - days) && date <= hoje;
  }

  function startsSoon(course) {
    if (isConcluido(course)) return false;
    const inicio = dayOf(course.dataInicio);
    if (!inicio) return false;
    const hoje = today();
    return inicio >= hoje && inicio <= addDays(hoje, 7);
  }

  function queueReasons(course) {
    const reasons = [];
    const hoje = today();
    const fim = dayOf(course.dataFim);
    const inicio = dayOf(course.dataInicio);
    const activeSoon = startsSoon(course) || (inicio && inicio <= hoje) || (fim && fim < hoje);
    if (fim && fim < hoje && !isConcluido(course)) reasons.push({ label: 'Término vencido', rank: 0, tone: '#FF3B30' });
    if (!hasInstructor(course) && !isConcluido(course) && activeSoon) reasons.push({ label: 'Sem instrutor', rank: 2, tone: '#FF9500' });
    if (startsSoon(course)) reasons.push({ label: 'Início nos próximos 7 dias', rank: 3, tone: '#007AFF' });
    return reasons.sort((a, b) => a.rank - b.rank);
  }

  function forecastText(doneCount, metaValue, list) {
    const remaining = Math.max(metaValue - doneCount, 0);
    if (!remaining) return 'A meta já foi alcançada.';
    const hoje = today();
    const start = addDays(hoje, -90);
    const recent = list.filter((course) => {
      if (!isConcluido(course)) return false;
      const fim = dayOf(course.dataFim);
      return fim && fim >= start && fim <= hoje;
    }).length;
    const pace = Math.round((recent / 3) * 10) / 10;
    const monthsLeft = Math.max(11 - hoje.getMonth() + 1, 1);
    const perMonth = Math.ceil(remaining / monthsLeft);
    const paceLabel = pace.toLocaleString('pt-BR') + (pace === 1 ? ' curso por mês' : ' cursos por mês');
    const needLabel = perMonth + (perMonth === 1 ? ' por mês' : ' por mês');
    if (pace <= 0) return 'Nenhum curso foi concluído nos últimos 3 meses. Faltam ' + remaining + ', cerca de ' + needLabel + ' até dezembro.';
    const closes = pace + 0.05 >= perMonth;
    return 'Nos últimos 3 meses a média foi ' + paceLabel + '. Faltam ' + remaining + ', cerca de ' + needLabel + ' até dezembro. Nesse ritmo, a meta ' + (closes ? 'fecha no ano.' : 'não fecha no ano.');
  }

  function gargaloOf(list) {
    const map = new Map();
    list.forEach((course) => {
      const lot = course.lote == null || course.lote === '' ? 'Sem lote' : String(course.lote);
      if (!map.has(lot)) map.set(lot, []);
      map.get(lot).push(course);
    });
    let best = null;
    map.forEach((group, lot) => {
      const done = group.filter(isConcluido).length;
      const pct = percent(done, group.length);
      const hoje = today();
      const late = group.filter((course) => {
        const fim = dayOf(course.dataFim);
        return fim && fim < hoje && !isConcluido(course);
      });
      const stuck = late.filter((course) => !hasInstructor(course));
      const score = stuck.length * 1000 + late.length * 10 + (100 - pct);
      if (!best || score > best.score) best = { lot: lot, group: group, pct: pct, late: late, stuck: stuck, score: score };
    });
    if (!best || (best.pct === 100 && !best.late.length)) {
      return { text: 'Nenhum gargalo entre os lotes. A execução está em dia.', courses: [] };
    }
    const plural = (count, one, many) => count + ' ' + (count === 1 ? one : many);
    if (best.stuck.length) {
      return {
        text: 'O lote ' + best.lot + ' está em ' + best.pct + '% e concentra ' + plural(best.stuck.length, 'turma vencida sem instrutor', 'turmas vencidas sem instrutor') + '.',
        courses: best.stuck
      };
    }
    if (best.late.length) {
      return {
        text: 'O lote ' + best.lot + ' está em ' + best.pct + '% e tem ' + plural(best.late.length, 'turma com término vencido', 'turmas com término vencido') + '.',
        courses: best.late
      };
    }
    const open = best.group.filter((course) => !isConcluido(course));
    return {
      text: 'O lote ' + best.lot + ' tem a menor execução, com ' + best.pct + '%.',
      courses: open.length ? open : best.group
    };
  }

  function remember(key, title, courses, color) {
    buckets[key] = { title: title, courses: courses, color: color || '#007AFF' };
    return key;
  }

  function card(key, label, value, hint, tone) {
    return (
      '<button type="button" class="indicator-card card-elegant rounded-[20px] p-5 text-left" data-indicator="' + key + '">' +
        '<p class="text-sm text-[#8e8e93] font-medium">' + escapeHtml(label) + '</p>' +
        '<p class="text-3xl font-semibold mt-1" style="letter-spacing:-0.03em;color:' + tone + '">' + escapeHtml(value) + '</p>' +
        '<p class="text-xs text-[#8e8e93] mt-2">' + escapeHtml(hint) + '</p>' +
      '</button>'
    );
  }

  function barRow(key, label, part, total, color) {
    const pct = percent(part, total);
    return (
      '<button type="button" class="indicator-row" data-indicator="' + key + '">' +
        '<div class="flex items-center justify-between gap-3 text-sm">' +
          '<span class="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate">' + escapeHtml(label) + '</span>' +
          '<span class="text-[#8e8e93] whitespace-nowrap">' + part + '/' + total + ' · ' + pct + '%</span>' +
        '</div>' +
        '<div class="indicator-track"><div class="indicator-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '</button>'
    );
  }

  window.openIndicatorCourses = function openIndicatorCourses(key) {
    const bucket = buckets[key];
    if (!bucket || typeof window.openCoursesModal !== 'function') return;
    window.openCoursesModal(bucket.title, bucket.courses, bucket.color);
  };

  window.renderExecutionIndicators = function renderExecutionIndicators() {
    const root = document.getElementById('execution-indicators');
    if (!root) return;

    const courses = listCourses().filter(passesPageFilters);
    Object.keys(buckets).forEach((key) => delete buckets[key]);

    const concluidos = courses.filter(isConcluido);
    const andamento = courses.filter(isAndamento);
    const emBreve = courses.filter(isEmBreve);
    const pendencias = courses.filter((course) => !isConcluido(course) && !isAndamento(course) && !isEmBreve(course));
    const pendentes = courses.filter(isPendenteGrupo);
    const hoje = today();
    const vencidos = courses.filter((course) => {
      const fim = dayOf(course.dataFim);
      return fim && fim < hoje && !isConcluido(course);
    });
    const semInstrutor = courses.filter((course) => !hasInstructor(course));
    const incompletos = courses.filter((course) => missingFields(course).length > 0);
    const comConcludentes = courses.filter((course) => concludentesDe(course) > 0);
    const totalConcludentes = courses.reduce((sum, course) => sum + concludentesDe(course), 0);

    remember('total', 'Todos os cursos cadastrados', courses, '#007AFF');
    remember('concluidos', 'Cursos concluídos', concluidos, '#34C759');
    remember('andamento', 'Cursos em andamento', andamento, '#007AFF');
    remember('em-breve', 'Cursos em breve', emBreve, '#FF9500');
    remember('pendencias', 'Pendências da operação', pendencias, '#FF3B30');
    remember('pendentes', 'Cursos pendentes ou não iniciados', pendentes, '#FF9500');
    remember('concludentes', 'Cursos com concludentes informados', comConcludentes, '#34C759');
    remember('vencidos', 'Cursos com data vencida e ainda não concluídos', vencidos, '#FF3B30');
    remember('sem-instrutor', 'Cursos sem instrutor', semInstrutor, '#FF9500');
    remember('incompletos', 'Cursos com informações incompletas', incompletos, '#FF9500');

    const lotMap = new Map();
    const cityMap = new Map();
    courses.forEach((course) => {
      const lot = course.lote == null || course.lote === '' ? 'Sem lote' : String(course.lote);
      const city = course.municipio ? String(course.municipio) : 'Sem município';
      if (!lotMap.has(lot)) lotMap.set(lot, []);
      if (!cityMap.has(city)) cityMap.set(city, []);
      lotMap.get(lot).push(course);
      cityMap.get(city).push(course);
    });

    const lotKeys = [...lotMap.keys()].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, 'pt-BR');
    });
    const cityKeys = [...cityMap.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    lotKeys.forEach((lot) => {
      const group = lotMap.get(lot);
      remember('lot:' + lot, 'Lote ' + lot + ' — cursos do percentual', group, '#007AFF');
    });
    cityKeys.forEach((city) => {
      const group = cityMap.get(city);
      remember('city:' + city, city + ' — cursos do percentual', group, '#5856D6');
    });

    const months = [];
    const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    for (let i = 5; i >= 0; i -= 1) {
      months.push(monthKey(new Date(cursor.getFullYear(), cursor.getMonth() - i, 1)));
    }
    const monthGroups = {};
    months.forEach((key) => { monthGroups[key] = []; });
    courses.forEach((course) => {
      const fim = dayOf(course.dataFim);
      if (!fim) return;
      const key = monthKey(fim);
      if (monthGroups[key]) monthGroups[key].push(course);
    });
    months.forEach((key) => {
      remember('month:' + key, 'Cursos com término em ' + monthLabel(key), monthGroups[key], '#007AFF');
    });

    const maxMonth = Math.max(1, ...months.map((key) => monthGroups[key].length));
    const monthRows = months.map((key) => {
      const group = monthGroups[key];
      const done = group.filter(isConcluido).length;
      const height = Math.max(8, Math.round((group.length / maxMonth) * 88));
      const doneHeight = group.length ? Math.round((done / group.length) * height) : 0;
      return (
        '<button type="button" class="indicator-month" data-indicator="month:' + key + '">' +
          '<div class="indicator-month-bar" style="height:' + height + 'px">' +
            '<div class="indicator-month-done" style="height:' + doneHeight + 'px"></div>' +
          '</div>' +
          '<span class="indicator-month-label">' + escapeHtml(monthLabel(key)) + '</span>' +
          '<span class="indicator-month-value">' + done + '/' + group.length + '</span>' +
        '</button>'
      );
    }).join('');

    function narrow(list) {
      if (boardFocus === 'vencidos') return list.filter((course) => vencidos.indexOf(course) !== -1);
      if (boardFocus === 'sem-instrutor') return list.filter((course) => semInstrutor.indexOf(course) !== -1);
      if (boardFocus === 'incompletos') return list.filter((course) => incompletos.indexOf(course) !== -1);
      return list;
    }

    function when(course) {
      if (typeof window.formatDate === 'function') return window.formatDate(course.dataFim) || '—';
      return course.dataFim || '—';
    }

    function boardColumn(key, title, tone, list) {
      const shown = narrow(list);
      remember('board:' + key, title, shown, tone);
      const cards = shown.slice(0, 6).map((course) => {
        const late = vencidos.indexOf(course) !== -1;
        return '<button type="button" class="board-card' + (late ? ' is-late' : '') + '" data-course="' + escapeHtml(course.id) + '">' +
          '<span class="board-kicker">' + escapeHtml(course.municipio || 'Sem município') + ' · Lote ' + escapeHtml(course.lote == null || course.lote === '' ? '—' : course.lote) + '</span>' +
          '<strong>' + escapeHtml(course.tipologia || 'Curso sem tipologia') + '</strong>' +
          '<span class="board-meta">ID ' + escapeHtml(course.idCurso || '—') + ' · fim ' + escapeHtml(when(course)) + (late ? ' · vencido' : '') + '</span>' +
        '</button>';
      }).join('');
      const more = shown.length > 6
        ? '<button type="button" class="board-more" data-indicator="board:' + key + '">Ver os ' + shown.length + '</button>'
        : '';
      return '<section class="board-col">' +
        '<header><span class="board-dot" style="background:' + tone + '"></span><h4>' + title + '</h4><b>' + shown.length + '</b></header>' +
        (cards || '<p class="board-empty">Nenhum curso neste grupo.</p>') + more +
      '</section>';
    }

    function donut() {
      const parts = [
        { key: 'concluidos', label: 'Concluídos', value: concluidos.length, color: '#34C759' },
        { key: 'andamento', label: 'Andamento', value: andamento.length, color: '#007AFF' },
        { key: 'em-breve', label: 'Em breve', value: emBreve.length, color: '#FF9500' },
        { key: 'pendencias', label: 'Pendências', value: pendencias.length, color: '#FF3B30' }
      ];
      const total = parts.reduce((sum, part) => sum + part.value, 0) || 1;
      const radius = 46;
      const circ = 2 * Math.PI * radius;
      let offset = 0;
      const rings = parts.map((part) => {
        const len = part.value ? (part.value / total) * circ : 0;
        const circle = '<circle data-indicator="' + part.key + '" cx="70" cy="70" r="' + radius + '" fill="none" stroke="' + part.color + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + Math.max(circ - len, 0).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 70 70)"></circle>';
        offset += len;
        return circle;
      }).join('');
      const legend = parts.map((part) =>
        '<button type="button" data-indicator="' + part.key + '"><i style="background:' + part.color + '"></i><span>' + part.label + '</span><b>' + part.value + '</b></button>'
      ).join('');
      return '<div class="donut-wrap"><svg viewBox="0 0 140 140" class="donut" aria-hidden="true">' + rings +
        '<text x="70" y="66" text-anchor="middle" class="donut-num">' + percent(concluidos.length, courses.length) + '%</text>' +
        '<text x="70" y="84" text-anchor="middle" class="donut-cap">execução</text></svg><div class="donut-legend">' + legend + '</div></div>';
    }

    function groupStats(entries) {
      const total = entries.reduce((sum, entry) => sum + entry.group.length, 0);
      const done = entries.reduce((sum, entry) => sum + entry.group.filter(isConcluido).length, 0);
      return { total: total, done: done, pct: percent(done, total) };
    }

    function summaryCard(id, title, entries, color) {
      const stats = groupStats(entries);
      const visible = compareOpen[id] ? entries : entries.slice(0, 4);
      const rows = visible.map((entry) => {
        const done = entry.group.filter(isConcluido).length;
        return barRow(entry.key, entry.label, done, entry.group.length, color);
      }).join('');
      const more = entries.length > 4
        ? '<button type="button" class="board-more" data-compare="' + id + '">' + (compareOpen[id] ? 'Mostrar resumo' : 'Ver os ' + entries.length) + '</button>'
        : '';
      return '<div class="card-elegant rounded-[20px] p-5 compare-card">' +
        '<div class="compare-head"><div><h4>' + title + '</h4><p>' + stats.done + ' concluídos de ' + stats.total + '</p></div><b>' + stats.pct + '%</b></div>' +
        (rows || '<p class="text-sm text-[#8e8e93]">Nenhum curso neste recorte.</p>') +
        more +
      '</div>';
    }

    const storedMeta = Number(localStorage.getItem(META_KEY));
    const meta = Number.isFinite(storedMeta) && storedMeta > 0 ? Math.round(storedMeta) : Math.max(courses.length, 1);
    const metaPct = Math.min(percent(concluidos.length, meta), 100);
    const chip = (id, label) => '<button type="button" class="focus-chip' + (boardFocus === id ? ' is-on' : '') + '" data-focus="' + id + '">' + label + '</button>';

    const lotEntries = lotKeys.map((lot) => ({ key: 'lot:' + encodeURIComponent(lot), label: 'Lote ' + lot, group: lotMap.get(lot) }));
    const cityEntries = cityKeys.map((city) => ({ key: 'city:' + encodeURIComponent(city), label: city, group: cityMap.get(city) }));
    const monthEntries = months.map((key) => ({ key: 'month:' + key, label: monthLabel(key), group: monthGroups[key] }));
    const periodStats = groupStats(monthEntries);
    const all = everyone();
    const queue = all.map((course) => ({ course: course, reasons: queueReasons(course) }))
      .filter((entry) => entry.reasons.length)
      .sort((a, b) => a.reasons[0].rank - b.reasons[0].rank || String(a.course.tipologia || '').localeCompare(String(b.course.tipologia || ''), 'pt-BR'));
    const queueShown = filaOpen ? queue : queue.slice(0, 6);
    const filaRows = queueShown.map((entry) => {
      const main = entry.reasons[0];
      const extra = entry.reasons.slice(1).map((reason) => reason.label).join(' · ');
      const course = entry.course;
      return '<button type="button" class="fila-item" data-course="' + escapeHtml(course.id) + '">' +
        '<span class="fila-tag" style="color:' + main.tone + '">' + escapeHtml(main.label) + '</span>' +
        '<strong>' + escapeHtml(course.tipologia || 'Curso sem tipologia') + '</strong>' +
        '<span>' + escapeHtml((course.municipio || 'Sem município') + ' · Lote ' + (course.lote == null || course.lote === '' ? '—' : course.lote) + ' · ID ' + (course.idCurso || '—') + (extra ? ' · ' + extra : '')) + '</span>' +
      '</button>';
    }).join('');
    const gargalo = gargaloOf(courses);
    remember('gargalo', 'Gargalo apontado nos comparativos', gargalo.courses, '#FF3B30');

    function weekBucket(title, tone, list) {
      const rows = list.slice(0, 8).map((course) =>
        '<button type="button" class="fila-item" data-course="' + escapeHtml(course.id) + '"><strong>' + escapeHtml(course.tipologia || 'Curso sem tipologia') + '</strong><span>' + escapeHtml((course.municipio || 'Sem município') + ' · Lote ' + (course.lote == null || course.lote === '' ? '—' : course.lote)) + '</span></button>'
      ).join('');
      const more = list.length > 8 ? '<p class="text-xs text-[#8e8e93] mt-2">+' + (list.length - 8) + ' cursos</p>' : '';
      return '<section class="card-elegant rounded-[20px] p-4 week-col"><header><span class="board-dot" style="background:' + tone + '"></span><h4>' + title + '</h4><b>' + list.length + '</b></header>' +
        (rows || '<p class="text-sm text-[#8e8e93]">Nada nesta semana.</p>') + more + '</section>';
    }

    const weekStart = addDays(hoje, -6);
    const weekEnd = addDays(hoje, 7);
    const entered = all.filter((course) => isAndamento(course) && inRecentDays(dayOf(course.dataInicio), 7));
    const expired = all.filter((course) => {
      const fim = dayOf(course.dataFim);
      return fim && fim < hoje && fim >= weekStart && !isConcluido(course);
    });
    const finished = all.filter((course) => {
      if (!isConcluido(course)) return false;
      const fim = dayOf(course.dataFim);
      const changed = course.lastModified && course.lastModified.at ? new Date(course.lastModified.at) : null;
      if (changed && !isNaN(changed.getTime())) changed.setHours(0, 0, 0, 0);
      return inRecentDays(fim, 7) || inRecentDays(changed, 7);
    });
    const unassigned = all.filter((course) => {
      if (hasInstructor(course) || isConcluido(course)) return false;
      const inicio = dayOf(course.dataInicio);
      const changed = course.lastModified && course.lastModified.at ? new Date(course.lastModified.at) : null;
      if (changed && !isNaN(changed.getTime())) changed.setHours(0, 0, 0, 0);
      return inRecentDays(inicio, 7) || (inicio && inicio >= hoje && inicio <= weekEnd) || inRecentDays(changed, 7);
    });

    root.innerHTML =
      '<section class="mb-4"><div class="mb-2"><h3 class="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]" style="letter-spacing:-0.02em">Fila do dia</h3><p class="text-sm text-[#8e8e93]">O que precisa de ação agora, do mais urgente ao início da semana.</p></div>' +
        (filaRows || '<p class="text-sm text-[#8e8e93]">Nenhuma turma vencida, sem instrutor ou começando nos próximos 7 dias.</p>') +
        (queue.length > 6 ? '<button type="button" class="board-more" data-fila="1">' + (filaOpen ? 'Mostrar resumo' : 'Ver os ' + queue.length) + '</button>' : '') +
      '</section>' +
      '<div class="mb-2">' +
        '<h3 class="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]" style="letter-spacing:-0.02em">Resumo</h3>' +
        '<p class="text-sm text-[#8e8e93]">Clique em um número para ver os cursos. Situação e comparativos estão em abas próprias.</p>' +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">' +
        card('total', 'Total de cursos', String(courses.length), 'Cadastrados no sistema', '#1d1d1f') +
        card('concluidos', 'Concluídos', String(concluidos.length), percent(concluidos.length, courses.length) + '% do total', '#34C759') +
        card('andamento', 'Em andamento', String(andamento.length), 'Turmas acontecendo agora', '#007AFF') +
        card('em-breve', 'Em breve', String(emBreve.length), 'Início ainda não chegou', '#FF9500') +
        card('pendencias', 'Pendências', String(pendencias.length), 'Fora de breve, andamento e conclusão', '#FF3B30') +
        card('concludentes', 'Concludentes', String(totalConcludentes), comConcludentes.length + ' curso(s) com quantidade', '#34C759') +
        card('vencidos', 'Vencidos', String(vencidos.length), 'Término passou e não concluíram', '#FF3B30') +
        card('sem-instrutor', 'Sem instrutor', String(semInstrutor.length), 'Nenhum instrutor vinculado', '#FF9500') +
        card('incompletos', 'Cadastro incompleto', String(incompletos.length), 'Falta data, município, carga ou lote', '#FF9500') +
      '</div>' +
      '<div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">' +
        '<div class="goal-card card-elegant rounded-[20px] p-5">' +
          '<div><p class="text-sm text-[#8e8e93]">Meta de cursos concluídos</p><p class="goal-pct">' + metaPct + '%</p><p class="text-sm text-[#8e8e93]">' + concluidos.length + ' de ' + meta + '</p><p class="forecast">' + escapeHtml(forecastText(concluidos.length, meta, courses)) + '</p></div>' +
          '<label class="goal-field">Meta<input id="meta-execucao" type="number" min="1" step="1" value="' + meta + '"></label>' +
          '<div class="goal-track"><div style="width:' + metaPct + '%"></div></div>' +
        '</div>' +
        '<div class="card-elegant rounded-[20px] p-5"><h4 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">Desempenho</h4>' + donut() + '</div>' +
      '</div>';

    const board = document.getElementById('situacao-board');
    if (board) {
      board.innerHTML =
        '<div class="board-head">' +
          '<div><h3 class="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Cursos por situação</h3><p class="text-sm text-[#8e8e93]">Gargalos aparecem na coluna Pendências e nos cards com término vencido.</p></div>' +
          '<div class="focus-chips">' + chip('todos', 'Todos') + chip('vencidos', 'Vencidos') + chip('sem-instrutor', 'Sem instrutor') + chip('incompletos', 'Incompletos') + '</div>' +
        '</div>' +
        '<div class="board">' +
          boardColumn('em-breve', 'Em breve', '#FF9500', emBreve) +
          boardColumn('andamento', 'Andamento', '#007AFF', andamento) +
          boardColumn('concluidos', 'Conclusão', '#34C759', concluidos) +
          boardColumn('pendencias', 'Pendências', '#FF3B30', pendencias) +
        '</div>';
    }

    const comparisons = document.getElementById('comparativos-panel');
    if (comparisons) {
      comparisons.innerHTML =
        '<div class="mb-4">' +
          '<h3 class="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]" style="letter-spacing:-0.02em">Comparativos</h3>' +
          '<p class="text-sm text-[#8e8e93]">Resumo de execução. Clique em uma barra para abrir os cursos daquele grupo.</p>' +
          (gargalo.courses.length
            ? '<button type="button" class="gargalo-line" data-indicator="gargalo">' + escapeHtml(gargalo.text) + '</button>'
            : '<p class="gargalo-line is-clear">' + escapeHtml(gargalo.text) + '</p>') +
        '</div>' +
        '<div class="compare-grid">' +
          summaryCard('lot', 'Por lote', lotEntries, '#007AFF') +
          summaryCard('city', 'Por município', cityEntries, '#5856D6') +
          '<div class="card-elegant rounded-[20px] p-5 compare-card">' +
            '<div class="compare-head"><div><h4>Por período</h4><p>' + periodStats.done + ' concluídos de ' + periodStats.total + ' nos últimos 6 meses</p></div><b>' + periodStats.pct + '%</b></div>' +
            '<div class="indicator-months">' + monthRows + '</div>' +
          '</div>' +
        '</div>';
    }

    function bind(scope) {
      if (!scope) return;
      scope.querySelectorAll('[data-indicator]').forEach((element) => {
        element.addEventListener('click', () => {
          const raw = element.getAttribute('data-indicator') || '';
          const key = raw.startsWith('lot:') || raw.startsWith('city:')
            ? raw.slice(0, raw.indexOf(':') + 1) + decodeURIComponent(raw.slice(raw.indexOf(':') + 1))
            : raw;
          window.openIndicatorCourses(key);
        });
      });
      scope.querySelectorAll('[data-course]').forEach((element) => {
        element.addEventListener('click', () => {
          const id = element.getAttribute('data-course');
          if (id && typeof window.openCoursePage === 'function') window.openCoursePage(id);
        });
      });
      scope.querySelectorAll('[data-focus]').forEach((element) => {
        element.addEventListener('click', () => {
          boardFocus = element.getAttribute('data-focus') || 'todos';
          window.renderExecutionIndicators();
        });
      });
      scope.querySelectorAll('[data-compare]').forEach((element) => {
        element.addEventListener('click', () => {
          const id = element.getAttribute('data-compare');
          if (id) compareOpen[id] = !compareOpen[id];
          window.renderExecutionIndicators();
        });
      });
      scope.querySelectorAll('[data-fila]').forEach((element) => {
        element.addEventListener('click', () => {
          filaOpen = !filaOpen;
          window.renderExecutionIndicators();
        });
      });
    }

    const week = document.getElementById('semana-panel');
    if (week) {
      week.innerHTML =
        '<div class="mb-4"><h3 class="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]" style="letter-spacing:-0.02em">Resumo da semana</h3><p class="text-sm text-[#8e8e93]">O que mudou nos últimos 7 dias. Clique em um curso para abrir a turma.</p></div>' +
        '<div class="week-grid">' +
          weekBucket('Entrou em andamento', '#007AFF', entered) +
          weekBucket('Venceu', '#FF3B30', expired) +
          weekBucket('Foi concluído', '#34C759', finished) +
          weekBucket('Ficou sem instrutor', '#FF9500', unassigned) +
        '</div>';
    }

    bind(root);
    bind(board);
    bind(comparisons);
    bind(week);
    const metaInput = document.getElementById('meta-execucao');
    if (metaInput) {
      metaInput.addEventListener('change', () => {
        const next = Math.round(Number(metaInput.value));
        if (Number.isFinite(next) && next > 0) localStorage.setItem(META_KEY, String(next));
        window.renderExecutionIndicators();
      });
    }
  };
})();
