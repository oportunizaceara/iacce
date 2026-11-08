(function (global) {
  const PERMISSIONS = [
    ['courses_view', 'Visualizar turmas'],
    ['courses_create', 'Criar turmas'],
    ['courses_edit', 'Editar turmas'],
    ['courses_delete', 'Excluir turmas'],
    ['students_view', 'Visualizar alunos'],
    ['instructors_manage', 'Gerenciar instrutores'],
    ['demands_manage', 'Gerenciar demandas'],
    ['calendar_manage', 'Gerenciar calendário'],
    ['audit_read', 'Consultar auditoria']
  ];

  const state = { staff: {}, directory: {}, ready: false, error: '', saving: false, syncing: false };

  function iac() { return global.IAC || {}; }
  function mods() { return global.firebaseModules || null; }
  function db() { return global.database || null; }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() {
    const user = iac().currentUser || (global.firebaseAuth && global.firebaseAuth.currentUser);
    return user ? user.uid : '';
  }
  function isRoot() { return !!(iac().isRootAdmin && iac().isRootAdmin()); }
  function hasPerm(key) { return !!(iac().hasPerm && iac().hasPerm(key)); }
  function toast(message, type) {
    if (typeof global.showToast === 'function') global.showToast(message, type || 'info');
  }
  function newId() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function stamp() {
    return mods() && mods().serverTimestamp ? mods().serverTimestamp() : Date.now();
  }
  function actorName() {
    const profile = iac().profile;
    if (profile && profile.name) return profile.name;
    const user = iac().currentUser;
    if (user && user.email) return user.email.split('@')[0];
    return 'Sistema';
  }
  async function read(path) {
    const snap = await mods().get(mods().ref(db(), path));
    return snap.exists() ? snap.val() : null;
  }
  async function write(path, value) {
    await mods().set(mods().ref(db(), path), value);
  }
  async function patch(updates) {
    await mods().update(mods().ref(db()), updates);
  }
  function listen(path, callback) {
    return mods().onValue(mods().ref(db(), path), callback, (error) => {
      console.warn('Listener', path, error);
    });
  }
  function people() {
    const map = {};
    Object.keys(state.directory || {}).forEach((id) => {
      const person = state.directory[id];
      if (person && person.active !== false) map[id] = Object.assign({ email: '' }, person);
    });
    if (isRoot()) {
      Object.keys(state.staff || {}).forEach((id) => {
        const person = state.staff[id];
        if (!person || person.active === false) return;
        map[id] = Object.assign({}, map[id] || {}, {
          name: person.name || (map[id] && map[id].name) || '',
          email: person.email || (map[id] && map[id].email) || '',
          username: person.username || (map[id] && map[id].username) || '',
          position: person.position || (map[id] && map[id].position) || '',
          role: person.role || (map[id] && map[id].role) || 'user',
          active: true
        });
      });
    }
    return map;
  }
  function personName(id) {
    if (!id) return '—';
    if (state.directory[id] && state.directory[id].name) return state.directory[id].name;
    if (state.staff[id] && state.staff[id].name) return state.staff[id].name;
    if (uid() === id) return actorName();
    return 'Funcionário';
  }

  global.IACData = {
    esc, uid, isRoot, hasPerm, toast, newId, stamp, actorName, read, write, patch, listen, people, personName,
    PERMISSIONS
  };

  function rootEmail(email) {
    const value = String(email || '').toLowerCase();
    return value === 'oportunizaceara@iacce.org.br' || value === 'oportunizaceara@iacce.ogr.br';
  }

  function authRows(data) {
    if (!data) return [];
    const raw = Array.isArray(data) ? data : (Array.isArray(data.users) ? data.users : null);
    if (raw) return raw;
    if (data.users && typeof data.users === 'object') {
      return Object.keys(data.users).map((id) => Object.assign({ uid: id }, data.users[id]));
    }
    return [];
  }

  async function mirrorAuthUsers(rows) {
    const seen = {};
    rows.forEach((user) => {
      const id = user && (user.uid || user.localId || user.id);
      if (id) seen[id] = user;
    });
    const ids = Object.keys(seen);
    if (!ids.length) throw new Error('O Firebase Auth não devolveu nenhuma conta.');
    const existingUsers = (await read('users')) || {};
    const existingDirectory = (await read('directory')) || {};
    const names = (await read('usernames')) || {};
    const updates = {};
    ids.forEach((id) => {
      const authUser = seen[id] || {};
      const existing = existingUsers[id] || {};
      const email = String(authUser.email || existing.email || '');
      const fallback = email.indexOf('@') > 0 ? email.split('@')[0] : 'Funcionário';
      const name = String(existing.name || authUser.displayName || authUser.name || fallback).trim();
      const role = rootEmail(email) ? 'admin' : (existing.role === 'viewer' ? 'viewer' : (existing.role || 'user'));
      const active = authUser.disabled !== true && authUser.active !== false;
      updates['users/' + id] = Object.assign({}, existing, {
        uid: id,
        name: name.length > 1 ? name : 'Funcionário',
        email,
        username: existing.username || '',
        position: existing.position || '',
        role,
        active,
        permissions: existing.permissions || {},
        notifPrefs: existing.notifPrefs || { demands: true, calendar: true, team: true },
        source: 'auth',
        updatedAt: stamp()
      });
      updates['directory/' + id] = {
        name: name.length > 1 ? name : 'Funcionário',
        username: existing.username || '',
        email,
        position: existing.position || '',
        role,
        active
      };
    });
    Object.keys(existingUsers).concat(Object.keys(existingDirectory)).forEach((id) => {
      if (!seen[id]) {
        updates['users/' + id] = null;
        updates['directory/' + id] = null;
      }
    });
    Object.keys(names).forEach((name) => {
      if (!seen[names[name]]) updates['usernames/' + name] = null;
    });
    await patch(updates);
    const next = {};
    ids.forEach((id) => { next[id] = updates['users/' + id]; });
    state.staff = next;
  }

  async function syncAuthStaff() {
    if (!isRoot() || !global.firebaseApp) return;
    state.syncing = true;
    state.error = '';
    const host = document.getElementById('content-equipe');
    if (host && !host.classList.contains('hidden')) render();
    try {
      const mod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
      const functions = mod.getFunctions(global.firebaseApp, 'us-central1');
      let synced = false;
      try {
        const result = await mod.httpsCallable(functions, 'syncAuthStaff')();
        const users = result && result.data && result.data.users;
        if (users && typeof users === 'object' && Object.keys(users).length) {
          state.staff = users;
          synced = true;
        }
      } catch (error) {
        console.warn('syncAuthStaff indisponível, usando getUsers:', error && error.message ? error.message : error);
      }
      if (!synced) {
        const result = await mod.httpsCallable(functions, 'getUsers')({});
        await mirrorAuthUsers(authRows(result && result.data));
      }
      state.ready = true;
      state.error = '';
    } catch (error) {
      console.warn('Sincronização do Auth indisponível:', error);
      state.error = 'Não foi possível ler os usuários do Firebase Auth.';
    } finally {
      state.syncing = false;
      if (host && !host.classList.contains('hidden')) render();
    }
  }

  async function saveStaff(id, input) {
    if (!isRoot()) throw new Error('Somente o administrador raiz pode editar funcionários.');
    const current = state.staff[id];
    if (!current) throw new Error('Funcionário não encontrado.');
    const name = String(input.name || '').trim();
    const position = String(input.position || '').trim();
    const role = rootEmail(current.email) ? 'admin' : (input.role === 'viewer' ? 'viewer' : 'user');
    if (name.length < 2) throw new Error('Informe o nome.');
    const permissions = {};
    PERMISSIONS.forEach(([key]) => { permissions[key] = !!input.permissions[key]; });
    const active = input.active !== false;
    const next = Object.assign({}, current, {
      name, position, role, permissions, active, updatedAt: stamp()
    });
    const directory = {
      name, username: current.username || '', email: current.email || '', position, role, active
    };
    await patch({
      ['users/' + id]: next,
      ['directory/' + id]: directory
    });
    const changes = iac().diffPlain ? iac().diffPlain(
      { name: current.name, position: current.position, role: current.role, active: current.active !== false },
      { name, position, role, active }
    ) : null;
    if (iac().logAction) {
      iac().logAction(active ? 'Funcionário atualizado' : 'Funcionário desativado', { username: current.username }, {
        module: 'Equipe', entityType: 'user', entityId: id, entityName: name, changes, origin: 'Equipe e Usuários'
      });
    }
  }

  const GLASS_THEMES = [
    ['azul', 'Azul', '#7eb6f6'],
    ['ciano', 'Ciano', '#5ec8d4'],
    ['violeta', 'Violeta', '#a78bfa'],
    ['menta', 'Menta', '#5dcca0'],
    ['pessego', 'Pêssego', '#f0a36b']
  ];

  function glassId(value) {
    return GLASS_THEMES.some(([id]) => id === value) ? value : 'azul';
  }

  function currentTheme() {
    const profile = iac().profile || {};
    return glassId(profile.theme || document.documentElement.getAttribute('data-glass'));
  }

  async function saveTheme(theme) {
    const id = uid();
    if (!id) throw new Error('Faça login para mudar a cor.');
    const safe = glassId(theme);
    await patch({
      ['users/' + id + '/theme']: safe,
      ['users/' + id + '/updatedAt']: stamp()
    });
    if (window.__iacProfile) window.__iacProfile.theme = safe;
    if (iac().applyGlassTheme) iac().applyGlassTheme(safe);
  }

  function themeFields(selected) {
    return '<fieldset class="glass-appearance"><legend>Aparência</legend><p>A cor do fundo vale só para a sua conta.</p><div class="glass-swatches">' +
      GLASS_THEMES.map(([id, label, color]) =>
        '<button type="button" class="glass-swatch' + (selected === id ? ' is-on' : '') + '" data-theme="' + id + '" style="--swatch:' + color + '" aria-pressed="' + (selected === id ? 'true' : 'false') + '"><span></span>' + esc(label) + '</button>'
      ).join('') + '</div></fieldset>';
  }

  async function saveOwnProfile(input) {
    const id = uid();
    if (!id) throw new Error('Faça login para editar seu perfil.');
    const name = String(input.name || '').trim();
    if (name.length < 2) throw new Error('Informe seu nome.');
    const password = String(input.password || '');
    const theme = glassId(input.theme);
    const updates = {};
    updates['users/' + id + '/name'] = name;
    updates['users/' + id + '/theme'] = theme;
    updates['users/' + id + '/updatedAt'] = stamp();
    const directory = state.directory[id];
    if (directory) {
      updates['directory/' + id] = Object.assign({}, directory, { name });
    }
    await patch(updates);
    if (password) {
      if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      const user = global.firebaseAuth.currentUser;
      if (!user || !mods().updatePassword) throw new Error('Não foi possível alterar a senha agora.');
      await mods().updatePassword(user, password);
    }
    if (window.__iacProfile) {
      window.__iacProfile.name = name;
      window.__iacProfile.theme = theme;
    }
    if (iac().applyGlassTheme) iac().applyGlassTheme(theme);
    if (iac().logAction) {
      iac().logAction('Perfil atualizado', {}, {
        module: 'Equipe', entityType: 'user', entityId: id, entityName: name, origin: 'Meu perfil',
        changes: { name: { field: 'Nome', before: actorName(), after: name } }
      });
    }
  }

  function permissionFields(selected, disabled) {
    return '<div class="iac-checks">' + PERMISSIONS.map(([key, label]) =>
      '<label><input type="checkbox" data-perm="' + key + '"' + (selected && selected[key] ? ' checked' : '') + (disabled ? ' disabled' : '') + '> ' + esc(label) + '</label>'
    ).join('') + '</div>';
  }

  function readPermissions(root) {
    const permissions = {};
    root.querySelectorAll('[data-perm]').forEach((input) => {
      permissions[input.getAttribute('data-perm')] = input.checked;
    });
    return permissions;
  }

  function openModal(html) {
    closeModal();
    const modal = document.createElement('div');
    modal.className = 'iac-modal';
    modal.id = 'iac-team-modal';
    modal.innerHTML = '<div class="iac-backdrop" data-close="1"></div><div class="iac-dialog">' + html + '</div>';
    modal.addEventListener('click', (event) => {
      if (event.target && event.target.getAttribute('data-close')) closeModal();
    });
    document.body.appendChild(modal);
  }

  function closeModal() {
    const modal = document.getElementById('iac-team-modal');
    if (modal) modal.remove();
  }

  function openEdit(id) {
    const person = state.staff[id];
    if (!person) return;
    openModal(
      '<div class="iac-head"><h2>Editar funcionário</h2><button class="iac-btn secondary" data-close="1" type="button">Fechar</button></div>' +
      '<form id="iac-staff-edit" class="iac-form">' +
      '<label>Nome<input name="name" required maxlength="120" value="' + esc(person.name || '') + '"></label>' +
      '<div class="split"><label>E-mail do Auth<input value="' + esc(person.email || '') + '" disabled></label><label>Cargo<input name="position" maxlength="80" value="' + esc(person.position || '') + '"></label></div>' +
      '<div class="split"><label>Nível<select name="role"' + (rootEmail(person.email) ? ' disabled' : '') + '><option value="user"' + (person.role !== 'viewer' ? ' selected' : '') + '>Funcionário</option><option value="viewer"' + (person.role === 'viewer' ? ' selected' : '') + '>Visualizador</option></select></label>' +
      '<label>Situação no Auth<input value="' + (person.active === false ? 'Desativada' : 'Ativa') + '" disabled></label></div>' +
      '<div><p class="iac-status">Permissões por módulo</p>' + permissionFields(person.permissions || {}, false) + '</div>' +
      '<p id="iac-staff-error" class="iac-status error"></p>' +
      '<div class="iac-row"><button class="iac-btn" type="submit">Salvar</button><button class="iac-btn secondary" type="button" id="iac-staff-history">Atividades</button></div></form>'
    );
    document.getElementById('iac-staff-edit').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const error = document.getElementById('iac-staff-error');
      error.textContent = 'Salvando...';
      try {
        await saveStaff(id, {
          name: form.name.value,
          position: form.position.value,
          role: form.role.value,
          active: person.active !== false,
          permissions: readPermissions(form)
        });
        closeModal();
        toast('Funcionário atualizado.', 'success');
      } catch (err) {
        error.textContent = err && err.message ? err.message : 'Não foi possível salvar.';
      }
    });
    document.getElementById('iac-staff-history').addEventListener('click', () => {
      closeModal();
      if (global.IACAudit) global.IACAudit.openForUser(id, person.name || person.username);
      else if (typeof global.switchTab === 'function') global.switchTab('auditoria');
    });
  }

  function openProfile() {
    const profile = iac().profile || {};
    const user = iac().currentUser;
    if (!user) {
      if (typeof global.openLoginModal === 'function') global.openLoginModal();
      return;
    }
    openModal(
      '<div class="iac-head"><h2>Meu perfil</h2><button class="iac-btn secondary" data-close="1" type="button">Fechar</button></div>' +
      '<form id="iac-own-profile" class="iac-form">' +
      '<label>Nome<input name="name" required maxlength="120" value="' + esc(profile.name || actorName()) + '"></label>' +
      '<div class="split"><label>Usuário<input value="' + esc(profile.username ? '@' + profile.username : (user.email || '')) + '" disabled></label><label>Cargo<input value="' + esc(profile.position || '—') + '" disabled></label></div>' +
      '<label>Nova senha<input name="password" type="password" minlength="6" autocomplete="new-password" placeholder="Deixe em branco para manter"></label>' +
      themeFields(currentTheme()) +
      '<p class="iac-status">Cargo, nível e permissões são definidos pelo administrador.</p>' +
      '<p id="iac-staff-error" class="iac-status error"></p>' +
      '<div class="iac-row"><button class="iac-btn" type="submit">Salvar</button><button class="iac-btn secondary" type="button" id="iac-own-history">Minhas atividades</button></div></form>'
    );
    const ownForm = document.getElementById('iac-own-profile');
    ownForm.querySelectorAll('.glass-swatch').forEach((button) => {
      button.addEventListener('click', async () => {
        const theme = button.getAttribute('data-theme');
        const previous = document.documentElement.getAttribute('data-glass') || 'azul';
        ownForm.querySelectorAll('.glass-swatch').forEach((other) => {
          const on = other === button;
          other.classList.toggle('is-on', on);
          other.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const error = document.getElementById('iac-staff-error');
        error.textContent = '';
        if (iac().applyGlassTheme) iac().applyGlassTheme(theme);
        try {
          await saveTheme(theme);
        } catch (err) {
          if (iac().applyGlassTheme) iac().applyGlassTheme(previous);
          ownForm.querySelectorAll('.glass-swatch').forEach((other) => {
            const on = other.getAttribute('data-theme') === previous;
            other.classList.toggle('is-on', on);
            other.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          error.textContent = 'Não foi possível guardar essa cor na sua conta.';
        }
      });
    });
    ownForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const chosen = form.querySelector('.glass-swatch.is-on');
      const error = document.getElementById('iac-staff-error');
      error.textContent = 'Salvando...';
      try {
        await saveOwnProfile({
          name: form.name.value,
          password: form.password.value,
          theme: chosen ? chosen.getAttribute('data-theme') : currentTheme()
        });
        closeModal();
        toast('Perfil atualizado.', 'success');
      } catch (err) {
        const message = err && err.code === 'auth/requires-recent-login'
          ? 'Entre novamente para alterar a senha.'
          : (err && err.message ? err.message : 'Não foi possível salvar.');
        error.textContent = message;
      }
    });
    document.getElementById('iac-own-history').addEventListener('click', () => {
      closeModal();
      if (global.IACAudit) global.IACAudit.openForUser(uid(), actorName());
    });
  }

  function render() {
    const host = document.getElementById('content-equipe');
    if (!host) return;
    if (!iac().isLoggedIn) {
      host.innerHTML = '<div class="iac-card iac-empty"><p>Faça login para ver a equipe.</p></div>';
      return;
    }
    if (!isRoot()) {
      host.innerHTML = '<div class="iac-card iac-empty"><p>A equipe é a lista de contas do Firebase Auth e só o administrador a consulta.</p><button class="iac-btn" type="button" id="iac-open-own">Meu perfil</button></div>';
      const button = document.getElementById('iac-open-own');
      if (button) button.onclick = openProfile;
      return;
    }
    const rows = Object.keys(state.staff).map((id) => ({ id, ...state.staff[id] }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    host.innerHTML =
      '<div class="iac-page"><button class="iac-btn secondary" type="button" id="iac-team-back">← Configurações</button><div class="iac-head"><div><h2>Equipe e usuários</h2><p>As mesmas contas do Firebase Authentication. Quem não existir no Auth é removido da equipe.</p></div>' +
      '<button class="iac-btn" type="button" id="iac-sync-staff">Atualizar</button></div>' +
      '<p class="iac-status">' + esc(state.syncing ? 'Sincronizando com o Firebase Auth...' : (state.error || (state.ready ? rows.length + ' conta(s) do Auth' : 'Carregando equipe...'))) + '</p>' +
      '<div class="iac-card iac-table-wrap">' + (rows.length ? '<table class="iac-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Nível</th><th>Auth</th></tr></thead><tbody>' +
        rows.map((person) => '<tr data-id="' + esc(person.id) + '"><td>' + esc(person.name || '—') + '</td><td>' + esc(person.email || '—') + '</td><td>' + esc(person.position || '—') + '</td><td>' + (rootEmail(person.email) || person.role === 'admin' ? 'Administrador' : (person.role === 'viewer' ? 'Visualizador' : 'Funcionário')) + '</td><td>' + (person.active === false ? 'Desativada' : 'Ativa') + '</td></tr>').join('') +
        '</tbody></table>' : '<div class="iac-empty">Nenhuma conta do Firebase Auth encontrada.</div>') +
      '</div></div>';
    const back = document.getElementById('iac-team-back');
    if (back) back.onclick = () => { if (typeof global.switchTab === 'function') global.switchTab('settings'); };
    const sync = document.getElementById('iac-sync-staff');
    if (sync) sync.onclick = () => { syncAuthStaff(); };
    host.querySelectorAll('tr[data-id]').forEach((row) => {
      row.onclick = () => openEdit(row.getAttribute('data-id'));
    });
  }

  let publishedFor = '';

  async function publishSelf() {
    const user = iac().currentUser || (global.firebaseAuth && global.firebaseAuth.currentUser);
    if (!user || !mods() || !db() || publishedFor === user.uid) return;
    const id = user.uid;
    let current = state.directory[id] || null;
    if (!current) {
      try { current = await read('directory/' + id); } catch (error) { current = null; }
    }
    const profile = iac().profile || {};
    const email = String(user.email || '');
    const fallback = email.indexOf('@') > 0 ? email.split('@')[0] : 'Funcionário';
    const name = String(profile.name || (current && current.name) || fallback).trim();
    const safeName = name.length > 1 ? name : 'Funcionário';
    try {
      if (current) {
        const next = {
          name: safeName,
          username: current.username || '',
          position: current.position || '',
          role: current.role || 'user',
          active: current.active !== false,
          email: email || current.email || ''
        };
        const same = next.name === current.name && (next.email || '') === (current.email || '') && next.role === (current.role || 'user') && next.active === (current.active !== false);
        if (!same) await write('directory/' + id, next);
      } else {
        await write('directory/' + id, {
          name: safeName,
          username: '',
          email,
          position: '',
          role: isRoot() ? 'admin' : 'user',
          active: true
        });
      }
      publishedFor = id;
    } catch (error) {
      console.warn('Não foi possível publicar o usuário no diretório:', error);
    }
  }

  const stops = [];
  function stopAll() {
    stops.splice(0).forEach((stop) => {
      try { stop(); } catch (error) { console.warn(error); }
    });
  }
  function watch(path, callback) {
    const modules = mods();
    const reference = modules.ref(db(), path);
    const unsubscribe = modules.onValue(reference, callback, (error) => {
      state.error = 'Não foi possível ler ' + path + '. Publique as regras do banco.';
      console.warn(path, error);
    });
    if (typeof unsubscribe === 'function') stops.push(unsubscribe);
    return unsubscribe;
  }
  function start() {
    if (!mods() || !db() || !iac().isLoggedIn) return;
    stopAll();
    watch('directory', (snap) => {
      state.directory = snap.exists() ? (snap.val() || {}) : {};
      document.dispatchEvent(new CustomEvent('iac-directory'));
      const host = document.getElementById('content-equipe');
      if (host && !host.classList.contains('hidden')) render();
    });
    if (!isRoot()) {
      state.ready = true;
      publishSelf();
      return;
    }
    watch('users', (snap) => {
      state.ready = true;
      state.staff = snap.exists() ? (snap.val() || {}) : {};
      document.dispatchEvent(new CustomEvent('iac-directory'));
      const host = document.getElementById('content-equipe');
      if (host && !host.classList.contains('hidden')) render();
    });
    publishSelf();
    syncAuthStaff();
  }

  document.addEventListener('iac-auth-changed', () => {
    if (!iac().isLoggedIn) {
      stopAll();
      state.staff = {};
      state.directory = {};
      state.ready = false;
      publishedFor = '';
    } else {
      start();
    }
    const host = document.getElementById('content-equipe');
    if (host && !host.classList.contains('hidden')) render();
  });
  document.addEventListener('firebase-ready', () => { if (iac().isLoggedIn) start(); });

  global.IACTeam = { render, open: function () { if (typeof global.switchTab === 'function') global.switchTab('equipe'); }, openProfile, sync: syncAuthStaff };
})(window);
