@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    /* Fallback crítico: evita página quebrada antes do Tailwind carregar */
    .hidden:not([class*="md:"]):not([class*="sm:"]):not([class*="lg:"]):not([class*="xl:"]),
    #app.hidden,
    #login-modal.hidden,
    #login-loading.hidden,
    main.hidden,
    [id^="content-"].hidden,
    [id^="import-step-"].hidden,
    [id$="-modal"].hidden {
      display: none !important;
    }

    @media (min-width: 768px) {
      .header-tabs,
      header .header-search-wrap {
        display: flex !important;
      }
    }

    @media (max-width: 767px) {
      .header-tabs,
      header .header-search-wrap {
        display: none !important;
      }
    }

    #app:not(.hidden) {
      display: block;
    }

    #initial-loading {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }

    body.dark #initial-loading {
      background: #1c1c1e;
    }

    #initial-loading.hidden {
      display: none !important;
    }

    #initial-loading svg {
      width: 2.5rem;
      height: 2.5rem;
      flex-shrink: 0;
    }

    svg {
      max-width: 100%;
      height: auto;
    }

    /* ── iOS Liquid Glass Design Tokens ── */
    :root {
      --lg-blur: 40px;
      --lg-blur-sm: 24px;
      --lg-saturate: 180%;
      --lg-radius: 22px;
      --lg-radius-sm: 14px;
      --lg-radius-lg: 28px;
      --lg-bg: rgba(255, 255, 255, 0.52);
      --lg-bg-elevated: rgba(255, 255, 255, 0.68);
      --lg-bg-subtle: rgba(255, 255, 255, 0.32);
      --lg-border: rgba(255, 255, 255, 0.55);
      --lg-border-subtle: rgba(255, 255, 255, 0.28);
      --lg-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.65);
      --lg-shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.14), 0 8px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.7);
      --lg-overlay: rgba(0, 0, 0, 0.28);
      --lg-accent: #007AFF;
      --lg-text: #1d1d1f;
      --lg-text-muted: #6e6e73;
      --lg-surface: #e8ecf4;
    }

    body.dark {
      --lg-bg: rgba(44, 44, 46, 0.58);
      --lg-bg-elevated: rgba(58, 58, 60, 0.72);
      --lg-bg-subtle: rgba(28, 28, 30, 0.45);
      --lg-border: rgba(255, 255, 255, 0.14);
      --lg-border-subtle: rgba(255, 255, 255, 0.08);
      --lg-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      --lg-shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      --lg-overlay: rgba(0, 0, 0, 0.55);
      --lg-text: #f5f5f7;
      --lg-text-muted: #98989d;
      --lg-surface: #000000;
    }
    
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    body { 
      background: var(--lg-surface);
      color: var(--lg-text);
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-weight: 400;
      letter-spacing: -0.01em;
      transition: background-color 0.4s ease, color 0.4s ease;
    }

    #app {
      position: relative;
      min-height: 100vh;
      isolation: isolate;
    }

    #app > main {
      position: relative;
      z-index: 1;
    }

    /* Ambient orbs — liquid glass depth */
    .ambient-bg {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      opacity: 0.55;
      animation: orbFloat 20s ease-in-out infinite;
    }
    .ambient-orb--blue {
      width: 55vw; height: 55vw; max-width: 520px; max-height: 520px;
      background: radial-gradient(circle, rgba(0, 122, 255, 0.45) 0%, transparent 70%);
      top: -12%; right: -8%;
      animation-delay: 0s;
    }
    .ambient-orb--purple {
      width: 45vw; height: 45vw; max-width: 420px; max-height: 420px;
      background: radial-gradient(circle, rgba(175, 82, 222, 0.35) 0%, transparent 70%);
      bottom: 5%; left: -10%;
      animation-delay: -7s;
    }
    .ambient-orb--cyan {
      width: 35vw; height: 35vw; max-width: 320px; max-height: 320px;
      background: radial-gradient(circle, rgba(90, 200, 250, 0.4) 0%, transparent 70%);
      top: 40%; left: 35%;
      animation-delay: -14s;
    }
    body.dark .ambient-orb { opacity: 0.35; }
    body.dark .ambient-orb--blue { background: radial-gradient(circle, rgba(10, 132, 255, 0.5) 0%, transparent 70%); }
    body.dark .ambient-orb--purple { background: radial-gradient(circle, rgba(191, 90, 242, 0.35) 0%, transparent 70%); }
    body.dark .ambient-orb--cyan { background: radial-gradient(circle, rgba(100, 210, 255, 0.3) 0%, transparent 70%); }

    @keyframes orbFloat {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(2%, 3%) scale(1.05); }
      66% { transform: translate(-2%, -2%) scale(0.97); }
    }
    
    /* Dark Mode Styles */
    body.dark {
      background: var(--lg-surface);
      color: var(--lg-text);
    }
    
    body.dark .card-elegant {
      background: var(--lg-bg);
      border: 0.5px solid var(--lg-border);
      box-shadow: var(--lg-shadow);
    }
    
    body.dark .header-fixed {
      background: var(--lg-bg-elevated);
      border-bottom: 0.5px solid var(--lg-border-subtle);
    }
    
    body.dark input,
    body.dark select,
    body.dark textarea {
      background: var(--lg-bg-subtle);
      border: 0.5px solid var(--lg-border-subtle);
      color: var(--lg-text);
      backdrop-filter: blur(var(--lg-blur-sm)) saturate(var(--lg-saturate));
      -webkit-backdrop-filter: blur(var(--lg-blur-sm)) saturate(var(--lg-saturate));
    }
    
    body.dark input:focus,
    body.dark select:focus,
    body.dark textarea:focus {
      background: var(--lg-bg);
      border-color: var(--lg-accent);
    }
    
    body.dark .modal-content {
      background: var(--lg-bg-elevated);
      border: 0.5px solid var(--lg-border);
      box-shadow: var(--lg-shadow-lg);
    }
    
    body.dark select option {
      background: #1c1c1e;
      color: #f5f5f7;
    }
    
    body.dark ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
    }
    
    body.dark ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    body.dark table tbody tr:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
    
    body.dark table tbody tr {
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    /* Dark mode text colors */
    body.dark .text-foreground {
      color: #f5f5f7;
    }
    
    body.dark .text-muted-foreground {
      color: #8e8e93;
    }
    
    body.dark .bg-card {
      background: var(--lg-bg);
    }
    
    body.dark .border-border {
      border-color: var(--lg-border-subtle);
    }
    
    body.dark .bg-secondary {
      background: var(--lg-bg-subtle);
    }
    
    .modal-overlay { 
      background: var(--lg-overlay);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
    }
    
    /* iOS-style Scrollbar */
    ::-webkit-scrollbar { 
      width: 8px; 
      height: 8px; 
    }
    ::-webkit-scrollbar-track { 
      background: transparent;
    }
    ::-webkit-scrollbar-thumb { 
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:hover { 
      background: rgba(0, 0, 0, 0.3);
      background-clip: padding-box;
    }
    
    .scrollbar-thin::-webkit-scrollbar { 
      width: 6px; 
      height: 6px; 
    }
    .scrollbar-thin::-webkit-scrollbar-thumb { 
      background: rgba(0, 0, 0, 0.15);
      border-radius: 3px;
    }
    
    select option { 
      background: #ffffff; 
      color: #1d1d1f; 
    }
    
    .tab-btn { 
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
      border-radius: var(--lg-radius-sm);
      padding: 0.4rem 0.75rem;
    }
    .tab-btn.active { 
      color: var(--lg-accent);
      background: rgba(0, 122, 255, 0.12);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      position: relative;
    }
    .tab-btn.active::after {
      display: none;
    }
    
    /* iOS Liquid Glass Cards */
    .card-elegant {
      background: var(--lg-bg);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      border: 0.5px solid var(--lg-border);
      box-shadow: var(--lg-shadow);
      border-radius: var(--lg-radius);
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .card-elegant:hover {
      transform: translateY(-3px);
      box-shadow: var(--lg-shadow-lg);
      background: var(--lg-bg-elevated);
    }
    
    /* Cards secundários — liquid glass */
    .card-secondary {
      background: var(--lg-bg-subtle);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm));
      border: 0.5px solid var(--lg-border-subtle);
      box-shadow: var(--lg-shadow);
      border-radius: var(--lg-radius-sm);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    body.dark .card-secondary {
      background: var(--lg-bg-subtle);
      border: 0.5px solid var(--lg-border-subtle);
    }
    
    .card-secondary:hover {
      background: var(--lg-bg);
      transform: translateY(-2px);
    }
    
    /* Listas e tabelas - fundo sólido */
    .list-item, table tbody tr {
      background: rgba(255, 255, 255, 0.98);
      border: none;
      transition: background-color 0.15s ease;
    }
    
    body.dark .list-item, body.dark table tbody tr {
      background: rgba(28, 28, 30, 0.98);
    }
    
    .list-item:hover, table tbody tr:hover {
      background: rgba(0, 0, 0, 0.02);
    }
    
    body.dark .list-item:hover, body.dark table tbody tr:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    
    /* Performance: desativar blur em dispositivos fracos */
    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    
    /* Desativar blur se dispositivo não suporta bem */
    @supports not (backdrop-filter: blur(1px)) {
      .card-elegant, .header-fixed, .modal-content {
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        background: rgba(255, 255, 255, 0.95);
      }
    }
    
    /* iOS Liquid Glass Header */
    .header-fixed,
    #app > header.header-fixed {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      z-index: 1000;
      background: var(--lg-bg-elevated);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      border-bottom: 0.5px solid var(--lg-border-subtle);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4) inset, 0 4px 24px rgba(0, 0, 0, 0.04);
      transition: background 0.35s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.35s ease;
      padding-top: env(safe-area-inset-top, 0);
    }

    #app > .menu-drawer { position: fixed; z-index: 1100; }
    #app > .menu-overlay { position: fixed; z-index: 1099; }
    
    /* Botão Menu Mobile - Ajustes de acessibilidade e safe area */
    @media (max-width: 768px) {
      .header-fixed {
        padding-top: max(env(safe-area-inset-top, 0), 8px);
        padding-bottom: 8px;
      }
      
      .header-fixed button[onclick*="toggleMenuDrawer"] {
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1001;
        position: relative;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      
      .header-fixed .container {
        padding-top: 0;
      }
    }
    
    body.modal-open .header-fixed {
      background: var(--lg-bg-subtle);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm));
    }
    /* iOS Button Styles */
    button {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
      letter-spacing: -0.01em;
    }
    
    button:active {
      transform: scale(0.97);
      opacity: 0.8;
    }
    
    /* iOS Liquid Glass Inputs */
    input, select, textarea {
      background: var(--lg-bg-subtle);
      backdrop-filter: blur(16px) saturate(var(--lg-saturate));
      -webkit-backdrop-filter: blur(16px) saturate(var(--lg-saturate));
      border: 0.5px solid var(--lg-border-subtle);
      border-radius: var(--lg-radius-sm);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 400;
      color: var(--lg-text);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--lg-accent);
      box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.04);
      background: var(--lg-bg);
    }
    
    /* Estados visuais mais claros */
    input:invalid, select:invalid, textarea:invalid {
      border-color: #FF3B30;
      background: rgba(255, 59, 48, 0.05);
    }
    
    input:invalid:focus, select:invalid:focus, textarea:invalid:focus {
      border-color: #FF3B30;
      box-shadow: 0 0 0 4px rgba(255, 59, 48, 0.1);
    }
    
    input:disabled, select:disabled, textarea:disabled,
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    button:not(:disabled):hover {
      transform: translateY(-1px);
    }
    
    button:not(:disabled):active {
      transform: translateY(0) scale(0.98);
    }
    
    button.loading {
      position: relative;
      color: transparent;
      pointer-events: none;
    }
    
    button.loading::after {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      top: 50%;
      left: 50%;
      margin-left: -8px;
      margin-top: -8px;
      border: 2px solid currentColor;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.6s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @keyframes loading {
      0% { width: 0%; }
      50% { width: 70%; }
      100% { width: 100%; }
    }
    
    .animate-loading {
      animation: loading 1.5s ease-in-out infinite;
    }
    
    /* iOS Liquid Glass Modal */
    .modal-content {
      background: var(--lg-bg-elevated);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      border: 0.5px solid var(--lg-border);
      box-shadow: var(--lg-shadow-lg);
      border-radius: var(--lg-radius-lg);
    }
    
    /* Mobile optimizations */
    @media (max-width: 768px) {
      ::-webkit-scrollbar, .scrollbar-thin::-webkit-scrollbar {
        width: 0px;
        height: 0px;
        display: none;
      }
      
      input[type="text"],
      input[type="email"],
      input[type="tel"],
      input[type="password"],
      input[type="number"],
      input[type="date"],
      select,
      textarea {
        font-size: 16px !important;
        min-height: 44px;
        padding: 12px 16px !important;
      }
      
      button:active, .tab-btn:active, a:active {
        transform: scale(0.96);
      }
      
      .modal-content {
        position: absolute !important;
        width: 100vw !important;
        max-width: 100vw !important;
        height: 100vh !important;
        max-height: 100vh !important;
        top: 0 !important;
        left: 0 !important;
        transform: none !important;
        border-radius: 0 !important;
        margin: 0 !important;
      }
      
      .container-mobile {
        padding-left: 1rem;
        padding-right: 1rem;
      }
    }
    
    @media (min-width: 768px) {
      .modal-content {
        position: absolute !important;
        width: auto !important;
        height: auto !important;
        max-height: 85vh !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        border-radius: 28px !important;
        margin: 0 !important;
      }
    }

    /* iOS Liquid Glass FAB */
    .fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999;
      width: 56px;
      height: 56px;
      border-radius: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, rgba(0, 122, 255, 0.95), rgba(0, 100, 220, 0.9));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 0.5px solid rgba(255, 255, 255, 0.35);
      box-shadow: 0 8px 28px rgba(0, 122, 255, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35);
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .fab:active {
      transform: scale(0.92);
    }
    .fab-menu {
      position: fixed;
      bottom: 92px;
      right: 24px;
      z-index: 998;
      display: flex;
      flex-direction: column;
      gap: 12px;
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px) scale(0.9);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .fab-menu.open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }
    .fab-item {
      width: 48px;
      height: 48px;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--lg-bg-elevated);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm));
      border: 0.5px solid var(--lg-border);
      box-shadow: var(--lg-shadow);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .fab-item:active {
      transform: scale(0.92);
    }
    
    /* iOS Liquid Glass Menu Drawer */
    .menu-drawer {
      position: fixed;
      top: 0;
      left: -100%;
      width: 300px;
      height: 100vh;
      height: 100dvh;
      z-index: 1100;
      background: var(--lg-bg-elevated);
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur));
      border-right: 0.5px solid var(--lg-border-subtle);
      box-shadow: var(--lg-shadow-lg);
      transition: left 0.45s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      padding-top: env(safe-area-inset-top, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
    
    @media (max-width: 768px) {
      .menu-drawer > div:first-child {
        padding-top: max(env(safe-area-inset-top, 0), 16px);
      }
      
      .menu-drawer button[onclick*="toggleMenuDrawer"] {
        margin-top: env(safe-area-inset-top, 0);
        padding-top: max(env(safe-area-inset-top, 0), 8px);
      }
    }
    .menu-drawer.open {
      left: 0;
    }
    .menu-overlay {
      position: fixed;
      inset: 0;
      background: var(--lg-overlay);
      backdrop-filter: saturate(var(--lg-saturate)) blur(12px);
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(12px);
      z-index: 1099;
      opacity: 0;
      visibility: hidden;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .menu-overlay.open {
      opacity: 1;
      visibility: visible;
    }
    /* iOS Alert Badge */
    .alert-pending {
      background: rgba(255, 149, 0, 0.15);
      color: #FF9500;
      border: 0.5px solid rgba(255, 149, 0, 0.2);
      border-radius: 12px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 1px 4px rgba(255, 149, 0, 0.1);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      backdrop-filter: saturate(180%) blur(10px);
      -webkit-backdrop-filter: saturate(180%) blur(10px);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .alert-pending:hover {
      background: rgba(255, 149, 0, 0.2);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(255, 149, 0, 0.15);
    }
    .alert-pending .pending-count {
      background: #FF9500;
      color: white;
      border-radius: 10px;
      padding: 2px 8px;
      font-weight: 600;
      font-size: 11px;
      min-width: 20px;
      text-align: center;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    
    /* Hierarquia visual melhorada */
    .section-title {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 0.5rem;
      line-height: 1.2;
    }
    
    .section-subtitle {
      font-size: 0.875rem;
      color: #8e8e93;
      margin-bottom: 1.5rem;
    }
    
    .data-highlight {
      font-size: 1.5rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #1d1d1f;
    }
    
    body.dark .data-highlight {
      color: #f5f5f7;
    }
    
    .text-info {
      font-size: 0.875rem;
      color: #8e8e93;
      line-height: 1.5;
    }
    
    /* Liquid Glass Status badges */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      border: 0.5px solid;
      backdrop-filter: blur(12px) saturate(var(--lg-saturate));
      -webkit-backdrop-filter: blur(12px) saturate(var(--lg-saturate));
    }
    
    .status-badge.planned {
      background: rgba(142, 142, 147, 0.15);
      color: #8e8e93;
      border-color: rgba(142, 142, 147, 0.3);
    }
    
    .status-badge.in-progress {
      background: rgba(0, 122, 255, 0.15);
      color: #007AFF;
      border-color: rgba(0, 122, 255, 0.3);
    }
    
    .status-badge.completed {
      background: rgba(52, 199, 89, 0.15);
      color: #34C759;
      border-color: rgba(52, 199, 89, 0.3);
    }
    
    .status-badge.delayed {
      background: rgba(255, 59, 48, 0.15);
      color: #FF3B30;
      border-color: rgba(255, 59, 48, 0.3);
    }
    
    .status-badge.pending {
      background: rgba(255, 149, 0, 0.15);
      color: #FF9500;
      border-color: rgba(255, 149, 0, 0.3);
    }
    
    /* Busca Global - Estilos */
    #global-search-results {
      min-width: 100%;
      width: 100%;
      max-width: 600px;
      min-width: 400px;
      word-wrap: break-word;
      overflow-wrap: break-word;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1);
      padding: 8px;
    }
    
    #global-search-results > div {
      width: 100%;
    }
    
    #global-search-results button {
      white-space: normal;
      word-break: break-word;
      width: 100%;
      padding: 12px 16px;
      text-align: left;
    }
    
    #global-search-results .status-badge {
      flex-shrink: 0;
      white-space: nowrap;
      min-width: fit-content;
    }
    
    #global-search-results .flex {
      gap: 12px;
    }
    
    #global-search-results p {
      margin: 0;
      line-height: 1.5;
    }
    
    @media (max-width: 768px) {
      #global-search-results {
        max-width: calc(100vw - 2rem);
        min-width: calc(100vw - 2rem);
        left: 0 !important;
        right: 0 !important;
      }
    }
    
    /* iOS Table Styles */
    table {
      border-collapse: separate;
      border-spacing: 0;
    }
    
    table thead th {
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      color: #8e8e93;
    }
    
    table tbody tr {
      transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    table tbody tr:hover {
      background-color: rgba(0, 0, 0, 0.02);
    }
    
    /* iOS Loading Spinner */
    @keyframes spin-ios {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .spinner-ios {
      animation: spin-ios 0.8s linear infinite;
    }

    /* Estados do Sistema */
    button.loading {
      opacity: 0.7;
      cursor: not-allowed;
      pointer-events: none;
    }

    button.success {
      background: #34C759 !important;
      border-color: #34C759 !important;
    }

    button.error {
      background: #FF3B30 !important;
      border-color: #FF3B30 !important;
    }

    button.retry {
      background: #FF9500 !important;
      border-color: #FF9500 !important;
      animation: pulse 2s infinite;
    }

    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 12px;
      transition: background-color 0.2s ease;
    }

    .checklist-item:hover {
      background: rgba(0, 122, 255, 0.05);
    }

    body.dark .checklist-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .checklist-item.done label {
      text-decoration: line-through;
      color: #8e8e93;
    }

    .checklist-item input[type="checkbox"] {
      width: 20px;
      height: 20px;
      margin-top: 2px;
      accent-color: #007AFF;
      flex-shrink: 0;
      cursor: pointer;
    }

    .checklist-item input[type="checkbox"]:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .checklist-item-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .checklist-item:hover .checklist-item-actions {
      opacity: 1;
    }

    @media (max-width: 768px) {
      .checklist-item-actions {
        opacity: 1;
      }
    }

    .tarefas-shelf-card {
      aspect-ratio: auto;
      min-height: 180px;
      display: flex;
      flex-direction: column;
    }

    .checklist-phase-locked {
      opacity: 0.55;
      pointer-events: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    /* ── Header compacto ── */
    .header-compact .container { min-height: 52px; }
    .header-compact h1 { font-size: 1.05rem !important; }
    .header-compact .w-10 { width: 2.25rem; height: 2.25rem; }

    /* ── Status cards coloridos ── */
    .status-card--green { border-left: 4px solid #34C759 !important; }
    .status-card--yellow { border-left: 4px solid #FF9500 !important; }
    .status-card--red { border-left: 4px solid #FF3B30 !important; }
    .status-card--blue { border-left: 4px solid #007AFF !important; }
    .status-badge--dot::before {
      content: ''; display: inline-block; width: 8px; height: 8px;
      border-radius: 50%; margin-right: 6px; background: currentColor;
    }

    /* ── Página do curso ── */
    .course-page-header {
      display: flex; flex-wrap: wrap; align-items: center; gap: 1rem;
      padding: 1.25rem; margin-bottom: 1rem;
    }
    .course-back-btn {
      padding: 0.5rem 1rem; border-radius: 10px; border: none;
      background: rgba(142,142,147,0.15); cursor: pointer; font-family: inherit;
    }
    .course-page-title { flex: 1; min-width: 200px; }
    .course-page-title h1 { font-size: 1.35rem; font-weight: 700; margin: 0; }
    .course-section-nav {
      display: flex; gap: 0.35rem; overflow-x: auto; margin-bottom: 1rem; padding-bottom: 0.25rem;
    }
    .course-section-btn {
      padding: 0.5rem 0.85rem; border-radius: 10px; border: none;
      background: rgba(142,142,147,0.12); cursor: pointer; white-space: nowrap;
      font-size: 0.82rem; transition: all 0.2s ease; font-family: inherit;
    }
    .course-section-btn.active { background: #007AFF; color: white; }
    .course-section-content { padding: 1.5rem; }
    .course-info-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;
    }
    .course-info-item {
      display: flex; gap: 0.75rem; align-items: flex-start;
      padding: 0.85rem; border-radius: 12px; background: rgba(142,142,147,0.08);
    }
    .course-info-icon { font-size: 1.25rem; }
    .course-info-item small { display: block; color: #8e8e93; font-size: 0.72rem; }
    .course-link-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      padding: 0.6rem 1rem; border-radius: 10px; border: none;
      background: #007AFF; color: white; cursor: pointer; font-size: 0.85rem;
      text-decoration: none; transition: opacity 0.2s; font-family: inherit;
    }
    .course-link-btn--outline { background: transparent; color: #007AFF; border: 1px solid rgba(0,122,255,0.4); }
    .course-timeline { display: flex; flex-direction: column; gap: 0.75rem; }
    .course-timeline-item { display: flex; gap: 0.75rem; align-items: flex-start; }
    .course-timeline-dot { font-size: 1.1rem; }
    .course-list { list-style: none; padding: 0; margin: 0; }
    .course-list li { padding: 0.5rem 0; border-bottom: 1px solid rgba(0,0,0,0.06); }

    /* ── Instrutores ── */
    .instructor-card { position: relative; padding: 1.25rem; cursor: pointer; }
    .instructor-card-header { display: flex; gap: 0.85rem; align-items: center; margin-bottom: 0.75rem; }
    .instructor-card-title { flex: 1; min-width: 0; }
    .instructor-pending-dot {
      position: absolute;
      top: 10px;
      right: 10px;
      min-width: 22px;
      height: 22px;
      padding: 0 5px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.68rem;
      font-weight: 700;
      line-height: 1;
      color: #1d1d1f;
      background: #FFD60A;
      border: 2px solid rgba(255, 255, 255, 0.9);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
      z-index: 2;
      pointer-events: none;
    }
    body.dark .instructor-pending-dot {
      color: #1c1c1e;
      border-color: rgba(28, 28, 30, 0.9);
    }
    .instructor-avatar {
      width: 44px; height: 44px; border-radius: 12px; background: #007AFF;
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1.1rem;
    }
    .instructor-card-meta { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; color: #8e8e93; }
    .instructor-phone-meta { display: inline-flex; align-items: center; gap: 0.4rem; }
    .instructor-wa-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(52,199,89,0.15); color: #34C759;
      transition: background 0.15s;
    }
    .instructor-wa-btn:hover { background: rgba(52,199,89,0.25); }
    .instructor-wa-btn--sm { width: 24px; height: 24px; border-radius: 6px; }
    .instructor-modal-panel { box-sizing: border-box; position: relative; z-index: 1; }
    #instructor-modal .modal-overlay { z-index: 0; }
    .instructor-modal-panel input,
    .instructor-modal-panel select { box-sizing: border-box; width: 100%; }
    .instructor-course-search {
      width: 100%; padding: 0.65rem 0.85rem; border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.1); background: rgba(142,142,147,0.08);
      font-size: 0.9rem;
    }
    body.dark .instructor-course-search { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); }
    .instructor-course-picker {
      margin-top: 0.35rem; border-radius: 10px; overflow: hidden;
      border: 1px solid rgba(0,0,0,0.08); max-height: 220px; overflow-y: auto;
    }
    .instructor-picker-item {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem;
      width: 100%; padding: 0.65rem 0.85rem; border: none; border-bottom: 1px solid rgba(0,0,0,0.06);
      background: rgba(142,142,147,0.06); cursor: pointer; text-align: left; font-family: inherit;
    }
    .instructor-picker-item:hover { background: rgba(0,122,255,0.1); }
    .instructor-picker-item strong { font-size: 0.88rem; }
    .instructor-picker-item small { font-size: 0.75rem; color: #8e8e93; }
    .instructor-picker-empty { padding: 0.75rem; font-size: 0.85rem; color: #8e8e93; }
    .instructor-pagamento-row {
      display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;
      cursor: default;
    }
    .instructor-pagamento-row:hover { background: rgba(142,142,147,0.08); }
    .instructor-pagamento-info { min-width: 0; flex: 1; }
    .instructor-pagamento-info small { display: block; color: #8e8e93; margin-top: 0.15rem; }
    .instructor-pagamento-actions { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }
    .instructor-del-btn {
      width: 22px; height: 22px; border: none; border-radius: 6px;
      background: transparent; color: #8e8e93; font-size: 1.1rem; line-height: 1;
      cursor: pointer; padding: 0;
    }
    .instructor-del-btn:hover { background: rgba(255,59,48,0.12); color: #FF3B30; }
    .instructor-card-del-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #8e8e93;
      font-size: 1.15rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      z-index: 3;
      opacity: 0.5;
      transition: opacity 0.15s, background 0.15s, color 0.15s;
    }
    .instructor-card:hover .instructor-card-del-btn,
    .instructor-card-del-btn:focus,
    .instructor-page-del-btn {
      opacity: 1;
    }
    .instructor-card-del-btn:hover,
    .instructor-page-del-btn:hover {
      background: rgba(255,59,48,0.12);
      color: #FF3B30;
    }
    .instructor-card--has-pending .instructor-card-del-btn {
      right: 36px;
    }
    .instructor-page-del-btn {
      position: static;
      flex-shrink: 0;
    }
    .instructor-page-actions {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .instructor-section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .instructor-section-header .section-title-sm { margin-bottom: 0; }
    .instructor-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; border-radius: 8px;
      background: rgba(142,142,147,0.12); color: #8e8e93; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .instructor-icon-btn:hover { background: rgba(0,122,255,0.12); color: #007AFF; }
    .instructor-course-search-wrap { margin-bottom: 0.75rem; }
    .instructor-course-row {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      cursor: default;
    }
    .instructor-course-row:hover { background: rgba(0,122,255,0.08); }
    .instructor-course-info { flex: 1; min-width: 0; cursor: pointer; }
    .instructor-course-info small { display: block; color: #8e8e93; margin-top: 0.15rem; }

    /* ── Modal do curso ── */
    .course-modal-panel { box-sizing: border-box; }
    #course-page-content .course-page-header { margin-bottom: 0.75rem; }
    #course-page-content .course-section-nav { margin-bottom: 0.75rem; }
    .section-title-sm { font-size: 1rem; font-weight: 600; }

    /* ── Animações ── */
    .page-enter { animation: pageEnter 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
    .modal-enter { animation: modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    @keyframes pageEnter {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes modalEnter {
      from { opacity: 0; transform: scale(0.94) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* ══════════════════════════════════════════
       iOS Liquid Glass — Global Enhancements
       ══════════════════════════════════════════ */

    main[id^="content-"] {
      animation: pageEnter 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .section-title {
      background: linear-gradient(135deg, var(--lg-text) 0%, var(--lg-text-muted) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    body.dark .section-title {
      background: linear-gradient(135deg, #f5f5f7 0%, #98989d 100%);
      -webkit-background-clip: text;
      background-clip: text;
    }

    .list-item-row {
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
      background: var(--lg-bg-subtle);
      backdrop-filter: blur(16px) saturate(var(--lg-saturate));
      -webkit-backdrop-filter: blur(16px) saturate(var(--lg-saturate));
      border: 0.5px solid var(--lg-border-subtle);
      border-radius: var(--lg-radius-sm);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }
    body.dark .list-item-row {
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .list-item-row:hover {
      background: var(--lg-bg);
      border-color: var(--lg-border);
    }

    .course-back-btn {
      background: var(--lg-bg-subtle);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 0.5px solid var(--lg-border-subtle);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }

    .course-section-btn {
      background: var(--lg-bg-subtle);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 0.5px solid var(--lg-border-subtle);
    }
    .course-section-btn.active {
      background: linear-gradient(145deg, rgba(0, 122, 255, 0.9), rgba(0, 100, 220, 0.85));
      border-color: rgba(255, 255, 255, 0.25);
      box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }

    .course-info-item {
      background: var(--lg-bg-subtle);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 0.5px solid var(--lg-border-subtle);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }

    .course-link-btn {
      background: linear-gradient(145deg, rgba(0, 122, 255, 0.95), rgba(0, 100, 220, 0.9));
      border: 0.5px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 16px rgba(0, 122, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }
    .course-link-btn--outline {
      background: var(--lg-bg-subtle);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: var(--lg-accent);
      border: 0.5px solid rgba(0, 122, 255, 0.35);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }
    .course-link-btn--outline:hover {
      background: rgba(0, 122, 255, 0.12);
    }

    .instructor-avatar {
      background: linear-gradient(145deg, rgba(0, 122, 255, 0.9), rgba(90, 200, 250, 0.8));
      box-shadow: 0 4px 16px rgba(0, 122, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
      border-radius: 14px;
    }

    .instructor-card {
      border-radius: var(--lg-radius);
    }

    .status-card--green,
    .status-card--yellow,
    .status-card--red,
    .status-card--blue {
      border-left-width: 3px !important;
      box-shadow: var(--lg-shadow), inset 3px 0 12px rgba(0, 0, 0, 0.03);
    }

    #global-search-results {
      background: var(--lg-bg-elevated) !important;
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur)) !important;
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur)) !important;
      border: 0.5px solid var(--lg-border) !important;
      border-radius: var(--lg-radius) !important;
      box-shadow: var(--lg-shadow-lg) !important;
    }

    #initial-loading,
    #login-loading {
      background: var(--lg-bg-elevated) !important;
      backdrop-filter: blur(var(--lg-blur));
      -webkit-backdrop-filter: blur(var(--lg-blur));
    }

    .checklist-item {
      background: var(--lg-bg-subtle);
      border: 0.5px solid var(--lg-border-subtle);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .alert-pending {
      backdrop-filter: blur(16px) saturate(var(--lg-saturate));
      -webkit-backdrop-filter: blur(16px) saturate(var(--lg-saturate));
      border-radius: 20px;
    }

    /* Cronograma cards — remove inline hover scale conflict, use glass */
    [onclick*="openCoursePage"].card-elegant,
    [onclick*="navigateToCourse"].card-secondary {
      overflow: hidden;
      position: relative;
    }
    [onclick*="openCoursePage"].card-elegant::before,
    [onclick*="navigateToCourse"].card-secondary::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 50%);
      pointer-events: none;
      border-radius: inherit;
    }
    body.dark [onclick*="openCoursePage"].card-elegant::before,
    body.dark [onclick*="navigateToCourse"].card-secondary::before {
      background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%);
    }

    /* Tab bar glass pill (desktop) */
    @media (min-width: 768px) {
      .header-tabs {
        background: var(--lg-bg-subtle);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: var(--lg-radius-sm);
        border: 0.5px solid var(--lg-border-subtle);
        padding: 0.2rem;
      }
    }

    /* Toast glass */
    #toast-container > div {
      backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm)) !important;
      -webkit-backdrop-filter: saturate(var(--lg-saturate)) blur(var(--lg-blur-sm)) !important;
      border: 0.5px solid var(--lg-border) !important;
      box-shadow: var(--lg-shadow) !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .ambient-orb { animation: none; }
    }