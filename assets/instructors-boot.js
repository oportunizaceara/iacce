/* Boot de instrutores — funciona mesmo se views.js falhar */
(function () {
  var STORAGE_KEY = 'instructors_data';

  function loadInstructors() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
      window.instructors = data;
      return data;
    } catch (_) {
      window.instructors = {};
      return {};
    }
  }

  function showModal() {
    var modal = document.getElementById('instructor-modal');
    if (!modal) {
      console.error('[IAC] Modal #instructor-modal não encontrado');
      alert('Erro: formulário de instrutor não encontrado na página.');
      return false;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '1rem';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '1200';
    document.body.classList.add('modal-open');
    return true;
  }

  window.openInstructorModal = function openInstructorModal(id) {
    if (typeof window.requireInstructorEditAccess === 'function' && !window.requireInstructorEditAccess()) return;
    var data = loadInstructors();
    var inst = (id && data[id]) ? data[id] : {};
    var title = document.getElementById('instructor-modal-title');
    var editId = document.getElementById('instructor-edit-id');
    var nome = document.getElementById('instructor-nome');
    var tel = document.getElementById('instructor-telefone');
    var cpf = document.getElementById('instructor-cpf');
    var tipo = document.getElementById('instructor-tipo');
    if (title) title.textContent = id ? 'Editar Instrutor' : 'Novo Instrutor';
    if (editId) editId.value = id || '';
    if (nome) nome.value = inst.nome || '';
    if (tel) tel.value = inst.telefone || '';
    if (cpf) cpf.value = inst.cpf || '';
    if (tipo) tipo.value = inst.tipoContrato || 'mei';
    if (!showModal()) return;
    setTimeout(function () { if (nome) nome.focus(); }, 50);
  };

  window.closeInstructorModal = function closeInstructorModal() {
    var modal = document.getElementById('instructor-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = '';
    }
    document.body.classList.remove('modal-open');
  };

  window.saveInstructor = async function saveInstructor() {
    if (typeof window.requireInstructorEditAccess === 'function' && !window.requireInstructorEditAccess()) return;
    var nomeEl = document.getElementById('instructor-nome');
    var nome = (nomeEl && nomeEl.value || '').trim();
    if (!nome) {
      if (typeof window.showToast === 'function') window.showToast('Informe o nome do instrutor.', 'error');
      else alert('Informe o nome do instrutor.');
      if (nomeEl) nomeEl.focus();
      return;
    }
    var data = loadInstructors();
    var id = (document.getElementById('instructor-edit-id') || {}).value || ('inst-' + Date.now());
    var existing = data[id] || {};
    data[id] = {
      id: id,
      nome: nome,
      telefone: (document.getElementById('instructor-telefone') || {}).value.trim() || '',
      cpf: (document.getElementById('instructor-cpf') || {}).value.trim() || '',
      tipoContrato: (document.getElementById('instructor-tipo') || {}).value || 'mei',
      contratos: existing.contratos || [],
      pagamentos: existing.pagamentos || [],
      ativo: existing.ativo !== false
    };

    if (typeof window.saveInstructorsToFirebase === 'function') {
      await window.saveInstructorsToFirebase(data);
    } else {
      window.instructors = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    window.closeInstructorModal();
    if (typeof window.renderInstructorsList === 'function') window.renderInstructorsList();
    if (typeof window.showToast === 'function') window.showToast('Instrutor salvo!', 'success');
  };

  function onAddClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('#btn-add-instructor') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.openInstructorModal();
  }

  document.addEventListener('click', onAddClick, true);
  loadInstructors();
  window.__IAC_INSTRUCTOR_BOOT__ = true;
  console.log('[IAC] instructors-boot.js carregado');
})();
