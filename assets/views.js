/* IAC - Páginas dedicadas, instrutores e melhorias visuais */
const STORAGE_KEY_INSTRUCTORS = 'instructors_data';
const STORAGE_KEY_WIDGETS = 'dashboard_widgets_order';
const DEFAULT_WIDGETS = ['summary', 'actions', 'stats', 'filters', 'lots'];

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
let lastActiveTab = 'cronograma';
let instructorCourseSearchOpen = false;

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

  function restoreActiveTabPanels() {
    if (currentInstructorPageId) {
      ensureInstructorPageVisible();
      return;
    }
    const tab = lastActiveTab || 'cronograma';
    ['dashboard', 'cronograma', 'tarefas', 'settings', 'instructors', 'instructor'].forEach((name) => {
      setTabPanelVisible(document.getElementById(`content-${name}`), name === tab);
    });
  }

  function hideAllPages() {
    ['dashboard', 'cronograma', 'tarefas', 'settings', 'instructors', 'instructor'].forEach((name) => {
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
    if (modal) modal.classList.add('hidden');
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
      modal.classList.remove('hidden');
      document.body.classList.add('modal-open');
    }
    renderCoursePage(courseId);
  };

  window.closeCoursePage = function closeCoursePage() {
    currentCoursePageId = null;
    closeCourseModal();
  };

  function setActiveTabButton(tab) {
    const tabs = ['dashboard', 'cronograma', 'tarefas', 'settings', 'instructors'];
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

  function renderCourseSectionContent(course) {
    const canEdit = typeof canEditCourses === 'function' && canEditCourses();
    const sections = {
      overview: () => `
        <div class="course-info-grid">
          ${infoItem('🏷️', 'Curso', course.tipologia)}
          ${infoItem('🆔', 'ID', course.idCurso || '-')}
          ${infoItem('📍', 'Município', course.municipio)}
          ${infoItem('👤', 'Instrutor', course.instrutor || getInstructorName(course.instrutorId) || '-')}
          ${infoItem('📅', 'Período', `${course.dataInicio ? formatDate(course.dataInicio) : '?'} → ${course.dataFim ? formatDate(course.dataFim) : '?'}`)}
          ${infoItem('⏱️', 'Carga Horária', `${course.cargaHoraria || '-'}h`)}
          ${infoItem('📦', 'Lote', course.lote)}
          ${infoItem('🏠', 'Cozinha', course.cozinha || '-')}
          ${infoItem('📫', 'Endereço', course.endereco || '-')}
          ${infoItem('👥', 'Concludentes', course.concludentes ?? '-')}
        </div>`,
      checklist: () => `
        <div class="course-section-panel">
          <button onclick="openTarefasChecklistModal('${course.id}')" class="course-link-btn">✅ Abrir checklist completo</button>
        </div>`,
      timeline: () => {
        const items = getCourseTimeline(course);
        return `<div class="course-timeline">${items.map(i => `
          <div class="course-timeline-item">
            <span class="course-timeline-dot">${i.icon}</span>
            <div><strong>${escapeHtml(i.label)}</strong>${i.date ? `<br><small>${formatDate(i.date)}</small>` : ''}</div>
          </div>`).join('')}</div>`;
      },
      observacoes: () => `
        <div class="course-section-panel">
          ${canEdit
            ? `<textarea id="course-obs-input" class="w-full p-4 rounded-xl border" rows="5" placeholder="Observações...">${escapeHtml(course.observacoes || '')}</textarea>
               <button onclick="saveCourseObservacoes('${course.id}')" class="course-link-btn mt-3">💾 Salvar observações</button>`
            : `<p>${escapeHtml(course.observacoes || 'Sem observações.')}</p>`}
        </div>`
    };
    return (sections[currentCourseSection] || sections.overview)();
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

    const statusClass = typeof getStatusClass === 'function' ? getStatusClass(course.status) : 'pending';

    const restrictedSections = ['checklist', 'timeline', 'observacoes'];
    if (!iacIsLoggedIn() && restrictedSections.includes(currentCourseSection)) {
      currentCourseSection = 'overview';
    }

    const sections = [['overview', '📋', 'Visão geral']];
    if (iacIsLoggedIn()) {
      sections.push(
        ['checklist', '✅', 'Checklist'],
        ['timeline', '🕐', 'Timeline'],
        ['observacoes', '📝', 'Observações']
      );
    }

    container.innerHTML = `
      <div class="course-page-header card-elegant">
        <button type="button" onclick="closeCoursePage()" class="course-back-btn">✕ Fechar</button>
        <div class="course-page-title">
          <h1>${escapeHtml(course.tipologia)}</h1>
          <span class="status-badge ${statusClass} status-badge--dot">${escapeHtml(course.status || 'Pendente')}</span>
          ${course.turmaFormada ? '<span class="status-badge in-progress">Turma formada</span>' : ''}
        </div>
        ${typeof canEditCourses === 'function' && canEditCourses() ? `
          <button onclick="openCronogramaCourseModal('${course.id}')" class="course-link-btn course-link-btn--outline">✏️ Editar</button>
          <button type="button" onclick="event.stopPropagation(); toggleTurmaFormada('${course.id}')" class="course-link-btn course-link-btn--outline">🏁 Turma formada</button>
        ` : ''}
      </div>
      <nav class="course-section-nav">
        ${sections.map(([id, icon, label]) => `
          <button class="course-section-btn ${currentCourseSection === id ? 'active' : ''}" onclick="setCourseSection('${id}')">${icon} ${label}</button>
        `).join('')}
      </nav>
      <div class="course-section-content card-elegant page-enter">${renderCourseSectionContent(course)}</div>`;
  };

  window.saveCourseObservacoes = async function saveCourseObservacoes(courseId) {
    const input = document.getElementById('course-obs-input');
    if (!input || !requireEditAccess()) return;
    const course = getCourseById(courseId);
    if (!course) return;
    course.observacoes = input.value.trim();
    if (typeof window.saveCoursePatch === 'function') await window.saveCoursePatch(courseId, { observacoes: course.observacoes });
    else if (typeof window.saveToStorage === 'function') await window.saveToStorage(true);
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

  window.renderInstructorsList = function renderInstructorsList() {
    const el = document.getElementById('instructors-list');
    if (!el) return;
    const list = Object.values(getInstructorsData());
    if (!list.length) {
      el.innerHTML = '<div class="card-elegant p-8 text-center text-muted">Nenhum instrutor cadastrado.</div>';
      return;
    }
    el.innerHTML = list.map((inst) => {
      const coursesCount = iacCourses().filter(c => c.instrutorId === inst.id || c.instrutor === inst.nome).length;
      const pendingPay = (inst.pagamentos || []).filter((p) => !p.pago).length;
      const tipo = inst.tipoContrato === 'terceirizado' ? 'Terceirizado' : 'MEI';
      return `<div class="instructor-card card-elegant status-card--${inst.ativo !== false ? 'green' : 'yellow'}" onclick="openInstructorPage('${inst.id}')">
        ${pendingPay > 0 ? `<span class="instructor-pending-dot" title="Pagamentos pendentes">${pendingPay}</span>` : ''}
        <div class="instructor-card-header">
          <span class="instructor-avatar">${(inst.nome || '?')[0]}</span>
          <div class="instructor-card-title">
            <h3>${escapeHtml(inst.nome)}</h3>
            <small>${tipo} · ${coursesCount} turma(s)</small>
          </div>
        </div>
        <div class="instructor-card-meta">
          ${instructorPhoneMeta(inst.telefone)}
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

  window.renderInstructorPage = function renderInstructorPage(id) {
    const el = document.getElementById('instructor-page-content');
    const inst = getInstructorsData()[id];
    if (!el || !inst) return;

    const taught = iacCourses().filter(c => c.instrutorId === id || c.instrutor === inst.nome);
    const pagamentos = inst.pagamentos || [];

    const canEdit = typeof canEditCourses === 'function' && canEditCourses();

    el.innerHTML = `
      <div class="course-page-header card-elegant">
        <button type="button" onclick="backToInstructorsList()" class="course-back-btn">← Instrutores</button>
        <div class="course-page-title">
          <h1>${escapeHtml(inst.nome)}</h1>
          <span class="status-badge ${inst.tipoContrato === 'terceirizado' ? 'delayed' : 'in-progress'}">${inst.tipoContrato === 'terceirizado' ? 'Terceirizado' : 'MEI'}</span>
        </div>
        ${canEdit ? `<button type="button" onclick="openInstructorModal('${id}')" class="course-link-btn course-link-btn--outline">✏️ Editar</button>` : ''}
      </div>
      <div class="course-info-grid card-elegant mb-4">
        ${phoneInfoItem(inst.telefone)}
        ${infoItem('📄', 'CPF', inst.cpf)}
        ${infoItem('📚', 'Cursos', taught.length)}
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="card-elegant p-5">
          <div class="instructor-section-header">
            <h3 class="section-title-sm">📚 Cursos ministrados</h3>
            ${canEdit ? `<button type="button" class="instructor-icon-btn" onclick="toggleInstructorCourseSearch('${id}')" title="Buscar e vincular curso">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </button>` : ''}
          </div>
          ${canEdit && instructorCourseSearchOpen ? `
            <div class="instructor-course-search-wrap">
              <input type="text" id="instructor-course-search" placeholder="ID do curso..." oninput="filterInstructorCourses('${id}')" class="instructor-course-search">
              <div id="instructor-course-picker" class="instructor-course-picker hidden"></div>
            </div>` : ''}
          ${taught.length ? taught.map(c => `
            <div class="list-item-row instructor-course-row">
              <div class="instructor-course-info" onclick="openCoursePage('${c.id}')">
                <strong>${escapeHtml(c.tipologia)}</strong>
                <small>ID: ${escapeHtml(c.idCurso || '-')} · ${c.dataInicio ? formatDate(c.dataInicio) : '?'} → ${c.dataFim ? formatDate(c.dataFim) : '?'}</small>
              </div>
              ${canEdit ? `<button type="button" onclick="unlinkCourseFromInstructor('${id}','${c.id}')" class="instructor-del-btn" title="Desvincular">×</button>` : ''}
            </div>`).join('') : '<p class="text-muted">Nenhum curso vinculado.</p>'}
        </div>
        <div class="card-elegant p-5">
          <h3 class="section-title-sm mb-3">💰 Pagamentos</h3>
          ${pagamentos.length ? pagamentos.map((p, i) => `
            <div class="list-item-row instructor-pagamento-row">
              <div class="instructor-pagamento-info">
                <strong>${escapeHtml(p.descricao || 'Turma')}</strong>
                <small>${p.data || '-'} · ${formatPagamentoValor(p.valor)}</small>
              </div>
              <div class="instructor-pagamento-actions">
                <button type="button" onclick="toggleInstructorPagamento('${id}',${i})" class="status-badge ${p.pago ? 'completed' : 'pending'}">${p.pago ? 'Pago ✓' : 'Pendente'}</button>
                ${canEdit ? `<button type="button" onclick="removeInstructorPagamento('${id}',${i})" class="instructor-del-btn" title="Excluir">×</button>` : ''}
              </div>
            </div>`).join('') : '<p class="text-muted">Nenhum pagamento registrado.</p>'}
          ${canEdit ? `<button onclick="addInstructorPagamento('${id}')" class="course-link-btn course-link-btn--outline mt-3">+ Registrar pagamento</button>` : ''}
        </div>
      </div>`;
  };

  /* open/close modal: instructors-boot.js */

  window.saveInstructor = async function saveInstructor() {
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
      telefone: document.getElementById('instructor-telefone').value.trim(),
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

  window.addInstructorPagamento = function addInstructorPagamento(id) {
    if (!instructorEditGuard()) return;
    const desc = prompt('Descrição (ex: Turma X):');
    const valor = prompt('Valor (R$):');
    if (!desc) return;
    const inst = getInstructorsData()[id];
    inst.pagamentos = inst.pagamentos || [];
    inst.pagamentos.push({ descricao: desc, valor: valor || '', data: new Date().toLocaleDateString('pt-BR'), pago: false });
    if (typeof window.saveInstructorsToFirebase === 'function') window.saveInstructorsToFirebase(getInstructorsData());
    renderInstructorPage(id);
  };

  window.toggleInstructorPagamento = function toggleInstructorPagamento(id, index) {
    if (!instructorEditGuard()) return;
    const inst = getInstructorsData()[id];
    if (!inst?.pagamentos?.[index]) return;
    inst.pagamentos[index].pago = !inst.pagamentos[index].pago;
    if (typeof window.saveInstructorsToFirebase === 'function') window.saveInstructorsToFirebase(getInstructorsData());
    renderInstructorPage(id);
  };

  window.removeInstructorPagamento = function removeInstructorPagamento(id, index) {
    if (!instructorEditGuard()) return;
    const inst = getInstructorsData()[id];
    if (!inst?.pagamentos?.[index]) return;
    if (!confirm('Excluir este pagamento?')) return;
    inst.pagamentos.splice(index, 1);
    if (typeof window.saveInstructorsToFirebase === 'function') window.saveInstructorsToFirebase(getInstructorsData());
    renderInstructorPage(id);
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
      return JSON.parse(localStorage.getItem(STORAGE_KEY_WIDGETS)) || DEFAULT_WIDGETS;
    } catch (_) { return DEFAULT_WIDGETS; }
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
      location.replace('#cronograma');
      if (typeof window.switchTab === 'function') window.switchTab('cronograma');
      return;
    }
    const hash = (location.hash || '').slice(1);
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
    if (['dashboard', 'cronograma', 'tarefas', 'settings', 'instructors'].includes(hash)) {
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
          } else if (!location.hash.startsWith('#course/') && location.hash !== `#${tab}`) {
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
