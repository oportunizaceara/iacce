(function () {
  "use strict";
  const PL_FB_PATH = "perfilLote/relatorios";
  let plSaveTimer = null;
  let plUnsub = null;
  let plRemoteSig = "";

  function plCanEdit() {
    return typeof window.canEditCourses === "function" && window.canEditCourses();
  }

  function plRequireEdit(msg) {
    if (plCanEdit()) return true;
    if (typeof window.showToast === "function") {
      window.showToast(msg || "Faça login como admin para editar.", "info");
    }
    return false;
  }

  function plIsTabVisible() {
    const el = document.getElementById("content-perfillote");
    return el && !el.classList.contains("hidden");
  }

  async function plSaveToFirebase() {
    if (!window.database || !window.firebaseModules) return;
    clearTimeout(plSaveTimer);
    plSaveTimer = setTimeout(async () => {
      if (!plCanEdit()) return;
      try {
        const { ref, set } = window.firebaseModules;
        await set(ref(window.database, PL_FB_PATH), relatorios);
        plRemoteSig = JSON.stringify(relatorios);
      } catch (e) {
        console.error("[PerfilLote] save", e);
      }
    }, 500);
  }

  function plApplyRemote(data) {
    if (!Array.isArray(data)) return;
    const sig = JSON.stringify(data);
    if (sig === plRemoteSig || sig === JSON.stringify(relatorios)) {
      plRemoteSig = sig;
      return;
    }
    plRemoteSig = sig;
    relatorios = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios));
    if (plIsTabVisible() && typeof render === "function") render();
  }

  function plInitFirebase() {
    if (!window.database || !window.firebaseModules) return;
    const { ref, onValue, get, set } = window.firebaseModules;
    if (plUnsub) {
      plUnsub();
      plUnsub = null;
    }
    get(ref(window.database, PL_FB_PATH))
      .then((snap) => {
        if (snap.exists()) {
          plApplyRemote(snap.val());
        } else {
          try {
            const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            if (Array.isArray(local) && local.length && plCanEdit()) {
              set(ref(window.database, PL_FB_PATH), local);
            }
          } catch (_) {}
        }
      })
      .catch((e) => console.warn("[PerfilLote] load", e));
    plUnsub = onValue(
      ref(window.database, PL_FB_PATH),
      (snap) => {
        if (snap.exists()) plApplyRemote(snap.val());
      },
      (e) => console.error("[PerfilLote] listener", e)
    );
  }

  function plEnsureShell() {
    const root = document.getElementById("content-perfillote");
    if (!root || root.dataset.plReady === "1") return;
    root.dataset.plReady = "1";
    root.innerHTML =
      '<div class="layout pl-layout"><aside class="sidebar"><div class="sidebar-header"><div class="logo">📄</div><div><div class="sidebar-title">Perfil de Lote</div><div class="sidebar-sub">Relatórios de turmas</div></div></div><div class="sidebar-actions admin-only" id="pl-sidebar-actions"><button class="btn" id="pl-btn-novo-relatorio">+ Novo Relatório</button><button class="btn btn-outline" id="pl-btn-importar"><span id="pl-import-icon">⬆</span> <span id="pl-import-label">Importar Excel</span></button><input type="file" id="pl-file-input" accept=".xlsx" class="sr-only" /><p id="pl-import-msg" class="import-msg hidden"></p></div><nav class="nav-list" id="pl-nav-list"></nav></aside><div class="main" id="pl-main"></div></div>';
    if (!document.getElementById("pl-modal-root")) {
      const modal = document.createElement("div");
      modal.id = "pl-modal-root";
      document.body.appendChild(modal);
    }
    plUpdateEditMode();
  }

  function plUpdateEditMode() {
    const can = plCanEdit();
    document.querySelectorAll("#content-perfillote .admin-only").forEach((el) => {
      el.style.display = can ? "" : "none";
    });
  }

  function plBindStaticEvents() {
    if (!window.__plBound) {
      window.__plBound = true;
      document.getElementById("pl-btn-novo-relatorio")?.addEventListener("click", () => {
        if (!plRequireEdit()) return;
        openModalRelatorio();
      });
      document.getElementById("pl-btn-importar")?.addEventListener("click", () => {
        if (!plRequireEdit()) return;
        document.getElementById("pl-file-input")?.click();
      });
    }
    if (typeof plBindEvents === "function") plBindEvents();
  }

  window.PerfilLote = {
    render() {
      plEnsureShell();
      plBindStaticEvents();
      plUpdateEditMode();
      if (typeof render === "function") render();
    },
    initFirebase: plInitFirebase,
  };
const STORAGE_KEY = "perfil-lote:relatorios:v1"

    const SEXO_LABEL = { feminino: "Feminino", masculino: "Masculino", outros: "Outros" }

    const FAIXAS_ETARIAS = [
      { label: "16 a 29 anos", min: 0, max: 29 },
      { label: "30 a 45 anos", min: 30, max: 45 },
      { label: "46 a 60 anos", min: 46, max: 60 },
      { label: "Acima de 60 anos", min: 61, max: Infinity },
    ]

    function uid() {
      return Math.random().toString(36).slice(2) + Date.now().toString(36)
    }

    function faixaDeIdade(idade) {
      return FAIXAS_ETARIAS.find((f) => idade >= f.min && idade <= f.max)
    }

    function calcularPerfil(alunos) {
      const linhas = FAIXAS_ETARIAS.map((f) => ({
        label: f.label, feminino: 0, masculino: 0, outros: 0, total: 0,
      }))
      for (const aluno of alunos) {
        const faixa = faixaDeIdade(aluno.idade)
        if (!faixa) continue
        const linha = linhas.find((l) => l.label === faixa.label)
        if (!linha) continue
        linha[aluno.sexo] += 1
        linha.total += 1
      }
      const totalGeral = {
        label: "Total",
        feminino: linhas.reduce((s, l) => s + l.feminino, 0),
        masculino: linhas.reduce((s, l) => s + l.masculino, 0),
        outros: linhas.reduce((s, l) => s + l.outros, 0),
        total: linhas.reduce((s, l) => s + l.total, 0),
      }
      return { linhas, totalGeral }
    }

    function calcularIdade(dataNascimento) {
      if (!dataNascimento) return 0
      const nasc = new Date(dataNascimento)
      if (Number.isNaN(nasc.getTime())) return 0
      const hoje = new Date()
      let idade = hoje.getFullYear() - nasc.getFullYear()
      const m = hoje.getMonth() - nasc.getMonth()
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
      return idade < 0 ? 0 : idade
    }

    function formatDate(iso) {
      if (!iso) return "—"
      const [y, m, d] = iso.split("-")
      return `${d}/${m}/${y}`
    }

    function hojeIso() {
      return new Date().toISOString().slice(0, 10)
    }

    const FAIXA_LABEL_CURTO = {
      "16 a 29 anos": "16-29",
      "30 a 45 anos": "30-45",
      "46 a 60 anos": "46-60",
      "Acima de 60 anos": "60+",
    }

    const META_ATENDIMENTO = 2200

    function formatPercentual(valor) {
      return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%"
    }

    function turmaConcludentes(t) {
      return Number(t.concludentes) > 0 ? Number(t.concludentes) : 0
    }

    function calcularDashboard(rels) {
      const turmas = rels.flatMap((r) => r.turmas)
      const alunos = turmas.flatMap((t) => t.alunos)
      const inscritos = alunos.length
      const concludentes = turmas.reduce((s, t) => s + turmaConcludentes(t), 0)
      const municipios = new Set(turmas.map((t) => t.municipio?.trim()).filter(Boolean))
      const { linhas, totalGeral } = calcularPerfil(alunos)
      const perfil = linhas.map((l) => ({
        label: FAIXA_LABEL_CURTO[l.label] || l.label,
        total: l.total,
        percentual: totalGeral.total > 0 ? Math.round((l.total / totalGeral.total) * 100) : 0,
      }))
      const percentualMeta = META_ATENDIMENTO > 0 ? (inscritos / META_ATENDIMENTO) * 100 : 0
      return {
        relatorios: rels.length,
        turmas: turmas.length,
        inscritos,
        concludentes,
        municipios: municipios.size,
        meta: META_ATENDIMENTO,
        percentualMeta,
        perfil,
      }
    }

    function normalizarTurmaId(id) {
      return String(id ?? "").trim().toLowerCase()
    }

    function idsTurmaDuplicados(turmas) {
      const contagem = new Map()
      for (const t of turmas) {
        const norm = normalizarTurmaId(t.turmaId)
        if (!norm) continue
        const atual = contagem.get(norm)
        if (atual) {
          contagem.set(norm, { rotulo: t.turmaId.trim(), qtd: atual.qtd + 1 })
        } else {
          contagem.set(norm, { rotulo: t.turmaId.trim(), qtd: 1 })
        }
      }
      return [...contagem.values()].filter((v) => v.qtd > 1).map((v) => v.rotulo)
    }

    function turmaIdDuplicado(turmas, turmaId, excluirId) {
      const norm = normalizarTurmaId(turmaId)
      if (!norm) return false
      return turmas.some((t) => t.id !== excluirId && normalizarTurmaId(t.turmaId) === norm)
    }

    function contagemGlobalIds(rels) {
      const map = new Map()
      for (const r of rels) {
        for (const t of r.turmas) {
          const norm = normalizarTurmaId(t.turmaId)
          if (!norm) continue
          const atual = map.get(norm)
          if (atual) {
            atual.qtd += 1
            atual.relatorioIds.add(r.id)
          } else {
            map.set(norm, { rotulo: t.turmaId.trim(), qtd: 1, relatorioIds: new Set([r.id]) })
          }
        }
      }
      return map
    }

    function idsDuplicadosNoRelatorio(relatorio, rels) {
      const contagem = contagemGlobalIds(rels)
      const ids = new Set()
      for (const t of relatorio.turmas) {
        const norm = normalizarTurmaId(t.turmaId)
        if (!norm) continue
        const c = contagem.get(norm)
        if (c && c.qtd > 1) ids.add(c.rotulo)
      }
      return [...ids]
    }

    function turmaTemIdDuplicadoGlobal(turma, rels) {
      const norm = normalizarTurmaId(turma.turmaId)
      if (!norm) return false
      return (contagemGlobalIds(rels).get(norm)?.qtd ?? 0) > 1
    }

    function outrosRelatoriosComTurmaId(relatorioId, turmaId, rels) {
      const norm = normalizarTurmaId(turmaId)
      if (!norm) return []
      return rels
        .filter((r) => r.id !== relatorioId && r.turmas.some((t) => normalizarTurmaId(t.turmaId) === norm))
        .map((r) => r.nome)
    }

    function listarDuplicatasGlobal(rels) {
      return [...contagemGlobalIds(rels).values()]
        .filter((v) => v.qtd > 1)
        .map((v) => ({
          id: v.rotulo,
          relatorios: rels.filter((r) => v.relatorioIds.has(r.id)).map((r) => r.nome),
        }))
    }

    function turmaTemIdDuplicado(turma, turmas) {
      const norm = normalizarTurmaId(turma.turmaId)
      if (!norm) return false
      return turmas.filter((t) => normalizarTurmaId(t.turmaId) === norm).length > 1
    }

    function escapeHtml(str) {
      return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
    }

    // --- Store ---
    let relatorios = []
    let selectedId = null
    const expandedTurmas = new Set()

    function loadStore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) relatorios = JSON.parse(raw)
      } catch { relatorios = [] }
    }

    function saveStore() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(relatorios))
      plSaveToFirebase()
    }

    function getSelected() {
      return relatorios.find((r) => r.id === selectedId) ?? null
    }

    function addRelatorio(nome) {
      const id = uid()
      relatorios.push({ id, nome, turmas: [], criadoEm: hojeIso() })
      saveStore()
      return id
    }

    function importRelatorio(nome, turmas) {
      const id = uid()
      const hoje = hojeIso()
      relatorios.push({ id, nome, turmas, criadoEm: hoje, importadoEm: hoje })
      saveStore()
      return id
    }

    function removeRelatorio(id) {
      relatorios = relatorios.filter((r) => r.id !== id)
      saveStore()
    }

    function addTurma(relatorioId, turma) {
      const r = relatorios.find((x) => x.id === relatorioId)
      if (!r) return
      r.turmas.push({ ...turma, id: uid(), alunos: [] })
      saveStore()
    }

    function updateTurma(relatorioId, turmaId, turma) {
      const r = relatorios.find((x) => x.id === relatorioId)
      if (!r) return
      const t = r.turmas.find((x) => x.id === turmaId)
      if (!t) return
      Object.assign(t, turma)
      saveStore()
    }

    function removeTurma(relatorioId, turmaId) {
      const r = relatorios.find((x) => x.id === relatorioId)
      if (!r) return
      r.turmas = r.turmas.filter((t) => t.id !== turmaId)
      expandedTurmas.delete(turmaId)
      saveStore()
    }

    function addAluno(relatorioId, turmaId, aluno) {
      const r = relatorios.find((x) => x.id === relatorioId)
      if (!r) return
      const t = r.turmas.find((x) => x.id === turmaId)
      if (!t) return
      t.alunos.push({ ...aluno, id: uid() })
      saveStore()
    }

    function updateAluno(relatorioId, turmaId, alunoId, aluno) {
      const r = relatorios.find((x) => x.id === relatorioId)
      if (!r) return
      const t = r.turmas.find((x) => x.id === turmaId)
      if (!t) return
      const a = t.alunos.find((x) => x.id === alunoId)
      if (!a) return
      Object.assign(a, aluno)
      saveStore()
    }

    function removeAluno(relatorioId, turmaId, alunoId) {
      const r = relatorios.find((x) => x.id === relatorioId)
      if (!r) return
      const t = r.turmas.find((x) => x.id === turmaId)
      if (!t) return
      t.alunos = t.alunos.filter((a) => a.id !== alunoId)
      saveStore()
    }

    // --- Import XLSX ---
    function normalizarSexo(valor) {
      const v = String(valor ?? "").trim().toLowerCase()
      if (v.startsWith("fem")) return "feminino"
      if (v.startsWith("masc")) return "masculino"
      return "outros"
    }

    function normalizarData(valor) {
      if (!valor) return ""
      if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return valor.toISOString().slice(0, 10)
      }
      const d = new Date(String(valor))
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
      return ""
    }

    function parseNomeAba(nome) {
      const m = nome.match(/^(.*?)\s*ID\s*(\S+)\s*$/i)
      if (m) return { municipio: m[1].trim(), turmaId: m[2].trim() }
      return { municipio: nome.trim(), turmaId: "" }
    }

    function brParaIso(dataBr) {
      const [dd, mm, aaaa] = dataBr.split("/")
      if (dd && mm && aaaa) return `${aaaa}-${mm}-${dd}`
      return ""
    }

    function parseCabecalhoCurso(texto) {
      const raw = String(texto ?? "").trim()
      const datas = raw.match(/(\d{2}\/\d{2}\/\d{4})\s*A\s*(\d{2}\/\d{2}\/\d{4})/i)
      let curso = raw, dataInicio = "", dataFim = ""
      if (datas) {
        dataInicio = brParaIso(datas[1])
        dataFim = brParaIso(datas[2])
        curso = raw.slice(0, datas.index).replace(/[-–]\s*$/, "").trim()
      }
      return { curso, dataInicio, dataFim }
    }

    function parseRelatorioXlsx(buffer, nomeArquivo) {
      const wb = XLSX.read(buffer, { cellDates: true })
      const turmas = []

      for (const sheetName of wb.SheetNames) {
        if (sheetName.trim().toUpperCase() === "GERAL") continue
        const ws = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" })
        if (rows.length === 0) continue

        const { municipio, turmaId } = parseNomeAba(sheetName)
        const { curso, dataInicio, dataFim } = parseCabecalhoCurso(String(rows[0]?.[0] ?? ""))
        const alunos = []

        for (let i = 2; i < rows.length; i++) {
          const row = rows[i]
          const primeiraCel = String(row?.[0] ?? "").trim()
          if (!primeiraCel) continue
          const upper = primeiraCel.toUpperCase()
          if (
            upper.startsWith("CADASTRO RESERVA") ||
            upper.startsWith("FAIXA ETÁRIA") ||
            upper.startsWith("FAIXA ETARIA") ||
            upper.startsWith("TOTAL")
          ) break

          const dataNascimento = normalizarData(row?.[1])
          const idadePlanilha = Number(row?.[2])
          const idade = Number.isFinite(idadePlanilha) && idadePlanilha > 0
            ? idadePlanilha
            : calcularIdade(dataNascimento)

          alunos.push({
            id: uid(),
            nome: primeiraCel,
            sexo: normalizarSexo(row?.[3]),
            dataNascimento,
            idade,
            municipio: String(row?.[4] ?? "").trim() || municipio,
          })
        }

        turmas.push({
          id: uid(), turmaId, municipio, tipologia: "", curso, dataInicio, dataFim, concludentes: 0, alunos,
        })
      }

      const nome = nomeArquivo
        .replace(/\.xlsx$/i, "")
        .replace(/-[0-9a-f]{6}$/i, "")
        .trim()

      const totalAlunos = turmas.reduce((s, t) => s + t.alunos.length, 0)
      return { nome: nome || "Relatório importado", turmas, totalAlunos }
    }

    // --- Render ---
    function renderFaixaTable(alunos) {
      const { linhas, totalGeral } = calcularPerfil(alunos)
      let html = `<div class="table-wrap"><table>
        <thead><tr>
          <th>Faixa Etária</th>
          <th class="center">Feminino</th>
          <th class="center">Masculino</th>
          <th class="center">Outros</th>
          <th class="center">Total</th>
        </tr></thead><tbody>`

      for (const l of linhas) {
        html += `<tr>
          <td>${escapeHtml(l.label)}</td>
          <td class="center">${l.feminino}</td>
          <td class="center">${l.masculino}</td>
          <td class="center">${l.outros}</td>
          <td class="center"><strong>${l.total}</strong></td>
        </tr>`
      }
      html += `<tr class="total-row">
        <td>${totalGeral.label}</td>
        <td class="center">${totalGeral.feminino}</td>
        <td class="center">${totalGeral.masculino}</td>
        <td class="center">${totalGeral.outros}</td>
        <td class="center">${totalGeral.total}</td>
      </tr></tbody></table></div>`
      return html
    }

    function renderNav() {
      const nav = document.getElementById("pl-nav-list")
      let html = `
        <button class="nav-item ${selectedId === null ? "active" : ""}" data-home>
          <span>🏠</span>
          <span class="nav-item-name">Início</span>
        </button>`
      if (relatorios.length === 0) {
        html += `<p style="padding:.5rem 1rem;font-size:.75rem;color:var(--muted-fg)">Nenhum relatório criado.</p>`
      } else {
        html += relatorios.map((r) => {
          const temDup = idsDuplicadosNoRelatorio(r, relatorios).length > 0
          return `
          <div class="nav-row" style="display:flex;align-items:center">
            <button class="nav-item ${r.id === selectedId ? "active" : ""}" data-select="${r.id}">
              <span>📁</span>
              <span class="nav-item-name">${escapeHtml(r.nome)}</span>
              ${temDup ? `<span title="IDs duplicados" style="color:#d97706">⚠</span>` : ""}
              <span class="badge">${r.turmas.length}</span>
            </button>
            <button class="nav-delete" data-delete="${r.id}" title="Excluir">🗑</button>
          </div>`
        }).join("")
      }
      nav.innerHTML = html
    }

    function renderDashboard() {
      const stats = calcularDashboard(relatorios)
      const duplicatasGlobal = listarDuplicatasGlobal(relatorios)
      const cards = [
        { label: "Relatórios cadastrados", value: stats.relatorios.toLocaleString("pt-BR") },
        { label: "Turmas", value: stats.turmas.toLocaleString("pt-BR") },
        { label: "Inscritos", value: stats.inscritos.toLocaleString("pt-BR") },
        { label: "Concludentes", value: stats.concludentes.toLocaleString("pt-BR") },
        { label: "Municípios", value: stats.municipios.toLocaleString("pt-BR") },
      ]
      const perfilHtml = stats.inscritos === 0
        ? `<p class="dashed-empty">Nenhum inscrito cadastrado ainda.</p>`
        : stats.perfil.map((p) => `
          <div class="perfil-row">
            <div class="perfil-row-header">
              <span style="font-weight:500">${escapeHtml(p.label)}</span>
              <span style="color:var(--muted-fg);font-variant-numeric:tabular-nums">
                ${p.percentual}% <span style="font-size:.75rem">(${p.total.toLocaleString("pt-BR")})</span>
              </span>
            </div>
            <div class="perfil-bar">
              <div class="perfil-bar-fill" style="width:${Math.max(p.percentual, p.total > 0 ? 4 : 0)}%"></div>
            </div>
          </div>
        `).join("")

      return `
        <div class="content">
          <header class="page-header" style="margin-bottom:2rem">
            <div>
              <h2>Dashboard</h2>
              <p class="meta" style="margin-top:.25rem">Visão geral de todos os relatórios</p>
            </div>
          </header>
          <div class="dash-grid">
            ${cards.map((c) => `
              <div class="stat-card">
                <p class="stat-label">${c.label}</p>
                <p class="stat-value">${c.value}</p>
              </div>
            `).join("")}
          </div>
          <div class="dash-import">
            <table class="meta-table">
              <thead>
                <tr>
                  <th>Meta de atendimento</th>
                  <th>Nº total de educandos inscritos</th>
                  <th>Nº total de educandos qualificados</th>
                  <th class="right">% meta de atendimento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight:600">${stats.meta.toLocaleString("pt-BR")}</td>
                  <td>${stats.inscritos.toLocaleString("pt-BR")}</td>
                  <td>${stats.concludentes.toLocaleString("pt-BR")}</td>
                  <td class="highlight">${formatPercentual(stats.percentualMeta)}</td>
                </tr>
              </tbody>
            </table>
            <p class="meta-footnote">Cálculo: inscritos ÷ meta (${stats.meta.toLocaleString("pt-BR")}) × 100</p>
          </div>
          ${duplicatasGlobal.length > 0 ? `
          <div class="alert-duplicados" style="margin-bottom:2rem">
            <h3 class="section-title" style="margin-bottom:.75rem;color:inherit">IDs de turma duplicados entre relatórios</h3>
            <ul style="display:grid;gap:.5rem;font-size:.875rem;list-style:none">
              ${duplicatasGlobal.map((d) => `
                <li><strong>ID ${escapeHtml(d.id)}</strong> — em: ${d.relatorios.map(escapeHtml).join(", ")}</li>
              `).join("")}
            </ul>
          </div>` : ""}
          <section>
            <h3 class="section-title">Indicador de perfil</h3>
            ${perfilHtml}
          </section>
        </div>`
    }

    function renderTurmaCard(relatorioId, turma) {
      const open = expandedTurmas.has(turma.id)
      const duplicada = turmaTemIdDuplicadoGlobal(turma, relatorios)
      const outros = outrosRelatoriosComTurmaId(relatorioId, turma.turmaId, relatorios)
      let alunosHtml = ""
      if (turma.alunos.length === 0) {
        alunosHtml = `<p class="dashed-empty">Nenhum inscrito cadastrado ainda.</p>`
      } else {
        alunosHtml = `<div class="table-wrap"><table>
          <thead><tr>
            <th>Nome</th><th>Gênero</th>            <th class="center">Idade</th>
            <th class="center">Nascimento</th>
            <th class="right">Ações</th>
          </tr></thead><tbody>
          ${turma.alunos.map((a) => `
            <tr>
              <td>${escapeHtml(a.nome)}</td>
              <td>${SEXO_LABEL[a.sexo]}</td>
              <td class="center">${a.idade}</td>
              <td class="center">${formatDate(a.dataNascimento)}</td>
              <td class="right">
                <div class="actions-cell">
                  <button class="btn-ghost" data-edit-aluno="${turma.id}:${a.id}" title="Editar">✏️</button>
                  <button class="btn-ghost btn-destructive" data-remove-aluno="${turma.id}:${a.id}" title="Excluir">🗑</button>
                </div>
              </td>
            </tr>
          `).join("")}
          </tbody></table></div>`
      }

      return `
        <div class="turma-card ${duplicada ? "duplicada" : ""}">
          <div class="turma-header">
            <button class="turma-toggle" data-toggle-turma="${turma.id}">
              <span class="chevron ${open ? "open" : ""}">▼</span>
              <div style="min-width:0">
                <p style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                  <span class="turma-id ${duplicada ? "duplicado" : ""}">${escapeHtml(turma.turmaId)}</span>
                  ${duplicada ? `<span class="badge-duplicado">ID duplicado</span>` : ""}
                  <span class="turma-name">${escapeHtml(turma.curso || "Curso não informado")}</span>
                </p>
                <p class="turma-meta">👥 ${turma.alunos.length} inscrito(s) · ${turmaConcludentes(turma)} concludente(s)</p>
                ${outros.length ? `<p class="turma-meta" style="color:#b45309">Também em: ${outros.map(escapeHtml).join(", ")}</p>` : ""}
              </div>
            </button>
            <div style="display:flex;gap:.25rem">
              <button class="btn-ghost" data-edit-turma="${turma.id}" title="Editar">✏️</button>
              <button class="btn-ghost btn-destructive" data-delete-turma="${turma.id}" title="Excluir">🗑</button>
            </div>
          </div>
          ${open ? `
          <div class="turma-body">
            <dl class="turma-info">
              <div>📍 Município: <strong>${escapeHtml(turma.municipio || "—")}</strong></div>
              <div>🎓 Curso: <strong>${escapeHtml(turma.curso || "—")}</strong></div>
              <div>📅 Período: <strong>${formatDate(turma.dataInicio)} a ${formatDate(turma.dataFim)}</strong></div>
              <div style="grid-column:1/-1">👥 Inscritos: <strong>${turma.alunos.length}</strong> · Concludentes: <strong>${turmaConcludentes(turma)}</strong></div>
            </dl>
            <h4 style="font-size:.875rem;font-weight:600;margin-bottom:.5rem">Inscritos</h4>
            <form class="quick-add" data-quick-add="${turma.id}">
              <div class="field">
                <label>Nome</label>
                <input type="text" name="nome" placeholder="Nome do aluno" required />
              </div>
              <div class="field field-date">
                <label>Nascimento</label>
                <input type="date" name="nascimento" required />
              </div>
              <div class="field field-age">
                <label>Idade</label>
                <input type="number" name="idade" readonly tabindex="-1" placeholder="—" />
              </div>
              <div>
                <label>Gênero</label>
                <input type="hidden" name="sexo" value="feminino" />
                <div class="sexo-btns">
                  <button type="button" class="sexo-btn active" data-sexo="feminino">Fem.</button>
                  <button type="button" class="sexo-btn" data-sexo="masculino">Masc.</button>
                  <button type="button" class="sexo-btn" data-sexo="outros">Outros</button>
                </div>
              </div>
              <button type="submit" class="btn btn-sm" style="width:auto">+ Adicionar</button>
            </form>
            ${alunosHtml}
            <div style="margin-top:1.5rem">
              <h4 style="font-size:.875rem;font-weight:600;margin-bottom:.75rem">Perfil de lote da turma</h4>
              ${renderFaixaTable(turma.alunos)}
            </div>
          </div>` : ""}
        </div>
      `
    }

    function renderMain() {
      const main = document.getElementById("pl-main")
      const selected = getSelected()

      if (!selected) {
        main.innerHTML = renderDashboard()
        return
      }

      const todosAlunos = selected.turmas.flatMap((t) => t.alunos)
      const totalConcludentes = selected.turmas.reduce((s, t) => s + turmaConcludentes(t), 0)
      const idsDuplicados = idsDuplicadosNoRelatorio(selected, relatorios)
      const alertaDup = idsDuplicados.length > 0
        ? `<div class="alert-duplicados"><strong>IDs de turma duplicados:</strong> ${idsDuplicados.map(escapeHtml).join(", ")}. Estes IDs aparecem em mais de uma turma ou em <strong>outros relatórios</strong>.</div>`
        : ""
      const turmasHtml = selected.turmas.length === 0
        ? `<p class="dashed-empty">Nenhuma turma cadastrada. Clique em "Nova Turma" para começar.</p>`
        : selected.turmas.map((t) => renderTurmaCard(selected.id, t)).join("")

      main.innerHTML = `
        <div class="content">
          <header class="page-header">
            <div>
              <h2>${escapeHtml(selected.nome)}</h2>
              <div class="meta">
                <span>🏫 ${selected.turmas.length} turma(s)</span>
                <span>👥 ${todosAlunos.length} inscrito(s)</span>
                <span>✅ ${totalConcludentes} concludente(s)</span>
              </div>
            </div>
            <button class="btn btn-sm" id="btn-nova-turma">+ Nova Turma</button>
          </header>
          ${alertaDup}
          <section class="section">
            <h3 class="section-title">Perfil de Lote — Concludentes por Faixa Etária e Gênero</h3>
            ${renderFaixaTable(todosAlunos)}
          </section>
          <section>
            <h3 class="section-title">Turmas</h3>
            ${turmasHtml}
          </section>
        </div>`

      document.getElementById("btn-nova-turma")?.addEventListener("click", () => openModalTurma())
    }

    function render() {
      renderNav()
      renderMain()
    }

    // --- Modals ---
    function closeModal() {
      document.getElementById("pl-modal-root").innerHTML = ""
      document.body.style.overflow = ""
    }

    function openModal(html) {
      const root = document.getElementById("pl-modal-root")
      root.innerHTML = `<div class="modal-overlay" id="modal-overlay">${html}</div>`
      document.body.style.overflow = "hidden"
      root.querySelector("#modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "modal-overlay") closeModal()
      })
      root.querySelector("[data-close]")?.addEventListener("click", closeModal)
    }

    function openModalRelatorio() {
      openModal(`
        <div class="modal" role="dialog">
          <div class="modal-header">
            <div>
              <h2>Novo Relatório</h2>
              <p>Dê um nome para identificar o relatório.</p>
            </div>
            <button class="btn-ghost" data-close>✕</button>
          </div>
          <form id="form-relatorio" class="form-grid">
            <div class="field">
              <label for="relNome">Nome do Relatório</label>
              <input id="relNome" placeholder="Ex: RELATÓRIO 09" required autofocus />
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline btn-sm" data-close>Cancelar</button>
              <button type="submit" class="btn btn-sm">Criar</button>
            </div>
          </form>
        </div>`)

      document.getElementById("form-relatorio")?.addEventListener("submit", (e) => {
        e.preventDefault()
        const nome = document.getElementById("relNome").value.trim()
        if (!nome) return
        selectedId = addRelatorio(nome)
        closeModal()
        render()
      })
    }

    function openModalTurma(turmaId) {
      const selected = getSelected()
      if (!selected) return
      const turma = turmaId ? selected.turmas.find((t) => t.id === turmaId) : null
      const isEdit = !!turma
      const d = turma ?? { turmaId: "", municipio: "", curso: "", dataInicio: "", dataFim: "", concludentes: 0 }

      openModal(`
        <div class="modal" role="dialog">
          <div class="modal-header">
            <div><h2>${isEdit ? "Editar Turma" : "Nova Turma"}</h2></div>
            <button class="btn-ghost" data-close>✕</button>
          </div>
          <form id="form-turma" class="form-grid" data-edit-id="${isEdit ? turmaId : ""}">
            <p id="turma-erro" class="form-erro hidden"></p>
            <div class="form-row two">
              <div class="field">
                <label for="turmaId">ID da Turma</label>
                <input id="turmaId" value="${escapeHtml(d.turmaId)}" placeholder="Ex: T-001" required />
              </div>
              <div class="field">
                <label for="municipio">Município</label>
                <input id="municipio" value="${escapeHtml(d.municipio)}" placeholder="Ex: Fortaleza" />
              </div>
            </div>
            <div class="field">
              <label for="curso">Nome do Curso</label>
              <input id="curso" value="${escapeHtml(d.curso)}" placeholder="Ex: Informática Básica" />
            </div>
            <div class="form-row two">
              <div class="field">
                <label for="dataInicio">Data de Início</label>
                <input id="dataInicio" type="date" value="${escapeHtml(d.dataInicio)}" />
              </div>
              <div class="field">
                <label for="dataFim">Data de Término</label>
                <input id="dataFim" type="date" value="${escapeHtml(d.dataFim)}" />
              </div>
            </div>
            <div class="field">
              <label for="concludentes">Quantidade de concludentes</label>
              <input id="concludentes" type="number" min="0" value="${d.concludentes ?? 0}" placeholder="Ex: 25" />
              <p class="field-hint">Educandos qualificados/concludentes. A lista de alunos representa os inscritos.</p>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline btn-sm" data-close>Cancelar</button>
              <button type="submit" class="btn btn-sm">Salvar Turma</button>
            </div>
          </form>
        </div>`)

      document.getElementById("form-turma")?.addEventListener("submit", (e) => {
        e.preventDefault()
        const data = {
          turmaId: document.getElementById("turmaId").value.trim(),
          municipio: document.getElementById("municipio").value.trim(),
          tipologia: "",
          curso: document.getElementById("curso").value.trim(),
          dataInicio: document.getElementById("dataInicio").value,
          dataFim: document.getElementById("dataFim").value,
          concludentes: parseInt(document.getElementById("concludentes").value, 10) || 0,
        }
        if (!data.turmaId) return
        const excluirId = isEdit ? turmaId : undefined
        if (turmaIdDuplicado(selected.turmas, data.turmaId, excluirId)) {
          const erro = document.getElementById("turma-erro")
          erro.textContent = `Já existe uma turma com o ID "${data.turmaId}" neste relatório.`
          erro.classList.remove("hidden")
          return
        }
        if (isEdit) updateTurma(selected.id, turmaId, data)
        else addTurma(selected.id, data)
        closeModal()
        render()
      })
    }

    function openModalAlunoEdit(turmaId, alunoId) {
      const selected = getSelected()
      if (!selected) return
      const turma = selected.turmas.find((t) => t.id === turmaId)
      const aluno = turma?.alunos.find((a) => a.id === alunoId)
      if (!aluno) return

      openModal(`
        <div class="modal" role="dialog">
          <div class="modal-header">
            <div><h2>Editar Aluno</h2></div>
            <button class="btn-ghost" data-close>✕</button>
          </div>
          <form id="form-edit-aluno" class="form-grid" data-turma="${turmaId}" data-aluno="${alunoId}">
            <div class="field">
              <label for="edit-nome">Nome</label>
              <input id="edit-nome" value="${escapeHtml(aluno.nome)}" required />
            </div>
            <div class="form-row two">
              <div class="field">
                <label for="edit-nascimento">Nascimento</label>
                <input id="edit-nascimento" type="date" value="${escapeHtml(aluno.dataNascimento)}" required />
              </div>
              <div class="field">
                <label for="edit-idade">Idade</label>
                <input id="edit-idade" type="number" value="${aluno.idade}" readonly tabindex="-1" />
              </div>
            </div>
            <div>
              <label>Gênero</label>
              <input type="hidden" id="edit-sexo" name="sexo" value="${aluno.sexo}" />
              <div class="sexo-btns" id="edit-sexo-btns">
                ${["feminino", "masculino", "outros"].map((s) => `
                  <button type="button" class="sexo-btn ${aluno.sexo === s ? "active" : ""}" data-edit-sexo="${s}">
                    ${s === "feminino" ? "Fem." : s === "masculino" ? "Masc." : "Outros"}
                  </button>
                `).join("")}
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-outline btn-sm" data-close>Cancelar</button>
              <button type="submit" class="btn btn-sm">Salvar</button>
            </div>
          </form>
        </div>`)

      document.getElementById("edit-nascimento")?.addEventListener("change", (e) => {
        const v = e.target.value
        document.getElementById("edit-idade").value = v ? String(calcularIdade(v)) : ""
      })

      document.querySelectorAll("[data-edit-sexo]").forEach((btn) => {
        btn.addEventListener("click", () => {
          document.getElementById("edit-sexo").value = btn.dataset.editSexo
          document.querySelectorAll("[data-edit-sexo]").forEach((b) => b.classList.remove("active"))
          btn.classList.add("active")
        })
      })

      document.getElementById("form-edit-aluno")?.addEventListener("submit", (e) => {
        e.preventDefault()
        const form = e.target
        const nome = document.getElementById("edit-nome").value.trim()
        const dataNascimento = document.getElementById("edit-nascimento").value
        const idade = parseInt(document.getElementById("edit-idade").value, 10)
        const sexo = document.getElementById("edit-sexo").value
        if (!nome || !dataNascimento || Number.isNaN(idade)) return
        updateAluno(selected.id, form.dataset.turma, form.dataset.aluno, { nome, sexo, idade, dataNascimento })
        closeModal()
        renderMain()
      })
    }

    // --- Events ---
    function plBindEvents() {
    if (window.__plEventsBound) return;
    window.__plEventsBound = true;

    document.getElementById("pl-file-input").addEventListener("change", async (e) => {
      if (!plRequireEdit("Faça login como admin para importar.")) { e.target.value = ""; return; }

      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return

      const btn = document.getElementById("pl-btn-importar")
      const icon = document.getElementById("pl-import-icon")
      const label = document.getElementById("pl-import-label")
      const msg = document.getElementById("pl-import-msg")

      btn.disabled = true
      icon.innerHTML = '<span class="spin">⟳</span>'
      label.textContent = "Importando..."
      msg.classList.add("hidden")

      try {
        const buffer = await file.arrayBuffer()
        const { nome, turmas, totalAlunos } = parseRelatorioXlsx(buffer, file.name)
        if (turmas.length === 0) {
          msg.textContent = "Nenhuma turma encontrada na planilha. Verifique se cada aba representa uma turma."
          msg.classList.remove("hidden")
          return
        }
        selectedId = importRelatorio(nome, turmas)
        const novoRel = relatorios.find((r) => r.id === selectedId)
        const idsDupGlobal = novoRel ? idsDuplicadosNoRelatorio(novoRel, relatorios) : []
        msg.textContent = `Importado: ${turmas.length} turma(s) e ${totalAlunos} inscrito(s).${idsDupGlobal.length ? ` Atenção: IDs duplicados — ${idsDupGlobal.join(", ")}.` : ""}`
        msg.classList.remove("hidden")
        render()
      } catch {
        msg.textContent = "Não foi possível ler o arquivo. Use um .xlsx no formato do relatório."
        msg.classList.remove("hidden")
      } finally {
        btn.disabled = false
        icon.textContent = "⬆"
        label.textContent = "Importar Excel"
      }
    })

    document.getElementById("pl-nav-list").addEventListener("click", (e) => {
      if (e.target.closest("[data-home]")) {
        selectedId = null
        render()
        return
      }
      const sel = e.target.closest("[data-select]")
      if (sel) {
        selectedId = sel.dataset.select
        render()
        return
      }
      const del = e.target.closest("[data-delete]")
      if (del) {
        if (!plRequireEdit()) return;
        const r = relatorios.find((x) => x.id === del.dataset.delete)
        if (r && confirm(`Excluir o relatório "${r.nome}" e todas as suas turmas?`)) {
          removeRelatorio(del.dataset.delete)
          if (selectedId === del.dataset.delete) selectedId = null
          render()
        }
      }
    })

    document.getElementById("pl-main").addEventListener("input", (e) => {
      if (e.target.name !== "nascimento") return
      const form = e.target.closest("[data-quick-add]")
      if (!form) return
      const v = e.target.value
      form.idade.value = v ? String(calcularIdade(v)) : ""
    })

    document.getElementById("pl-main").addEventListener("submit", (e) => {
      const form = e.target.closest("[data-quick-add]")
      if (!form) return
      e.preventDefault()
      const selected = getSelected()
      if (!selected) return
      const turmaId = form.dataset.quickAdd
      const nome = form.nome.value.trim()
      const dataNascimento = form.nascimento.value
      const idade = parseInt(form.idade.value, 10)
      const sexo = form.sexo.value
      if (!nome || !dataNascimento || Number.isNaN(idade)) return
      addAluno(selected.id, turmaId, { nome, sexo, idade, dataNascimento })
      form.nome.value = ""
      form.nascimento.value = ""
      form.idade.value = ""
      renderMain()
    })

    document.getElementById("pl-main").addEventListener("click", (e) => {
      const sexoBtn = e.target.closest("[data-sexo]")
      if (sexoBtn) {
        const form = sexoBtn.closest("[data-quick-add]")
        if (!form) return
        form.sexo.value = sexoBtn.dataset.sexo
        form.querySelectorAll(".sexo-btn").forEach((b) => b.classList.remove("active"))
        sexoBtn.classList.add("active")
        return
      }
      const toggle = e.target.closest("[data-toggle-turma]")
      if (toggle) {
        const id = toggle.dataset.toggleTurma
        if (expandedTurmas.has(id)) expandedTurmas.delete(id)
        else expandedTurmas.add(id)
        renderMain()
        return
      }
      const editTurma = e.target.closest("[data-edit-turma]")
      if (editTurma) { openModalTurma(editTurma.dataset.editTurma); return }
      const deleteTurma = e.target.closest("[data-delete-turma]")
      if (deleteTurma) {
        const selected = getSelected()
        const t = selected?.turmas.find((x) => x.id === deleteTurma.dataset.deleteTurma)
        if (t && confirm(`Excluir a turma "${t.turmaId}"?`)) {
          removeTurma(selected.id, t.id)
          render()
        }
        return
      }
      const editAlunoBtn = e.target.closest("[data-edit-aluno]")
      if (editAlunoBtn) {
        const [turmaId, alunoId] = editAlunoBtn.dataset.editAluno.split(":")
        openModalAlunoEdit(turmaId, alunoId)
        return
      }
      const removeAlunoBtn = e.target.closest("[data-remove-aluno]")
      if (removeAlunoBtn) {
        const selected = getSelected()
        const [turmaId, alunoId] = removeAlunoBtn.dataset.removeAluno.split(":")
        removeAluno(selected.id, turmaId, alunoId)
        renderMain()
      }
    })

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal()
    })
    }

  loadStore();
  window.addEventListener("firebase-ready", plInitFirebase);
  if (window.database && window.firebaseModules) plInitFirebase();
})();
