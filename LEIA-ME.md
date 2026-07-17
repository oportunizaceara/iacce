# Plataforma CSF — Versão Otimizada (v38)

Pasta pronta para publicar com **boot mais rápido** e menos trabalho na abertura do site.

## O que mudou em relação à pasta anterior

| Antes | Agora (v38) |
|-------|-------------|
| XLSX (~900 KB) e jsPDF (~300 KB) no `<head>` | Carregados **sob demanda** ao exportar/importar |
| Firebase + Tailwind bloqueando o início | Scripts no **final do body** com `defer` |
| `renderAll()` no boot (dashboard + cronograma + tarefas) | `renderVisibleTab()` — só a aba visível |
| Polling Firebase a cada 2 s | Polling a cada **60 s** (listeners em tempo real mantidos) |
| Service Worker e notificações no boot | Adiados com `requestIdleCallback` |
| Boot duplicado em `views.js` | Removido `switchTab('cronograma')` extra |

## Estrutura

```
Plataforma-CSF-Deploy-Otimizado/
  index.html
  manifest.json
  sw.js
  database.rules.json
  .nojekyll
  LEIA-ME.md
  assets/
    app.js
    app.css
    views.js
    instructors-boot.js
```

## Publicar

1. Copie **todo o conteúdo** desta pasta para a raiz do repositório GitHub (ou substitua a pasta de deploy atual).
2. GitHub → Settings → Pages → branch `main`, pasta `/ (root)`.
3. Firebase Console → Realtime Database → **Rules** → publique `database.rules.json` (inclui `instructors` com `auth != null`).
4. Firebase → Authentication → Authorized domains → adicione seu domínio GitHub Pages.
5. Após o deploy, abra o site e pressione **Ctrl+Shift+R** (limpa cache antigo v37).

## Deploy Firebase (regras)

```bash
firebase deploy --only database
```

## Testar performance

1. Abra DevTools → Network → desmarque "Disable cache".
2. Recarregue com **Ctrl+Shift+R**.
3. A tela inicial deve sumir mais rápido; XLSX/jsPDF **não** aparecem na rede até exportar PDF/planilha.

## Funcionalidades mantidas

- Sincronização em tempo real (cursos + instrutores)
- Exclusão de instrutor com **Desfazer**
- Observações no card do cronograma
- Tarefas com todos os cursos (Em andamento, Em breve, Demais turmas)
- Busca no topo da aba Tarefas

## Ícones PWA

Se `icon-192.png` e `icon-512.png` existirem na pasta original, copie-os para esta pasta antes do deploy.
