// Generates the self-contained bookmarklet IIFE.
// `origin` is substituted at request time so the script always POSTs to
// the correct localhost port. The output is plain JavaScript — no modules,
// no TypeScript, no dependencies beyond what the script loads at runtime.

export function generateBookmarkletScript(origin: string): string {
  // CDN versions are pinned so behaviour is reproducible.
  const AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'
  const H2C_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'

  // The inner script uses single quotes throughout to avoid conflicts with
  // the TypeScript template literal backtick.
  return /* javascript */ `
(function () {
  'use strict';

  // ── Guard ─────────────────────────────────────────────────────────────────
  // Re-opening the bookmarklet while a panel is already mounted makes the
  // panel visible again instead of appending a duplicate.
  var existing = document.getElementById('__he-root__');
  if (existing) { existing.style.display = ''; return; }

  var SERVER = '${origin}';
  var FETCH_TIMEOUT_MS = 120000; // 2 minutes — large DOM + image payloads are slow

  // ── 1. SHADOW DOM WALKER ──────────────────────────────────────────────────
  // Recursively serialises the live computed DOM, including every shadowRoot.
  // Shadow content is wrapped in <shadow-boundary data-shadow-host="tagname">
  // so the server-side scrubber and Gemini understand the visual hierarchy.

  var VOID_TAGS = new Set([
    'area','base','br','col','embed','hr','img','input',
    'link','meta','param','source','track','wbr',
  ]);

  // Attributes stripped client-side before the DOM leaves the browser.
  // The server-side scrubber applies a second, deeper pass on arrival.
  var STRIP_ATTRS = new Set(['value', 'defaultvalue']);

  function escapeAttr(v) {
    return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function flattenNode(node) {
    if (node.nodeType === 3 /* TEXT_NODE */) return node.textContent || '';
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return '';

    var tag = node.tagName.toLowerCase();

    // Strip inline event handlers and sensitive value attrs
    var attrStr = Array.from(node.attributes || [])
      .filter(function (a) {
        return !a.name.startsWith('on') && !STRIP_ATTRS.has(a.name);
      })
      .map(function (a) { return a.name + '="' + escapeAttr(a.value) + '"'; })
      .join(' ');

    var open = '<' + tag + (attrStr ? ' ' + attrStr : '') + '>';
    if (VOID_TAGS.has(tag)) return open;

    // Recurse light DOM children
    var children = Array.from(node.childNodes).map(flattenNode).join('');

    // Pierce shadow root — inject flattened shadow content after light DOM
    if (node.shadowRoot) {
      var shadowContent = Array.from(node.shadowRoot.childNodes)
        .map(flattenNode)
        .join('');
      children += '<shadow-boundary data-shadow-host="' + tag + '">'
        + shadowContent
        + '</shadow-boundary>';
    }

    return open + children + '</' + tag + '>';
  }

  function captureDOM() {
    return flattenNode(document.documentElement);
  }

  // ── 2. DYNAMIC SCRIPT LOADER ──────────────────────────────────────────────
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      // Idempotent — skip if already present in the page
      if (document.querySelector('script[data-he-src="' + src + '"]')) {
        resolve(undefined);
        return;
      }
      var s = document.createElement('script');
      s.setAttribute('data-he-src', src);
      s.src = src;
      s.onload = function () { resolve(undefined); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  // ── 3. OVERLAY (Shadow DOM isolated) ─────────────────────────────────────
  var host = document.createElement('div');
  host.id = '__he-root__';
  host.style.cssText = [
    'position:fixed', 'top:0', 'right:0',
    'z-index:2147483647', 'font-size:0', 'line-height:0',
  ].join(';');
  document.body.appendChild(host);

  var shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = [
    '<style>',
    '  *{box-sizing:border-box;margin:0;padding:0;}',
    '  #panel{',
    '    width:360px;background:#0f172a;color:#e2e8f0;',
    '    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '    border-radius:0 0 0 16px;box-shadow:-8px 8px 32px rgba(0,0,0,.6);overflow:hidden;',
    '  }',
    '  /* Header */',
    '  #hdr{',
    '    display:flex;align-items:center;justify-content:space-between;',
    '    padding:14px 18px;background:#1e293b;border-bottom:1px solid #334155;',
    '    user-select:none;',
    '  }',
    '  #hdr-left{display:flex;flex-direction:column;gap:2px;}',
    '  #hdr h1{font-size:13px;font-weight:700;color:#f1f5f9;letter-spacing:.02em;}',
    '  #hdr-url{font-size:10px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;}',
    '  #close{',
    '    background:none;border:none;color:#475569;cursor:pointer;',
    '    font-size:22px;line-height:1;padding:4px 6px;border-radius:6px;',
    '  }',
    '  #close:hover{color:#e2e8f0;background:#334155;}',
    '  /* Body */',
    '  #body{padding:18px;display:flex;flex-direction:column;gap:14px;}',
    '  .field{display:flex;flex-direction:column;gap:5px;}',
    '  .lbl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;}',
    '  .hint{font-size:10px;color:#475569;margin-top:2px;}',
    '  select,input[type=text]{',
    '    width:100%;background:#1e293b;border:1px solid #334155;',
    '    color:#e2e8f0;border-radius:8px;padding:9px 11px;font-size:13px;',
    '    outline:none;transition:border-color .15s;',
    '  }',
    '  select:focus,input[type=text]:focus{border-color:#6366f1;}',
    '  #new-flow-row{display:none;margin-top:6px;}',
    '  /* Divider */',
    '  .divider{height:1px;background:#1e293b;margin:0 -18px;}',
    '  /* Redact button */',
    '  #redact-btn{',
    '    width:100%;padding:10px 14px;',
    '    background:transparent;color:#fbbf24;',
    '    border:1px solid #fbbf2444;border-radius:8px;',
    '    font-size:12px;font-weight:600;cursor:pointer;',
    '    display:flex;align-items:center;justify-content:center;gap:6px;',
    '    transition:background .15s;',
    '  }',
    '  #redact-btn:hover{background:#fbbf2411;}',
    '  #redact-btn.active{background:#fbbf24;color:#000;border-color:#fbbf24;}',
    '  #redact-hint{font-size:10px;color:#475569;text-align:center;display:none;}',
    '  #redact-btn.active + #redact-hint{display:block;}',
    '  /* Capture button */',
    '  #capture-btn{',
    '    width:100%;padding:12px;',
    '    background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;',
    '    border:none;border-radius:8px;',
    '    font-size:13px;font-weight:700;cursor:pointer;',
    '    letter-spacing:.01em;transition:opacity .15s;',
    '  }',
    '  #capture-btn:hover:not(:disabled){opacity:.9;}',
    '  #capture-btn:disabled{opacity:.5;cursor:not-allowed;}',
    '  /* Status */',
    '  #status{font-size:11px;color:#64748b;min-height:16px;text-align:center;line-height:1.4;}',
    '  #status.err{color:#f87171;}',
    '  #status.ok{color:#4ade80;}',
    '  /* Results */',
    '  #results{display:none;background:#0d1929;border-radius:8px;padding:12px;margin-top:2px;}',
    '  .row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:6px;}',
    '  .row:last-child{margin-bottom:0;}',
    '  .row .k{color:#64748b;}',
    '  .row .v{font-weight:700;color:#e2e8f0;}',
    '  .v.warn{color:#fbbf24;}',
    '  .v.good{color:#4ade80;}',
    '  .v.crit{color:#f87171;}',
    '</style>',
    '<div id="panel">',
    '  <div id="hdr">',
    '    <div id="hdr-left">',
    '      <h1>HeuristicEvaluator</h1>',
    '      <span id="hdr-url"></span>',
    '    </div>',
    '    <button id="close" title="Close">&#x2715;</button>',
    '  </div>',
    '  <div id="body">',
    '    <div class="field">',
    '      <label class="lbl" for="session-sel">Audit Session</label>',
    '      <select id="session-sel"><option value="">Loading sessions...</option></select>',
    '    </div>',
    '    <div class="field">',
    '      <label class="lbl" for="flow-sel">User Flow</label>',
    '      <select id="flow-sel"><option value="">— select a session first —</option></select>',
    '      <div id="new-flow-row">',
    '        <input type="text" id="new-flow-name" placeholder="Name this flow (e.g. Checkout)" />',
    '      </div>',
    '    </div>',
    '    <div class="field">',
    '      <label class="lbl" for="step-name">Step / Screen Name</label>',
    '      <input type="text" id="step-name" placeholder="e.g. Shipping Address Entry" />',
    '      <span class="hint">What part of the flow is this screen?</span>',
    '    </div>',
    '    <div class="divider"></div>',
    '    <button class="btn-secondary" id="redact-btn">',
    '      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z" fill="currentColor" stroke="none"/></svg>',
    '      Redact Sensitive Content',
    '    </button>',
    '    <span id="redact-hint">Draw rectangles over any sensitive info, then click Capture.</span>',
    '    <button class="btn-primary" id="capture-btn">&#9654;&nbsp; Capture &amp; Analyze</button>',
    '    <div id="status"></div>',
    '    <div id="results"></div>',
    '  </div>',
    '</div>',
  ].join('');

  // Element refs inside shadow root
  function q(id) { return shadow.getElementById(id); }
  var sessionSel  = q('session-sel');
  var flowSel     = q('flow-sel');
  var newFlowRow  = q('new-flow-row');
  var newFlowName = q('new-flow-name');
  var stepNameIn  = q('step-name');
  var captureBtn  = q('capture-btn');
  var redactBtn   = q('redact-btn');
  var statusEl    = q('status');
  var resultsEl   = q('results');

  // Show current page URL in header
  q('hdr-url').textContent = window.location.hostname + window.location.pathname.slice(0, 30);

  function setStatus(msg, type) {
    statusEl.textContent = msg || '';
    statusEl.className = type || '';
  }

  // ── 4. SESSIONS / FLOWS ───────────────────────────────────────────────────
  var sessionsData = []; // [{ id, name, auditProfiles, flows: [{ id, name }] }]

  function loadSessions() {
    setStatus('Loading sessions...');
    fetch(SERVER + '/api/sessions')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sessionsData = data.sessions || [];
        setStatus('');
        renderSessionOptions();
      })
      .catch(function () {
        setStatus('Could not reach server. Is it running?', 'err');
      });
  }

  function renderSessionOptions() {
    sessionSel.innerHTML = sessionsData.length
      ? '<option value="">— select —</option>'
        + sessionsData.map(function (s) {
            return '<option value="' + s.id + '">' + s.name + '</option>';
          }).join('')
      : '<option value="">No sessions found — create one in the app</option>';
  }

  sessionSel.addEventListener('change', function () {
    var session = sessionsData.find(function (s) { return s.id === sessionSel.value; });
    flowSel.innerHTML = '<option value="">— select —</option>';
    newFlowRow.style.display = 'none';
    if (!session) return;
    flowSel.innerHTML += session.flows.map(function (f) {
      return '<option value="' + f.id + '">' + f.name + '</option>';
    }).join('');
    flowSel.innerHTML += '<option value="__new__">+ Create new flow...</option>';
  });

  flowSel.addEventListener('change', function () {
    newFlowRow.style.display = flowSel.value === '__new__' ? 'block' : 'none';
  });

  q('close').addEventListener('click', function () {
    host.style.display = 'none';
    cancelRedaction();
  });

  // ── 5. REDACTION ──────────────────────────────────────────────────────────
  // Strategy: a full-viewport transparent canvas is placed over the page.
  // The user draws rectangles on it. Coordinates are stored and later
  // painted (black fillRect) onto the html2canvas output before encoding.

  var redactRects = [];   // [{x, y, w, h}] in page coordinates
  var redactCanvas = null;
  var redactCtx = null;
  var drawing = false;
  var drawStart = null;

  function startRedaction() {
    redactBtn.classList.add('active');
    redactBtn.textContent = '▦ Done Redacting';

    redactCanvas = document.createElement('canvas');
    redactCanvas.width  = window.innerWidth;
    redactCanvas.height = window.innerHeight;
    redactCanvas.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:100%', 'height:100%',
      'z-index:2147483646',    // one below the panel
      'cursor:crosshair',
    ].join(';');
    document.body.appendChild(redactCanvas);

    redactCtx = redactCanvas.getContext('2d');
    redactCtx.fillStyle = 'rgba(0,0,0,0.0)'; // start transparent

    redactCanvas.addEventListener('mousedown', onMouseDown);
    redactCanvas.addEventListener('mousemove', onMouseMove);
    redactCanvas.addEventListener('mouseup',   onMouseUp);
  }

  function cancelRedaction() {
    if (redactCanvas) {
      redactCanvas.removeEventListener('mousedown', onMouseDown);
      redactCanvas.removeEventListener('mousemove', onMouseMove);
      redactCanvas.removeEventListener('mouseup',   onMouseUp);
      redactCanvas.remove();
      redactCanvas = null;
    }
    redactBtn.classList.remove('active');
    redactBtn.textContent = '▦ Redact Sensitive Content';
    drawing = false;
  }

  function onMouseDown(e) {
    drawing = true;
    drawStart = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e) {
    if (!drawing || !drawStart) return;
    redactCtx.clearRect(0, 0, redactCanvas.width, redactCanvas.height);

    // Redraw all committed rects
    redactCtx.fillStyle = '#000000';
    redactRects.forEach(function (r) {
      redactCtx.fillRect(r.x, r.y, r.w, r.h);
    });

    // Draw current in-progress rect
    redactCtx.fillStyle = 'rgba(0,0,0,0.5)';
    redactCtx.fillRect(
      drawStart.x, drawStart.y,
      e.clientX - drawStart.x,
      e.clientY - drawStart.y,
    );
  }

  function onMouseUp(e) {
    if (!drawing || !drawStart) return;
    drawing = false;
    var rect = {
      x: Math.min(drawStart.x, e.clientX),
      y: Math.min(drawStart.y, e.clientY),
      w: Math.abs(e.clientX - drawStart.x),
      h: Math.abs(e.clientY - drawStart.y),
    };
    if (rect.w > 4 && rect.h > 4) redactRects.push(rect);
    drawStart = null;
  }

  function burnRedactions(canvas) {
    if (redactRects.length === 0) return;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    redactRects.forEach(function (r) {
      ctx.fillRect(r.x + window.scrollX, r.y + window.scrollY, r.w, r.h);
    });
  }

  redactBtn.addEventListener('click', function () {
    if (redactCanvas) {
      cancelRedaction();
    } else {
      startRedaction();
    }
  });

  // ── 6. CAPTURE PIPELINE ───────────────────────────────────────────────────
  captureBtn.addEventListener('click', function () {
    var session = sessionsData.find(function (s) { return s.id === sessionSel.value; });
    if (!session) { setStatus('Select a session first.', 'err'); return; }

    var isNewFlow = flowSel.value === '__new__';
    var flowId    = isNewFlow ? null : flowSel.value;
    var flowName  = isNewFlow
      ? (newFlowName.value.trim() || 'Untitled Flow')
      : (session.flows.find(function (f) { return f.id === flowId; }) || {}).name || '';

    if (!flowId && !isNewFlow) { setStatus('Select a flow first.', 'err'); return; }

    var stepName = stepNameIn.value.trim() || document.title.slice(0, 80);

    // Dismiss redaction canvas before capture so html2canvas sees the real page
    cancelRedaction();
    captureBtn.disabled = true;
    resultsEl.style.display = 'none';
    resultsEl.innerHTML = '';

    runCapture(session, flowId, flowName, stepName);
  });

  async function runCapture(session, flowId, flowName, stepName) {
    try {
      // Step 1: axe-core
      setStatus('Loading scan tools...');
      await loadScript('${AXE_CDN}');

      setStatus('Running accessibility scan...');
      var axeResults = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] },
      });

      // Step 2: html2canvas screenshot
      setStatus('Capturing viewport...');
      await loadScript('${H2C_CDN}');
      // Hide bookmarklet panel so it doesn't appear in the screenshot
      host.style.display = 'none';
      var pageCanvas = await window.html2canvas(document.documentElement, {
        useCORS:      true,
        allowTaint:   false,
        scale:        Math.min(window.devicePixelRatio || 1, 2),
        width:        window.innerWidth,
        height:       window.innerHeight,
        x:            window.scrollX,
        y:            window.scrollY,
        windowWidth:  window.innerWidth,
        windowHeight: window.innerHeight,
        logging:      false,
        imageTimeout: 3000,
      });
      // Restore panel immediately after capture
      host.style.display = '';

      // Burn redaction boxes into the captured canvas
      burnRedactions(pageCanvas);
      var screenshotB64 = pageCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      // Step 3: DOM walker
      setStatus('Walking DOM...');
      var rawHtml = captureDOM();

      // Step 4: POST
      setStatus('Sending to server...');
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, ${String(120000)});

      var payload = {
        sessionId:       session.id,
        sessionName:     session.name,
        flowId:          flowId,
        newFlowName:     flowSel.value === '__new__' ? flowName : null,
        stepName:        stepName,
        url:             window.location.href,
        captureMethod:   'bookmarklet',
        rawHtml:         rawHtml,
        screenshotBase64: screenshotB64,
        axeResults:      { violations: axeResults.violations, passes: axeResults.passes },
        auditProfiles:   session.auditProfiles || ['nng'],
        hasRedactions:   redactRects.length > 0,
      };

      var resp = await fetch(SERVER + '/api/snapshot', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        var err = await resp.json().catch(function () { return {}; });
        throw new Error(err.error || 'Server returned ' + resp.status);
      }

      var data = await resp.json();
      showResults(data);

    } catch (err) {
      var msg = err.name === 'AbortError'
        ? 'Request timed out after 2 minutes.'
        : 'Error: ' + (err.message || 'unknown');
      setStatus(msg, 'err');
    } finally {
      captureBtn.disabled = false;
    }
  }

  function showResults(data) {
    setStatus('Done.', 'ok');
    var f = data.findings || {};
    var ai = f.ai || {};
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = [
      row('Codified issues', f.codified || 0, ''),
      row('AI confirmed',    ai.confirmed  || 0, ''),
      row('AI unverified',   ai.unverified || 0, ai.unverified ? 'warn' : ''),
      row('Total findings',  f.total || 0, f.total > 0 ? 'good' : ''),
      '<div class="row" style="margin-top:6px;">',
      '  <span class="k" style="color:#3b82f6;font-size:10px;">Open workspace to triage &rarr;</span>',
      '</div>',
    ].join('');
  }

  function row(label, value, cls) {
    return '<div class="row"><span class="k">' + label + '</span>'
      + '<span class="v ' + cls + '">' + value + '</span></div>';
  }

  // ── 7. INIT ───────────────────────────────────────────────────────────────
  loadSessions();

})();
`.trim()
}
