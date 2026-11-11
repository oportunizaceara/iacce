/* IAC - Páginas dedicadas, instrutores e melhorias visuais */
const STORAGE_KEY_INSTRUCTORS = 'instructors_data';
const STORAGE_KEY_WIDGETS = 'dashboard_widgets_order';
const DEFAULT_WIDGETS = ['summary', 'actions', 'filters', 'indicators', 'lots'];

function iacIsLoggedIn() {
  if (typeof window.__iacIsLoggedIn === 'function') return window.__iacIsLoggedIn();
  return !!window.__iacIsLoggedIn;
}

function iacCourses() {
  if (typeof window.__iacGetCourses === 'function') return window.__iacGetCourses();
  return Array.isArray(window.__iacCourses) ? window.__iacCourses : [];
}

function getInstructorsData() {
  if (!window.instructors || typeof window.instructors !== 'object') {
    window.instructors = {};
  }
  return window.instructors;
}

let currentCoursePageId = null;
let currentInstructorPageId = null;
let currentCourseSection = 'overview';
function initialTabName() {
  try {
    const hash = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    const known = ['dashboard', 'cronograma', 'tarefas', 'settings', 'instructors', 'demandas', 'calendario', 'auditoria', 'equipe'];
    if (known.includes(hash)) return hash;
    if (hash.startsWith('instructor/')) return 'instructors';
    const saved = sessionStorage.getItem('iac-active-tab') || '';
    if (known.includes(saved)) return saved;
    if (saved.startsWith('instructor/')) return 'instructors';
  } catch (error) {}
  return 'dashboard';
}
let lastActiveTab = initialTabName();
let instructorCourseSearchOpen = false;
  const instructorBoard = { q: '', area: '', contrato: '', pendencia: '' };
  const INSTRUCTOR_AREAS = ['Gastronomia', 'Maquiagem', 'Penteado', 'Alongamento de unha', 'Eletricista', 'Pintura industrial', 'Outra'];

  function instructorEditGuard() {
    if (typeof window.requireInstructorEditAccess === 'function') return window.requireInstructorEditAccess();
    if (typeof window.requireEditAccess === 'function') return window.requireEditAccess();
    if (typeof requireEditAccess === 'function') return requireEditAccess();
    if (typeof window.openLoginModal === 'function') {
      window.openLoginModal();
      return false;
    }
    return false;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getCourseById(id) {
    return iacCourses().find(c => c.id === id);
  }

  function setTabPanelVisible(el, visible) {
    if (!el) return;
    if (visible) {
      el.classList.remove('hidden');
      el.style.display = '';
    } else {
      el.classList.add('hidden');
    }
  }

  const APP_PAGES = ['dashboard', 'situacao', 'comparativos', 'semana', 'cronograma', 'tarefas', 'demandas', 'calendario', 'auditoria', 'equipe', 'settings', 'instructors', 'instructor'];

  function restoreActiveTabPanels() {
    if (currentInstructorPageId) {
      ensureInstructorPageVisible();
      return;
    }
    const tab = (window.__iacActiveTab && String(window.__iacActiveTab)) || lastActiveTab || 'dashboard';
    lastActiveTab = tab;
    APP_PAGES.forEach((name) => {
      setTabPanelVisible(document.getElementById(`content-${name}`), name === tab);
    });
    if (tab === 'demandas' && window.IACDemands) window.IACDemands.render();
    if (tab === 'calendario' && window.IACCalendar) window.IACCalendar.render();
    if (tab === 'auditoria' && window.IACAudit) window.IACAudit.render();
    if (tab === 'equipe' && window.IACTeam) window.IACTeam.render();
  }

  function hideAllPages() {
    APP_PAGES.forEach((name) => {
      const el = document.getElementById(`content-${name}`);
      if (el) el.classList.add('hidden');
    });
  }

  function ensureInstructorPageVisible() {
    if (!currentInstructorPageId) return;
    hideAllPages();
    setTabPanelVisible(document.getElementById('content-instructor'), true);
    setActiveTabButton('instructors');
  }

  window.backToInstructorsList = function backToInstructorsList() {
    currentInstructorPageId = null;
    instructorCourseSearchOpen = false;
    location.hash = 'instructors';
    if (typeof window.switchTab === 'function') window.switchTab('instructors');
  };

  function closeCourseModal() {
    const modal = document.getElementById('course-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('is-open', 'is-closing');
    document.body.classList.remove('modal-open');
  }

  function finishCourseModalClose(modal) {
    if (!modal || modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    modal.classList.remove('is-closing');
    document.body.classList.remove('modal-open');
  }

  /* ── Página do curso (modal) ── */
  window.openCoursePage = function openCoursePage(courseId) {
    const course = getCourseById(courseId);
    if (!course) return;
    currentCoursePageId = courseId;
    currentCourseSection = 'overview';
    const modal = document.getElementById('course-modal');
    if (modal) {
      const already = modal.classList.contains('is-open') && !modal.classList.contains('hidden');
      modal.classList.remove('hidden', 'is-closing');
      document.body.classList.add('modal-open');
      if (!already) {
        modal.classList.remove('is-open');
        requestAnimationFrame(() => modal.classList.add('is-open'));
      }
    }
    renderCoursePage(courseId);
  };

  window.closeCoursePage = function closeCoursePage() {
    const modal = document.getElementById('course-modal');
    currentCoursePageId = null;
    if (!modal || modal.classList.contains('hidden') || modal.classList.contains('is-closing')) return;
    modal.classList.remove('is-open');
    modal.classList.add('is-closing');
    const panel = modal.querySelector('.course-modal-panel');
    if (panel) panel.addEventListener('animationend', () => finishCourseModalClose(modal), { once: true });
    setTimeout(() => finishCourseModalClose(modal), 360);
  };

  function setActiveTabButton(tab) {
    const tabs = ['dashboard', 'situacao', 'comparativos', 'semana', 'cronograma', 'tarefas', 'demandas', 'calendario', 'auditoria', 'equipe', 'settings', 'instructors'];
    tabs.forEach((t) => {
      const tabEl = document.getElementById(`tab-${t}`);
      const tabMobileEl = document.getElementById(`tab-${t}-mobile`);
      if (tabEl) {
        tabEl.classList.toggle('active', t === tab);
        tabEl.classList.toggle('text-[#1d1d1f]', t === tab);
        tabEl.classList.toggle('dark:text-[#f5f5f7]', t === tab);
        tabEl.classList.toggle('text-[#8e8e93]', t !== tab);
      }
      if (tabMobileEl) {
        tabMobileEl.classList.toggle('active', t === tab);
        tabMobileEl.classList.toggle('border-[#007AFF]', t === tab);
        tabMobileEl.classList.toggle('border-transparent', t !== tab);
      }
    });
  }


  window.setCourseSection = function setCourseSection(section) {
    const restricted = ['checklist', 'timeline', 'observacoes'];
    if (restricted.includes(section) && !iacIsLoggedIn()) {
      showToast('Faça login para acessar esta seção.', 'error');
      return;
    }
    currentCourseSection = section;
    renderCoursePage(currentCoursePageId);
  };

  function getCourseTimeline(course) {
    const items = [];
    if (course.dataInicio) items.push({ date: course.dataInicio, label: 'Início da turma', icon: '🟢' });
    if (course.dataFim) items.push({ date: course.dataFim, label: 'Término previsto', icon: '🔴' });
      const state = courseChecklists?.[course.id];
    if (state) {
      [...(state.inicializacao || []), ...(state.emAndamento || [])].filter(i => i.checked).forEach((item) => {
        items.push({ date: null, label: `✓ ${item.label}`, icon: '✅' });
      });
    }
    if (course.turmaFormada) items.push({ date: null, label: 'Turma formada', icon: '🏁' });
    return items;
  }

  function courseAddressText(course) {
    const street = String(course.endereco || '').trim();
    const city = String(course.municipio || '').trim();
    if (!street && !city) return '';
    if (!street) return city + ' - CE';
    if (city && street.toLowerCase().indexOf(city.toLowerCase()) === -1) return street + '\n' + city + ' - CE';
    return street;
  }

  function courseMapsQuery(course) {
    const address = courseAddressText(course).replace(/\n/g, ', ');
    if (!address) return '';
    return address + ', Ceará, Brasil';
  }

  function courseProgressPercent(course) {
    const status = String(course.status || '').toLowerCase();
    if (status.indexOf('conclu') !== -1) return 100;
    if (status.indexOf('andamento') !== -1) return 72;
    if (status.indexOf('breve') !== -1) return 36;
    if (status.indexOf('atras') !== -1) return 48;
    return 12;
  }

  function courseStatusTone(course) {
    const status = String(course.status || '').toLowerCase();
    if (status.indexOf('conclu') !== -1) return 'done';
    if (status.indexOf('andamento') !== -1) return 'live';
    if (status.indexOf('atras') !== -1) return 'late';
    return 'soon';
  }

  function courseNorm(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function artSvg(body) {
    return `<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">${body}</svg>`;
  }

  function courseIllustration(tipologia) {
    const name = courseNorm(tipologia);
    const themes = [
      [/cilio|sobrancelha|maquiagem|makeup|visagismo/, artSvg('<path d="M39 3c3.4 0 6 2.6 6 6v6H33V9c0-3.4 2.6-6 6-6z"/><path d="M31 17h16v7H31z"/><path d="M33.5 26h11L43 54.5c-.3 2.2-2 3.5-4.5 3.5s-4.2-1.3-4.5-3.5L33.5 26z"/><path fill-rule="evenodd" d="M16 28a12 12 0 1 0 .1 0zM16 34.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/>')],
      [/unha|alongamento|manicur|acrigel|esmalte/, artSvg('<path d="M6 34c0-14 3.2-22 8-22s8 8 8 22v14c0 7-3.4 12-8 12s-8-5-8-12V34z"/><path d="M25 26c0-14 3.2-22 8-22s8 8 8 22v22c0 7-3.4 12-8 12s-8-5-8-12V26z"/><path d="M44 34c0-14 3.2-22 8-22s8 8 8 22v14c0 7-3.4 12-8 12s-8-5-8-12V34z"/>')],
      [/penteado|cabelo|cabeleir|tranca|escova|barbear|pente/, artSvg('<path d="M5 12h54c1.4 0 2.2 1.3 1.8 2.6L56 28H8L3.2 14.6C2.8 13.3 3.6 12 5 12z"/><rect x="10" y="28" width="7" height="28" rx="3.5"/><rect x="21" y="28" width="7" height="28" rx="3.5"/><rect x="32" y="28" width="7" height="28" rx="3.5"/><rect x="43" y="28" width="7" height="22" rx="3.5"/><rect x="52" y="28" width="7" height="14" rx="3.5"/>')],
      [/hambur|sanduich|lanche|burger|cachorro/, artSvg('<path fill-rule="evenodd" d="M6 32C6 19 16.5 10 32 10s26 9 26 22v3H6v-3zM18 24a2.6 2.6 0 1 0 .1 0zM32 21a3 3 0 1 0 .1 0zM46 25a2.4 2.4 0 1 0 .1 0z"/><path d="M8 39h48v6c0 1.6-1.3 2.8-3 2.8H11c-1.7 0-3-1.2-3-2.8v-6z"/><path d="M11 52h42c.6 6.4-8.4 11-21 11S10.4 58.4 11 52z"/>')],
      [/espet/, artSvg('<rect x="30" y="3" width="4" height="58" rx="2"/><circle cx="32" cy="18" r="8"/><circle cx="32" cy="34" r="8"/><circle cx="32" cy="50" r="7"/>')],
      [/drinque|coquet|cocktail|barman/, artSvg('<path fill-rule="evenodd" d="M8 6h48L37 34h-10L8 6zm24 12a4 4 0 1 0 .1 0z"/><rect x="30" y="34" width="4" height="16" rx="1"/><rect x="16" y="50" width="32" height="5" rx="2.5"/>')],
      [/comida de rua|pastel|tapioca|acaraje|salgad|pratinho/, artSvg('<path d="M12 40c1.2-16 8.4-26 20-26s18.8 10 20 26H12z"/><path d="M4 42h56c0 8-11 14-28 14S4 50 4 42z"/><circle cx="32" cy="10" r="3.2"/>')],
      [/eletrodomest|eletrodom|geladeira|lavadora/, artSvg('<path fill-rule="evenodd" d="M10 4h44a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6zM32 20a13 13 0 1 0 .1 0z"/>')],
      [/eletric/, artSvg('<path d="M37 2 11 36h16L22 62l31-40H36L37 2z"/>')],
      [/costura|roupa|confec|alfaiat|maquina de costura/, artSvg('<rect x="4" y="48" width="56" height="12" rx="3"/><path fill-rule="evenodd" d="M14 48V30h16V16h12c8 0 14 6 14 14v18H14zm30-20a5.5 5.5 0 1 0 .1 0z"/><rect x="28" y="4" width="9" height="12" rx="2"/><rect x="47" y="40" width="3" height="10" rx="1"/>')],
      [/bijuter|joia|artesanat|micanga|colar/, artSvg('<path fill-rule="evenodd" d="M10 12c.4 16 8.2 26 22 38 13.8-12 21.6-22 22-38-2.2 0-4 .2-4 2.2 0 12-6.6 20-18 28-11.4-8-18-16-18-28 0-2-1.8-2.2-4-2.2z"/><path d="M32 42l8 7-8 13-8-13 8-7z"/>')],
      [/bike|biciclet|moto/, artSvg('<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="15" cy="46" r="11"/><circle cx="49" cy="46" r="11"/><path d="M15 46 28 22h16l5 24M28 22l11 24M44 22l6-10h8"/></g>')],
      [/vidrac|vidro/, artSvg('<path fill-rule="evenodd" d="M6 6h52v52H6V6zm8 8v16h16V14H14zm22 0v16h16V14H36zM14 36v16h16V36H14zm22 0v16h16V36H36z"/>')],
      [/gesseir|gesso|reboco/, artSvg('<rect x="6" y="20" width="48" height="16" rx="3"/><rect x="29" y="36" width="6" height="20" rx="3"/>')],
      [/pedreir|alvenar|tijolo|obra/, artSvg('<rect x="6" y="8" width="24" height="13" rx="2"/><rect x="34" y="8" width="24" height="13" rx="2"/><rect x="6" y="25" width="14" height="13" rx="2"/><rect x="24" y="25" width="16" height="13" rx="2"/><rect x="44" y="25" width="14" height="13" rx="2"/><rect x="6" y="42" width="24" height="13" rx="2"/><rect x="34" y="42" width="24" height="13" rx="2"/>')],
      [/compost|adubo|horta organica/, artSvg('<rect x="14" y="12" width="36" height="8" rx="3"/><path d="M18 20h28v32c0 6-6 10-14 10s-14-4-14-10V20z"/>')],
      [/poda|arbori|arvore|paisag/, artSvg('<circle cx="24" cy="28" r="13"/><circle cx="42" cy="26" r="12"/><circle cx="32" cy="16" r="12"/><rect x="29" y="34" width="6" height="20" rx="3"/><path d="M16 54h32v5H16z"/>')],
      [/jardin|planta|horta|flor/, artSvg('<path d="M32 38C32 18 48 10 54 10c-3 12-10 20-22 28z"/><path d="M32 38C32 18 16 10 10 10c3 12 10 20 22 28z"/><path d="M17 36h30l-4 20H21L17 36z"/><rect x="15" y="33" width="34" height="6" rx="2"/>')],
      [/pintur|pintor/, artSvg('<rect x="12" y="6" width="42" height="16" rx="5"/><rect x="18" y="22" width="6" height="16" rx="2"/><path d="M8 38h26c2 0 3 1.6 3 3.4v2.2c0 2.4-2 4.4-4.4 4.4H12c-3.2 0-6-2.4-6-5.4v-.8c0-2 1-3.8 2-3.8z"/>')],
      [/informat|computador|excel|digit/, artSvg('<path fill-rule="evenodd" d="M7 10h50a3 3 0 0 1 3 3v30H4V13a3 3 0 0 1 3-3zm7 7h36v18H14V17z"/><path d="M0 46h64l-5 10H5L0 46z"/>')],
      [/sopa|caldo|gastronom|culinari|bolo|doce|pizza|comida|confeit|panific|consume/, artSvg('<ellipse cx="32" cy="24" rx="24" ry="7"/><path d="M8 26h48c0 16-10 30-24 30S8 42 8 26z"/>')]
    ];
    const found = themes.find(([pattern]) => pattern.test(name));
    return found ? found[1] : artSvg('<path fill-rule="evenodd" d="M8 10h48v44H8V10zm8 10h32v5H16v-5zm0 12h22v5H16v-5zm0 12h16v5H16v-5z"/>');
  }

  function mountCourseMap(query) {
    const host = document.getElementById('course-live-map');
    if (!host || !query) return;
    const src = 'https://www.google.com/maps?q=' + encodeURIComponent(query) + '&z=16&output=embed&hl=pt-BR';
    host.innerHTML = '<iframe title="Mapa do endereço do curso" src="' + src.replace(/"/g, '%22') + '" loading="eager" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
  }

  function courseHttpLink(value) {
    const raw = String(value || '').trim();
    return /^https?:\/\//i.test(raw) ? raw : '';
  }

  function detailIcon(name) {
    const paths = {
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
      user: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.2-3 3.4-4.5 7-4.5S17.8 16 19 19"/>',
      check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
      note: '<path d="M7 4h8l4 4v12H7z"/><path d="M15 4v4h4M9 12h6M9 16h4"/>',
      pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/>',
      clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
      home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
      people: '<circle cx="9" cy="9" r="2.2"/><circle cx="15" cy="9" r="2.2"/><path d="M4.5 18c.6-2.4 2.4-3.6 4.5-3.6s3.9 1.2 4.5 3.6M13 14.4c2 .1 3.6 1.2 4.5 3.6"/>',
      cap: '<path d="M3 10l9-5 9 5-9 5-9-5z"/><path d="M7 12.2V16c1.6 1.2 3.2 1.8 5 1.8s3.4-.6 5-1.8v-3.8"/>',
      photo: '<rect x="4" y="6" width="16" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M9 6l1.2-1.6h3.6L15 6"/>',
      folder: '<path d="M4 8a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.info}</svg>`;
  }

  function renderCourseSectionContent(course) {
    const canEdit = typeof canEditCourses === 'function' && canEditCourses();
    const instructorName = course.instrutor || getInstructorName(course.instrutorId) || '';
    const inst = course.instrutorId ? getInstructorsData()[course.instrutorId] : null;
    const sections = {
      cronograma: () => {
        const items = getCourseTimeline(course);
        if (!items.length) return '<p class="cdetail-empty">Nenhuma data registrada neste curso.</p>';
        return `<div class="course-timeline">${items.map((item) => `
          <div class="course-timeline-item">
            <span class="course-timeline-dot">${item.icon}</span>
            <div><strong>${escapeHtml(item.label)}</strong>${item.date ? `<br><small>${formatDate(item.date)}</small>` : ''}</div>
          </div>`).join('')}</div>`;
      },
      instrutor: () => instructorName ? `
        <div class="cdetail-person">
          <span class="cdetail-person-avatar">${escapeHtml(instructorName.charAt(0))}</span>
          <div>
            <strong>${escapeHtml(instructorName)}</strong>
            <small>${escapeHtml(inst && inst.area ? inst.area : 'Instrutor vinculado')}</small>
            ${inst && inst.telefone ? `<small>${escapeHtml(inst.telefone)}</small>` : ''}
          </div>
          ${course.instrutorId ? `<button type="button" class="course-link-btn course-link-btn--outline" onclick="closeCoursePage(); openInstructorPage('${course.instrutorId}')">Abrir cadastro</button>` : ''}
        </div>` : '<p class="cdetail-empty">Nenhum instrutor vinculado.</p>',
      checklist: () => `
        <div class="course-section-panel">
          <button onclick="openTarefasChecklistModal('${course.id}')" class="course-link-btn">Abrir checklist completo</button>
        </div>`,
      observacoes: () => `
        <div class="course-section-panel">
          ${canEdit
            ? `<textarea id="course-obs-input" class="w-full p-4 rounded-xl border" rows="5" placeholder="Observações...">${escapeHtml(course.observacoes || '')}</textarea>
               <button onclick="saveCourseObservacoes('${course.id}')" class="course-link-btn mt-3">Salvar observações</button>`
            : `<p>${escapeHtml(course.observacoes || 'Sem observações.')}</p>`}
        </div>`
    };
    const render = sections[currentCourseSection];
    if (!render) return '';
    return `<div class="cdetail-section"><h3>${escapeHtml(currentCourseSection === 'cronograma' ? 'Cronograma' : currentCourseSection === 'instrutor' ? 'Instrutor' : currentCourseSection === 'checklist' ? 'Checklist' : 'Observações')}</h3>${render()}</div>`;
  }

  function renderCourseOverview(course) {
    const canEdit = typeof canEditCourses === 'function' && canEditCourses();
    const logged = iacIsLoggedIn();
    const instructorName = course.instrutor || getInstructorName(course.instrutorId) || 'Não informado';
    const periodStart = course.dataInicio ? formatDate(course.dataInicio) : '—';
    const periodEnd = course.dataFim ? formatDate(course.dataFim) : '—';
    const hours = course.cargaHoraria ? course.cargaHoraria + 'h' : '—';
    const kitchen = course.cozinha || '—';
    const address = courseAddressText(course);
    const query = courseMapsQuery(course);
    const mapHref = query ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query) : '';
    const percent = courseProgressPercent(course);
    const tone = courseStatusTone(course);
    const students = course.concludentes != null && course.concludentes !== '' ? course.concludentes : '—';
    const status = course.status || 'Pendente';
    const note = String(course.observacoes || '').trim();
    const art = courseIllustration(course.tipologia);
    const album = courseHttpLink(course.albumLink);
    const instrumentais = courseHttpLink(course.instrumentaisLink);
    const links = [
      album ? `<a class="cdetail-link cdetail-link--album" href="${escapeHtml(album)}" target="_blank" rel="noopener">${detailIcon('photo')} Álbum</a>` : '',
      instrumentais ? `<a class="cdetail-link cdetail-link--files" href="${escapeHtml(instrumentais)}" target="_blank" rel="noopener">${detailIcon('folder')} Instrumentais</a>` : ''
    ].filter(Boolean).join('');
    return `
      <header class="cdetail-banner">
        <span class="cdetail-logo">${art}</span>
        <div class="cdetail-banner-text">
          <h1>${escapeHtml(course.tipologia || 'Curso')}</h1>
          <div class="cdetail-banner-meta">
            <span class="cdetail-pill cdetail-pill--${tone}">${escapeHtml(status)}</span>
            <span>ID: ${escapeHtml(course.idCurso || '—')}</span>
          </div>
        </div>
        <div class="cdetail-actions">
          ${canEdit ? `<button type="button" class="cdetail-btn cdetail-btn--tiny ${course.turmaFormada ? 'is-on' : ''}" onclick="toggleTurmaFormada('${course.id}')">${course.turmaFormada ? 'Turma formada' : 'Formar turma'}</button>` : ''}
          ${canEdit ? `<button type="button" class="cdetail-btn" onclick="openCronogramaCourseModal('${course.id}')">${detailIcon('note')} Editar</button>` : ''}
          ${logged ? `<button type="button" class="cdetail-btn" onclick="viewCourseOnCalendar('${course.id}')">${detailIcon('cal')} Calendário</button>` : ''}
          <button type="button" class="cdetail-x" onclick="closeCoursePage()" aria-label="Fechar">×</button>
        </div>
        <span class="cdetail-scene" aria-hidden="true">${art}</span>
      </header>
      <div class="cdetail-body">
        <div class="cdetail-facts">
          <article><span class="cdetail-fact-icon">${detailIcon('user')}</span><div><small>Instrutor(a)</small><strong>${escapeHtml(instructorName)}</strong></div></article>
          <article><span class="cdetail-fact-icon cdetail-fact-icon--blue">${detailIcon('cal')}</span><div><small>Período</small><strong>${escapeHtml(periodStart)} → ${escapeHtml(periodEnd)}</strong></div></article>
          <article><span class="cdetail-fact-icon cdetail-fact-icon--green">${detailIcon('clock')}</span><div><small>Carga horária</small><strong>${escapeHtml(hours)}</strong></div></article>
          <article><span class="cdetail-fact-icon cdetail-fact-icon--amber">${detailIcon('home')}</span><div><small>Cozinha</small><strong>${escapeHtml(kitchen)}</strong></div></article>
        </div>
        ${links ? `<div class="cdetail-links">${links}</div>` : ''}
        <div class="cdetail-stage">
          <section class="cdetail-address">
            <div class="cdetail-address-copy">
              <h3>${detailIcon('pin')} Endereço</h3>
              <p>${address ? escapeHtml(address).replace(/\n/g, '<br>') : 'Endereço ainda não cadastrado.'}</p>
              ${mapHref ? `<a class="cdetail-map-link" href="${escapeHtml(mapHref)}" target="_blank" rel="noopener">${detailIcon('pin')} Ver no mapa</a>` : ''}
            </div>
            <div class="cdetail-map" id="course-live-map">
              ${query ? '' : '<div class="cdetail-map-empty">O mapa aparece quando o endereço do curso for cadastrado.</div>'}
            </div>
          </section>
          <article class="cdetail-status">
            <h3>Status do curso</h3>
            <div class="cdetail-ring cdetail-ring--${tone}" style="--p:${percent}"><span>${percent}%</span></div>
            <small>${escapeHtml(status)}</small>
          </article>
        </div>
        <div class="cdetail-chips">
          <div><span class="cdetail-fact-icon">${detailIcon('people')}</span><div><strong>${escapeHtml(students)}</strong><small>Concludentes</small></div></div>
          <div><span class="cdetail-fact-icon cdetail-fact-icon--amber">${detailIcon('info')}</span><div><strong>${escapeHtml(course.lote || '—')}</strong><small>Lote</small></div></div>
          <div><span class="cdetail-fact-icon cdetail-fact-icon--blue">${detailIcon('cal')}</span><div><strong>${course.dataFim ? formatDate(course.dataFim) : '—'}</strong><small>Conclusão prevista</small></div></div>
          <div><span class="cdetail-fact-icon cdetail-fact-icon--green">${detailIcon('clock')}</span><div><strong>${escapeHtml(course.turno || '—')}</strong><small>Turno</small></div></div>
          <div><span class="cdetail-fact-icon">${detailIcon('pin')}</span><div><strong>${escapeHtml(course.municipio || '—')}</strong><small>Município</small></div></div>
        </div>
        ${(note || canEdit) ? `
          <section class="cdetail-note">
            <h3>Observações</h3>
            ${canEdit
              ? `<textarea id="course-obs-input" rows="2" placeholder="Observações...">${escapeHtml(note)}</textarea>
                 <button type="button" class="cdetail-btn cdetail-btn--line cdetail-btn--save" onclick="saveCourseObservacoes('${course.id}')">Salvar</button>`
              : `<p>${escapeHtml(note)}</p>`}
          </section>` : ''}
      </div>`;
  }

  function getWhatsAppLink(telefone) {
    if (!telefone) return '';
    const digits = String(telefone).replace(/\D/g, '');
    if (!digits) return '';
    const num = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${num}`;
  }

  function whatsAppIconSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
  }

  function phoneInfoItem(telefone) {
    const wa = getWhatsAppLink(telefone);
    return `<div class="course-info-item">
      <span class="course-info-icon">📱</span>
      <div>
        <small>Telefone</small>
        <div class="flex items-center gap-2 flex-wrap">
          <strong>${escapeHtml(telefone || '-')}</strong>
          ${wa ? `<a href="${wa}" target="_blank" rel="noopener" class="instructor-wa-btn" title="Abrir WhatsApp">${whatsAppIconSvg()}</a>` : ''}
        </div>
      </div>
    </div>`;
  }

  function formatPagamentoValor(valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const str = String(valor).replace(/[^\d,.-]/g, '').replace(',', '.');
    const num = parseFloat(str);
    if (Number.isNaN(num)) return escapeHtml(String(valor));
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function instructorPhoneMeta(telefone) {
    const wa = getWhatsAppLink(telefone);
    const phone = escapeHtml(telefone || '-');
    return `<span class="instructor-phone-meta">
      📱 ${phone}
      ${wa ? `<a href="${wa}" target="_blank" rel="noopener" class="instructor-wa-btn instructor-wa-btn--sm" title="WhatsApp" onclick="event.stopPropagation()">${whatsAppIconSvg()}</a>` : ''}
    </span>`;
  }

  window.renderCoursePage = function renderCoursePage(courseId) {
    const container = document.getElementById('course-page-content');
    if (!container) return;
    const course = getCourseById(courseId);
    if (!course) {
      container.innerHTML = '<p>Curso não encontrado.</p>';
      return;
    }

    container.innerHTML = `<div class="cdetail">${renderCourseOverview(course)}</div>`;
    mountCourseMap(courseMapsQuery(course));
  };

  window.viewCourseOnCalendar = function viewCourseOnCalendar(courseId) {
    const course = getCourseById(courseId);
    if (course && course.dataInicio && window.IACCalendar && typeof window.IACCalendar.focus === 'function') {
      window.IACCalendar.focus(course.dataInicio);
    }
    closeCoursePage();
    if (typeof switchTab === 'function') switchTab('calendario');
  };

  window.saveCourseObservacoes = async function saveCourseObservacoes(courseId) {
    const input = document.getElementById('course-obs-input');
    if (!input || !requireEditAccess()) return;
    const course = getCourseById(courseId);
    if (!course) return;
    course.observacoes = input.value.trim();
    if (typeof window.saveCoursePatch === 'function') await window.saveCoursePatch(courseId, { observacoes: course.observacoes });
    else if (typeof window.saveToStorage === 'function') await window.saveToStorage(true);
    if (typeof window.renderAll === 'function') window.renderAll();
    showToast('Observações salvas!', 'success');
  };

  /* ── Instrutores ── */
  function getInstructorName(id) {
    if (!id) return '';
    return getInstructorsData()[id]?.nome || '';
  }

  function refreshInstructorsUI() {
    const listEl = document.getElementById('content-instructors');
    const listVisible = listEl && !listEl.classList.contains('hidden');
    if (listVisible) renderInstructorsList();
    if (currentInstructorPageId) {
      ensureInstructorPageVisible();
      renderInstructorPage(currentInstructorPageId);
    }
  }

  window.refreshInstructorsUI = refreshInstructorsUI;

  function loadInstructorsFromLocal() {
    try {
      window.instructors = JSON.parse(localStorage.getItem(STORAGE_KEY_INSTRUCTORS)) || {};
    } catch (_) {
      window.instructors = {};
    }
  }

  function contractLabel(tipo) {
    return tipo === 'nf' || tipo === 'terceirizado' ? 'NF avulsa' : 'MEI';
  }

  function contractKey(tipo) {
    return tipo === 'nf' || tipo === 'terceirizado' ? 'nf' : 'mei';
  }

  function paymentAmount(valor) {
    const num = parseFloat(String(valor ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  }

  function money(valor) {
    return paymentAmount(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function instructorCourses(inst) {
    return iacCourses().filter((course) => course.instrutorId === inst.id || (inst.nome && course.instrutor === inst.nome));
  }

  function isFinishedCourse(course) {
    const status = String((course && course.status) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return status.indexOf('conclu') !== -1;
  }

  function paymentRecord(inst, courseId) {
    return (inst.pagamentos || []).find((item) => item && item.courseId === courseId) || null;
  }

  function instructorFinished(inst) {
    return instructorCourses(inst)
      .filter(isFinishedCourse)
      .sort((a, b) => String(b.dataFim || b.dataInicio || '').localeCompare(String(a.dataFim || a.dataInicio || '')));
  }

  function instructorPending(inst) {
    return instructorFinished(inst).filter((course) => !(paymentRecord(inst, course.id) || {}).pago);
  }

  window.setInstructorBoard = function setInstructorBoard(key, value) {
    instructorBoard[key] = value || '';
    renderInstructorsList();
  };

  window.renderInstructorsList = function renderInstructorsList() {
    const el = document.getElementById('instructors-list');
    const summary = document.getElementById('instructors-summary');
    const filters = document.getElementById('instructors-filters');
    if (!el) return;
    const all = Object.values(getInstructorsData());
    const pendingAll = all.reduce((sum, inst) => sum + instructorPending(inst).length, 0);
    if (summary) {
      summary.innerHTML = `
        <div class="inst-stat"><strong>${all.length}</strong><span>Instrutores</span></div>
        <div class="inst-stat"><strong>${pendingAll}</strong><span>Pendências</span></div>`;
    }
    if (filters) filters.innerHTML = '';
    const list = all.slice().sort((a, b) => {
      const diff = instructorPending(b).length - instructorPending(a).length;
      return diff || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
    if (!all.length) {
      el.innerHTML = '<div class="card-elegant p-8 text-center text-muted">Nenhum instrutor cadastrado.</div>';
      return;
    }
    if (!list.length) {
      el.innerHTML = '<div class="card-elegant p-8 text-center text-muted">Nenhum instrutor com esse filtro.</div>';
      return;
    }
    const canEdit = typeof window.canEditInstructors === 'function' && window.canEditInstructors();
    el.innerHTML = list.map((inst) => {
      const coursesCount = instructorCourses(inst).length;
      const pendingPay = instructorPending(inst).length;
      const pendingClass = pendingPay > 0 ? ' instructor-card--has-pending' : '';
      return `<div class="instructor-card card-elegant${pendingClass}" onclick="openInstructorPage('${inst.id}')">
        ${pendingPay > 0 ? `<span class="instructor-pending-dot" title="Pagamentos pendentes">${pendingPay}</span>` : ''}
        ${canEdit ? `<button type="button" class="instructor-card-del-btn" title="Excluir instrutor" onclick="event.stopPropagation(); deleteInstructor('${inst.id}')">×</button>` : ''}
        <div class="instructor-card-header">
          <span class="instructor-avatar">${escapeHtml((inst.nome || '?')[0])}</span>
          <div class="instructor-card-title">
            <h3>${escapeHtml(inst.nome)}</h3>
            <small>${escapeHtml(inst.area || 'Área não informada')} · ${contractLabel(inst.tipoContrato)}</small>
          </div>
        </div>
        <div class="instructor-card-meta">
          ${instructorPhoneMeta(inst.telefone)}
          <span>${coursesCount} turma(s)${pendingPay ? ` · ${pendingPay} pendência(s)` : ' · em dia'}</span>
        </div>
      </div>`;
    }).join('');
  };

  window.openInstructorPage = function openInstructorPage(id) {
    lastActiveTab = 'instructors';
    currentInstructorPageId = id;
    instructorCourseSearchOpen = false;
    location.hash = `instructor/${id}`;
    ensureInstructorPageVisible();
    renderInstructorPage(id);
  };

  window.deleteInstructor = async function deleteInstructor(id) {
    if (!instructorEditGuard()) return;
    const data = { ...getInstructorsData() };
    const inst = data[id];
    if (!inst) return;

    if (typeof window.addToUndoStack === 'function') {
      window.addToUndoStack('deleteInstructor', {
        instructor: JSON.parse(JSON.stringify(inst)),
        allInstructors: JSON.parse(JSON.stringify(data)),
      });
    }

    delete data[id];
    if (typeof window.saveInstructorsToFirebase === 'function') {
      await window.saveInstructorsToFirebase(data);
    }

    if (currentInstructorPageId === id) {
      currentInstructorPageId = null;
      backToInstructorsList();
    } else {
      renderInstructorsList();
    }

    if (typeof window.showToast === 'function') {
      window.showToast(`Instrutor "${inst.nome}" excluído`, 'success', 5000, true);
    }
  };

  window.renderInstructorPage = function renderInstructorPage(id) {
    const el = document.getElementById('instructor-page-content');
    const inst = getInstructorsData()[id];
    if (!el || !inst) return;

    const taught = instructorCourses(inst)
      .sort((a, b) => String(b.dataInicio || '').localeCompare(String(a.dataInicio || '')));
    const finished = instructorFinished(inst).sort((a, b) => {
      const ap = (paymentRecord(inst, a.id) || {}).pago ? 1 : 0;
      const bp = (paymentRecord(inst, b.id) || {}).pago ? 1 : 0;
      return ap - bp;
    });
    const pending = instructorPending(inst);
    const paid = finished.filter((course) => (paymentRecord(inst, course.id) || {}).pago);
    const tipos = [...new Set(taught.map((course) => course.tipologia).filter(Boolean))];
    const canEdit = typeof window.canEditInstructors === 'function' && window.canEditInstructors();
    const wa = getWhatsAppLink(inst.telefone);

    el.innerHTML = `
      <article class="iprof">
        <header class="iprof-banner">
          <button type="button" class="iprof-back" onclick="backToInstructorsList()" aria-label="Voltar">←</button>
          <span class="iprof-avatar">${escapeHtml((inst.nome || '?')[0])}</span>
          <div class="iprof-id">
            <h1>${escapeHtml(inst.nome || 'Instrutor')}</h1>
            <div class="iprof-pills">
              <span>${escapeHtml(inst.area || 'Área não informada')}</span>
              <span class="iprof-pill">${contractLabel(inst.tipoContrato)}</span>
            </div>
          </div>
          ${canEdit ? `<div class="iprof-actions">
            <button type="button" onclick="openInstructorModal('${id}')">Editar</button>
            <button type="button" class="iprof-danger" onclick="deleteInstructor('${id}')" aria-label="Excluir">×</button>
          </div>` : ''}
        </header>
        <div class="iprof-facts">
          <article><small>Telefone</small><strong>${escapeHtml(inst.telefone || '—')}</strong>${wa ? `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</article>
          <article><small>E-mail</small><strong>${escapeHtml(inst.email || '—')}</strong></article>
          <article><small>CPF</small><strong>${escapeHtml(inst.cpf || '—')}</strong></article>
          <article><small>Turmas</small><strong>${taught.length}</strong></article>
        </div>
        <div class="iprof-grid">
          <section class="iprof-panel">
            <div class="instructor-section-header">
              <h2>Cursos ministrados</h2>
              ${canEdit ? `<button type="button" class="instructor-icon-btn" onclick="toggleInstructorCourseSearch('${id}')" title="Vincular turma">+</button>` : ''}
            </div>
            ${tipos.length ? `<div class="iprof-types">${tipos.map((tipo) => `<span>${escapeHtml(tipo)}</span>`).join('')}</div>` : '<p class="iprof-empty">Nenhum curso vinculado.</p>'}
            ${canEdit && instructorCourseSearchOpen ? `
              <div class="instructor-course-search-wrap">
                <input type="text" id="instructor-course-search" placeholder="ID ou nome do curso" oninput="filterInstructorCourses('${id}')" class="instructor-course-search">
                <div id="instructor-course-picker" class="instructor-course-picker hidden"></div>
              </div>` : ''}
            <h2 class="iprof-sub">Histórico de turmas</h2>
            ${taught.length ? taught.map((course) => `
              <div class="iprof-row">
                <button type="button" class="iprof-row-main" onclick="openCoursePage('${course.id}')">
                  <strong>${escapeHtml(course.tipologia || 'Curso')}</strong>
                  <small>ID ${escapeHtml(course.idCurso || '—')} · ${course.dataInicio ? formatDate(course.dataInicio) : '?'} → ${course.dataFim ? formatDate(course.dataFim) : '?'} · ${escapeHtml(course.municipio || '—')}</small>
                </button>
                <span class="status-badge ${courseStatusBadge(course.status)}">${escapeHtml(course.status || 'Pendente')}</span>
                ${canEdit ? `<button type="button" onclick="unlinkCourseFromInstructor('${id}','${course.id}')" class="instructor-del-btn" title="Desvincular">×</button>` : ''}
              </div>`).join('') : '<p class="iprof-empty">Nenhuma turma no histórico.</p>'}
          </section>
          <section class="iprof-panel">
            <h2>Pagamentos</h2>
            <div class="iprof-pay-sum">
              <span><b>${pending.length}</b> pendentes</span>
              <span><b>${paid.length}</b> pagos</span>
            </div>
            ${finished.length ? finished.map((course) => {
              const pago = !!(paymentRecord(inst, course.id) || {}).pago;
              const mark = canEdit
                ? `<button type="button" onclick="toggleInstructorPagamento('${id}','${course.id}')" class="status-badge ${pago ? 'completed' : 'pending'}">${pago ? 'Pago' : 'Pendente'}</button>`
                : `<span class="status-badge ${pago ? 'completed' : 'pending'}">${pago ? 'Pago' : 'Pendente'}</span>`;
              return `
              <div class="iprof-row ${pago ? '' : 'is-pending'}">
                <button type="button" class="iprof-row-main" onclick="openCoursePage('${course.id}')">
                  <strong>${escapeHtml(course.tipologia || 'Turma')}</strong>
                  <small>ID ${escapeHtml(course.idCurso || '—')} · ${course.dataFim ? formatDate(course.dataFim) : '—'} · ${escapeHtml(course.municipio || '—')}</small>
                </button>
                ${mark}
              </div>`;
            }).join('') : '<p class="iprof-empty">Nenhuma turma finalizada para este instrutor.</p>'}
          </section>
        </div>
      </article>`;
  };

  function courseStatusBadge(status) {
    const name = String(status || '').toLowerCase();
    if (name.indexOf('conclu') !== -1) return 'completed';
    if (name.indexOf('andamento') !== -1) return 'in-progress';
    if (name.indexOf('atras') !== -1) return 'delayed';
    return 'pending';
  }

  /* open/close modal: instructors-boot.js */

  window.saveInstructor = async function saveInstructor() {
    if (!instructorEditGuard()) return;
    const nome = document.getElementById('instructor-nome')?.value.trim() || '';
    if (!nome) {
      if (typeof showToast === 'function') showToast('Informe o nome do instrutor.', 'error');
      else alert('Informe o nome do instrutor.');
      document.getElementById('instructor-nome')?.focus();
      return;
    }
    const id = document.getElementById('instructor-edit-id').value || `inst-${Date.now()}`;
    const data = { ...getInstructorsData() };
    const existing = data[id] || {};
    data[id] = {
      ...existing,
      id,
      nome,
      area: document.getElementById('instructor-area')?.value || '',
      telefone: document.getElementById('instructor-telefone').value.trim(),
      email: document.getElementById('instructor-email')?.value.trim() || '',
      cpf: document.getElementById('instructor-cpf').value.trim(),
      tipoContrato: document.getElementById('instructor-tipo').value,
      contratos: existing.contratos || [],
      pagamentos: existing.pagamentos || [],
      ativo: true,
    };
    if (typeof window.saveInstructorsToFirebase === 'function') {
      await window.saveInstructorsToFirebase(data);
    }
    closeInstructorModal();
    if (currentInstructorPageId === id) {
      ensureInstructorPageVisible();
      renderInstructorPage(id);
    } else {
      renderInstructorsList();
    }
    showToast('Instrutor salvo!', 'success');
  };

  window.toggleInstructorPagamento = function toggleInstructorPagamento(id, courseId) {
    if (!instructorEditGuard()) return;
    const inst = getInstructorsData()[id];
    const course = getCourseById(courseId);
    if (!inst || !course || !isFinishedCourse(course)) return;
    inst.pagamentos = Array.isArray(inst.pagamentos) ? inst.pagamentos : [];
    let item = inst.pagamentos.find((entry) => entry && entry.courseId === courseId);
    if (!item) {
      item = {
        id: 'pay-' + courseId,
        courseId,
        descricao: (course.tipologia || 'Turma') + (course.idCurso ? ' · ' + course.idCurso : ''),
        valor: '',
        data: new Date().toLocaleDateString('pt-BR'),
        pago: false,
        origem: 'turma-concluida',
        municipio: course.municipio || ''
      };
      inst.pagamentos.unshift(item);
    }
    item.pago = !item.pago;
    if (typeof window.saveInstructorsToFirebase === 'function') window.saveInstructorsToFirebase(getInstructorsData());
    renderInstructorPage(id);
    if (typeof window.renderInstructorsList === 'function') window.renderInstructorsList();
  };

  window.toggleInstructorCourseSearch = function toggleInstructorCourseSearch(id) {
    instructorCourseSearchOpen = !instructorCourseSearchOpen;
    renderInstructorPage(id);
    if (instructorCourseSearchOpen) {
      setTimeout(() => document.getElementById('instructor-course-search')?.focus(), 50);
    }
  };

  window.unlinkCourseFromInstructor = async function unlinkCourseFromInstructor(instructorId, courseId) {
    if (!instructorEditGuard()) return;
    const course = getCourseById(courseId);
    if (!course) return;
    if (typeof window.saveCoursePatch === 'function') {
      await window.saveCoursePatch(courseId, { instrutorId: null, instrutor: null });
    } else {
      course.instrutorId = null;
      course.instrutor = null;
      if (typeof window.saveToStorage === 'function') await window.saveToStorage(true);
    }
    ensureInstructorPageVisible();
    renderInstructorPage(instructorId);
    showToast('Curso desvinculado.', 'success');
  };

  window.filterInstructorCourses = function filterInstructorCourses(instructorId) {
    const input = document.getElementById('instructor-course-search');
    const picker = document.getElementById('instructor-course-picker');
    if (!input || !picker) return;

    const q = input.value.trim().toLowerCase();
    if (!q) {
      picker.classList.add('hidden');
      picker.innerHTML = '';
      return;
    }

    const matches = iacCourses().filter((c) => {
      const idCurso = String(c.idCurso || '').toLowerCase();
      const tipologia = String(c.tipologia || '').toLowerCase();
      const municipio = String(c.municipio || '').toLowerCase();
      return idCurso.includes(q) || tipologia.includes(q) || municipio.includes(q);
    }).slice(0, 10);

    if (!matches.length) {
      picker.innerHTML = '<div class="instructor-picker-empty">Nenhum curso encontrado</div>';
      picker.classList.remove('hidden');
      return;
    }

    picker.innerHTML = matches.map((c) => `
      <button type="button" class="instructor-picker-item" onclick="linkCourseToInstructor('${instructorId}','${c.id}')">
        <strong>${escapeHtml(c.idCurso || c.id)}</strong>
        <small>${escapeHtml(c.tipologia || '-')} · ${escapeHtml(c.municipio || '-')}</small>
      </button>`).join('');
    picker.classList.remove('hidden');
  };

  window.linkCourseToInstructor = async function linkCourseToInstructor(instructorId, courseId) {
    if (!instructorEditGuard()) return;
    const inst = getInstructorsData()[instructorId];
    const course = getCourseById(courseId);
    if (!inst || !course) return;

    if (typeof window.saveCoursePatch === 'function') {
      await window.saveCoursePatch(courseId, { instrutorId: instructorId, instrutor: inst.nome });
    } else {
      course.instrutorId = instructorId;
      course.instrutor = inst.nome;
      if (typeof window.saveToStorage === 'function') await window.saveToStorage(true);
    }

    const search = document.getElementById('instructor-course-search');
    const picker = document.getElementById('instructor-course-picker');
    if (search) search.value = '';
    if (picker) {
      picker.classList.add('hidden');
      picker.innerHTML = '';
    }

    instructorCourseSearchOpen = false;
    ensureInstructorPageVisible();
    renderInstructorPage(instructorId);
    showToast('Curso vinculado ao instrutor!', 'success');
  };

  function infoItem(icon, label, value) {
    return `<div class="course-info-item"><span class="course-info-icon">${icon}</span><div><small>${label}</small><strong>${escapeHtml(String(value ?? '-'))}</strong></div></div>`;
  }

  /* ── Dashboard widgets ── */
  function getWidgetOrder() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_WIDGETS)) || DEFAULT_WIDGETS.slice();
      const order = Array.isArray(stored) ? stored.slice() : DEFAULT_WIDGETS.slice();
      DEFAULT_WIDGETS.forEach((key) => {
        if (!order.includes(key)) order.push(key);
      });
      const filtersAt = order.indexOf('filters');
      const indicatorsAt = order.indexOf('indicators');
      if (filtersAt > indicatorsAt && indicatorsAt >= 0) {
        order.splice(filtersAt, 1);
        order.splice(indicatorsAt, 0, 'filters');
      }
      return order;
    } catch (_) { return DEFAULT_WIDGETS.slice(); }
  }

  window.reorderDashboardWidget = function reorderDashboardWidget(id, direction) {
    const order = getWidgetOrder();
    const idx = order.indexOf(id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    localStorage.setItem(STORAGE_KEY_WIDGETS, JSON.stringify(order));
    applyDashboardWidgetOrder();
  };

  window.applyDashboardWidgetOrder = function applyDashboardWidgetOrder() {
    const dashboard = document.getElementById('content-dashboard');
    if (!dashboard) return;
    const order = getWidgetOrder();
    const map = {
      summary: document.getElementById('dashboard-widgets-bar'),
      actions: document.getElementById('action-cards')?.parentElement === dashboard ? document.getElementById('action-cards') : document.getElementById('action-cards'),
      stats: document.getElementById('stats-cards'),
      indicators: document.getElementById('execution-indicators'),
      filters: document.getElementById('dashboard-filters'),
      lots: document.getElementById('lot-sections'),
    };
    order.forEach((key) => {
      const el = map[key];
      if (el && dashboard.contains(el)) dashboard.appendChild(el);
    });
  };

  /* ── Routing ── */
  window.handleHashRoute = function handleHashRoute(isBoot) {
    if (isBoot) {
      currentInstructorPageId = null;
      instructorCourseSearchOpen = false;
      const hash = (location.hash || '').slice(1);
      if (hash && hash !== 'cronograma' && window.IAC && window.IAC.isLoggedIn) {
        handleHashRoute(false);
      }
      return;
    }
    const hash = (location.hash || '').slice(1);
    if (!(window.IAC && window.IAC.isLoggedIn) && hash !== 'cronograma' && hash !== 'calendar') {
      if (typeof window.switchTab === 'function') window.switchTab('cronograma');
      return;
    }
    if (!hash) return;
    if (hash.startsWith('course/')) {
      openCoursePage(hash.split('/')[1]);
      return;
    }
    if (hash.startsWith('instructor/')) {
      openInstructorPage(hash.split('/')[1]);
      return;
    }
    if (hash === 'calendar') {
      if (typeof window.switchTab === 'function') window.switchTab('cronograma');
      return;
    }
    if (['dashboard', 'cronograma', 'tarefas', 'settings', 'instructors', 'demandas', 'calendario', 'auditoria', 'equipe'].includes(hash)) {
      closeCourseModal();
      currentCoursePageId = null;
      currentInstructorPageId = null;
      if (typeof window.switchTab === 'function') window.switchTab(hash);
      else if (typeof window._switchTabCore === 'function') window._switchTabCore(hash);
    }
  };

  /* ── Init ── */
  function patchApp() {
    if (typeof window.navigateToCourse === 'function') {
      window._navigateToCourseOrig = window.navigateToCourse;
      window.navigateToCourse = function (id) {
        window.openCoursePage(id);
      };
    }

    if (typeof window.switchTab === 'function') {
      window._switchTabCore = window.switchTab;
      window.switchTab = function (tab) {
        const guestLock = !(window.IAC && window.IAC.isLoggedIn) && tab !== 'cronograma' && tab !== 'calendar';
        if (guestLock) tab = 'cronograma';
        if (!['course', 'instructor'].includes(tab)) {
          closeCourseModal();
          currentCoursePageId = null;
          if (tab !== 'instructors') {
            currentInstructorPageId = null;
            instructorCourseSearchOpen = false;
          }
          lastActiveTab = tab;
          if (tab === 'instructors' && currentInstructorPageId) {
            /* hash instructor/id definido por openInstructorPage */
          } else if (!guestLock && !location.hash.startsWith('#course/') && location.hash !== `#${tab}`) {
            location.hash = tab;
          }
        }

        if (tab === 'instructors' && currentInstructorPageId) {
          ensureInstructorPageVisible();
          return;
        }

        hideAllPages();
        window._switchTabCore(tab);
        if (tab === 'instructors') {
          setTabPanelVisible(document.getElementById('content-instructors'), true);
          setActiveTabButton('instructors');
          renderInstructorsList();
        }
        if (tab === 'dashboard') applyDashboardWidgetOrder();
      };
    }

    const origRenderAll = window.renderAll;
    if (typeof origRenderAll === 'function') {
      window.renderAll = function () {
        origRenderAll();
        restoreActiveTabPanels();
        if (currentCoursePageId) renderCoursePage(currentCoursePageId);
        if (currentInstructorPageId) {
        ensureInstructorPageVisible();
        renderInstructorPage(currentInstructorPageId);
      }
      };
    }

    loadInstructorsFromLocal();
    window.addEventListener('hashchange', () => handleHashRoute(false));
    requestAnimationFrame(() => {
      applyDashboardWidgetOrder();
      handleHashRoute(true);
    });
  }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', patchApp);
} else {
  patchApp();
}
