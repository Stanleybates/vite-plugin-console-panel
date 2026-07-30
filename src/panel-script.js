/*!
 * MobileDevTools MVP — Console + Network + Elements
 * Injectable mobile devtools panel. Load via bookmarklet or <script> tag.
 * No dependencies. Self-contained.
 */
(function () {
  if (window.__mobileDevToolsLoaded) {
    console.warn('MobileDevTools already loaded');
    return;
  }
  window.__mobileDevToolsLoaded = true;

  // ---------- State ----------
  const state = {
    tab: 'console',
    logs: [],
    requests: [],
    inspecting: false,
    selectedEl: null,
  };
  const MAX_LOGS = 500;
  const MAX_REQUESTS = 300;

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    #mdt-root {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      z-index: 2147483647;
      font-family: -apple-system, Roboto, sans-serif;
      font-size: 12px;
      color: #e6e6e6;
      background: #1e1e1e;
      border-top: 2px solid #444;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
    }
    #mdt-root.mdt-collapsed { height: 34px !important; }
    #mdt-handle {
      height: 34px; flex: 0 0 34px;
      background: #2d2d2d;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 8px;
      cursor: ns-resize; user-select: none; touch-action: none;
      position: relative;
    }
    #mdt-handle .mdt-resize-handle {
      position: absolute; left: 50%; top: 4px; transform: translateX(-50%);
      width: 40px; height: 4px; background: #555; border-radius: 2px;
    }
    #mdt-tabs { display: flex; gap: 4px; margin-left: 4px; }
    #mdt-tabs button {
      background: none; border: none; color: #999;
      padding: 4px 8px; font-size: 11px; font-weight: bold;
      border-radius: 4px;
    }
    #mdt-tabs button.mdt-active { background: #444; color: #4fc3f7; }
    #mdt-handle .mdt-actions { display: flex; gap: 8px; align-items: center; }
    #mdt-handle button.mdt-iconbtn {
      background: none; border: 1px solid #555; color: #ccc;
      border-radius: 4px; padding: 3px 8px; font-size: 11px;
    }
    #mdt-body {
      flex: 1 1 auto; overflow-y: auto; padding: 4px 0;
      -webkit-overflow-scrolling: touch;
    }
    .mdt-row {
      display: flex; padding: 4px 10px; border-bottom: 1px solid #2a2a2a;
      white-space: pre-wrap; word-break: break-word; align-items: flex-start;
    }
    .mdt-row .mdt-badge {
      flex: 0 0 auto; width: 46px; font-weight: bold; font-size: 10px;
      text-transform: uppercase; margin-right: 6px;
    }
    .mdt-row .mdt-msg { flex: 1 1 auto; }
    .mdt-row .mdt-time { flex: 0 0 auto; color: #777; font-size: 10px; margin-left: 6px; }
    .mdt-log .mdt-badge { color: #9e9e9e; }
    .mdt-info .mdt-badge { color: #4fc3f7; }
    .mdt-warn { background: rgba(255,193,7,0.08); }
    .mdt-warn .mdt-badge { color: #ffc107; }
    .mdt-error { background: rgba(244,67,54,0.1); }
    .mdt-error .mdt-badge { color: #f44336; }

    /* Network tab */
    .mdt-net-row { flex-direction: column; }
    .mdt-net-summary { display: flex; width: 100%; gap: 6px; align-items: center; }
    .mdt-net-method { flex: 0 0 auto; width: 42px; font-weight: bold; color: #4fc3f7; }
    .mdt-net-status { flex: 0 0 auto; width: 34px; font-weight: bold; }
    .mdt-net-status.ok { color: #66bb6a; }
    .mdt-net-status.fail { color: #f44336; }
    .mdt-net-status.pending { color: #ffc107; }
    .mdt-net-url { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mdt-net-time { flex: 0 0 auto; color: #777; font-size: 10px; }
    .mdt-net-detail {
      display: none; margin-top: 6px; padding: 6px; background: #161616;
      border-radius: 4px; font-size: 11px;
    }
    .mdt-net-row.mdt-expanded .mdt-net-detail { display: block; }
    .mdt-net-detail div { margin-bottom: 4px; }
    .mdt-net-detail .mdt-label { color: #888; font-weight: bold; }

    /* Elements tab */
    #mdt-inspect-btn.mdt-active { background: #4fc3f7; color: #111; }
    .mdt-el-highlight {
      outline: 2px solid #4fc3f7 !important;
      background: rgba(79,195,247,0.15) !important;
    }
    .mdt-el-info { padding: 8px 10px; }
    .mdt-el-info .mdt-tag { color: #4fc3f7; font-weight: bold; }
    .mdt-el-info .mdt-section { margin-top: 10px; }
    .mdt-el-info .mdt-section-title { color: #888; font-weight: bold; margin-bottom: 4px; }
    .mdt-kv { display: flex; padding: 2px 0; }
    .mdt-kv .mdt-k { flex: 0 0 110px; color: #ce93d8; }
    .mdt-kv .mdt-v { flex: 1 1 auto; word-break: break-all; }
    .mdt-empty { padding: 20px; text-align: center; color: #666; }
  `;
  document.head.appendChild(style);

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.id = 'mdt-root';
  root.style.height = '260px';
  root.innerHTML = `
    <div id="mdt-handle">
      <div class="mdt-resize-handle"></div>
      <div id="mdt-tabs">
        <button data-tab="console" class="mdt-active">Console</button>
        <button data-tab="network">Network</button>
        <button data-tab="elements">Elements</button>
      </div>
      <div class="mdt-actions">
        <button id="mdt-inspect-btn" class="mdt-iconbtn" title="Tap-to-inspect">&#9678;</button>
        <button id="mdt-clear" class="mdt-iconbtn">Clear</button>
        <button id="mdt-toggle" class="mdt-iconbtn">&#8211;</button>
      </div>
    </div>
    <div id="mdt-body"></div>
  `;
  document.documentElement.appendChild(root);

  const bodyEl = root.querySelector('#mdt-body');
  const toggleBtn = root.querySelector('#mdt-toggle');
  const clearBtn = root.querySelector('#mdt-clear');
  const inspectBtn = root.querySelector('#mdt-inspect-btn');
  const handle = root.querySelector('#mdt-handle');
  const tabBtns = root.querySelectorAll('#mdt-tabs button');

  // ---------- Tabs ----------
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle('mdt-active', b === btn));
      render();
    });
  });

  // ---------- Collapse/expand ----------
  let collapsed = false;
  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    root.classList.toggle('mdt-collapsed', collapsed);
    toggleBtn.innerHTML = collapsed ? '&#9633;' : '&#8211;';
  });

  clearBtn.addEventListener('click', () => {
    if (state.tab === 'console') state.logs.length = 0;
    if (state.tab === 'network') state.requests.length = 0;
    render();
  });

  // ---------- Drag to resize ----------
  let dragging = false, startY = 0, startHeight = 0;
  function onDragStart(y) { dragging = true; startY = y; startHeight = root.getBoundingClientRect().height; }
  function onDragMove(y) {
    if (!dragging) return;
    const delta = startY - y;
    let newHeight = Math.max(34, Math.min(window.innerHeight * 0.9, startHeight + delta));
    root.style.height = newHeight + 'px';
    collapsed = newHeight <= 40;
    root.classList.toggle('mdt-collapsed', collapsed);
  }
  function onDragEnd() { dragging = false; }
  handle.addEventListener('touchstart', (e) => { if (e.target === handle || e.target.classList.contains('mdt-resize-handle')) onDragStart(e.touches[0].clientY); }, { passive: true });
  handle.addEventListener('touchmove', (e) => onDragMove(e.touches[0].clientY), { passive: true });
  handle.addEventListener('touchend', onDragEnd);
  handle.addEventListener('mousedown', (e) => {
    if (e.target !== handle && !e.target.classList.contains('mdt-resize-handle')) return;
    onDragStart(e.clientY);
    const mm = (ev) => onDragMove(ev.clientY);
    const mu = () => { onDragEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });

  // ---------- Helpers ----------
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function timeNow() {
    const d = new Date();
    return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }
  function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    };
  }
  function formatArg(arg) {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.stack || (arg.name + ': ' + arg.message);
    try { return JSON.stringify(arg, getCircularReplacer(), 2); } catch (e) { return String(arg); }
  }

  // ---------- Render dispatch ----------
  let renderScheduled = false;
  function render() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      if (state.tab === 'console') renderConsole();
      else if (state.tab === 'network') renderNetwork();
      else if (state.tab === 'elements') renderElements();
    });
  }

  // ---------- Console tab ----------
  function addLog(level, args) {
    const msg = Array.from(args).map(formatArg).join(' ');
    state.logs.push({ level, msg, time: timeNow() });
    if (state.logs.length > MAX_LOGS) state.logs.shift();
    if (state.tab === 'console') render();
  }
  function renderConsole() {
    if (!state.logs.length) {
      bodyEl.innerHTML = '<div class="mdt-empty">No console output yet</div>';
      return;
    }
    const wasAtBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 20;
    bodyEl.innerHTML = state.logs.map(l => `
      <div class="mdt-row mdt-${l.level}">
        <span class="mdt-badge">${l.level}</span>
        <span class="mdt-msg">${escapeHtml(l.msg)}</span>
        <span class="mdt-time">${l.time}</span>
      </div>
    `).join('');
    if (wasAtBottom) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  const originalConsole = {};
  ['log', 'info', 'warn', 'error'].forEach((level) => {
    originalConsole[level] = console[level].bind(console);
    console[level] = function (...args) {
      originalConsole[level](...args);
      addLog(level, args);
    };
  });
  window.addEventListener('error', (e) => {
    addLog('error', [`Uncaught: ${e.message} (${e.filename}:${e.lineno}:${e.colno})`]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    addLog('error', [`Unhandled promise rejection: ${e.reason}`]);
  });

  // ---------- Network tab ----------
  let reqIdCounter = 0;
  function addRequest(entry) {
    entry.id = ++reqIdCounter;
    state.requests.push(entry);
    if (state.requests.length > MAX_REQUESTS) state.requests.shift();
    if (state.tab === 'network') render();
    return entry;
  }
  function updateRequest(entry, patch) {
    Object.assign(entry, patch);
    if (state.tab === 'network') render();
  }

  function renderNetwork() {
    if (!state.requests.length) {
      bodyEl.innerHTML = '<div class="mdt-empty">No network requests captured yet</div>';
      return;
    }
    const wasAtBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 20;
    bodyEl.innerHTML = state.requests.map(r => {
      let statusClass = 'pending';
      if (r.status) statusClass = (r.status >= 200 && r.status < 400) ? 'ok' : 'fail';
      if (r.error) statusClass = 'fail';
      const statusLabel = r.error ? 'ERR' : (r.status || '...');
      return `
        <div class="mdt-row mdt-net-row" data-id="${r.id}">
          <div class="mdt-net-summary">
            <span class="mdt-net-method">${r.method}</span>
            <span class="mdt-net-status ${statusClass}">${statusLabel}</span>
            <span class="mdt-net-url">${escapeHtml(r.url)}</span>
            <span class="mdt-net-time">${r.duration != null ? r.duration + 'ms' : ''}</span>
          </div>
          <div class="mdt-net-detail">
            <div><span class="mdt-label">Type:</span> ${r.type}</div>
            <div><span class="mdt-label">Started:</span> ${r.time}</div>
            ${r.error ? `<div><span class="mdt-label">Error:</span> ${escapeHtml(r.error)}</div>` : ''}
            ${r.responsePreview ? `<div><span class="mdt-label">Response:</span> ${escapeHtml(r.responsePreview)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    bodyEl.querySelectorAll('.mdt-net-row').forEach(rowEl => {
      rowEl.addEventListener('click', () => rowEl.classList.toggle('mdt-expanded'));
    });
    if (wasAtBottom) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function (...args) {
      const [resource, config] = args;
      const url = typeof resource === 'string' ? resource : (resource && resource.url) || '';
      const method = (config && config.method) || (resource && resource.method) || 'GET';
      const start = performance.now();
      const entry = addRequest({ method: method.toUpperCase(), url, type: 'fetch', time: timeNow(), status: null, duration: null });
      return originalFetch.apply(this, args).then((res) => {
        const duration = Math.round(performance.now() - start);
        const clone = res.clone();
        updateRequest(entry, { status: res.status, duration });
        clone.text().then((txt) => {
          updateRequest(entry, { responsePreview: txt.slice(0, 300) });
        }).catch(() => {});
        return res;
      }).catch((err) => {
        const duration = Math.round(performance.now() - start);
        updateRequest(entry, { error: err.message, duration });
        throw err;
      });
    };
  }

  // Intercept XHR
  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OriginalXHR();
    let entry, start;
    const originalOpen = xhr.open;
    xhr.open = function (method, url, ...rest) {
      this.__mdt = { method: (method || 'GET').toUpperCase(), url };
      return originalOpen.call(this, method, url, ...rest);
    };
    const originalSend = xhr.send;
    xhr.send = function (...args) {
      start = performance.now();
      entry = addRequest({ method: this.__mdt.method, url: this.__mdt.url, type: 'xhr', time: timeNow(), status: null, duration: null });
      xhr.addEventListener('loadend', () => {
        const duration = Math.round(performance.now() - start);
        if (xhr.status === 0) {
          updateRequest(entry, { error: 'Network error or blocked', duration });
        } else {
          updateRequest(entry, { status: xhr.status, duration, responsePreview: (xhr.responseText || '').slice(0, 300) });
        }
      });
      return originalSend.apply(this, args);
    };
    return xhr;
  }
  window.XMLHttpRequest = PatchedXHR;

  // ---------- Elements tab ----------
  inspectBtn.addEventListener('click', () => {
    state.inspecting = !state.inspecting;
    inspectBtn.classList.toggle('mdt-active', state.inspecting);
    document.body.style.cursor = state.inspecting ? 'crosshair' : '';
  });

  let lastHovered = null;
  document.addEventListener('pointerover', (e) => {
    if (!state.inspecting) return;
    if (root.contains(e.target)) return;
    if (lastHovered) lastHovered.classList.remove('mdt-el-highlight');
    lastHovered = e.target;
    lastHovered.classList.add('mdt-el-highlight');
  }, true);

  document.addEventListener('click', (e) => {
    if (!state.inspecting) return;
    if (root.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    state.selectedEl = e.target;
    state.inspecting = false;
    inspectBtn.classList.remove('mdt-active');
    document.body.style.cursor = '';
    if (lastHovered) { lastHovered.classList.remove('mdt-el-highlight'); lastHovered = null; }
    state.tab = 'elements';
    tabBtns.forEach((b) => b.classList.toggle('mdt-active', b.dataset.tab === 'elements'));
    render();
  }, true);

  function renderElements() {
    const el = state.selectedEl;
    if (!el) {
      bodyEl.innerHTML = `<div class="mdt-empty">Tap the &#9678; button, then tap any element on the page to inspect it.</div>`;
      return;
    }
    const attrs = Array.from(el.attributes || []).map(a => `<div class="mdt-kv"><span class="mdt-k">${escapeHtml(a.name)}</span><span class="mdt-v">${escapeHtml(a.value)}</span></div>`).join('');
    const cs = window.getComputedStyle(el);
    const keyStyles = ['display', 'position', 'width', 'height', 'margin', 'padding', 'color', 'background-color', 'font-size', 'z-index'];
    const styleRows = keyStyles.map(k => `<div class="mdt-kv"><span class="mdt-k">${k}</span><span class="mdt-v">${escapeHtml(cs.getPropertyValue(k))}</span></div>`).join('');
    const rect = el.getBoundingClientRect();

    bodyEl.innerHTML = `
      <div class="mdt-el-info">
        <div><span class="mdt-tag">&lt;${el.tagName.toLowerCase()}&gt;</span> ${el.id ? '#' + escapeHtml(el.id) : ''} ${el.className && typeof el.className === 'string' ? '.' + escapeHtml(el.className.split(' ').join('.')) : ''}</div>

        <div class="mdt-section">
          <div class="mdt-section-title">Box</div>
          <div class="mdt-kv"><span class="mdt-k">size</span><span class="mdt-v">${Math.round(rect.width)} x ${Math.round(rect.height)}</span></div>
          <div class="mdt-kv"><span class="mdt-k">position</span><span class="mdt-v">top ${Math.round(rect.top)}, left ${Math.round(rect.left)}</span></div>
        </div>

        <div class="mdt-section">
          <div class="mdt-section-title">Attributes</div>
          ${attrs || '<div class="mdt-empty" style="padding:4px 0;">none</div>'}
        </div>

        <div class="mdt-section">
          <div class="mdt-section-title">Computed styles</div>
          ${styleRows}
        </div>
      </div>
    `;
  }

  // ---------- Init ----------
  addLog('info', ['MobileDevTools attached — Console / Network / Elements']);
  render();
})();
