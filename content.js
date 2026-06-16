(async () => {
  // Prevent double injection
  if (document.getElementById('shroomlab-ext-host')) return;

  const { pendingProduct, shroomlab_settings: s } =
    await chrome.storage.local.get(['pendingProduct', 'shroomlab_settings']);

  if (!pendingProduct) return;
  chrome.storage.local.remove('pendingProduct');

  const { imgUrl = '', pageTitle = '', pageUrl = '' } = pendingProduct;
  const hasToken = !!s?.token;

  // Shadow DOM host — isolates styles from the page
  const host = document.createElement('div');
  host.id = 'shroomlab-ext-host';
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);

  shadow.innerHTML = `
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    .overlay{
      position:fixed;inset:0;z-index:2147483647;
      background:rgba(0,0,0,.52);
      display:flex;align-items:center;justify-content:center;
      font-family:'Segoe UI',Arial,sans-serif;
      animation:fi .2s ease;
    }
    @keyframes fi{from{opacity:0}to{opacity:1}}
    .dialog{
      background:#f0f7f4;border-radius:16px;width:400px;
      max-height:92vh;overflow-y:auto;
      box-shadow:0 24px 64px rgba(0,0,0,.4);
      animation:su .22s ease;
    }
    @keyframes su{from{transform:translateY(18px);opacity:0}to{transform:translateY(0);opacity:1}}
    .hdr{
      background:linear-gradient(135deg,#1b4332,#2d6a4f);
      color:#fff;padding:13px 16px;border-radius:16px 16px 0 0;
      display:flex;align-items:center;justify-content:space-between;
    }
    .hdr-l{display:flex;align-items:center;gap:10px}
    .hdr h2{font-size:.95rem;font-weight:700}
    .hdr .src{font-size:.68rem;opacity:.6;margin-top:2px}
    .x{background:rgba(255,255,255,.15);border:none;color:#fff;
       width:28px;height:28px;border-radius:50%;cursor:pointer;
       font-size:1rem;display:flex;align-items:center;justify-content:center}
    .x:hover{background:rgba(255,255,255,.3)}
    .no-tok{background:#fff3cd;padding:9px 14px;font-size:.78rem;
            color:#856404;text-align:center;font-weight:500}
    .imgw{width:100%;height:155px;background:#e8f5e9;
          display:flex;align-items:center;justify-content:center;
          font-size:3rem;border-bottom:1px solid #c8e6c9;overflow:hidden}
    .imgw img{width:100%;height:100%;object-fit:contain}
    .form{padding:14px 16px;display:flex;flex-direction:column;gap:11px}
    label{font-size:.68rem;font-weight:700;color:#2d6a4f;
          text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px}
    input,select{
      width:100%;padding:8px 11px;
      border:1.5px solid #c8e6c9;border-radius:8px;
      font-size:.85rem;font-family:inherit;color:#1b4332;
      background:#fff;outline:none;transition:border-color .2s;
    }
    input:focus,select:focus{border-color:#40916c}
    .row{display:flex;gap:10px}
    .row>div{flex:1}
    .chk{display:flex;align-items:center;gap:8px;background:#fff;
         padding:9px 12px;border-radius:8px;border:1.5px solid #c8e6c9;
         cursor:pointer;font-size:.84rem;color:#1b4332}
    .chk input{width:16px;height:16px;accent-color:#40916c;margin:0;flex-shrink:0}
    .btn{background:linear-gradient(135deg,#40916c,#2d6a4f);color:#fff;
         border:none;border-radius:10px;padding:12px;font-size:.92rem;
         font-weight:700;cursor:pointer;width:100%;font-family:inherit;transition:opacity .2s}
    .btn:hover{opacity:.88}
    .btn:disabled{background:#b0bec5;cursor:not-allowed}
    .st{font-size:.8rem;font-weight:600;padding:9px 12px;border-radius:8px;
        text-align:center;display:none}
    .st.loading{background:#e3f2fd;color:#1565c0;display:block}
    .st.success{background:#d1fae5;color:#065f46;display:block}
    .st.error{background:#fee2e2;color:#b91c1c;display:block}
  </style>

  <div class="overlay" id="ov">
    <div class="dialog">
      <div class="hdr">
        <div class="hdr-l">
          <span style="font-size:1.3rem">🍄</span>
          <div><h2>Add to ShroomLab 3D</h2><div class="src" id="src"></div></div>
        </div>
        <button class="x" id="cls">✕</button>
      </div>

      ${!hasToken ? '<div class="no-tok">⚠️ No GitHub token — click the 🍄 extension icon to set it first.</div>' : ''}

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
    </div>
  </div>`;

  const $ = id => shadow.getElementById(id);

  // Close
  $('cls').addEventListener('click', () => host.remove());
  $('ov').addEventListener('click', e => { if (e.target === $('ov')) host.remove(); });

  // Source label
  try { $('src').textContent = '📌 ' + new URL(pageUrl).hostname.replace('www.', ''); } catch {}

  // Pre-fill image
  if (imgUrl) { $('iurl').value = imgUrl; showPreview(imgUrl); }

  // Pre-fill title
  if (pageTitle) $('ttl').value = cleanTitle(pageTitle);

  // Image URL change
  $('iurl').addEventListener('input', () => showPreview($('iurl').value.trim()));

  // Load categories from background
  chrome.runtime.sendMessage({ type: 'GET_CATEGORIES' }, cats => {
    const sel = $('cat');
    if (cats?.length) {
      sel.innerHTML = cats.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    } else {
      sel.innerHTML = '<option value="custom">custom</option>';
    }
  });

  // Submit
  $('addbtn').addEventListener('click', () => {
    const url   = $('iurl').value.trim();
    const title = $('ttl').value.trim();
    const cat   = $('cat').value;
    const price = $('price').value || '299';
    const isNew = $('isnew').checked;

    if (!title) { status('error', '❌ Title is required.');    return; }
    if (!url)   { status('error', '❌ Image URL is required.'); return; }

    $('addbtn').disabled = true;
    status('loading', '🚀 Pushing to GitHub…');

    chrome.runtime.sendMessage(
      { type: 'ADD_PRODUCT', product: { title, price, cat, isNew, image: url } },
      res => {
        if (res?.ok) {
          status('success', `✅ "${title}" added! Live in ~1 min.`);
          setTimeout(() => host.remove(), 3000);
        } else {
          status('error', '❌ ' + (res?.error || 'Unknown error'));
          $('addbtn').disabled = false;
        }
      }
    );
  });

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

  function status(type, msg) {
    const el = $('st');
    el.className = 'st ' + type;
    el.textContent = msg;
  }
})();
