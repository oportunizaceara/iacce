# Deploy no GitHub Pages — repositório `iacce`

Site: **https://oportunizaceara.github.io/iacce/**

## Diagnóstico do erro 404

O `index.html` está no GitHub, mas a pasta **`assets/`** não foi enviada.
Por isso aparecem erros como:

- `assets/app.js` → 404
- `assets/views.js` → 404
- `assets/app.css` → 404
- `icon-192.png` → 404

## Estrutura CORRETA na raiz do repositório

```
iacce/                          ← raiz do repo no GitHub
├── index.html
├── manifest.json
├── sw.js
├── .nojekyll
├── icon-192.png
├── icon-512.png
├── database.rules.json
└── assets/
    ├── app.js
    ├── app.css
    ├── views.js
    └── instructors-boot.js
```

## Passo a passo (upload pelo site do GitHub)

### 1. Abra o repositório
https://github.com/oportunizaceara/iacce

### 2. Envie a pasta `assets`
1. Clique em **Add file** → **Upload files**
2. Arraste **toda a pasta `assets`** da sua máquina:
   `C:\Users\IAC-2\Desktop\Plataforma-CSF-Deploy-Otimizado\assets`
3. Confirme que dentro dela aparecem:
   - `app.js`
   - `app.css`
   - `views.js`
   - `instructors-boot.js`
4. Clique em **Commit changes**

### 3. Envie os ícones (se ainda der 404)
Na mesma pasta local, envie também:
- `icon-192.png`
- `icon-512.png`

### 4. Aguarde o deploy
GitHub Pages leva **1–3 minutos** para atualizar.

### 5. Teste
Abra cada link — todos devem retornar **200** (não 404):

- https://oportunizaceara.github.io/iacce/assets/app.js
- https://oportunizaceara.github.io/iacce/assets/app.css
- https://oportunizaceara.github.io/iacce/icon-192.png

Depois recarregue o site com **Ctrl+Shift+R**.

## Passo a passo (Git no terminal)

```powershell
cd "C:\Users\IAC-2\Desktop\Plataforma-CSF-Deploy-Otimizado"
git clone https://github.com/oportunizaceara/iacce.git temp-iacce
Copy-Item -Recurse -Force * temp-iacce\
cd temp-iacce
git add .
git commit -m "Adiciona pasta assets e ícones faltantes"
git push
```

## Sobre o aviso do Tailwind

A mensagem *"cdn.tailwindcss.com should not be used in production"* é um **aviso**, não impede o site de abrir.
O site só não funciona enquanto `assets/app.js` estiver em 404.

## Checklist antes de fechar

- [ ] `assets/app.js` abre no navegador (sem 404)
- [ ] `assets/app.css` abre no navegador (sem 404)
- [ ] `icon-192.png` abre no navegador (sem 404)
- [ ] Site carrega e mostra o cronograma
- [ ] Ctrl+Shift+R feito após o deploy
