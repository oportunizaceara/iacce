const STORAGE_KEY_COURSES = 'dashboard_courses';
    const STORAGE_KEY_RESPONSIBLES = 'dashboard_responsibles';
    const STORAGE_KEY_CHECKLISTS = 'course_checklists';

    function isCourseEmAndamento(course) {
      const status = normalizeStatus(course.status || '');
      return status === 'em andamento' || status === 'em andamento.' || status.includes('andamento');
    }

    function isTurmaFechada(course) {
      const value = course?.turmaFormada;
      if (value === true || value === 1) return true;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'sim' || normalized === 's' || normalized === 'yes';
      }
      return false;
    }

    function normalizeCourseData(course) {
      if (!course || typeof course !== 'object') return course;
      const normalized = { ...course };
      normalized.turmaFormada = isTurmaFechada(normalized);
      return normalized;
    }

    function normalizeAllCourses(list) {
      const coursesArray = Array.isArray(list)
        ? list
        : (list && typeof list === 'object' ? Object.values(list) : []);
      return coursesArray
        .filter(course => course && typeof course === 'object')
        .map(course => normalizeCourseData({ ...course }));
    }

    function preserveTurmaFormadaFlag(course, hadTurmaFormada) {
      if (hadTurmaFormada) {
        course.turmaFormada = true;
      }
      return course;
    }

    function syncCourseToFiltered(courseId) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;
      const filteredIndex = filteredCourses.findIndex(c => c.id === courseId);
      if (filteredIndex !== -1) {
        filteredCourses[filteredIndex] = { ...filteredCourses[filteredIndex], ...course };
      }
    }

    function isCourseConcluido(course) {
      const status = normalizeStatus(course.status || '');
      return status === 'concluído' || status === 'concluido' || status === 'concluida' || status === 'concluída';
    }

    function isCourseEmBreve(course) {
      if (isTurmaFechada(course)) return false;
      if (isCourseConcluido(course)) return false;
      if (isCourseEmAndamento(course)) return false;
      const status = normalizeStatus(course.status || '');
      return status.includes('breve');
    }

    function getCourseStartTime(course) {
      return course.dataInicio ? new Date(course.dataInicio).getTime() : Number.MAX_SAFE_INTEGER;
    }

    function getCronogramaPriority(course) {
      if (isTurmaFechada(course)) return 0;
      if (isCourseEmAndamento(course)) return 1;
      if (isCourseEmBreve(course)) return 2;
      return 3;
    }

    function sortCronogramaCourses(list) {
      return [...list].sort((a, b) => {
        const pa = getCronogramaPriority(a);
        const pb = getCronogramaPriority(b);
        if (pa !== pb) return pa - pb;
        const dateA = getCourseStartTime(a);
        const dateB = getCourseStartTime(b);
        if (pa <= 2) return dateA - dateB;
        return dateB - dateA;
      });
    }

    function sortTarefasCourses(list) {
      return [...list].sort((a, b) => {
        const pa = isCourseEmAndamento(a) ? 0 : 1;
        const pb = isCourseEmAndamento(b) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return getCourseStartTime(a) - getCourseStartTime(b);
      });
    }

    function sortCoursesByStartDate(list) {
      return [...list].sort((a, b) => getCourseStartTime(a) - getCourseStartTime(b));
    }

    function isCronogramaPriorityCourse(course) {
      if (isTurmaFechada(course)) return true;
      if (isCourseConcluido(course)) return false;
      return isCourseEmAndamento(course) || isCourseEmBreve(course);
    }

    const STORAGE_KEY_CALENDAR_EVENTS = 'calendar_events';
    const STORAGE_KEY_CALENDAR_TASKS = 'calendar_tasks';

    function saveCalendarToLocal() {
      localStorage.setItem(STORAGE_KEY_CALENDAR_EVENTS, JSON.stringify(calendarEvents));
      localStorage.setItem(STORAGE_KEY_CALENDAR_TASKS, JSON.stringify(calendarTasks));
    }

    async function saveCalendarToFirebase() {
      saveCalendarToLocal();
      if (!window.database || !window.firebaseModules || isUpdatingFromListener) return;
      try {
        const { ref, set } = window.firebaseModules;
        await set(ref(window.database, 'calendarEvents'), calendarEvents);
        await set(ref(window.database, 'calendarTasks'), calendarTasks);
      } catch (error) {
        console.warn('Erro ao salvar calendário no Firebase:', error);
      }
    }

    async function loadCalendarFromFirebase() {
      if (!window.database || !window.firebaseModules) return;
      try {
        const { ref, get } = window.firebaseModules;
        const [eventsSnap, tasksSnap] = await Promise.all([
          get(ref(window.database, 'calendarEvents')),
          get(ref(window.database, 'calendarTasks'))
        ]);
        if (eventsSnap.exists()) {
          const data = eventsSnap.val();
          if (Array.isArray(data)) {
            calendarEvents = data;
            localStorage.setItem(STORAGE_KEY_CALENDAR_EVENTS, JSON.stringify(calendarEvents));
          }
        }
        if (tasksSnap.exists()) {
          const data = tasksSnap.val();
          if (Array.isArray(data)) {
            calendarTasks = data;
            localStorage.setItem(STORAGE_KEY_CALENDAR_TASKS, JSON.stringify(calendarTasks));
          }
        } else if (!eventsSnap.exists() && (calendarEvents.length + calendarTasks.length) > 0) {
          await saveCalendarToFirebase();
        }
        renderCalendar();
      } catch (error) {
        console.warn('Erro ao carregar calendário do Firebase:', error);
      }
    }

    function canEditCourses() {
      return isLoggedIn && userRole !== 'viewer';
    }

    function requireEditAccess() {
      if (!canEditCourses()) {
        if (!isLoggedIn) openLoginModal();
        else showToast('Você não tem permissão para editar.', 'error');
        return false;
      }
      return true;
    }


    // Load data - will be loaded from Firestore
    let courses = [];
    let lotResponsibles = {};
    let courseChecklists = {};
    let filteredCourses = [];
    let dataMigrationDone = false;
    
    let currentEditLot = null;
    let currentEditCourse = null;
    let uploadedData = [];
    let fileColumns = [];
    let columnMapping = {};
    let isLoggedIn = false;
    let firebaseAuth = null;
    let unsubscribeCourses = null;
    let currentUser = null;
    let userRole = 'user'; // 'admin', 'user', 'viewer'
    let actionLogs = [];
    let sessionTimeout = null;
    let lastActionTime = Date.now();
    let pendingActions = new Set();
    
    // Sistema de Undo
    let undoStack = [];
    const MAX_UNDO_STACK = 10;
    let tourSteps = [
      { title: 'Dashboard', content: 'Visualize todos os cursos organizados por lote. Use os filtros para encontrar cursos específicos.', target: 'tab-dashboard' },
      { title: 'Cronograma', content: 'Veja os cursos em formato de prateleira. Clique em um card para ver detalhes completos.', target: 'tab-cronograma' },
      { title: 'Calendário', content: 'Acompanhe datas de início e fim dos cursos. Adicione eventos e tarefas.', target: 'tab-calendar' },
      { title: 'Tarefas', content: 'Checklist de preparação e acompanhamento das turmas em breve e em andamento.', target: 'tab-tarefas' },
      { title: 'Notificações', content: 'Receba alertas sobre cursos próximos de iniciar ou finalizar.', target: 'notifications-btn' },
      { title: 'Configurações', content: 'Gerencie usuários, importe dados, gere relatórios e configure o sistema.', target: 'tab-settings' }
    ];
    let currentTourStep = 0;
    let unsubscribeResponsibles = null;
    let unsubscribeChecklists = null;
    window.editingResponsibleId = null; // Para controlar qual responsável está sendo editado

    const fieldLabels = {
      idCurso: 'ID',
      tipologia: 'TIPOLOGIA',
      cargaHoraria: 'CARGA HORÁRIA',
      dataInicio: 'DATA INÍCIO',
      dataFim: 'DATA TÉRMINO',
      municipio: 'CIDADE',
      turno: 'TURNO',
      lote: 'LOTE',
      cozinha: 'COZINHA',
      endereco: 'ENDEREÇO',
      status: 'STATUS',
      concludentes: 'CONCLUDENTES',
      albumLink: 'ALBUM',
      instrumentaisLink: 'INSTRUMENTAIS',
      instrutor: 'INSTRUTOR'
    };

    const CHECKLIST_TEMPLATE = {
      inicializacao: [
        { key: 'articulacao_data', label: 'Articulação de data' },
        { key: 'contratacao_instrutor', label: 'Contratação de instrutor' },
        { key: 'solicitacao_material', label: 'Solicitação de material' },
        { key: 'montagem_kit_aluno', label: 'Montagem de kit Aluno' },
        { key: 'instrumentais', label: 'Instrumentais' },
        { key: 'separacao_material_execucao', label: 'Separação de material de execução' },
        { key: 'confirmar_demandante', label: 'Confirmar com o Demandante' },
        { key: 'abertura_curso', label: 'Abertura de curso realizada' }
      ],
      emAndamento: [
        { key: 'grupo_whatsapp', label: 'Instrutora Criar o grupo Whatsapp' },
        { key: 'acompanhar_fotos', label: 'Acompanhar andamento do curso com as fotos' },
        { key: 'listagem_concludentes', label: 'Solicitar listagem dos concludentes' },
        { key: 'curso_concluido', label: 'Curso concluído' }
      ]
    };

    let currentTarefasModalCourseId = null;
    let editingChecklistItem = null;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function initChecklistFromTemplate() {
      return {
        inicializacao: CHECKLIST_TEMPLATE.inicializacao.map(item => ({ ...item, checked: false })),
        emAndamento: CHECKLIST_TEMPLATE.emAndamento.map(item => ({ ...item, checked: false }))
      };
    }

    function migrateChecklistIfNeeded(courseId) {
      const state = courseChecklists[courseId];
      if (!state) return;
      if (Array.isArray(state.inicializacao)) return;

      const oldInit = state.inicializacao || {};
      const oldAnd = state.emAndamento || {};
      state.inicializacao = CHECKLIST_TEMPLATE.inicializacao.map(item => ({
        ...item,
        checked: !!oldInit[item.key]
      }));
      state.emAndamento = CHECKLIST_TEMPLATE.emAndamento.map(item => ({
        ...item,
        checked: !!oldAnd[item.key]
      }));
    }

    async function saveToRealtimeDatabase() {
      if (isUpdatingFromListener) {
        console.log('Ignorando salvamento - atualização vinda do listener');
        return; // Prevent infinite loop
      }
      
      if (!window.database || !window.firebaseModules) {
        console.warn('Realtime Database não disponível, usando localStorage como fallback');
        localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
        localStorage.setItem(STORAGE_KEY_RESPONSIBLES, JSON.stringify(lotResponsibles));
        localStorage.setItem(STORAGE_KEY_CHECKLISTS, JSON.stringify(courseChecklists));
        return;
      }

      try {
        const db = window.database;
        const { ref, set } = window.firebaseModules;
        
        console.log('Salvando no Realtime Database...', { courses: courses.length, responsibles: Object.keys(lotResponsibles).length });
        
        // Save courses
        const coursesToSave = normalizeAllCourses(courses);
        await set(ref(db, 'courses'), coursesToSave);
        console.log('Cursos salvos no Realtime Database com sucesso');
        
        // Save responsibles
        await set(ref(db, 'responsibles'), lotResponsibles);
        console.log('Responsáveis salvos no Realtime Database com sucesso');

        // Save course checklists
        await set(ref(db, 'courseChecklists'), courseChecklists);
        
        // Update last sync timestamp
        await set(ref(db, 'lastSync'), new Date().toISOString());
      } catch (error) {
        console.error('Erro ao salvar no Realtime Database:', error);
        
        // Show user-friendly error
        if (error.code === 'PERMISSION_DENIED') {
          alert('Erro de permissão no Realtime Database. Verifique as regras de segurança no Firebase Console.');
        }
        
        // Fallback to localStorage
        localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
        localStorage.setItem(STORAGE_KEY_RESPONSIBLES, JSON.stringify(lotResponsibles));
        localStorage.setItem(STORAGE_KEY_CHECKLISTS, JSON.stringify(courseChecklists));
      }
    }

    async function saveCourseChecklists() {
      if (isUpdatingFromListener) return;

      localStorage.setItem(STORAGE_KEY_CHECKLISTS, JSON.stringify(courseChecklists));

      if (!window.database || !window.firebaseModules) return;

      try {
        const { ref, set } = window.firebaseModules;
        await set(ref(window.database, 'courseChecklists'), courseChecklists);
      } catch (error) {
        console.error('Erro ao salvar checklists:', error);
      }
    }

    // Alias for compatibility - make sure to await this when needed
    async function saveToStorage() {
      await saveToRealtimeDatabase();
    }

    async function loadFromRealtimeDatabase() {
      // Esta função agora só sincroniza com Firebase, não bloqueia a UI
      if (!window.database || !window.firebaseModules) {
        console.warn('Realtime Database não disponível, usando localStorage');
        return;
      }

      const localCourses = JSON.parse(localStorage.getItem(STORAGE_KEY_COURSES)) || [];
      const localResponsibles = JSON.parse(localStorage.getItem(STORAGE_KEY_RESPONSIBLES)) || {};

      try {
        const db = window.database;
        const { ref, get } = window.firebaseModules;
        
        // Try to load courses from Realtime Database with timeout
        const coursesPromise = get(ref(db, 'courses'));
        const coursesTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao carregar cursos')), 10000)
        );
        
        const coursesSnapshot = await Promise.race([coursesPromise, coursesTimeout]);
        
        if (coursesSnapshot.exists()) {
          const dbCourses = coursesSnapshot.val();
          const normalized = normalizeAllCourses(dbCourses);
          if (normalized.length > 0) {
            courses = normalized;
            // Update localStorage as backup
            localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
          }
        } else {
          // No data in Realtime Database, migrate from localStorage if exists
          if (localCourses.length > 0 && !dataMigrationDone) {
            console.log('Migrando dados do localStorage para Realtime Database...');
            await saveToRealtimeDatabase();
            dataMigrationDone = true;
          }
        }
        
        // Try to load responsibles from Realtime Database with timeout
        const responsiblesPromise = get(ref(db, 'responsibles'));
        const responsiblesTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao carregar responsáveis')), 10000)
        );
        
        const responsiblesSnapshot = await Promise.race([responsiblesPromise, responsiblesTimeout]);
        
        if (responsiblesSnapshot.exists()) {
          const dbResponsibles = responsiblesSnapshot.val() || {};
          if (Object.keys(dbResponsibles).length > 0) {
            lotResponsibles = dbResponsibles;
            // Update localStorage as backup
            localStorage.setItem(STORAGE_KEY_RESPONSIBLES, JSON.stringify(lotResponsibles));
          }
        } else {
          // No data in Realtime Database, migrate from localStorage if exists
          if (Object.keys(localResponsibles).length > 0 && !dataMigrationDone) {
            await saveToRealtimeDatabase();
            dataMigrationDone = true;
          }
        }
        
        // Try to load course checklists
        try {
          const checklistsSnapshot = await get(ref(db, 'courseChecklists'));
          if (checklistsSnapshot.exists()) {
            courseChecklists = checklistsSnapshot.val() || {};
            localStorage.setItem(STORAGE_KEY_CHECKLISTS, JSON.stringify(courseChecklists));
          }
        } catch (checklistError) {
          console.warn('Erro ao carregar checklists:', checklistError);
        }
        
        filteredCourses = [...courses];
        console.log('✅ Dados sincronizados do Realtime Database com sucesso');
        
        // Atualizar UI se houver mudanças
      renderAll();
      } catch (error) {
        console.warn('⚠️ Erro ao sincronizar com Realtime Database (usando localStorage):', error.code || error.message);
        // Dados do localStorage já estão sendo usados, não precisa fazer nada
      }
    }

    let isUpdatingFromListener = false;

    function setupRealtimeListeners() {
      if (!window.database || !window.firebaseModules) {
        // Fallback to localStorage sync (manual refresh needed)
        console.warn('Realtime Database não disponível, sincronização em tempo real desabilitada');
        return;
      }
      
      const db = window.database;
      const { ref, onValue, off } = window.firebaseModules;
      
      console.log('Configurando listeners em tempo real do Realtime Database...');
      
      // Unsubscribe from previous listeners if any
      if (unsubscribeCourses && typeof unsubscribeCourses === 'function') {
        unsubscribeCourses();
      }
      if (unsubscribeResponsibles && typeof unsubscribeResponsibles === 'function') {
        unsubscribeResponsibles();
      }
      if (unsubscribeChecklists && typeof unsubscribeChecklists === 'function') {
        unsubscribeChecklists();
      }
      
      try {
        // Listen to courses changes
        const coursesRef = ref(db, 'courses');
        const coursesCallback = (snapshot) => {
            if (snapshot.exists() && !isUpdatingFromListener) {
            const rawCourses = snapshot.val() || [];
            const newCourses = normalizeAllCourses(rawCourses);
              const currentStr = JSON.stringify(courses.map(c => c.id).sort());
              const newStr = JSON.stringify(newCourses.map(c => c.id).sort());
              
              if (currentStr !== newStr) {
                console.log('🔄 Atualizando cursos via listener em tempo real', { oldCount: courses.length, newCount: newCourses.length });
                isUpdatingFromListener = true;
                courses = normalizeAllCourses(newCourses);
                filteredCourses = [...courses];
                // Update localStorage as backup
                localStorage.setItem(STORAGE_KEY_COURSES, JSON.stringify(courses));
                updateFilters();
                applyFilters();
                renderTarefas();
                setTimeout(() => { isUpdatingFromListener = false; }, 100);
              }
            }
        };
        onValue(coursesRef, coursesCallback, (error) => {
            console.warn('⚠️ Erro no listener de courses (sincronização em tempo real desabilitada):', error.code || error.message);
          if (error.code === 'PERMISSION_DENIED') {
            console.warn('Permissão negada no Realtime Database. Verifique as regras de segurança.');
          }
        });
        // Store unsubscribe function
        unsubscribeCourses = () => off(coursesRef, 'value', coursesCallback);
        
        // Listen to responsibles changes
        const responsiblesRef = ref(db, 'responsibles');
        const responsiblesCallback = (snapshot) => {
            if (snapshot.exists() && !isUpdatingFromListener) {
            const newResponsibles = snapshot.val() || {};
              const currentStr = JSON.stringify(lotResponsibles);
              const newStr = JSON.stringify(newResponsibles);
              
              if (currentStr !== newStr) {
                console.log('🔄 Atualizando responsáveis via listener em tempo real');
                isUpdatingFromListener = true;
                lotResponsibles = newResponsibles;
                // Update localStorage as backup
                localStorage.setItem(STORAGE_KEY_RESPONSIBLES, JSON.stringify(lotResponsibles));
                renderAll();
                setTimeout(() => { isUpdatingFromListener = false; }, 100);
              }
            }
        };
        onValue(responsiblesRef, responsiblesCallback, (error) => {
            console.warn('⚠️ Erro no listener de responsibles (sincronização em tempo real desabilitada):', error.code || error.message);
          if (error.code === 'PERMISSION_DENIED') {
            console.warn('Permissão negada no Realtime Database. Verifique as regras de segurança.');
          }
        });
        // Store unsubscribe function
        unsubscribeResponsibles = () => off(responsiblesRef, 'value', responsiblesCallback);
        
        // Listen to course checklists changes
        const checklistsRef = ref(db, 'courseChecklists');
        const checklistsCallback = (snapshot) => {
          if (snapshot.exists() && !isUpdatingFromListener) {
            const newChecklists = snapshot.val() || {};
            const currentStr = JSON.stringify(courseChecklists);
            const newStr = JSON.stringify(newChecklists);
            if (currentStr !== newStr) {
              isUpdatingFromListener = true;
              courseChecklists = newChecklists;
              localStorage.setItem(STORAGE_KEY_CHECKLISTS, JSON.stringify(courseChecklists));
              renderTarefas();
              if (currentTarefasModalCourseId) {
                renderTarefasChecklistModalContent(currentTarefasModalCourseId);
              }
              setTimeout(() => { isUpdatingFromListener = false; }, 100);
            }
          }
        };
        onValue(checklistsRef, checklistsCallback, (error) => {
          console.warn('⚠️ Erro no listener de checklists:', error.code || error.message);
        });
        unsubscribeChecklists = () => off(checklistsRef, 'value', checklistsCallback);
        const calendarEventsRef = ref(db, 'calendarEvents');
        const calendarEventsCallback = (snapshot) => {
          if (snapshot.exists() && !isUpdatingFromListener) {
            const newEvents = snapshot.val() || [];
            if (JSON.stringify(calendarEvents) !== JSON.stringify(newEvents)) {
              isUpdatingFromListener = true;
              calendarEvents = Array.isArray(newEvents) ? newEvents : [];
              localStorage.setItem(STORAGE_KEY_CALENDAR_EVENTS, JSON.stringify(calendarEvents));
              renderCalendar();
              setTimeout(() => { isUpdatingFromListener = false; }, 100);
            }
          }
        };
        onValue(calendarEventsRef, calendarEventsCallback);

        const calendarTasksRef = ref(db, 'calendarTasks');
        const calendarTasksCallback = (snapshot) => {
          if (snapshot.exists() && !isUpdatingFromListener) {
            const newTasks = snapshot.val() || [];
            if (JSON.stringify(calendarTasks) !== JSON.stringify(newTasks)) {
              isUpdatingFromListener = true;
              calendarTasks = Array.isArray(newTasks) ? newTasks : [];
              localStorage.setItem(STORAGE_KEY_CALENDAR_TASKS, JSON.stringify(calendarTasks));
              renderCalendar();
              setTimeout(() => { isUpdatingFromListener = false; }, 100);
            }
          }
        };
        onValue(calendarTasksRef, calendarTasksCallback);

        
        console.log('✅ Listeners em tempo real configurados com sucesso');
      } catch (error) {
        console.error('Erro ao configurar listeners:', error);
      }
    }

    // Firebase Authentication
    async function checkFirebaseAuth() {
      try {
        if (window.firebaseAuth && window.firebaseModules) {
          return new Promise((resolve) => {
            window.firebaseModules.onAuthStateChanged(window.firebaseAuth, async (user) => {
              isLoggedIn = !!user;
              currentUser = user;
              
              if (user) {
                try {
                  // Tentar obter custom claims do token (Firebase Custom Claims)
                  const idTokenResult = await user.getIdTokenResult();
                  userRole = idTokenResult.claims.role || 'user';
                  
                  // Fallback: verificar email se não tiver custom claim configurado
                  if (!idTokenResult.claims.role) {
                    const adminEmails = ['admin@iac.com', 'administrador@iac.com', 'alissonh26@gmail.com'];
                    userRole = adminEmails.includes(user.email?.toLowerCase()) ? 'admin' : 'user';
                  }
                } catch (error) {
                  console.error('Erro ao obter custom claims:', error);
                  // Fallback para verificação por email
                  const adminEmails = ['admin@iac.com', 'administrador@iac.com', 'alissonh26@gmail.com'];
                  userRole = adminEmails.includes(user.email?.toLowerCase()) ? 'admin' : 'user';
                }
                
                // Atualizar UI baseado no role
                const dangerZone = document.getElementById('danger-zone');
                if (dangerZone) {
                  dangerZone.classList.toggle('hidden', userRole !== 'admin');
                }
                
                logAction('Login', { email: user.email, role: userRole });
              } else {
                currentUser = null;
                userRole = 'user';
              }
              
              updateUIForLoginStatus();
              renderAll();
              resolve(!!user);
            });
          });
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação Firebase:', error);
        isLoggedIn = false;
        return false;
      }
      return false;
    }

    function updateUIForLoginStatus() {
      const adminElements = document.querySelectorAll('.admin-only');
      const viewElements = document.querySelectorAll('.view-only');
      
      // Update responsibles modal sections
      const addRespSection = document.getElementById('add-responsible-section');
      const deleteLotSection = document.getElementById('delete-lot-section');
      
      // Update mobile menu drawer buttons
      const tabSettingsMobile = document.getElementById('tab-settings-mobile');
      const logoutBtnMobile = document.getElementById('logout-btn-mobile');
      const loginBtnMobile = document.getElementById('login-btn-mobile');
      
      // Adicionar tooltip e desabilitar botões para não-admin
      document.querySelectorAll('button.admin-only, input.admin-only, select.admin-only').forEach(el => {
        if (!isLoggedIn || userRole !== 'admin') {
          el.disabled = true;
          el.title = 'Apenas administradores podem executar esta ação';
          el.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          el.disabled = false;
          el.title = '';
          el.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      });
      
      // Adicionar indicador de modo somente leitura
      if (isLoggedIn && userRole === 'viewer') {
        const readOnlyBanner = document.getElementById('read-only-banner');
        if (!readOnlyBanner) {
          const banner = document.createElement('div');
          banner.id = 'read-only-banner';
          banner.className = 'fixed top-0 left-0 right-0 bg-[#FF9500] text-white text-center py-2 text-sm font-medium z-[1100]';
          banner.innerHTML = `
            <div class="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Você está em modo visualização - Apenas leitura</span>
            </div>
          `;
          document.body.appendChild(banner);
          // Ajustar padding do header para não sobrepor
          const header = document.querySelector('.header-fixed');
          if (header) {
            header.style.marginTop = '40px';
          }
        }
      } else {
        const readOnlyBanner = document.getElementById('read-only-banner');
        if (readOnlyBanner) {
          readOnlyBanner.remove();
          const header = document.querySelector('.header-fixed');
          if (header) {
            header.style.marginTop = '';
          }
        }
      }
      
      if (isLoggedIn) {
        // Show admin elements, hide view-only elements
        adminElements.forEach(el => {
          if (userRole === 'admin') {
          el.classList.remove('hidden');
          el.style.display = '';
          } else {
            el.classList.add('hidden');
            el.style.display = 'none';
          }
        });
        viewElements.forEach(el => {
          el.classList.add('hidden');
          el.style.display = 'none';
        });
        
        // Show modal admin sections
        if (addRespSection) addRespSection.style.display = userRole === 'admin' ? 'block' : 'none';
        if (deleteLotSection) deleteLotSection.style.display = userRole === 'admin' ? 'block' : 'none';
        
        // Update mobile menu
        if (tabSettingsMobile) tabSettingsMobile.classList.toggle('hidden', userRole !== 'admin');
        if (logoutBtnMobile) logoutBtnMobile.classList.remove('hidden');
        if (loginBtnMobile) loginBtnMobile.classList.add('hidden');
      } else {
        // Hide admin elements, show view-only elements
        adminElements.forEach(el => {
          el.classList.add('hidden');
          el.style.display = 'none';
        });
        viewElements.forEach(el => {
          el.classList.remove('hidden');
          el.style.display = '';
        });
        
        // Hide modal admin sections
        if (addRespSection) addRespSection.style.display = 'none';
        if (deleteLotSection) deleteLotSection.style.display = 'none';
        
        // Update mobile menu
        if (tabSettingsMobile) tabSettingsMobile.classList.add('hidden');
        if (logoutBtnMobile) logoutBtnMobile.classList.add('hidden');
        if (loginBtnMobile) loginBtnMobile.classList.remove('hidden');
      }
    }

    function openLoginModal() {
      document.getElementById('login-modal').classList.remove('hidden');
      document.getElementById('login-error').classList.add('hidden');
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
      document.body.classList.add('modal-open');
    }

    function closeLoginModal() {
      document.getElementById('login-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    async function handleLogin() {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const remember = document.getElementById('remember-login')?.checked || false;
      const errorDiv = document.getElementById('login-error');

      if (!email || !password) {
        errorDiv.textContent = 'Por favor, preencha todos os campos.';
        errorDiv.classList.remove('hidden');
        return;
      }

      // Mostrar tela de carregamento
      const loginLoading = document.getElementById('login-loading');
      if (loginLoading) {
        loginLoading.classList.remove('hidden');
      }
      closeLoginModal();

      try {
        if (!window.firebaseAuth || !window.firebaseModules) {
          errorDiv.textContent = 'Firebase não está configurado. Configure as credenciais do Firebase no código.';
          errorDiv.classList.remove('hidden');
          return;
        }

        // Set persistence based on remember checkbox
        const { setPersistence, browserLocalPersistence, browserSessionPersistence } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(window.firebaseAuth, persistence);

        errorDiv.textContent = 'Entrando...';
        errorDiv.classList.remove('hidden');
        errorDiv.classList.remove('bg-red-500/20', 'border-red-500/50', 'text-red-400');
        errorDiv.classList.add('bg-blue-500/20', 'border-blue-500/50', 'text-blue-400');

        const userCredential = await window.firebaseModules.signInWithEmailAndPassword(window.firebaseAuth, email, password);
        currentUser = userCredential.user;
        
        // Obter custom claims do token (se configurado no Firebase)
        try {
          const idTokenResult = await currentUser.getIdTokenResult();
          userRole = idTokenResult.claims.role || 'user';
          
          // Fallback: verificar email se não tiver custom claim configurado
          if (!idTokenResult.claims.role) {
            const adminEmails = ['admin@iac.com', 'administrador@iac.com', 'alissonh26@gmail.com'];
            userRole = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
          }
        } catch (error) {
          console.error('Erro ao obter custom claims:', error);
          // Fallback para verificação por email
          const adminEmails = ['admin@iac.com', 'administrador@iac.com', 'alissonh26@gmail.com'];
          userRole = adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user';
        }
        
        logAction('Login', { email: email, role: userRole });
        
        // Esconder tela de carregamento
        const loginLoading = document.getElementById('login-loading');
        if (loginLoading) {
          loginLoading.classList.add('hidden');
        }
        
        showToast('Login realizado com sucesso!', 'success');
        
        // Success - auth state will be updated by onAuthStateChanged
        closeLoginModal();
      } catch (error) {
        console.error('Erro no login:', error);
        errorDiv.classList.remove('bg-blue-500/20', 'border-blue-500/50', 'text-blue-400');
        errorDiv.classList.add('bg-red-500/20', 'border-red-500/50', 'text-red-400');
        
        let errorMessage = 'Erro ao fazer login.';
        if (error.code === 'auth/user-not-found') {
          errorMessage = 'Usuário não encontrado.';
        } else if (error.code === 'auth/wrong-password') {
          errorMessage = 'Senha incorreta.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'E-mail inválido.';
        } else if (error.code === 'auth/too-many-requests') {
          errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
        } else if (error.code === 'auth/invalid-credential') {
          errorMessage = 'Credenciais inválidas. Verifique seu e-mail e senha.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        errorDiv.textContent = errorMessage;
        errorDiv.classList.remove('hidden');
        
        // Esconder tela de carregamento em caso de erro
        const loginLoading = document.getElementById('login-loading');
        if (loginLoading) {
          loginLoading.classList.add('hidden');
        }
        openLoginModal(); // Reabrir modal de login
      }
    }

    async function handleLogout() {
      if (!confirm('Deseja fazer logout?')) return;
      
      try {
        if (window.firebaseAuth && window.firebaseModules) {
          await window.firebaseModules.signOut(window.firebaseAuth);
          // Auth state will be updated by onAuthStateChanged
        }
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout. Tente novamente.');
      }
    }

    // Theme Toggle Functions
    function initTheme() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      if (savedTheme === 'dark') {
        document.body.classList.add('dark');
        updateThemeIcon(true);
      } else {
        document.body.classList.remove('dark');
        updateThemeIcon(false);
      }
    }

    function toggleTheme() {
      const isDark = document.body.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      updateThemeIcon(isDark);
    }

    function updateThemeIcon(isDark) {
      const themeIcon = document.getElementById('theme-icon');
      const themeText = document.getElementById('theme-text');
      const headerThemeIcon = document.getElementById('header-theme-icon');
      
      if (themeIcon && themeText) {
        if (isDark) {
          themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />';
          themeText.textContent = 'Modo Claro';
        } else {
          themeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />';
          themeText.textContent = 'Modo Escuro';
        }
      }
      
      if (headerThemeIcon) {
        if (isDark) {
          headerThemeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />';
        } else {
          headerThemeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />';
        }
      }
    }

    // Initialize
    // Tratamento de erros silencioso para recursos que podem não existir
    window.addEventListener('error', (event) => {
      // Silenciar erros de ícones e manifest que podem não existir em desenvolvimento
      if (event.target && (
        event.target.tagName === 'LINK' && 
        (event.target.href && (event.target.href.includes('icon-') || event.target.href.includes('manifest.json')))
      )) {
        event.preventDefault();
        return false;
      }
      // Silenciar erros CORS do manifest.json quando aberto via file://
      if (event.message && event.message.includes('manifest.json') && event.message.includes('CORS')) {
        event.preventDefault();
        return false;
      }
      // Silenciar erros 404 do manifest.json e sw.js
      if (event.target && (
        (event.target.href && event.target.href.includes('manifest.json')) ||
        (event.target.src && event.target.src.includes('sw.js'))
      )) {
        event.preventDefault();
        return false;
      }
      // Silenciar erros de Content Security Policy do Google Translate
      if (event.message && event.message.includes('Content Security Policy') && event.message.includes('translate_http')) {
        event.preventDefault();
        return false;
      }
    }, true);
    
    // Tratamento específico para imagens que falham ao carregar
    document.addEventListener('error', (event) => {
      if (event.target && event.target.tagName === 'IMG' && 
          (event.target.src && event.target.src.includes('icon-'))) {
        event.target.style.display = 'none';
        event.preventDefault();
      }
    }, true);

    function onAppReady(callback) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
      } else {
        callback();
      }
    }

    onAppReady(async () => {
      // Initialize theme
      initTheme();
      
      // CARREGAR DADOS DO LOCALSTORAGE IMEDIATAMENTE (sem esperar Firebase)
      try {
        const localCourses = JSON.parse(localStorage.getItem(STORAGE_KEY_COURSES)) || [];
        const localResponsibles = JSON.parse(localStorage.getItem(STORAGE_KEY_RESPONSIBLES)) || {};
        courseChecklists = JSON.parse(localStorage.getItem(STORAGE_KEY_CHECKLISTS)) || {};
        courses = normalizeAllCourses(localCourses);
        lotResponsibles = localResponsibles && typeof localResponsibles === 'object' ? localResponsibles : {};
        filteredCourses = [...courses];
        
        // Renderizar imediatamente com dados do localStorage
        updateFilters();
        renderAll();
        
        // Esconder tela de carregamento IMEDIATAMENTE
        const initialLoading = document.getElementById('initial-loading');
        if (initialLoading) {
          initialLoading.style.opacity = '0';
          initialLoading.style.transition = 'opacity 0.2s ease-out';
          setTimeout(() => {
            initialLoading.classList.add('hidden');
          }, 200);
        }
        
        // Show app
        document.getElementById('app').classList.remove('hidden');
        updateUIForLoginStatus();
        switchTab('cronograma');
      } catch (error) {
        console.error('Erro ao carregar do localStorage:', error);
        const initialLoading = document.getElementById('initial-loading');
        if (initialLoading) initialLoading.classList.add('hidden');
        const appEl = document.getElementById('app');
        if (appEl) appEl.classList.remove('hidden');
        showToast('Erro ao carregar dados. Tente recarregar a página.', 'error');
      }
      
      // AGORA sincronizar com Firebase em background (não bloqueia a UI)
      setTimeout(async () => {
        // Wait for Firebase to be ready (com timeout curto)
        await new Promise((resolve) => {
          if (window.firebaseAuth && window.firebaseModules) {
            resolve();
          } else {
            window.addEventListener('firebase-ready', resolve, { once: true });
            // Timeout reduzido para 2 segundos
            setTimeout(resolve, 2000);
          }
        });
        
        // Check Firebase auth status and set up listener
        if (window.firebaseAuth && window.firebaseModules) {
          // Set up auth state listener
          window.firebaseModules.onAuthStateChanged(window.firebaseAuth, (user) => {
            isLoggedIn = !!user;
            updateUIForLoginStatus();
            renderAll();
          });
          
          // Check initial auth state (não bloqueia)
          checkFirebaseAuth().catch(err => console.warn('Erro ao verificar auth:', err));
        }
        
        // Sincronizar com Firebase em background (não bloqueia)
        loadFromRealtimeDatabase().catch(err => {
          console.warn('Erro ao sincronizar com Firebase:', err);
        });
        loadCalendarFromFirebase().catch(err => {
          console.warn('Erro ao sincronizar calendário com Firebase:', err);
        });
        
        // Set up real-time listeners for synchronization (non-blocking)
        setTimeout(() => {
          setupRealtimeListeners();
        }, 500);
        
        // Verify Realtime Database connection in background (non-blocking, for logging only)
        if (window.database && window.firebaseModules) {
          setTimeout(async () => {
            try {
              const { ref, get } = window.firebaseModules;
              const db = window.database;
              const testSnapshot = await get(ref(db, 'courses'));
              console.log('✅ Realtime Database funcionando corretamente', { exists: testSnapshot.exists() });
            } catch (error) {
              console.warn('⚠️ Realtime Database não acessível:', error.code || error.message);
              if (error.code === 'PERMISSION_DENIED') {
                console.warn('💡 Configure as regras do Realtime Database no Firebase Console.');
              }
            }
          }, 2000);
        }
        
        // Verificar e atualizar status automaticamente na inicialização
        checkAndUpdateAllCourseStatuses();
        
        // Verificar status automaticamente a cada hora
        setInterval(() => {
          checkAndUpdateAllCourseStatuses();
          checkNotifications();
        }, 3600000); // 1 hora
        
        // Registrar service worker para PWA (apenas em protocolos suportados)
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
          // Tentar registrar com caminho relativo primeiro
          navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('Service Worker registrado:', registration);
          }).catch(error => {
            // Tentar caminho alternativo
            navigator.serviceWorker.register('sw.js').catch(err => {
              // Silenciar erro se não encontrar (normal em desenvolvimento ou GitHub Pages)
              if (location.protocol === 'file:' || location.hostname.includes('github.io') || err.message.includes('404')) {
                console.debug('Service Worker não encontrado (normal em desenvolvimento ou GitHub Pages sem arquivo)');
              } else {
                console.warn('Erro ao registrar Service Worker:', err);
              }
            });
          });
        } else if (location.protocol === 'file:') {
          console.debug('Service Worker não suportado em file:// (use um servidor local)');
          if (!document.getElementById('file-protocol-banner')) {
            const banner = document.createElement('div');
            banner.id = 'file-protocol-banner';
            banner.className = 'fixed bottom-4 left-4 right-4 z-[1200] bg-[#FF9500] text-white text-center py-2 px-4 text-sm rounded-xl shadow-lg';
            banner.textContent = 'Abra via servidor local (http://localhost) para sincronização Firebase e PWA funcionarem corretamente.';
            document.body.appendChild(banner);
          }
        }
        
        // Solicitar permissão de notificações
        requestNotificationPermission();
        
        // Configurar prompt de instalação PWA
        setupInstallPrompt();
      }, 800); // Simulate loading time
    });
    
    let deferredPrompt;
    
    function setupInstallPrompt() {
      // Detectar evento de instalação PWA
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
      });
      
      // Detectar se já está instalado
      if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('Aplicativo já instalado');
        hideInstallButton();
      }
    }
    
    function showInstallButton() {
      // Mostrar botão de instalação no header (desktop)
      const installBtn = document.getElementById('install-pwa-btn-header');
      if (installBtn) {
        installBtn.classList.remove('hidden');
      }
    }
    
    function hideInstallButton() {
      // Esconder botão de instalação no header
      const installBtn = document.getElementById('install-pwa-btn-header');
      if (installBtn) {
        installBtn.classList.add('hidden');
      }
    }
    
    async function installPWA() {
      if (!deferredPrompt) {
        // Se não houver prompt, mostrar instruções
        showInstallInstructions();
        return;
      }
      
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('Usuário aceitou a instalação');
        hideInstallButton();
      } else {
        console.log('Usuário rejeitou a instalação');
      }
      
      deferredPrompt = null;
    }
    
    function showInstallInstructions() {
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      const isEdge = /Edg/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      
      let instructions = '';
      
      if (isChrome || isEdge) {
        instructions = `
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-foreground mb-2">Como instalar no Chrome/Edge:</h3>
            <ol class="list-decimal list-inside space-y-2 text-sm text-foreground">
              <li>Clique no ícone de <strong>menu</strong> (três pontos) no canto superior direito</li>
              <li>Procure por <strong>"Instalar IAC"</strong> ou <strong>"Instalar aplicativo"</strong></li>
              <li>Clique em <strong>"Instalar"</strong></li>
              <li>O aplicativo será instalado e aparecerá na sua área de trabalho</li>
            </ol>
            <p class="text-xs text-muted-foreground mt-4">💡 Dica: Você também pode clicar no ícone de instalação na barra de endereços (ao lado da URL)</p>
          </div>
        `;
      } else if (isSafari) {
        instructions = `
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-foreground mb-2">Como instalar no Safari (macOS):</h3>
            <ol class="list-decimal list-inside space-y-2 text-sm text-foreground">
              <li>Clique em <strong>"Compartilhar"</strong> na barra de ferramentas</li>
              <li>Selecione <strong>"Adicionar à Tela de Início"</strong></li>
              <li>Confirme a instalação</li>
            </ol>
          </div>
        `;
      } else {
        instructions = `
          <div class="space-y-4">
            <h3 class="text-lg font-semibold text-foreground mb-2">Como instalar o aplicativo:</h3>
            <div class="text-sm text-foreground space-y-2">
              <p><strong>Chrome/Edge:</strong> Menu (⋮) → "Instalar IAC" ou ícone de instalação na barra de endereços</p>
              <p><strong>Firefox:</strong> Menu (☰) → "Instalar" (se disponível)</p>
              <p><strong>Safari (macOS):</strong> Compartilhar → "Adicionar à Tela de Início"</p>
            </div>
          </div>
        `;
      }
      
      const modalHTML = `
        <div class="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div class="modal-overlay absolute inset-0 bg-black/50" onclick="closeInstallInstructions()"></div>
          <div class="modal-content w-full max-w-md card-elegant md:rounded-2xl shadow-2xl relative z-10">
            <div class="flex items-center justify-between p-6 border-b border-border/30">
              <h2 class="text-xl font-semibold text-foreground">Instalar Aplicativo Desktop</h2>
              <button onclick="closeInstallInstructions()" class="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="p-6">
              ${instructions}
            </div>
            <div class="flex justify-end gap-3 p-6 border-t border-border/30">
              <button onclick="closeInstallInstructions()" class="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-secondary/50 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      `;
      
      const existingModal = document.getElementById('install-instructions-modal');
      if (existingModal) existingModal.remove();
      
      const modalDiv = document.createElement('div');
      modalDiv.id = 'install-instructions-modal';
      modalDiv.innerHTML = modalHTML;
      document.body.appendChild(modalDiv);
      document.body.classList.add('modal-open');
    }
    
    function closeInstallInstructions() {
      const modal = document.getElementById('install-instructions-modal');
      if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
      }
    }

    function getCourseChecklistState(courseId) {
      if (!courseChecklists[courseId]) {
        courseChecklists[courseId] = initChecklistFromTemplate();
      } else {
        migrateChecklistIfNeeded(courseId);
      }
      return courseChecklists[courseId];
    }

    function getChecklistItems(courseId, phase) {
      const state = getCourseChecklistState(courseId);
      return Array.isArray(state[phase]) ? state[phase] : [];
    }

    function getChecklistProgress(phase, checklistState) {
      const items = Array.isArray(checklistState[phase]) ? checklistState[phase] : [];
      const checked = items.filter(item => item.checked).length;
      return { checked, total: items.length, percent: items.length ? Math.round((checked / items.length) * 100) : 0 };
    }

    function isEmAndamentoPhaseUnlocked(course, checklistState) {
      const status = normalizeStatus(course.status);
      if (status === 'em andamento' || status === 'em andamento.') return true;
      const initProgress = getChecklistProgress('inicializacao', checklistState);
      return initProgress.total > 0 && initProgress.checked === initProgress.total;
    }

    function getCoursesEmBreve() {
      return sortTarefasCourses(courses.filter(c => isCourseEmBreve(c) && !isCourseEmAndamento(c)));
    }

    function getCoursesEmAndamentoForTarefas() {
      return sortTarefasCourses(courses.filter(c => isCourseEmAndamento(c)));
    }

    function canEditChecklist() {
      return isLoggedIn && userRole === 'admin';
    }

    function openTarefasChecklistModal(courseId) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      currentTarefasModalCourseId = courseId;
      editingChecklistItem = null;
      document.getElementById('tarefas-checklist-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      renderTarefasChecklistModalContent(courseId);
    }

    function closeTarefasChecklistModal(event) {
      if (event && event.target !== event.currentTarget && !event.target.classList.contains('modal-overlay')) return;
      document.getElementById('tarefas-checklist-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      currentTarefasModalCourseId = null;
      editingChecklistItem = null;
    }

    function refreshTarefasChecklistModal() {
      if (currentTarefasModalCourseId) {
        renderTarefasChecklistModalContent(currentTarefasModalCourseId);
      }
      renderTarefas();
    }

    function toggleCourseChecklistItem(courseId, phase, itemKey) {
      if (!canEditChecklist()) {
        showToast('Apenas administradores podem marcar tarefas.', 'error');
        return;
      }

      const course = courses.find(c => c.id === courseId);
      const state = getCourseChecklistState(courseId);

      if (phase === 'emAndamento' && course && !isEmAndamentoPhaseUnlocked(course, state)) {
        showToast('Conclua todas as tarefas de Inicialização primeiro.', 'error');
        return;
      }

      const item = state[phase].find(i => i.key === itemKey);
      if (item) {
        item.checked = !item.checked;
        saveCourseChecklists();
        refreshTarefasChecklistModal();
      }
    }

    function addChecklistItem(courseId, phase) {
      if (!canEditChecklist()) return;

      const course = courses.find(c => c.id === courseId);
      const state = getCourseChecklistState(courseId);

      if (phase === 'emAndamento' && course && !isEmAndamentoPhaseUnlocked(course, state)) {
        showToast('Conclua todas as tarefas de Inicialização primeiro.', 'error');
        return;
      }

      const label = prompt('Nome da nova tarefa:');
      if (!label || !label.trim()) return;

      const key = `custom_${Date.now()}`;
      state[phase].push({ key, label: label.trim(), checked: false });
      saveCourseChecklists();
      editingChecklistItem = { courseId, phase, itemKey: key };
      refreshTarefasChecklistModal();
    }

    function startEditChecklistItem(courseId, phase, itemKey) {
      if (!canEditChecklist()) return;
      editingChecklistItem = { courseId, phase, itemKey };
      refreshTarefasChecklistModal();
      setTimeout(() => {
        const input = document.getElementById(`edit-checklist-input-${itemKey}`);
        if (input) { input.focus(); input.select(); }
      }, 50);
    }

    function saveEditChecklistItem(courseId, phase, itemKey) {
      if (!canEditChecklist()) return;

      const input = document.getElementById(`edit-checklist-input-${itemKey}`);
      const newLabel = input?.value.trim();
      if (!newLabel) {
        showToast('O nome da tarefa não pode ser vazio.', 'error');
        return;
      }

      const state = getCourseChecklistState(courseId);
      const item = state[phase].find(i => i.key === itemKey);
      if (item) {
        item.label = newLabel;
        saveCourseChecklists();
      }
      editingChecklistItem = null;
      refreshTarefasChecklistModal();
    }

    function cancelEditChecklistItem() {
      editingChecklistItem = null;
      refreshTarefasChecklistModal();
    }

    function deleteChecklistItem(courseId, phase, itemKey) {
      if (!canEditChecklist()) return;
      if (!confirm('Excluir esta tarefa do checklist?')) return;

      const state = getCourseChecklistState(courseId);
      state[phase] = state[phase].filter(i => i.key !== itemKey);
      saveCourseChecklists();
      editingChecklistItem = null;
      refreshTarefasChecklistModal();
    }

    function renderChecklistPhaseInModal(course, phase, phaseLabel, phaseColor) {
      const checklistState = getCourseChecklistState(course.id);
      const items = getChecklistItems(course.id, phase);
      const progress = getChecklistProgress(phase, checklistState);
      const unlocked = phase === 'inicializacao' || isEmAndamentoPhaseUnlocked(course, checklistState);
      const canEdit = canEditChecklist() && unlocked;
      const lockedClass = unlocked ? '' : 'checklist-phase-locked';

      return `
        <div class="mb-6 ${lockedClass}">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-base font-semibold text-foreground flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" style="background: ${phaseColor}"></span>
              ${phaseLabel}
              ${!unlocked ? '<span class="text-xs font-normal text-muted-foreground">(conclua a Inicialização)</span>' : ''}
            </h4>
            <span class="text-xs font-medium px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground">${progress.checked}/${progress.total}</span>
          </div>
          <div class="w-full h-2 bg-secondary/50 rounded-full mb-4 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300" style="width: ${progress.percent}%; background: ${phaseColor}"></div>
          </div>
          <div class="space-y-1">
            ${items.length === 0 ? '<p class="text-sm text-muted-foreground py-2">Nenhuma tarefa nesta etapa.</p>' : items.map(item => {
              const isEditing = editingChecklistItem?.courseId === course.id && editingChecklistItem?.phase === phase && editingChecklistItem?.itemKey === item.key;
              const safeId = `chk-${course.id}-${phase}-${item.key}`.replace(/[^a-zA-Z0-9-_]/g, '_');
              return `
                <div class="checklist-item ${item.checked ? 'done' : ''}">
                  <input type="checkbox" id="${safeId}" ${item.checked ? 'checked' : ''} ${canEdit ? '' : 'disabled'}
                    onchange="toggleCourseChecklistItem('${course.id}', '${phase}', '${item.key}')">
                  ${isEditing ? `
                    <div class="flex-1 flex items-center gap-2">
                      <input type="text" id="edit-checklist-input-${item.key}" value="${escapeHtml(item.label)}"
                        class="flex-1 px-3 py-1.5 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        onkeydown="if(event.key==='Enter')saveEditChecklistItem('${course.id}','${phase}','${item.key}');if(event.key==='Escape')cancelEditChecklistItem()">
                      <button onclick="saveEditChecklistItem('${course.id}','${phase}','${item.key}')" class="p-1.5 text-[#34C759] hover:bg-[rgba(52,199,89,0.15)] rounded-lg" title="Salvar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </button>
                      <button onclick="cancelEditChecklistItem()" class="p-1.5 text-[#FF3B30] hover:bg-[rgba(255,59,48,0.15)] rounded-lg" title="Cancelar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ` : `
                    <label for="${safeId}" class="text-sm text-foreground cursor-pointer flex-1">${escapeHtml(item.label)}</label>
                    ${canEdit ? `
                      <div class="checklist-item-actions">
                        <button onclick="startEditChecklistItem('${course.id}','${phase}','${item.key}')" class="p-1.5 text-[#007AFF] hover:bg-[rgba(0,122,255,0.15)] rounded-lg" title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="deleteChecklistItem('${course.id}','${phase}','${item.key}')" class="p-1.5 text-[#FF3B30] hover:bg-[rgba(255,59,48,0.15)] rounded-lg" title="Excluir">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    ` : ''}
                  `}
                </div>
              `;
            }).join('')}
          </div>
          ${canEdit ? `
            <button onclick="addChecklistItem('${course.id}','${phase}')" class="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-[#007AFF]/40 text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] rounded-[12px] transition-colors text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              Adicionar tarefa
            </button>
          ` : ''}
        </div>
      `;
    }

    function renderTarefasChecklistModalContent(courseId) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      const checklistState = getCourseChecklistState(courseId);
      const initProgress = getChecklistProgress('inicializacao', checklistState);
      const andProgress = getChecklistProgress('emAndamento', checklistState);
      const totalItems = initProgress.total + andProgress.total;
      const totalChecked = initProgress.checked + andProgress.checked;
      const overallPercent = totalItems ? Math.round((totalChecked / totalItems) * 100) : 0;
      const statusClass = getStatusClass(course.status);

      document.getElementById('tarefas-checklist-modal-header').innerHTML = `
        <div class="flex-1 min-w-0 pr-4">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <h2 class="text-xl font-semibold text-foreground truncate">${escapeHtml(course.tipologia || 'Sem nome')}</h2>
            <span class="status-badge ${statusClass}">${escapeHtml(course.status || 'Pendente')}</span>
          </div>
          <div class="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>ID: ${escapeHtml(course.idCurso || '-')}</span>
            <span>Lote ${escapeHtml(String(course.lote || '-'))}</span>
            <span>${escapeHtml(course.municipio || '-')}</span>
            ${course.dataInicio ? `<span>Início: ${formatDate(course.dataInicio)}</span>` : ''}
          </div>
          <div class="mt-3 flex items-center gap-3">
            <div class="flex-1 h-2 bg-secondary/50 rounded-full overflow-hidden">
              <div class="h-full bg-[#007AFF] rounded-full transition-all" style="width: ${overallPercent}%"></div>
            </div>
            <span class="text-sm font-bold text-[#007AFF]">${overallPercent}%</span>
          </div>
        </div>
        <button onclick="closeTarefasChecklistModal()" class="p-2 hover:bg-secondary/50 rounded-lg transition-colors flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      `;

      document.getElementById('tarefas-checklist-modal-body').innerHTML = `
        ${renderChecklistPhaseInModal(course, 'inicializacao', 'Inicialização', '#FF9500')}
        ${renderChecklistPhaseInModal(course, 'emAndamento', 'Em andamento', '#007AFF')}
      `;
    }

    function renderTarefasShelfCard(course) {
      const checklistState = getCourseChecklistState(course.id);
      const initProgress = getChecklistProgress('inicializacao', checklistState);
      const andProgress = getChecklistProgress('emAndamento', checklistState);
      const totalItems = initProgress.total + andProgress.total;
      const totalChecked = initProgress.checked + andProgress.checked;
      const overallPercent = totalItems ? Math.round((totalChecked / totalItems) * 100) : 0;
      const statusClass = getStatusClass(course.status);

      return `
        <div class="tarefas-shelf-card card-elegant rounded-[20px] p-4 cursor-pointer hover:scale-[1.02] transition-all duration-200"
          onclick="openTarefasChecklistModal('${course.id}')">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h4 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm line-clamp-2 flex-1" style="letter-spacing: -0.01em;">${escapeHtml(course.tipologia || 'Sem nome')}</h4>
            <span class="status-badge ${statusClass} text-[10px] px-1.5 py-0.5">${escapeHtml(course.status || 'Pendente')}</span>
          </div>
          <p class="text-[10px] text-[#8e8e93] font-mono mb-3">ID: ${escapeHtml(course.idCurso || '-')}</p>
          <div class="space-y-1.5 text-xs text-[#8e8e93] flex-1">
            <div class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span>Lote ${escapeHtml(String(course.lote || '-'))}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span class="truncate">${escapeHtml(course.municipio || '-')}</span>
            </div>
            ${course.dataInicio ? `
              <div class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span>${formatDate(course.dataInicio)}</span>
              </div>
            ` : ''}
          </div>
          <div class="mt-3 pt-3 border-t border-border/30">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-[10px] text-[#8e8e93]">Progresso</span>
              <span class="text-xs font-bold text-[#007AFF]">${overallPercent}%</span>
            </div>
            <div class="w-full h-1.5 bg-secondary/50 rounded-full overflow-hidden">
              <div class="h-full bg-[#007AFF] rounded-full transition-all" style="width: ${overallPercent}%"></div>
            </div>
            <div class="flex justify-between mt-2 text-[10px] text-[#8e8e93]">
              <span>Init. ${initProgress.checked}/${initProgress.total}</span>
              <span>And. ${andProgress.checked}/${andProgress.total}</span>
            </div>
          </div>
        </div>
      `;
    }

    function filterTarefasBySearch(coursesList) {
      const searchTerm = document.getElementById('tarefas-search')?.value.toLowerCase().trim() || '';
      if (!searchTerm) return coursesList;

      return coursesList.filter(course => {
        const id = (course.idCurso || '').toLowerCase();
        const tipologia = (course.tipologia || '').toLowerCase();
        const municipio = (course.municipio || '').toLowerCase();
        return id.includes(searchTerm) || tipologia.includes(searchTerm) || municipio.includes(searchTerm);
      });
    }

    function renderTarefas() {
      const emBreveList = document.getElementById('tarefas-em-breve-list');
      const emAndamentoList = document.getElementById('tarefas-em-andamento-list');
      const emBreveSection = document.getElementById('tarefas-em-breve-section');
      const emAndamentoSection = document.getElementById('tarefas-em-andamento-section');
      const prioritySection = document.getElementById('tarefas-priority-section');
      const emptyEl = document.getElementById('tarefas-empty');
      const noResultsEl = document.getElementById('tarefas-no-results');
      const statsEl = document.getElementById('tarefas-stats');

      if (!emBreveList || !emAndamentoList) return;

      const emBreveAll = getCoursesEmBreve();
      const emAndamentoAll = getCoursesEmAndamentoForTarefas();
      const totalAll = emBreveAll.length + emAndamentoAll.length;

      const emAndamento = filterTarefasBySearch(emAndamentoAll);
      const emBreve = filterTarefasBySearch(emBreveAll);
      const totalFiltered = emBreve.length + emAndamento.length;
      const hasSearch = !!document.getElementById('tarefas-search')?.value.trim();

      let totalItems = 0;
      let totalChecked = 0;
      [...emBreveAll, ...emAndamentoAll].forEach(course => {
        const state = getCourseChecklistState(course.id);
        const init = getChecklistProgress('inicializacao', state);
        const and = getChecklistProgress('emAndamento', state);
        totalItems += init.total + and.total;
        totalChecked += init.checked + and.checked;
      });

      if (statsEl) {
        statsEl.innerHTML = `
          <div class="card-elegant rounded-[16px] p-4">
            <p class="text-xs text-muted-foreground mb-1">Turmas em breve</p>
            <p class="text-2xl font-bold text-[#FF9500]">${hasSearch ? emBreve.length : emBreveAll.length}</p>
          </div>
          <div class="card-elegant rounded-[16px] p-4">
            <p class="text-xs text-muted-foreground mb-1">Em andamento</p>
            <p class="text-2xl font-bold text-[#007AFF]">${hasSearch ? emAndamento.length : emAndamentoAll.length}</p>
          </div>
          <div class="card-elegant rounded-[16px] p-4">
            <p class="text-xs text-muted-foreground mb-1">Progresso geral</p>
            <p class="text-2xl font-bold text-[#34C759]">${totalItems ? Math.round((totalChecked / totalItems) * 100) : 0}%</p>
          </div>
        `;
      }

      if (totalAll === 0) {
        emptyEl?.classList.remove('hidden');
        noResultsEl?.classList.add('hidden');
        prioritySection?.classList.add('hidden');
        emBreveSection?.classList.add('hidden');
        emAndamentoSection?.classList.add('hidden');
        return;
      }

      emptyEl?.classList.add('hidden');
      prioritySection?.classList.remove('hidden');

      if (hasSearch && totalFiltered === 0) {
        noResultsEl?.classList.remove('hidden');
        prioritySection?.classList.add('hidden');
        emBreveSection?.classList.add('hidden');
        emAndamentoSection?.classList.add('hidden');
        return;
      }

      noResultsEl?.classList.add('hidden');

      if (emAndamento.length > 0) {
        emAndamentoSection?.classList.remove('hidden');
        emAndamentoList.innerHTML = emAndamento.map(renderTarefasShelfCard).join('');
      } else {
        emAndamentoSection?.classList.add('hidden');
        emAndamentoList.innerHTML = '';
      }

      if (emBreve.length > 0) {
        emBreveSection?.classList.remove('hidden');
        emBreveList.innerHTML = emBreve.map(renderTarefasShelfCard).join('');
      } else {
        emBreveSection?.classList.add('hidden');
        emBreveList.innerHTML = '';
      }
    }

    function switchTab(tab) {
      // Remove active de todas as tabs
      const tabs = ['dashboard', 'cronograma', 'calendar', 'tarefas', 'settings'];
      tabs.forEach(t => {
        const tabEl = document.getElementById(`tab-${t}`);
        const tabMobileEl = document.getElementById(`tab-${t}-mobile`);
        const contentEl = document.getElementById(`content-${t}`);
        
        if (tabEl) {
          tabEl.classList.remove('active');
          tabEl.classList.remove('text-[#1d1d1f]', 'dark:text-[#f5f5f7]');
          if (!tabEl.classList.contains('text-[#8e8e93]')) {
            tabEl.classList.add('text-[#8e8e93]');
          }
        }
        if (tabMobileEl) {
          tabMobileEl.classList.remove('active');
          tabMobileEl.classList.remove('border-[#007AFF]');
          tabMobileEl.classList.add('border-transparent');
        }
        if (contentEl) {
          contentEl.classList.add('hidden');
        }
      });

      // Ativa a tab selecionada
      const selectedTab = document.getElementById(`tab-${tab}`);
      const selectedTabMobile = document.getElementById(`tab-${tab}-mobile`);
      const selectedContent = document.getElementById(`content-${tab}`);
      
      if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.classList.remove('text-[#8e8e93]');
        selectedTab.classList.add('text-[#1d1d1f]', 'dark:text-[#f5f5f7]');
      }
      if (selectedTabMobile) {
        selectedTabMobile.classList.add('active');
        selectedTabMobile.classList.remove('border-transparent');
        selectedTabMobile.classList.add('border-[#007AFF]');
      }
      if (selectedContent) {
        selectedContent.classList.remove('hidden');
        // Renderiza conteúdo específico se necessário
        if (tab === 'cronograma') {
          renderCronograma();
        } else if (tab === 'calendar') {
          renderCalendar();
          renderTasksList();
        } else if (tab === 'tarefas') {
          renderTarefas();
        }
      }
    }

    function toggleMenuDrawer() {
      const drawer = document.getElementById('menu-drawer');
      const overlay = document.getElementById('menu-overlay');
      const isOpen = drawer.classList.contains('open');
      
      if (isOpen) {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
      } else {
        drawer.classList.add('open');
        overlay.classList.add('open');
      }
    }

    function toggleFABMenu() {
      const menu = document.getElementById('fab-menu');
      const icon = document.getElementById('fab-icon');
      const closeIcon = document.getElementById('fab-close-icon');
      const isOpen = menu.classList.contains('open');
      
      if (isOpen) {
        menu.classList.remove('open');
        icon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
      } else {
        menu.classList.add('open');
        icon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
      }
    }

    function renderAll() {
      renderActionCards();
      renderStats();
      renderLotSections();
      updateUIForLoginStatus(); // Ensure UI reflects login status after render
      // Sincronizar cronograma sempre (mesmos dados da dashboard)
      if (document.getElementById('cronograma-cards')) {
        renderCronograma();
      }
      // Sincronizar calendário se estiver na aba
      const calendarContent = document.getElementById('content-calendar');
      if (calendarContent && !calendarContent.classList.contains('hidden')) {
        renderCalendar();
        renderTasksList();
      }
      const tarefasContent = document.getElementById('content-tarefas');
      if (tarefasContent && !tarefasContent.classList.contains('hidden')) {
        renderTarefas();
      }
      checkNotifications();
    }

    function normalizeStatus(status) {
      if (!status) return '';
      return String(status).trim().toLowerCase();
    }
    
    // Busca Global
    function performGlobalSearch(query) {
      if (!query || query.length < 2) {
        hideGlobalSearchResults();
        return;
      }
      
      const searchTerm = query.toLowerCase();
      const results = {
        courses: [],
        events: [],
        materials: []
      };
      
      // Buscar cursos
      courses.forEach(course => {
        const matches = 
          (course.idCurso || '').toLowerCase().includes(searchTerm) ||
          (course.tipologia || '').toLowerCase().includes(searchTerm) ||
          (course.municipio || '').toLowerCase().includes(searchTerm) ||
          (course.status || '').toLowerCase().includes(searchTerm);
        
        if (matches) {
          results.courses.push(course);
        }
      });
      
      // Buscar por datas
      const dateMatches = courses.filter(course => {
        const inicio = course.dataInicio ? formatDate(course.dataInicio).toLowerCase() : '';
        const fim = course.dataFim ? formatDate(course.dataFim).toLowerCase() : '';
        return inicio.includes(searchTerm) || fim.includes(searchTerm);
      });
      results.courses = [...new Set([...results.courses, ...dateMatches])];
      
      displayGlobalSearchResults(results, query);
    }
    
    function displayGlobalSearchResults(results, query) {
      const container = document.getElementById('global-search-results');
      if (!container) return;
      
      const totalResults = results.courses.length;
      
      if (totalResults === 0) {
        container.innerHTML = `
          <div class="p-4 text-center text-[#8e8e93]">
            <p class="text-sm">Nenhum resultado encontrado para "${query}"</p>
          </div>
        `;
        container.classList.remove('hidden');
        return;
      }
      
      let html = '<div class="w-full">';
      
      // Cursos
      if (results.courses.length > 0) {
        html += `
          <div class="mb-3">
            <p class="text-xs font-semibold text-[#8e8e93] px-4 py-3 uppercase tracking-wider border-b border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)]">Cursos (${results.courses.length})</p>
            <div class="py-2">
              ${results.courses.slice(0, 8).map(course => `
                <button onclick="event.stopPropagation(); navigateToCourse('${course.id}')" class="w-full text-left px-4 py-3 hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] rounded-[10px] transition-colors mb-1 border-b border-[rgba(0,0,0,0.05)] dark:border-[rgba(255,255,255,0.05)] last:border-0">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5 line-clamp-2">${course.tipologia || 'Sem nome'}</p>
                      <div class="flex flex-wrap items-center gap-2 text-xs text-[#8e8e93]">
                        <span class="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          ID: ${course.idCurso || '-'}
                        </span>
                        <span>•</span>
                        <span class="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          ${course.municipio || '-'}
                        </span>
                        ${course.lote ? `<span>•</span><span>Lote ${course.lote}</span>` : ''}
                      </div>
                    </div>
                    <span class="status-badge ${getStatusClass(course.status)} flex-shrink-0 ml-2">${course.status || 'Pendente'}</span>
                  </div>
                </button>
              `).join('')}
              ${results.courses.length > 8 ? `<p class="text-xs text-[#8e8e93] px-4 py-3 text-center bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] rounded-b-[10px]">+${results.courses.length - 8} mais resultados</p>` : ''}
            </div>
          </div>
        `;
      }
      
      html += '</div>';
      container.innerHTML = html;
      container.classList.remove('hidden');
    }
    
    function getStatusClass(status) {
      const normalized = normalizeStatus(status);
      if (normalized.includes('concluído') || normalized.includes('concluido')) return 'completed';
      if (normalized.includes('breve')) return 'pending';
      if (normalized.includes('andamento')) return 'in-progress';
      if (normalized.includes('pendente')) return 'pending';
      if (normalized.includes('atrasado')) return 'delayed';
      return 'planned';
    }
    
    function showGlobalSearchResults() {
      const container = document.getElementById('global-search-results');
      const input = document.getElementById('global-search');
      if (container && input && input.value.length >= 2) {
        container.classList.remove('hidden');
      }
    }
    
    function hideGlobalSearchResults() {
      const container = document.getElementById('global-search-results');
      if (container) {
        container.classList.add('hidden');
      }
    }
    
    function navigateToCourse(courseId) {
      hideGlobalSearchResults();
      const searchInput = document.getElementById('global-search');
      if (searchInput) searchInput.value = '';
      
      // Abrir modal do curso
      const course = courses.find(c => c.id === courseId);
      if (course) {
        // Tentar abrir modal de edição (dashboard) ou modal do cronograma
        if (document.getElementById('edit-course-modal')) {
          openEditCourseModal(courseId);
        } else if (document.getElementById('cronograma-course-modal')) {
          openCronogramaCourseModal(courseId);
        }
      }
    }
    
    // Funções para abrir modais com cursos filtrados
    function filterByInProgress() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const inProgressCourses = courses.filter(c => {
        const normalized = normalizeStatus(c.status);
        return normalized.includes('andamento');
      });
      
      openCoursesModal('Cursos em Andamento', inProgressCourses, '#007AFF');
    }
    
    function filterByPending() {
      const pendingCourses = courses.filter(c => normalizeStatus(c.status) === 'pendente');
      openCoursesModal('Cursos Pendentes', pendingCourses, '#FF9500');
    }
    
    function filterByUpcoming() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingEvents = courses.filter(c => {
        if (!c.dataInicio) return false;
        const startDate = new Date(c.dataInicio);
        startDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7;
      });
      
      openCoursesModal('Próximos Eventos (7 dias)', upcomingEvents, '#FF9500');
    }
    
    function filterByDelayed() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const delayedCourses = courses.filter(c => {
        if (!c.dataFim) return false;
        const endDate = new Date(c.dataFim);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today && normalizeStatus(c.status) !== 'concluído';
      });
      
      openCoursesModal('Cursos Atrasados', delayedCourses, '#FF3B30');
    }

    function filterByStatus(status) {
      if (status === 'all') {
        document.getElementById('filter-status').value = '';
      } else {
        document.getElementById('filter-status').value = status;
      }
      applyFilters();
      // Scroll para os lotes
      document.getElementById('lot-sections').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function filterByEndingToday() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const endingToday = courses.filter(c => {
        if (!c.dataFim) return false;
        const endDate = new Date(c.dataFim);
        endDate.setHours(0, 0, 0, 0);
        return endDate.getTime() === today.getTime() && normalizeStatus(c.status) !== 'concluído';
      });
      
      openCoursesModal('Cursos que Vencem Hoje', endingToday, '#FF3B30');
    }

    function filterByNoResponsible() {
      const lotResponsibles = window.lotResponsibles || {};
      const coursesWithoutResponsible = courses.filter(c => {
        return !lotResponsibles[c.lote] || lotResponsibles[c.lote].length === 0;
      });
      
      openCoursesModal('Cursos sem Responsável', coursesWithoutResponsible, '#FF9500');
    }
    
    // Modal genérico para exibir cursos
    function openCoursesModal(title, coursesList, color = '#007AFF') {
      const modal = document.createElement('div');
      modal.id = 'courses-list-modal';
      modal.className = 'fixed inset-0 z-[1200]';
      modal.innerHTML = `
        <div class="modal-overlay absolute inset-0" onclick="closeCoursesModal()"></div>
        <div class="modal-content w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <div class="p-6 border-b border-border/30 flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-semibold text-foreground">${title}</h2>
              <p class="text-sm text-muted-foreground mt-1">${coursesList.length} curso(s) encontrado(s)</p>
            </div>
            <button onclick="closeCoursesModal()" class="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            ${coursesList.length === 0 ? `
              <div class="text-center py-16">
                <p class="text-muted-foreground">Nenhum curso encontrado</p>
              </div>
            ` : `
              <div class="space-y-3">
                ${coursesList.map(course => `
                  <div class="card-secondary rounded-[16px] p-4 cursor-pointer hover:scale-[1.01] transition-all" onclick="navigateToCourse('${course.id}'); closeCoursesModal();">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1">
                        <h3 class="font-semibold text-foreground mb-2">${course.tipologia || 'Sem nome'}</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                          <div>
                            <span class="font-medium">ID:</span> ${course.idCurso || '-'}
                          </div>
                          <div>
                            <span class="font-medium">Lote:</span> ${course.lote || '-'}
                          </div>
                          <div>
                            <span class="font-medium">Município:</span> ${course.municipio || '-'}
                          </div>
                          <div>
                            <span class="font-medium">C.H.:</span> ${course.cargaHoraria || '-'}h
                          </div>
                          ${course.dataInicio ? `
                          <div>
                            <span class="font-medium">Início:</span> ${formatDate(course.dataInicio)}
                          </div>
                          ` : ''}
                          ${course.dataFim ? `
                          <div>
                            <span class="font-medium">Fim:</span> ${formatDate(course.dataFim)}
                          </div>
                          ` : ''}
                          ${course.concludentes !== null ? `
                          <div>
                            <span class="font-medium">Concludentes:</span> ${course.concludentes}
                          </div>
                          ` : ''}
                        </div>
                      </div>
                      <span class="status-badge ${getStatusClass(course.status)}">${course.status || 'Pendente'}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      document.body.classList.add('modal-open');
    }
    
    function closeCoursesModal() {
      const modal = document.getElementById('courses-list-modal');
      if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
      }
    }
    
    // Cards de Ação Prioritária
    function renderActionCards() {
      const container = document.getElementById('action-cards');
      if (!container) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Cursos em andamento
      const inProgressCourses = courses.filter(c => {
        const normalized = normalizeStatus(c.status);
        return normalized.includes('andamento');
      });
      
      // Próximos eventos (cursos que começam nos próximos 7 dias)
      const upcomingEvents = courses.filter(c => {
        if (!c.dataInicio) return false;
        const startDate = new Date(c.dataInicio);
        startDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7;
      });
      
      // Pendências
      const pendingCourses = courses.filter(c => normalizeStatus(c.status) === 'pendente');
      
      // Cursos atrasados
      const delayedCourses = courses.filter(c => {
        if (!c.dataFim) return false;
        const endDate = new Date(c.dataFim);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today && normalizeStatus(c.status) !== 'concluído';
      });
      
      container.innerHTML = `
        ${inProgressCourses.length > 0 ? `
          <div class="card-elegant rounded-[20px] p-5 cursor-pointer hover:scale-[1.02] transition-all border-l-4 border-[#007AFF]" onclick="filterByInProgress()">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Cursos em Andamento</h3>
                </div>
                <p class="text-sm text-[#8e8e93]">O que está acontecendo agora?</p>
              </div>
              <div class="w-12 h-12 bg-[rgba(0,122,255,0.15)] rounded-[14px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div class="data-highlight text-[#007AFF] mb-2 text-3xl font-bold">${inProgressCourses.length}</div>
            <p class="text-xs text-[#8e8e93] mb-3">${inProgressCourses.length === 1 ? 'curso ativo' : 'cursos ativos'}</p>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-sm text-[#007AFF] font-medium">Ver detalhes →</span>
              <span class="text-xs text-[#8e8e93]">Clique para filtrar</span>
            </div>
          </div>
        ` : ''}
        
        ${upcomingEvents.length > 0 ? `
          <div class="card-elegant rounded-[20px] p-5 cursor-pointer hover:scale-[1.02] transition-all" onclick="filterByUpcoming()">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#FF9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Próximos Eventos</h3>
                </div>
                <p class="text-sm text-[#8e8e93]">O que vem por aí? (7 dias)</p>
              </div>
              <div class="w-12 h-12 bg-[rgba(255,149,0,0.15)] rounded-[14px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#FF9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div class="data-highlight text-[#FF9500] mb-2">${upcomingEvents.length}</div>
            <p class="text-xs text-[#8e8e93] mb-3">${upcomingEvents.length === 1 ? 'evento próximo' : 'eventos próximos'}</p>
            <div class="mt-3 text-sm text-[#FF9500] font-medium">Ver calendário →</div>
          </div>
        ` : ''}
        
        ${delayedCourses.length > 0 ? `
          <div class="card-elegant rounded-[20px] p-5 cursor-pointer hover:scale-[1.02] transition-all border-l-4 border-[#FF3B30] bg-[rgba(255,59,48,0.05)]" onclick="filterByDelayed()">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Cursos Atrasados</h3>
                </div>
                <p class="text-sm text-[#FF3B30] font-medium">⚠️ Requer atenção urgente</p>
              </div>
              <div class="w-12 h-12 bg-[rgba(255,59,48,0.15)] rounded-[14px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="data-highlight text-[#FF3B30] mb-2 text-3xl font-bold">${delayedCourses.length}</div>
            <p class="text-xs text-[#8e8e93] mb-3">${delayedCourses.length === 1 ? 'curso fora do prazo' : 'cursos fora do prazo'}</p>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-sm text-[#FF3B30] font-medium">Ver detalhes →</span>
              <span class="text-xs text-[#FF3B30] font-medium">⚠️ Urgente</span>
            </div>
          </div>
        ` : ''}
        
        ${pendingCourses.length > 0 ? `
          <div class="card-elegant rounded-[20px] p-5 cursor-pointer hover:scale-[1.02] transition-all" onclick="filterByPending()">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#FF9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">Pendências</h3>
                </div>
                <p class="text-sm text-[#8e8e93]">O que precisa ser feito?</p>
              </div>
              <div class="w-12 h-12 bg-[rgba(255,149,0,0.15)] rounded-[14px] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-[#FF9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="data-highlight text-[#FF9500] mb-2">${pendingCourses.length}</div>
            <p class="text-xs text-[#8e8e93] mb-3">${pendingCourses.length === 1 ? 'curso pendente' : 'cursos pendentes'}</p>
            <div class="mt-3 text-sm text-[#FF9500] font-medium">Ver detalhes →</div>
          </div>
        ` : ''}
      `;
      
      // Se não houver cards, não mostrar o container
      if (inProgressCourses.length === 0 && upcomingEvents.length === 0 && pendingCourses.length === 0 && delayedCourses.length === 0) {
        container.innerHTML = '';
      }
    }

    function renderStats() {
      // Usar courses (todos) ao invés de filteredCourses para mostrar sempre os totais
      const total = courses.length;
      const completed = courses.filter(c => normalizeStatus(c.status) === 'concluído').length;
      const pending = courses.filter(c => normalizeStatus(c.status) === 'pendente').length;
      const inProgress = courses.filter(c => {
        const normalized = normalizeStatus(c.status);
        return normalized === 'em andamento' || normalized === 'em andamento.';
      }).length;
      
      // Debug: Log status variations found
      if (inProgress === 0 && total > 0) {
        const statusVariations = [...new Set(courses.map(c => c.status).filter(s => s))];
        const statusVariationsNormalized = [...new Set(courses.map(c => normalizeStatus(c.status)).filter(s => s))];
        // Only log if there are status values but no matches for "em andamento"
        if (statusVariationsNormalized.some(s => s.includes('andamento'))) {
          console.log('Status variations found:', statusVariations);
          console.log('Normalized status variations:', statusVariationsNormalized);
        }
      }

      // Calcular cursos que vencem hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const coursesEndingToday = courses.filter(c => {
        if (!c.dataFim) return false;
        const endDate = new Date(c.dataFim);
        endDate.setHours(0, 0, 0, 0);
        return endDate.getTime() === today.getTime() && normalizeStatus(c.status) !== 'concluído';
      }).length;

      document.getElementById('stats-cards').innerHTML = `
        <div class="card-elegant rounded-[20px] p-6 cursor-pointer hover:scale-[1.02] transition-all" onclick="filterByStatus('all')">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-[#8e8e93] mb-1 font-medium">Total de Cursos</p>
              <p class="text-3xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]" style="letter-spacing: -0.03em;">${total}</p>
            </div>
            <div class="w-14 h-14 bg-[rgba(0,122,255,0.1)] rounded-[16px] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-[#8e8e93] mt-2">Clique para ver todos</p>
        </div>
        <div class="card-elegant rounded-[20px] p-6 cursor-pointer hover:scale-[1.02] transition-all" onclick="filterByStatus('Concluído')">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-[#8e8e93] mb-1 font-medium">Concluídos</p>
              <p class="text-3xl font-semibold text-[#34C759]" style="letter-spacing: -0.03em;">${completed}</p>
            </div>
            <div class="w-14 h-14 bg-[rgba(52,199,89,0.1)] rounded-[16px] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-[#8e8e93] mt-2">Clique para ver concluídos</p>
        </div>
        <div class="card-elegant rounded-[20px] p-6 cursor-pointer hover:scale-[1.02] transition-all" onclick="filterByStatus('Pendente')">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-[#8e8e93] mb-1 font-medium">Pendentes</p>
              <p class="text-3xl font-semibold text-[#FF9500]" style="letter-spacing: -0.03em;">${pending}</p>
            </div>
            <div class="w-14 h-14 bg-[rgba(255,149,0,0.1)] rounded-[16px] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#FF9500]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-[#8e8e93] mt-2">Clique para ver pendentes</p>
        </div>
        <div class="card-elegant rounded-[20px] p-6 cursor-pointer hover:scale-[1.02] transition-all" onclick="filterByStatus('Em andamento')">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-[#8e8e93] mb-1 font-medium">Em Andamento</p>
              <p class="text-3xl font-semibold text-[#007AFF]" style="letter-spacing: -0.03em;">${inProgress}</p>
            </div>
            <div class="w-14 h-14 bg-[rgba(0,122,255,0.1)] rounded-[16px] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#007AFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-[#8e8e93] mt-2">Clique para ver em andamento</p>
        </div>
        ${coursesEndingToday > 0 ? `
        <div class="card-elegant rounded-[20px] p-6 cursor-pointer hover:scale-[1.02] transition-all border-2 border-[#FF3B30]/30 bg-[#FF3B30]/5" onclick="filterByEndingToday()">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-[#FF3B30] mb-1 font-medium">Vencem Hoje</p>
              <p class="text-3xl font-semibold text-[#FF3B30]" style="letter-spacing: -0.03em;">${coursesEndingToday}</p>
            </div>
            <div class="w-14 h-14 bg-[rgba(255,59,48,0.15)] rounded-[16px] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 text-[#FF3B30]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-[#FF3B30] mt-2 font-medium">⚠️ Requer atenção</p>
        </div>
        ` : ''}
      `;
    }

    function renderLotSections() {
      const lots = [...new Set(filteredCourses.map(c => c.lote))].sort((a, b) => a - b);
      
      if (lots.length === 0) {
        document.getElementById('lot-sections').innerHTML = `
          <div class="text-center py-16">
            <div class="w-20 h-20 bg-[rgba(142,142,147,0.1)] rounded-[20px] flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-[#8e8e93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            </div>
            <p class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2" style="letter-spacing: -0.02em;">Nenhum curso cadastrado</p>
            <p class="text-sm text-[#8e8e93]">Importe uma planilha ou adicione cursos manualmente</p>
          </div>
        `;
        return;
      }

      document.getElementById('lot-sections').innerHTML = lots.map(lot => {
        const lotCourses = filteredCourses.filter(c => c.lote === lot);
        const responsibles = lotResponsibles[lot] || [];
        const pendingCount = lotCourses.filter(c => normalizeStatus(c.status) === 'pendente').length;
        
        return `
          <div class="card-elegant rounded-[20px] overflow-hidden relative mb-6">
            <div class="p-6">
              <!-- Header do Card: Título, Responsáveis e Ações -->
              <div class="flex items-start justify-between gap-4 mb-5">
                <div class="flex-1 min-w-0">
                  <!-- Primeira Linha: Lote e Responsáveis -->
                  <div class="flex items-center gap-4 flex-wrap mb-3">
                    <div class="w-14 h-14 bg-[rgba(0,122,255,0.15)] rounded-[16px] flex items-center justify-center flex-shrink-0 border border-[rgba(0,122,255,0.2)]">
                      <span class="text-[#007AFF] font-semibold text-lg" style="letter-spacing: -0.02em;">${lot}</span>
                  </div>
                    <h2 class="text-xl font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]" style="letter-spacing: -0.02em;">Lote ${lot}</h2>
              ${responsibles.length > 0 ? `
                      <div class="flex items-center gap-3 flex-wrap">
                  ${responsibles.map(r => `
                          <div class="flex items-center gap-2">
                            <div class="w-10 h-10 bg-[rgba(0,122,255,0.15)] rounded-full flex items-center justify-center flex-shrink-0 border border-[rgba(0,122,255,0.2)]">
                        <span class="text-[#007AFF] text-sm font-semibold">${r.name.charAt(0)}</span>
                      </div>
                            <div class="flex flex-col">
                              <div class="flex items-center gap-2">
                                <p class="text-base font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">${r.name}</p>
                      <a href="https://wa.me/${r.phone.replace(/\D/g, '')}" target="_blank" 
                                  class="admin-only w-8 h-8 bg-[rgba(52,199,89,0.15)] hover:bg-[rgba(52,199,89,0.25)] text-[#34C759] rounded-[10px] flex items-center justify-center transition-all flex-shrink-0" title="Contatar via WhatsApp">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                              </div>
                              <p class="text-xs text-[#8e8e93]">${r.cargo}</p>
                            </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
                  
                  <!-- Segunda Linha: Quantidade de Cursos e Alertas -->
                  <div class="flex items-center gap-4 flex-wrap">
                    <p class="text-sm text-[#8e8e93]">${lotCourses.length} curso(s)</p>
                    ${pendingCount > 0 ? `
                      <div class="alert-pending" title="${pendingCount} curso(s) pendente(s)">
                        <span>Cursos Pendentes</span>
                        <span class="pending-count">${pendingCount}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
                
                <!-- Botões de Ação Minimalistas -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button onclick="downloadLotPDF(${lot})" class="admin-only w-10 h-10 flex items-center justify-center bg-[rgba(255,59,48,0.15)] hover:bg-[rgba(255,59,48,0.25)] text-[#FF3B30] rounded-[12px] transition-all duration-200" title="Baixar PDF do Lote">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  ${isLoggedIn ? `
                  <button onclick="openResponsiblesModal(${lot})" class="w-10 h-10 flex items-center justify-center border border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)] hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#007AFF] rounded-[12px] transition-all duration-200 relative" title="Gerenciar Responsáveis">
                    ${responsibles.length > 0 ? `<span class="absolute -top-1 -right-1 w-5 h-5 bg-[#007AFF] text-white text-xs rounded-full flex items-center justify-center font-semibold">${responsibles.length}</span>` : ''}
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </button>
                  ` : ''}
                </div>
              </div>
            </div>
            
            <div class="border-t border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)]"></div>
            
            <!-- Desktop Table -->
            <div class="hidden md:block overflow-x-auto p-4">
              <table class="w-full text-sm">
                <thead>
                  <tr>
                    <!-- Added ID column to table header -->
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">ID</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Tipologia</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Carga Horária</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Início</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Fim</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Município</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Cozinha</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Concludentes</th>
                    ${isLoggedIn ? '<th class="px-4 py-3 text-left text-xs font-semibold text-[#8e8e93] uppercase tracking-wider">Ações</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${lotCourses.map(course => `
                    <tr class="hover:bg-[rgba(0,0,0,0.02)] transition-colors cursor-pointer border-b border-[rgba(0,0,0,0.05)]" onclick="openEditCourseModal('${course.id}')">
                      <!-- Added ID column to table row -->
                      <td class="px-4 py-4 text-[#8e8e93] font-mono text-xs">${course.idCurso || '-'}</td>
                      <td class="px-4 py-4 text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.tipologia}</td>
                      <td class="px-4 py-4 text-[#8e8e93]">${course.cargaHoraria}h</td>
                      <td class="px-4 py-4 text-[#8e8e93]">${course.dataInicio ? formatDate(course.dataInicio) : '-'}</td>
                      <td class="px-4 py-4 text-[#8e8e93]">${course.dataFim ? formatDate(course.dataFim) : '-'}</td>
                      <td class="px-4 py-4 text-[#8e8e93]">${course.municipio}</td>
                      <td class="px-4 py-4 text-[#8e8e93]">${course.cozinha || '-'}</td>
                      <td class="px-4 py-4">${getStatusBadge(course.status)}</td>
                      <td class="px-4 py-4 text-[#8e8e93]">${course.concludentes !== null ? course.concludentes : '-'}</td>
                      ${isLoggedIn ? `
                      <td class="px-4 py-4">
                        <button onclick="event.stopPropagation(); deleteCourse('${course.id}')" class="p-2 text-[#FF3B30] hover:bg-[rgba(255,59,48,0.1)] rounded-[10px] transition-colors" title="Excluir curso">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                      ` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Cards -->
            <div class="md:hidden p-4 space-y-3">
              ${lotCourses.map(course => `
                <div class="bg-[rgba(255,255,255,0.5)] border border-[rgba(0,0,0,0.1)] rounded-[16px] p-4 space-y-3 cursor-pointer hover:bg-[rgba(255,255,255,0.7)] transition-colors" onclick="openEditCourseModal('${course.id}')">
                  <div class="flex items-start justify-between">
                    <div>
                      <h3 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">${course.tipologia}</h3>
                      <!-- Added ID display in mobile card -->
                      <p class="text-xs text-[#8e8e93] font-mono mt-1">ID: ${course.idCurso || '-'}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      ${getStatusBadge(course.status)}
                      ${isLoggedIn ? `
                      <button onclick="event.stopPropagation(); deleteCourse('${course.id}')" class="p-1.5 text-[#FF3B30] hover:bg-[rgba(255,59,48,0.1)] rounded-[10px] transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      ` : ''}
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p class="text-[#8e8e93] text-xs mb-1">Carga Horária</p>
                      <p class="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.cargaHoraria}h</p>
                    </div>
                    <div>
                      <p class="text-[#8e8e93] text-xs mb-1">Município</p>
                      <p class="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.municipio}</p>
                    </div>
                    <div>
                      <p class="text-[#8e8e93] text-xs mb-1">Cozinha</p>
                      <p class="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.cozinha || '-'}</p>
                    </div>
                    <div>
                      <p class="text-[#8e8e93] text-xs mb-1">Início</p>
                      <p class="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.dataInicio ? formatDate(course.dataInicio) : '-'}</p>
                    </div>
                    <div>
                      <p class="text-[#8e8e93] text-xs mb-1">Fim</p>
                      <p class="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.dataFim ? formatDate(course.dataFim) : '-'}</p>
                    </div>
                    <div>
                      <p class="text-[#8e8e93] text-xs mb-1">Concludentes</p>
                      <p class="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">${course.concludentes !== null ? course.concludentes : '-'}</p>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    function getStatusBadge(status) {
      if (!status) status = 'Pendente';
      const normalized = normalizeStatus(status);
      const statusMap = {
        'concluído': { label: 'Concluído', style: 'bg-[rgba(52,199,89,0.15)] text-[#34C759] border-[rgba(52,199,89,0.2)]' },
        'pendente': { label: 'Pendente', style: 'bg-[rgba(255,149,0,0.15)] text-[#FF9500] border-[rgba(255,149,0,0.2)]' },
        'em andamento': { label: 'Em andamento', style: 'bg-[rgba(0,122,255,0.15)] text-[#007AFF] border-[rgba(0,122,255,0.2)]' },
        'em andamento.': { label: 'Em andamento', style: 'bg-[rgba(0,122,255,0.15)] text-[#007AFF] border-[rgba(0,122,255,0.2)]' },
        'em breve': { label: 'Em breve', style: 'bg-[rgba(255,149,0,0.15)] text-[#FF9500] border-[rgba(255,149,0,0.2)]' }
      };
      
      const statusInfo = statusMap[normalized] || { label: String(status).trim() || 'Pendente', style: 'bg-[rgba(142,142,147,0.15)] text-[#8e8e93] border-[rgba(142,142,147,0.2)]' };
      return `<span class="status-badge border ${statusInfo.style}">${statusInfo.label}</span>`;
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      
      // Se a data está no formato YYYY-MM-DD (sem hora), usar diretamente sem conversão de timezone
      if (typeof dateStr === 'string') {
        const dateOnly = dateStr.split('T')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
          const [year, month, day] = dateOnly.split('-');
          return `${day}/${month}/${year}`;
        }
      }
      
      // Para datas com hora, criar data local explicitamente
      const date = new Date(dateStr);
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return '-';
      }
      
      // Usar componentes da data local para evitar problemas de timezone
      // getDate(), getMonth(), getFullYear() sempre retornam valores locais
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }

    function updateFilters() {
      const lots = [...new Set(courses.map(c => c.lote))].sort((a, b) => a - b);
      const municipios = [...new Set(courses.map(c => c.municipio))].filter(m => m).sort();

      const loteSelect = document.getElementById('filter-lote');
      loteSelect.innerHTML = '<option value="">Todos os Lotes</option>' + 
        lots.map(l => `<option value="${l}">Lote ${l}</option>`).join('');

      const municipioSelect = document.getElementById('filter-municipio');
      municipioSelect.innerHTML = '<option value="">Todos os Municípios</option>' + 
        municipios.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    function applyFilters() {
      const searchId = document.getElementById('filter-id')?.value.trim() || '';
      const search = document.getElementById('filter-search')?.value.toLowerCase() || '';
      const lote = document.getElementById('filter-lote')?.value || '';
      const municipio = document.getElementById('filter-municipio')?.value || '';
      const status = document.getElementById('filter-status')?.value || '';

      filteredCourses = courses.filter(course => {
        if (lote && String(course.lote) !== lote) return false;
        if (municipio && course.municipio !== municipio) return false;
        // Normalizar status para comparação
        if (status) {
          const courseStatus = normalizeStatus(course.status || '');
          const filterStatus = normalizeStatus(status);
          if (courseStatus !== filterStatus) {
            // Tentar match parcial para "em andamento"
            if (filterStatus.includes('andamento') && !courseStatus.includes('andamento')) return false;
            if (!filterStatus.includes('andamento') && courseStatus !== filterStatus) return false;
          }
        }
        if (search && !course.tipologia.toLowerCase().includes(search)) return false;
        // Busca por ID do curso (case-insensitive e busca parcial)
        if (searchId) {
          const courseId = course.idCurso ? String(course.idCurso).toLowerCase() : '';
          if (!courseId.includes(searchId.toLowerCase())) return false;
        }
        return true;
      });

      renderAll();
    }

    function deleteCourse(id) {
      if (!requireEditAccess()) return;
      if (!confirm('Deseja excluir este curso?')) return;
      
      const course = courses.find(c => c.id === id);
      if (!course) return;
      
      // Adicionar ao stack de undo
      addToUndoStack('delete', { course: JSON.parse(JSON.stringify(course)) });
      
      courses = courses.filter(c => c.id !== id);
      filteredCourses = filteredCourses.filter(c => c.id !== id);
      
      // Log da ação
      logAction('Exclusão de Curso', {
        courseId: id,
        idCurso: course.idCurso,
        tipologia: course.tipologia,
        lote: course.lote,
        municipio: course.municipio,
        status: course.status
      });
      
      saveToStorage(); // Save after deletion
      updateFilters();
      renderAll();
      
      // Mostrar toast com opção de desfazer
      showToast('Item removido', 'success', 5000, true);
    }

    function openEditCourseModal(courseId) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;
      
      currentEditCourse = course;
      
      // Preencher informações somente leitura (para usuários não logados)
      document.getElementById('edit-course-id').textContent = course.idCurso || '-';
      document.getElementById('edit-course-tipologia').textContent = course.tipologia || '-';
      document.getElementById('edit-course-carga').textContent = course.cargaHoraria ? `${course.cargaHoraria}h` : '-';
      document.getElementById('edit-course-lote').textContent = course.lote || '-';
      document.getElementById('edit-course-municipio').textContent = course.municipio || '-';
      document.getElementById('edit-course-cozinha').textContent = course.cozinha || '-';
      document.getElementById('edit-course-turno-view').textContent = course.turno || '-';
      
      // Preencher campos editáveis (para usuários logados)
      document.getElementById('edit-course-id-input').value = course.idCurso || '';
      document.getElementById('edit-course-tipologia-input').value = course.tipologia || '';
      document.getElementById('edit-course-carga-input').value = course.cargaHoraria || '';
      document.getElementById('edit-course-lote-input').value = course.lote || '';
      document.getElementById('edit-course-municipio-input').value = course.municipio || '';
      document.getElementById('edit-course-cozinha-input').value = course.cozinha || '';
      document.getElementById('edit-course-inicio').value = course.dataInicio ? course.dataInicio : '';
      document.getElementById('edit-course-fim').value = course.dataFim ? course.dataFim : '';
      document.getElementById('edit-course-status').value = course.status || 'Pendente';
      document.getElementById('edit-course-turno').value = course.turno || '';
      document.getElementById('edit-course-concludentes').value = course.concludentes !== null ? course.concludentes : '';
      
      // Mostrar/ocultar seção de edição baseado no login
      const editableSection = document.getElementById('edit-course-editable-section');
      const actionsSection = document.getElementById('edit-course-actions');
      const viewOnlySection = document.getElementById('edit-course-view-only');
      const viewOnlyInfoSection = document.getElementById('edit-course-view-only-section');
      
      if (canEditCourses()) {
        editableSection.classList.remove('hidden');
        actionsSection.classList.remove('hidden');
        viewOnlySection.classList.add('hidden');
        viewOnlyInfoSection.classList.add('hidden');
      } else {
        editableSection.classList.add('hidden');
        actionsSection.classList.add('hidden');
        viewOnlySection.classList.remove('hidden');
        viewOnlyInfoSection.classList.remove('hidden');
      }
      
      // Mostrar modal e aplicar efeito no header
      document.getElementById('edit-course-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeEditCourseModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('edit-course-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      currentEditCourse = null;
    }

    function deleteCourseFromModal() {
      if (!currentEditCourse) return;
      deleteCourse(currentEditCourse.id);
      closeEditCourseModal();
    }

    function saveEditedCourse(buttonElement = null) {
      if (!requireEditAccess()) return;
      if (!currentEditCourse) return;
      
      // Mostrar estado de loading
      if (buttonElement) {
        setActionState(buttonElement, 'loading', 'Salvando...');
      }
      
      try {
      
      // Capturar todos os campos editáveis
      const idCurso = document.getElementById('edit-course-id-input').value.trim() || null;
      const tipologia = document.getElementById('edit-course-tipologia-input').value.trim() || null;
      const cargaHoraria = document.getElementById('edit-course-carga-input').value ? parseInt(document.getElementById('edit-course-carga-input').value) : null;
      const lote = document.getElementById('edit-course-lote-input').value ? parseInt(document.getElementById('edit-course-lote-input').value) : null;
      const municipio = document.getElementById('edit-course-municipio-input').value.trim() || null;
      const cozinha = document.getElementById('edit-course-cozinha-input').value.trim() || null;
      const dataInicio = document.getElementById('edit-course-inicio').value || null;
      const dataFim = document.getElementById('edit-course-fim').value || null;
      const status = document.getElementById('edit-course-status').value;
      const turno = document.getElementById('edit-course-turno').value || null;
      const concludentes = document.getElementById('edit-course-concludentes').value ? parseInt(document.getElementById('edit-course-concludentes').value) : null;
      
      // Atualizar curso
      const courseIndex = courses.findIndex(c => c.id === currentEditCourse.id);
      if (courseIndex !== -1) {
        // Guardar valores antigos para log e undo
        const oldValues = {
          idCurso: courses[courseIndex].idCurso,
          tipologia: courses[courseIndex].tipologia,
          cargaHoraria: courses[courseIndex].cargaHoraria,
          lote: courses[courseIndex].lote,
          municipio: courses[courseIndex].municipio,
          cozinha: courses[courseIndex].cozinha,
          status: courses[courseIndex].status,
          turno: courses[courseIndex].turno,
          concludentes: courses[courseIndex].concludentes,
          dataInicio: courses[courseIndex].dataInicio,
          dataFim: courses[courseIndex].dataFim,
          turmaFormada: courses[courseIndex].turmaFormada,
          lastModified: courses[courseIndex].lastModified
        };
        
        // Adicionar ao stack de undo antes de modificar
        addToUndoStack('edit', { 
          courseId: currentEditCourse.id, 
          oldValues: JSON.parse(JSON.stringify(oldValues))
        });

        const hadTurmaFormada = isTurmaFechada(courses[courseIndex]);
        
        // Atualizar valores
        courses[courseIndex].idCurso = idCurso;
        courses[courseIndex].tipologia = tipologia;
        courses[courseIndex].cargaHoraria = cargaHoraria;
        courses[courseIndex].lote = lote;
        courses[courseIndex].municipio = municipio;
        courses[courseIndex].cozinha = cozinha;
        courses[courseIndex].dataInicio = dataInicio;
        courses[courseIndex].dataFim = dataFim;
        courses[courseIndex].status = status;
        courses[courseIndex].turno = turno;
        courses[courseIndex].concludentes = concludentes;
        courses[courseIndex].lastModified = {
          by: currentUser?.email || 'Sistema',
          at: new Date().toISOString()
        };
        
        // Atualização automática de status
        updateCourseStatusAutomatically(courses[courseIndex]);
        preserveTurmaFormadaFlag(courses[courseIndex], hadTurmaFormada);
        
        // Atualizar também no filteredCourses
        const filteredIndex = filteredCourses.findIndex(c => c.id === currentEditCourse.id);
        if (filteredIndex !== -1) {
          filteredCourses[filteredIndex].idCurso = courses[courseIndex].idCurso;
          filteredCourses[filteredIndex].tipologia = courses[courseIndex].tipologia;
          filteredCourses[filteredIndex].cargaHoraria = courses[courseIndex].cargaHoraria;
          filteredCourses[filteredIndex].lote = courses[courseIndex].lote;
          filteredCourses[filteredIndex].municipio = courses[courseIndex].municipio;
          filteredCourses[filteredIndex].cozinha = courses[courseIndex].cozinha;
          filteredCourses[filteredIndex].dataInicio = courses[courseIndex].dataInicio;
          filteredCourses[filteredIndex].dataFim = courses[courseIndex].dataFim;
          filteredCourses[filteredIndex].status = courses[courseIndex].status;
          filteredCourses[filteredIndex].turno = courses[courseIndex].turno;
          filteredCourses[filteredIndex].concludentes = courses[courseIndex].concludentes;
          filteredCourses[filteredIndex].lastModified = courses[courseIndex].lastModified;
          filteredCourses[filteredIndex].turmaFormada = courses[courseIndex].turmaFormada;
        }
        
        // Preparar mudanças para log
        const changes = {};
        Object.keys(oldValues).forEach(key => {
          if (oldValues[key] !== courses[courseIndex][key]) {
            changes[key] = { from: oldValues[key], to: courses[courseIndex][key] };
          }
        });
        
        // Log da ação
        logAction('Curso Editado', {
          courseId: currentEditCourse.id,
          idCurso: courses[courseIndex].idCurso,
          tipologia: courses[courseIndex].tipologia,
          lote: courses[courseIndex].lote,
          municipio: courses[courseIndex].municipio,
          changes: changes
        });
      }
      
      // Salvar e atualizar
      saveToStorage();
      renderAll();
      closeEditCourseModal();
      
      // Mostrar estado de sucesso
      if (buttonElement) {
        setActionState(buttonElement, 'success', 'Salvo!');
      }
      
      showToast('Curso atualizado com sucesso!', 'success', 5000, true);
      } catch (error) {
        console.error('Erro ao salvar curso:', error);
        
        // Mostrar estado de erro com retry
        if (buttonElement) {
          setActionState(buttonElement, 'error', 'Erro ao salvar');
          setTimeout(() => {
            setActionState(buttonElement, 'retry', 'Tentar novamente');
            buttonElement.onclick = () => saveEditedCourse(buttonElement);
          }, 3000);
        }
        
        showToast('Erro ao salvar curso. Tente novamente.', 'error');
      }
    }

    function deleteLot() {
      if (!confirm(`Deseja excluir o Lote ${currentEditLot} inteiro? Todos os cursos e responsáveis serão removidos.`)) return;
      courses = courses.filter(c => c.lote !== currentEditLot);
      filteredCourses = filteredCourses.filter(c => c.lote !== currentEditLot);
      delete lotResponsibles[currentEditLot];
      saveToStorage(); // Save after deletion
      closeResponsiblesModal();
      updateFilters();
      renderAll();
    }

    function deleteAllCourses() {
      if (userRole !== 'admin') {
        showToast('Apenas administradores podem executar esta ação.', 'error');
        return;
      }
      
      if (!confirm('⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nTem certeza que deseja excluir TODOS os cursos?\n\nDigite "CONFIRMAR" para continuar.')) return;
      
      const confirmation = prompt('Digite "CONFIRMAR" para excluir todos os cursos:');
      if (confirmation !== 'CONFIRMAR') {
        showToast('Ação cancelada.', 'info');
        return;
      }
      
      logAction('Exclusão Crítica', { action: 'deleteAllCourses' });
      if (!confirm('Deseja excluir TODOS os cursos? Esta ação não pode ser desfeita.')) return;
      courses = [];
      filteredCourses = [];
      saveToStorage(); // Save after deletion
      updateFilters();
      renderAll();
      alert('Todos os cursos foram excluídos.');
    }

    function deleteAllResponsibles() {
      if (!confirm('Deseja excluir TODOS os responsáveis de todos os lotes? Esta ação não pode ser desfeita.')) return;
      lotResponsibles = {};
      saveToStorage(); // Save after deletion
      renderAll();
      alert('Todos os responsáveis foram excluídos.');
    }

    function deleteAllData() {
      if (userRole !== 'admin') {
        showToast('Apenas administradores podem executar esta ação.', 'error');
        return;
      }
      
      if (!confirm('⚠️ ATENÇÃO CRÍTICA: Esta ação é IRREVERSÍVEL!\n\nTem certeza que deseja excluir TODOS os dados do sistema?')) return;
      
      const confirmation = prompt('Digite "EXCLUIR TUDO" para confirmar:');
      if (confirmation !== 'EXCLUIR TUDO') {
        showToast('Ação cancelada.', 'info');
        return;
      }
      
      logAction('Exclusão Crítica Total', { action: 'deleteAllData' });
      if (!confirm('ATENÇÃO: Deseja excluir TODOS os dados (cursos e responsáveis)? Esta ação não pode ser desfeita.')) return;
      if (!confirm('Tem certeza absoluta? Esta ação é IRREVERSÍVEL.')) return;
      courses = [];
      filteredCourses = [];
      lotResponsibles = {};
      saveToStorage(); // Save after deletion
      updateFilters();
      renderAll();
      alert('Todos os dados foram excluídos.');
    }

    // Backup and Restore Functions
    function exportBackup() {
      try {
        const backup = {
          version: '1.0',
          exportDate: new Date().toISOString(),
          data: {
            courses: courses,
            responsibles: lotResponsibles
          }
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `backup-cursos-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Log da ação
        logAction('Exportação de Backup', {
          coursesCount: courses.length,
          responsiblesLots: Object.keys(lotResponsibles).length,
          filename: `backup-cursos-${dateStr}.json`
        });
        
        showToast(`Backup exportado com sucesso!\n${courses.length} curso(s) e ${Object.keys(lotResponsibles).length} lote(s) com responsáveis.`, 'success');
      } catch (error) {
        console.error('Erro ao exportar backup:', error);
        alert('Erro ao exportar backup. Verifique o console para mais detalhes.');
      }
    }

    // ========== EXPORTAÇÃO INTELIGENTE DE PLANILHA ==========
    function exportSpreadsheet() {
      if (!window.XLSX) {
        showToast('Biblioteca XLSX não carregada. Recarregue a página.', 'error');
        return;
      }

      if (courses.length === 0) {
        showToast('Não há cursos para exportar.', 'warning');
        return;
      }

      try {
        // Definir cabeçalhos na ordem exata especificada
        const headers = [
          'ID',
          'TIPOLOGIA',
          'CARGA HORÁRIA',
          'DATA INÍCIO',
          'DATA TÉRMINO',
          'CIDADE',
          'TURNO',
          'LOTE',
          'COZINHA',
          'ENDEREÇO',
          'STATUS',
          'CONCLUDENTES',
          'FOTOS',
          'INSTRUMENTAIS'
        ];

        // Mapeamento de cabeçalhos para campos do curso
        const fieldMapping = {
          'ID': 'idCurso',
          'TIPOLOGIA': 'tipologia',
          'CARGA HORÁRIA': 'cargaHoraria',
          'DATA INÍCIO': 'dataInicio',
          'DATA TÉRMINO': 'dataFim',
          'CIDADE': 'municipio',
          'TURNO': 'turno',
          'LOTE': 'lote',
          'COZINHA': 'cozinha',
          'ENDEREÇO': 'endereco',
          'STATUS': 'status',
          'CONCLUDENTES': 'concludentes',
          'FOTOS': 'albumLink',
          'INSTRUMENTAIS': 'instrumentaisLink'
        };

        // Preparar dados para exportação
        const worksheetData = [];
        
        // Adicionar cabeçalhos
        worksheetData.push(headers);

        // Adicionar dados com correção automática
        courses.forEach(course => {
          const row = headers.map(header => {
            const field = fieldMapping[header];
            let value = course[field];

            // Correção automática de erros
            if (value === null || value === undefined) {
              value = '';
            } else if (field === 'dataInicio' || field === 'dataFim') {
              // Formatar datas
              if (value) {
                try {
                  const date = new Date(value);
                  if (!isNaN(date.getTime())) {
                    // Formato Excel: YYYY-MM-DD
                    value = date.toISOString().split('T')[0];
                  } else {
                    value = '';
                  }
                } catch (e) {
                  value = '';
                }
              } else {
                value = '';
              }
            } else if (field === 'cargaHoraria' || field === 'concludentes' || field === 'lote') {
              // Garantir números
              value = value !== null && value !== undefined ? Number(value) : '';
            } else if (field === 'albumLink' || field === 'instrumentaisLink' || field === 'endereco') {
              // Campos de texto/URL que podem estar vazios
              value = value !== null && value !== undefined ? String(value).trim() : '';
            } else if (field === 'status') {
              // Normalizar status
              if (value) {
                const normalized = String(value).trim().toLowerCase();
                if (normalized === 'concluído' || normalized === 'concluido') {
                  value = 'Concluído';
                } else if (normalized === 'pendente') {
                  value = 'Pendente';
                } else if (normalized === 'em andamento' || normalized === 'em andamento.' || normalized === 'andamento') {
                  value = 'Em andamento';
                } else {
                  value = String(value).trim();
                }
              } else {
                value = 'Pendente';
              }
            } else {
              // Converter para string e limpar
              value = value !== null && value !== undefined ? String(value).trim() : '';
            }

            return value;
          });
          worksheetData.push(row);
        });

        // Criar workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);

        // Ajustar larguras das colunas
        const colWidths = headers.map((header, idx) => {
          const maxLength = Math.max(
            header.length,
            ...worksheetData.slice(1).map(row => String(row[idx] || '').length)
          );
          return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
        });
        ws['!cols'] = colWidths;

        // Adicionar worksheet ao workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Cursos');

        // Gerar arquivo
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `cursos-export-${dateStr}.xlsx`);

        // Log da ação
        logAction('Exportação de Planilha', {
          coursesCount: courses.length,
          filename: `cursos-export-${dateStr}.xlsx`,
          columns: headers.length
        });

        showToast(`Planilha exportada com sucesso!\n${courses.length} curso(s) exportado(s).`, 'success');
      } catch (error) {
        console.error('Erro ao exportar planilha:', error);
        
        // Tentar correção automática
        try {
          showToast('Tentando corrigir automaticamente...', 'info');
          
          // Remover campos problemáticos e tentar novamente
          const simplifiedCourses = courses.map(c => ({
            idCurso: c.idCurso || '',
            tipologia: c.tipologia || '',
            cargaHoraria: c.cargaHoraria || 0,
            lote: c.lote || 0,
            municipio: c.municipio || '',
            cozinha: c.cozinha || '',
            dataInicio: c.dataInicio ? new Date(c.dataInicio).toISOString().split('T')[0] : '',
            dataFim: c.dataFim ? new Date(c.dataFim).toISOString().split('T')[0] : '',
            status: c.status || 'Pendente',
            turno: c.turno || '',
            concludentes: c.concludentes || '',
            endereco: c.endereco || '',
            albumLink: c.albumLink || '',
            instrumentaisLink: c.instrumentaisLink || ''
          }));

          const simplifiedData = [
            ['ID', 'TIPOLOGIA', 'CARGA HORÁRIA', 'DATA INÍCIO', 'DATA TÉRMINO', 'CIDADE', 'TURNO', 'LOTE', 'COZINHA', 'ENDEREÇO', 'STATUS', 'CONCLUDENTES', 'FOTOS', 'INSTRUMENTAIS'],
            ...simplifiedCourses.map(c => [
              c.idCurso || '',
              c.tipologia || '',
              c.cargaHoraria || 0,
              c.dataInicio || '',
              c.dataFim || '',
              c.municipio || '',
              c.turno || '',
              c.lote || 0,
              c.cozinha || '',
              c.endereco || '',
              c.status || 'Pendente',
              c.concludentes || '',
              c.albumLink || '',
              c.instrumentaisLink || ''
            ])
          ];

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(simplifiedData);
          XLSX.utils.book_append_sheet(wb, ws, 'Cursos');
          
          const dateStr = new Date().toISOString().split('T')[0];
          XLSX.writeFile(wb, `cursos-export-${dateStr}.xlsx`);
          
          showToast('Planilha exportada com campos simplificados.', 'success');
          logAction('Exportação de Planilha (Corrigida)', {
            coursesCount: courses.length,
            filename: `cursos-export-${dateStr}.xlsx`
          });
        } catch (retryError) {
          console.error('Erro na correção automática:', retryError);
          showToast('Erro ao exportar planilha. Verifique o console para mais detalhes.', 'error');
        }
      }
    }

    let backupPreviewData = null;

    function openRestoreModal() {
      if (!requireEditAccess()) return;
      document.getElementById('restore-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      document.getElementById('restore-file-input').value = '';
      document.getElementById('restore-error').classList.add('hidden');
      document.getElementById('restore-preview').classList.add('hidden');
      backupPreviewData = null;
    }

    function closeRestoreModal() {
      document.getElementById('restore-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      document.getElementById('restore-file-input').value = '';
      document.getElementById('restore-error').classList.add('hidden');
      document.getElementById('restore-preview').classList.add('hidden');
      backupPreviewData = null;
    }

    // Auto-preview when file is selected
    document.addEventListener('DOMContentLoaded', () => {
      const fileInput = document.getElementById('restore-file-input');
      if (fileInput) {
        fileInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
              try {
                const backup = JSON.parse(e.target.result);
                backupPreviewData = backup;
                
                // Validate backup structure
                if (!backup.data || (!backup.data.courses && !backup.data.responsibles)) {
                  throw new Error('Formato de backup inválido. O arquivo deve conter dados de cursos e/ou responsáveis.');
                }
                
                const coursesCount = backup.data.courses ? backup.data.courses.length : 0;
                const responsiblesCount = backup.data.responsibles ? Object.keys(backup.data.responsibles).length : 0;
                
                const previewContent = `
                  <div class="space-y-2">
                    <p><span class="font-medium">Data do backup:</span> ${backup.exportDate ? new Date(backup.exportDate).toLocaleString('pt-BR') : 'Desconhecida'}</p>
                    <p><span class="font-medium">Cursos:</span> ${coursesCount}</p>
                    <p><span class="font-medium">Lotes com responsáveis:</span> ${responsiblesCount}</p>
                    <p class="text-xs text-muted-foreground mt-3">Selecione o modo de restauração acima e clique em "Restaurar" para continuar.</p>
                  </div>
                `;
                
                document.getElementById('restore-preview-content').innerHTML = previewContent;
                document.getElementById('restore-preview').classList.remove('hidden');
                document.getElementById('restore-error').classList.add('hidden');
              } catch (error) {
                console.error('Erro ao ler backup:', error);
                document.getElementById('restore-error').textContent = `Erro ao ler arquivo: ${error.message}`;
                document.getElementById('restore-error').classList.remove('hidden');
                document.getElementById('restore-preview').classList.add('hidden');
                backupPreviewData = null;
              }
            };
            reader.readAsText(file);
          }
        });
      }
    });

    async function confirmRestore() {
      if (!backupPreviewData) {
        document.getElementById('restore-error').textContent = 'Por favor, selecione um arquivo de backup válido.';
        document.getElementById('restore-error').classList.remove('hidden');
        return;
      }

      const restoreMode = document.querySelector('input[name="restore-mode"]:checked').value;
      
      if (restoreMode === 'replace') {
        if (!confirm('⚠️ ATENÇÃO: Isso irá substituir TODOS os dados atuais pelos dados do backup. Esta ação não pode ser desfeita. Deseja continuar?')) {
          return;
        }
        if (!confirm('Tem certeza absoluta? Todos os cursos e responsáveis atuais serão perdidos!')) {
          return;
        }
      } else {
        if (!confirm(`Isso irá adicionar os dados do backup aos dados existentes.\n${backupPreviewData.data.courses ? backupPreviewData.data.courses.length : 0} curso(s) e ${backupPreviewData.data.responsibles ? Object.keys(backupPreviewData.data.responsibles).length : 0} lote(s) com responsáveis serão adicionados.\nDeseja continuar?`)) {
          return;
        }
      }

      try {
        if (restoreMode === 'replace') {
          // Replace all data
          courses = backupPreviewData.data.courses || [];
          lotResponsibles = backupPreviewData.data.responsibles || {};
        } else {
          // Merge data
          const existingCourseIds = new Set(courses.map(c => c.id));
          const newCourses = (backupPreviewData.data.courses || []).filter(c => !existingCourseIds.has(c.id));
          courses = [...courses, ...newCourses];
          
          // Merge responsibles
          if (backupPreviewData.data.responsibles) {
            Object.keys(backupPreviewData.data.responsibles).forEach(lot => {
              if (!lotResponsibles[lot]) {
                lotResponsibles[lot] = [];
              }
              const existingRespIds = new Set((lotResponsibles[lot] || []).map(r => r.id));
              const newResponsibles = (backupPreviewData.data.responsibles[lot] || []).filter(r => !existingRespIds.has(r.id));
              lotResponsibles[lot] = [...(lotResponsibles[lot] || []), ...newResponsibles];
            });
          }
        }

        filteredCourses = [...courses];
        await saveToStorage();
        updateFilters();
        renderAll();
        closeRestoreModal();
        
        const restoredCourses = restoreMode === 'replace' ? courses.length : (backupPreviewData.data.courses || []).length;
        const restoredResponsibles = restoreMode === 'replace' 
          ? Object.keys(lotResponsibles).length 
          : Object.keys(backupPreviewData.data.responsibles || {}).length;
        
        alert(`Backup restaurado com sucesso!\n${restoredCourses} curso(s) e ${restoredResponsibles} lote(s) com responsáveis.`);
      } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        document.getElementById('restore-error').textContent = `Erro ao restaurar backup: ${error.message}`;
        document.getElementById('restore-error').classList.remove('hidden');
      }
    }

    function openAddCourseModal() {
      if (!requireEditAccess()) return;
      // Fechar FAB menu se estiver aberto
      const fabMenu = document.getElementById('fab-menu');
      if (fabMenu && fabMenu.classList.contains('open')) {
        toggleFABMenu();
      }
      document.getElementById('add-course-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeAddCourseModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('add-course-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      document.getElementById('course-id').value = ''; // Clear ID field
      document.getElementById('course-tipologia').value = '';
      document.getElementById('course-carga').value = '';
      document.getElementById('course-lote').value = '';
      document.getElementById('course-inicio').value = '';
      document.getElementById('course-fim').value = '';
      document.getElementById('course-municipio').value = '';
      document.getElementById('course-cozinha').value = '';
      document.getElementById('course-status').value = 'Pendente';
      document.getElementById('course-concludentes').value = '';
    }

    function saveCourse() {
      if (!requireEditAccess()) return;
      const idCurso = document.getElementById('course-id').value.trim(); // Get ID
      const tipologia = document.getElementById('course-tipologia').value.trim();
      const cargaHoraria = parseInt(document.getElementById('course-carga').value);
      const lote = parseInt(document.getElementById('course-lote').value);
      const municipio = document.getElementById('course-municipio').value.trim();
      const dataInicio = document.getElementById('course-inicio').value || null;
      const dataFim = document.getElementById('course-fim').value || null;
      const status = document.getElementById('course-status').value;
      const concludentes = document.getElementById('course-concludentes').value ? parseInt(document.getElementById('course-concludentes').value) : null;
      const cozinha = document.getElementById('course-cozinha').value.trim() || null;

      if (!tipologia || !cargaHoraria || !lote || !municipio) {
        alert('Preencha todos os campos obrigatórios (*)');
        return;
      }

      const newCourse = {
        id: `course-${Date.now()}`,
        idCurso: idCurso || null, // Include course ID
        tipologia,
        cargaHoraria,
        lote,
        municipio,
        cozinha,
        dataInicio,
        dataFim,
        status,
        concludentes,
        turmaFormada: false
      };

      // Atualização automática de status
      updateCourseStatusAutomatically(newCourse);

      courses.push(newCourse);
      filteredCourses = [...courses];
      
      // Log da ação
      logAction('Curso Criado', {
        courseId: newCourse.id,
        idCurso: idCurso,
        tipologia: tipologia,
        lote: lote,
        municipio: municipio,
        status: status
      });
      
      saveToStorage(); // Save after adding
      updateFilters();
      applyFilters();
      closeAddCourseModal();
      showToast('Curso adicionado com sucesso!', 'success');
    }

    // Import Modal Functions
    function openImportModal() {
      if (!requireEditAccess()) return;
      // Fechar FAB menu se estiver aberto
      const fabMenu = document.getElementById('fab-menu');
      if (fabMenu && fabMenu.classList.contains('open')) {
        toggleFABMenu();
      }
      document.getElementById('import-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      resetImportModal();
    }

    function closeImportModal() {
      document.getElementById('import-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      resetImportModal();
    }

    function resetImportModal() {
      document.getElementById('import-step-1').classList.remove('hidden');
      document.getElementById('import-step-2').classList.add('hidden');
      document.getElementById('import-step-3').classList.add('hidden');
      document.getElementById('file-input').value = '';
      uploadedData = [];
      fileColumns = [];
      columnMapping = {};
    }

    function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
          alert('A planilha precisa ter pelo menos um cabeçalho e uma linha de dados.');
          return;
        }

        fileColumns = jsonData[0].map(col => String(col || '').trim()).filter(col => col);
        uploadedData = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== '' && cell !== undefined));

        // Mapeamento inteligente aprimorado com múltiplos padrões e correção automática
        const fieldNames = Object.keys(fieldLabels);
        const mappingPatterns = {
          idCurso: ['id', 'código', 'codigo', 'identificador', 'num', 'número', 'numero', 'id curso', 'id do curso', 'cod', 'cód'],
          tipologia: ['tipologia', 'tipo', 'curso', 'nome', 'nome do curso', 'curso/tipologia', 'descrição', 'descricao', 'nome curso', 'tipo curso'],
          cargaHoraria: ['carga', 'horária', 'horaria', 'carga horária', 'carga horaria', 'horas', 'h', 'ch', 'carga hor', 'c.h.', 'c.h', 'carga/hora'],
          dataInicio: ['início', 'inicio', 'data início', 'data inicio', 'dt início', 'dt inicio', 'início previsto', 'inicio previsto', 'start', 'começo', 'comeco', 'data de início', 'data de inicio'],
          dataFim: ['fim', 'término', 'termino', 'data fim', 'data término', 'dt fim', 'dt termino', 'conclusão', 'conclusao', 'end', 'final', 'data de fim', 'data de término'],
          municipio: ['município', 'municipio', 'cidade', 'local', 'localização', 'localizacao', 'município sede', 'municipio sede', 'munic', 'cidade sede'],
          turno: ['turno', 'período', 'periodo', 'horário', 'horario', 'manhã', 'manha', 'tarde', 'noite'],
          lote: ['lote', 'grupo', 'batch', 'lote número', 'lote numero', 'lote nº', 'lote n', 'lote n°'],
          cozinha: ['cozinha', 'coz', 'kitchen', 'nome cozinha', 'cozinha do curso', 'cozinha nº', 'cozinha n'],
          endereco: ['endereço', 'endereco', 'endereço do curso', 'endereco do curso', 'localização', 'localizacao', 'local', 'end', 'address'],
          status: ['status', 'situação', 'situacao', 'estado', 'andamento', 'status do curso', 'situação do curso'],
          concludentes: ['concludentes', 'concluintes', 'alunos', 'matriculados', 'quantidade', 'qtd', 'total', 'qtd concludentes', 'total alunos'],
          albumLink: ['album', 'álbum', 'fotos', 'link album', 'link álbum', 'drive album', 'drive álbum', 'link fotos', 'link drive', 'album link'],
          instrumentaisLink: ['instrumentais', 'instrumental', 'link instrumentais', 'link instrumental', 'drive instrumentais', 'drive instrumental', 'instrumentais link'],
          instrutor: ['instrutor', 'instrutores', 'nome instrutor', 'instrutor do curso', 'professor', 'prof', 'teacher']
        };

        // Função de similaridade para encontrar melhor match
        function calculateSimilarity(str1, str2) {
          const s1 = str1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const s2 = str2.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          
          if (s1 === s2) return 1.0;
          if (s1.includes(s2) || s2.includes(s1)) return 0.8;
          
          // Calcular similaridade por caracteres comuns
          const longer = s1.length > s2.length ? s1 : s2;
          const shorter = s1.length > s2.length ? s2 : s1;
          const editDistance = levenshteinDistance(s1, s2);
          return 1 - (editDistance / longer.length);
        }

        function levenshteinDistance(str1, str2) {
          const matrix = [];
          for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
          }
          for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
          }
          for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
              if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                matrix[i][j] = Math.min(
                  matrix[i - 1][j - 1] + 1,
                  matrix[i][j - 1] + 1,
                  matrix[i - 1][j] + 1
                );
              }
            }
          }
          return matrix[str2.length][str1.length];
        }

        // Mapeamento inteligente com pontuação
        fieldNames.forEach(field => {
          const patterns = mappingPatterns[field] || [];
          const labelLower = fieldLabels[field].toLowerCase();
          
          let bestMatch = null;
          let bestScore = 0;
          
          fileColumns.forEach(col => {
            const colLower = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            let score = 0;
            
            // Match exato
            if (colLower === field.toLowerCase() || colLower === labelLower) {
              score = 1.0;
            }
            // Match por padrões
            else if (patterns.some(pattern => colLower.includes(pattern) || pattern.includes(colLower))) {
              score = 0.9;
            }
            // Match por similaridade
            else {
              score = calculateSimilarity(col, fieldLabels[field]);
              // Bonus para padrões específicos
              if (field === 'idCurso' && (colLower.match(/^(id|cód|cod|num)/) || colLower.includes('identificador'))) {
                score = Math.max(score, 0.85);
              }
              if (field === 'cargaHoraria' && (colLower.includes('hor') || colLower.includes('carga'))) {
                score = Math.max(score, 0.85);
              }
              if (field === 'municipio' && (colLower.includes('munic') || colLower.includes('cidade'))) {
                score = Math.max(score, 0.85);
              }
            }
            
            if (score > bestScore && score >= 0.6) {
              bestScore = score;
              bestMatch = col;
            }
          });
          
          if (bestMatch) {
            columnMapping[field] = bestMatch;
          }
        });

        // Correção automática: detectar e sugerir correções para campos críticos
        const criticalFields = ['lote', 'tipologia'];
        const missingFields = criticalFields.filter(field => !columnMapping[field]);
        
        if (missingFields.length > 0) {
          // Tentar encontrar automaticamente com padrões mais flexíveis
          missingFields.forEach(field => {
            if (!columnMapping[field]) {
              const patterns = mappingPatterns[field] || [];
              const found = fileColumns.find(col => {
                const colLower = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return patterns.some(pattern => {
                  const patternLower = pattern.toLowerCase();
                  return colLower.includes(patternLower) || patternLower.includes(colLower) || 
                         calculateSimilarity(col, fieldLabels[field]) > 0.5;
                });
              });
              if (found) {
                columnMapping[field] = found;
              }
            }
          });
        }

        // Store additional columns that weren't mapped to standard fields
        const mappedColumns = Object.values(columnMapping).filter(v => v);
        columnMapping._additionalColumns = fileColumns.filter(col => !mappedColumns.includes(col));

        renderMappingStep();
        document.getElementById('import-step-1').classList.add('hidden');
        document.getElementById('import-step-2').classList.remove('hidden');
      };
      reader.readAsArrayBuffer(file);
    }

    function renderMappingStep() {
      const fields = Object.keys(fieldLabels);
      const additionalCols = columnMapping._additionalColumns || [];
      
      // Verificar campos críticos não mapeados
      const criticalFields = ['lote', 'tipologia'];
      const unmappedCritical = criticalFields.filter(field => !columnMapping[field]);
      
      let html = '';
      
      // Mostrar aviso se campos críticos não estão mapeados
      if (unmappedCritical.length > 0) {
        html += `
          <div class="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div class="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="flex-1">
                <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">Campos críticos não mapeados</p>
                <p class="text-xs text-yellow-700 dark:text-yellow-300">Os seguintes campos são obrigatórios: ${unmappedCritical.map(f => fieldLabels[f]).join(', ')}</p>
                <button onclick="autoFixMapping()" class="mt-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors">
                  🔧 Corrigir Automaticamente
                </button>
              </div>
            </div>
          </div>
        `;
      }
      
      html += fields.map(field => {
        const isMapped = columnMapping[field];
        const isCritical = criticalFields.includes(field);
        const borderColor = isCritical && !isMapped ? 'border-yellow-500' : isMapped ? 'border-green-500' : 'border-border';
        
        return `
        <div class="flex items-center gap-4">
          <label class="w-32 text-sm font-medium text-foreground">
            ${fieldLabels[field]} 
            ${field === 'lote' ? '<span class="text-red-500">*</span>' : ''}
            ${isMapped ? '<span class="text-green-500 text-xs">✓</span>' : ''}
          </label>
          <select id="map-${field}" class="flex-1 px-3 py-2 bg-input border ${borderColor} rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">-- Não mapear --</option>
            ${fileColumns.map(col => `<option value="${col}" ${columnMapping[field] === col ? 'selected' : ''}>${col}</option>`).join('')}
          </select>
        </div>
      `;
      }).join('');
      
      // Add additional columns mapping section
      if (additionalCols.length > 0) {
        html += `
          <div class="mt-6 pt-4 border-t border-border">
            <h4 class="text-sm font-medium text-foreground mb-3">Colunas Adicionais Encontradas</h4>
            <p class="text-xs text-muted-foreground mb-4">Estas colunas foram encontradas na planilha e podem ser adicionadas como informações extras:</p>
            <div id="additional-mapping" class="space-y-3">
              ${additionalCols.map((col, idx) => `
                <div class="flex items-center gap-4">
                  <label class="w-32 text-sm text-muted-foreground truncate" title="${col}">${col.length > 20 ? col.substring(0, 20) + '...' : col}</label>
                  <div class="flex-1 flex items-center gap-2">
                    <input type="checkbox" id="add-col-${idx}" checked class="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary">
                    <label for="add-col-${idx}" class="text-sm text-muted-foreground">Incluir como informação adicional</label>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      document.getElementById('mapping-fields').innerHTML = html;
    }

    function backToStep1() {
      document.getElementById('import-step-1').classList.remove('hidden');
      document.getElementById('import-step-2').classList.add('hidden');
    }

    function backToStep2() {
      document.getElementById('import-step-2').classList.remove('hidden');
      document.getElementById('import-step-3').classList.add('hidden');
    }

    function autoFixMapping() {
      const fields = Object.keys(fieldLabels);
      const criticalFields = ['lote', 'tipologia'];
      
      // Tentar mapear automaticamente campos críticos não mapeados
      criticalFields.forEach(field => {
        if (!columnMapping[field]) {
          const label = fieldLabels[field].toLowerCase();
          const patterns = {
            lote: ['lote', 'grupo', 'batch', 'número', 'numero'],
            tipologia: ['tipologia', 'tipo', 'curso', 'nome']
          };
          
          const fieldPatterns = patterns[field] || [];
          const bestMatch = fileColumns.find(col => {
            const colLower = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return fieldPatterns.some(pattern => colLower.includes(pattern.toLowerCase()));
          });
          
          if (bestMatch) {
            columnMapping[field] = bestMatch;
            const select = document.getElementById(`map-${field}`);
            if (select) select.value = bestMatch;
          }
        }
      });
      
      // Re-renderizar para mostrar correções
      renderMappingStep();
      showToast('Mapeamento corrigido automaticamente!', 'success');
    }

    function goToStep3() {
      // Validar campos críticos antes de prosseguir
      const loteColumn = columnMapping['lote'];
      if (!loteColumn) {
        showToast('Por favor, mapeie a coluna "Lote" antes de continuar.', 'error');
        return;
      }
      
      // Collect mapping
      const fields = Object.keys(fieldLabels);
      fields.forEach(field => {
        const select = document.getElementById(`map-${field}`);
        if (select) {
          columnMapping[field] = select.value;
        }
      });

      // Validar dados antes de mostrar preview
      const validationErrors = validateImportedData();
      if (validationErrors.length > 0) {
        showValidationErrors(validationErrors);
        return;
      }

      renderPreview();
      document.getElementById('import-step-2').classList.add('hidden');
      document.getElementById('import-step-3').classList.remove('hidden');
    }

    function validateImportedData() {
      const errors = [];
      const fields = Object.keys(fieldLabels);
      const loteIndex = fileColumns.indexOf(columnMapping['lote']);
      
      if (loteIndex === -1) {
        errors.push('Coluna "Lote" não encontrada.');
        return errors;
      }
      
      // Validar algumas linhas de exemplo
      const sampleRows = uploadedData.slice(0, Math.min(10, uploadedData.length));
      sampleRows.forEach((row, idx) => {
        const loteValue = row[loteIndex];
        if (!loteValue || isNaN(parseInt(loteValue))) {
          errors.push(`Linha ${idx + 2}: Lote inválido ou vazio`);
        }
      });
      
      return errors;
    }

    function showValidationErrors(errors) {
      const errorHtml = `
        <div class="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Erros encontrados na planilha:</p>
              <ul class="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                ${errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
                ${errors.length > 5 ? `<li>... e mais ${errors.length - 5} erro(s)</li>` : ''}
              </ul>
              <button onclick="autoFixDataErrors()" class="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors">
                🔧 Tentar Corrigir Automaticamente
              </button>
            </div>
          </div>
        </div>
      `;
      
      const mappingFields = document.getElementById('mapping-fields');
      if (mappingFields) {
        mappingFields.insertAdjacentHTML('afterbegin', errorHtml);
      }
    }

    function autoFixDataErrors() {
      // Corrigir automaticamente erros comuns nos dados
      const loteIndex = fileColumns.indexOf(columnMapping['lote']);
      
      if (loteIndex !== -1) {
        uploadedData = uploadedData.map(row => {
          // Tentar corrigir lote
          if (row[loteIndex] !== null && row[loteIndex] !== undefined) {
            const loteStr = String(row[loteIndex]).trim();
            // Remover caracteres não numéricos e tentar extrair número
            const loteNum = parseInt(loteStr.replace(/\D/g, ''), 10);
            if (!isNaN(loteNum) && loteNum > 0) {
              row[loteIndex] = loteNum;
            }
          }
          return row;
        }).filter(row => {
          // Remover linhas sem lote válido
          const loteValue = row[loteIndex];
          return loteValue !== null && loteValue !== undefined && !isNaN(parseInt(loteValue));
        });
        
        showToast(`Dados corrigidos! ${uploadedData.length} linha(s) válida(s) restante(s).`, 'success');
        renderMappingStep();
      }
    }

    function renderPreview() {
      const previewData = uploadedData.slice(0, 5);
      const fields = Object.keys(fieldLabels);

      let tableHtml = `
        <thead class="bg-secondary/50">
          <tr>
            ${fields.map(f => `<th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase whitespace-nowrap">${fieldLabels[f]}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
      `;

      previewData.forEach(row => {
        tableHtml += '<tr>';
        fields.forEach(field => {
          const colName = columnMapping[field];
          const colIndex = colName ? fileColumns.indexOf(colName) : -1;
          const value = colIndex >= 0 ? (row[colIndex] ?? '-') : '-';
          tableHtml += `<td class="px-3 py-2 text-foreground text-sm whitespace-nowrap">${value}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody>';
      document.getElementById('preview-table').innerHTML = tableHtml;
    }

    function confirmImport() {
      if (!isLoggedIn) {
        openLoginModal();
        closeImportModal();
        return;
      }
      
      try {
        const fields = Object.keys(fieldLabels);
        
        const loteColumn = columnMapping['lote'];
        if (!loteColumn) {
          showToast('Por favor, mapeie a coluna "Lote" para que os cursos sejam separados corretamente.', 'error');
          backToStep2();
          return;
        }
        
        // Validar dados antes de importar
        const validationErrors = validateImportedData();
        if (validationErrors.length > 0 && validationErrors.length < uploadedData.length) {
          // Se houver erros mas ainda há dados válidos, perguntar se quer corrigir
          const shouldFix = confirm(`Foram encontrados ${validationErrors.length} erro(s) nos dados.\n\nDeseja corrigir automaticamente?`);
          if (shouldFix) {
            autoFixDataErrors();
            // Re-validar após correção
            const newErrors = validateImportedData();
            if (newErrors.length > 0 && newErrors.length >= uploadedData.length) {
              showToast('Não foi possível corrigir todos os erros. Verifique a planilha.', 'error');
              return;
            }
          }
        }
        
        // Get additional columns to include
        const additionalCols = columnMapping._additionalColumns || [];
        const additionalColsToInclude = [];
        additionalCols.forEach((col, idx) => {
          const checkbox = document.getElementById(`add-col-${idx}`);
          if (checkbox && checkbox.checked) {
            additionalColsToInclude.push(col);
          }
        });
        
        const newCourses = uploadedData.map((row, index) => {
          const course = { id: `imported-${Date.now()}-${index}`, additionalInfo: {} };
          
          fields.forEach(field => {
            const colName = columnMapping[field];
            const colIndex = colName ? fileColumns.indexOf(colName) : -1;
            let value = colIndex >= 0 ? row[colIndex] : null;

          if (field === 'idCurso') {
            value = value !== null && value !== '' && value !== undefined ? String(value).trim() : null;
          } else if (field === 'cargaHoraria' || field === 'concludentes') {
            value = value !== null && value !== '' && value !== undefined ? Number(value) : (field === 'concludentes' ? null : 0);
          } else if (field === 'lote') {
            const parsed = parseInt(value, 10);
            value = !isNaN(parsed) && parsed > 0 ? parsed : null;
          } else if (field === 'status') {
            if (value) {
              const normalized = String(value).trim().toLowerCase();
              // Normalize to standard values
              if (normalized === 'concluído' || normalized === 'concluido') {
                value = 'Concluído';
              } else if (normalized === 'pendente') {
                value = 'Pendente';
              } else if (normalized === 'em andamento' || normalized === 'em andamento.' || normalized === 'andamento') {
                value = 'Em andamento';
              } else {
                value = String(value).trim();
              }
            } else {
              value = 'Pendente';
            }
          } else if (field === 'cozinha' || field === 'turno' || field === 'endereco' || field === 'instrutor' || field === 'albumLink' || field === 'instrumentaisLink') {
            value = value !== null && value !== '' && value !== undefined ? String(value).trim() : null;
          } else if (field === 'dataInicio' || field === 'dataFim') {
            if (value && typeof value === 'number') {
              // Excel date serial number
              try {
                const date = new Date((value - 25569) * 86400 * 1000);
                if (!isNaN(date.getTime())) {
                  value = date.toISOString().split('T')[0];
                } else {
                  value = null;
                }
              } catch (e) {
                value = null;
              }
            } else if (value && typeof value === 'string') {
              // Tentar múltiplos formatos de data
              const dateFormats = [
                /^(\d{2})\/(\d{2})\/(\d{4})$/,  // DD/MM/YYYY
                /^(\d{4})-(\d{2})-(\d{2})$/,      // YYYY-MM-DD
                /^(\d{2})-(\d{2})-(\d{4})$/,     // DD-MM-YYYY
              ];
              
              let parsed = null;
              for (const format of dateFormats) {
                const match = value.trim().match(format);
                if (match) {
                  if (format === dateFormats[0]) {
                    // DD/MM/YYYY
                    parsed = new Date(`${match[3]}-${match[2]}-${match[1]}`);
                  } else if (format === dateFormats[1]) {
                    // YYYY-MM-DD
                    parsed = new Date(value);
                  } else if (format === dateFormats[2]) {
                    // DD-MM-YYYY
                    parsed = new Date(`${match[3]}-${match[2]}-${match[1]}`);
                  }
                  break;
                }
              }
              
              if (!parsed) {
                parsed = new Date(value);
              }
              
              value = !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : null;
            } else {
              value = null;
            }
          } else if (field === 'municipio' || field === 'tipologia') {
            // Campos de texto obrigatórios
            value = value !== null && value !== undefined ? String(value).trim() : '';
          } else {
            value = value !== null && value !== undefined ? String(value).trim() : '';
          }

            course[field] = value;
          });
          
          // Add additional columns as extra info
          additionalColsToInclude.forEach(col => {
            const colIndex = fileColumns.indexOf(col);
            if (colIndex >= 0 && row[colIndex] !== null && row[colIndex] !== undefined && row[colIndex] !== '') {
              course.additionalInfo[col] = String(row[colIndex]).trim();
            }
          });

          return course;
        });

        const validCourses = newCourses.filter(c => c.lote !== null && c.lote > 0);
        const invalidCount = newCourses.length - validCourses.length;
        
        if (validCourses.length === 0) {
          showToast('Nenhum curso possui um número de lote válido. Verifique se a coluna "Lote" está mapeada corretamente.', 'error');
          backToStep2();
          return;
        }

        courses = [...courses, ...validCourses];
        filteredCourses = [...courses];
        
        // Log da ação
        logAction('Importação de Planilha', {
          totalRows: uploadedData.length,
          validCourses: validCourses.length,
          invalidCount: invalidCount,
          lots: [...new Set(validCourses.map(c => c.lote))].sort((a, b) => a - b)
        });
        
        saveToStorage();
        updateFilters();
        renderAll();
        closeImportModal();
        
        let message = `${validCourses.length} curso(s) importado(s) com sucesso!`;
        if (invalidCount > 0) {
          message += ` ${invalidCount} curso(s) foram ignorados por não terem um lote válido.`;
        }
        showToast(message, invalidCount > 0 ? 'warning' : 'success', 5000);
      } catch (error) {
        console.error('Erro ao importar planilha:', error);
        showToast('Erro ao importar planilha. Verifique o console para mais detalhes.', 'error');
        
        // Tentar correção automática
        try {
          showToast('Tentando corrigir automaticamente...', 'info');
          autoFixDataErrors();
        } catch (fixError) {
          console.error('Erro na correção automática:', fixError);
        }
      }
    }

    // Responsibles Modal Functions
    function openResponsiblesModal(lotNumber) {
      if (!requireEditAccess()) return;
      currentEditLot = lotNumber;
      document.getElementById('modal-lot-name').textContent = `Lote ${lotNumber}`;
      document.getElementById('responsibles-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      renderLotCourseInfo(lotNumber);
      renderResponsiblesList();
      updateUIForLoginStatus(); // Update modal UI
    }
    
    function renderLotCourseInfo(lotNumber) {
      const lotCourses = courses.filter(c => c.lote === lotNumber);
      const infoContent = document.getElementById('lot-course-info-content');
      
      if (lotCourses.length === 0) {
        infoContent.innerHTML = '<p class="text-xs text-muted-foreground">Nenhum curso encontrado neste lote.</p>';
        return;
      }
      
      // Get all unique additional info keys from all courses in the lot
      const allAdditionalInfo = {};
      lotCourses.forEach(course => {
        if (course.additionalInfo && Object.keys(course.additionalInfo).length > 0) {
          Object.assign(allAdditionalInfo, course.additionalInfo);
        }
      });
      
      let html = '';
      
      // Show basic course info
      html += `<div class="grid grid-cols-2 gap-2 mb-3">`;
      html += `<div><span class="font-medium">Total de Cursos:</span> ${lotCourses.length}</div>`;
      html += `<div><span class="font-medium">Tipologias:</span> ${[...new Set(lotCourses.map(c => c.tipologia))].length}</div>`;
      html += `</div>`;
      
      // Show additional info if available
      if (Object.keys(allAdditionalInfo).length > 0) {
        html += `<div class="mt-3 pt-3 border-t border-border">`;
        html += `<p class="text-xs font-medium text-foreground mb-2">Informações Adicionais:</p>`;
        html += `<div class="space-y-1">`;
        Object.keys(allAdditionalInfo).forEach(key => {
          const values = lotCourses
            .map(c => c.additionalInfo && c.additionalInfo[key])
            .filter(v => v)
            .filter((v, i, arr) => arr.indexOf(v) === i); // Unique values
          
          if (values.length > 0) {
            html += `<div><span class="text-xs font-medium">${key}:</span> <span class="text-xs">${values.join(', ')}</span></div>`;
          }
        });
        html += `</div></div>`;
      }
      
      infoContent.innerHTML = html || '<p class="text-xs text-muted-foreground">Nenhuma informação adicional disponível.</p>';
    }

    function closeResponsiblesModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('responsibles-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      document.getElementById('resp-name').value = '';
      document.getElementById('resp-cargo').value = '';
      document.getElementById('resp-phone').value = '55';
      currentEditLot = null;
      window.editingResponsibleId = null; // Cancel any ongoing edit
    }

    function renderResponsiblesList() {
      const responsibles = lotResponsibles[currentEditLot] || [];
      
      if (responsibles.length === 0) {
        document.getElementById('responsibles-list').innerHTML = `
          <p class="text-center text-muted-foreground py-4">Nenhum responsável cadastrado.</p>
        `;
        return;
      }

      document.getElementById('responsibles-list').innerHTML = responsibles.map(r => {
        const isEditing = window.editingResponsibleId === r.id;
        
        if (isEditing) {
          // Modo de edição
          return `
            <div class="bg-secondary/30 border border-primary/50 rounded-lg p-4">
              <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
                  <input type="text" id="edit-resp-name-${r.id}" value="${r.name}" 
                    class="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Cargo</label>
                  <input type="text" id="edit-resp-cargo-${r.id}" value="${r.cargo}" 
                    class="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                </div>
                <div>
                  <label class="block text-xs font-medium text-muted-foreground mb-1">Telefone</label>
                  <input type="tel" id="edit-resp-phone-${r.id}" value="${r.phone}" 
                    class="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                </div>
                <div class="flex items-center gap-2">
                  <button onclick="saveEditResponsible('${r.id}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Salvar
                  </button>
                  <button onclick="cancelEditResponsible()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          `;
        } else {
          // Modo de visualização
          return `
            <div class="bg-secondary/30 border border-border rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <span class="text-primary font-medium">${r.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p class="font-medium text-foreground">${r.name}</p>
                    <p class="text-sm text-muted-foreground">${r.cargo}</p>
                    <p class="text-xs text-muted-foreground">${r.phone}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <a href="https://wa.me/${r.phone.replace(/\D/g, '')}" target="_blank" 
                    class="w-10 h-10 bg-green-600 hover:bg-green-700 rounded-lg flex items-center justify-center transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </a>
                  ${isLoggedIn ? `
                  <button onclick="startEditResponsible('${r.id}')" class="w-10 h-10 bg-blue-600/20 hover:bg-blue-600/40 rounded-lg flex items-center justify-center transition-colors" title="Editar responsável">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onclick="removeResponsible('${r.id}')" class="w-10 h-10 bg-red-600/20 hover:bg-red-600/40 rounded-lg flex items-center justify-center transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }
      }).join('');
    }

    function addResponsible() {
      if (!requireEditAccess()) return;
      const name = document.getElementById('resp-name').value.trim();
      const cargo = document.getElementById('resp-cargo').value.trim();
      const phone = document.getElementById('resp-phone').value.trim();

      if (!name || !cargo || !phone) {
        alert('Preencha todos os campos.');
        return;
      }

      if (!lotResponsibles[currentEditLot]) {
        lotResponsibles[currentEditLot] = [];
      }

      lotResponsibles[currentEditLot].push({
        id: `resp-${Date.now()}`,
        name,
        cargo,
        phone
      });

      document.getElementById('resp-name').value = '';
      document.getElementById('resp-cargo').value = '';
      document.getElementById('resp-phone').value = '55';

      saveToStorage(); // Save after adding responsible
      renderResponsiblesList();
      renderLotSections();
    }

    function removeResponsible(id) {
      if (!requireEditAccess()) return;
      if (!confirm('Deseja remover este responsável?')) return;
      
      lotResponsibles[currentEditLot] = lotResponsibles[currentEditLot].filter(r => r.id !== id);
      saveToStorage(); // Save after removing responsible
      renderResponsiblesList();
      renderLotSections();
    }

    function startEditResponsible(id) {
      if (!requireEditAccess()) return;
      window.editingResponsibleId = id;
      renderResponsiblesList();
    }

    function saveEditResponsible(id) {
      if (!requireEditAccess()) return;
      
      const name = document.getElementById(`edit-resp-name-${id}`).value.trim();
      const cargo = document.getElementById(`edit-resp-cargo-${id}`).value.trim();
      const phone = document.getElementById(`edit-resp-phone-${id}`).value.trim();

      if (!name || !cargo || !phone) {
        alert('Preencha todos os campos.');
        return;
      }

      const responsibleIndex = lotResponsibles[currentEditLot].findIndex(r => r.id === id);
      if (responsibleIndex !== -1) {
        lotResponsibles[currentEditLot][responsibleIndex].name = name;
        lotResponsibles[currentEditLot][responsibleIndex].cargo = cargo;
        lotResponsibles[currentEditLot][responsibleIndex].phone = phone;
        
        saveToStorage(); // Save after editing responsible
        window.editingResponsibleId = null;
        renderResponsiblesList();
        renderLotSections();
      }
    }

    function cancelEditResponsible() {
      window.editingResponsibleId = null;
      renderResponsiblesList();
    }

    function downloadLotPDF(lotNumber) {
      const { jsPDF } = window.jspdf;
      const lotCourses = courses.filter(c => c.lote === lotNumber);
      const responsibles = lotResponsibles[lotNumber] || [];
      
      if (lotCourses.length === 0) {
        alert('Nenhum curso encontrado neste lote.');
        return;
      }
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = margin;
      
      // Título
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(`Lote ${lotNumber}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Informações gerais
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(`Total de Cursos: ${lotCourses.length}`, margin, yPos);
      yPos += 8;
      doc.text(`Responsáveis: ${responsibles.length}`, margin, yPos);
      yPos += 15;
      
      // Tabela de cursos
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Cursos do Lote:', margin, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      // Cabeçalhos da tabela (ajustados para modo retrato)
      const headers = ['ID', 'Tipologia', 'C.H.', 'Município', 'Cozinha', 'Status'];
      const colWidths = [18, 50, 18, 30, 35, 19];
      let xPos = margin;
      
      doc.setFont(undefined, 'bold');
      headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
      });
      yPos += 8;
      
      // Linhas dos cursos
      doc.setFont(undefined, 'normal');
      lotCourses.forEach(course => {
        // Verifica se precisa de nova página
        if (yPos > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          yPos = margin;
        }
        
        xPos = margin;
        const rowData = [
          course.idCurso || '-',
          course.tipologia || '-',
          course.cargaHoraria ? `${course.cargaHoraria}h` : '-',
          course.municipio || '-',
          course.cozinha || '-',
          course.status || 'Pendente'
        ];
        
        rowData.forEach((data, i) => {
          // Ajustar tamanho do texto baseado na coluna (modo retrato)
          let maxLength = 1000; // Valor muito alto para não truncar por padrão
          if (i === 0) maxLength = 10; // ID
          else if (i === 1) maxLength = 30; // Tipologia - pode quebrar linha
          else if (i === 4) maxLength = 1000; // Cozinha - sem truncamento, pode quebrar linha
          else if (i === 3) maxLength = 20; // Município
          else if (i === 5) maxLength = 15; // Status
          
          let text = String(data);
          // Apenas truncar se exceder o limite (exceto para cozinha e tipologia que quebram linha)
          if (text.length > maxLength && maxLength < 100 && i !== 1 && i !== 4) {
            text = text.substring(0, maxLength - 3) + '...';
          }
          
          // Para tipologia e cozinha, quebrar linha se necessário
          if ((i === 1 || i === 4) && text.length > 20) {
            const lines = doc.splitTextToSize(text, colWidths[i] - 2);
            doc.text(lines, xPos, yPos);
            yPos += (lines.length - 1) * 5; // Ajustar altura se houver múltiplas linhas
          } else {
            doc.text(text, xPos, yPos);
          }
          xPos += colWidths[i];
        });
        yPos += 7;
      });
      
      // Responsáveis
      if (responsibles.length > 0) {
        yPos += 10;
        if (yPos > doc.internal.pageSize.getHeight() - 50) {
          doc.addPage();
          yPos = margin;
        }
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Responsáveis:', margin, yPos);
        yPos += 10;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        responsibles.forEach(resp => {
          if (yPos > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(`${resp.name} - ${resp.cargo}`, margin, yPos);
          yPos += 7;
        });
      }
      
      // Salvar PDF
      doc.save(`Lote-${lotNumber}-${new Date().toISOString().split('T')[0]}.pdf`);
    }
    
    // Baixar todos os lotes em PDF (um único arquivo)
    function downloadAllLotsPDF() {
      if (!requireEditAccess()) return;
      
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
        alert('Biblioteca jsPDF não carregada. Por favor, recarregue a página.');
        return;
      }
      
      const lots = [...new Set(courses.map(c => c.lote))].sort((a, b) => a - b);
      
      if (lots.length === 0) {
        alert('Nenhum lote encontrado.');
        return;
      }
      
      showToast('Gerando PDF...', 'info');
      
      // Criar um único PDF com todas as páginas
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const headerHeight = 40;
      
      // Função auxiliar para desenhar cabeçalho de página
      function drawPageHeader(doc, lotNumber, pageNum, totalPages) {
        // Título sem barra azul
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(20);
        doc.setFont(undefined, 'bold');
        doc.text(`Lote ${lotNumber}`, margin, 20);
        
        // Data de geração e número da página
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 15, { align: 'right' });
        
        if (totalPages > 1) {
          doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, 25, { align: 'right' });
        }
        
        doc.setTextColor(0, 0, 0);
      }
      
      // Função auxiliar para desenhar tabela de cursos
      function drawCoursesTable(doc, lotCourses, startY) {
        const headers = ['ID', 'Tipologia', 'C.H.', 'Início', 'Fim', 'Município', 'Cozinha', 'Status', 'Concludentes'];
        // Ajustar larguras para caber tudo na página
        const colWidths = [20, 58, 18, 28, 28, 32, 32, 24, 22];
        let yPos = startY;
        let xPos = margin;
        
        // Cabeçalho da tabela com fundo
        doc.setFillColor(245, 245, 247);
        doc.rect(margin, yPos - 8, pageWidth - (margin * 2), 10, 'F');
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        headers.forEach((header, i) => {
          doc.text(header, xPos, yPos);
          xPos += colWidths[i];
        });
        yPos += 8;
        
        // Linha divisória do cabeçalho
        doc.setDrawColor(0, 122, 255);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        // Linhas dos cursos
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        lotCourses.forEach((course, index) => {
          // Fundo alternado para linhas
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 7, 'F');
          }
          
          xPos = margin;
          const rowData = [
            course.idCurso || '-',
            course.tipologia || '-',
            course.cargaHoraria ? `${course.cargaHoraria}h` : '-',
            course.dataInicio ? (formatDate(course.dataInicio) || '-') : '-',
            course.dataFim ? (formatDate(course.dataFim) || '-') : '-',
            course.municipio || '-',
            course.cozinha || '-',
            course.status || 'Pendente',
            (course.concludentes !== null && course.concludentes !== undefined) ? String(course.concludentes) : '-'
          ];
          
          rowData.forEach((data, i) => {
            let text = String(data || '-');
            // Quebrar linha para tipologia se necessário
            if (i === 1 && text.length > 30) {
              const lines = doc.splitTextToSize(text, colWidths[i] - 3);
              doc.text(lines, xPos, yPos);
              yPos += (lines.length - 1) * 4;
            } else {
              // Truncar se muito longo
              if (text.length > 22 && i !== 1) {
                text = text.substring(0, 19) + '...';
              }
              doc.text(text, xPos, yPos);
            }
            xPos += colWidths[i];
          });
          yPos += 7;
          
          // Linha divisória entre linhas (mais sutil)
          doc.setDrawColor(240, 240, 240);
          doc.setLineWidth(0.1);
          doc.line(margin, yPos - 0.5, pageWidth - margin, yPos - 0.5);
        });
        
        return yPos;
      }
      
      // Processar cada lote
      lots.forEach((lotNumber, lotIndex) => {
        const lotCourses = courses.filter(c => c.lote === lotNumber);
        const responsibles = lotResponsibles[lotNumber] || [];
        
        // Adicionar nova página para cada lote (exceto o primeiro)
        if (lotIndex > 0) {
          doc.addPage();
        }
        
        let pageNum = 1;
        let totalPages = 1;
        
        // Desenhar cabeçalho
        drawPageHeader(doc, lotNumber, pageNum, totalPages);
        
        let yPos = 35;
        
        // Calcular quantas páginas serão necessárias
        const estimatedRowsPerPage = Math.floor((pageHeight - yPos - 25) / 6);
        totalPages = Math.ceil(lotCourses.length / estimatedRowsPerPage) || 1;
        
        // Informações gerais (sem caixa destacada para economizar espaço)
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(`Total de Cursos: ${lotCourses.length}`, margin, yPos);
        doc.text(`Responsáveis: ${responsibles.length}`, margin, yPos + 6);
        yPos += 15;
        
        // Responsáveis (compacto)
        if (responsibles.length > 0) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.text('Responsáveis:', margin, yPos);
          yPos += 7;
          
          doc.setFont(undefined, 'normal');
          doc.setFontSize(9);
          responsibles.forEach((resp, idx) => {
            if (yPos > pageHeight - 20) {
              doc.addPage();
              drawPageHeader(doc, lotNumber, pageNum, totalPages);
              yPos = 35;
            }
            doc.text(`${resp.name} - ${resp.cargo}`, margin + 5, yPos);
            if (resp.phone) {
              doc.setFontSize(8);
              doc.setTextColor(100, 100, 100);
              doc.text(`Tel: ${resp.phone}`, margin + 5, yPos + 4);
              doc.setFontSize(9);
              doc.setTextColor(0, 0, 0);
              yPos += 7;
            } else {
              yPos += 5;
            }
          });
          yPos += 8;
        }
        
        // Tabela de cursos
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Cursos do Lote:', margin, yPos);
        yPos += 8;
        
        // Desenhar tabela (pode precisar de múltiplas páginas)
        let courseIndex = 0;
        while (courseIndex < lotCourses.length) {
          // Verificar se precisa de nova página antes de desenhar
          if (yPos > pageHeight - 40 && courseIndex > 0) {
            doc.addPage();
            pageNum++;
            drawPageHeader(doc, lotNumber, pageNum, totalPages);
            yPos = 35;
          }
          
          const remainingSpace = pageHeight - yPos - 25;
          const rowsThatFit = Math.floor(remainingSpace / 6);
          const coursesForPage = lotCourses.slice(courseIndex, courseIndex + Math.min(rowsThatFit, estimatedRowsPerPage));
          
          if (coursesForPage.length > 0) {
            yPos = drawCoursesTable(doc, coursesForPage, yPos);
            courseIndex += coursesForPage.length;
          } else {
            // Se não cabe nenhum curso, forçar nova página
            doc.addPage();
            pageNum++;
            drawPageHeader(doc, lotNumber, pageNum, totalPages);
            yPos = 35;
          }
        }
      });
      
      // Salvar PDF único
      const fileName = `Todos-Lotes-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      showToast('PDF gerado com sucesso!', 'success');
    }

    // Variável para armazenar cursos selecionados para o cronograma
    let selectedCronogramaCourses = [];

    // Abrir modal de seleção de cursos para cronograma mensal
    function openCronogramaMesAtualModal() {
      if (!requireEditAccess()) return;

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // Filtrar cursos do mês atual (mesma lógica da função original)
      const monthCourses = courses.filter(course => {
        const inicioDate = course.dataInicio ? new Date(course.dataInicio) : null;
        const fimDate = course.dataFim ? new Date(course.dataFim) : null;
        const normalizedStatus = normalizeStatus(course.status || '');
        
        // Cursos que iniciam no mês atual (mesmo que terminem em outro mês)
        if (inicioDate && inicioDate.getMonth() === currentMonth && inicioDate.getFullYear() === currentYear) {
          return true;
        }
        
        // Cursos que terminam no mês atual (mesmo que tenham iniciado em outro mês)
        if (fimDate && fimDate.getMonth() === currentMonth && fimDate.getFullYear() === currentYear) {
          return true;
        }
        
        // Cursos em andamento que passam pelo mês atual
        if (inicioDate && fimDate && normalizedStatus.includes('andamento')) {
          const inicioMonth = inicioDate.getMonth();
          const inicioYear = inicioDate.getFullYear();
          const fimMonth = fimDate.getMonth();
          const fimYear = fimDate.getFullYear();
          
          const inicioBeforeOrDuring = (inicioYear < currentYear) || 
                                      (inicioYear === currentYear && inicioMonth <= currentMonth);
          const fimDuringOrAfter = (fimYear > currentYear) || 
                                   (fimYear === currentYear && fimMonth >= currentMonth);
          
          if (inicioBeforeOrDuring && fimDuringOrAfter) {
            return true;
          }
        }
        
        // Cursos com turmas formadas (sem datas)
        if (isTurmaFechada(course) && !course.dataInicio && !course.dataFim) {
          return true;
        }
        
        return false;
      });

      if (monthCourses.length === 0) {
        alert('Nenhum curso encontrado para o mês atual.');
        return;
      }

      // Inicializar todos os cursos como selecionados
      selectedCronogramaCourses = monthCourses.map(c => c.id);

      // Preencher lista de cursos
      const listContainer = document.getElementById('cronograma-courses-list');
      listContainer.innerHTML = monthCourses.map(course => {
        const inicioDate = course.dataInicio ? formatDate(course.dataInicio) : '-';
        const fimDate = course.dataFim ? formatDate(course.dataFim) : '-';
        return `
          <label class="flex items-start gap-3 p-3 bg-secondary/30 hover:bg-secondary/50 rounded-lg cursor-pointer transition-colors">
            <input type="checkbox" 
                   class="mt-1 w-5 h-5 text-primary border-border rounded focus:ring-primary" 
                   value="${course.id}"
                   checked
                   onchange="updateCronogramaSelectedCount()">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-semibold text-foreground">${course.idCurso || '-'}</span>
                <span class="text-sm text-muted-foreground">-</span>
                <span class="font-medium text-foreground">${course.tipologia || '-'}</span>
              </div>
              <div class="text-sm text-muted-foreground">
                <p>Município: ${course.municipio || '-'}</p>
                <p>Início: ${inicioDate} | Fim: ${fimDate}</p>
                <p>Status: ${course.status || 'Pendente'}</p>
              </div>
            </div>
          </label>
        `;
      }).join('');

      updateCronogramaSelectedCount();
      document.getElementById('cronograma-mes-atual-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeCronogramaMesAtualModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('cronograma-mes-atual-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      selectedCronogramaCourses = [];
    }

    function selectAllCronogramaCourses() {
      const checkboxes = document.querySelectorAll('#cronograma-courses-list input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = true;
        if (!selectedCronogramaCourses.includes(cb.value)) {
          selectedCronogramaCourses.push(cb.value);
        }
      });
      updateCronogramaSelectedCount();
    }

    function deselectAllCronogramaCourses() {
      const checkboxes = document.querySelectorAll('#cronograma-courses-list input[type="checkbox"]');
      checkboxes.forEach(cb => {
        cb.checked = false;
      });
      selectedCronogramaCourses = [];
      updateCronogramaSelectedCount();
    }

    function updateCronogramaSelectedCount() {
      const checkboxes = document.querySelectorAll('#cronograma-courses-list input[type="checkbox"]');
      selectedCronogramaCourses = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      
      const countElement = document.getElementById('cronograma-selected-count');
      if (countElement) {
        countElement.textContent = `${selectedCronogramaCourses.length} curso${selectedCronogramaCourses.length !== 1 ? 's' : ''} selecionado${selectedCronogramaCourses.length !== 1 ? 's' : ''}`;
      }
    }

    function generateCronogramaMesAtualPDF() {
      if (selectedCronogramaCourses.length === 0) {
        alert('Selecione pelo menos um curso para gerar o PDF.');
        return;
      }

      // Filtrar apenas os cursos selecionados
      const selectedCourses = courses.filter(c => selectedCronogramaCourses.includes(c.id));
      
      closeCronogramaMesAtualModal();
      downloadCronogramaMesAtualPDF(selectedCourses);
    }

    // Baixar cronograma do mês atual em PDF
    function downloadCronogramaMesAtualPDF(selectedCourses = null) {
      if (!requireEditAccess()) return;
      
      const { jsPDF } = window.jspdf;
      if (!jsPDF) {
        alert('Biblioteca jsPDF não carregada. Por favor, recarregue a página.');
        return;
      }
      
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      // Usar cursos selecionados ou filtrar todos do mês atual
      let monthCourses;
      if (selectedCourses && selectedCourses.length > 0) {
        monthCourses = selectedCourses;
      } else {
        // Filtrar cursos do mês atual
        monthCourses = courses.filter(course => {
        const inicioDate = course.dataInicio ? new Date(course.dataInicio) : null;
        const fimDate = course.dataFim ? new Date(course.dataFim) : null;
        const normalizedStatus = normalizeStatus(course.status || '');
        
        // Cursos que iniciam no mês atual (mesmo que terminem em outro mês)
        if (inicioDate && inicioDate.getMonth() === currentMonth && inicioDate.getFullYear() === currentYear) {
          return true;
        }
        
        // Cursos que terminam no mês atual (mesmo que tenham iniciado em outro mês)
        if (fimDate && fimDate.getMonth() === currentMonth && fimDate.getFullYear() === currentYear) {
          return true;
        }
        
        // Cursos em andamento que passam pelo mês atual
        // (iniciaram antes ou durante o mês e terminam durante ou depois do mês)
        if (inicioDate && fimDate && normalizedStatus.includes('andamento')) {
          const inicioMonth = inicioDate.getMonth();
          const inicioYear = inicioDate.getFullYear();
          const fimMonth = fimDate.getMonth();
          const fimYear = fimDate.getFullYear();
          
          // Verifica se o curso está ativo durante o mês atual
          const inicioBeforeOrDuring = (inicioYear < currentYear) || 
                                      (inicioYear === currentYear && inicioMonth <= currentMonth);
          const fimDuringOrAfter = (fimYear > currentYear) || 
                                   (fimYear === currentYear && fimMonth >= currentMonth);
          
          if (inicioBeforeOrDuring && fimDuringOrAfter) {
            return true;
          }
        }
        
        // Cursos com turmas formadas (sem datas)
        if (isTurmaFechada(course) && !course.dataInicio && !course.dataFim) {
          return true;
        }
        
        return false;
        });
      }
      
      if (monthCourses.length === 0) {
        alert('Nenhum curso encontrado para o mês atual.');
        return;
      }
      
      showToast('Gerando PDF do cronograma...', 'info');
      
      // Criar PDF vertical
      const doc = new jsPDF('portrait');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      
      // Cabeçalho
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      const monthName = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      doc.text(`Cronograma - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`, margin, 20);
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 15, { align: 'right' });
      
      let yPos = 35;
      
      // Separar cursos a iniciar e a finalizar
      const cursosAIniciar = [];
      const cursosAFinalizar = [];
      
      monthCourses.forEach(course => {
        const normalizedStatus = normalizeStatus(course.status || '');
        const inicioDate = course.dataInicio ? new Date(course.dataInicio + 'T00:00:00') : null;
        const fimDate = course.dataFim ? new Date(course.dataFim + 'T00:00:00') : null;
        
        const iniciaNoMes = inicioDate && inicioDate.getMonth() === currentMonth && inicioDate.getFullYear() === currentYear;
        const terminaNoMes = fimDate && fimDate.getMonth() === currentMonth && fimDate.getFullYear() === currentYear;
        
        // Determinar se termina em outro mês (mas iniciou no mês atual)
        let terminaEmOutroMes = false;
        if (inicioDate && fimDate && iniciaNoMes) {
          const fimMonth = fimDate.getMonth();
          const fimYear = fimDate.getFullYear();
          terminaEmOutroMes = (fimYear !== currentYear) || (fimYear === currentYear && fimMonth !== currentMonth);
        }
        
        // Cursos a iniciar: 
        // - Com turma formada sem data
        // - Que iniciam no mês atual (mesmo que terminem em outro mês)
        if (isTurmaFechada(course) && !course.dataInicio && !course.dataFim) {
          cursosAIniciar.push(course);
        } else if (iniciaNoMes) {
          cursosAIniciar.push(course);
        }
        
        // Cursos a finalizar: 
        // 1. Cursos que terminam no mês atual (mesmo que tenham iniciado em outro mês)
        // 2. Cursos que iniciaram no mês atual mas terminam em outro mês
        if (terminaNoMes || terminaEmOutroMes) {
          cursosAFinalizar.push(course);
        }
      });
      
      // Cursos a Iniciar
      if (cursosAIniciar.length > 0) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Cursos a Iniciar:', margin, yPos);
        yPos += 10;
        
        // Cabeçalho da tabela
        doc.setFillColor(245, 245, 247);
        doc.rect(margin, yPos - 8, pageWidth - (margin * 2), 10, 'F');
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const headers = ['ID do Curso', 'Tipologia', 'Município', 'Data de Início'];
        const colWidths = [30, 80, 40, 40];
        let xPos = margin;
        headers.forEach((header, i) => {
          doc.text(header, xPos, yPos);
          xPos += colWidths[i];
        });
        yPos += 8;
        
        // Linha divisória
        doc.setDrawColor(0, 122, 255);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        // Dados
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        cursosAIniciar.forEach((course, index) => {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 35;
          }
          
          // Fundo alternado
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 7, 'F');
          }
          
          xPos = margin;
          const rowData = [
            course.idCurso || '-',
            course.tipologia || '-',
            course.municipio || '-',
            course.dataInicio ? formatDate(course.dataInicio) : '-'
          ];
          
          rowData.forEach((data, i) => {
            let text = String(data || '-');
            if (i === 1 && text.length > 30) {
              const lines = doc.splitTextToSize(text, colWidths[i] - 3);
              doc.text(lines, xPos, yPos);
              yPos += (lines.length - 1) * 4;
            } else {
              if (text.length > 20 && i !== 1) {
                text = text.substring(0, 17) + '...';
              }
              doc.text(text, xPos, yPos);
            }
            xPos += colWidths[i];
          });
          yPos += 7;
          
          // Linha divisória
          doc.setDrawColor(240, 240, 240);
          doc.setLineWidth(0.1);
          doc.line(margin, yPos - 0.5, pageWidth - margin, yPos - 0.5);
        });
        yPos += 10;
      }
      
      // Cursos a Finalizar
      if (cursosAFinalizar.length > 0) {
        if (yPos > pageHeight - 50) {
          doc.addPage();
          yPos = 35;
        }
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Cursos a Finalizar:', margin, yPos);
        yPos += 10;
        
        // Cabeçalho da tabela
        doc.setFillColor(245, 245, 247);
        doc.rect(margin, yPos - 8, pageWidth - (margin * 2), 10, 'F');
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const headers = ['ID do Curso', 'Tipologia', 'Município', 'Data de Final'];
        const colWidths = [30, 80, 40, 40];
        let xPos = margin;
        headers.forEach((header, i) => {
          doc.text(header, xPos, yPos);
          xPos += colWidths[i];
        });
        yPos += 8;
        
        // Linha divisória
        doc.setDrawColor(0, 122, 255);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        // Dados
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        cursosAFinalizar.forEach((course, index) => {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 35;
          }
          
          // Fundo alternado
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 7, 'F');
          }
          
          xPos = margin;
          const rowData = [
            course.idCurso || '-',
            course.tipologia || '-',
            course.municipio || '-',
            course.dataFim ? formatDate(course.dataFim) : '-'
          ];
          
          rowData.forEach((data, i) => {
            let text = String(data || '-');
            if (i === 1 && text.length > 30) {
              const lines = doc.splitTextToSize(text, colWidths[i] - 3);
              doc.text(lines, xPos, yPos);
              yPos += (lines.length - 1) * 4;
            } else {
              if (text.length > 20 && i !== 1) {
                text = text.substring(0, 17) + '...';
              }
              doc.text(text, xPos, yPos);
            }
            xPos += colWidths[i];
          });
          yPos += 7;
          
          // Linha divisória
          doc.setDrawColor(240, 240, 240);
          doc.setLineWidth(0.1);
          doc.line(margin, yPos - 0.5, pageWidth - margin, yPos - 0.5);
        });
      }
      
      // Salvar PDF
      const fileName = `Cronograma-${monthName.replace(' ', '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      showToast('PDF do cronograma gerado com sucesso!', 'success');
    }

    // Variáveis globais para cronograma, calendário e notificações (serão inicializadas)
    let calendarEvents = [];
    let calendarTasks = [];
    let notifications = [];
    
    // Inicializar calendário ao carregar
    function initCalendar() {
      try {
        calendarEvents = JSON.parse(localStorage.getItem(STORAGE_KEY_CALENDAR_EVENTS)) || [];
        calendarTasks = JSON.parse(localStorage.getItem(STORAGE_KEY_CALENDAR_TASKS)) || [];
      } catch (e) {
        calendarEvents = [];
        calendarTasks = [];
      }
    }

    // Variável para controlar visualização do cronograma
    let cronogramaViewMode = 'grid';
    
    function setCronogramaView(mode) {
      cronogramaViewMode = mode;
      const gridBtn = document.getElementById('view-grid-btn');
      const timelineBtn = document.getElementById('view-timeline-btn');
      const gridContainer = document.getElementById('cronograma-cards');
      const timelineContainer = document.getElementById('cronograma-timeline');
      
      if (mode === 'grid') {
        gridBtn.classList.add('bg-[#007AFF]', 'text-white');
        gridBtn.classList.remove('bg-[rgba(0,0,0,0.05)]', 'text-[#1d1d1f]');
        timelineBtn.classList.remove('bg-[#007AFF]', 'text-white');
        timelineBtn.classList.add('bg-[rgba(0,0,0,0.05)]', 'dark:bg-[rgba(255,255,255,0.1)]', 'text-[#1d1d1f]', 'dark:text-[#f5f5f7]');
        if (gridContainer) gridContainer.classList.remove('hidden');
        if (timelineContainer) timelineContainer.classList.add('hidden');
      } else {
        timelineBtn.classList.add('bg-[#007AFF]', 'text-white');
        timelineBtn.classList.remove('bg-[rgba(0,0,0,0.05)]', 'text-[#1d1d1f]');
        gridBtn.classList.remove('bg-[#007AFF]', 'text-white');
        gridBtn.classList.add('bg-[rgba(0,0,0,0.05)]', 'dark:bg-[rgba(255,255,255,0.1)]', 'text-[#1d1d1f]', 'dark:text-[#f5f5f7]');
        if (gridContainer) gridContainer.classList.add('hidden');
        if (timelineContainer) timelineContainer.classList.remove('hidden');
      }
      
      filterCronograma();
    }

    // Renderizar Cronograma
    function getFilteredCronogramaCourses() {
      const sortedCourses = sortCronogramaCourses(courses);
      const searchTerm = document.getElementById('cronograma-search')?.value.toLowerCase() || '';
      if (!searchTerm) return sortedCourses;
      return sortedCourses.filter(course => {
        const id = (course.idCurso || '').toLowerCase();
        const tipologia = (course.tipologia || '').toLowerCase();
        const municipio = (course.municipio || '').toLowerCase();
        return id.includes(searchTerm) || tipologia.includes(searchTerm) || municipio.includes(searchTerm);
      });
    }

    function renderCronograma() {
      const filteredCourses = courses.length === 0 ? [] : getFilteredCronogramaCourses();
      renderCronogramaPrioritySection(filteredCourses);

      if (cronogramaViewMode === 'timeline') {
        renderCronogramaTimeline(filteredCourses);
      } else {
        renderCronogramaGrid(filteredCourses);
      }
    }
    
    function renderCronogramaCardHtml(course, options = {}) {
      const statusClass = getStatusClass(course.status);
      const highlight = !!options.highlight;

      return `
          <div class="card-elegant rounded-[20px] p-5 cursor-pointer hover:scale-[1.02] transition-all duration-200 ${highlight ? 'ring-2 ring-[#007AFF]/30' : ''}" onclick="openCronogramaCourseModal('${course.id}')">
            <div class="space-y-3">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-base line-clamp-2 flex-1" style="letter-spacing: -0.01em;">${course.tipologia}</h3>
                    ${userRole === 'admin' ? `
                      <button onclick="event.stopPropagation(); toggleTurmaFormada('${course.id}')" class="relative opacity-70 hover:opacity-100 transition-opacity" title="${isTurmaFechada(course) ? 'Turma formada - Clique para desmarcar' : 'Marcar turma formada'}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ${isTurmaFechada(course) ? 'text-[#007AFF]' : 'text-[#8e8e93]'}" fill="${isTurmaFechada(course) ? '#007AFF' : '#8e8e93'}" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.08));">
                          <path d="M3 21l9-18 9 18H3z"/>
                        </svg>
                      </button>
                    ` : ''}
                  </div>
                  <p class="text-xs text-[#8e8e93] font-mono">ID: ${course.idCurso || '-'}</p>
                </div>
                <span class="status-badge ${statusClass}">${course.status || 'Pendente'}</span>
              </div>

              <div class="space-y-2 text-sm">
                <div class="flex items-center gap-2 text-[#8e8e93]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Lote ${course.lote}</span>
                </div>
                <div class="flex items-center gap-2 text-[#8e8e93]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="truncate">${course.municipio}</span>
                </div>
                <div class="flex items-center gap-2 text-[#8e8e93]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>${course.cargaHoraria || '-'}h</span>
                </div>
                ${course.dataInicio ? `
                <div class="flex items-center gap-2 text-[#8e8e93]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span class="text-xs">${formatDate(course.dataInicio)} - ${course.dataFim ? formatDate(course.dataFim) : '?'}</span>
                </div>
                ` : ''}
                ${course.concludentes !== null ? `
                <div class="flex items-center gap-2 text-[#8e8e93]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>${course.concludentes} concludentes</span>
                </div>
                ` : ''}
                ${course.turno ? `
                <div class="flex items-center gap-2 text-[#8e8e93]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Turno: ${course.turno}</span>
                </div>
                ` : ''}
              </div>

              ${isLoggedIn ? `
              <div class="flex gap-2 pt-2 border-t border-[rgba(0,0,0,0.1)] dark:border-[rgba(255,255,255,0.1)]">
                <button onclick="event.stopPropagation(); openDriveLink('${course.id}', 'album')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[rgba(0,122,255,0.1)] hover:bg-[rgba(0,122,255,0.2)] text-[#007AFF] rounded-[10px] transition-colors text-xs font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Álbum
                </button>
                <button onclick="event.stopPropagation(); openDriveLink('${course.id}', 'instrumentais')" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[rgba(52,199,89,0.1)] hover:bg-[rgba(52,199,89,0.2)] text-[#34C759] rounded-[10px] transition-colors text-xs font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Instrumentais
                </button>
              </div>
              ` : ''}
            </div>
          </div>
        `;
    }

    function renderCronogramaPrioritySection(coursesList) {
      const priorityEl = document.getElementById('cronograma-priority');
      if (!priorityEl) return;

      const turmasFormadas = sortCoursesByStartDate(coursesList.filter(isTurmaFechada));
      const emAndamento = sortCoursesByStartDate(
        coursesList.filter(c => !isTurmaFechada(c) && isCourseEmAndamento(c) && !isCourseConcluido(c))
      );
      const emBreve = sortCoursesByStartDate(
        coursesList.filter(c => !isTurmaFechada(c) && !isCourseEmAndamento(c) && isCourseEmBreve(c))
      );

      const sections = [];

      if (turmasFormadas.length > 0) {
        sections.push(`
          <div class="card-elegant rounded-[20px] p-5 ring-2 ring-[#007AFF]/25">
            <h3 class="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#007AFF]"></span>
              Turmas formadas
            </h3>
            <p class="text-sm text-muted-foreground mb-4">Prioridade máxima — turmas com flag de turma formada</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              ${turmasFormadas.map(course => renderCronogramaCardHtml(course, { highlight: true })).join('')}
            </div>
          </div>
        `);
      }

      if (emAndamento.length > 0) {
        sections.push(`
          <div class="card-elegant rounded-[20px] p-5">
            <h3 class="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#34C759]"></span>
              Em andamento
            </h3>
            <p class="text-sm text-muted-foreground mb-4">Ordenadas por data de início</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              ${emAndamento.map(course => renderCronogramaCardHtml(course, { highlight: true })).join('')}
            </div>
          </div>
        `);
      }

      if (emBreve.length > 0) {
        sections.push(`
          <div class="card-elegant rounded-[20px] p-5">
            <h3 class="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#FF9500]"></span>
              Em breve
            </h3>
            <p class="text-sm text-muted-foreground mb-4">Ordenadas por data de início</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              ${emBreve.map(course => renderCronogramaCardHtml(course, { highlight: true })).join('')}
            </div>
          </div>
        `);
      }

      if (sections.length === 0) {
        priorityEl.classList.add('hidden');
        priorityEl.innerHTML = '';
        return;
      }

      priorityEl.classList.remove('hidden');
      priorityEl.innerHTML = sections.join('');
    }

    function renderCronogramaGrid(filteredCourses) {
      const container = document.getElementById('cronograma-cards');
      if (!container) return;

      if (courses.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center py-16">
            <div class="w-20 h-20 bg-[rgba(142,142,147,0.1)] rounded-[20px] flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-[#8e8e93]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2" style="letter-spacing: -0.02em;">Nenhum curso cadastrado</p>
            <p class="text-sm text-[#8e8e93]">Importe uma planilha ou adicione cursos manualmente</p>
          </div>
        `;
        return;
      }

      if (!filteredCourses || filteredCourses.length === 0) {
        container.innerHTML = `
          <div class="col-span-full text-center py-16">
            <p class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">Nenhum curso encontrado</p>
            <p class="text-sm text-[#8e8e93]">Tente ajustar sua pesquisa</p>
          </div>
        `;
        return;
      }

      const groupBy = document.getElementById('cronograma-group-by')?.value || 'none';
      const otherCourses = filteredCourses.filter(c => !isCronogramaPriorityCourse(c));

      if (groupBy !== 'none') {
        container.innerHTML = otherCourses.length > 0
          ? renderGroupedCourses(otherCourses, groupBy)
          : (filteredCourses.some(isCronogramaPriorityCourse)
            ? `<div class="col-span-full text-center py-8 text-sm text-[#8e8e93]">Todos os cursos em destaque estão na seção Prioridade acima.</div>`
            : '');
        return;
      }

      let html = '';

      if (otherCourses.length > 0 && filteredCourses.some(isCronogramaPriorityCourse)) {
        html += `<div class="col-span-full mb-2"><h3 class="text-lg font-semibold text-foreground">Demais cursos</h3></div>`;
      }

      html += otherCourses.map(course => renderCronogramaCardHtml(course)).join('');
      container.innerHTML = html || `
        <div class="col-span-full text-center py-8 text-sm text-[#8e8e93]">Todos os cursos em destaque estão na seção Prioridade acima.</div>
      `;
    }

    // Filtrar cronograma
    function filterCronograma() {
      renderCronograma();
    }
    
    // Renderizar cursos agrupados
    function renderGroupedCourses(coursesList, groupBy) {
      const groups = {};
      
      coursesList.forEach(course => {
        let groupKey = '';
        let groupLabel = '';
        
        switch(groupBy) {
          case 'status':
            groupKey = normalizeStatus(course.status || 'Pendente');
            groupLabel = course.status || 'Pendente';
            break;
          case 'lote':
            groupKey = `lote-${course.lote}`;
            groupLabel = `Lote ${course.lote}`;
            break;
          case 'month':
            if (course.dataInicio) {
              const date = new Date(course.dataInicio);
              groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              groupLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            } else {
              groupKey = 'sem-data';
              groupLabel = 'Sem data definida';
            }
            break;
          case 'municipio':
            groupKey = course.municipio || 'sem-municipio';
            groupLabel = course.municipio || 'Sem município';
            break;
        }
        
        if (!groups[groupKey]) {
          groups[groupKey] = { label: groupLabel, courses: [] };
        }
        groups[groupKey].courses.push(course);
      });
      
      // Ordenar grupos
      const sortedGroups = Object.keys(groups).sort((a, b) => {
        if (groupBy === 'month') return b.localeCompare(a);
        if (groupBy === 'lote') {
          const numA = parseInt(a.replace('lote-', ''));
          const numB = parseInt(b.replace('lote-', ''));
          return numA - numB;
        }
        return groups[a].label.localeCompare(groups[b].label);
      });
      
      return sortedGroups.map(groupKey => {
        const group = groups[groupKey];
        const statusClass = groupBy === 'status' ? getStatusClass(group.label) : '';
        
        // Ordenar cursos dentro do grupo: turma formada primeiro
        const sortedGroupCourses = sortCronogramaCourses(group.courses);
        
        return `
          <div class="col-span-full mb-6">
            <div class="card-elegant rounded-[20px] p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-3">
                  ${groupBy === 'status' ? `<span class="status-badge ${statusClass}">${group.label}</span>` : ''}
                  ${groupBy !== 'status' ? group.label : ''}
                  <span class="text-sm font-normal text-[#8e8e93]">(${group.courses.length} curso${group.courses.length !== 1 ? 's' : ''})</span>
                </h3>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${sortedGroupCourses.map(course => {
                  const statusClass = getStatusClass(course.status);
                  return `
                    <div class="card-secondary rounded-[16px] p-4 cursor-pointer hover:scale-[1.02] transition-all" onclick="openCronogramaCourseModal('${course.id}')">
                      <div class="space-y-2">
                        <div class="flex items-start justify-between">
                          <div class="flex items-center gap-1.5 flex-1">
                            <h4 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm line-clamp-2 flex-1">${course.tipologia}</h4>
                            ${userRole === 'admin' ? `
                              <button onclick="event.stopPropagation(); toggleTurmaFormada('${course.id}')" class="relative opacity-70 hover:opacity-100 transition-opacity flex-shrink-0" title="${isTurmaFechada(course) ? 'Turma formada' : 'Marcar turma formada'}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 ${isTurmaFechada(course) ? 'text-[#007AFF]' : 'text-[#8e8e93]'}" fill="${isTurmaFechada(course) ? '#007AFF' : '#8e8e93'}" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.08));">
                                  <path d="M3 21l9-18 9 18H3z"/>
                                </svg>
                              </button>
                            ` : ''}
                          </div>
                          <span class="status-badge ${statusClass} ml-2">${course.status || 'Pendente'}</span>
                        </div>
                        <p class="text-xs text-[#8e8e93] font-mono">ID: ${course.idCurso || '-'}</p>
                        <div class="text-xs text-[#8e8e93]">
                          <p>Lote ${course.lote} • ${course.municipio || '-'}</p>
                          ${course.dataInicio ? `<p>${formatDate(course.dataInicio)}</p>` : ''}
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    
    // Renderizar cronograma em timeline
    function renderCronogramaTimeline(filteredCourses) {
      const container = document.getElementById('cronograma-timeline');
      if (!container) return;
      
      if (courses.length === 0) {
        container.innerHTML = `
          <div class="text-center py-16">
            <p class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">Nenhum curso cadastrado</p>
            <p class="text-sm text-[#8e8e93]">Importe uma planilha ou adicione cursos manualmente</p>
          </div>
        `;
        return;
      }
      
      if (!filteredCourses || filteredCourses.length === 0) {
        container.innerHTML = `
          <div class="text-center py-16">
            <p class="text-lg font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-2">Nenhum curso encontrado</p>
            <p class="text-sm text-[#8e8e93]">Tente ajustar sua pesquisa</p>
          </div>
        `;
        return;
      }

      const timelineCourses = filteredCourses.filter(c => !isCronogramaPriorityCourse(c));
      if (timelineCourses.length === 0) {
        container.innerHTML = `
          <div class="text-center py-8 text-sm text-[#8e8e93]">Todos os cursos em destaque estão na seção Prioridade acima.</div>
        `;
        return;
      }
      
      // Agrupar por mês/ano
      const groupBy = document.getElementById('cronograma-group-by')?.value || 'month';
      const groups = {};
      const today = new Date();
      
      timelineCourses.forEach(course => {
        let groupKey = '';
        let groupLabel = '';
        let sortKey = '';
        
        switch(groupBy) {
          case 'status':
            groupKey = normalizeStatus(course.status || 'Pendente');
            groupLabel = course.status || 'Pendente';
            sortKey = groupKey;
            break;
          case 'lote':
            groupKey = `lote-${course.lote}`;
            groupLabel = `Lote ${course.lote}`;
            sortKey = String(course.lote).padStart(3, '0');
            break;
          case 'month':
            if (course.dataInicio) {
              const date = new Date(course.dataInicio);
              groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              groupLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
              sortKey = groupKey;
            } else {
              groupKey = 'sem-data';
              groupLabel = 'Sem data definida';
              sortKey = '9999-99';
            }
            break;
          case 'municipio':
            groupKey = course.municipio || 'sem-municipio';
            groupLabel = course.municipio || 'Sem município';
            sortKey = groupLabel;
            break;
          default:
            groupKey = 'all';
            groupLabel = 'Todos os cursos';
            sortKey = '0';
        }
        
        if (!groups[groupKey]) {
          groups[groupKey] = { label: groupLabel, sortKey, courses: [] };
        }
        groups[groupKey].courses.push(course);
      });
      
      // Ordenar grupos
      const sortedGroups = Object.keys(groups).sort((a, b) => {
        if (groupBy === 'month') return groups[b].sortKey.localeCompare(groups[a].sortKey);
        if (groupBy === 'lote') {
          return groups[a].sortKey.localeCompare(groups[b].sortKey);
        }
        return groups[a].sortKey.localeCompare(groups[b].sortKey);
      });
      
      container.innerHTML = sortedGroups.map((groupKey, groupIndex) => {
        const group = groups[groupKey];
        const statusClass = groupBy === 'status' ? getStatusClass(group.label) : '';
        
        group.courses = sortCronogramaCourses(group.courses);
        
        return `
          <div class="mb-8">
            <!-- Cabeçalho do grupo -->
            <div class="flex items-center gap-4 mb-4">
              <div class="flex-1">
                <h3 class="text-xl font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-3">
                  ${groupBy === 'status' ? `<span class="status-badge ${statusClass}">${group.label}</span>` : group.label}
                  <span class="text-sm font-normal text-[#8e8e93]">(${group.courses.length})</span>
                </h3>
              </div>
              <div class="h-px flex-1 bg-gradient-to-r from-[rgba(0,0,0,0.1)] to-transparent dark:from-[rgba(255,255,255,0.1)]"></div>
            </div>
            
            <!-- Timeline -->
            <div class="relative pl-8">
              <!-- Linha vertical da timeline -->
              <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-[rgba(0,122,255,0.2)] dark:bg-[rgba(0,122,255,0.3)]"></div>
              
              ${group.courses.map((course, index) => {
                const statusClass = getStatusClass(course.status);
                const startDate = course.dataInicio ? new Date(course.dataInicio) : null;
                const endDate = course.dataFim ? new Date(course.dataFim) : null;
                const isPast = endDate && endDate < today;
                const isCurrent = startDate && startDate <= today && (!endDate || endDate >= today);
                
                return `
                  <div class="relative mb-6">
                    <!-- Ponto na timeline -->
                    <div class="absolute left-[-29px] top-2 w-6 h-6 rounded-full border-4 border-white dark:border-[#1c1c1e] flex items-center justify-center z-10 ${
                      isCurrent ? 'bg-[#007AFF]' : isPast ? 'bg-[#34C759]' : 'bg-[#FF9500]'
                    }">
                      <div class="w-2 h-2 rounded-full bg-white"></div>
                    </div>
                    
                    <!-- Card do curso -->
                    <div class="card-elegant rounded-[16px] p-5 ml-4 cursor-pointer hover:scale-[1.01] transition-all" onclick="openCronogramaCourseModal('${course.id}')">
                      <div class="flex items-start justify-between gap-4">
                        <div class="flex-1">
                          <div class="flex items-start justify-between mb-2">
                            <div class="flex items-center gap-1.5 flex-1">
                              <h4 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-base flex-1">${course.tipologia}</h4>
                              ${userRole === 'admin' ? `
                                <button onclick="event.stopPropagation(); toggleTurmaFormada('${course.id}')" class="relative opacity-70 hover:opacity-100 transition-opacity flex-shrink-0" title="${isTurmaFechada(course) ? 'Turma formada' : 'Marcar turma formada'}">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 ${isTurmaFechada(course) ? 'text-[#007AFF]' : 'text-[#8e8e93]'}" fill="${isTurmaFechada(course) ? '#007AFF' : '#8e8e93'}" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.08));">
                                    <path d="M3 21l9-18 9 18H3z"/>
                                  </svg>
                                </button>
                              ` : ''}
                            </div>
                            <span class="status-badge ${statusClass}">${course.status || 'Pendente'}</span>
                          </div>
                          <p class="text-xs text-[#8e8e93] font-mono mb-3">ID: ${course.idCurso || '-'}</p>
                          
                          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p class="text-xs text-[#8e8e93] mb-1">Lote</p>
                              <p class="font-medium">${course.lote || '-'}</p>
                            </div>
                            <div>
                              <p class="text-xs text-[#8e8e93] mb-1">Município</p>
                              <p class="font-medium">${course.municipio || '-'}</p>
                            </div>
                            <div>
                              <p class="text-xs text-[#8e8e93] mb-1">Carga Horária</p>
                              <p class="font-medium">${course.cargaHoraria || '-'}h</p>
                            </div>
                            ${startDate ? `
                            <div>
                              <p class="text-xs text-[#8e8e93] mb-1">Período</p>
                              <p class="font-medium text-xs">${formatDate(course.dataInicio)}${endDate ? ` - ${formatDate(course.dataFim)}` : ''}</p>
                            </div>
                            ` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    // Abrir link do Drive
    function openDriveLink(courseId, type) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      const link = type === 'album' ? (course.albumLink || '') : (course.instrumentaisLink || '');
      
      if (link) {
        window.open(link, '_blank');
      } else {
        // Se não tem link, abre modal para adicionar
        openCronogramaCourseModal(courseId);
        setTimeout(() => {
          const inputId = type === 'album' ? 'edit-course-album' : 'edit-course-instrumentais';
          const input = document.getElementById(inputId);
          if (input) {
            input.focus();
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }

    function openCronogramaCourseModal(courseId) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      currentEditCourse = course;
      
      // Preencher informações somente leitura (para usuários não logados)
      document.getElementById('cronograma-course-id').textContent = course.idCurso || '-';
      document.getElementById('cronograma-course-tipologia').textContent = course.tipologia || '-';
      document.getElementById('cronograma-course-lote').textContent = course.lote || '-';
      document.getElementById('cronograma-course-carga').textContent = course.cargaHoraria ? `${course.cargaHoraria}h` : '-';
      document.getElementById('cronograma-course-municipio').textContent = course.municipio || '-';
      document.getElementById('cronograma-course-cozinha').textContent = course.cozinha || '-';
      document.getElementById('cronograma-course-status').textContent = course.status || 'Pendente';
      document.getElementById('cronograma-course-concludentes').textContent = course.concludentes !== null ? course.concludentes : '-';
      document.getElementById('cronograma-course-turno').textContent = course.turno || '-';
      
      // Preencher campos editáveis (para usuários logados)
      document.getElementById('cronograma-edit-id').value = course.idCurso || '';
      document.getElementById('cronograma-edit-tipologia').value = course.tipologia || '';
      document.getElementById('cronograma-edit-carga').value = course.cargaHoraria || '';
      document.getElementById('cronograma-edit-lote').value = course.lote || '';
      document.getElementById('cronograma-edit-municipio').value = course.municipio || '';
      document.getElementById('cronograma-edit-cozinha').value = course.cozinha || '';
      document.getElementById('cronograma-edit-inicio').value = course.dataInicio || '';
      document.getElementById('cronograma-edit-fim').value = course.dataFim || '';
      document.getElementById('cronograma-edit-status').value = course.status || 'Pendente';
      document.getElementById('cronograma-edit-turno').value = course.turno || '';
      document.getElementById('cronograma-edit-concludentes').value = course.concludentes !== null ? course.concludentes : '';
      document.getElementById('cronograma-edit-instrutor').value = course.instrutor || '';
      document.getElementById('cronograma-edit-endereco').value = course.endereco || '';
      document.getElementById('cronograma-edit-album').value = course.albumLink || '';
      document.getElementById('cronograma-edit-instrumentais').value = course.instrumentaisLink || '';

      // Mostrar/ocultar seção de edição
      const editableSection = document.getElementById('cronograma-editable-section');
      const actionsSection = document.getElementById('cronograma-actions');
      const viewOnlySection = document.getElementById('cronograma-view-only');
      const viewOnlyInfoSection = document.getElementById('cronograma-view-only-section');
      
      if (canEditCourses()) {
        editableSection.classList.remove('hidden');
        actionsSection.classList.remove('hidden');
        viewOnlySection.classList.add('hidden');
        if (viewOnlyInfoSection) viewOnlyInfoSection.classList.add('hidden');
      } else {
        editableSection.classList.add('hidden');
        actionsSection.classList.add('hidden');
        viewOnlySection.classList.remove('hidden');
        if (viewOnlyInfoSection) viewOnlyInfoSection.classList.remove('hidden');
      }

      document.getElementById('cronograma-course-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeCronogramaCourseModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('cronograma-course-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
      currentEditCourse = null;
    }

    function deleteCourseFromCronogramaModal() {
      if (!currentEditCourse) return;
      deleteCourse(currentEditCourse.id);
      closeCronogramaCourseModal();
    }

    function saveCronogramaCourse() {
      if (!currentEditCourse || !canEditCourses()) return;

      const courseIndex = courses.findIndex(c => c.id === currentEditCourse.id);
      if (courseIndex === -1) return;

      const hadTurmaFormada = isTurmaFechada(courses[courseIndex]);

      // Guardar valores antigos para log
      const oldValues = {
        idCurso: courses[courseIndex].idCurso,
        tipologia: courses[courseIndex].tipologia,
        cargaHoraria: courses[courseIndex].cargaHoraria,
        lote: courses[courseIndex].lote,
        municipio: courses[courseIndex].municipio,
        cozinha: courses[courseIndex].cozinha,
        dataInicio: courses[courseIndex].dataInicio,
        dataFim: courses[courseIndex].dataFim,
        status: courses[courseIndex].status,
        turno: courses[courseIndex].turno,
        concludentes: courses[courseIndex].concludentes,
        instrutor: courses[courseIndex].instrutor,
        endereco: courses[courseIndex].endereco,
        albumLink: courses[courseIndex].albumLink,
        instrumentaisLink: courses[courseIndex].instrumentaisLink
      };

      // Atualizar todos os campos editáveis
      courses[courseIndex].idCurso = document.getElementById('cronograma-edit-id').value.trim() || null;
      courses[courseIndex].tipologia = document.getElementById('cronograma-edit-tipologia').value.trim() || null;
      courses[courseIndex].cargaHoraria = document.getElementById('cronograma-edit-carga').value ? parseInt(document.getElementById('cronograma-edit-carga').value) : null;
      courses[courseIndex].lote = document.getElementById('cronograma-edit-lote').value ? parseInt(document.getElementById('cronograma-edit-lote').value) : null;
      courses[courseIndex].municipio = document.getElementById('cronograma-edit-municipio').value.trim() || null;
      courses[courseIndex].cozinha = document.getElementById('cronograma-edit-cozinha').value.trim() || null;
      courses[courseIndex].dataInicio = document.getElementById('cronograma-edit-inicio').value || null;
      courses[courseIndex].dataFim = document.getElementById('cronograma-edit-fim').value || null;
      courses[courseIndex].status = document.getElementById('cronograma-edit-status').value;
      courses[courseIndex].turno = document.getElementById('cronograma-edit-turno').value || null;
      courses[courseIndex].concludentes = document.getElementById('cronograma-edit-concludentes').value ? parseInt(document.getElementById('cronograma-edit-concludentes').value) : null;
      courses[courseIndex].instrutor = document.getElementById('cronograma-edit-instrutor').value.trim() || null;
      courses[courseIndex].endereco = document.getElementById('cronograma-edit-endereco').value.trim() || null;
      courses[courseIndex].albumLink = document.getElementById('cronograma-edit-album').value.trim() || null;
      courses[courseIndex].instrumentaisLink = document.getElementById('cronograma-edit-instrumentais').value.trim() || null;
      courses[courseIndex].lastModified = {
        by: currentUser?.email || 'Sistema',
        at: new Date().toISOString()
      };

      updateCourseStatusAutomatically(courses[courseIndex]);
      preserveTurmaFormadaFlag(courses[courseIndex], hadTurmaFormada);

      // Preparar mudanças para log
      const changes = {};
      Object.keys(oldValues).forEach(key => {
        if (oldValues[key] !== courses[courseIndex][key]) {
          changes[key] = { from: oldValues[key], to: courses[courseIndex][key] };
        }
      });

      // Log da ação
      logAction('Edição de Curso (Cronograma)', {
        courseId: currentEditCourse.id,
        idCurso: courses[courseIndex].idCurso,
        tipologia: courses[courseIndex].tipologia,
        changes: changes
      });

      // Atualizar também no filteredCourses
      const filteredIndex = filteredCourses.findIndex(c => c.id === currentEditCourse.id);
      if (filteredIndex !== -1) {
        Object.assign(filteredCourses[filteredIndex], courses[courseIndex]);
      }

      filteredCourses = [...courses];
      saveToStorage();
      renderAll();
      renderCronograma();
      closeCronogramaCourseModal();
      showToast('Curso atualizado com sucesso!', 'success', 5000, true);
    }

    // Variáveis globais para navegação do calendário
    let calendarCurrentMonth = new Date().getMonth();
    let calendarCurrentYear = new Date().getFullYear();

    // Calendário Inteligente (agora é uma aba)
    function renderCalendar() {
      const calendarContainer = document.getElementById('calendar-container');
      if (!calendarContainer) return;

      const today = new Date();
      const currentMonth = calendarCurrentMonth;
      const currentYear = calendarCurrentYear;
      
      const coursesWithDates = courses.filter(c => c.dataInicio || c.dataFim);
      const allEvents = [...calendarEvents, ...calendarTasks];
      
      const firstDay = new Date(currentYear, currentMonth, 1).getDay();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      const monthName = new Date(currentYear, currentMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      
      let calendarHTML = `
        <div class="card-elegant rounded-[24px] p-5 mb-6">
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-4">
              <button onclick="changeCalendarMonth(-1)" class="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 class="text-xl font-bold text-foreground mb-0.5" style="letter-spacing: -0.02em;">${monthName}</h2>
                <p class="text-xs text-muted-foreground">Clique duas vezes em um dia para adicionar evento ou tarefa</p>
              </div>
              <button onclick="changeCalendarMonth(1)" class="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div class="flex gap-2">
              <button onclick="openAddEventModal()" class="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-[12px] text-sm font-medium transition-all shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Evento
              </button>
              <button onclick="openAddTaskModal()" class="flex items-center gap-2 px-4 py-2 bg-[#34C759] hover:bg-[#30D158] text-white rounded-[12px] text-sm font-medium transition-all shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tarefa
              </button>
            </div>
          </div>
          <div class="grid grid-cols-7 gap-2 mb-3">
            ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => `
              <div class="text-center text-xs font-bold text-foreground py-2 bg-secondary/30 rounded-[8px]">${day}</div>
            `).join('')}
          </div>
          <div class="grid grid-cols-7 gap-2">
      `;

      for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="h-[110px]"></div>';
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = allEvents.filter(e => e.date === dateStr);
        const dayCourses = coursesWithDates.filter(c => {
          const inicio = c.dataInicio ? c.dataInicio.split('T')[0] : null;
          const fim = c.dataFim ? c.dataFim.split('T')[0] : null;
          return dateStr === inicio || dateStr === fim;
        });

        const isToday = dateStr === today.toISOString().split('T')[0];
        const hasContent = dayCourses.length > 0 || dayEvents.length > 0;
        
        // Separar cursos por início e fim
        const cursosIniciando = dayCourses.filter(c => c.dataInicio && c.dataInicio.split('T')[0] === dateStr);
        const cursosFinalizando = dayCourses.filter(c => c.dataFim && c.dataFim.split('T')[0] === dateStr);
        
        // Verificar feriados e datas comemorativas
        const holiday = getHoliday(dateStr);
        
        const maxVisible = 2;
        const visibleCourses = dayCourses.slice(0, maxVisible);
        const visibleEvents = dayEvents.slice(0, maxVisible - visibleCourses.length);
        // Botão "ver mais" aparece quando tiver mais cursos/eventos do que o máximo visível
        const totalVisible = visibleCourses.length + visibleEvents.length;
        const totalItems = dayCourses.length + dayEvents.length;
        const hasMore = totalItems > totalVisible && totalItems > 0;
        
        calendarHTML += `
          <div class="h-[110px] border-2 ${isToday ? 'border-[#007AFF] bg-gradient-to-br from-[rgba(0,122,255,0.15)] to-[rgba(0,122,255,0.05)] shadow-md' : hasContent ? 'border-border/40 bg-card/50' : 'border-border/20 bg-secondary/20'} rounded-[12px] p-2 overflow-hidden ${hasContent ? 'cursor-pointer' : ''} hover:border-[#007AFF]/50 hover:shadow-md transition-all duration-200" 
               ${hasContent ? `onclick="handleDayClick(event, '${dateStr}')"` : ''}
               ondblclick="openAddEventModalForDate('${dateStr}')">
            <div class="flex items-center justify-between mb-1">
              <div class="text-sm font-bold ${isToday ? 'text-[#007AFF]' : 'text-foreground'}">${day}</div>
              ${isToday ? '<div class="w-1.5 h-1.5 bg-[#007AFF] rounded-full"></div>' : ''}
            </div>
            ${holiday ? `
              <div class="text-[9px] bg-[rgba(255,59,48,0.2)] dark:bg-[rgba(255,59,48,0.3)] text-[#FF3B30] dark:text-[#FF6961] rounded px-1.5 py-0.5 mb-1 font-semibold">
                ${holiday}
              </div>
            ` : ''}
            ${cursosIniciando.length > 0 ? `
              <div class="text-[9px] text-[#007AFF] dark:text-[#5AC8FA] font-medium mb-0.5">
                ${cursosIniciando.length} curso${cursosIniciando.length > 1 ? 's' : ''} iniciando
              </div>
            ` : ''}
            ${cursosFinalizando.length > 0 ? `
              <div class="text-[9px] text-[#007AFF] dark:text-[#5AC8FA] font-medium mb-0.5">
                ${cursosFinalizando.length} curso${cursosFinalizando.length > 1 ? 's' : ''} finalizando
              </div>
            ` : ''}
            <div class="space-y-1 overflow-hidden">
            ${visibleCourses.map(c => {
              const isStart = c.dataInicio && c.dataInicio.split('T')[0] === dateStr;
              return `
              <div class="group text-[10px] bg-[rgba(0,122,255,0.25)] dark:bg-[rgba(0,122,255,0.4)] text-[#007AFF] dark:text-[#5AC8FA] rounded-[6px] px-1.5 py-1 mb-0.5 cursor-pointer hover:bg-[rgba(0,122,255,0.35)] dark:hover:bg-[rgba(0,122,255,0.5)] transition-all" 
                   onclick="event.stopPropagation(); openCronogramaCourseModal('${c.id}')"
                   onmouseenter="showCourseTooltip(event, '${c.idCurso || '-'}', '${(c.tipologia || '').replace(/'/g, "\\'")}', '${(c.municipio || '').replace(/'/g, "\\'")}')"
                   onmouseleave="hideCourseTooltip()">
                <div class="flex items-center gap-1">
                  <span class="text-[8px]">${isStart ? '▶' : '■'}</span>
                  <div class="font-semibold truncate text-[10px]">${c.idCurso || 'Curso'}</div>
                </div>
              </div>
            `;
            }).join('')}
            ${visibleEvents.map(e => `
              <div class="text-[10px] ${e.type === 'task' ? 'bg-[rgba(255,149,0,0.25)] dark:bg-[rgba(255,149,0,0.4)] text-[#FF9500] dark:text-[#FFB340]' : 'bg-[rgba(52,199,89,0.25)] dark:bg-[rgba(52,199,89,0.4)] text-[#34C759] dark:text-[#5FE57F]'} rounded-[6px] px-1.5 py-1 mb-0.5 cursor-pointer hover:opacity-90 transition-all" 
                   onclick="event.stopPropagation(); showTaskEventInfo('${e.id}', '${e.type}')">
                <div class="flex items-center gap-1">
                  <span class="text-[8px]">${e.type === 'task' ? '✓' : '●'}</span>
                  <div class="font-semibold truncate text-[10px]">${e.title}</div>
                </div>
              </div>
            `).join('')}
            ${hasMore ? `
              <button onclick="event.stopPropagation(); openDayDetailsModal('${dateStr}')" class="w-full text-[9px] text-[#007AFF] dark:text-[#5AC8FA] font-medium hover:underline mt-1">
                Ver mais
              </button>
            ` : ''}
            </div>
          </div>
        `;
      }

      calendarHTML += '</div>';
      calendarContainer.innerHTML = calendarHTML;
    }

    function openAddEventModal() {
      document.getElementById('add-event-modal').classList.remove('hidden');
      document.getElementById('event-title').value = '';
      document.getElementById('event-date').value = '';
      document.getElementById('event-description').value = '';
      document.getElementById('event-type').value = 'event';
    }

    function openAddTaskModal() {
      document.getElementById('add-event-modal').classList.remove('hidden');
      document.getElementById('event-title').value = '';
      document.getElementById('event-date').value = '';
      document.getElementById('event-description').value = '';
      document.getElementById('event-type').value = 'task';
    }

    function closeAddEventModal() {
      document.getElementById('add-event-modal').classList.add('hidden');
    }

    function saveEvent() {
      const title = document.getElementById('event-title').value.trim();
      const date = document.getElementById('event-date').value;
      const description = document.getElementById('event-description').value.trim();
      const type = document.getElementById('event-type').value;

      if (!title || !date) {
        alert('Preencha título e data');
        return;
      }

      const newItem = {
        id: `item-${Date.now()}`,
        title,
        date,
        description,
        type,
        createdAt: new Date().toISOString()
      };

      if (type === 'task') {
        calendarTasks.push(newItem);
        saveCalendarToFirebase();
        
        // Log da ação
        logAction('Criação de Tarefa', {
          taskId: newItem.id,
          title: title,
          date: date,
          description: description || null
        });
      } else {
        calendarEvents.push(newItem);
        saveCalendarToFirebase();
        
        // Log da ação
        logAction('Criação de Evento', {
          eventId: newItem.id,
          title: title,
          date: date,
          description: description || null
        });
      }

      renderCalendar();
      renderTasksList();
      closeAddEventModal();
      checkNotifications();
      showToast('Salvo com sucesso!', 'success');
    }

    function changeCalendarMonth(direction) {
      calendarCurrentMonth += direction;
      if (calendarCurrentMonth < 0) {
        calendarCurrentMonth = 11;
        calendarCurrentYear--;
      } else if (calendarCurrentMonth > 11) {
        calendarCurrentMonth = 0;
        calendarCurrentYear++;
      }
      renderCalendar();
    }

    function handleDayClick(event, dateStr) {
      // Não abrir modal se clicou em um botão, curso ou evento
      const target = event.target;
      if (target.tagName === 'BUTTON' || 
          target.closest('button') !== null ||
          target.closest('[onclick*="openCronogramaCourseModal"]') !== null ||
          target.closest('[onclick*="showTaskEventInfo"]') !== null ||
          target.closest('.group') !== null) {
        return;
      }
      
      // Abrir modal de detalhes do dia
      openDayDetailsModal(dateStr);
    }

    function openDayDetailsModal(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const dateFormatted = date.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      document.getElementById('day-details-title').textContent = 'Detalhes do Dia';
      document.getElementById('day-details-date').textContent = dateFormatted;
      document.getElementById('day-details-date').setAttribute('data-date', dateStr);
      
      const coursesWithDates = courses.filter(c => c.dataInicio || c.dataFim);
      const allEvents = [...calendarEvents, ...calendarTasks];
      
      const dayCourses = coursesWithDates.filter(c => {
        const inicio = c.dataInicio ? c.dataInicio.split('T')[0] : null;
        const fim = c.dataFim ? c.dataFim.split('T')[0] : null;
        return dateStr === inicio || dateStr === fim;
      });
      
      const dayEvents = allEvents.filter(e => e.date === dateStr);
      
      let contentHTML = '';
      
      if (dayCourses.length > 0) {
        contentHTML += `
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-foreground mb-4">Cursos</h3>
            <div class="space-y-3">
              ${dayCourses.map(c => {
                const isStart = c.dataInicio && c.dataInicio.split('T')[0] === dateStr;
                return `
                  <div class="p-4 border border-[rgba(0,122,255,0.3)] bg-[rgba(0,122,255,0.1)] dark:bg-[rgba(0,122,255,0.2)] rounded-lg cursor-pointer hover:bg-[rgba(0,122,255,0.15)] dark:hover:bg-[rgba(0,122,255,0.3)] transition-colors" onclick="openCronogramaCourseModal('${c.id}')">
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-[#007AFF] dark:text-[#5AC8FA] font-semibold">${isStart ? '▶ Início' : '■ Fim'}</span>
                          <span class="text-sm font-mono text-foreground">ID: ${c.idCurso || '-'}</span>
                        </div>
                        <h4 class="font-semibold text-foreground mb-1">${c.tipologia || '-'}</h4>
                        <div class="text-sm text-muted-foreground space-y-1">
                          <p>Município: ${c.municipio || '-'}</p>
                          <p>Lote: ${c.lote || '-'}</p>
                          ${c.cargaHoraria ? `<p>Carga Horária: ${c.cargaHoraria}h</p>` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
      
      if (dayEvents.length > 0) {
        contentHTML += `
          <div>
            <h3 class="text-lg font-semibold text-foreground mb-4">Eventos e Tarefas</h3>
            <div class="space-y-3">
              ${dayEvents.map(e => `
                <div class="p-4 border ${e.type === 'task' ? 'border-[rgba(255,149,0,0.3)] bg-[rgba(255,149,0,0.1)] dark:bg-[rgba(255,149,0,0.2)]' : 'border-[rgba(52,199,89,0.3)] bg-[rgba(52,199,89,0.1)] dark:bg-[rgba(52,199,89,0.2)]'} rounded-lg">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs font-semibold ${e.type === 'task' ? 'text-[#FF9500] dark:text-[#FFB340]' : 'text-[#34C759] dark:text-[#5FE57F]'}">${e.type === 'task' ? '✓ Tarefa' : '● Evento'}</span>
                        ${e.completed ? '<span class="text-xs text-[#34C759]">✓ Concluída</span>' : ''}
                      </div>
                      <h4 class="font-semibold text-foreground mb-1">${e.title}</h4>
                      ${e.description ? `<p class="text-sm text-muted-foreground">${e.description}</p>` : ''}
                    </div>
                    ${e.type === 'task' ? `
                      <button onclick="deleteTask('${e.id}')" class="ml-4 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir tarefa">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
      
      if (dayCourses.length === 0 && dayEvents.length === 0) {
        contentHTML = `
          <div class="text-center py-8 text-muted-foreground">
            <p>Nenhum evento ou curso neste dia</p>
          </div>
        `;
      }
      
      document.getElementById('day-details-content').innerHTML = contentHTML;
      document.getElementById('day-details-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeDayDetailsModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('day-details-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    function deleteTask(taskId) {
      if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
      
      const taskIndex = calendarTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;
      
      calendarTasks.splice(taskIndex, 1);
      saveCalendarToFirebase();
      
      renderCalendar();
      renderTasksList();
      checkNotifications();
      
      // Atualizar modal se estiver aberto
      const dayDetailsModal = document.getElementById('day-details-modal');
      if (!dayDetailsModal.classList.contains('hidden')) {
        const dateStr = document.getElementById('day-details-date').getAttribute('data-date');
        if (dateStr) {
          openDayDetailsModal(dateStr);
        }
      }
      
      alert('Tarefa excluída com sucesso!');
    }

    // Tooltip para cursos no calendário
    function showCourseTooltip(event, id, tipologia, municipio) {
      let tooltip = document.getElementById('course-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'course-tooltip';
        tooltip.className = 'fixed z-[2000] bg-[#1d1d1f] dark:bg-[#f5f5f7] text-white dark:text-[#1d1d1f] px-4 py-3 rounded-lg shadow-xl text-sm pointer-events-none';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
      }
      tooltip.innerHTML = `
        <div class="font-semibold mb-1">ID: ${id}</div>
        <div class="mb-1">${tipologia}</div>
        <div class="text-xs opacity-80">${municipio}</div>
      `;
      tooltip.style.display = 'block';
      tooltip.style.left = (event.pageX + 10) + 'px';
      tooltip.style.top = (event.pageY + 10) + 'px';
    }

    function hideCourseTooltip() {
      const tooltip = document.getElementById('course-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }

    function openAddEventModalForDate(dateStr) {
      openAddEventModal();
      document.getElementById('event-date').value = dateStr;
    }

    function showTaskEventInfo(itemId, type) {
      const allItems = [...calendarEvents, ...calendarTasks];
      const item = allItems.find(i => i.id === itemId);
      if (!item) return;

      const typeName = type === 'task' ? 'Tarefa' : 'Evento';
      
      // Criar modal de informações com opção de excluir
      const modalHTML = `
        <div class="fixed inset-0 z-[1300] flex items-center justify-center p-4">
          <div class="modal-overlay absolute inset-0 bg-black/50" onclick="closeTaskEventInfoModal()"></div>
          <div class="modal-content w-full max-w-md card-elegant md:rounded-2xl shadow-2xl relative z-10">
            <div class="flex items-center justify-between p-6 border-b border-border/30">
              <h2 class="text-xl font-semibold text-foreground">${typeName}</h2>
              <button onclick="closeTaskEventInfoModal()" class="p-2 hover:bg-secondary/50 rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Título</label>
                <div class="px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-foreground">${item.title}</div>
              </div>
              <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Data</label>
                <div class="px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-foreground">${formatDate(item.date)}</div>
              </div>
              ${item.description ? `
              <div>
                <label class="block text-sm font-medium text-muted-foreground mb-2">Descrição</label>
                <div class="px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-foreground">${item.description}</div>
              </div>
              ` : ''}
              <div class="flex justify-end gap-3 pt-4 border-t border-border/30">
                <button onclick="closeTaskEventInfoModal()" class="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-secondary/50 transition-colors">
                  Fechar
                </button>
                ${type === 'event' ? `
                <button onclick="deleteEvent('${itemId}')" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                  Excluir Evento
                </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Remover modal anterior se existir
      const existingModal = document.getElementById('task-event-info-modal');
      if (existingModal) existingModal.remove();
      
      // Criar e adicionar novo modal
      const modalDiv = document.createElement('div');
      modalDiv.id = 'task-event-info-modal';
      modalDiv.innerHTML = modalHTML;
      document.body.appendChild(modalDiv);
      document.body.classList.add('modal-open');
    }

    function closeTaskEventInfoModal() {
      const modal = document.getElementById('task-event-info-modal');
      if (modal) {
        modal.remove();
        document.body.classList.remove('modal-open');
      }
    }

    function deleteEvent(eventId) {
      if (!confirm('Tem certeza que deseja excluir este evento?')) return;
      
      const eventIndex = calendarEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) return;
      
      calendarEvents.splice(eventIndex, 1);
      saveCalendarToFirebase();
      
      renderCalendar();
      checkNotifications();
      closeTaskEventInfoModal();
      alert('Evento excluído com sucesso!');
    }

    // Função para obter feriados e datas comemorativas
    function getHoliday(dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Feriados fixos
      const fixedHolidays = {
        '01-01': 'Ano Novo',
        '04-21': 'Tiradentes',
        '05-01': 'Dia do Trabalhador',
        '09-07': 'Independência',
        '10-12': 'Nossa Senhora Aparecida',
        '11-02': 'Finados',
        '11-15': 'Proclamação da República',
        '11-20': 'Consciência Negra',
        '12-25': 'Natal'
      };
      
      const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (fixedHolidays[monthDay]) {
        return fixedHolidays[monthDay];
      }
      
      // Páscoa (calculada)
      const easter = calculateEaster(year);
      const easterDate = new Date(year, easter.month - 1, easter.day);
      if (date.getTime() === easterDate.getTime()) {
        return 'Páscoa';
      }
      
      // Carnaval (47 dias antes da Páscoa)
      const carnival = new Date(easterDate);
      carnival.setDate(carnival.getDate() - 47);
      if (date.getTime() === carnival.getTime()) {
        return 'Carnaval';
      }
      
      // Sexta-feira Santa (2 dias antes da Páscoa)
      const goodFriday = new Date(easterDate);
      goodFriday.setDate(goodFriday.getDate() - 2);
      if (date.getTime() === goodFriday.getTime()) {
        return 'Sexta-feira Santa';
      }
      
      // Corpus Christi (60 dias após a Páscoa)
      const corpusChristi = new Date(easterDate);
      corpusChristi.setDate(corpusChristi.getDate() + 60);
      if (date.getTime() === corpusChristi.getTime()) {
        return 'Corpus Christi';
      }
      
      return null;
    }

    function calculateEaster(year) {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return { month, day };
    }

    function renderTasksList() {
      const container = document.getElementById('tasks-list');
      if (!container) return;

      if (calendarTasks.length === 0) {
        container.innerHTML = `
          <div class="text-center py-12 text-muted-foreground">
            <div class="w-16 h-16 bg-secondary/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <p class="font-medium">Nenhuma tarefa cadastrada</p>
            <p class="text-sm mt-1">Adicione uma nova tarefa para começar</p>
          </div>
        `;
        return;
      }

      // Ordenar tarefas: não realizadas primeiro, depois por data
      const sortedTasks = [...calendarTasks].sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        return new Date(a.date) - new Date(b.date);
      });

      container.innerHTML = sortedTasks.map(task => {
        const taskDate = new Date(task.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        taskDate.setHours(0, 0, 0, 0);
        const isOverdue = !task.completed && taskDate < today;
        const isToday = taskDate.getTime() === today.getTime();
        const daysUntil = Math.ceil((taskDate - today) / (1000 * 60 * 60 * 24));

        return `
          <div class="p-5 border-2 ${task.completed ? 'border-[rgba(52,199,89,0.3)] bg-[rgba(52,199,89,0.05)] opacity-75' : isOverdue ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : 'border-border/30 bg-card'} rounded-[16px] hover:shadow-lg transition-all duration-200 ${task.completed ? '' : 'hover:border-[#007AFF]/50'}" onclick="showTaskEventInfo('${task.id}', 'task')">
            <div class="flex items-start gap-4">
              <button onclick="event.stopPropagation(); toggleTaskComplete('${task.id}')" class="flex-shrink-0 w-6 h-6 rounded-full border-2 ${task.completed ? 'bg-[#34C759] border-[#34C759]' : 'border-[#8e8e93] hover:border-[#34C759]'} flex items-center justify-center transition-all mt-0.5">
                ${task.completed ? `
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ` : ''}
              </button>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3 mb-2">
                  <h4 class="font-semibold text-foreground ${task.completed ? 'line-through opacity-60' : ''} text-lg">${task.title}</h4>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    ${isOverdue ? '<span class="px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">Atrasada</span>' : ''}
                    ${isToday && !task.completed ? '<span class="px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-semibold rounded-full">Hoje</span>' : ''}
                    ${!isOverdue && !isToday && daysUntil > 0 && daysUntil <= 3 && !task.completed ? `<span class="px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-xs font-semibold rounded-full">Em ${daysUntil} dia(s)</span>` : ''}
                    <button onclick="event.stopPropagation(); deleteTask('${task.id}')" class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir tarefa">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <div class="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span class="font-medium">${formatDate(task.date)}</span>
                  </div>
                  ${task.createdAt ? `
                  <div class="flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Criada em ${new Date(task.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  ` : ''}
                </div>
                ${task.description ? `
                <p class="text-sm text-foreground/80 mt-2 leading-relaxed">${task.description}</p>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    function toggleTaskComplete(taskId) {
      const taskIndex = calendarTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;

      calendarTasks[taskIndex].completed = !calendarTasks[taskIndex].completed;
      if (calendarTasks[taskIndex].completed) {
        calendarTasks[taskIndex].completedAt = new Date().toISOString();
      } else {
        delete calendarTasks[taskIndex].completedAt;
      }

      saveCalendarToFirebase();
      renderTasksList();
      renderCalendar();
      checkNotifications();
    }

    // Função para atualizar status automaticamente
    function updateCourseStatusAutomatically(course) {
      if (!course) return;
      
      const hadTurmaFormada = isTurmaFechada(course);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let status = normalizeStatus(course.status || '');
      const hasDataInicio = !!course.dataInicio;

      // Pendente + data de início -> Em breve (futuro) ou Em andamento (já iniciou)
      if (status === 'pendente' && hasDataInicio) {
        const dataInicio = new Date(course.dataInicio);
        dataInicio.setHours(0, 0, 0, 0);
        course.status = today < dataInicio ? 'Em breve' : 'Em andamento';
        status = normalizeStatus(course.status);
      }

      // Em breve + data de início chegou -> Em andamento
      if (status.includes('breve') && hasDataInicio) {
        const dataInicio = new Date(course.dataInicio);
        dataInicio.setHours(0, 0, 0, 0);
        if (today >= dataInicio) {
          course.status = 'Em andamento';
        }
      }

      preserveTurmaFormadaFlag(course, hadTurmaFormada);
    }
    
    // Função para verificar e atualizar status de todos os cursos
    function checkAndUpdateAllCourseStatuses() {
      let hasChanges = false;
      courses.forEach(course => {
        const hadTurmaFormada = isTurmaFechada(course);
        const oldStatus = course.status;
        updateCourseStatusAutomatically(course);
        preserveTurmaFormadaFlag(course, hadTurmaFormada);
        if (oldStatus !== course.status || (hadTurmaFormada && !isTurmaFechada(course))) {
          hasChanges = true;
          syncCourseToFiltered(course.id);
        }
      });
      
      // Salvar alterações se houver
      if (hasChanges) {
        saveToStorage();
        renderActionCards();
        renderStats();
        renderLotSections();
        if (document.getElementById('cronograma-cards')) renderCronograma();
        renderTarefas();
        checkNotifications();
      }
    }
    
    // Função para marcar/desmarcar turma formada
    function toggleTurmaFormada(courseId) {
      if (!requireEditAccess()) return;
      
      // Verificar se é administrador
      if (userRole !== 'admin') {
        showToast('Apenas administradores podem marcar turma formada.', 'error');
        return;
      }
      
      const courseIndex = courses.findIndex(c => c.id === courseId);
      if (courseIndex === -1) return;
      
      courses[courseIndex].turmaFormada = !courses[courseIndex].turmaFormada;
      
      // Atualizar também no filteredCourses
      const filteredIndex = filteredCourses.findIndex(c => c.id === courseId);
      if (filteredIndex !== -1) {
        filteredCourses[filteredIndex].turmaFormada = courses[courseIndex].turmaFormada;
      }
      
      logAction(courses[courseIndex].turmaFormada ? 'Turma Formada Marcada' : 'Turma Formada Desmarcada', {
        courseId: courses[courseIndex].idCurso,
        tipologia: courses[courseIndex].tipologia
      });
      
      saveToStorage();
      renderCronograma();
      showToast(courses[courseIndex].turmaFormada ? 'Turma formada marcada!' : 'Turma formada desmarcada!', 'success');
    }

    // Sistema de Notificações
    function checkNotifications() {
      notifications = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Notificações inteligentes: Aviso antes do vencimento (3 dias antes)
      courses.filter(c => c.dataFim && normalizeStatus(c.status) !== 'concluído').forEach(course => {
        const fim = new Date(course.dataFim);
        fim.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((fim - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 3) {
          notifications.push({
            id: `notif-${course.id}-vencimento-3d`,
            type: 'course-expiring',
            courseId: course.id,
            courseIdCurso: course.idCurso || '-',
            courseName: course.tipologia,
            courseDate: course.dataFim,
            message: `Curso vence em 3 dias. Prepare-se para finalização.`,
            action: 'view-course',
            priority: 'medium',
            daysUntil: 3
          });
        } else if (diffDays === 1) {
          notifications.push({
            id: `notif-${course.id}-vencimento-1d`,
            type: 'course-expiring',
            courseId: course.id,
            courseIdCurso: course.idCurso || '-',
            courseName: course.tipologia,
            courseDate: course.dataFim,
            message: `Curso vence amanhã! Ação necessária.`,
            action: 'view-course',
            priority: 'high',
            daysUntil: 1
          });
        }
      });

      // Aviso de atraso
      courses.filter(c => c.dataFim && normalizeStatus(c.status) !== 'concluído').forEach(course => {
        const fim = new Date(course.dataFim);
        fim.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((fim - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          notifications.push({
            id: `notif-${course.id}-atraso`,
            type: 'course-delayed',
            courseId: course.id,
            courseIdCurso: course.idCurso || '-',
            courseName: course.tipologia,
            courseDate: course.dataFim,
            message: `⚠️ Curso está ${Math.abs(diffDays)} dia(s) atrasado! Ação urgente necessária.`,
            action: 'update-status',
            targetStatus: 'Concluído',
            priority: 'high',
            daysDelayed: Math.abs(diffDays)
          });
        }
      });

      // Cursos pendentes próximos de iniciar
      courses.filter(c => c.status === 'Pendente' && c.dataInicio).forEach(course => {
        const inicio = new Date(course.dataInicio);
        inicio.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((inicio - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1 && diffDays >= 0) {
          notifications.push({
            id: `notif-${course.id}-inicio`,
            type: 'course-start',
            courseId: course.id,
            courseIdCurso: course.idCurso || '-',
            courseName: course.tipologia,
            courseDate: course.dataInicio,
            message: `Curso ${diffDays === 0 ? 'inicia hoje' : 'inicia amanhã'}. Atualize o status para "Em andamento".`,
            action: 'update-status',
            targetStatus: 'Em andamento',
            priority: diffDays === 0 ? 'high' : 'medium'
          });
        }
      });

      // Cursos "Em andamento" que chegaram ou passaram da data de fim
      courses.filter(c => c.status === 'Em andamento' && c.dataFim).forEach(course => {
        const fim = new Date(course.dataFim);
        fim.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((fim - today) / (1000 * 60 * 60 * 24));
        
        // Notificar se chegou ou passou da data de fim
        if (diffDays <= 0) {
          notifications.push({
            id: `notif-${course.id}-fim`,
            type: 'course-end',
            courseId: course.id,
            courseIdCurso: course.idCurso || '-',
            courseName: course.tipologia,
            courseDate: course.dataFim,
            message: `Curso ${diffDays === 0 ? 'chegou' : 'passou'} da data de término. É necessário alterar o status para "Concluído" e informar a quantidade de concludentes.`,
            action: 'update-status',
            targetStatus: 'Concluído',
            priority: 'high',
            requiresConcludentes: true
          });
        } else if (diffDays <= 1) {
          notifications.push({
            id: `notif-${course.id}-fim`,
            type: 'course-end',
            courseId: course.id,
            courseIdCurso: course.idCurso || '-',
            courseName: course.tipologia,
            courseDate: course.dataFim,
            message: `Curso próximo do término. Prepare-se para alterar o status para "Concluído" e informar a quantidade de concludentes.`,
            action: 'update-status',
            targetStatus: 'Concluído',
            priority: 'medium',
            requiresConcludentes: true
          });
        }
      });

      const allItems = [...calendarEvents, ...calendarTasks];
      allItems.forEach(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((itemDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          notifications.push({
            id: `notif-${item.id}-atrasado`,
            type: 'overdue',
            itemId: item.id,
            itemTitle: item.title,
            message: `${item.type === 'task' ? 'Tarefa' : 'Evento'} "${item.title}" está atrasado.`,
            priority: 'high'
          });
        } else if (diffDays <= 2 && diffDays >= 0) {
          notifications.push({
            id: `notif-${item.id}-proximo`,
            type: 'upcoming',
            itemId: item.id,
            itemTitle: item.title,
            message: `${item.type === 'task' ? 'Tarefa' : 'Evento'} "${item.title}" está próximo (${diffDays === 0 ? 'hoje' : `em ${diffDays} dia(s)`}).`,
            priority: diffDays === 0 ? 'high' : 'medium'
          });
        }
      });

      updateNotificationsBadge();
      
      // Enviar notificações push
      sendPushNotifications();
    }
    
    function requestNotificationPermission() {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Permissão de notificação:', permission);
        });
      }
    }
    
    function sendPushNotifications() {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
      }
      
      notifications.forEach(notif => {
        const title = notif.type === 'course-start' ? 'Curso Iniciando' : 
                     notif.type === 'course-end' ? 'Curso Finalizando' :
                     notif.type === 'overdue' ? 'Tarefa/Evento Atrasado' :
                     'Lembrete';
        
        const body = notif.type === 'course-start' || notif.type === 'course-end' ?
          `${notif.courseIdCurso} - ${notif.courseName}` :
          notif.message;
        
        const options = {
          body: body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: notif.id,
          requireInteraction: notif.priority === 'high',
          vibrate: notif.priority === 'high' ? [200, 100, 200] : [200]
        };
        
        // Verificar se já foi notificado hoje
        const lastNotified = localStorage.getItem(`notif-${notif.id}`);
        const today = new Date().toDateString();
        
        if (lastNotified !== today) {
          new Notification(title, options);
          localStorage.setItem(`notif-${notif.id}`, today);
        }
      });
    }

    function updateNotificationsBadge() {
      const badge = document.getElementById('notifications-badge');
      if (badge) {
        if (notifications.length > 0) {
          badge.textContent = notifications.length > 99 ? '99+' : notifications.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    }

    function openNotificationsModal() {
      checkNotifications();
      document.getElementById('notifications-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      switchNotificationTab('courses'); // Resetar para aba de cursos
      renderNotifications();
    }

    function closeNotificationsModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('notifications-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    let currentNotificationTab = 'courses';

    function switchNotificationTab(tab) {
      currentNotificationTab = tab;
      
      // Atualizar botões das abas
      document.getElementById('notif-tab-courses').classList.remove('text-foreground', 'border-[#007AFF]');
      document.getElementById('notif-tab-courses').classList.add('text-muted-foreground', 'border-transparent');
      document.getElementById('notif-tab-tasks').classList.remove('text-foreground', 'border-[#007AFF]');
      document.getElementById('notif-tab-tasks').classList.add('text-muted-foreground', 'border-transparent');
      
      // Esconder todas as listas
      document.getElementById('notifications-list-courses').classList.add('hidden');
      document.getElementById('notifications-list-tasks').classList.add('hidden');
      
      // Mostrar a aba selecionada
      if (tab === 'courses') {
        document.getElementById('notif-tab-courses').classList.remove('text-muted-foreground', 'border-transparent');
        document.getElementById('notif-tab-courses').classList.add('text-foreground', 'border-[#007AFF]');
        document.getElementById('notifications-list-courses').classList.remove('hidden');
      } else {
        document.getElementById('notif-tab-tasks').classList.remove('text-muted-foreground', 'border-transparent');
        document.getElementById('notif-tab-tasks').classList.add('text-foreground', 'border-[#007AFF]');
        document.getElementById('notifications-list-tasks').classList.remove('hidden');
      }
      
      renderNotifications();
    }

    function renderNotifications() {
      const coursesContainer = document.getElementById('notifications-list-courses');
      const tasksContainer = document.getElementById('notifications-list-tasks');
      
      if (!coursesContainer || !tasksContainer) return;

      // Separar notificações por tipo
      const courseNotifications = notifications.filter(n => n.type === 'course-start' || n.type === 'course-end');
      const taskNotifications = notifications.filter(n => n.type === 'overdue' || n.type === 'upcoming');

      // Renderizar notificações de cursos
      if (courseNotifications.length === 0) {
        coursesContainer.innerHTML = `
          <div class="text-center py-8 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Nenhuma notificação de cursos no momento</p>
          </div>
        `;
      } else {
        coursesContainer.innerHTML = courseNotifications.map(notif => {
          const priorityColor = {
            'high': 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
            'medium': 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
            'low': 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }[notif.priority] || 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';

          const dateStr = notif.courseDate ? formatDate(notif.courseDate) : '-';
          const timeAgo = notif.courseDate ? getTimeAgo(new Date(notif.courseDate)) : '-';
          const iconColor = notif.priority === 'high' ? '#FF3B30' : notif.priority === 'medium' ? '#FF9500' : '#007AFF';
          
          return `
            <div class="card-elegant rounded-[16px] p-4 border-l-4 relative" style="border-left-color: ${iconColor};">
              <button onclick="deleteNotification('${notif.id}')" class="absolute top-3 right-3 p-1.5 text-[#8e8e93] hover:text-[#FF3B30] hover:bg-[rgba(255,59,48,0.1)] rounded-[8px] transition-colors" title="Excluir notificação">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div class="flex items-start gap-3 mb-3 pr-8">
                <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: ${iconColor}20;">
                  ${notif.type === 'course-start' ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: ' + iconColor + ';" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' :
                    '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: ' + iconColor + ';" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
                  }
              </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <p class="text-xs font-semibold uppercase tracking-wider" style="color: ${iconColor};">${notif.type === 'course-start' ? '⏰ Início de Curso' : '✅ Término de Curso'}</p>
                    ${notif.priority === 'high' ? '<span class="px-2 py-0.5 bg-[#FF3B30] text-white text-xs font-semibold rounded-full">Urgente</span>' : ''}
                  </div>
                  <p class="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">${notif.courseName}</p>
                  <p class="text-xs text-[#8e8e93] font-mono mb-1">ID: ${notif.courseIdCurso}</p>
                  <div class="flex items-center gap-2 text-xs text-[#8e8e93]">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>${dateStr}</span>
                    <span>•</span>
                    <span>${timeAgo}</span>
                  </div>
                </div>
              </div>
              <p class="text-sm text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">${notif.message}${notif.requiresConcludentes ? ' <strong class="text-[#FF3B30]">É necessário informar a quantidade de concludentes.</strong>' : notif.action === 'update-status' ? `. Atualize o status para "${notif.targetStatus}".` : '.'}</p>
              ${notif.action === 'update-status' ? `
                <button onclick="openQuickUpdateModal('${notif.courseId}', '${notif.targetStatus}')" class="w-full px-4 py-2.5 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-[10px] text-sm font-semibold transition-colors shadow-sm">
                  Atualizar para ${notif.targetStatus}${notif.requiresConcludentes ? ' (com concludentes)' : ''}
                </button>
              ` : ''}
            </div>
          `;
        }).join('');
      }

      // Renderizar notificações de tarefas/eventos
      if (taskNotifications.length === 0) {
        tasksContainer.innerHTML = `
          <div class="text-center py-8 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Nenhuma notificação de tarefas/eventos no momento</p>
          </div>
        `;
      } else {
        tasksContainer.innerHTML = taskNotifications.map(notif => {
          const iconColor = notif.priority === 'high' ? '#FF3B30' : notif.priority === 'medium' ? '#FF9500' : '#007AFF';

          // Encontrar a tarefa/evento correspondente
          const allItems = [...calendarEvents, ...calendarTasks];
          const item = allItems.find(i => i.id === notif.itemId);
          const isTask = item && item.type === 'task';
          const isCompleted = item && item.completed;
          const dateStr = item && item.date ? formatDate(item.date) : '-';
          const timeAgo = item && item.date ? getTimeAgo(new Date(item.date)) : '-';

          return `
            <div class="card-elegant rounded-[16px] p-4 border-l-4 relative" style="border-left-color: ${iconColor};">
              <button onclick="deleteNotification('${notif.id}')" class="absolute top-3 right-3 p-1.5 text-[#8e8e93] hover:text-[#FF3B30] hover:bg-[rgba(255,59,48,0.1)] rounded-[8px] transition-colors" title="Excluir notificação">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div class="flex items-start gap-3 mb-3 pr-8">
                <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: ${iconColor}20;">
                  ${isTask ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: ' + iconColor + ';" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>' :
                    '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" style="color: ' + iconColor + ';" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>'
                  }
              </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <p class="text-xs font-semibold uppercase tracking-wider" style="color: ${iconColor};">${isTask ? '📋 Tarefa' : '📅 Evento'}</p>
                    ${notif.priority === 'high' ? '<span class="px-2 py-0.5 bg-[#FF3B30] text-white text-xs font-semibold rounded-full">Urgente</span>' : ''}
                    ${isCompleted ? '<span class="px-2 py-0.5 bg-[#34C759] text-white text-xs font-semibold rounded-full">✓ Concluída</span>' : ''}
                  </div>
                  <p class="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">${notif.itemTitle}</p>
                  ${item && item.date ? `
                    <div class="flex items-center gap-2 text-xs text-[#8e8e93]">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>${dateStr}</span>
                      <span>•</span>
                      <span>${timeAgo}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
              <p class="text-sm text-[#1d1d1f] dark:text-[#f5f5f7] mb-3">${notif.message}</p>
              ${isTask && !isCompleted ? `
                <button onclick="markTaskAsCompletedFromNotification('${notif.itemId}', '${notif.id}')" class="w-full px-4 py-2.5 bg-[#34C759] hover:bg-[#30D158] text-white rounded-[10px] text-sm font-semibold transition-colors shadow-sm">
                  Marcar como Realizada
                </button>
              ` : ''}
            </div>
          `;
        }).join('');
      }
    }

    function deleteNotification(notificationId) {
      const index = notifications.findIndex(n => n.id === notificationId);
      if (index === -1) return;
      
      notifications.splice(index, 1);
      renderNotifications();
      updateNotificationsBadge();
    }

    function deleteAllNotifications() {
      if (!confirm('Tem certeza que deseja excluir todas as notificações?')) return;
      
      notifications = [];
      renderNotifications();
      updateNotificationsBadge();
      alert('Todas as notificações foram excluídas!');
    }

    function markTaskAsCompletedFromNotification(taskId, notificationId) {
      const taskIndex = calendarTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;
      
      calendarTasks[taskIndex].completed = true;
      calendarTasks[taskIndex].completedAt = new Date().toISOString();
      saveCalendarToFirebase();
      
      // Remover a notificação
      const notifIndex = notifications.findIndex(n => n.id === notificationId);
      if (notifIndex !== -1) {
        notifications.splice(notifIndex, 1);
      }
      
      renderCalendar();
      renderTasksList();
      renderNotifications();
      checkNotifications();
      updateNotificationsBadge();
      
      alert('Tarefa marcada como realizada!');
    }

    function openQuickUpdateModal(courseId, newStatus) {
      const course = courses.find(c => c.id === courseId);
      if (!course) return;

      document.getElementById('quick-update-course-id').textContent = course.idCurso || '-';
      document.getElementById('quick-update-course-name').textContent = course.tipologia;
      document.getElementById('quick-update-new-status').textContent = newStatus;
      document.getElementById('quick-update-course-id-hidden').value = courseId;
      document.getElementById('quick-update-status-hidden').value = newStatus;
      document.getElementById('quick-update-concludentes').value = course.concludentes !== null ? course.concludentes : '';
      
      // Mostrar campo de concludentes apenas se for para "Concluído"
      const concludentesDiv = document.getElementById('quick-update-concludentes-div');
      if (concludentesDiv) {
        if (newStatus === 'Concluído') {
          concludentesDiv.classList.remove('hidden');
        } else {
          concludentesDiv.classList.add('hidden');
        }
      }
      
      document.getElementById('quick-update-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
    }

    function closeQuickUpdateModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('quick-update-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    function confirmQuickUpdate() {
      const courseId = document.getElementById('quick-update-course-id-hidden').value;
      const newStatus = document.getElementById('quick-update-status-hidden').value;
      const concludentesInput = document.getElementById('quick-update-concludentes');
      const concludentes = concludentesInput.value ? parseInt(concludentesInput.value) : null;

      const courseIndex = courses.findIndex(c => c.id === courseId);
      if (courseIndex === -1) return;

      const hadTurmaFormada = isTurmaFechada(courses[courseIndex]);

      // Validação: se for concluído, concludentes é obrigatório
      if (newStatus === 'Concluído' && (!concludentesInput.value || concludentes === null)) {
        alert('Por favor, informe a quantidade de concludentes ao concluir um curso.');
        concludentesInput.focus();
        return;
      }

      const oldStatus = courses[courseIndex].status;
      courses[courseIndex].status = newStatus;
      if (newStatus === 'Concluído' && concludentes !== null) {
        courses[courseIndex].concludentes = concludentes;
      }
      preserveTurmaFormadaFlag(courses[courseIndex], hadTurmaFormada);

      // Log da ação
      logAction('Atualização Rápida de Status', {
        courseId: courseId,
        idCurso: courses[courseIndex].idCurso,
        tipologia: courses[courseIndex].tipologia,
        oldStatus: oldStatus,
        newStatus: newStatus,
        concludentes: newStatus === 'Concluído' ? concludentes : null
      });

      filteredCourses = [...courses];
      saveToStorage();
      renderAll();
      renderCronograma();
      checkNotifications();
      renderNotifications();
      closeQuickUpdateModal();
      showToast('Status atualizado com sucesso!', 'success');
    }

    // Gerar Relatório PNG
    function generateReport() {
      const total = courses.length;
      const completed = courses.filter(c => normalizeStatus(c.status) === 'concluído').length;
      const pending = courses.filter(c => normalizeStatus(c.status) === 'pendente').length;
      const inProgress = courses.filter(c => {
        const normalized = normalizeStatus(c.status);
        return normalized === 'em andamento' || normalized === 'em andamento.';
      }).length;
      const totalConcludentes = courses.reduce((sum, c) => sum + (c.concludentes || 0), 0);

      const pctCompleted = total > 0 ? (completed / total) * 100 : 0;
      const pctInProgress = total > 0 ? (inProgress / total) * 100 : 0;
      const pctPending = total > 0 ? (pending / total) * 100 : 0;

      // Criar canvas para o relatório
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext('2d');

      // Fundo
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Título
      ctx.fillStyle = '#1d1d1f';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Ceará Sem Fome + Qualificação e Renda', canvas.width / 2, 60);

      // Data
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#8e8e93';
      ctx.fillText(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, canvas.width / 2, 90);

      // Estatísticas
      let yPos = 150;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1d1d1f';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Estatísticas Gerais', 80, yPos);
      yPos += 40;

      ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#1d1d1f';
      ctx.fillText(`Total de Cursos: ${total}`, 80, yPos);
      yPos += 35;
      ctx.fillText(`Concluídos: ${completed}`, 80, yPos);
      yPos += 35;
      ctx.fillText(`Em Andamento: ${inProgress}`, 80, yPos);
      yPos += 35;
      ctx.fillText(`Pendentes: ${pending}`, 80, yPos);
      yPos += 35;
      ctx.fillText(`Total de Concludentes: ${totalConcludentes}`, 80, yPos);
      yPos += 50;

      // Gráfico Pizza
      const centerX = canvas.width / 2;
      const centerY = 500;
      const radius = 120;

      let currentAngle = -Math.PI / 2;

      // Desenhar gráfico pizza
      if (completed > 0) {
        const sliceAngle = (pctCompleted / 100) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = '#34C759';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        currentAngle += sliceAngle;
      }

      if (inProgress > 0) {
        const sliceAngle = (pctInProgress / 100) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = '#007AFF';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        currentAngle += sliceAngle;
      }

      if (pending > 0) {
        const sliceAngle = (pctPending / 100) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = '#FF9500';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Legenda
      yPos = 650;
      const legendX = 80;
      const legendY = yPos;
      const legendSpacing = 200;

      // Concluídos
      ctx.fillStyle = '#34C759';
      ctx.fillRect(legendX, legendY, 20, 20);
      ctx.fillStyle = '#1d1d1f';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Concluídos: ${completed} (${pctCompleted.toFixed(1)}%)`, legendX + 30, legendY + 15);

      // Em Andamento
      ctx.fillStyle = '#007AFF';
      ctx.fillRect(legendX + legendSpacing, legendY, 20, 20);
      ctx.fillStyle = '#1d1d1f';
      ctx.fillText(`Em Andamento: ${inProgress} (${pctInProgress.toFixed(1)}%)`, legendX + legendSpacing + 30, legendY + 15);

      // Pendentes
      ctx.fillStyle = '#FF9500';
      ctx.fillRect(legendX + legendSpacing * 2, legendY, 20, 20);
      ctx.fillStyle = '#1d1d1f';
      ctx.fillText(`Pendentes: ${pending} (${pctPending.toFixed(1)}%)`, legendX + legendSpacing * 2 + 30, legendY + 15);

      // Converter para PNG e baixar
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `Relatorio-Ceara-Sem-Fome-${dateStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    }

    // Inicializar notificações e calendário
    document.addEventListener('DOMContentLoaded', () => {
      initCalendar();
      setTimeout(() => {
        checkNotifications();
        setInterval(checkNotifications, 3600000);
      }, 1000);
      
      // Inicializar tour na primeira visita
      setTimeout(() => {
        if (!localStorage.getItem('tour-completed') && isLoggedIn) {
          startTour();
        }
      }, 2000);
      
      initSessionTimeout();
    });

    // ========== SISTEMA DE TOASTS ==========
    function showToast(message, type = 'info', duration = 3000, showUndo = false, undoAction = null) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
      
      toast.className = `${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md`;
      toast.style.animation = 'slide-in 0.3s ease-out';
      
      const undoButton = showUndo && undoAction ? `
        <button onclick="undoLastAction(); this.closest('.bg-\\${bgColor}').remove()" class="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors">
          Desfazer
        </button>
      ` : '';
      
      toast.innerHTML = `
        <span>${message}</span>
        ${undoButton}
        <button onclick="this.parentElement.remove()" class="ml-auto text-white/80 hover:text-white">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      `;
      
      container.appendChild(toast);
      
      setTimeout(() => {
        toast.style.animation = 'slide-out 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    // ========== ESTADOS DO SISTEMA ==========
    function setActionState(element, state, message = '') {
      if (!element) return;
      
      // Remover estados anteriores
      element.classList.remove('loading', 'success', 'error', 'retry');
      element.disabled = false;
      
      const originalContent = element.dataset.originalContent || element.innerHTML;
      if (!element.dataset.originalContent) {
        element.dataset.originalContent = originalContent;
      }
      
      switch(state) {
        case 'loading':
          element.classList.add('loading');
          element.disabled = true;
          element.innerHTML = `
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>${message || 'Processando...'}</span>
            </div>
          `;
          break;
        case 'success':
          element.classList.add('success');
          element.innerHTML = `
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span>${message || 'Sucesso!'}</span>
            </div>
          `;
          setTimeout(() => {
            element.innerHTML = originalContent;
            element.classList.remove('success');
          }, 2000);
          break;
        case 'error':
          element.classList.add('error');
          element.innerHTML = `
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              <span>${message || 'Erro'}</span>
            </div>
          `;
          setTimeout(() => {
            element.innerHTML = originalContent;
            element.classList.remove('error');
            element.disabled = false;
          }, 3000);
          break;
        case 'retry':
          element.classList.add('retry');
          element.disabled = false;
          element.innerHTML = `
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span>${message || 'Tentar novamente'}</span>
            </div>
          `;
          break;
        default:
          element.innerHTML = originalContent;
          element.classList.remove('loading', 'success', 'error', 'retry');
          element.disabled = false;
      }
    }

    // ========== SISTEMA DE UNDO ==========
    function addToUndoStack(action, data) {
      undoStack.unshift({ action, data, timestamp: Date.now() });
      if (undoStack.length > MAX_UNDO_STACK) {
        undoStack.pop();
      }
    }

    function undoLastAction() {
      if (undoStack.length === 0) {
        showToast('Nenhuma ação para desfazer', 'info');
        return;
      }

      const lastAction = undoStack.shift();
      
      try {
        switch(lastAction.action) {
          case 'delete':
            // Restaurar curso deletado
            courses.push(lastAction.data.course);
            filteredCourses.push(lastAction.data.course);
            saveToStorage();
            renderAll();
            showToast('Item restaurado com sucesso!', 'success');
            logAction('Ação Desfeita', { originalAction: 'delete', courseId: lastAction.data.course.id });
            break;
          case 'edit':
            // Restaurar valores antigos
            const courseIndex = courses.findIndex(c => c.id === lastAction.data.courseId);
            if (courseIndex !== -1) {
              Object.assign(courses[courseIndex], lastAction.data.oldValues);
              const filteredIndex = filteredCourses.findIndex(c => c.id === lastAction.data.courseId);
              if (filteredIndex !== -1) {
                Object.assign(filteredCourses[filteredIndex], lastAction.data.oldValues);
              }
              saveToStorage();
              renderAll();
              showToast('Alterações desfeitas com sucesso!', 'success');
              logAction('Ação Desfeita', { originalAction: 'edit', courseId: lastAction.data.courseId });
            }
            break;
        }
      } catch (error) {
        console.error('Erro ao desfazer ação:', error);
        showToast('Erro ao desfazer ação', 'error');
      }
    }

    // ========== TOUR RÁPIDO ==========
    function startTour() {
      if (localStorage.getItem('tour-completed')) return;
      currentTourStep = 0;
      document.getElementById('tour-modal').classList.remove('hidden');
      updateTourContent();
    }

    function nextTourStep() {
      if (currentTourStep < tourSteps.length - 1) {
        currentTourStep++;
        updateTourContent();
      } else {
        completeTour();
      }
    }

    function previousTourStep() {
      if (currentTourStep > 0) {
        currentTourStep--;
        updateTourContent();
      }
    }

    function updateTourContent() {
      const step = tourSteps[currentTourStep];
      const content = document.getElementById('tour-content');
      const prevBtn = document.getElementById('tour-prev');
      const nextBtn = document.getElementById('tour-next');
      const dots = document.getElementById('tour-dots');

      if (!content) return;

      content.innerHTML = `
        <div class="text-center">
          <h4 class="text-xl font-semibold text-foreground mb-2">${step.title}</h4>
          <p class="text-muted-foreground">${step.content}</p>
        </div>
      `;

      if (prevBtn) prevBtn.classList.toggle('hidden', currentTourStep === 0);
      if (nextBtn) nextBtn.textContent = currentTourStep === tourSteps.length - 1 ? 'Finalizar' : 'Próximo';

      if (dots) {
        dots.innerHTML = tourSteps.map((_, i) => 
          `<div class="w-2 h-2 rounded-full ${i === currentTourStep ? 'bg-[#007AFF]' : 'bg-gray-300'}"></div>`
        ).join('');
      }
    }

    function completeTour() {
      localStorage.setItem('tour-completed', 'true');
      closeTour();
      showToast('Tour concluído! Explore o sistema.', 'success');
    }

    function closeTour() {
      const modal = document.getElementById('tour-modal');
      if (modal) modal.classList.add('hidden');
    }

    // ========== LOGS DE AÇÕES ==========
    function logAction(action, details = {}) {
      const log = {
        id: Date.now() + Math.random(), // Garantir ID único
        timestamp: new Date().toISOString(),
        user: currentUser?.email || 'Sistema',
        userName: currentUser?.email?.split('@')[0] || 'Sistema',
        userId: currentUser?.uid || null,
        userRole: userRole || 'user',
        action: action,
        details: details,
        ip: 'N/A', // Em produção, pode capturar IP real
        userAgent: navigator.userAgent || 'N/A'
      };
      
      actionLogs.unshift(log);
      if (actionLogs.length > 1000) actionLogs.pop();
      
      // Salvar no Firebase
      if (window.database && window.firebaseModules && window.firebaseModules.ref && window.firebaseModules.set) {
        try {
          const logsRef = window.firebaseModules.ref(window.database, `actionLogs/${log.id}`);
          window.firebaseModules.set(logsRef, log).catch(err => {
            // Silenciosamente falha se não conseguir salvar no Firebase
            console.debug('Não foi possível salvar log no Firebase (pode ser normal em desenvolvimento):', err);
          });
        } catch (e) {
          // Silenciosamente falha se houver erro
          console.debug('Erro ao salvar log no Firebase (pode ser normal em desenvolvimento):', e.message || e);
        }
      }
      
      localStorage.setItem('actionLogs', JSON.stringify(actionLogs.slice(0, 100)));
    }
    
    // Funções para modal de histórico/auditoria
    function openAuditHistoryModal() {
      if (userRole !== 'admin') {
        showToast('Apenas administradores podem acessar o histórico.', 'error');
        return;
      }
      
      // Carregar logs do localStorage
      try {
        const stored = localStorage.getItem('actionLogs');
        if (stored) {
          actionLogs = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Erro ao carregar logs:', e);
      }
      
      document.getElementById('audit-history-modal').classList.remove('hidden');
      document.body.classList.add('modal-open');
      renderAuditHistory();
    }
    
    function closeAuditHistoryModal(event) {
      if (event && event.target !== event.currentTarget) return;
      document.getElementById('audit-history-modal').classList.add('hidden');
      document.body.classList.remove('modal-open');
    }
    
    function renderAuditHistory() {
      const container = document.getElementById('audit-history-list');
      if (!container) return;
      
      if (actionLogs.length === 0) {
        container.innerHTML = `
          <div class="text-center py-12 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="font-medium">Nenhum registro encontrado</p>
            <p class="text-sm mt-1">As ações do sistema aparecerão aqui</p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = actionLogs.map(log => {
        const date = new Date(log.timestamp);
        const timeAgo = getTimeAgo(date);
        const actionIcon = getActionIcon(log.action);
        const actionColor = getActionColor(log.action);
        
        return `
          <div class="card-secondary rounded-[16px] p-4 border-l-4" style="border-left-color: ${actionColor};">
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style="background-color: ${actionColor}20;">
                ${actionIcon}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex-1">
                    <h4 class="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1">${log.action}</h4>
                    <p class="text-sm text-[#8e8e93]">
                      <span class="font-medium">${log.userName || log.user}</span>
                      ${log.userRole && log.userRole !== 'user' ? `<span class="px-1.5 py-0.5 text-xs rounded-[6px] ${log.userRole === 'admin' ? 'bg-[#007AFF] text-white' : 'bg-[rgba(142,142,147,0.2)] text-[#8e8e93]'} ml-2">${log.userRole}</span>` : ''}
                    </p>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <p class="text-xs text-[#8e8e93] font-medium">${timeAgo}</p>
                    <p class="text-xs text-[#8e8e93]">${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                ${log.details && Object.keys(log.details).length > 0 ? `
                  <div class="mt-2 p-3 bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.05)] rounded-[10px] text-sm">
                    ${Object.entries(log.details).map(([key, value]) => {
                      if (typeof value === 'object') {
                        return `<p class="text-[#8e8e93]"><span class="font-medium">${key}:</span> ${JSON.stringify(value)}</p>`;
                      }
                      return `<p class="text-[#8e8e93]"><span class="font-medium">${key}:</span> ${value}</p>`;
                    }).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    
    function getActionIcon(action) {
      const icons = {
        'Login': '🔐',
        'Logout': '🚪',
        'Curso Criado': '✔',
        'Curso Editado': '✏',
        'Curso Excluído': '🗑',
        'Exclusão de Curso': '🗑',
        'Edição de Curso': '✏',
        'Edição de Curso (Cronograma)': '✏',
        'Ação Desfeita': '↶',
        'Exclusão Crítica': '⚠',
        'Exclusão Crítica Total': '⚠',
      };
      return icons[action] || '•';
    }
    
    function getActionColor(action) {
      const colors = {
        'Login': '#007AFF',
        'Logout': '#FF3B30',
        'Curso Criado': '#34C759',
        'Curso Editado': '#FF9500',
        'Exclusão de Curso': '#FF3B30',
        'Edição de Curso': '#FF9500',
        'Edição de Curso (Cronograma)': '#FF9500',
        'Ação Desfeita': '#8e8e93',
        'Exclusão Crítica': '#FF3B30',
        'Exclusão Crítica Total': '#FF3B30',
      };
      return colors[action] || '#8e8e93';
    }
    
    function getTimeAgo(date) {
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Agora';
      if (diffMins < 60) return `Há ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
      if (diffHours < 24) return `Há ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
      if (diffDays < 7) return `Há ${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
      return date.toLocaleDateString('pt-BR');
    }

    async function openActionLogsModal() {
      const modal = document.createElement('div');
      modal.id = 'action-logs-modal';
      modal.className = 'fixed inset-0 z-[1200]';
      modal.innerHTML = `
        <div class="modal-overlay absolute inset-0" onclick="this.closest('#action-logs-modal').remove()"></div>
        <div class="modal-content w-full max-w-6xl max-h-[90vh] overflow-hidden">
          <div class="p-6 border-b border-border/30 flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-semibold text-foreground">Logs de Ações</h2>
              <p class="text-sm text-muted-foreground mt-1">Histórico detalhado de todas as ações dos usuários</p>
            </div>
            <button onclick="this.closest('#action-logs-modal').remove()" class="p-2 hover:bg-secondary/50 rounded-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <!-- Filtros -->
          <div class="p-4 border-b border-border/30 bg-secondary/20">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Filtrar por Usuário</label>
                <input type="text" id="filter-log-user" placeholder="Digite o email..." 
                  class="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                  oninput="filterActionLogs()">
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Filtrar por Ação</label>
                <input type="text" id="filter-log-action" placeholder="Digite a ação..." 
                  class="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                  oninput="filterActionLogs()">
              </div>
              <div>
                <label class="block text-xs font-medium text-muted-foreground mb-1">Ordenar por</label>
                <select id="sort-logs" onchange="filterActionLogs()" class="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground">
                  <option value="recent">Mais Recente</option>
                  <option value="oldest">Mais Antigo</option>
                  <option value="user">Por Usuário</option>
                  <option value="action">Por Ação</option>
                </select>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-xs text-muted-foreground" id="logs-count">Carregando...</span>
              <button onclick="loadActionLogsFromFirebase()" class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Atualizar
              </button>
            </div>
          </div>
          
          <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div class="space-y-3" id="logs-list">
              <div class="text-center py-8">
                <div class="w-8 h-8 border-3 border-[#007AFF] border-t-transparent rounded-full spinner-ios mx-auto mb-4"></div>
                <p class="text-muted-foreground">Carregando logs...</p>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Carregar logs do Firebase
      await loadActionLogsFromFirebase();
    }

    // Carregar logs do Firebase Realtime Database
    async function loadActionLogsFromFirebase() {
      const logsList = document.getElementById('logs-list');
      if (!logsList) return;

      try {
        logsList.innerHTML = `
          <div class="text-center py-4">
            <div class="w-6 h-6 border-3 border-[#007AFF] border-t-transparent rounded-full spinner-ios mx-auto mb-2"></div>
            <p class="text-sm text-muted-foreground">Carregando logs...</p>
          </div>
        `;

        let allLogs = [...actionLogs]; // Começar com logs locais

        // Tentar carregar do Firebase
        if (window.database && window.firebaseModules) {
          try {
            const logsRef = window.firebaseModules.ref(window.database, 'actionLogs');
            const snapshot = await window.firebaseModules.get(logsRef);
            
            if (snapshot.exists()) {
              const firebaseLogs = snapshot.val();
              // Converter objeto em array
              const firebaseLogsArray = Object.values(firebaseLogs || {});
              
              // Combinar com logs locais e remover duplicatas
              const allLogsMap = new Map();
              
              // Adicionar logs do Firebase
              firebaseLogsArray.forEach(log => {
                if (log && log.id) {
                  allLogsMap.set(log.id, log);
                }
              });
              
              // Adicionar logs locais (podem ter IDs diferentes)
              actionLogs.forEach(log => {
                if (log && log.id) {
                  allLogsMap.set(log.id, log);
                }
              });
              
              allLogs = Array.from(allLogsMap.values());
            }
          } catch (firebaseError) {
            console.warn('Erro ao carregar logs do Firebase, usando logs locais:', firebaseError);
          }
        }

        // Ordenar por timestamp (mais recente primeiro)
        allLogs.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });

        // Renderizar logs
        renderActionLogs(allLogs);
      } catch (error) {
        console.error('Erro ao carregar logs:', error);
        logsList.innerHTML = `
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p class="text-sm text-red-600 dark:text-red-400">Erro ao carregar logs: ${error.message}</p>
          </div>
        `;
      }
    }

    // Renderizar lista de logs com filtros
    function renderActionLogs(logs = null) {
      const logsList = document.getElementById('logs-list');
      const logsCount = document.getElementById('logs-count');
      if (!logsList) return;

      const logsToRender = logs || actionLogs;
      
      // Aplicar filtros
      let filteredLogs = [...logsToRender];
      
      const filterUser = document.getElementById('filter-log-user')?.value.toLowerCase() || '';
      const filterAction = document.getElementById('filter-log-action')?.value.toLowerCase() || '';
      const sortBy = document.getElementById('sort-logs')?.value || 'recent';

      if (filterUser) {
        filteredLogs = filteredLogs.filter(log => 
          log.user?.toLowerCase().includes(filterUser)
        );
      }

      if (filterAction) {
        filteredLogs = filteredLogs.filter(log => 
          log.action?.toLowerCase().includes(filterAction)
        );
      }

      // Ordenar
      if (sortBy === 'recent') {
        filteredLogs.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });
      } else if (sortBy === 'oldest') {
        filteredLogs.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeA - timeB;
        });
      } else if (sortBy === 'user') {
        filteredLogs.sort((a, b) => (a.user || '').localeCompare(b.user || ''));
      } else if (sortBy === 'action') {
        filteredLogs.sort((a, b) => (a.action || '').localeCompare(b.action || ''));
      }

      // Atualizar contador
      if (logsCount) {
        logsCount.textContent = `Mostrando ${filteredLogs.length} de ${logsToRender.length} logs`;
      }

      if (filteredLogs.length === 0) {
        logsList.innerHTML = `
          <div class="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-muted-foreground">Nenhum log encontrado</p>
            ${filterUser || filterAction ? '<p class="text-xs text-muted-foreground mt-2">Tente ajustar os filtros</p>' : ''}
          </div>
        `;
        return;
      }

      // Agrupar por data
      const logsByDate = {};
      filteredLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const dateKey = date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
        
        if (!logsByDate[dateKey]) {
          logsByDate[dateKey] = [];
        }
        logsByDate[dateKey].push(log);
      });

      // Renderizar logs agrupados por data
      logsList.innerHTML = Object.keys(logsByDate)
        .sort((a, b) => {
          // Ordenar datas (mais recente primeiro)
          const dateA = new Date(a.split('/').reverse().join('-'));
          const dateB = new Date(b.split('/').reverse().join('-'));
          return dateB - dateA;
        })
        .map(dateKey => {
          const dateLogs = logsByDate[dateKey];
          return `
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                ${dateKey} (${dateLogs.length} ação${dateLogs.length !== 1 ? 'ões' : ''})
              </h3>
              <div class="space-y-2">
                ${dateLogs.map(log => {
                  const time = new Date(log.timestamp).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  });
                  
                  // Determinar cor baseada no tipo de ação
                  let actionColor = 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400';
                  if (log.action?.includes('Exclusão') || log.action?.includes('Delete')) {
                    actionColor = 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400';
                  } else if (log.action?.includes('Criação') || log.action?.includes('Create') || log.action?.includes('Adicionar')) {
                    actionColor = 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400';
                  } else if (log.action?.includes('Edição') || log.action?.includes('Edit') || log.action?.includes('Atualização')) {
                    actionColor = 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400';
                  }
                  
                  const actionIcon = getActionIcon(log.action) || '•';
                  const userName = log.userName || log.user?.split('@')[0] || 'Sistema';
                  
                  return `
                    <div class="p-4 bg-card border border-border rounded-xl hover:shadow-md transition-all">
                      <div class="flex items-start gap-3">
                        <div class="flex-shrink-0 w-8 h-8 rounded-full ${actionColor.replace('text-', 'bg-').replace('border-', '').split(' ')[0]} flex items-center justify-center text-white text-lg font-semibold">
                          ${actionIcon}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="font-semibold text-foreground">${log.action || 'Ação Desconhecida'}</span>
                            <span class="text-xs text-muted-foreground">${time}</span>
                          </div>
                          <div class="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>${userName}</span>
                          </div>
                        </div>
                      </div>
                      ${Object.keys(log.details || {}).length > 0 ? `
                        <div class="mt-3 pt-3 border-t border-border/30">
                          <p class="text-xs font-medium text-muted-foreground mb-2">Detalhes:</p>
                          <div class="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                            ${Object.entries(log.details).map(([key, value]) => {
                              let displayValue = value;
                              if (typeof value === 'object') {
                                displayValue = JSON.stringify(value, null, 2);
                              } else if (value === null || value === undefined) {
                                displayValue = 'N/A';
                              }
                              return `
                                <div class="flex items-start gap-2 text-xs">
                                  <span class="font-medium text-foreground min-w-[100px]">${key}:</span>
                                  <span class="text-muted-foreground break-words">${displayValue}</span>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('');
    }

    // Função para filtrar logs
    function filterActionLogs() {
      renderActionLogs();
    }

    // ========== GERENCIAMENTO DE USUÁRIOS ==========
    function openUsersManagementModal() {
      if (userRole !== 'admin') {
        showToast('Apenas administradores podem acessar.', 'error');
        return;
      }
      const modal = document.createElement('div');
      modal.id = 'users-management-modal';
      modal.className = 'fixed inset-0 z-[1200]';
      modal.innerHTML = `
        <div class="modal-overlay absolute inset-0" onclick="this.closest('#users-management-modal').remove()"></div>
        <div class="modal-content absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg card-elegant md:rounded-2xl shadow-2xl overflow-hidden">
          <div class="p-6 border-b border-border/30 flex items-center justify-between">
            <h2 class="text-2xl font-semibold text-foreground">Usuários e Permissões</h2>
            <button onclick="this.closest('#users-management-modal').remove()" class="p-2 hover:bg-secondary/50 rounded-lg">✕</button>
          </div>
          <div class="p-6 space-y-4 text-sm text-muted-foreground">
            <p>Gerencie usuários no <strong>Firebase Console</strong> (Authentication) e defina papéis via <strong>Custom Claims</strong>.</p>
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
              <p class="text-foreground font-medium">Papéis suportados:</p>
              <ul class="list-disc list-inside space-y-1">
                <li><strong>admin</strong> — acesso total</li>
                <li><strong>user</strong> — criar e editar cursos</li>
                <li><strong>viewer</strong> — apenas visualização</li>
              </ul>
            </div>
            <p>Sem custom claims configurados, estes e-mails têm acesso admin: admin@iac.com, administrador@iac.com.</p>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // ========== TIMEOUT DE SESSÃO ==========
    function initSessionTimeout() {
      const TIMEOUT_DURATION = 30 * 60 * 1000;
      
      function resetTimeout() {
        lastActionTime = Date.now();
        if (sessionTimeout) clearTimeout(sessionTimeout);
        
        sessionTimeout = setTimeout(() => {
          if (isLoggedIn) {
            showToast('Sessão expirada por inatividade. Faça login novamente.', 'warning', 5000);
            handleLogout();
          }
        }, TIMEOUT_DURATION);
      }

      ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimeout, true);
      });

      resetTimeout();
    }

    // ========== PROTEÇÃO CONTRA AÇÕES DUPLICADAS ==========
    function preventDuplicateAction(actionId, actionFn, delay = 1000) {
      if (pendingActions.has(actionId)) {
        showToast('Ação já em andamento. Aguarde...', 'warning');
        return;
      }

      pendingActions.add(actionId);
      actionFn();
      
      setTimeout(() => {
        pendingActions.delete(actionId);
      }, delay);
    }

    // ========== NOTIFICAÇÕES PUSH ==========
    function toggleNotifications(enabled) {
      if (enabled) {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              showToast('Notificações ativadas!', 'success');
              localStorage.setItem('notifications-enabled', 'true');
            } else {
              showToast('Permissão de notificações negada.', 'error');
              const checkbox = document.getElementById('notifications-enabled');
              if (checkbox) checkbox.checked = false;
            }
          });
        } else if (Notification.permission === 'granted') {
          showToast('Notificações ativadas!', 'success');
          localStorage.setItem('notifications-enabled', 'true');
        }
      } else {
        localStorage.setItem('notifications-enabled', 'false');
        showToast('Notificações desativadas.', 'info');
      }
    }

    // Adicionar animações CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
