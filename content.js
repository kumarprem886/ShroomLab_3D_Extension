(async () => {
  if (document.getElementById('shroomlab-ext-host')) return;

  const data = await new Promise(resolve =>
    chrome.storage.local.get(['pendingProduct', 'shroomlab_settings'], resolve)
  );
  if (!data.pendingProduct) return;
  chrome.storage.local.remove('pendingProduct');

  const { imgUrl = '', pageTitle = '', pageUrl = '' } = data.pendingProduct;
  const hasToken = !!data.shroomlab_settings?.token;

  const host = document.createElement('div');
  host.id = 'shroomlab-ext-host';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);

  shadow.innerHTML = `
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    .dialog{
      position:fixed;top:12px;right:12px;width:310px;
      background:#f0f7f4;border-radius:14px;
      box-shadow:0 8px 36px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.1);
      font-family:'Segoe UI',Arial,sans-serif;color:#1b4332;
      overflow:hidden;animation:su .2s ease;
    }
    @keyframes su{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}

    .hdr{
      background:linear-gradient(135deg,#1b4332,#2d6a4f);
      color:#fff;padding:8px 11px;
      display:flex;align-items:center;justify-content:space-between;
      cursor:grab;user-select:none;
    }
    .hdr:active{cursor:grabbing}
    .hdr-l{display:flex;align-items:center;gap:7px}
    .hdr h2{font-size:.82rem;font-weight:700}
    .src{font-size:.6rem;opacity:.55;margin-top:1px}
    .drag-hint{font-size:.58rem;opacity:.38;white-space:nowrap}
    .x{background:rgba(255,255,255,.15);border:none;color:#fff;
        width:22px;height:22px;border-radius:50%;cursor:pointer;
        font-size:.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .x:hover{background:rgba(255,255,255,.3)}

    .no-tok{background:#fff3cd;padding:6px 11px;font-size:.7rem;color:#856404;text-align:center}

    .imgw{
      width:100%;height:90px;background:#e8f5e9;
      display:flex;align-items:center;justify-content:center;
      font-size:2rem;border-bottom:1px solid #c8e6c9;overflow:hidden;
    }
    .imgw img{width:100%;height:100%;object-fit:contain}

    .form{padding:9px 11px;display:flex;flex-direction:column;gap:8px}

    label{font-size:.6rem;font-weight:700;color:#2d6a4f;
          text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px}

    input,select{
      width:100%;padding:6px 9px;
      border:1.5px solid #c8e6c9;border-radius:6px;
      font-size:.78rem;font-family:inherit;color:#1b4332;
      background:#fff;outline:none;
    }
    input:focus,select:focus{border-color:#40916c}

    /* images section */
    .chips{display:flex;flex-wrap:wrap;gap:4px;min-height:0;margin-bottom:4px}
    .chip{display:flex;align-items:center;gap:4px;background:#d1fae5;
          border:1px solid #6ee7b7;border-radius:6px;padding:2px 5px 2px 2px;
          font-size:.62rem;color:#065f46}
    .chip-thumb{width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0;
                background:#c8e6c9}
    .chip-x{background:none;border:none;cursor:pointer;color:#065f46;
             font-size:.8rem;padding:0 1px;line-height:1;flex-shrink:0}
    .chip-x:hover{color:#b91c1c}
    .add-img-row{display:flex;gap:5px}
    .add-img-row input{flex:1;min-width:0}
    .icon-btn{padding:6px 8px;border:1.5px solid #c8e6c9;border-radius:6px;
              background:#fff;cursor:pointer;font-size:.8rem;white-space:nowrap;
              color:#1b4332;flex-shrink:0}
    .icon-btn:hover{background:#e8f5e9;border-color:#40916c}
    .pick-active{background:#fff3cd !important;border-color:#f59e0b !important}

    .row{display:flex;gap:7px}
    .row>div{flex:1}

    .chk{display:flex;align-items:center;gap:7px;background:#fff;
         padding:7px 9px;border-radius:6px;border:1.5px solid #c8e6c9;
         cursor:pointer;font-size:.78rem;color:#1b4332}
    .chk input{width:13px;height:13px;accent-color:#40916c;margin:0;cursor:pointer;flex-shrink:0}

    .btn{background:linear-gradient(135deg,#40916c,#2d6a4f);color:#fff;
         border:none;border-radius:8px;padding:9px;
         font-size:.84rem;font-weight:700;cursor:pointer;
         width:100%;font-family:inherit;transition:opacity .2s}
    .btn:hover{opacity:.88}
    .btn:disabled{background:#b0bec5;cursor:not-allowed}

    .st{font-size:.74rem;font-weight:600;padding:6px 9px;
        border-radius:6px;text-align:center;display:none}
    .st.loading{background:#e3f2fd;color:#1565c0;display:block}
    .st.success{background:#d1fae5;color:#065f46;display:block}
    .st.error{background:#fee2e2;color:#b91c1c;display:block}

    /* new category form */
    .new-cat{display:none;flex-direction:column;gap:6px;
             background:#e8f5e9;border:1.5px dashed #40916c;
             border-radius:7px;padding:8px}
    .new-cat.show{display:flex}
    .new-cat-title{font-size:.62rem;font-weight:700;color:#2d6a4f;
                   text-transform:uppercase;letter-spacing:.06em}
    .nc-row{display:flex;gap:6px}
    .nc-row>div{flex:1}
    .color-row{display:flex;gap:5px;align-items:center}
    .color-row input[type=color]{width:30px;height:28px;padding:1px;flex-shrink:0;
      border:1.5px solid #c8e6c9;border-radius:5px;cursor:pointer;background:#fff}
    .color-row input[type=text]{flex:1}
  </style>

  <div class="dialog" id="dlg">
    <div class="hdr" id="hdr">
      <div class="hdr-l">
        <span style="font-size:1.1rem">🍄</span>
        <div>
          <h2>Add to ShroomLab 3D</h2>
          <div class="src" id="src"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="drag-hint">⠿ drag</span>
        <button class="x" id="cls">✕</button>
      </div>
    </div>

    ${!hasToken ? '<div class="no-tok">⚠️ No token — click 🍄 icon to set it.</div>' : ''}

    <div class="imgw" id="imgw">🖼️</div>

    <div class="form">

      <div>
        <label>Images <span id="img-count" style="opacity:.45;font-weight:400;text-transform:none">(0 added)</span></label>
        <div class="chips" id="img-chips"></div>
        <div class="add-img-row">
          <input type="url" id="iurl" placeholder="Paste image URL…">
          <button class="icon-btn" id="iadd" title="Add URL">＋</button>
          <button class="icon-btn" id="ipick" title="Click an image on the page">📸</button>
        </div>
      </div>

      <div>
        <label>Product Title</label>
        <input type="text" id="ttl" placeholder="e.g. Articulated Dragon Keychain">
      </div>

      <div class="row">
        <div>
          <label>Category</label>
          <select id="cat"><option>Loading…</option></select>
        </div>
        <div>
          <label>Price (₹)</label>
          <input type="number" id="price" value="299" min="0">
        </div>
      </div>

      <div class="new-cat" id="ncf">
        <div class="new-cat-title">✨ New Category</div>
        <div class="nc-row">
          <div>
            <label>Key (no spaces)</label>
            <input type="text" id="nck" placeholder="goofyeyes">
          </div>
          <div>
            <label>Display Label</label>
            <input type="text" id="ncl" placeholder="👀 Goofy Eyes">
          </div>
        </div>
        <div>
          <label>Badge Color</label>
          <div class="color-row">
            <input type="color" id="ncc" value="#40916c">
            <input type="text" id="ncct" value="#40916c" placeholder="#rrggbb">
          </div>
        </div>
      </div>

      <label class="chk">
        <input type="checkbox" id="isnew" checked>
        Mark as <strong style="margin-left:2px">NEW</strong>
      </label>
      <button class="btn" id="addbtn">➕ Add to Catalogue</button>
      <div class="st" id="st"></div>
    </div>
  </div>`;

  const $ = id => shadow.getElementById(id);

  // ── Image list state ───────────────────────────────────────────────────
  const images = [];

  function addImg(url) {
    url = url.trim();
    if (!url || images.includes(url)) return;
    images.push(url);
    renderChips();
    if (images.length === 1) showPreview(url);
  }

  function removeImg(idx) {
    images.splice(idx, 1);
    renderChips();
    showPreview(images[0] || '');
  }

  function renderChips() {
    const list = $('img-chips');
    $('img-count').textContent = `(${images.length} added)`;
    if (!images.length) { list.innerHTML = ''; return; }
    list.innerHTML = images.map((url, i) =>
      `<div class="chip"><img class="chip-thumb" src="${url}"><button class="chip-x" data-i="${i}">×</button></div>`
    ).join('');
    list.querySelectorAll('.chip-x').forEach(btn =>
      btn.addEventListener('click', () => removeImg(+btn.dataset.i))
    );
  }

  // Pre-fill from right-click
  if (imgUrl) addImg(imgUrl);

  // Manual add button
  $('iadd').addEventListener('click', () => {
    addImg($('iurl').value);
    $('iurl').value = '';
  });
  $('iurl').addEventListener('keydown', e => {
    if (e.key === 'Enter') { addImg($('iurl').value); $('iurl').value = ''; }
  });

  // ── Pick-from-page mode ────────────────────────────────────────────────
  let pickMode = false, pickHint = null;

  function enterPickMode() {
    pickMode = true;
    host.style.opacity = '0.2';
    host.style.pointerEvents = 'none';
    $('ipick').classList.add('pick-active');

    pickHint = document.createElement('div');
    pickHint.style.cssText =
      'all:initial;position:fixed;top:10px;left:50%;transform:translateX(-50%);' +
      'background:#1b4332;color:#fff;padding:7px 16px;border-radius:20px;' +
      'font-family:sans-serif;font-size:13px;font-weight:600;z-index:2147483646;' +
      'pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.4);white-space:nowrap';
    pickHint.textContent = '🎯 Click any image · ESC to cancel';
    document.body.appendChild(pickHint);

    document.addEventListener('click',   onPickClick, { capture: true });
    document.addEventListener('keydown', onPickEsc);
  }

  function exitPickMode() {
    pickMode = false;
    host.style.opacity = '1';
    host.style.pointerEvents = '';
    $('ipick').classList.remove('pick-active');
    if (pickHint) { pickHint.remove(); pickHint = null; }
    document.removeEventListener('click',   onPickClick, { capture: true });
    document.removeEventListener('keydown', onPickEsc);
  }

  function onPickClick(e) {
    const img = e.composedPath().find(el => el.tagName === 'IMG');
    if (img) {
      const src = img.currentSrc || img.src;
      if (src) addImg(src);
    }
    e.preventDefault();
    e.stopPropagation();
    exitPickMode();
  }

  function onPickEsc(e) { if (e.key === 'Escape') exitPickMode(); }

  $('ipick').addEventListener('click', () => {
    if (pickMode) exitPickMode(); else enterPickMode();
  });

  // ── Drag ───────────────────────────────────────────────────────────────
  const dlg = $('dlg');
  let dragging = false, ox = 0, oy = 0;

  $('hdr').addEventListener('mousedown', e => {
    if (e.target === $('cls')) return;
    dragging = true;
    const r = dlg.getBoundingClientRect();
    dlg.style.right = 'auto';
    dlg.style.left = r.left + 'px';
    dlg.style.top  = r.top  + 'px';
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    dlg.style.left = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - dlg.offsetWidth)) + 'px';
    dlg.style.top  = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - 60)) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  $('cls').addEventListener('click', () => { exitPickMode(); host.remove(); });

  // ── Pre-fill title ─────────────────────────────────────────────────────
  try { $('src').textContent = '📌 ' + new URL(pageUrl).hostname.replace('www.', ''); } catch {}
  if (pageTitle) $('ttl').value = cleanTitle(pageTitle);

  // ── Load categories ────────────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }, cats => {
    const sel = $('cat');
    sel.innerHTML = cats?.length
      ? cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')
      : '<option value="custom">custom</option>';
    sel.innerHTML += '<option value="__new__">＋ New category…</option>';
  });

  $('cat').addEventListener('change', () => {
    $('ncf').classList.toggle('show', $('cat').value === '__new__');
  });

  $('ncc').addEventListener('input',  () => { $('ncct').value = $('ncc').value; });
  $('ncct').addEventListener('input', () => {
    if (/^#[0-9a-f]{6}$/i.test($('ncct').value)) $('ncc').value = $('ncct').value;
  });

  // ── Submit ─────────────────────────────────────────────────────────────
  $('addbtn').addEventListener('click', async () => {
    const title = $('ttl').value.trim();
    const isNew = $('isnew').checked;
    const price = $('price').value || '299';
    let   cat   = $('cat').value;

    if (!title)         { setStatus('error', '❌ Title is required.'); return; }
    if (!images.length) { setStatus('error', '❌ Add at least one image.'); return; }

    if (cat === '__new__') {
      const key   = $('nck').value.trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '');
      const label = $('ncl').value.trim();
      const color = $('ncct').value.trim() || $('ncc').value;
      if (!key)   { setStatus('error', '❌ Category key is required.'); return; }
      if (!label) { setStatus('error', '❌ Category label is required.'); return; }

      $('addbtn').disabled = true;
      setStatus('loading', '🏗️ Creating category…');
      const r = await new Promise(resolve =>
        chrome.runtime.sendMessage({ type: 'CREATE_CATEGORY', category: { key, label, color } }, resolve)
      );
      if (!r?.ok) {
        setStatus('error', '❌ ' + (r?.error || 'Failed to create category'));
        $('addbtn').disabled = false;
        return;
      }
      cat = key;
      setStatus('loading', '🚀 Pushing product…');
    } else {
      $('addbtn').disabled = true;
      setStatus('loading', '🚀 Pushing to GitHub…');
    }

    const product = {
      title, price, cat, isNew,
      ...(images.length === 1 ? { image: images[0] } : { image: images[0], images })
    };

    chrome.runtime.sendMessage({ type: 'ADD_PRODUCT', product }, res => {
      if (res?.ok) {
        setStatus('success', `✅ "${title}" added! Live in ~1 min.`);
        setTimeout(() => host.remove(), 3000);
      } else {
        setStatus('error', '❌ ' + (res?.error || 'Unknown error'));
        $('addbtn').disabled = false;
      }
    });
  });

  // ── Helpers ────────────────────────────────────────────────────────────
  function showPreview(url) {
    const w = $('imgw');
    if (!url) { w.innerHTML = '🖼️'; return; }
    const img = document.createElement('img');
    img.src = url;
    img.onerror = () => { w.innerHTML = '⚠️'; };
    w.innerHTML = '';
    w.appendChild(img);
  }

  function cleanTitle(raw) {
    return raw
      .replace(/\s*[|\-–—]\s*(MakerWorld|Printables|Thingiverse|Thangs|Cults3D|MyMiniFactory|ArtStation|Amazon|Etsy).*$/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .trim();
  }

  function setStatus(type, msg) {
    const el = $('st');
    el.className = 'st ' + type;
    el.textContent = msg;
  }
})();
