(async () => {
  if (document.getElementById('shroomlab-ext-host')) return;

  const data = await new Promise(resolve =>
    chrome.storage.local.get(['pendingProduct', 'shroomlab_settings'], resolve)
  );
  if (!data.pendingProduct) return;
  chrome.storage.local.remove('pendingProduct');

  const { imgUrl = '', pageTitle = '', pageUrl = '' } = data.pendingProduct;
  const hasToken = !!data.shroomlab_settings?.token;

  // Zero-size fixed host so the dialog overflows freely without blocking the page
  const host = document.createElement('div');
  host.id = 'shroomlab-ext-host';
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647';
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);

  shadow.innerHTML = `
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    .dialog{
      position:fixed;top:16px;right:16px;width:380px;
      background:#f0f7f4;border-radius:16px;
      box-shadow:0 8px 40px rgba(0,0,0,.3),0 2px 8px rgba(0,0,0,.12);
      font-family:'Segoe UI',Arial,sans-serif;color:#1b4332;
      overflow:hidden;
      animation:su .22s ease;
    }
    @keyframes su{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}

    .hdr{
      background:linear-gradient(135deg,#1b4332,#2d6a4f);
      color:#fff;padding:11px 14px;
      display:flex;align-items:center;justify-content:space-between;
      cursor:grab;
    }
    .hdr:active{cursor:grabbing}
    .hdr-l{display:flex;align-items:center;gap:9px}
    .hdr h2{font-size:.9rem;font-weight:700}
    .src{font-size:.65rem;opacity:.6;margin-top:2px}
    .drag-hint{font-size:.6rem;opacity:.4;white-space:nowrap;user-select:none}
    .x{background:rgba(255,255,255,.15);border:none;color:#fff;
        width:26px;height:26px;border-radius:50%;cursor:pointer;
        font-size:.9rem;display:flex;align-items:center;justify-content:center;
        flex-shrink:0}
    .x:hover{background:rgba(255,255,255,.3)}

    .no-tok{background:#fff3cd;padding:8px 14px;font-size:.75rem;color:#856404;text-align:center}

    .imgw{
      width:100%;height:140px;background:#e8f5e9;
      display:flex;align-items:center;justify-content:center;
      font-size:2.5rem;border-bottom:1px solid #c8e6c9;overflow:hidden;
    }
    .imgw img{width:100%;height:100%;object-fit:contain}

    .form{padding:13px 14px;display:flex;flex-direction:column;gap:10px}
    label{font-size:.65rem;font-weight:700;color:#2d6a4f;
          text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px}
    input,select{
      width:100%;padding:7px 10px;
      border:1.5px solid #c8e6c9;border-radius:7px;
      font-size:.82rem;font-family:inherit;color:#1b4332;
      background:#fff;outline:none;
    }
    input:focus,select:focus{border-color:#40916c}
    .row{display:flex;gap:8px}
    .row>div{flex:1}
    .chk{display:flex;align-items:center;gap:8px;background:#fff;
         padding:8px 10px;border-radius:7px;border:1.5px solid #c8e6c9;
         cursor:pointer;font-size:.82rem;color:#1b4332}
    .chk input{width:15px;height:15px;accent-color:#40916c;margin:0;cursor:pointer;flex-shrink:0}
    .btn{background:linear-gradient(135deg,#40916c,#2d6a4f);color:#fff;
         border:none;border-radius:9px;padding:11px;
         font-size:.88rem;font-weight:700;cursor:pointer;
         width:100%;font-family:inherit;transition:opacity .2s}
    .btn:hover{opacity:.88}
    .btn:disabled{background:#b0bec5;cursor:not-allowed}
    .st{font-size:.78rem;font-weight:600;padding:8px 10px;
        border-radius:7px;text-align:center;display:none}
    .st.loading{background:#e3f2fd;color:#1565c0;display:block}
    .st.success{background:#d1fae5;color:#065f46;display:block}
    .st.error{background:#fee2e2;color:#b91c1c;display:block}
  </style>

  <div class="dialog" id="dlg">
    <div class="hdr" id="hdr">
      <div class="hdr-l">
        <span style="font-size:1.2rem">🍄</span>
        <div>
          <h2>Add to ShroomLab 3D</h2>
          <div class="src" id="src"></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="drag-hint">⠿ drag</span>
        <button class="x" id="cls">✕</button>
      </div>
    </div>

    ${!hasToken ? '<div class="no-tok">⚠️ No GitHub token — click the 🍄 icon to set it first.</div>' : ''}

    <div class="imgw" id="imgw">🖼️</div>

    <div class="form">
      <div>
        <label>Image URL</label>
        <input type="url" id="iurl" placeholder="https://...">
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
      <label class="chk">
        <input type="checkbox" id="isnew" checked>
        Mark as <strong style="margin-left:3px">NEW</strong>
      </label>
      <button class="btn" id="addbtn">➕ Add to Catalogue</button>
      <div class="st" id="st"></div>
    </div>
  </div>`;

  const $ = id => shadow.getElementById(id);

  // ── Drag (grab header, move freely, page stays interactive) ───────
  const dlg = $('dlg');
  let dragging = false, ox = 0, oy = 0;

  $('hdr').addEventListener('mousedown', e => {
    if (e.target === $('cls')) return;
    dragging = true;
    const r = dlg.getBoundingClientRect();
    dlg.style.right = 'auto';
    dlg.style.left  = r.left + 'px';
    dlg.style.top   = r.top  + 'px';
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let l = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - dlg.offsetWidth));
    let t = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - 60));
    dlg.style.left = l + 'px';
    dlg.style.top  = t + 'px';
  });

  document.addEventListener('mouseup', () => { dragging = false; });

  // ── Close ──────────────────────────────────────────────────────────
  $('cls').addEventListener('click', () => host.remove());

  // ── Pre-fill ───────────────────────────────────────────────────────
  try { $('src').textContent = '📌 ' + new URL(pageUrl).hostname.replace('www.', ''); } catch {}
  if (imgUrl)    { $('iurl').value = imgUrl; showPreview(imgUrl); }
  if (pageTitle)   $('ttl').value  = cleanTitle(pageTitle);

  $('iurl').addEventListener('input', () => showPreview($('iurl').value.trim()));

  // ── Load categories ────────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }, cats => {
    const sel = $('cat');
    sel.innerHTML = cats?.length
      ? cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')
      : '<option value="custom">custom</option>';
  });

  // ── Submit ─────────────────────────────────────────────────────────
  $('addbtn').addEventListener('click', () => {
    const url   = $('iurl').value.trim();
    const title = $('ttl').value.trim();
    const cat   = $('cat').value;
    const price = $('price').value || '299';
    const isNew = $('isnew').checked;

    if (!title) { setStatus('error', '❌ Title is required.'); return; }
    if (!url)   { setStatus('error', '❌ Image URL is required.'); return; }

    $('addbtn').disabled = true;
    setStatus('loading', '🚀 Pushing to GitHub…');

    chrome.runtime.sendMessage(
      { type: 'ADD_PRODUCT', product: { title, price, cat, isNew, image: url } },
      res => {
        if (res?.ok) {
          setStatus('success', `✅ "${title}" added! Live in ~1 min.`);
          setTimeout(() => host.remove(), 3000);
        } else {
          setStatus('error', '❌ ' + (res?.error || 'Unknown error'));
          $('addbtn').disabled = false;
        }
      }
    );
  });

  // ── Helpers ────────────────────────────────────────────────────────
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
