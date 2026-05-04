/* ============================================================
 *  Win95-style Desktop
 * ============================================================ */
(() => {
  const desktop = document.getElementById('desktop');
  const ctx = document.getElementById('ctx-menu');
  const winCtx = document.getElementById('win-ctx-menu');
  const textCtx = document.getElementById('text-ctx-menu');
  const settingsWin = document.getElementById('settings-window');
  const iconPropsDialog = document.getElementById('icon-props');

  /* ---------- State ---------- */
  const DEFAULTS = {
    bg: '#0a0a0a',
    line: '#1f1f1f',
    lineW: 1,
    dot: '#5a5a5a',
    dotSize: 1,
    grid: 40,
    tb: '#1a1a2e',
    tbText: '#e6e6e6',
    face: '#2a2a2a',
    hi: '#3d3d3d',
    sh: '#0d0d0d',
    text: '#e6e6e6',
    w: 4,
    h: 3,
    title: 'Menu',
  };
  let state = { ...DEFAULTS };

  // Layout constants used across functions.
  const TASKBAR_H = 30;          // taskbar height + breathing room
  const FRAME_RELOAD_DELAY = 30; // ms; lets src='' settle before reassigning

  // remember the position the user right-clicked at
  let lastClick = { x: 0, y: 0 };
  let zCounter = 100;

  // window-icon context state
  let activeIconCtx = { win: null, iconEl: null, x: 0, y: 0 };
  // properties dialog state: editing existing icon or creating new one
  let propsState = { mode: 'new', win: null, iconEl: null, image: '📁', imageType: 'emoji' };

  /* ---------- Apply CSS variables from state ---------- */
  function applyState() {
    const r = document.documentElement.style;
    r.setProperty('--bg', state.bg);
    r.setProperty('--line', state.line);
    r.setProperty('--line-w', state.lineW + 'px');
    r.setProperty('--dot', state.dot);
    r.setProperty('--dot-size', state.dotSize + 'px');
    r.setProperty('--grid', state.grid + 'px');
    r.setProperty('--tb', state.tb);
    r.setProperty('--tb-text', state.tbText);
    r.setProperty('--face', state.face);
    r.setProperty('--hi', state.hi);
    r.setProperty('--sh', state.sh);
    r.setProperty('--text', state.text);
  }

  /* ---------- Snap helpers ---------- */
  function snap(v) {
    const g = state.grid > 0 ? state.grid : 1;
    return Math.round(v / g) * g;
  }

  /* ---------- Context Menu ---------- */
  function openMenu(x, y) {
    ctx.hidden = false;
    const rect = ctx.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 2;
    const maxY = window.innerHeight - rect.height - 2;
    ctx.style.left = Math.min(x, maxX) + 'px';
    ctx.style.top = Math.min(y, maxY) + 'px';
  }
  function closeMenu() { ctx.hidden = true; }

  desktop.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    lastClick = { x: e.clientX, y: e.clientY };
    openMenu(e.clientX, e.clientY);
  });

  // Right-click on any text input/textarea anywhere shows a Cut/Copy/Paste menu.
  // Capture phase so we beat per-window contextmenu handlers that suppress default.
  let textCtxTarget = null;
  function isEditableText(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return !el.disabled && !el.readOnly;
    if (el.tagName === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      const editable = ['text','search','url','tel','password','email','number'];
      return editable.includes(t) && !el.disabled && !el.readOnly;
    }
    return false;
  }
  function openTextCtx(x, y, hasSelection) {
    textCtx.hidden = false;
    // Disable cut/copy when there's no selection; disable paste if clipboard API unavailable.
    textCtx.querySelectorAll('li[data-action]').forEach(li => {
      const a = li.dataset.action;
      let disabled = false;
      if ((a === 'cut' || a === 'copy') && !hasSelection) disabled = true;
      li.style.opacity = disabled ? '0.4' : '';
      li.style.pointerEvents = disabled ? 'none' : '';
    });
    const r = textCtx.getBoundingClientRect();
    textCtx.style.left = Math.min(x, window.innerWidth - r.width - 2) + 'px';
    textCtx.style.top = Math.min(y, window.innerHeight - r.height - 2) + 'px';
    textCtx.style.zIndex = String(++zCounter);
  }
  function closeTextCtx() { textCtx.hidden = true; textCtxTarget = null; }
  document.addEventListener('contextmenu', (e) => {
    const el = e.target;
    if (!isEditableText(el)) return;
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    closeWinCtx();
    textCtxTarget = el;
    const hasSel = (el.selectionStart != null && el.selectionEnd != null && el.selectionStart !== el.selectionEnd);
    openTextCtx(e.clientX, e.clientY, hasSel);
  }, true);
  textCtx.addEventListener('mousedown', (e) => e.stopPropagation());
  textCtx.addEventListener('click', async (e) => {
    const li = e.target.closest('li[data-action]');
    if (!li) return;
    const action = li.dataset.action;
    const el = textCtxTarget;
    closeTextCtx();
    if (!el) return;
    el.focus();
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    if (action === 'select-all') {
      el.select();
      return;
    }
    if (action === 'copy' || action === 'cut') {
      const text = el.value.substring(start, end);
      try { await navigator.clipboard.writeText(text); } catch (_) {
        // Fallback to execCommand for older browsers.
        try { document.execCommand(action); } catch (_) {}
      }
      if (action === 'cut') {
        el.setRangeText('', start, end, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    if (action === 'paste') {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch (_) {
        try { document.execCommand('paste'); return; } catch (_) {}
      }
      if (text) {
        el.setRangeText(text, start, end, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!ctx.hidden && !ctx.contains(e.target)) closeMenu();
    if (!winCtx.hidden && !winCtx.contains(e.target)) closeWinCtx();
    if (!textCtx.hidden && !textCtx.contains(e.target)) closeTextCtx();
    const whCtx = document.getElementById('win-header-ctx');
    if (whCtx && !whCtx.hidden && !whCtx.contains(e.target)) whCtx.hidden = true;
    const tbCtx = document.getElementById('taskbar-ctx');
    if (tbCtx && !tbCtx.hidden && !tbCtx.contains(e.target)) tbCtx.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMenu();
      closeWinCtx();
      closeTextCtx();
      if (!iconPropsDialog.hidden) iconPropsDialog.hidden = true;
      const whCtx = document.getElementById('win-header-ctx');
      if (whCtx && !whCtx.hidden) whCtx.hidden = true;
      const tbCtx = document.getElementById('taskbar-ctx');
      if (tbCtx && !tbCtx.hidden) tbCtx.hidden = true;
      const sd = document.getElementById('shortcuts-dialog');
      if (sd && !sd.hidden) sd.hidden = true;
      const cd = document.getElementById('compare-dialog');
      if (cd && !cd.hidden) cd.hidden = true;
      const cf = document.getElementById('confirm-dialog');
      if (cf && !cf.hidden) cf.hidden = true;
    }
  });

  ctx.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-action]');
    if (!li) return;
    const action = li.dataset.action;
    closeMenu();
    if (action === 'new-window') createLinkWindow(lastClick.x, lastClick.y);
    if (action === 'toggle-settings') toggleSettings();
    if (action === 'clear-windows') {
      const n = desktop.querySelectorAll('.win95-window').length;
      confirmDialog('Close all ' + n + ' open windows? This cannot be undone (use Ctrl+Shift+T to reopen one).', clearWindows);
    }
    if (action === 'save-template') saveTemplate();
    if (action === 'load-template') loadTemplate();
    if (action === 'refresh-all') refreshAllIframes();
    if (action === 'cascade') cascadeWindows();
    if (action === 'tile-h') tileWindows('h');
    if (action === 'tile-v') tileWindows('v');
    if (action === 'min-all') minimizeAll();
    if (action === 'restore-all') restoreAll();
    if (action === 'shortcuts') openShortcuts();
  });

  /* ---------- Taskbar (minimize) ---------- */
  const taskbar = document.getElementById('taskbar-items') || document.getElementById('taskbar');
  // Map<windowEl, taskbarButtonEl>
  const taskbarMap = new Map();
  // Map<windowEl, currentlyShownTooltipEl>
  let _taskbarTip = null;

  function registerTaskbarItem(win, { icon, label }) {
    if (!taskbar || taskbarMap.has(win)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'taskbar-item';
    btn.innerHTML = `<span class="ti-icon"></span><span class="ti-label"></span>`;
    btn.querySelector('.ti-icon').textContent = icon || '🗔';
    btn.querySelector('.ti-label').textContent = label || 'Untitled';
    btn.title = label || 'Untitled';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (win.classList.contains('minimized')) {
        restoreWindow(win);
      } else {
        // Already visible: if it's the focused window, minimize; otherwise raise it.
        const z = parseInt(win.style.zIndex || '0', 10);
        if (z >= zCounter - 1) {
          minimizeWindow(win);
        } else {
          win.style.zIndex = String(++zCounter);
          setActiveTaskbarItem(win);
        }
      }
    });
    // Right-click on a taskbar item shows window controls.
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTaskbarCtx(e.clientX, e.clientY, win);
    });
    // Hover tooltip with full title and (if widget) the current symbol.
    btn.addEventListener('mouseenter', () => showTaskbarTip(btn, win));
    btn.addEventListener('mouseleave', hideTaskbarTip);
    taskbar.appendChild(btn);
    taskbarMap.set(win, btn);
    setActiveTaskbarItem(win);
  }

  function showTaskbarTip(btn, win) {
    hideTaskbarTip();
    const titleEl = win.querySelector('.win95-title');
    const title = titleEl ? titleEl.textContent.trim() : 'Window';
    let extra = '';
    if (win.classList.contains('browser-window')) {
      const slug = win.dataset.widgetSlug;
      if (slug && TICKERABLE_WIDGETS.has(slug)) {
        const parent = win._parentMenuWin;
        const sym = parent ? (parent.dataset.tickerSymbol || '') : '';
        if (sym) extra = '\nTicker: ' + sym;
      }
      const f = win.querySelector('.browser-frame');
      if (f) {
        const url = f.getAttribute('src') || '';
        if (url && !url.startsWith('widget.html')) extra += '\n' + url;
      }
    }
    const tip = document.createElement('div');
    tip.className = 'taskbar-tip';
    tip.textContent = title + extra;
    tip.style.whiteSpace = 'pre-line';
    document.body.appendChild(tip);
    const r = btn.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let left = r.left + (r.width - tr.width) / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - tr.width - 4));
    tip.style.left = left + 'px';
    tip.style.top = (r.top - tr.height - 6) + 'px';
    _taskbarTip = tip;
  }
  function hideTaskbarTip() {
    if (_taskbarTip) { _taskbarTip.remove(); _taskbarTip = null; }
  }

  function unregisterTaskbarItem(win) {
    const btn = taskbarMap.get(win);
    if (btn) btn.remove();
    taskbarMap.delete(win);
  }

  function setActiveTaskbarItem(win) {
    if (!taskbar) return;
    taskbarMap.forEach((btn, w) => {
      btn.classList.toggle('active', w === win && !w.classList.contains('minimized'));
    });
  }

  function minimizeWindow(win) {
    win.classList.add('minimized');
    setActiveTaskbarItem(null);
    // Update taskbar item state.
    const btn = taskbarMap.get(win);
    if (btn) btn.classList.remove('active');
  }

  function restoreWindow(win) {
    win.classList.remove('minimized');
    win.style.zIndex = String(++zCounter);
    setActiveTaskbarItem(win);
  }

  // Returns the currently-focused (top-z) non-minimized window, or null.
  function getActiveWindow() {
    let best = null, bestZ = -1;
    desktop.querySelectorAll('.win95-window').forEach(w => {
      if (w.classList.contains('minimized')) return;
      if (w.hidden) return;
      const z = parseInt(w.style.zIndex || '0', 10);
      if (z > bestZ) { bestZ = z; best = w; }
    });
    return best;
  }

  // Returns all open user windows (excluding settings/icon-props/etc).
  function getAllUserWindows() {
    return Array.from(desktop.querySelectorAll('.win95-window')).filter(w => {
      return w !== settingsWin && w !== iconPropsDialog
        && w.id !== 'shortcuts-dialog' && w.id !== 'compare-dialog' && w.id !== 'confirm-dialog'
        && w.id !== 'tv-search-popup' && w.id !== 'add-widget-popup';
    });
  }

  // Toggle a window between maximized (covering the desktop above the taskbar)
  // and its previous size/position. Stores the pre-maximize geometry on the
  // element so we can restore it cleanly.
  function toggleMaximize(win) {
    if (win.dataset.maximized === 'true') {
      const prev = win._preMaxRect;
      if (prev) {
        win.style.left = prev.left;
        win.style.top = prev.top;
        win.style.width = prev.width;
        win.style.height = prev.height;
      }
      win.dataset.maximized = 'false';
      const btn = win.querySelector('[data-act="maximize"]');
      if (btn) btn.textContent = '▢';
    } else {
      win._preMaxRect = {
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
      };
      win.style.left = '0px';
      win.style.top = '0px';
      win.style.width = window.innerWidth + 'px';
      win.style.height = (window.innerHeight - TASKBAR_H) + 'px';
      win.dataset.maximized = 'true';
      const btn = win.querySelector('[data-act="maximize"]');
      if (btn) btn.textContent = '❐';
    }
    win.style.zIndex = String(++zCounter);
    setActiveTaskbarItem(win);
    // Re-flow icons if this is a menu window so the grid follows the new size.
    relayoutMenuIcons(win);
  }

  /* ---------- Ticker presets ---------- */
  // Widget slugs whose config has a single `symbol` field that we can override
  // via the &symbol= query param. Other widgets use multi-symbol arrays or
  // market-wide data that don't fit a single ticker.
  const TICKERABLE_WIDGETS = new Set([
    'advanced-chart',
    'mini-symbol-overview',
    'symbol-info',
    'technical-analysis',
    'financials',
    'symbol-profile',
    'single-quote',
  ]);

  // Built-in ticker presets shown in the dropdown.
  const TICKER_PRESETS = [
    { label: 'Bitcoin (BTC)',  symbol: 'BITSTAMP:BTCUSD' },
    { label: 'Ethereum (ETH)', symbol: 'BITSTAMP:ETHUSD' },
    { label: 'Solana (SOL)',   symbol: 'BINANCE:SOLUSDT' },
    { label: 'Apple (AAPL)',   symbol: 'NASDAQ:AAPL' },
    { label: 'Microsoft (MSFT)', symbol: 'NASDAQ:MSFT' },
    { label: 'Nvidia (NVDA)',  symbol: 'NASDAQ:NVDA' },
    { label: 'Tesla (TSLA)',   symbol: 'NASDAQ:TSLA' },
    { label: 'Amazon (AMZN)',  symbol: 'NASDAQ:AMZN' },
    { label: 'Google (GOOGL)', symbol: 'NASDAQ:GOOGL' },
    { label: 'Meta (META)',   symbol: 'NASDAQ:META' },
    { label: 'S&P 500',        symbol: 'FOREXCOM:SPXUSD' },
    { label: 'Nasdaq 100',     symbol: 'FOREXCOM:NSXUSD' },
    { label: 'Dow 30',         symbol: 'FOREXCOM:DJI' },
    { label: 'Gold',           symbol: 'COMEX:GC1!' },
    { label: 'EUR/USD',        symbol: 'FX:EURUSD' },
  ];

  function buildMenuToolbarHtml(currentSymbol) {
    const cur = currentSymbol || 'BITSTAMP:BTCUSD';
    return `
      <div class="menu-toolbar">
        <div class="mt-group" data-group="ticker">
          <label>Ticker:</label>
          <select class="menu-ticker-select"></select>
          <input class="menu-ticker-input" type="text" placeholder="e.g. NASDAQ:AAPL" value="${escapeAttr(cur)}" />
          <button class="menu-ticker-apply" type="button">Apply</button>
          <button class="menu-ticker-fav" type="button" title="Toggle favorite for current ticker">☆</button>
          <button class="menu-ticker-search" type="button" title="Search TradingView for a ticker and add it to the list">Search…</button>
          <button class="menu-ticker-compare" type="button" title="Open a grid of multiple tickers">Compare…</button>
        </div>
        <span class="mt-sep"></span>
        <div class="mt-group" data-group="search">
          <input class="menu-icon-search" type="text" placeholder="Filter widgets…" />
          <input class="menu-web-search" type="text" placeholder="Search the web for widgets…" style="width:180px;" />
          <button class="menu-add-widget" type="button" title="Paste an iframe URL to add as a custom widget icon">Add Widget</button>
          <button class="menu-new-folder" type="button" title="Add a new folder icon to this menu">New Folder</button>
        </div>
        <span class="mt-sep"></span>
        <div class="mt-group" data-group="open">
          <button class="menu-open-all menu-primary" type="button" title="Open every widget in this menu">Open All</button>
          <button class="menu-close-all menu-primary" type="button" title="Close every widget opened from this menu">Close All</button>
          <button class="menu-open-tickerable" type="button" title="Open only widgets that update with the selected ticker">Ticker Widgets</button>
          <button class="menu-open-heatmaps" type="button" title="Open only heatmap widgets">Heatmaps</button>
        </div>
        <span class="mt-sep"></span>
        <div class="mt-group" data-group="arrange">
          <button class="menu-cascade" type="button" title="Cascade all open windows">Cascade</button>
          <button class="menu-tile" type="button" title="Tile all open windows">Tile</button>
        </div>
        <span class="mt-sep"></span>
        <div class="mt-group" data-group="template">
          <button class="menu-save-template" type="button" title="Save current windows as a template file">Save Template</button>
          <button class="menu-load-template" type="button" title="Load a template file">Load Template</button>
          <button class="menu-autosave" type="button" title="Toggle layout autosave">Autosave: Off</button>
        </div>
        <span class="mt-flex"></span>
        <div class="mt-group" data-group="system">
          <button class="menu-settings" type="button" title="Display settings (grid, snap, theme)">⚙ Settings</button>
          <button class="menu-shortcuts" type="button" title="Show keyboard shortcuts (F1)">⌨ Shortcuts</button>
        </div>
      </div>
    `;
  }

  // Re-populate the ticker dropdown for a given menu window.
  // Order: Favorites -> Recents -> Built-in presets -> any custom symbols already added.
  function rebuildTickerSelect(win) {
    const sel = win.querySelector('.menu-ticker-select');
    if (!sel) return;
    const cur = win.dataset.tickerSymbol || 'BITSTAMP:BTCUSD';
    sel.innerHTML = '';
    const seen = new Set();
    const addOption = (label, value, fav) => {
      if (seen.has(value)) return;
      seen.add(value);
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      if (fav) o.classList.add('fav');
      sel.appendChild(o);
    };
    const addGroup = (label, items, fav) => {
      if (!items.length) return;
      const og = document.createElement('optgroup');
      og.label = label;
      items.forEach(it => {
        if (seen.has(it.symbol)) return;
        seen.add(it.symbol);
        const o = document.createElement('option');
        o.value = it.symbol;
        o.textContent = it.label || it.symbol;
        if (fav) o.classList.add('fav');
        og.appendChild(o);
      });
      if (og.childNodes.length) sel.appendChild(og);
    };
    addGroup('★ Favorites', tickerFavorites.map(s => ({ symbol: s, label: s })), true);
    addGroup('Recent', tickerHistory.slice(0, 10).map(s => ({ symbol: s, label: s })));
    addGroup('Presets', TICKER_PRESETS);
    if (!seen.has(cur)) addOption(cur + ' (custom)', cur);
    sel.value = cur;
  }

  // Shared markup for a Menu window (used by createLinkWindow + recreateWindow).
  function buildMenuWindowHtml(titleText, symbol) {
    return `
      <div class="win95-titlebar">
        <span class="win95-title">${escapeHtml(titleText)}</span>
        <div class="win95-titlebar-buttons">
          <button class="win95-tb-btn" data-act="minimize" title="Minimize">_</button>
          <button class="win95-tb-btn" data-act="maximize" title="Maximize">▢</button>
          <button class="win95-tb-btn" data-act="close" title="Close">✕</button>
        </div>
      </div>
      ${buildMenuToolbarHtml(symbol)}
      <div class="win95-body"></div>
      <div class="resize-handle nw" data-resize="nw"></div>
      <div class="resize-handle ne" data-resize="ne"></div>
      <div class="resize-handle sw" data-resize="sw"></div>
      <div class="resize-handle se" data-resize="se"></div>
    `;
  }

  function wireMenuToolbar(win) {
    const sel = win.querySelector('.menu-ticker-select');
    const inp = win.querySelector('.menu-ticker-input');
    const btn = win.querySelector('.menu-ticker-apply');
    const favBtn = win.querySelector('.menu-ticker-fav');
    const compareBtn = win.querySelector('.menu-ticker-compare');
    const openAll = win.querySelector('.menu-open-all');
    const openTickerable = win.querySelector('.menu-open-tickerable');
    const openHeatmaps = win.querySelector('.menu-open-heatmaps');
    const closeAll = win.querySelector('.menu-close-all');
    const saveTpl = win.querySelector('.menu-save-template');
    const loadTpl = win.querySelector('.menu-load-template');
    const autosaveBtn = win.querySelector('.menu-autosave');
    const cascadeBtn = win.querySelector('.menu-cascade');
    const tileBtn = win.querySelector('.menu-tile');
    const searchBtn = win.querySelector('.menu-ticker-search');
    const iconSearch = win.querySelector('.menu-icon-search');
    const webSearch = win.querySelector('.menu-web-search');
    const addWidgetBtn = win.querySelector('.menu-add-widget');
    const newFolderBtn = win.querySelector('.menu-new-folder');
    const settingsBtn = win.querySelector('.menu-settings');
    const shortcutsBtn = win.querySelector('.menu-shortcuts');
    if (settingsBtn) settingsBtn.addEventListener('click', toggleSettings);
    if (shortcutsBtn) shortcutsBtn.addEventListener('click', openShortcuts);
    if (!sel || !inp || !btn) return;
    rebuildTickerSelect(win);
    syncFavButton(win);
    sel.addEventListener('change', () => {
      inp.value = sel.value;
      setWindowSymbol(win, sel.value);
      addToTickerHistory(sel.value);
      rebuildAllTickerSelects();
      syncFavButton(win);
    });
    btn.addEventListener('click', () => {
      const v = (inp.value || '').trim();
      if (!v) return;
      setWindowSymbol(win, v);
      addToTickerHistory(v);
      rebuildAllTickerSelects();
      syncFavButton(win);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btn.click();
      }
    });
    if (favBtn) favBtn.addEventListener('click', () => {
      const cur = (win.dataset.tickerSymbol || '').trim();
      if (!cur) return;
      toggleFavoriteTicker(cur);
      rebuildAllTickerSelects();
      syncFavButton(win);
      showToast((tickerFavorites.includes(cur) ? 'Added ' : 'Removed ') + cur + (tickerFavorites.includes(cur) ? ' to favorites' : ' from favorites'));
    });
    if (compareBtn) compareBtn.addEventListener('click', () => openCompareDialog(win));
    if (openAll) openAll.addEventListener('click', () => {
      // close any currently-open widgets first so the new set always tiles cleanly.
      closeAllWidgets(win, { keepMenuSize: true });
      openAllWidgets(win);
    });
    if (openTickerable) openTickerable.addEventListener('click', () => {
      // close any currently-open widgets first so the new set always tiles cleanly.
      closeAllWidgets(win, { keepMenuSize: true });
      openAllWidgets(win, { tickerableOnly: true });
    });
    if (openHeatmaps) openHeatmaps.addEventListener('click', () => {
      closeAllWidgets(win, { keepMenuSize: true });
      openAllWidgets(win, { heatmapsOnly: true });
    });
    if (closeAll) closeAll.addEventListener('click', () => {
      // Confirm if 5+ windows would be closed.
      const n = Array.from(desktop.querySelectorAll('.browser-window')).filter(bw => bw._parentMenuWin === win).length;
      if (n >= 5) {
        confirmDialog('Close all ' + n + ' open widgets from this menu?', () => closeAllWidgets(win));
      } else {
        closeAllWidgets(win);
      }
    });
    if (saveTpl) saveTpl.addEventListener('click', () => saveTemplate());
    if (loadTpl) loadTpl.addEventListener('click', () => loadTemplate());
    if (autosaveBtn) autosaveBtn.addEventListener('click', () => toggleAutosave(autosaveBtn));
    if (cascadeBtn) cascadeBtn.addEventListener('click', cascadeWindows);
    if (tileBtn) tileBtn.addEventListener('click', () => tileWindows('grid'));
    if (searchBtn) searchBtn.addEventListener('click', () => openTickerSearch(win, sel, inp));
    if (iconSearch) {
      iconSearch.addEventListener('input', () => filterIconsInWindow(win, iconSearch.value));
      iconSearch.addEventListener('mousedown', (e) => e.stopPropagation());
      iconSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { iconSearch.value = ''; filterIconsInWindow(win, ''); }
      });
    }
    if (webSearch) {
      webSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const q = (webSearch.value || '').trim();
          if (!q) return;
          // Prepend useful keywords so results lean toward embeddable widgets.
          const enriched = q + ' embed widget iframe';
          window.open('https://duckduckgo.com/?q=' + encodeURIComponent(enriched), '_blank', 'noopener');
        }
      });
      webSearch.addEventListener('mousedown', (e) => e.stopPropagation());
    }
    if (addWidgetBtn) addWidgetBtn.addEventListener('click', () => openAddWidgetDialog(win));
    if (newFolderBtn) newFolderBtn.addEventListener('click', () => addFolderIcon(win));
    // stop drags from bubbling to titlebar
    [sel, inp, btn, favBtn, compareBtn, openAll, openTickerable, openHeatmaps, closeAll, saveTpl, loadTpl, autosaveBtn, cascadeBtn, tileBtn, searchBtn, iconSearch, webSearch, addWidgetBtn, newFolderBtn].forEach(el => {
      if (el) el.addEventListener('mousedown', e => e.stopPropagation());
    });
  }

  // Hide icons whose name doesn't include the query (case-insensitive).
  function filterIconsInWindow(win, query) {
    const q = (query || '').trim().toLowerCase();
    win.querySelectorAll('.win-icon').forEach(ic => {
      const name = (ic.dataset.name || '').toLowerCase();
      const match = !q || name.includes(q);
      ic.dataset.hiddenBySearch = match ? 'false' : 'true';
    });
  }

  function syncFavButton(win) {
    const favBtn = win.querySelector('.menu-ticker-fav');
    if (!favBtn) return;
    const cur = win.dataset.tickerSymbol || '';
    favBtn.textContent = tickerFavorites.includes(cur) ? '★' : '☆';
    favBtn.title = tickerFavorites.includes(cur) ? 'Remove from favorites' : 'Add to favorites';
  }

  function rebuildAllTickerSelects() {
    desktop.querySelectorAll('.win95-window').forEach(w => {
      if (w.querySelector('.menu-ticker-select')) rebuildTickerSelect(w);
    });
  }

  // Open a small popup that searches TradingView's symbol-search endpoint.
  // The user picks a result; we add it to the dropdown (if not already there)
  // and apply it as the active ticker for this menu window.
  function openTickerSearch(win, sel, inp) {
    // Tear down any existing popup first.
    const existing = document.getElementById('tv-search-popup');
    if (existing) existing.remove();

    const pop = document.createElement('div');
    pop.id = 'tv-search-popup';
    pop.className = 'win95-window';
    pop.style.position = 'fixed';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
    pop.style.width = '520px';
    pop.style.height = '300px';
    pop.style.zIndex = String(++zCounter);
    pop.innerHTML = `
      <div class="win95-titlebar">
        <span class="win95-title">Search TradingView</span>
        <div class="win95-titlebar-buttons">
          <button class="win95-tb-btn" data-act="close" title="Close">✕</button>
        </div>
      </div>
      <div class="win95-body" style="display:flex; flex-direction:column; gap:8px; padding:10px; font-size:12px;">
        <div><b>Step 1.</b> Type a query and click Open Search. TradingView opens in a new tab.</div>
        <div style="display:flex; gap:6px;">
          <input id="tv-search-q" type="text" placeholder="e.g. apple, btc, eurusd" style="flex:1;" />
          <button id="tv-search-go" type="button">Open Search</button>
        </div>
        <div><b>Step 2.</b> On TradingView, find your symbol and copy its full ticker (shown as <code>EXCHANGE:SYMBOL</code>, e.g. <code>NASDAQ:AAPL</code>).</div>
        <div><b>Step 3.</b> Paste it here and click Add.</div>
        <div style="display:flex; gap:6px;">
          <input id="tv-search-paste" type="text" placeholder="EXCHANGE:SYMBOL" style="flex:1;" />
          <input id="tv-search-label" type="text" placeholder="Display name (optional)" style="flex:1;" />
          <button id="tv-search-add" type="button">Add</button>
        </div>
        <div id="tv-search-status" style="font-size:11px; opacity:0.7; min-height:14px;"></div>
      </div>
    `;
    desktop.appendChild(pop);
    makeDialogDraggable(pop);

    const closeBtn = pop.querySelector('[data-act="close"]');
    const qInp = pop.querySelector('#tv-search-q');
    const goBtn = pop.querySelector('#tv-search-go');
    const pasteInp = pop.querySelector('#tv-search-paste');
    const labelInp = pop.querySelector('#tv-search-label');
    const addBtn = pop.querySelector('#tv-search-add');
    const status = pop.querySelector('#tv-search-status');

    closeBtn.addEventListener('click', () => pop.remove());

    function openSearch() {
      const q = (qInp.value || '').trim();
      const url = q
        ? ('https://www.tradingview.com/symbols/' + encodeURIComponent(q) + '/')
        : 'https://www.tradingview.com/markets/';
      // Try a generic search first — TradingView's main search page works from a query string too.
      const searchUrl = q
        ? ('https://www.tradingview.com/search/?text=' + encodeURIComponent(q))
        : 'https://www.tradingview.com/markets/';
      window.open(searchUrl, '_blank', 'noopener');
      status.textContent = 'Opened TradingView search. Copy the ticker (EXCHANGE:SYMBOL) and paste below.';
      setTimeout(() => pasteInp.focus(), 100);
    }

    function addSymbol() {
      const raw = (pasteInp.value || '').trim();
      if (!raw) { status.textContent = 'Paste a symbol first.'; return; }
      // Normalize: strip whitespace, ensure uppercase. Accept either EXCHANGE:SYMBOL or just SYMBOL.
      const full = raw.replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z0-9._\-]+(:[A-Z0-9._\-]+)?$/.test(full)) {
        status.textContent = 'That doesn\'t look like a valid ticker.';
        return;
      }
      const label = (labelInp.value || '').trim();
      const exists = Array.from(sel.options).some(o => o.value === full);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = full;
        opt.textContent = (label ? (label + ' — ' + full) : full) + ' (custom)';
        sel.appendChild(opt);
      }
      sel.value = full;
      inp.value = full;
      setWindowSymbol(win, full);
      pop.remove();
    }

    goBtn.addEventListener('click', openSearch);
    qInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') { e.preventDefault(); pop.remove(); }
    });
    addBtn.addEventListener('click', addSymbol);
    pasteInp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addSymbol(); }
      if (e.key === 'Escape') { e.preventDefault(); pop.remove(); }
    });
    pop.addEventListener('mousedown', (e) => e.stopPropagation());
    setTimeout(() => qInp.focus(), 0);
  }

  // Find an empty grid slot inside the menu's body for a new icon. Returns
  // the center {x, y} for createIcon. Falls back to (PAD, PAD) if full —
  // createIcon clamps anyway.
  function findFreeIconSlot(win) {
    const body = win.querySelector('.win95-body');
    const PAD = 8;
    const startX = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const startY = PAD + (ICON_GRID - ICON_SIZE) / 2;
    if (!body) return { x: startX, y: startY };
    const bw = body.clientWidth || 400;
    const bh = body.clientHeight || 400;
    const cols = Math.max(1, Math.floor((bw - PAD * 2) / ICON_GRID));
    const rows = Math.max(1, Math.floor((bh - PAD * 2) / ICON_GRID));
    const occupied = new Set();
    body.querySelectorAll('.win-icon').forEach(ic => {
      const left = parseFloat(ic.style.left) || 0;
      const top = parseFloat(ic.style.top) || 0;
      const c = Math.round((left - startX + ICON_SIZE / 2) / ICON_GRID);
      const r = Math.round((top - startY + ICON_SIZE / 2) / ICON_GRID);
      occupied.add(r + ',' + c);
    });
    for (let r = 0; r < rows + 6; r++) {
      for (let c = 0; c < cols; c++) {
        if (!occupied.has(r + ',' + c)) {
          return {
            x: startX + c * ICON_GRID + ICON_SIZE / 2,
            y: startY + r * ICON_GRID + ICON_SIZE / 2,
          };
        }
      }
    }
    return { x: startX, y: startY };
  }

  // Popup that lets the user paste an iframe URL (or full <iframe> tag) and a
  // name, then drops a new icon into this menu that opens the URL in a
  // browser window when double-clicked.
  function openAddWidgetDialog(win) {
    const existing = document.getElementById('add-widget-popup');
    if (existing) existing.remove();

    const pop = document.createElement('div');
    pop.id = 'add-widget-popup';
    pop.className = 'win95-window';
    pop.style.position = 'fixed';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
    pop.style.width = '560px';
    pop.style.height = '560px';
    pop.style.zIndex = String(++zCounter);
    pop.innerHTML = `
      <div class="win95-titlebar">
        <span class="win95-title">Add Custom Widget</span>
        <div class="win95-titlebar-buttons">
          <button class="win95-tb-btn" data-act="close" title="Close">✕</button>
        </div>
      </div>
      <div class="win95-body" style="display:flex; flex-direction:column; gap:8px; padding:10px; font-size:12px;">
        <div>Add a widget from a URL/iframe, or paste raw HTML/JS to run inline.</div>
        <div style="display:flex; gap:10px; align-items:center;">
          <label style="display:flex; gap:4px; align-items:center;"><input type="radio" name="aw-mode" value="url" checked> URL / iframe</label>
          <label style="display:flex; gap:4px; align-items:center;"><input type="radio" name="aw-mode" value="code"> HTML / JS code</label>
        </div>
        <label id="aw-url-wrap" style="display:flex; flex-direction:column; gap:2px;">
          <span>URL or <code>&lt;iframe&gt;</code> tag</span>
          <textarea id="aw-url" rows="3" placeholder="https://example.com/embed/widget  or  &lt;iframe src='https://...'&gt;&lt;/iframe&gt;" style="width:100%; resize:vertical;"></textarea>
        </label>
        <label id="aw-code-wrap" style="display:none; flex-direction:column; gap:2px;">
          <span>HTML / JS code (runs inside an iframe)</span>
          <textarea id="aw-code" rows="5" placeholder="&lt;h2&gt;Hello&lt;/h2&gt;&#10;&lt;script&gt;document.body.style.background='#fef'&lt;/script&gt;" style="width:100%; resize:vertical; font-family:monospace;"></textarea>
        </label>
        <label style="display:flex; flex-direction:column; gap:2px;">
          <span>Widget name</span>
          <input id="aw-name" type="text" placeholder="My Widget" />
        </label>
        <fieldset style="border:1px solid var(--sh); padding:6px 8px;">
          <legend style="padding:0 4px;">Icon</legend>
          <div style="display:flex; align-items:center; gap:10px;">
            <div id="aw-preview" class="icon-preview" style="width:40px; height:40px; font-size:28px; flex-shrink:0;">📊</div>
            <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0;">
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <label style="display:flex; gap:4px; align-items:center;">
                  <span>Custom:</span>
                  <input id="aw-icon" type="text" maxlength="4" placeholder="📊" value="📊" style="width:48px;" />
                </label>
                <label style="display:inline-flex; gap:4px; align-items:center; cursor:pointer;">
                  <span class="win95-button" style="display:inline-block; padding:2px 8px; background:var(--face); border-top:2px solid var(--hi); border-left:2px solid var(--hi); border-right:2px solid var(--sh); border-bottom:2px solid var(--sh);">Upload image…</span>
                  <input id="aw-upload" type="file" accept="image/*" style="display:none;" />
                </label>
              </div>
            </div>
          </div>
          <div id="aw-emoji-grid" style="display:grid; grid-template-columns:repeat(12, 1fr); gap:3px; margin-top:8px; max-height:160px; overflow-y:auto; padding:4px; background:var(--bg); border-top:1px solid var(--sh); border-left:1px solid var(--sh); border-right:1px solid var(--hi); border-bottom:1px solid var(--hi);"></div>
        </fieldset>
        <div style="display:flex; gap:6px; justify-content:flex-end;">
          <button id="aw-cancel" type="button">Cancel</button>
          <button id="aw-add" type="button"><b>Add to Menu</b></button>
        </div>
        <div id="aw-status" style="font-size:11px; opacity:0.7; min-height:14px;"></div>
      </div>
    `;
    desktop.appendChild(pop);
    makeDialogDraggable(pop);

    const closeBtn = pop.querySelector('[data-act="close"]');
    const urlInp = pop.querySelector('#aw-url');
    const codeInp = pop.querySelector('#aw-code');
    const urlWrap = pop.querySelector('#aw-url-wrap');
    const codeWrap = pop.querySelector('#aw-code-wrap');
    const modeRadios = pop.querySelectorAll('input[name="aw-mode"]');
    const nameInp = pop.querySelector('#aw-name');
    const iconInp = pop.querySelector('#aw-icon');
    const uploadInp = pop.querySelector('#aw-upload');
    const previewEl = pop.querySelector('#aw-preview');
    const emojiGrid = pop.querySelector('#aw-emoji-grid');
    const cancelBtn = pop.querySelector('#aw-cancel');
    const addBtn = pop.querySelector('#aw-add');
    const status = pop.querySelector('#aw-status');

    // Selected icon state — emoji or data-URL image.
    let pickedImage = '📊';
    let pickedImageType = 'emoji';
    function setPicked(image, imageType) {
      pickedImage = image;
      pickedImageType = imageType;
      if (imageType === 'data') {
        previewEl.innerHTML = `<img class="icon-img" src="${escapeAttr(image)}" alt="">`;
      } else {
        previewEl.textContent = image;
      }
    }

    // Emoji palette — grouped by category, lots of options.
    const EMOJI_PALETTE = [
      // finance / charts
      '📊','📈','📉','💰','💵','💴','💶','💷','💸','💳','🪙','🏦','₿','💲','🤑','📝',
      // tech / tools
      '🖥','💻','⌨','🖨','💾','💿','📀','📟','📝','📠','📺','📱','☎','📲','📟','🔌',
      // documents / folders
      '📁','📂','🗂','📄','📃','📑','📒','📓','📔','📕','📖','📚','📗','📘','📙','🗒',
      // web / nav
      '🌐','🌍','🌎','🌏','📈','🔍','🔎','🧭','📍','📌','📏','📐','✂','🔗','📎','📰',
      // weather
      '☀','🌞','⛅','☁','🌥','🌦','🌧','⛈','🌩','🌨','❄','☃','⛄','🌬','🌪','🌈',
      // symbols / status
      '✅','❌','⚠','ℹ','ℹ','❓','❗','✨','⭐','🌟','❤','💙','💚','💛','💜','🖤',
      // shapes / arrows
      '◻','◼','▪','▫','⬛','⬜','🔴','🟠','🟡','🟢','🔵','🟣','🔼','🔽','⬆','⬇',
      // objects
      '🔭','🔬','⚗','🧪','🧬','🔋','🔌','⚡','🔦','💡','🔮','🎯','🎲','🎮','🎨','📷',
      // food / fun
      '☕','🍵','🍺','🍷','🍸','🍹','🍰','🍦','🍕','🍔','🌭','🌮','🌯','🍣','🍫','🍩',
      // travel / vehicles
      '✈','🚀','🚗','🚕','🚓','🚂','🚢','⛵','🚲','🏝','🌄','🌆','🌇','🏙','🏚','🗽',
      // animals
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔',
    ];
    EMOJI_PALETTE.forEach(em => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'preset-btn';
      b.style.fontSize = '18px';
      b.style.padding = '2px';
      b.textContent = em;
      b.title = em;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        setPicked(em, 'emoji');
        if (iconInp) iconInp.value = em;
      });
      emojiGrid.appendChild(b);
    });

    iconInp.addEventListener('input', () => {
      const v = (iconInp.value || '').trim();
      if (v) setPicked(v, 'emoji');
    });
    uploadInp.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPicked(reader.result, 'data');
      reader.readAsDataURL(file);
    });

    function getMode() {
      const r = pop.querySelector('input[name="aw-mode"]:checked');
      return r ? r.value : 'url';
    }
    function syncMode() {
      const m = getMode();
      urlWrap.style.display = m === 'url' ? 'flex' : 'none';
      codeWrap.style.display = m === 'code' ? 'flex' : 'none';
      setTimeout(() => (m === 'url' ? urlInp : codeInp).focus(), 0);
    }
    modeRadios.forEach(r => r.addEventListener('change', syncMode));

    const close = () => pop.remove();
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);

    function extractUrl(raw) {
      const s = String(raw || '').trim();
      if (!s) return '';
      // If it's a full <iframe> tag, pull the src attribute.
      const m = s.match(/<iframe[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/i);
      if (m) return m[1].trim();
      return s;
    }

    function add() {
      const mode = getMode();
      const slot = findFreeIconSlot(win);
      // Final image: prefer user-picked (emoji-grid or upload). Fall back to text input.
      let finalImage = pickedImage;
      let finalImageType = pickedImageType;
      if (finalImageType === 'emoji') {
        const v = (iconInp.value || '').trim();
        if (v) finalImage = v;
        if (!finalImage) finalImage = '📊';
      }
      let name = (nameInp.value || '').trim();

      if (mode === 'code') {
        const code = String(codeInp.value || '').trim();
        if (!code) { status.textContent = 'Please paste some HTML or JS code.'; return; }
        if (!name) name = 'Custom Widget';
        createIcon(win, {
          x: slot.x, y: slot.y,
          name,
          image: finalImage,
          imageType: finalImageType,
          url: '',
          type: 'code',
          widget: '',
          widgetSymbol: '',
          widgetCode: code,
        });
        pop.remove();
        return;
      }

      const url = extractUrl(urlInp.value);
      if (!url) { status.textContent = 'Please paste a URL or iframe tag.'; return; }
      try {
        const u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('not http(s)');
      } catch (_) {
        status.textContent = 'That doesn\'t look like a valid URL.';
        return;
      }
      if (!name) {
        try { name = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { name = 'Custom Widget'; }
      }
      createIcon(win, {
        x: slot.x, y: slot.y,
        name,
        image: finalImage,
        imageType: finalImageType,
        url,
        type: 'url',
        widget: '',
        widgetSymbol: '',
      });
      // createIcon already renders content + sets dataset; nothing more needed.
      pop.remove();
    }

    addBtn.addEventListener('click', add);
    [urlInp, codeInp].forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); }
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
    });
    [nameInp, iconInp].forEach(el => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); add(); }
        if (e.key === 'Escape') { e.preventDefault(); close(); }
      });
    });
    pop.addEventListener('mousedown', (e) => e.stopPropagation());
    setTimeout(() => urlInp.focus(), 0);
  }

  // Open every icon in this menu window, tiled to fit on screen without
  // overlap. Skips icons whose browser window is already open.
  function openAllWidgets(win, opts = {}) {
    let icons = Array.from(win.querySelectorAll('.win-icon'));
    if (opts.tickerableOnly) {
      icons = icons.filter(ic => TICKERABLE_WIDGETS.has(ic.dataset.widget || ''));
    }
    if (opts.heatmapsOnly) {
      icons = icons.filter(ic => /heatmap/i.test(ic.dataset.name || ''));
    }
    if (!icons.length) return;
    // Track which slug+symbol combos are already open from this menu so we
    // don't open duplicates.
    const openSet = new Set();
    desktop.querySelectorAll('.browser-window').forEach(bw => {
      if (bw._parentMenuWin !== win) return;
      const slug = bw.dataset.widgetSlug || '';
      const frame = bw.querySelector('.browser-frame');
      const src = frame ? (frame.getAttribute('src') || '') : '';
      openSet.add(slug + '|' + src);
    });
    const codeOpenSet = new Set();
    desktop.querySelectorAll('.browser-window').forEach(bw => {
      if (bw._parentMenuWin !== win) return;
      const code = bw.dataset.widgetCode || '';
      if (code) codeOpenSet.add(code);
    });
    const toOpen = icons.filter(icon => {
      const type = icon.dataset.type || 'url';
      if (type === 'widget') {
        const slug = icon.dataset.widget || '';
        const sym = icon.dataset.widgetSymbol || '';
        const expectedSrc = slug
          ? ('widget.html?w=' + encodeURIComponent(slug) + (sym ? ('&symbol=' + encodeURIComponent(sym)) : ''))
          : '';
        return !(slug && openSet.has(slug + '|' + expectedSrc));
      }
      if (type === 'code') {
        // Skip in tickerable/heatmaps modes — those are TradingView-only.
        if (opts.tickerableOnly || opts.heatmapsOnly) return false;
        const code = icon.dataset.widgetCode || '';
        if (!code) return false;
        return !codeOpenSet.has(code);
      }
      // URL icon: dedupe by normalized URL.
      let u = (icon.dataset.url || '').trim();
      if (!u) return false;
      if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
      return !openSet.has('|' + u);
    });
    if (!toOpen.length) return;

    // Compute a tile grid that fits the viewport above the taskbar.
    // TASKBAR_H is defined at module scope.
    // Reserve one tile slot for the menu itself so it stays visible alongside
    // the widgets instead of being minimized.
    const n = toOpen.length + 1;
    // Pick a tile grid (cols×rows) close to the viewport's aspect ratio.
    const fullW = window.innerWidth;
    const fullH = window.innerHeight - TASKBAR_H;
    const aspect = fullW / fullH;
    let cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
    let rows = Math.ceil(n / cols);
    while (cols > 1 && (cols - 1) * rows >= n) cols--;
    rows = Math.ceil(n / cols);
    // Pick a desktop grid size in [8, 80] px that yields the tightest fit:
    // cellW = floor(fullW/cols/g)*g, cellH = floor(fullH/rows/g)*g.
    // We want cellW*cols and cellH*rows to be close to fullW/fullH so windows
    // fill the screen, while every tile edge lands exactly on a grid dot.
    let bestGrid = state.grid > 0 ? state.grid : 40;
    let bestWaste = Infinity;
    for (let g = 8; g <= 80; g++) {
      const cw = Math.floor(fullW / cols / g) * g;
      const ch = Math.floor(fullH / rows / g) * g;
      if (cw <= 0 || ch <= 0) continue;
      const waste = (fullW - cw * cols) + (fullH - ch * rows);
      // Tie-breaker: prefer larger grid (visually nicer, fewer dots).
      if (waste < bestWaste || (waste === bestWaste && g > bestGrid)) {
        bestWaste = waste;
        bestGrid = g;
      }
    }
    if (bestGrid !== state.grid) {
      state.grid = bestGrid;
      syncControlsFromState();
      applyState();
    }
    const g = state.grid;
    const cellW = Math.floor(fullW / cols / g) * g;
    const cellH = Math.floor(fullH / rows / g) * g;
    // Center the tiled block so leftover space is split evenly on both sides,
    // then snap the offsets down to the grid so tile edges align to dots.
    const offX = Math.floor((fullW - cellW * cols) / 2 / g) * g;
    const offY = Math.floor((fullH - cellH * rows) / 2 / g) * g;

    const tileFor = (i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return { x: offX + col * cellW, y: offY + row * cellH, w: cellW, h: cellH };
    };

    // Slot 0 is the menu; widgets fill slots 1..n-1.
    toOpen.forEach((icon, i) => {
      openIconTarget(icon, { tile: tileFor(i + 1) });
    });

    // Restore (if minimized) and resize the menu into its reserved tile so
    // it stays visible alongside the tiled widgets.
    if (win.dataset.minimized === 'true') {
      minimizeWindow(win); // toggles back to visible
    }
    const menuTile = tileFor(0);
    win.style.left = menuTile.x + 'px';
    win.style.top = menuTile.y + 'px';
    win.style.width = menuTile.w + 'px';
    win.style.height = menuTile.h + 'px';
    win.style.zIndex = String(++zCounter);
    setActiveTaskbarItem(win);
  }

  // Close every browser window whose parent menu is this window.
  function closeAllWidgets(win, opts = {}) {
    const toClose = [];
    desktop.querySelectorAll('.browser-window').forEach(bw => {
      if (bw._parentMenuWin === win) toClose.push(bw);
    });
    toClose.forEach(bw => {
      captureClosedWindow(bw);
      unregisterTaskbarItem(bw);
      bw.remove();
    });
    // Restore the menu to its default size unless caller is about to retile.
    if (!opts.keepMenuSize) resizeMenuToDefault(win);
  }

  // Resize a menu window back to the default size that fits all its icons,
  // mirroring the sizing logic in addAllWidgetIcons but without re-laying out
  // the icons themselves.
  function resizeMenuToDefault(win) {
    const body = win.querySelector('.win95-body');
    if (!body) return;
    const sel = document.getElementById('icon-widget');
    const n = sel ? sel.options.length : (win.querySelectorAll('.win-icon').length || 0);
    if (!n) return;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const PAD = 8;
    const bodyW = cols * ICON_GRID + PAD * 2;
    const bodyH = rows * ICON_GRID + PAD * 2;
    const winRect = win.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const chromeW = winRect.width - bodyRect.width;
    const chromeH = winRect.height - bodyRect.height;
    let newW = Math.min(bodyW + chromeW, window.innerWidth - 20);
    let newH = Math.min(bodyH + chromeH, window.innerHeight - 20);
    const g = state.grid > 0 ? state.grid : 1;
    newW = Math.ceil(newW / g) * g;
    newH = Math.ceil(newH / g) * g;
    let left = parseFloat(win.style.left) || winRect.left;
    let top = parseFloat(win.style.top) || winRect.top;
    left = snap(Math.max(0, Math.min(left, window.innerWidth - newW)));
    top = snap(Math.max(0, Math.min(top, window.innerHeight - newH)));
    win.style.width = newW + 'px';
    win.style.height = newH + 'px';
    win.style.left = left + 'px';
    win.style.top = top + 'px';
  }

  // Apply a new ticker symbol to all tickerable icons in this menu window,
  // and live-reload any open browser windows spawned from those icons.
  function setWindowSymbol(win, symbol) {
    win.dataset.tickerSymbol = symbol;
    const sel = win.querySelector('.menu-ticker-select');
    const inp = win.querySelector('.menu-ticker-input');
    if (inp) inp.value = symbol;
    if (sel) {
      const has = Array.from(sel.options).some(o => o.value === symbol);
      if (!has) {
        const opt = document.createElement('option');
        opt.value = symbol;
        opt.textContent = symbol + ' (custom)';
        sel.appendChild(opt);
      }
      sel.value = symbol;
    }
    // Update icons
    win.querySelectorAll('.win-icon').forEach(icon => {
      const slug = icon.dataset.widget;
      if (icon.dataset.type === 'widget' && slug && TICKERABLE_WIDGETS.has(slug)) {
        icon.dataset.widgetSymbol = symbol;
      }
    });
    // Live-reload any open browser windows whose parent is this win
    desktop.querySelectorAll('.browser-window').forEach(bw => {
      if (bw._parentMenuWin !== win) return;
      const slug = bw.dataset.widgetSlug;
      if (!slug || !TICKERABLE_WIDGETS.has(slug)) return;
      const frame = bw.querySelector('.browser-frame');
      if (!frame) return;
      const newSrc = 'widget.html?w=' + encodeURIComponent(slug) + '&symbol=' + encodeURIComponent(symbol);
      frame.setAttribute('src', 'about:blank');
      setTimeout(() => frame.setAttribute('src', newSrc), FRAME_RELOAD_DELAY);
    });
  }

  /* ---------- Window creation ---------- */
  function createLinkWindow(clientX, clientY) {
    const w = Math.max(40, state.w * state.grid);
    const h = Math.max(40, state.h * state.grid);

    let x = snap(clientX);
    let y = snap(clientY);

    x = Math.max(0, Math.min(x, window.innerWidth - w));
    y = Math.max(0, Math.min(y, window.innerHeight - h));

    const win = document.createElement('div');
    win.className = 'win95-window';
    win.style.left = x + 'px';
    win.style.top = y + 'px';
    win.style.width = w + 'px';
    win.style.height = h + 'px';
    win.style.zIndex = String(++zCounter);

    const titleText = state.title || 'Untitled';
    const initialSymbol = 'BITSTAMP:BTCUSD';
    win.dataset.tickerSymbol = initialSymbol;
    win.innerHTML = buildMenuWindowHtml(titleText, initialSymbol);

    desktop.appendChild(win);
    wireWindow(win, { snapOnDrop: true, resizable: true });
    wireWindowIcons(win);
    wireMenuToolbar(win);
    registerTaskbarItem(win, { icon: '🗔', label: titleText });

    // New windows come pre-populated with all TradingView widget icons,
    // arranged in a tidy grid that auto-fits the window.
    addAllWidgetIcons(win);
    // Apply default symbol to the freshly-created icons.
    setWindowSymbol(win, initialSymbol);
    return win;
  }

  /* ---------- Window-scoped icons ---------- */
  const ICON_GRID = 80;     // visual grid step inside window for icon placement
  const ICON_SIZE = 72;     // approximate icon footprint

  function wireWindowIcons(win) {
    const body = win.querySelector('.win95-body');
    if (!body) return;
    body.classList.add('icon-host');

    body.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const iconEl = e.target.closest('.win-icon');
      activeIconCtx = {
        win,
        iconEl,
        x: e.clientX - body.getBoundingClientRect().left + body.scrollLeft,
        y: e.clientY - body.getBoundingClientRect().top + body.scrollTop,
      };
      openWinCtx(e.clientX, e.clientY, !!iconEl);
    });

    // click empty area to deselect
    body.addEventListener('mousedown', (e) => {
      if (e.target === body) {
        body.querySelectorAll('.win-icon.selected').forEach(i => i.classList.remove('selected'));
      }
    });
  }

  function openWinCtx(x, y, onIcon) {
    // toggle icon-only items
    winCtx.querySelectorAll('[data-only="icon"]').forEach(li => {
      li.style.display = onIcon ? '' : 'none';
    });
    winCtx.hidden = false;
    const r = winCtx.getBoundingClientRect();
    const maxX = window.innerWidth - r.width - 2;
    const maxY = window.innerHeight - r.height - 2;
    winCtx.style.left = Math.min(x, maxX) + 'px';
    winCtx.style.top = Math.min(y, maxY) + 'px';
    winCtx.style.zIndex = String(++zCounter);
  }
  function closeWinCtx() { winCtx.hidden = true; }

  winCtx.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-action]');
    if (!li) return;
    const action = li.dataset.action;
    closeWinCtx();
    const { win, iconEl, x, y } = activeIconCtx;
    if (!win) return;
    if (action === 'new-widget') openAddWidgetDialog(win);
    if (action === 'edit-icon' && iconEl) openIconProps({ mode: 'edit', win, iconEl });
    if (action === 'delete-icon' && iconEl) iconEl.remove();
    if (action === 'open-icon' && iconEl) openIconTarget(iconEl);
    if (action === 'arrange-name') arrangeIcons(win, 'name');
    if (action === 'arrange-type') arrangeIcons(win, 'type');
    if (action === 'arrange-size') arrangeIcons(win, 'size');
    if (action === 'new-folder') addFolderIcon(win, x, y);
    if (action === 'refresh-icon' && iconEl) {
      // re-render to reflect current dataset values
      renderIconContent(iconEl, iconEl.dataset.image || '📁', iconEl.dataset.imageType || 'emoji', iconEl.dataset.name || '');
      showToast('Icon refreshed');
    }
  });

  /* ---------- Bulk-add: one icon per TradingView widget ---------- */
  // Maps widget slug → a fitting emoji for the icon image.
  const WIDGET_ICONS = {
    'advanced-chart': '📈',
    'mini-symbol-overview': '📉',
    'symbol-overview': '📊',
    'symbol-info': 'ℹ',
    'technical-analysis': '🧭',
    'financials': '💰',
    'symbol-profile': '🏢',
    'single-quote': '💲',
    'ticker': '🎟',
    'ticker-tape': '📺',
    'market-overview': '🌐',
    'market-quotes': '📈',
    'market-data': '📄',
    'stock-heatmap': '🔥',
    'crypto-coins-heatmap': '🪙',
    'etf-heatmap': '🏛',
    'forex-cross-rates': '💱',
    'forex-heat-map': '🌡',
    'screener': '🔍',
    'crypto-mkt-screener': '₿',
    'timeline': '📰',
    'events': '📅',
    'notepad': '📝',
  };

  function addAllWidgetIcons(win) {
    const body = win.querySelector('.win95-body');
    if (!body) return;
    const sel = document.getElementById('icon-widget');
    if (!sel) return;
    // Pull widget list from the dropdown so it stays in sync with the catalog.
    const widgets = Array.from(sel.options).map(o => ({ slug: o.value, name: o.textContent.trim() }));
    const n = widgets.length;
    if (!n) return;

    // Pick a near-square grid (cols ≥ rows). e.g. 22 icons → 5x5 grid, last row partial.
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    // Compute the body size needed to fit cols×rows icons of ICON_GRID each, plus padding.
    const PAD = 8;
    const bodyW = cols * ICON_GRID + PAD * 2;
    const bodyH = rows * ICON_GRID + PAD * 2;

    // Resize the window so its body fits exactly. We need to know the chrome
    // (titlebar+borders) size; measure it from the live element.
    const winRect = win.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const chromeW = winRect.width - bodyRect.width;     // borders left+right
    const chromeH = winRect.height - bodyRect.height;   // titlebar + borders

    let newW = bodyW + chromeW;
    let newH = bodyH + chromeH;
    // Clamp to viewport so the window stays fully visible.
    newW = Math.min(newW, window.innerWidth - 20);
    newH = Math.min(newH, window.innerHeight - 20);

    // Snap all four edges to the grid. Round dimensions UP to the next grid step
    // so the body stays big enough to hold every icon.
    const g = state.grid > 0 ? state.grid : 1;
    let left = parseFloat(win.style.left) || winRect.left;
    let top = parseFloat(win.style.top) || winRect.top;
    left = snap(left);
    top = snap(top);
    newW = Math.ceil(newW / g) * g;
    newH = Math.ceil(newH / g) * g;
    // Keep window on-screen.
    left = Math.max(0, Math.min(left, window.innerWidth - newW));
    top = Math.max(0, Math.min(top, window.innerHeight - newH));
    // Re-snap after clamp in case clamp pushed off-grid.
    left = snap(Math.max(0, left));
    top = snap(Math.max(0, top));

    win.style.width = newW + 'px';
    win.style.height = newH + 'px';
    win.style.left = left + 'px';
    win.style.top = top + 'px';

    // Place each icon. Icons are positioned by their top-left, so account for ICON_SIZE/2 inset.
    const startX = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const startY = PAD + (ICON_GRID - ICON_SIZE) / 2;

    widgets.forEach((w, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * ICON_GRID + ICON_SIZE / 2;
      const cy = startY + row * ICON_GRID + ICON_SIZE / 2;
      // Notepad icons need a unique storage id so each one keeps its own text.
      const sym = w.slug === 'notepad' ? ('np-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)) : '';
      createIcon(win, {
        x: cx, y: cy,
        name: w.name,
        image: WIDGET_ICONS[w.slug] || '📊',
        imageType: 'emoji',
        url: '',
        type: 'widget',
        widget: w.slug,
        widgetSymbol: sym,
      });
    });
  }

  function snapInWindow(v) {
    return Math.round(v / ICON_GRID) * ICON_GRID;
  }

  function createIcon(win, { x, y, name, image, imageType, url, type, widget, widgetSymbol, widgetCode }) {
    const body = win.querySelector('.win95-body');
    if (!body) return;
    const icon = document.createElement('div');
    icon.className = 'win-icon';
    icon.dataset.url = url || '';
    icon.dataset.type = type || 'url';
    icon.dataset.widget = widget || '';
    icon.dataset.widgetSymbol = widgetSymbol || '';
    icon.dataset.imageType = imageType || 'emoji';
    icon.dataset.image = image || '📁';
    if (widgetCode) icon.dataset.widgetCode = widgetCode;
    // Snap onto the same icon grid origin used everywhere else (wireIcon,
    // folderAtSlot, renderFolderPanelItems): start = PAD + (ICON_GRID-ICON_SIZE)/2.
    const PAD = 8;
    const ORIGIN = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const rawL = Math.max(0, x - ICON_SIZE / 2);
    const rawT = Math.max(0, y - ICON_SIZE / 2);
    const col = Math.max(0, Math.round((rawL - ORIGIN) / ICON_GRID));
    const row = Math.max(0, Math.round((rawT - ORIGIN) / ICON_GRID));
    icon.style.left = (ORIGIN + col * ICON_GRID) + 'px';
    icon.style.top = (ORIGIN + row * ICON_GRID) + 'px';
    renderIconContent(icon, image, imageType, name);
    body.appendChild(icon);
    wireIcon(icon, win);
    return icon;
  }

  function renderIconContent(icon, image, imageType, name) {
    icon.dataset.imageType = imageType;
    icon.dataset.image = image;
    icon.dataset.name = name;
    const imgHtml = imageType === 'data'
      ? `<img class="icon-img" src="${escapeAttr(image)}" alt="">`
      : `<span class="icon-emoji">${escapeHtml(image)}</span>`;
    icon.innerHTML = `
      <span class="icon-image">${imgHtml}</span>
      <span class="icon-label">${escapeHtml(name)}</span>
    `;
  }

  function wireIcon(icon, win) {
    icon.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      win.querySelectorAll('.win-icon.selected').forEach(i => {
        if (i !== icon) i.classList.remove('selected');
      });
      icon.classList.add('selected');
      // Drag-to-reposition with grid snap. Threshold so a click selects without drifting.
      const body = win.querySelector('.win95-body');
      if (!body) return;
      const startX = e.clientX, startY = e.clientY;
      const origLeft = parseFloat(icon.style.left) || 0;
      const origTop = parseFloat(icon.style.top) || 0;
      let dragging = false;
      // Helper: highlight whichever folder is currently under the cursor.
      const updateFolderHover = () => {
        const PAD = 8;
        const startX2 = PAD + (ICON_GRID - ICON_SIZE) / 2;
        const startY2 = PAD + (ICON_GRID - ICON_SIZE) / 2;
        const cur = { left: parseFloat(icon.style.left) || 0, top: parseFloat(icon.style.top) || 0 };
        const c = Math.max(0, Math.round((cur.left - startX2) / ICON_GRID));
        const r = Math.max(0, Math.round((cur.top - startY2) / ICON_GRID));
        const targetL = startX2 + c * ICON_GRID;
        const targetT = startY2 + r * ICON_GRID;
        body.querySelectorAll('.win-icon.folder-hover').forEach(el => el.classList.remove('folder-hover'));
        const f = folderAtSlot(body, icon, targetL, targetT);
        if (f) f.classList.add('folder-hover');
        return { targetL, targetT, folder: f };
      };
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragging && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!dragging) {
          dragging = true;
          icon.classList.add('dragging');
          showDragShield('grabbing');
        }
        // Free-move during drag for smooth feedback; snap on release.
        const bw = body.clientWidth || 400;
        const bh = body.clientHeight || 400;
        let nl = Math.max(0, Math.min(origLeft + dx, bw - ICON_SIZE));
        let nt = Math.max(0, Math.min(origTop + dy, bh - ICON_SIZE));
        icon.style.left = nl + 'px';
        icon.style.top = nt + 'px';
        updateFolderHover();
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!dragging) return;
        icon.classList.remove('dragging');
        hideDragShield();
        body.querySelectorAll('.win-icon.folder-hover').forEach(el => el.classList.remove('folder-hover'));
        // Snap to grid + push aside any icon already in that slot (swap).
        const PAD = 8;
        const startX2 = PAD + (ICON_GRID - ICON_SIZE) / 2;
        const startY2 = PAD + (ICON_GRID - ICON_SIZE) / 2;
        const cur = { left: parseFloat(icon.style.left) || 0, top: parseFloat(icon.style.top) || 0 };
        const c = Math.max(0, Math.round((cur.left - startX2) / ICON_GRID));
        const r = Math.max(0, Math.round((cur.top - startY2) / ICON_GRID));
        const targetL = startX2 + c * ICON_GRID;
        const targetT = startY2 + r * ICON_GRID;
        // If the target slot has a folder, drop this icon INTO it.
        const folder = folderAtSlot(body, icon, targetL, targetT);
        if (folder) {
          moveIconIntoFolder(icon, folder);
          // If that folder's panel is currently open, refresh it.
          const openPanel = body.querySelector('.folder-panel');
          if (openPanel && openPanel.dataset.folderId === folder.dataset.folderId) {
            renderFolderPanelItems(openPanel, folder);
          }
          return;
        }
        // If another icon already occupies that slot, swap positions.
        const others = body.querySelectorAll('.win-icon');
        others.forEach(other => {
          if (other === icon) return;
          const ol = parseFloat(other.style.left) || 0;
          const ot = parseFloat(other.style.top) || 0;
          if (Math.abs(ol - targetL) < 4 && Math.abs(ot - targetT) < 4) {
            other.style.left = (Math.round(origLeft / 1)) + 'px';
            other.style.top = (Math.round(origTop / 1)) + 'px';
          }
        });
        icon.style.left = targetL + 'px';
        icon.style.top = targetT + 'px';
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    icon.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      openIconTarget(icon);
    });
  }

  function openIconTarget(icon, opts) {
    opts = opts || {};
    const type = icon.dataset.type || 'url';
    const name = icon.dataset.name || 'Browser';
    const parentWin = icon.closest('.win95-window');
    if (type === 'folder') {
      openFolderPanel(icon);
      return;
    }
    if (type === 'widget') {
      const slug = (icon.dataset.widget || '').trim();
      if (!slug) return;
      let sym = (icon.dataset.widgetSymbol || '').trim();
      // Notepad icons need a stable per-icon id so each keeps its own text. If
      // the user created one without a symbol, generate + persist one now.
      if (slug === 'notepad' && !sym) {
        sym = 'np-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        icon.dataset.widgetSymbol = sym;
      }
      let target = 'widget.html?w=' + encodeURIComponent(slug);
      if (sym) target += '&symbol=' + encodeURIComponent(sym);
      createBrowserWindow(target, name, {
        isWidget: true,
        widgetSlug: slug,
        parentWin,
        tile: opts.tile || null,
      });
      return;
    }
    if (type === 'code') {
      const code = icon.dataset.widgetCode || '';
      if (!code) return;
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:8px;font-family:'MS Sans Serif',sans-serif;background:#fff;color:#000}</style></head><body>${code}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      createBrowserWindow(blobUrl, name, { tile: opts.tile || null, parentWin, widgetCode: code });
      return;
    }
    const url = (icon.dataset.url || '').trim();
    if (!url) return;
    let safe = url;
    if (!/^[a-z]+:\/\//i.test(safe)) safe = 'https://' + safe;
    if (!/^https?:\/\//i.test(safe)) return; // refuse non-http schemes
    createBrowserWindow(safe, name, { tile: opts.tile || null, parentWin });
  }

  /* ---------- Embedded browser windows ---------- */
  // Natural pixel heights of "compact" TradingView widgets — used so we don't open
  // a giant window with empty dark space below them.
  const COMPACT_WIDGET_HEIGHT = {
    'ticker': 100,
    'ticker-tape': 80,
    'single-quote': 160,
    'symbol-info': 220,
  };

  function createBrowserWindow(url, title, opts) {
    opts = opts || {};
    const isWidget = !!opts.isWidget;
    const compactH = isWidget ? COMPACT_WIDGET_HEIGHT[opts.widgetSlug] : null;
    // Standalone widget windows get a roomier default size.
    const w = Math.max(isWidget ? 600 : 360, state.grid * (isWidget ? 18 : 10));
    let h;
    if (compactH) {
      // titlebar (~28) + toolbar (~32) + statusbar (~28) ≈ 88 px chrome
      h = compactH + 88;
    } else {
      h = Math.max(isWidget ? 460 : 280, state.grid * (isWidget ? 13 : 8));
    }
    let x = snap(Math.max(0, (window.innerWidth - w) / 2));
    let y = snap(Math.max(0, (window.innerHeight - h) / 2));
    // Tile placement: caller specified an exact rect (x,y,w,h) to place the
    // window into. Used by Open All so windows tile without overlap.
    let actualW = w, actualH = h;
    if (opts.tile) {
      x = opts.tile.x;
      y = opts.tile.y;
      actualW = Math.max(160, opts.tile.w);
      actualH = Math.max(120, opts.tile.h);
    }

    const win = document.createElement('div');
    win.className = 'win95-window browser-window';
    win.style.left = x + 'px';
    win.style.top = y + 'px';
    win.style.width = actualW + 'px';
    win.style.height = actualH + 'px';
    win.style.zIndex = String(++zCounter);

    // Built-in non-TradingView widgets (notepad, etc.) don't get a "— TradingView" suffix.
    const isBuiltinTool = opts.widgetSlug === 'notepad';
    let titleSuffix;
    if (isBuiltinTool) titleSuffix = '';
    else if (isWidget) titleSuffix = 'TradingView';
    else titleSuffix = prettyHost(url);
    const openTabUrl = isWidget ? null : url;
    const openTabBtnHtml = openTabUrl
      ? `<button class="win95-tb-btn" data-act="open-tab" title="Open in new tab">↗</button>`
      : '';
    const fullTitle = titleSuffix
      ? `${escapeHtml(title)} — ${escapeHtml(titleSuffix)}`
      : escapeHtml(title);
    win.innerHTML = `
      <div class="win95-titlebar">
        <span class="win95-title">${fullTitle}</span>
        <div class="win95-titlebar-buttons">
          <button class="win95-tb-btn" data-act="reload" title="Reload">↻</button>
          ${openTabBtnHtml}
          <button class="win95-tb-btn" data-act="minimize" title="Minimize">_</button>
          <button class="win95-tb-btn" data-act="maximize" title="Maximize">▢</button>
          <button class="win95-tb-btn" data-act="close" title="Close">✕</button>
        </div>
      </div>
      <div class="win95-body browser-body">
        <iframe class="browser-frame"
                src="${escapeAttr(url)}"
                ${isWidget
                  ? 'allow="fullscreen; clipboard-read; clipboard-write; storage-access"'
                  : 'referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"'}
                ></iframe>
      </div>
      <div class="resize-handle nw" data-resize="nw"></div>
      <div class="resize-handle ne" data-resize="ne"></div>
      <div class="resize-handle sw" data-resize="sw"></div>
      <div class="resize-handle se" data-resize="se"></div>
    `;

    desktop.appendChild(win);
    if (isWidget && opts.widgetSlug) win.dataset.widgetSlug = opts.widgetSlug;
    if (opts.parentWin) win._parentMenuWin = opts.parentWin;
    if (opts.widgetCode) win.dataset.widgetCode = opts.widgetCode;
    wireWindow(win, { snapOnDrop: true, resizable: true });
    attachStatusDot(win);
    registerTaskbarItem(win, {
      icon: isWidget ? '📊' : '🌐',
      label: title || (isWidget ? 'Widget' : 'Browser'),
    });

    const frame = win.querySelector('.browser-frame');
    const openTabBtn = win.querySelector('[data-act="open-tab"]');
    const reloadBtn = win.querySelector('[data-act="reload"]');

    if (openTabBtn) {
      openTabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    }
    if (reloadBtn) {
      reloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // resetting src reloads even if the iframe is sandboxed
        const cur = frame.getAttribute('src');
        frame.setAttribute('src', 'about:blank');
        setTimeout(() => frame.setAttribute('src', cur), FRAME_RELOAD_DELAY);
      });
    }
  }

  function prettyHost(url) {
    try { return new URL(url).host; } catch (_) { return url; }
  }

  /* ---------- Icon Properties dialog ---------- */
  const PRESETS = {
    folder: '📁', document: '📄', globe: '🌐', download: '⬇',
    computer: '🖥', disk: '💾', heart: '❤', star: '⭐',
  };

  function openIconProps({ mode, win, iconEl, x, y }) {
    propsState = { mode, win, iconEl: iconEl || null, image: '📁', imageType: 'emoji', x, y };
    const nameInput = document.getElementById('icon-name');
    const urlInput = document.getElementById('icon-url');
    const widgetSelect = document.getElementById('icon-widget');
    const widgetSymInput = document.getElementById('icon-widget-symbol');
    const upload = document.getElementById('icon-upload');
    upload.value = '';
    let type = 'url';
    if (mode === 'edit' && iconEl) {
      nameInput.value = iconEl.dataset.name || '';
      urlInput.value = iconEl.dataset.url || '';
      type = iconEl.dataset.type || 'url';
      widgetSelect.value = iconEl.dataset.widget || 'advanced-chart';
      widgetSymInput.value = iconEl.dataset.widgetSymbol || '';
      propsState.image = iconEl.dataset.image || '📁';
      propsState.imageType = iconEl.dataset.imageType || 'emoji';
    } else {
      nameInput.value = 'New Icon';
      urlInput.value = '';
      widgetSelect.value = 'advanced-chart';
      widgetSymInput.value = '';
      propsState.image = '📁';
      propsState.imageType = 'emoji';
    }
    // set type radio
    document.querySelectorAll('input[name="icon-type"]').forEach(r => { r.checked = (r.value === type); });
    syncIconTypeFields();
    setPreview(propsState.image, propsState.imageType);
    // position dialog centered
    const w = 360, h = 520;
    iconPropsDialog.style.width = w + 'px';
    iconPropsDialog.style.left = Math.max(0, (window.innerWidth - w) / 2) + 'px';
    iconPropsDialog.style.top = Math.max(0, (window.innerHeight - h) / 2) + 'px';
    iconPropsDialog.hidden = false;
    iconPropsDialog.style.zIndex = String(++zCounter);
    setTimeout(() => nameInput.focus(), 0);
  }

  function syncIconTypeFields() {
    const t = (document.querySelector('input[name="icon-type"]:checked') || {}).value || 'url';
    document.getElementById('fs-url').hidden = (t !== 'url');
    document.getElementById('fs-widget').hidden = (t !== 'widget');
    if (t === 'widget') autoFillWidgetName();
  }

  // Names that count as "unedited" — we'll overwrite them when widget changes.
  const WIDGET_NAMES = (function() {
    const sel = document.getElementById('icon-widget');
    const set = new Set(['', 'New Icon', 'Untitled']);
    if (sel) sel.querySelectorAll('option').forEach(o => set.add(o.textContent.trim()));
    return set;
  })();

  function autoFillWidgetName() {
    const nameInput = document.getElementById('icon-name');
    const sel = document.getElementById('icon-widget');
    if (!nameInput || !sel) return;
    const cur = (nameInput.value || '').trim();
    if (!WIDGET_NAMES.has(cur)) return; // user customized it; leave alone
    const opt = sel.options[sel.selectedIndex];
    if (opt) nameInput.value = opt.textContent.trim();
  }

  function setPreview(image, imageType) {
    const preview = document.getElementById('icon-preview');
    if (imageType === 'data') {
      preview.innerHTML = `<img class="icon-img" src="${escapeAttr(image)}" alt="">`;
    } else {
      preview.textContent = image;
    }
  }

  // wire dialog controls
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.dataset.preset;
      propsState.image = PRESETS[key] || '📁';
      propsState.imageType = 'emoji';
      setPreview(propsState.image, propsState.imageType);
    });
  });
  document.getElementById('icon-upload').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      propsState.image = reader.result;
      propsState.imageType = 'data';
      setPreview(propsState.image, propsState.imageType);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('icon-cancel').addEventListener('click', () => {
    iconPropsDialog.hidden = true;
  });
  document.querySelectorAll('input[name="icon-type"]').forEach(r => {
    r.addEventListener('change', syncIconTypeFields);
  });
  const widgetSel = document.getElementById('icon-widget');
  if (widgetSel) widgetSel.addEventListener('change', autoFillWidgetName);
  document.getElementById('icon-save').addEventListener('click', () => {
    const name = document.getElementById('icon-name').value.trim() || 'Untitled';
    const type = (document.querySelector('input[name="icon-type"]:checked') || {}).value || 'url';
    const url = document.getElementById('icon-url').value.trim();
    const widget = document.getElementById('icon-widget').value;
    const widgetSymbol = document.getElementById('icon-widget-symbol').value.trim();
    const { mode, win, iconEl, image, imageType, x, y } = propsState;
    if (mode === 'edit' && iconEl) {
      iconEl.dataset.type = type;
      iconEl.dataset.url = url;
      iconEl.dataset.widget = widget;
      iconEl.dataset.widgetSymbol = widgetSymbol;
      renderIconContent(iconEl, image, imageType, name);
    } else if (mode === 'new' && win) {
      createIcon(win, { x: x || 20, y: y || 20, name, image, imageType, url, type, widget, widgetSymbol });
    }
    iconPropsDialog.hidden = true;
  });
  // make the properties dialog draggable like a regular window (must be set up after wireWindow is defined)

  function wireWindow(win, opts = {}) {
    const titlebar = win.querySelector('.win95-titlebar');
    const closeBtn = win.querySelector('[data-act="close"]');
    const minBtn = win.querySelector('[data-act="minimize"]');

    win.addEventListener('mousedown', () => {
      win.style.zIndex = String(++zCounter);
      // Reflect focus in the taskbar.
      setActiveTaskbarItem(win);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (win === settingsWin || win === iconPropsDialog) {
          win.hidden = true;
        } else {
          captureClosedWindow(win);
          unregisterTaskbarItem(win);
          win.remove();
        }
      });
    }

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        minimizeWindow(win);
      });
    }

    const maxBtn = win.querySelector('[data-act="maximize"]');
    if (maxBtn) {
      maxBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMaximize(win);
      });
    }
    // Also support double-click on titlebar to toggle maximize.
    if (titlebar) {
      titlebar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.win95-tb-btn')) return;
        toggleMaximize(win);
      });
    }

    let dragging = false;
    let offX = 0, offY = 0;
    let _snapTarget = null;
    function startDrag(e) {
      if (e.button !== 0) return;
      if (e.target.closest('.win95-tb-btn')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      offX = e.clientX - rect.left;
      offY = e.clientY - rect.top;
      _snapTarget = null;
      showDragShield('move');
      e.preventDefault();
    }
    titlebar.addEventListener('mousedown', startDrag);
    // Alt+drag anywhere on the window body also starts a drag.
    win.addEventListener('mousedown', (e) => {
      if (!e.altKey || e.button !== 0) return;
      if (e.target.closest('.win95-tb-btn')) return;
      if (e.target.closest('.resize-handle')) return;
      startDrag(e);
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = e.clientX - offX;
      const y = e.clientY - offY;
      win.style.left = x + 'px';
      win.style.top = y + 'px';
      // Aero-style snap preview when cursor near edges.
      _snapTarget = computeSnapTarget(e.clientX, e.clientY, win);
      if (_snapTarget) showSnapHint(_snapTarget);
      else hideSnapHint();
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      hideDragShield();
      hideSnapHint();
      if (_snapTarget) {
        applySnapTarget(win, _snapTarget);
        _snapTarget = null;
        return;
      }
      const r = win.getBoundingClientRect();
      let nx = opts.snapOnDrop ? snap(r.left) : r.left;
      let ny = opts.snapOnDrop ? snap(r.top) : r.top;
      nx = Math.max(0, Math.min(nx, window.innerWidth - r.width));
      ny = Math.max(0, Math.min(ny, window.innerHeight - r.height));
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    });

    // Right-click on titlebar opens window header context menu.
    if (titlebar) {
      titlebar.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.win95-tb-btn')) return;
        e.preventDefault();
        e.stopPropagation();
        openWinHeaderCtx(e.clientX, e.clientY, win);
      });
    }

    win.addEventListener('contextmenu', (e) => { e.stopPropagation(); e.preventDefault(); });

    // Resize from corner handles, snapping to grid on release
    if (opts.resizable) {
      const handles = win.querySelectorAll('.resize-handle');
      handles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          // bring to front
          win.style.zIndex = String(++zCounter);

          const corner = handle.dataset.resize; // nw, ne, sw, se
          const startRect = win.getBoundingClientRect();
          const startX = e.clientX;
          const startY = e.clientY;
          const minSize = Math.max(40, state.grid);
          // Pick a cursor that matches the corner being dragged.
          const resizeCursor = (corner === 'nw' || corner === 'se') ? 'nwse-resize' : 'nesw-resize';
          showDragShield(resizeCursor);

          const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let left = startRect.left;
            let top = startRect.top;
            let width = startRect.width;
            let height = startRect.height;

            if (corner.includes('e')) {
              width = Math.max(minSize, startRect.width + dx);
            }
            if (corner.includes('s')) {
              height = Math.max(minSize, startRect.height + dy);
            }
            if (corner.includes('w')) {
              const newLeft = startRect.left + dx;
              const newWidth = startRect.right - newLeft;
              if (newWidth >= minSize) {
                left = newLeft;
                width = newWidth;
              } else {
                left = startRect.right - minSize;
                width = minSize;
              }
            }
            if (corner.includes('n')) {
              const newTop = startRect.top + dy;
              const newHeight = startRect.bottom - newTop;
              if (newHeight >= minSize) {
                top = newTop;
                height = newHeight;
              } else {
                top = startRect.bottom - minSize;
                height = minSize;
              }
            }
            win.style.left = left + 'px';
            win.style.top = top + 'px';
            win.style.width = width + 'px';
            win.style.height = height + 'px';
            // Live re-flow of icons in menu windows so the grid follows the size.
            relayoutMenuIcons(win);
          };

          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            hideDragShield();
            // Snap edges to nearest grid intersection
            const r = win.getBoundingClientRect();
            let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
            if (corner.includes('w')) left = snap(left);
            if (corner.includes('n')) top = snap(top);
            if (corner.includes('e')) right = snap(right);
            if (corner.includes('s')) bottom = snap(bottom);
            let width = Math.max(minSize, right - left);
            let height = Math.max(minSize, bottom - top);
            // keep on screen
            left = Math.max(0, Math.min(left, window.innerWidth - width));
            top = Math.max(0, Math.min(top, window.innerHeight - height));
            win.style.left = left + 'px';
            win.style.top = top + 'px';
            win.style.width = width + 'px';
            win.style.height = height + 'px';
            relayoutMenuIcons(win);
          };

          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        // Scroll-wheel on a resize handle to grow/shrink the window.
        handle.addEventListener('wheel', (e) => {
          e.preventDefault();
          const step = e.shiftKey ? 40 : 16;
          const dir = e.deltaY < 0 ? 1 : -1;
          const r = win.getBoundingClientRect();
          const newW = Math.max(160, r.width + dir * step);
          const newH = Math.max(120, r.height + dir * step);
          win.style.width = newW + 'px';
          win.style.height = newH + 'px';
          relayoutMenuIcons(win);
        }, { passive: false });
      });
    }
  }

  function clearWindows() {
    desktop.querySelectorAll('.win95-window').forEach(w => {
      if (w === settingsWin || w === iconPropsDialog) return;
      captureClosedWindow(w);
      unregisterTaskbarItem(w);
      w.remove();
    });
  }

  /* ---------- Save / Load Template ---------- */
  function serializeIcon(iconEl) {
    return {
      name: iconEl.dataset.name || '',
      image: iconEl.dataset.image || '📁',
      imageType: iconEl.dataset.imageType || 'emoji',
      type: iconEl.dataset.type || 'url',
      url: iconEl.dataset.url || '',
      widget: iconEl.dataset.widget || '',
      widgetSymbol: iconEl.dataset.widgetSymbol || '',
      widgetCode: iconEl.dataset.widgetCode || '',
      folderId: iconEl.dataset.folderId || '',
      folderItems: iconEl.dataset.folderItems || '',
      x: parseFloat(iconEl.style.left) || 0,
      y: parseFloat(iconEl.style.top) || 0,
    };
  }

  function serializeWindow(win) {
    const titleEl = win.querySelector('.win95-title');
    const title = titleEl ? titleEl.textContent.trim() : 'Untitled';
    const r = win.getBoundingClientRect();
    const icons = Array.from(win.querySelectorAll('.win-icon')).map(serializeIcon);
    return {
      title,
      x: parseFloat(win.style.left) || r.left,
      y: parseFloat(win.style.top) || r.top,
      w: parseFloat(win.style.width) || r.width,
      h: parseFloat(win.style.height) || r.height,
      minimized: win.classList.contains('minimized'),
      tickerSymbol: win.dataset.tickerSymbol || '',
      icons,
    };
  }

  // Snapshot of an open browser/widget window. parentMenuIdx points back to
  // the index of its menu in the windows array so we can re-link it on load.
  function serializeBrowserWindow(bw, menuIndex) {
    const titleEl = bw.querySelector('.win95-title');
    const fullTitle = titleEl ? titleEl.textContent.trim() : '';
    // Title is rendered as `${name} — ${suffix}`; recover just the name.
    const name = fullTitle.split(' — ')[0] || fullTitle || 'Browser';
    const frame = bw.querySelector('.browser-frame');
    const src = frame ? (frame.getAttribute('src') || '') : '';
    // blob: URLs (from code widgets) don't survive a reload — skip serializing them.
    if (/^blob:/i.test(src)) return null;
    const r = bw.getBoundingClientRect();
    return {
      kind: 'browser',
      name,
      url: src,
      isWidget: !!bw.dataset.widgetSlug,
      widgetSlug: bw.dataset.widgetSlug || '',
      parentMenuIdx: menuIndex,
      x: parseFloat(bw.style.left) || r.left,
      y: parseFloat(bw.style.top) || r.top,
      w: parseFloat(bw.style.width) || r.width,
      h: parseFloat(bw.style.height) || r.height,
      minimized: bw.classList.contains('minimized'),
    };
  }

  function saveTemplate(silent) {
    const allWins = Array.from(desktop.querySelectorAll('.win95-window'))
      .filter(w => w !== settingsWin && w !== iconPropsDialog);
    const menuWins = allWins.filter(w => !w.classList.contains('browser-window'));
    const browserWins = allWins.filter(w => w.classList.contains('browser-window'));
    // Map menu element -> index for back-references from browser windows.
    const menuIdx = new Map();
    menuWins.forEach((w, i) => menuIdx.set(w, i));
    const data = {
      version: 2,
      savedAt: new Date().toISOString(),
      windows: menuWins.map(serializeWindow),
      browserWindows: browserWins.map(bw =>
        serializeBrowserWindow(bw, menuIdx.has(bw._parentMenuWin) ? menuIdx.get(bw._parentMenuWin) : -1)
      ).filter(Boolean),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `win95-template-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (!silent && typeof showToast === 'function') showToast('Template saved');
  }

  function loadTemplate() {
    const input = document.getElementById('template-file');
    if (!input) return;
    input.value = '';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          applyTemplate(data);
        } catch (err) {
          alert('Could not load template: ' + (err && err.message ? err.message : err));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function applyTemplate(data) {
    if (!data || !Array.isArray(data.windows)) {
      alert('Template file is missing a windows array.');
      return;
    }
    clearWindows();
    const recreatedMenus = data.windows.map(spec => recreateWindow(spec));
    // Reopen any widget/browser windows that were open at save time.
    const browserSpecs = Array.isArray(data.browserWindows) ? data.browserWindows : [];
    browserSpecs.forEach(bs => {
      if (!bs || !bs.url) return;
      const parentWin = recreatedMenus[bs.parentMenuIdx] || null;
      const tile = { x: bs.x || 0, y: bs.y || 0, w: bs.w || 360, h: bs.h || 280 };
      createBrowserWindow(bs.url, bs.name || 'Browser', {
        isWidget: !!bs.isWidget,
        widgetSlug: bs.widgetSlug || '',
        parentWin,
        tile,
      });
      if (bs.minimized) {
        const all = desktop.querySelectorAll('.browser-window');
        const last = all[all.length - 1];
        if (last) minimizeWindow(last);
      }
    });
  }

  function recreateWindow(spec) {
    // Build a blank link-style window without auto-populating widget icons.
    const win = document.createElement('div');
    win.className = 'win95-window';
    const x = Math.max(0, Math.min(spec.x || 0, window.innerWidth - 100));
    const y = Math.max(0, Math.min(spec.y || 0, window.innerHeight - 50));
    win.style.left = x + 'px';
    win.style.top = y + 'px';
    win.style.width = (spec.w || 320) + 'px';
    win.style.height = (spec.h || 240) + 'px';
    win.style.zIndex = String(++zCounter);

    const titleText = spec.title || 'Untitled';
    const symbol = spec.tickerSymbol || 'BITSTAMP:BTCUSD';
    win.dataset.tickerSymbol = symbol;
    win.innerHTML = buildMenuWindowHtml(titleText, symbol);

    desktop.appendChild(win);
    wireWindow(win, { snapOnDrop: true, resizable: true });
    wireWindowIcons(win);
    wireMenuToolbar(win);
    registerTaskbarItem(win, { icon: '🗔', label: titleText });

    (spec.icons || []).forEach(ic => {
      const icon = createIcon(win, {
        x: (ic.x || 0) + ICON_SIZE / 2,
        y: (ic.y || 0) + ICON_SIZE / 2,
        name: ic.name || 'Untitled',
        image: ic.image || '📁',
        imageType: ic.imageType || 'emoji',
        url: ic.url || '',
        type: ic.type || 'url',
        widget: ic.widget || '',
        widgetSymbol: ic.widgetSymbol || '',
        widgetCode: ic.widgetCode || '',
      });
      // createIcon snaps to grid; restore exact saved position.
      if (icon) {
        icon.style.left = (ic.x || 0) + 'px';
        icon.style.top = (ic.y || 0) + 'px';
        if (ic.folderId) icon.dataset.folderId = ic.folderId;
        if (ic.folderItems) icon.dataset.folderItems = ic.folderItems;
      }
    });

    if (spec.minimized) minimizeWindow(win);
    return win;
  }

  /* ---------- Settings ---------- */
  function toggleSettings() {
    if (settingsWin.hidden) {
      const w = 340;
      const h = Math.min(640, window.innerHeight - 40);
      settingsWin.style.width = w + 'px';
      settingsWin.style.height = h + 'px';
      const left = Math.max(0, Math.round((window.innerWidth - w) / 2));
      const top = Math.max(0, Math.round((window.innerHeight - TASKBAR_H - h) / 2));
      settingsWin.style.left = left + 'px';
      settingsWin.style.top = top + 'px';
      settingsWin.hidden = false;
      settingsWin.style.zIndex = String(++zCounter);
    } else {
      settingsWin.hidden = true;
    }
  }

  // Make the settings panel + icon properties dialog draggable + closable.
  wireWindow(settingsWin, { snapOnDrop: false });
  wireWindow(iconPropsDialog, { snapOnDrop: false });

  /* ---------- Bind controls ---------- */
  // Each entry: [colorOrTextInputId, stateKey, type, numberInputId?]
  // type: 'text' (color/text input) or 'number' (slider, paired with number input)
  const bindings = [
    ['opt-bg',        'bg',      'text'],
    ['opt-line',      'line',    'text'],
    ['opt-line-w',    'lineW',   'number', 'num-line-w'],
    ['opt-dot',       'dot',     'text'],
    ['opt-dot-size',  'dotSize', 'number', 'num-dot-size'],
    ['opt-grid-size', 'grid',    'number', 'num-grid-size'],
    ['opt-tb',        'tb',      'text'],
    ['opt-tb-text',   'tbText',  'text'],
    ['opt-face',      'face',    'text'],
    ['opt-hi',        'hi',      'text'],
    ['opt-sh',        'sh',      'text'],
    ['opt-text',      'text',    'text'],
    ['opt-w',         'w',       'number', 'num-w'],
    ['opt-h',         'h',       'number', 'num-h'],
    ['opt-title',     'title',   'text'],
  ];

  function syncControlsFromState() {
    bindings.forEach(([id, key, type, numId]) => {
      const el = document.getElementById(id);
      if (el) el.value = state[key];
      if (numId) {
        const num = document.getElementById(numId);
        if (num) num.value = state[key];
      }
    });
  }

  bindings.forEach(([id, key, type, numId]) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', () => {
      const v = (type === 'number') ? Number(el.value) : el.value;
      if (type === 'number' && Number.isNaN(v)) return;
      state[key] = v;
      if (numId) {
        const num = document.getElementById(numId);
        if (num && document.activeElement !== num) num.value = el.value;
      }
      applyState();
    });

    if (numId) {
      const num = document.getElementById(numId);
      if (num) {
        num.addEventListener('input', () => {
          const v = Number(num.value);
          if (Number.isNaN(v)) return;
          state[key] = v;
          if (document.activeElement !== el) el.value = num.value;
          applyState();
        });
      }
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    state = { ...DEFAULTS };
    syncControlsFromState();
    applyState();
  });

  /* ============================================================
   *  QoL Features (in-memory only — no localStorage)
   * ============================================================ */

  // ---- Ticker history & favorites ----
  const tickerHistory = [];   // most recent first
  const tickerFavorites = []; // user-favorited symbols
  function addToTickerHistory(symbol) {
    if (!symbol) return;
    const i = tickerHistory.indexOf(symbol);
    if (i >= 0) tickerHistory.splice(i, 1);
    tickerHistory.unshift(symbol);
    while (tickerHistory.length > 20) tickerHistory.pop();
  }
  function toggleFavoriteTicker(symbol) {
    const i = tickerFavorites.indexOf(symbol);
    if (i >= 0) tickerFavorites.splice(i, 1);
    else tickerFavorites.unshift(symbol);
  }

  // ---- Closed-window stack (for ctrl+shift+t) ----
  const closedWindowStack = [];
  function captureClosedWindow(win) {
    if (win === settingsWin || win === iconPropsDialog) return;
    if (win.id === 'shortcuts-dialog' || win.id === 'compare-dialog' || win.id === 'confirm-dialog') return;
    if (win.id === 'tv-search-popup' || win.id === 'add-widget-popup') return;
    try {
      let entry;
      if (win.classList.contains('browser-window')) {
        entry = serializeBrowserWindow(win, -1);
      } else {
        entry = { kind: 'menu', spec: serializeWindow(win) };
      }
      if (!entry) return;
      closedWindowStack.push(entry);
      while (closedWindowStack.length > 20) closedWindowStack.shift();
    } catch (_) {}
  }
  function reopenLastClosed() {
    const e = closedWindowStack.pop();
    if (!e) { showToast('No recently closed windows'); return; }
    if (e.kind === 'menu') {
      recreateWindow(e.spec);
    } else {
      // browser window
      createBrowserWindow(e.url, e.name || 'Browser', {
        isWidget: !!e.isWidget,
        widgetSlug: e.widgetSlug || '',
        parentWin: null,
        tile: { x: e.x, y: e.y, w: e.w, h: e.h },
      });
    }
  }

  // ---- Always-on-top pinning ----
  function togglePin(win) {
    const pinned = win.dataset.pinned === 'true';
    win.dataset.pinned = pinned ? 'false' : 'true';
    win.style.zIndex = pinned ? String(++zCounter) : '999999';
  }

  // ---- Toast notifications ----
  const toastHost = document.getElementById('toast-host');
  function showToast(msg, ms) {
    if (!toastHost) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toastHost.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, ms || 2500);
  }

  // ---- Custom confirm dialog (replaces window.confirm) ----
  const confirmDlg = document.getElementById('confirm-dialog');
  let _confirmCb = null;
  function confirmDialog(msg, onYes) {
    if (!confirmDlg) { if (window.confirm(msg)) onYes && onYes(); return; }
    document.getElementById('confirm-msg').textContent = msg;
    _confirmCb = onYes;
    confirmDlg.style.width = '360px';
    confirmDlg.style.left = Math.max(0, (window.innerWidth - 360) / 2) + 'px';
    confirmDlg.style.top = Math.max(40, (window.innerHeight - 180) / 2) + 'px';
    confirmDlg.hidden = false;
    confirmDlg.style.zIndex = String(++zCounter);
  }
  if (confirmDlg) {
    confirmDlg.querySelector('[data-act="close"]').addEventListener('click', () => { confirmDlg.hidden = true; _confirmCb = null; });
    document.getElementById('confirm-no').addEventListener('click', () => { confirmDlg.hidden = true; _confirmCb = null; });
    document.getElementById('confirm-yes').addEventListener('click', () => {
      confirmDlg.hidden = true;
      const cb = _confirmCb; _confirmCb = null;
      if (cb) cb();
    });
  }

  // ---- Window arrange operations ----
  function cascadeWindows() {
    const wins = getAllUserWindows().filter(w => !w.classList.contains('minimized'));
    if (!wins.length) return;
    const startX = 20, startY = 20, step = 28;
    const targetW = Math.min(640, window.innerWidth - 100);
    const targetH = Math.min(480, window.innerHeight - 100 - TASKBAR_H);
    wins.forEach((w, i) => {
      if (w.dataset.maximized === 'true') toggleMaximize(w);
      w.style.left = (startX + i * step) + 'px';
      w.style.top = (startY + i * step) + 'px';
      w.style.width = targetW + 'px';
      w.style.height = targetH + 'px';
      w.style.zIndex = String(++zCounter);
    });
  }
  function tileWindows(mode) {
    const wins = getAllUserWindows().filter(w => !w.classList.contains('minimized'));
    const n = wins.length;
    if (!n) return;
    const fullW = window.innerWidth, fullH = window.innerHeight - TASKBAR_H;
    let cols, rows;
    if (mode === 'h') { cols = 1; rows = n; }
    else if (mode === 'v') { cols = n; rows = 1; }
    else {
      cols = Math.ceil(Math.sqrt(n));
      rows = Math.ceil(n / cols);
    }
    const cw = Math.floor(fullW / cols);
    const ch = Math.floor(fullH / rows);
    wins.forEach((w, i) => {
      if (w.dataset.maximized === 'true') toggleMaximize(w);
      const c = i % cols, r = Math.floor(i / cols);
      w.style.left = (c * cw) + 'px';
      w.style.top = (r * ch) + 'px';
      w.style.width = cw + 'px';
      w.style.height = ch + 'px';
    });
  }
  function minimizeAll() {
    getAllUserWindows().forEach(w => { if (!w.classList.contains('minimized')) minimizeWindow(w); });
  }
  function restoreAll() {
    getAllUserWindows().forEach(w => { if (w.classList.contains('minimized')) restoreWindow(w); });
  }
  let _showDesktopState = false;
  function toggleShowDesktop() {
    if (_showDesktopState) { restoreAll(); _showDesktopState = false; }
    else { minimizeAll(); _showDesktopState = true; }
    const btn = document.getElementById('tray-show-desktop');
    if (btn) btn.classList.toggle('active', _showDesktopState);
  }
  function refreshAllIframes() {
    desktop.querySelectorAll('.browser-frame').forEach(f => {
      const src = f.getAttribute('src');
      if (src) {
        f.setAttribute('src', 'about:blank');
        setTimeout(() => f.setAttribute('src', src), FRAME_RELOAD_DELAY);
      }
    });
    showToast('Refreshing all windows');
  }

  // Re-flow icons in a menu window to fit the current body width. Preserves
  // the user's ordering (sorted by current position: row-major top->bottom,
  // left->right) while ensuring no icon falls outside the visible body and
  // the grid expands/contracts with the window. Called on resize.
  function relayoutMenuIcons(win) {
    if (!win || !win.querySelector('.menu-toolbar')) return; // menu windows only
    const body = win.querySelector('.win95-body');
    if (!body) return;
    const icons = Array.from(body.querySelectorAll('.win-icon'));
    if (!icons.length) return;
    const PAD = 8;
    const bw = body.clientWidth || 400;
    const cols = Math.max(1, Math.floor((bw - PAD * 2) / ICON_GRID));
    const startX = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const startY = PAD + (ICON_GRID - ICON_SIZE) / 2;
    // Sort by current position so user-arranged order is preserved.
    icons.sort((a, b) => {
      const at = parseFloat(a.style.top) || 0;
      const bt = parseFloat(b.style.top) || 0;
      if (Math.abs(at - bt) > ICON_GRID / 2) return at - bt;
      const al = parseFloat(a.style.left) || 0;
      const bl = parseFloat(b.style.left) || 0;
      return al - bl;
    });
    icons.forEach((ic, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      ic.style.left = (startX + c * ICON_GRID) + 'px';
      ic.style.top = (startY + r * ICON_GRID) + 'px';
    });
  }

  // ---- Icon arrangement within a menu window ----
  function arrangeIcons(win, by) {
    const body = win.querySelector('.win95-body');
    if (!body) return;
    const icons = Array.from(body.querySelectorAll('.win-icon'));
    if (!icons.length) return;
    const keyFn = {
      name: ic => (ic.dataset.name || '').toLowerCase(),
      type: ic => (ic.dataset.type || '') + '|' + (ic.dataset.widget || '') + '|' + (ic.dataset.name || '').toLowerCase(),
      size: ic => ((ic.dataset.imageType === 'data') ? '0' : '1') + '|' + (ic.dataset.name || '').toLowerCase(),
    }[by] || (ic => ic.dataset.name || '');
    icons.sort((a, b) => {
      const ka = keyFn(a), kb = keyFn(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const PAD = 8;
    const bw = body.clientWidth || 400;
    const cols = Math.max(1, Math.floor((bw - PAD * 2) / ICON_GRID));
    const startX = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const startY = PAD + (ICON_GRID - ICON_SIZE) / 2;
    icons.forEach((ic, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      ic.style.left = (startX + c * ICON_GRID) + 'px';
      ic.style.top = (startY + r * ICON_GRID) + 'px';
    });
  }
  // Folder helpers ----------------------------------------------------------
  // Read/write the JSON-serialized array of items stored on a folder icon.
  function getFolderItems(folderEl) {
    try { return JSON.parse(folderEl.dataset.folderItems || '[]') || []; }
    catch (e) { return []; }
  }
  function setFolderItems(folderEl, items) {
    folderEl.dataset.folderItems = JSON.stringify(items || []);
    // Update the visible count badge.
    renderFolderBadge(folderEl);
  }
  function renderFolderBadge(folderEl) {
    const count = getFolderItems(folderEl).length;
    let badge = folderEl.querySelector('.folder-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'folder-badge';
        folderEl.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }
  // Snapshot the icon's current data into a plain object suitable for
  // pushing into a folder's items array.
  function snapshotIcon(iconEl) {
    return {
      name: iconEl.dataset.name || '',
      image: iconEl.dataset.image || '📁',
      imageType: iconEl.dataset.imageType || 'emoji',
      type: iconEl.dataset.type || 'url',
      url: iconEl.dataset.url || '',
      widget: iconEl.dataset.widget || '',
      widgetSymbol: iconEl.dataset.widgetSymbol || '',
      widgetCode: iconEl.dataset.widgetCode || '',
    };
  }
  // Find a folder icon whose grid slot contains (left, top). Returns null if
  // no folder is at that slot, or if the dragged icon IS itself a folder.
  function folderAtSlot(body, draggingIcon, targetL, targetT) {
    if ((draggingIcon.dataset.type || '') === 'folder') return null;
    const icons = body.querySelectorAll('.win-icon');
    for (const ic of icons) {
      if (ic === draggingIcon) continue;
      if ((ic.dataset.type || '') !== 'folder') continue;
      const il = parseFloat(ic.style.left) || 0;
      const it = parseFloat(ic.style.top) || 0;
      if (Math.abs(il - targetL) < 4 && Math.abs(it - targetT) < 4) return ic;
    }
    return null;
  }
  // Move an icon's data into a folder, then remove the icon element.
  function moveIconIntoFolder(iconEl, folderEl) {
    const items = getFolderItems(folderEl);
    items.push(snapshotIcon(iconEl));
    setFolderItems(folderEl, items);
    iconEl.remove();
  }

  // Open an in-window panel showing this folder's contents. The panel is
  // overlaid on the menu's body and includes a Back button that returns to
  // the main icon grid. Items shown here can be dragged out (drop above the
  // ↖ back button area) to leave the folder.
  function openFolderPanel(folderEl) {
    const win = folderEl.closest('.win95-window');
    if (!win) return;
    const body = win.querySelector('.win95-body');
    if (!body) return;
    // Close any existing panel in this window first.
    const old = body.querySelector('.folder-panel');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.className = 'folder-panel';
    panel.dataset.folderId = folderEl.dataset.folderId || '';
    panel.innerHTML = `
      <div class="folder-panel-bar">
        <button class="folder-back" type="button" title="Back to menu">← Back</button>
        <span class="folder-panel-title"></span>
      </div>
      <div class="folder-panel-body"></div>
    `;
    panel.querySelector('.folder-panel-title').textContent = folderEl.dataset.name || 'Folder';
    body.appendChild(panel);
    panel.querySelector('.folder-back').addEventListener('click', () => panel.remove());
    renderFolderPanelItems(panel, folderEl);
  }

  // Build/refresh the icon grid inside a folder panel from the folder's items.
  function renderFolderPanelItems(panel, folderEl) {
    const inner = panel.querySelector('.folder-panel-body');
    if (!inner) return;
    inner.innerHTML = '';
    const items = getFolderItems(folderEl);
    const PAD = 8;
    const startX = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const startY = PAD + (ICON_GRID - ICON_SIZE) / 2;
    const bw = inner.clientWidth || 400;
    const cols = Math.max(1, Math.floor((bw - PAD * 2) / ICON_GRID));

    // Built-in "Back to Menu" pseudo-folder, always slot 0. Double-click closes
    // this panel and returns to the main menu icon grid.
    const back = document.createElement('div');
    back.className = 'win-icon folder-child folder-back-icon';
    back.dataset.type = 'folder-back';
    back.style.left = startX + 'px';
    back.style.top = startY + 'px';
    renderIconContent(back, '📂', 'emoji', 'Back to Menu');
    inner.appendChild(back);
    back.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    back.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      panel.remove();
    });

    // Real folder items start at slot 1 so the Back icon owns slot 0.
    items.forEach((it, i) => {
      const slot = i + 1;
      const c = slot % cols, r = Math.floor(slot / cols);
      const icon = document.createElement('div');
      icon.className = 'win-icon folder-child';
      icon.dataset.url = it.url || '';
      icon.dataset.type = it.type || 'url';
      icon.dataset.widget = it.widget || '';
      icon.dataset.widgetSymbol = it.widgetSymbol || '';
      icon.dataset.imageType = it.imageType || 'emoji';
      icon.dataset.image = it.image || '📁';
      if (it.widgetCode) icon.dataset.widgetCode = it.widgetCode;
      icon.dataset.folderIndex = String(i);
      icon.style.left = (startX + c * ICON_GRID) + 'px';
      icon.style.top = (startY + r * ICON_GRID) + 'px';
      renderIconContent(icon, it.image || '📁', it.imageType || 'emoji', it.name || '');
      inner.appendChild(icon);
      wireFolderChildIcon(icon, folderEl, panel);
    });
    renderFolderBadge(folderEl);
  }

  // Drag/drop wiring for icons inside an open folder panel. Drop on the
  // panel's bar (or outside the panel body) ejects the icon back to the menu.
  function wireFolderChildIcon(icon, folderEl, panel) {
    const win = folderEl.closest('.win95-window');
    icon.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      openIconTarget(icon);
    });
    icon.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      let dragging = false;
      const panelRect = panel.getBoundingClientRect();
      const backIcon = panel.querySelector('.folder-back-icon');
      const isOverBack = (ev) => {
        if (!backIcon) return false;
        const r = backIcon.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right
          && ev.clientY >= r.top && ev.clientY <= r.bottom;
      };
      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!dragging && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!dragging) {
          dragging = true;
          icon.classList.add('dragging');
          showDragShield('grabbing');
          // Float the icon to follow the cursor (simple visual feedback).
          icon.style.position = 'fixed';
          icon.style.zIndex = '2147483647';
        }
        icon.style.left = (ev.clientX - ICON_SIZE / 2) + 'px';
        icon.style.top = (ev.clientY - ICON_SIZE / 2) + 'px';
        if (backIcon) backIcon.classList.toggle('folder-hover', isOverBack(ev));
      };
      const onUp = (ev) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!dragging) return;
        icon.classList.remove('dragging');
        hideDragShield();
        if (backIcon) backIcon.classList.remove('folder-hover');
        const insidePanel = ev.clientX >= panelRect.left && ev.clientX <= panelRect.right
          && ev.clientY >= panelRect.top && ev.clientY <= panelRect.bottom;
        const onBack = isOverBack(ev);
        const idx = parseInt(icon.dataset.folderIndex || '-1', 10);
        const items = getFolderItems(folderEl);
        // Drop on back-to-menu icon, or outside the panel: eject to menu.
        if ((onBack || !insidePanel) && idx >= 0 && idx < items.length) {
          const removed = items.splice(idx, 1)[0];
          setFolderItems(folderEl, items);
          // Place the ejected icon at a free slot in the menu.
          const slot = findFreeIconSlot(win);
          createIcon(win, {
            x: slot.x, y: slot.y,
            name: removed.name,
            image: removed.image,
            imageType: removed.imageType,
            url: removed.url,
            type: removed.type,
            widget: removed.widget,
            widgetSymbol: removed.widgetSymbol,
            widgetCode: removed.widgetCode,
          });
          renderFolderPanelItems(panel, folderEl);
          return;
        }
        // Otherwise re-render to snap back into the grid.
        renderFolderPanelItems(panel, folderEl);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function addFolderIcon(win, x, y) {
    const slot = (typeof x === 'number' && typeof y === 'number') ? { x, y } : findFreeIconSlot(win);
    const ic = createIcon(win, {
      x: slot.x, y: slot.y,
      name: 'New Folder',
      image: '📁',
      imageType: 'emoji',
      url: '',
      type: 'folder',
      widget: '',
      widgetSymbol: '',
    });
    if (ic) {
      ic.dataset.folderId = 'fld-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      ic.dataset.folderItems = '[]';
    }
    return ic;
  }

  // ---- Edge-snap on drag (Aero-style) ----
  // Hint overlay element that previews the snap target while dragging.
  let _snapHint = null;
  function showSnapHint(rect) {
    if (!_snapHint) {
      _snapHint = document.createElement('div');
      _snapHint.id = 'snap-hint';
      document.body.appendChild(_snapHint);
    }
    _snapHint.style.left = rect.x + 'px';
    _snapHint.style.top = rect.y + 'px';
    _snapHint.style.width = rect.w + 'px';
    _snapHint.style.height = rect.h + 'px';
    _snapHint.style.display = 'block';
  }
  function hideSnapHint() { if (_snapHint) _snapHint.style.display = 'none'; }
  function computeSnapTarget(clientX, clientY, draggingWin) {
    const W = window.innerWidth, H = window.innerHeight - TASKBAR_H;
    const T = 8; // px threshold from screen edge
    // Screen-edge snaps take priority.
    if (clientY <= T) return { kind: 'max', x: 0, y: 0, w: W, h: H };
    if (clientX <= T) return { kind: 'left', x: 0, y: 0, w: Math.floor(W / 2), h: H };
    if (clientX >= W - T) return { kind: 'right', x: Math.ceil(W / 2), y: 0, w: Math.floor(W / 2), h: H };

    // Neighbor-snap: when the dragged window's edge is near another window's
    // opposite edge, match that neighbor's height + y so the two sit flush.
    if (!draggingWin) return null;
    const NT = 24; // neighbor proximity threshold in px
    const dr = draggingWin.getBoundingClientRect();
    let best = null;
    document.querySelectorAll('.win95-window').forEach(other => {
      if (other === draggingWin) return;
      if (other.classList.contains('minimized')) return;
      if (other.hidden) return;
      const style = other.style;
      // Skip dialogs/popups by id.
      if (other.id === 'icon-props' || other.id === 'shortcuts-dialog' ||
          other.id === 'compare-dialog' || other.id === 'confirm-dialog' ||
          other.id === 'tv-search-popup' || other.id === 'add-widget-popup' ||
          other.id === 'settings-panel') return;
      if (style && style.display === 'none') return;
      const r = other.getBoundingClientRect();
      // Vertical overlap (used for left/right neighbor snaps).
      const vOverlap = Math.min(dr.bottom, r.bottom) - Math.max(dr.top, r.top);
      const vOk = vOverlap >= r.height * 0.2 || vOverlap >= dr.height * 0.2;
      // Horizontal overlap (used for top/bottom neighbor snaps).
      const hOverlap = Math.min(dr.right, r.right) - Math.max(dr.left, r.left);
      const hOk = hOverlap >= r.width * 0.2 || hOverlap >= dr.width * 0.2;

      // Min size when shrinking to fit available space.
      const MIN = 120;
      // Snap dragged-LEFT to neighbor-RIGHT, or dragged-RIGHT to neighbor-LEFT.
      // Shrink dragged width if there isn't enough room so windows never overlap.
      if (vOk) {
        const distL = Math.abs(dr.left - r.right);
        const distR = Math.abs(dr.right - r.left);
        if (distL <= NT && distL <= distR) {
          const avail = W - r.right;
          if (avail >= MIN) {
            const w = Math.min(dr.width, avail);
            const cand = { kind: 'neighbor-right', x: r.right, y: r.top, w, h: r.height, dist: distL };
            if (!best || cand.dist < best.dist) best = cand;
          }
        } else if (distR <= NT) {
          const avail = r.left;
          if (avail >= MIN) {
            const w = Math.min(dr.width, avail);
            const cand = { kind: 'neighbor-left', x: r.left - w, y: r.top, w, h: r.height, dist: distR };
            if (!best || cand.dist < best.dist) best = cand;
          }
        }
      }
      // Snap dragged-TOP to neighbor-BOTTOM, or dragged-BOTTOM to neighbor-TOP.
      // Match neighbor's width + x, shrink dragged height to fit available space.
      if (hOk) {
        const distT = Math.abs(dr.top - r.bottom);
        const distB = Math.abs(dr.bottom - r.top);
        if (distT <= NT && distT <= distB) {
          const avail = H - r.bottom;
          if (avail >= MIN) {
            const h = Math.min(dr.height, avail);
            const cand = { kind: 'neighbor-bottom', x: r.left, y: r.bottom, w: r.width, h, dist: distT };
            if (!best || cand.dist < best.dist) best = cand;
          }
        } else if (distB <= NT) {
          const avail = r.top;
          if (avail >= MIN) {
            const h = Math.min(dr.height, avail);
            const cand = { kind: 'neighbor-top', x: r.left, y: r.top - h, w: r.width, h, dist: distB };
            if (!best || cand.dist < best.dist) best = cand;
          }
        }
      }
    });
    if (best) return best;
    return null;
  }
  function applySnapTarget(win, target) {
    if (!target) return;
    if (target.kind === 'max') {
      // Use existing maximize logic so the restore button toggles properly.
      if (win.dataset.maximized !== 'true') toggleMaximize(win);
      return;
    }
    // Remember pre-snap rect so left/right halves can restore on the next drag
    // (neighbor snaps keep the dragged window's width, so no need to remember).
    if (target.kind === 'left' || target.kind === 'right') {
      win._preMaxRect = {
        left: win.style.left, top: win.style.top,
        width: win.style.width, height: win.style.height,
      };
    }
    win.style.left = target.x + 'px';
    win.style.top = target.y + 'px';
    win.style.width = target.w + 'px';
    win.style.height = target.h + 'px';
  }

  // ---- Window header context menu ----
  const winHeaderCtx = document.getElementById('win-header-ctx');
  let _winHeaderTarget = null;
  function openWinHeaderCtx(x, y, win) {
    _winHeaderTarget = win;
    if (!winHeaderCtx) return;
    // Show/hide options based on state.
    const max = winHeaderCtx.querySelector('[data-action="win-max"]');
    const restore = winHeaderCtx.querySelector('[data-action="win-restore"]');
    const isMax = win.dataset.maximized === 'true';
    if (max) max.style.display = isMax ? 'none' : '';
    if (restore) restore.style.display = isMax ? '' : 'none';
    const isBrowser = win.classList.contains('browser-window');
    winHeaderCtx.querySelectorAll('[data-action="win-reload"], [data-action="win-export"]').forEach(li => {
      li.style.display = isBrowser ? '' : '';
    });
    const pin = winHeaderCtx.querySelector('[data-action="win-pin"]');
    if (pin) {
      const lbl = pin.querySelector('.ctx-label');
      if (lbl) lbl.textContent = (win.dataset.pinned === 'true' ? 'Unpin (was Always on Top)' : 'Always on Top');
    }
    winHeaderCtx.hidden = false;
    const r = winHeaderCtx.getBoundingClientRect();
    winHeaderCtx.style.left = Math.min(x, window.innerWidth - r.width - 2) + 'px';
    winHeaderCtx.style.top = Math.min(y, window.innerHeight - r.height - 2) + 'px';
    winHeaderCtx.style.zIndex = String(++zCounter);
  }
  function closeWinHeaderCtx() { if (winHeaderCtx) winHeaderCtx.hidden = true; _winHeaderTarget = null; }
  if (winHeaderCtx) {
    winHeaderCtx.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-action]');
      if (!li) return;
      const a = li.dataset.action;
      const win = _winHeaderTarget;
      closeWinHeaderCtx();
      if (!win) return;
      if (a === 'win-min') minimizeWindow(win);
      if (a === 'win-max' || a === 'win-restore') toggleMaximize(win);
      if (a === 'win-pin') togglePin(win);
      if (a === 'win-front') win.style.zIndex = String(++zCounter);
      if (a === 'win-back') win.style.zIndex = String(--zCounter > 0 ? zCounter : 1);
      if (a === 'win-reload') {
        const rb = win.querySelector('[data-act="reload"]');
        if (rb) rb.click();
      }
      if (a === 'win-export') exportSingleWindow(win);
      if (a === 'win-close') {
        const cb = win.querySelector('[data-act="close"]');
        if (cb) cb.click();
      }
    });
  }

  // ---- Taskbar item context menu ----
  const taskbarCtx = document.getElementById('taskbar-ctx');
  let _taskbarCtxWin = null;
  function openTaskbarCtx(x, y, win) {
    _taskbarCtxWin = win;
    if (!taskbarCtx) return;
    const isMin = win.classList.contains('minimized');
    const isMax = win.dataset.maximized === 'true';
    taskbarCtx.querySelector('[data-action="tb-restore"]').style.display = isMin ? '' : 'none';
    taskbarCtx.querySelector('[data-action="tb-min"]').style.display = isMin ? 'none' : '';
    taskbarCtx.querySelector('[data-action="tb-max"]').style.display = isMax ? 'none' : '';
    taskbarCtx.hidden = false;
    const r = taskbarCtx.getBoundingClientRect();
    taskbarCtx.style.left = Math.min(x, window.innerWidth - r.width - 2) + 'px';
    taskbarCtx.style.top = Math.min(y, window.innerHeight - r.height - 2) + 'px';
    taskbarCtx.style.zIndex = String(++zCounter);
  }
  function closeTaskbarCtx() { if (taskbarCtx) taskbarCtx.hidden = true; _taskbarCtxWin = null; }
  if (taskbarCtx) {
    taskbarCtx.addEventListener('click', (e) => {
      const li = e.target.closest('li[data-action]');
      if (!li) return;
      const a = li.dataset.action;
      const win = _taskbarCtxWin;
      closeTaskbarCtx();
      if (!win) return;
      if (a === 'tb-restore') restoreWindow(win);
      if (a === 'tb-min') minimizeWindow(win);
      if (a === 'tb-max') toggleMaximize(win);
      if (a === 'tb-close') {
        const cb = win.querySelector('[data-act="close"]');
        if (cb) cb.click();
      }
    });
  }

  // ---- Single-window export/import ----
  function exportSingleWindow(win) {
    let data;
    try {
      if (win.classList.contains('browser-window')) {
        const payload = serializeBrowserWindow(win, -1);
        if (!payload) { showToast('Code-widget windows can\'t be exported standalone'); return; }
        data = { kind: 'browser', payload };
      } else {
        data = { kind: 'menu', payload: serializeWindow(win) };
      }
    } catch (e) { showToast('Export failed: ' + e.message); return; }
    const blob = new Blob([JSON.stringify({ version: 1, type: 'single-window', data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const titleEl = win.querySelector('.win95-title');
    const safe = (titleEl ? titleEl.textContent : 'window').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
    a.download = 'window-' + safe + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Exported window: ' + (titleEl ? titleEl.textContent : ''));
  }
  function importSingleWindow() {
    const input = document.getElementById('single-window-file');
    if (!input) return;
    input.value = '';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          const data = obj && obj.data;
          if (!data || !data.kind) throw new Error('not a single-window file');
          if (data.kind === 'menu') recreateWindow(data.payload);
          else if (data.kind === 'browser') {
            const p = data.payload;
            createBrowserWindow(p.url, p.name || 'Browser', {
              isWidget: !!p.isWidget,
              widgetSlug: p.widgetSlug || '',
              tile: { x: p.x, y: p.y, w: p.w, h: p.h },
            });
          }
        } catch (err) { showToast('Could not import: ' + err.message); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ---- Autosave layout ----
  let _autosaveTimer = null;
  function toggleAutosave(btn) {
    if (_autosaveTimer) {
      clearInterval(_autosaveTimer);
      _autosaveTimer = null;
      if (btn) btn.textContent = 'Autosave: Off';
      showToast('Autosave disabled');
    } else {
      _autosaveTimer = setInterval(() => {
        try { saveTemplate(true); } catch (_) {}
      }, 10 * 60 * 1000); // every 10 minutes
      if (btn) btn.textContent = 'Autosave: 10m';
      showToast('Autosave enabled — a layout file will download every 10 minutes');
    }
  }

  // ---- Compare-mode dialog ----
  const compareDlg = document.getElementById('compare-dialog');
  if (compareDlg) {
    compareDlg.querySelector('[data-act="close"]').addEventListener('click', () => compareDlg.hidden = true);
    document.getElementById('compare-cancel').addEventListener('click', () => compareDlg.hidden = true);
    document.getElementById('compare-go').addEventListener('click', () => {
      const list = (document.getElementById('compare-list').value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 8);
      const slug = document.getElementById('compare-widget').value || 'mini-symbol-overview';
      if (!list.length) { showToast('Enter at least one ticker'); return; }
      compareDlg.hidden = true;
      openCompareGrid(list, slug);
    });
  }
  function openCompareDialog() {
    if (!compareDlg) return;
    compareDlg.style.width = '420px';
    compareDlg.style.left = Math.max(0, (window.innerWidth - 420) / 2) + 'px';
    compareDlg.style.top = Math.max(40, (window.innerHeight - 360) / 2) + 'px';
    compareDlg.hidden = false;
    compareDlg.style.zIndex = String(++zCounter);
  }
  function openCompareGrid(symbols, slug) {
    const n = symbols.length;
    const fullW = window.innerWidth, fullH = window.innerHeight - TASKBAR_H;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cw = Math.floor(fullW / cols), ch = Math.floor(fullH / rows);
    symbols.forEach((sym, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const url = 'widget.html?w=' + encodeURIComponent(slug) + '&symbol=' + encodeURIComponent(sym);
      createBrowserWindow(url, sym, {
        isWidget: true,
        widgetSlug: slug,
        tile: { x: c * cw, y: r * ch, w: cw, h: ch },
      });
      addToTickerHistory(sym);
    });
    rebuildAllTickerSelects();
    showToast('Compare: opened ' + n + ' tickers');
  }

  // ---- Shortcuts dialog ----
  const shortcutsDlg = document.getElementById('shortcuts-dialog');
  function openShortcuts() {
    if (!shortcutsDlg) return;
    shortcutsDlg.style.width = '480px';
    shortcutsDlg.style.left = Math.max(0, (window.innerWidth - 480) / 2) + 'px';
    shortcutsDlg.style.top = Math.max(40, (window.innerHeight - 520) / 2) + 'px';
    shortcutsDlg.hidden = false;
    shortcutsDlg.style.zIndex = String(++zCounter);
  }
  if (shortcutsDlg) {
    shortcutsDlg.querySelector('[data-act="close"]').addEventListener('click', () => shortcutsDlg.hidden = true);
  }

  // ---- Desktop zoom (Ctrl+= / Ctrl+- / Ctrl+0) ----
  let _desktopZoom = 1;
  function applyZoom() {
    desktop.style.transformOrigin = '0 0';
    desktop.style.transform = _desktopZoom === 1 ? '' : ('scale(' + _desktopZoom + ')');
    showToast('Zoom: ' + Math.round(_desktopZoom * 100) + '%');
  }
  function zoomIn() { _desktopZoom = Math.min(2, +(_desktopZoom + 0.1).toFixed(2)); applyZoom(); }
  function zoomOut() { _desktopZoom = Math.max(0.5, +(_desktopZoom - 0.1).toFixed(2)); applyZoom(); }
  function zoomReset() { _desktopZoom = 1; applyZoom(); }

  // ---- Fullscreen ----
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  // ---- Status dots on iframe load/error ----
  function attachStatusDot(win) {
    const tb = win.querySelector('.win95-titlebar');
    const frame = win.querySelector('.browser-frame');
    if (!tb || !frame) return;
    let dot = tb.querySelector('.status-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'status-dot loading';
      dot.title = 'Loading…';
      tb.insertBefore(dot, tb.firstChild);
    }
    let timeout = setTimeout(() => {
      // If we never got a load event (cross-origin), assume ok.
      if (dot.classList.contains('loading')) {
        dot.classList.remove('loading');
        dot.classList.add('ok');
        dot.title = 'Loaded';
      }
    }, 6000);
    frame.addEventListener('load', () => {
      clearTimeout(timeout);
      dot.classList.remove('loading', 'fail');
      dot.classList.add('ok');
      dot.title = 'Loaded';
      const btn = taskbarMap.get(win);
      if (btn) {
        btn.classList.remove('flashing');
        // Force reflow so the animation re-triggers if reloaded.
        // eslint-disable-next-line no-unused-expressions
        btn.offsetWidth;
        btn.classList.add('flashing');
      }
    });
    frame.addEventListener('error', () => {
      clearTimeout(timeout);
      dot.classList.remove('loading', 'ok');
      dot.classList.add('fail');
      dot.title = 'Failed to load';
    });
  }

  // ---- Tray clock ----
  const trayClock = document.getElementById('tray-clock');
  function updateClock() {
    if (!trayClock) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    trayClock.textContent = hh + ':' + mm;
    trayClock.title = d.toDateString() + '  ' + hh + ':' + mm + ':' + String(d.getSeconds()).padStart(2, '0');
  }
  setInterval(updateClock, 1000 * 30);
  updateClock();
  if (trayClock) {
    trayClock.addEventListener('click', () => showToast(new Date().toString()));
  }
  const trayFs = document.getElementById('tray-fullscreen');
  if (trayFs) trayFs.addEventListener('click', toggleFullscreen);
  const trayShowDesktop = document.getElementById('tray-show-desktop');
  if (trayShowDesktop) trayShowDesktop.addEventListener('click', toggleShowDesktop);

  // ---- Global keyboard shortcuts ----
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in an input/textarea/contenteditable.
    const t = e.target;
    const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.shiftKey && (e.key === 'w' || e.key === 'W')) {
      const w = getActiveWindow();
      if (w) {
        e.preventDefault();
        const cb = w.querySelector('[data-act="close"]');
        if (cb) cb.click();
      }
      return;
    }
    if (ctrl && !e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      const wins = getAllUserWindows().filter(w => !w.classList.contains('minimized'));
      if (!wins.length) return;
      wins.sort((a, b) => parseInt(a.style.zIndex || '0', 10) - parseInt(b.style.zIndex || '0', 10));
      const next = wins[0];
      next.style.zIndex = String(++zCounter);
      setActiveTaskbarItem(next);
      return;
    }
    if (ctrl && e.shiftKey && e.key === 'Tab') {
      e.preventDefault();
      const wins = getAllUserWindows().filter(w => !w.classList.contains('minimized'));
      if (!wins.length) return;
      wins.sort((a, b) => parseInt(b.style.zIndex || '0', 10) - parseInt(a.style.zIndex || '0', 10));
      const next = wins[1] || wins[0];
      if (next) { next.style.zIndex = String(++zCounter); setActiveTaskbarItem(next); }
      return;
    }
    if (ctrl && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      toggleShowDesktop();
      return;
    }
    if (ctrl && e.shiftKey && (e.key === 'T' || e.key === 't')) {
      e.preventDefault();
      reopenLastClosed();
      return;
    }
    if (!inField && (e.key === 'F1' || e.key === '?')) {
      e.preventDefault();
      openShortcuts();
      return;
    }
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (ctrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      zoomIn();
      return;
    }
    if (ctrl && e.key === '-') {
      e.preventDefault();
      zoomOut();
      return;
    }
    if (ctrl && e.key === '0') {
      e.preventDefault();
      zoomReset();
      return;
    }
  });

  /* ---------- Helpers ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // Transparent fullscreen overlay used while dragging/resizing windows so
  // mouse events don't get captured by iframes underneath. Stacked above
  // every window via a very high z-index. Reference-counted so multiple
  // simultaneous interactions still work.
  let _dragShieldEl = null;
  let _dragShieldUses = 0;
  // Tracks iframes whose pointer-events we disabled so we can restore them.
  // Disabling pointer-events on the iframe itself ensures the iframe being
  // resized (and any other iframes) cannot capture mouse events even if the
  // shield somehow misses a region (e.g. browser-specific iframe quirks).
  let _disabledIframes = [];
  function showDragShield(cursor) {
    _dragShieldUses++;
    if (_dragShieldEl) {
      if (cursor) _dragShieldEl.style.cursor = cursor;
      return;
    }
    const sh = document.createElement('div');
    sh.id = 'drag-shield';
    sh.style.cssText = 'position:fixed; inset:0; z-index:2147483646; cursor:' + (cursor || 'default') + '; background:transparent;';
    document.body.appendChild(sh);
    _dragShieldEl = sh;
    // Belt-and-suspenders: also disable pointer-events on every iframe so
    // the iframe being resized can't intercept the mouse during the drag.
    _disabledIframes = [];
    document.querySelectorAll('iframe').forEach(f => {
      _disabledIframes.push({ el: f, prev: f.style.pointerEvents });
      f.style.pointerEvents = 'none';
    });
  }
  function hideDragShield() {
    _dragShieldUses = Math.max(0, _dragShieldUses - 1);
    if (_dragShieldUses === 0 && _dragShieldEl) {
      _dragShieldEl.remove();
      _dragShieldEl = null;
      // Restore iframe pointer-events.
      _disabledIframes.forEach(({ el, prev }) => { el.style.pointerEvents = prev || ''; });
      _disabledIframes = [];
    }
  }

  // Make a centered fixed-position popup draggable by its titlebar.
  // Converts the initial transform-based centering into absolute left/top on
  // first drag so subsequent moves follow the cursor.
  function makeDialogDraggable(pop) {
    const tb = pop.querySelector('.win95-titlebar');
    if (!tb) return;
    tb.style.cursor = 'move';
    let dragging = false, offX = 0, offY = 0;
    tb.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.win95-tb-btn')) return;
      // Convert centered transform into concrete left/top so dragging works.
      const r = pop.getBoundingClientRect();
      pop.style.transform = 'none';
      pop.style.left = r.left + 'px';
      pop.style.top = r.top + 'px';
      dragging = true;
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      pop.style.zIndex = String(++zCounter);
      showDragShield('move');
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      let x = e.clientX - offX;
      let y = e.clientY - offY;
      const r = pop.getBoundingClientRect();
      x = Math.max(0, Math.min(x, window.innerWidth - r.width));
      y = Math.max(0, Math.min(y, window.innerHeight - r.height));
      pop.style.left = x + 'px';
      pop.style.top = y + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; hideDragShield(); }
    });
  }

  /* ---------- Default template (opt-in localStorage persistence) ---------- */
  // Only used by this one feature; everything else still uses file download/upload.
  const LS_KEY_TPL = 'win95-default-template';
  const LS_KEY_ENABLED = 'win95-default-template-enabled';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function buildCurrentTemplate() {
    const allWins = Array.from(desktop.querySelectorAll('.win95-window'))
      .filter(w => w !== settingsWin && w !== iconPropsDialog);
    const menuWins = allWins.filter(w => !w.classList.contains('browser-window'));
    const browserWins = allWins.filter(w => w.classList.contains('browser-window'));
    const menuIdx = new Map();
    menuWins.forEach((w, i) => menuIdx.set(w, i));
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      windows: menuWins.map(serializeWindow),
      browserWindows: browserWins.map(bw =>
        serializeBrowserWindow(bw, menuIdx.has(bw._parentMenuWin) ? menuIdx.get(bw._parentMenuWin) : -1)
      ).filter(Boolean),
    };
  }
  function saveDefaultTemplate() {
    try {
      const data = buildCurrentTemplate();
      const json = JSON.stringify(data);
      if (!lsSet(LS_KEY_TPL, json)) {
        showToast('Could not save: localStorage unavailable');
        return;
      }
      lsSet(LS_KEY_ENABLED, '1');
      const cb = document.getElementById('opt-default-tpl');
      if (cb) cb.checked = true;
      updateDefaultTplStatus();
      showToast('Saved current layout as startup default');
    } catch (e) { showToast('Save failed: ' + e.message); }
  }
  function clearDefaultTemplate() {
    lsDel(LS_KEY_TPL);
    lsDel(LS_KEY_ENABLED);
    const cb = document.getElementById('opt-default-tpl');
    if (cb) cb.checked = false;
    updateDefaultTplStatus();
    showToast('Cleared saved layout');
  }
  function updateDefaultTplStatus() {
    const el = document.getElementById('default-tpl-status');
    if (!el) return;
    const raw = lsGet(LS_KEY_TPL);
    if (!raw) { el.textContent = 'No saved layout. Click Save Current Layout to capture.'; return; }
    try {
      const d = JSON.parse(raw);
      const wn = (d.windows || []).length;
      const bn = (d.browserWindows || []).length;
      const when = d.savedAt ? new Date(d.savedAt).toLocaleString() : 'unknown';
      const sizeKb = (raw.length / 1024).toFixed(1);
      el.textContent = 'Saved ' + when + ' — ' + wn + ' menu(s), ' + bn + ' widget(s), ' + sizeKb + 'kb';
    } catch (_) {
      el.textContent = 'Saved layout (unreadable)';
    }
  }
  // Wire settings UI for the default-template feature.
  (function wireDefaultTplUi() {
    const cb = document.getElementById('opt-default-tpl');
    const saveBtn = document.getElementById('btn-save-default-tpl');
    const clearBtn = document.getElementById('btn-clear-default-tpl');
    if (cb) {
      cb.checked = lsGet(LS_KEY_ENABLED) === '1';
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!lsGet(LS_KEY_TPL)) {
            showToast('No saved layout yet — click Save Current Layout');
            cb.checked = false;
            return;
          }
          lsSet(LS_KEY_ENABLED, '1');
          showToast('Layout will restore on next startup');
        } else {
          lsDel(LS_KEY_ENABLED);
          showToast('Startup restore disabled');
        }
      });
    }
    if (saveBtn) saveBtn.addEventListener('click', saveDefaultTemplate);
    if (clearBtn) clearBtn.addEventListener('click', clearDefaultTemplate);
    updateDefaultTplStatus();
  })();

  /* ---------- Init ---------- */
  syncControlsFromState();
  applyState();
  // On startup, restore the saved default template if enabled — otherwise
  // open the empty Menu window so users see the widget catalog immediately.
  (function bootDesktop() {
    if (lsGet(LS_KEY_ENABLED) === '1') {
      const raw = lsGet(LS_KEY_TPL);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.windows)) {
            applyTemplate(data);
            return;
          }
        } catch (_) {}
      }
    }
    createLinkWindow(0, 0);
  })();
})();
