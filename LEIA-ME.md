# Plataforma CSF — Pacote para GitHub Pages

Pasta pronta para publicar. Envie **todo o conteúdo desta pasta** ao repositório GitHub.

## Estrutura obrigatória

```
index.html
manifest.json
sw.js
.nojekyll
icon-192.png
icon-512.png
assets/
  app.js
  app.css
  views.js
  instructors-boot.js
```

## Publicar no GitHub

1. Copie todos os arquivos desta pasta para a raiz do repositório
2. GitHub → Settings → Pages → Source: branch `main`, pasta `/ (root)`
3. Aguarde o deploy (1–3 min)
4. Abra o site e pressione **Ctrl+Shift+R**

## Firebase (login)

Firebase Console → Authentication → Settings → **Authorized domains**  
Adicione: `seu-usuario.github.io`

## Testar botão Novo Instrutor

1. Abra a aba **Instrutores**
2. Clique em **+ Novo instrutor**
3. O formulário deve abrir
4. Console (F12): `[IAC] instructors-boot.js carregado`

## Correções v31

- HTML padrão com `<script src="...">` e `<link href="...">` normais
- Sem carregamento dinâmico de scripts
- `instructors-boot.js` garante o botão Novo Instrutor
