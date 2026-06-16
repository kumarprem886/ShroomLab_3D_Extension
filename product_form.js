const DEFAULT_REPO   = 'kumarprem886/ShroomLab_3D';
const DEFAULT_BRANCH = 'main';

async function getSettings() {
  return new Promise(resolve =>
    chrome.storage.local.get('shroomlab_settings', d => resolve(d.shroomlab_settings || {}))
  );
}

function setStatus(type, msg) {
  const el = document.getElementById('status');
  el.className = 'status' + (type ? ' ' + type : '');
  el.textContent = msg;
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function updatePreview() {
  const url = document.getElementById('img-url').value.trim();
  const img = document.getElementById('img-preview');
  const ph  = document.getElementById('img-placeholder');
  if (url) {
    img.src = url;
    img.style.display = 'block';
    ph.style.display  = 'none';
    img.onerror = () => {
      img.style.display = 'none';
      ph.style.display  = 'flex';
      ph.textContent    = '⚠️';
    };
  } else {
    img.style.display = 'none';
    ph.style.display  = 'flex';
    ph.textContent    = '🖼️';
  }
}

async function loadCategories(settings) {
  const repo   = settings.repo   || DEFAULT_REPO;
  const branch = settings.branch || DEFAULT_BRANCH;
  try {
    const res  = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/index.html?t=` + Date.now());
    const text = await res.text();
    const m    = text.match(/const BADGE = \{([^}]+)\}/);
    const sel  = document.getElementById('category');
    if (m) {
      const entries = [...m[1].matchAll(/(\w+):'([^']+)'/g)];
      sel.innerHTML = entries.map(([, key, label]) =>
        `<option value="${key}">${label}</option>`
      ).join('');
    } else {
      // fallback: unique cats from products.js
      const pr   = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/products.js?t=` + Date.now());
      const pt   = await pr.text();
      const cats = [...new Set([...pt.matchAll(/"cat":"([^"]+)"/g)].map(m => m[1]))].sort();
      sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  } catch {
    document.getElementById('category').innerHTML = '<option value="custom">custom</option>';
  }
}

function cleanTitle(raw) {
  return raw
    .replace(/\s*[|\-–—]\s*(MakerWorld|Printables|Thingiverse|Thangs|Cults3D|MyMiniFactory|ArtStation|Amazon|Etsy|Shopify).*$/i, '')
    .replace(/\s*\|\s*.*$/, '')
    .trim();
}

async function addProduct() {
  const settings = await getSettings();
  if (!settings.token) {
    setStatus('error', '❌ No GitHub token — open Settings first.');
    return;
  }

  const imgUrl = document.getElementById('img-url').value.trim();
  const title  = document.getElementById('title').value.trim();
  const cat    = document.getElementById('category').value;
  const price  = document.getElementById('price').value || '299';
  const isNew  = document.getElementById('is-new').checked;

  if (!title)  { setStatus('error', '❌ Title is required.');    return; }
  if (!imgUrl) { setStatus('error', '❌ Image URL is required.'); return; }
  if (!cat)    { setStatus('error', '❌ Pick a category.');       return; }

  const btn = document.getElementById('btn-add');
  btn.disabled = true;

  const repo    = settings.repo   || DEFAULT_REPO;
  const branch  = settings.branch || DEFAULT_BRANCH;
  const headers = {
    'Authorization': `token ${settings.token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  try {
    setStatus('loading', '📥 Fetching products.js…');
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/products.js?ref=${branch}`,
      { headers }
    );
    if (!getRes.ok) {
      const err = await getRes.json();
      throw new Error(err.message || 'GitHub fetch failed');
    }
    const fileData = await getRes.json();
    const bytes    = Uint8Array.from(atob(fileData.content.replace(/\n/g, '')), c => c.charCodeAt(0));
    let content    = new TextDecoder().decode(bytes);

    // Build product entry
    const entry = [
      `  {"title":${JSON.stringify(title)}`,
      `"price":"${price}"`,
      `"compare_at":""`,
      `"cat":"${cat}"`,
      isNew ? `"isNew":true` : null,
      `"image":${JSON.stringify(imgUrl)}}`
    ].filter(Boolean).join(',"');

    // Append before closing ];
    content = content.replace(/(\n?\];?\s*)$/, `,\n${entry}\n];`);

    setStatus('loading', '🚀 Pushing to GitHub…');
    const pushRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/products.js`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Add product: ${title}`,
          content: toBase64(content),
          sha:     fileData.sha,
          branch
        })
      }
    );
    if (!pushRes.ok) {
      const err = await pushRes.json();
      throw new Error(err.message || 'Push failed');
    }

    setStatus('success', `✅ "${title}" added! Live in ~1 minute.`);

    // Reset for next product
    setTimeout(() => {
      document.getElementById('title').value   = '';
      document.getElementById('img-url').value = '';
      updatePreview();
      setStatus('', '');
    }, 3500);

  } catch (e) {
    setStatus('error', '❌ ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

async function init() {
  const settings = await getSettings();

  // Token check
  if (!settings.token) {
    document.getElementById('no-token-bar').style.display = 'block';
  }

  // Load categories
  loadCategories(settings);

  // Wire up events
  document.getElementById('img-url').addEventListener('input', updatePreview);
  document.getElementById('btn-add').addEventListener('click', addProduct);
  document.getElementById('go-settings')?.addEventListener('click', e => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  });

  // Load pending product from right-click context menu
  chrome.storage.local.get('pendingProduct', ({ pendingProduct }) => {
    if (!pendingProduct) return;
    chrome.storage.local.remove('pendingProduct');

    if (pendingProduct.imgUrl) {
      document.getElementById('img-url').value = pendingProduct.imgUrl;
      updatePreview();
    }

    if (pendingProduct.pageTitle) {
      document.getElementById('title').value = cleanTitle(pendingProduct.pageTitle);
    }

    if (pendingProduct.pageUrl) {
      try {
        const host = new URL(pendingProduct.pageUrl).hostname.replace('www.', '');
        document.getElementById('page-src').textContent = '📌 from ' + host;
      } catch {}
    }
  });
}

init();
