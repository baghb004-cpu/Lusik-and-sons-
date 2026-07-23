/* Threadwell Studio — app logic (catalog, flow, monogram/name modes).
   3D lives in js/stage3d.js (module); every call here is guarded so the
   site still fully works in 2D if WebGL/modules are unavailable. */
'use strict';

var DATA = null;
var state = {
  product: null, panel: null,
  account: 'company',                 // 'company' (Tuxedos Online, invoiced) | 'public' (quote request)
  mode: 'name',                       // 'name' | 'mono'
  lang: 'en', style: 'print', text: 'Gohar', translit: 'Gohar',
  mono: { f: 'G', m: 'A', l: 'H' }, monoStyle: 'classic',
  thread: '#1f2f6b', fabric: '#f4f2ec'
};
var THREADS = [['Navy', '#1f2f6b'], ['Black', '#141414'], ['White', '#f4f2ea'], ['Gold', '#b8912e'], ['Burgundy', '#6d1b2e'], ['Silver', '#9aa1ac']];
var FABRICS = [['White', '#f4f2ec'], ['Ivory', '#efe6cf'], ['Black', '#1b1b1e'], ['Navy', '#232c44'], ['Burgundy', '#58222c'], ['Silver', '#c9ccd2']];
var TYPE_LABELS = {
  all: 'All', shirt: 'Shirts', jacket_suit: 'Suits & Tuxedos', vest: 'Vests', cummerbund: 'Cummerbunds', pocket_square: 'Pocket squares', robe: 'Robes',
  household: 'Household', towel_bath: 'Bath towel', towel_hand: 'Hand towel', towel_kitchen: 'Kitchen towel',
  blanket: 'Blanket', pillowcase: 'Pillowcase', napkin: 'Napkin', table_runner: 'Table runner', apron: 'Apron'
};
var PANEL_POS = {
  left_chest: { x: .34, y: .36, w: .22, h: .11 }, left_cuff: { x: .19, y: .74, w: .14, h: .06 }, right_cuff: { x: .81, y: .74, w: .14, h: .06 },
  collar_band: { x: .5, y: .13, w: .16, h: .05 }, back_yoke: { x: .5, y: .22, w: .34, h: .1 },
  interior_lining: { x: .37, y: .42, w: .2, h: .1 }, back_showpiece: { x: .5, y: .44, w: .56, h: .34 },
  back: { x: .5, y: .46, w: .54, h: .32 }, front_left: { x: .36, y: .42, w: .16, h: .09 },
  front_center: { x: .5, y: .5, w: .6, h: .18 }, corner: { x: .3, y: .62, w: .2, h: .12 },
  hem_band: { x: .5, y: .72, w: .6, h: .12 }, center: { x: .5, y: .45, w: .55, h: .26 },
  end_panel: { x: .5, y: .74, w: .5, h: .16 }, chest: { x: .5, y: .34, w: .34, h: .16 }
};
var STAGE_FOR = { left_cuff: 'cuff', right_cuff: 'cuff', collar_band: 'collar', front_center: 'band', corner: 'pocket' };
var STAGE_NAMES = { cuff: 'THE CUFF — live 3D', collar: 'THE COLLAR — live 3D', band: 'CUMMERBUND — live 3D', pocket: 'POCKET SQUARE — live 3D', panel: 'FABRIC PANEL — live 3D' };

/* ---------------- boot ---------------- */
Promise.all([
  fetch('./presets/products.json').then(function (r) { return r.json(); }),
  fetch('./presets/household.json').then(function (r) { return r.json(); })
]).then(function (both) {
  DATA = both[0];
  var hh = both[1];
  Object.keys(hh.garmentTypes).forEach(function (k) { DATA.garmentTypes[k] = hh.garmentTypes[k]; });
  DATA.products = DATA.products.concat(hh.products);
  DATA.counts.household = hh.products.length;
  buildChips(); renderGrid(); renderSwatches();
  // Loadout screens never sit empty: stage the first piece immediately,
  // the way a weapon-select opens already holding a weapon.
  if (!state.product && DATA.products.length) pickProduct(DATA.products[0]);
}).catch(function () { document.getElementById('grid').innerHTML = '<div class="loading">Could not load the catalog.</div>'; });

function signIn(name, account) {
  state.account = account || 'company';
  document.getElementById('who').textContent = (state.account === 'company' ? 'Tuxedos Online · ' : 'Quote · ') + name;
  var hint = document.getElementById('contactHint');
  if (hint) {
    hint.textContent = state.account === 'public'
      ? 'Email required — your quote arrives there before any stitching.'
      : 'Optional — the order is emailed to Lusik & Sons either way.';
  }
}
window.signIn = signIn;

/* ---------------- navigation ---------------- */
var backBtn = document.getElementById('backBtn');
var histStack = ['signin'];
function show(name) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('on', s.dataset.screen === name); });
  backBtn.style.display = (name === 'signin' || name === 'sent') ? 'none' : 'inline-block';
  document.body.classList.toggle('loadout', name === 'studio');
  window.scrollTo(0, 0);
}
function go(name) { if (histStack[histStack.length - 1] !== name) histStack.push(name); show(name); }
backBtn.onclick = function () { if (histStack.length > 1) { histStack.pop(); show(histStack[histStack.length - 1]); } };
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-go]'); if (!t) return;
  go(t.getAttribute('data-go'));
});
window.resetOrder = function () {
  state.product = null; state.panel = null;
  if (DATA && DATA.products.length) pickProduct(DATA.products[0]);
  go('studio');
};

/* ---------------- catalog ---------------- */
var typeFilter = 'all';
function buildChips() {
  var el = document.getElementById('typeChips'); var order = ['all', 'shirt', 'jacket_suit', 'vest', 'cummerbund', 'pocket_square', 'household'];
  el.innerHTML = order.filter(function (k) { return k === 'all' || k === 'household' || DATA.counts.by_type[k]; }).map(function (k) {
    var n = k === 'all' ? (DATA.counts.embroiderable + DATA.counts.household)
      : k === 'household' ? DATA.counts.household : DATA.counts.by_type[k];
    return '<button class="chip' + (k === 'all' ? ' on' : '') + '" data-type="' + k + '">' + TYPE_LABELS[k] + ' (' + n + ')</button>';
  }).join('');
  el.querySelectorAll('.chip').forEach(function (c) {
    c.onclick = function () {
      typeFilter = c.dataset.type;
      el.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('on', x === c); }); renderGrid();
    };
  });
}
document.getElementById('q').addEventListener('input', renderGrid);
function renderGrid() {
  if (!DATA) return;
  var q = document.getElementById('q').value.trim().toLowerCase();
  var list = DATA.products.filter(function (p) {
    if (typeFilter === 'household') { if (p.line !== 'household') return false; }
    else if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (q && p.name.toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  document.getElementById('countNote').textContent = list.length + ' product' + (list.length === 1 ? '' : 's');
  var g = document.getElementById('grid');
  if (!list.length) { g.innerHTML = '<div class="loading">No products match. Try another search.</div>'; return; }
  g.innerHTML = list.slice(0, 300).map(function (p) {
    var visual = p.img ? '<img loading="lazy" referrerpolicy="no-referrer" src="' + p.img + '" alt="" onerror="this.style.display=\'none\'">'
      : '<span class="icon-tile">' + (p.icon || '🧵') + '</span>';
    var tag = p.tag ? '<span class="tag xmas">' + esc(p.tag) + '</span>'
      : p.christening ? '<span class="tag xmas">Christening</span>'
        : '<span class="tag">' + (TYPE_LABELS[p.type] || p.type) + '</span>';
    var sel = state.product === p ? ' sel' : '';
    return '<button class="prod' + sel + '" data-i="' + DATA.products.indexOf(p) + '">' +
      '<span class="ph">' + visual + '</span>' +
      '<span class="cap"><b>' + esc(p.name) + '</b>' + tag + '</span></button>';
  }).join('');
  g.querySelectorAll('.prod').forEach(function (b) { b.onclick = function () { pickProduct(DATA.products[+b.dataset.i]); }; });
}
function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---------------- customize ---------------- */
function fabricFromName(p) {
  var s = p.name.toLowerCase();
  var m = [['white', '#f4f2ec'], ['ivory', '#efe6cf'], ['black', '#1b1b1e'], ['navy', '#232c44'], ['royal', '#1d3a8f'], ['blue', '#232c44'],
  ['burgundy', '#58222c'], ['wine', '#58222c'], ['maroon', '#58222c'], ['red', '#7a1f28'], ['charcoal', '#3a3d44'],
  ['grey', '#8f939b'], ['gray', '#8f939b'], ['silver', '#c9ccd2'], ['gold', '#b8912e'], ['pink', '#c26b8f'], ['fuchsia', '#b04a7e'],
  ['green', '#274b33'], ['purple', '#4b2a5e'], ['brown', '#6b4a33'], ['tan', '#a58a66']];
  for (var i = 0; i < m.length; i++) if (s.indexOf(m[i][0]) >= 0) return m[i][1];
  if (p.line === 'household') return /blanket|napkin|table_runner/.test(p.type) ? '#efe6cf' : '#f4f2ec';
  return p.type === 'jacket_suit' ? '#1b1b1e' : '#f4f2ec';
}
function luminance(hex) {
  var n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
}
function pickProduct(p) {
  state.product = p; state.panel = p.default_panel || DATA.garmentTypes[p.type].panels[0].id;
  state.fabric = fabricFromName(p);
  state.thread = luminance(state.fabric) < .42 ? '#f4f2ea' : '#1f2f6b';
  document.getElementById('cName').textContent = p.name;
  var img = document.getElementById('garmentImg'), pe = document.getElementById('photoEmoji');
  if (p.img) {
    img.style.display = ''; pe.style.display = 'none';
    img.referrerPolicy = 'no-referrer';
    img.src = p.img; img.alt = p.name; img.onload = drawPlacement;
    img.onerror = function () {           // photo host down → emoji tile, dots still work
      img.style.display = 'none'; img.removeAttribute('src');
      pe.style.display = 'flex'; pe.textContent = p.icon || '🧵';
      drawPlacement();
    };
  } else {
    img.style.display = 'none'; img.removeAttribute('src');
    pe.style.display = 'flex'; pe.textContent = p.icon || '🧵';
  }
  markSwatches(); markGridSel();
  updateTranslit(); drawPlacement();
  mount3D(); update3D('slow');
}
function markGridSel() {
  var g = document.getElementById('grid');
  g.querySelectorAll('.prod').forEach(function (b) {
    b.classList.toggle('sel', DATA.products[+b.dataset.i] === state.product);
  });
}
function currentPanel() {
  return DATA.garmentTypes[state.product.type].panels.filter(function (x) { return x.id === state.panel; })[0];
}
function drawPlacement() {
  var p = state.product; if (!p) return;
  var card = document.getElementById('photoCard');
  card.querySelectorAll('.dot,.embzone').forEach(function (n) { n.remove(); });
  var pick = function (pan) {
    return function () { state.panel = pan.id; drawPlacement(); updatePlaceInfo(); update3D('slow'); };
  };
  DATA.garmentTypes[p.type].panels.forEach(function (pan, idx) {
    var pos = PANEL_POS[pan.id] || { x: .5, y: .4, w: .2, h: .1 };
    var dot = document.createElement('button'); dot.className = 'dot' + (pan.id === state.panel ? ' sel' : '');
    dot.style.left = (pos.x * 100) + '%'; dot.style.top = (pos.y * 100) + '%';
    dot.innerHTML = (idx + 1) + '<span class="lbl">' + pan.label + '</span>';
    dot.onclick = pick(pan);
    card.appendChild(dot);
  });
  // The chips in the customize rail are the primary picker; the photo
  // dots stay as the "where on the garment" visual.
  var chips = document.getElementById('placeChips');
  if (chips) {
    chips.innerHTML = '';
    DATA.garmentTypes[p.type].panels.forEach(function (pan) {
      var b = document.createElement('button');
      b.className = 'chip' + (pan.id === state.panel ? ' on' : '');
      b.textContent = pan.label;
      b.onclick = pick(pan);
      chips.appendChild(b);
    });
  }
  updatePlaceInfo(); renderGhost();
}
function updatePlaceInfo() {
  var pan = currentPanel();
  document.getElementById('placeInfo').innerHTML = '📍 <b>' + pan.label + '</b> · about ' + pan.area_mm[0] + '×' + pan.area_mm[1] + ' mm' + (pan.estimated ? ' (estimated)' : '');
}
function displayString() {
  if (state.mode === 'mono') {
    var mm = state.mono;
    if (state.monoStyle === 'straight') return [mm.f, mm.m, mm.l].filter(Boolean).join(' ');
    return [mm.f, mm.l, mm.m].filter(Boolean).join(' ');       // classic order: first LAST middle
  }
  return state.lang === 'hy' ? state.translit : state.text;
}
function renderGhost() {         /* 2D ghost on the product photo */
  var card = document.getElementById('photoCard'); var old = card.querySelector('.embzone'); if (old) old.remove();
  var pan = currentPanel(); var pos = PANEL_POS[pan.id] || { x: .5, y: .4, w: .24, h: .12 };
  var text = displayString(); if (!text) return;
  var script = (state.mode === 'mono' ? state.monoStyle === 'script' : state.style === 'cursive');
  var fam = script ? "'Segoe Script','Snell Roundhand','Brush Script MT',cursive" : "Georgia,'Times New Roman',serif";
  var zone = document.createElement('div'); zone.className = 'embzone';
  zone.style.left = (pos.x * 100) + '%'; zone.style.top = (pos.y * 100) + '%';
  zone.style.width = (pos.w * 100) + '%'; zone.style.height = (pos.h * 100) + '%';
  zone.innerHTML = '<svg viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet">' +
    '<text x="150" y="50" text-anchor="middle" dominant-baseline="central" ' +
    'style="font-family:' + fam + ';font-weight:700;font-size:64px;fill:' + state.thread + ';paint-order:stroke;stroke:rgba(0,0,0,.12);stroke-width:1px" ' +
    'lengthAdjust="spacingAndGlyphs" textLength="' + Math.min(290, Math.max(60, text.length * 34)) + '">' + esc(text) + '</text></svg>';
  card.appendChild(zone);
}

/* ---------------- 3D bridge ---------------- */
var mounted3D = false;
function mount3D() {
  if (mounted3D) return;
  var el = document.getElementById('viewer3d');
  if (window.Stage3D && window.Stage3D.mount(el)) { mounted3D = true; }
  else {
    var tries = 0, iv = setInterval(function () {
      tries++;
      if (window.Stage3D && window.Stage3D.mount(el)) { mounted3D = true; clearInterval(iv); update3D('slow'); }
      else if (tries > 20) { clearInterval(iv); document.getElementById('viewerFallback').style.display = 'flex'; }
    }, 150);
  }
}
function update3D(speed) {
  if (!window.Stage3D || !window.Stage3D.ok() || !state.product) return;
  var pan = currentPanel();
  var stage = STAGE_FOR[pan.id] || 'panel';
  // 'corner' means "pocket-square cloth" only for actual pocket squares;
  // a blanket/towel/napkin corner renders on the sized fabric panel.
  if (pan.id === 'corner' && state.product.type !== 'pocket_square') stage = 'panel';
  document.getElementById('viewerTitle').textContent = STAGE_NAMES[stage];
  var weave;
  if (state.product.line === 'household' && /^(towel|robe)/.test(state.product.type)) weave = 'terry';
  window.Stage3D.update({
    stage: stage, panelMM: pan.area_mm,
    fabric: state.fabric, satin: pan.id === 'interior_lining', weave: weave,
    thread: state.thread,
    mode: state.mode, text: displayString(),
    mono: state.mono, monoStyle: state.monoStyle, style: state.style,
    restitch: speed || 'fast'
  });
}

/* ---------------- controls ---------------- */
document.getElementById('modeSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  state.mode = b.dataset.mode;
  this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
  document.getElementById('nameFields').style.display = state.mode === 'name' ? '' : 'none';
  document.getElementById('monoFields').style.display = state.mode === 'mono' ? '' : 'none';
  renderGhost(); update3D('slow');
});
document.getElementById('langSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  state.lang = b.dataset.lang;
  this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
  updateTranslit(); renderGhost(); update3D();
});
document.getElementById('styleSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  state.style = b.dataset.style;
  this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
  renderGhost(); update3D();
});
document.getElementById('monoStyleSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return;
  state.monoStyle = b.dataset.mstyle;
  this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
  renderGhost(); update3D();
});
document.getElementById('nameInput').addEventListener('input', function () {
  state.text = this.value; updateTranslit(); renderGhost(); update3D();
});
['monoF', 'monoM', 'monoL'].forEach(function (id, i) {
  document.getElementById(id).addEventListener('input', function () {
    state.mono[['f', 'm', 'l'][i]] = this.value.slice(0, 1); renderGhost(); update3D();
  });
});
function renderSwatches() {
  var t = document.getElementById('swatches');
  t.innerHTML = THREADS.map(function (x) { return '<button class="sw" title="' + x[0] + '" data-c="' + x[1] + '" style="background:' + x[1] + '"></button>'; }).join('');
  t.querySelectorAll('.sw').forEach(function (s) {
    s.onclick = function () { state.thread = s.dataset.c; markSwatches(); renderGhost(); update3D(); };
  });
  var f = document.getElementById('fabricSwatches');
  f.innerHTML = FABRICS.map(function (x) { return '<button class="sw" title="' + x[0] + '" data-c="' + x[1] + '" style="background:' + x[1] + '"></button>'; }).join('');
  f.querySelectorAll('.sw').forEach(function (s) {
    s.onclick = function () { state.fabric = s.dataset.c; markSwatches(); update3D('slow'); };
  });
  markSwatches();
}
function markSwatches() {
  document.querySelectorAll('#swatches .sw').forEach(function (s) { s.classList.toggle('on', s.dataset.c === state.thread); });
  document.querySelectorAll('#fabricSwatches .sw').forEach(function (s) { s.classList.toggle('on', s.dataset.c === state.fabric); });
}

/* ---------------- Armenian phonetic transliteration (Eastern, approximate) ---------------- */
var HY2 = [["ch'", 'չ'], ["ts'", 'ց'], ['zh', 'ժ'], ['kh', 'խ'], ['ts', 'ծ'], ['dz', 'ձ'], ['gh', 'ղ'], ['ch', 'ճ'], ['sh', 'շ'], ['ph', 'փ'], ['th', 'թ'], ['ye', 'ե'], ['ou', 'ու'], ['oo', 'ու']];
var HY1 = { a: 'ա', b: 'բ', g: 'գ', d: 'դ', e: 'ե', z: 'զ', i: 'ի', l: 'լ', k: 'կ', h: 'հ', m: 'մ', y: 'յ', n: 'ն', o: 'ո', p: 'պ', j: 'ջ', r: 'ր', s: 'ս', v: 'վ', t: 'տ', u: 'ու', f: 'ֆ', w: 'վ', c: 'ց', x: 'խ', q: 'ք' };
function translitHY(s) {
  var lower = s.toLowerCase(), out = '', i = 0;
  while (i < lower.length) {
    var m = null;
    for (var d = 0; d < HY2.length; d++) { if (lower.substr(i, HY2[d][0].length) === HY2[d][0]) { m = HY2[d]; break; } }
    if (m) { out += m[1]; i += m[0].length; continue; }
    var ch = lower[i];
    if (HY1[ch]) { out += HY1[ch]; } else if (/\s/.test(ch)) { out += ' '; } else if (/[a-z]/.test(ch) === false) { out += ch; }
    i++;
  }
  return out.replace(/(^|\s)(\S)/g, function (_, sp, c) { return sp + c.toLocaleUpperCase('hy'); });
}
window.translitHY = translitHY;
function updateTranslit() {
  var el = document.getElementById('translit');
  if (state.lang === 'hy') {
    state.translit = translitHY(state.text);
    el.innerHTML = 'Armenian: <b>' + esc(state.translit) + '</b> <span style="opacity:.7">(type by sound — "Gohar" → Գոհար)</span>';
  } else { state.translit = state.text; el.textContent = ''; }
}

/* ---------------- send ---------------- */
function colorName(hex, list) {
  for (var i = 0; i < list.length; i++) if (list[i][1] === hex) return list[i][0];
  return hex;
}
function modeLine() {
  return state.mode === 'mono'
    ? 'Monogram (' + state.monoStyle + '): ' + displayString()
    : ({ en: 'English', es: 'Español', hy: 'Armenian' }[state.lang]) + ' · ' + state.style + ': ' + displayString();
}
function setStatus(msg, isErr) {
  var el = document.getElementById('sendStatus');
  el.textContent = msg || '';
  el.className = 'send-status' + (isErr ? ' err' : '');
}

var sending = false;
function submitOrder() {
  if (sending || !state.product) return;
  var text = displayString();
  if (!text) { setStatus('Type the name or initials to stitch first.', true); return; }
  var email = document.getElementById('contactEmail').value.trim();
  if (state.account === 'public' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus('Add your email so the quote can reach you.', true);
    document.getElementById('contactEmail').focus();
    return;
  }
  var btn = document.getElementById('sendBtn');
  sending = true; btn.disabled = true; setStatus('');

  // The .pes is generated locally, best-effort: an old browser still
  // submits the full parameter set and Lusik digitizes manually.
  var pes = null;
  btn.textContent = 'Stitching the file…';
  try {
    if (window.EmbEngine) {
      var pan = currentPanel();
      var script = state.mode === 'mono' ? state.monoStyle === 'script' : state.style === 'cursive';
      var label = text.replace(/[^\x20-\x7e]/g, '').slice(0, 8) || 'LusikSon';
      var r = window.EmbEngine.generate({
        text: text, script: script,
        widthMm: pan.area_mm[0], heightMm: pan.area_mm[1],
        threadHex: state.thread, label: label
      });
      if (r.ok) {
        pes = { base64: r.base64, stitchCount: r.stats.stitchCount, jumps: r.stats.jumps, widthMm: r.stats.widthMm, heightMm: r.stats.heightMm };
      }
    }
  } catch (err) { /* engine is best-effort by design */ }

  btn.textContent = 'Sending…';
  fetch('/.netlify/functions/embroidery-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: state.account,
      contact: {
        name: document.getElementById('contactName').value.trim(),
        email: email,
        phone: document.getElementById('contactPhone').value.trim()
      },
      product: { name: state.product.name },
      panel: { label: currentPanel().label, area_mm: currentPanel().area_mm },
      design: { text: text, modeLine: modeLine() },
      threadHex: state.thread, threadName: colorName(state.thread, THREADS),
      fabricHex: state.fabric, fabricName: colorName(state.fabric, FABRICS),
      pes: pes
    })
  }).then(function (res) {
    return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; });
  }).then(function (r) {
    sending = false; btn.disabled = false; btn.textContent = 'Review & send';
    if (!r.ok) {
      setStatus((r.j && r.j.error) || 'The order couldn\'t be sent. Please try again, or email hello@lusikandsons.com.', true);
      return;
    }
    renderSentSummary(r.j.ref, pes);
    go('sent');
  }).catch(function () {
    sending = false; btn.disabled = false; btn.textContent = 'Review & send';
    setStatus('Network problem — nothing was sent. Try again, or email hello@lusikandsons.com.', true);
  });
}
document.getElementById('sendBtn').addEventListener('click', submitOrder);

function renderSentSummary(ref, pes) {
  var p = state.product, pan = currentPanel();
  var billing, footer;
  if (state.account === 'company') {
    billing = 'Order <b>' + esc(ref) + '</b> · billed to the Tuxedos Online company account';
    footer = 'Design' + (pes ? ' + machine file (.pes)' : '') + ' emailed to Lusik &amp; Sons.';
    document.getElementById('sentTitle').textContent = 'Order sent!';
  } else {
    billing = '<b>Quote request ' + esc(ref) + '</b> — Lusik &amp; Sons will email a price before any stitching';
    footer = 'Request' + (pes ? ' + machine file (.pes)' : '') + ' emailed to Lusik &amp; Sons — the price comes back to your inbox.';
    document.getElementById('sentTitle').textContent = 'Quote request sent!';
  }
  var stitchLine = pes ? 'Stitch file: ' + pes.stitchCount + ' stitches · ' + pes.widthMm + '×' + pes.heightMm + ' mm<br>' : '';
  document.getElementById('orderSummary').innerHTML =
    '<b>' + esc(displayString()) + '</b> on <b>' + esc(p.name) + '</b><br>' +
    'Placement: ' + pan.label + ' · ' + pan.area_mm[0] + '×' + pan.area_mm[1] + ' mm<br>' +
    esc(modeLine()) + '<br>Thread ' + state.thread + ' · Fabric ' + state.fabric + '<br>' +
    stitchLine + billing + '<br>' +
    '<span style="font-size:13px;color:var(--ink-soft)">' + footer + '</span>';
}
