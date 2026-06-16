const DEFAULT_REPO   = 'kumarprem886/ShroomLab_3D';
const DEFAULT_BRANCH = 'main';

// ── Context menu setup ─────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'shroomlab-add',
    title: '🍄 Add to ShroomLab 3D',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'shroomlab-add') return;

  await chrome.storage.local.set({
    pendingProduct: {
      imgUrl:    info.srcUrl  || '',
      pageTitle: tab?.title   || '',
      pageUrl:   tab?.url     || ''
    }
  });

  // Inject dialog into the current page
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

// ── Message handlers from content.js ──────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_CATEGORIES') {
    fetchCategories().then(sendResponse).catch(() => sendResponse([]));
    return true;
  }
  if (msg.type === 'ADD_PRODUCT') {
    addProduct(msg.product).then(() => sendResponse({ ok: true }))
                           .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

// ── Fetch category list from index.html ───────────────────────────────
async function fetchCategories() {
  const s      = await getSettings();
  const repo   = s.repo   || DEFAULT_REPO;
  const branch = s.branch || DEFAULT_BRANCH;
  const res    = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/index.html?t=` + Date.now());
  const text   = await res.text();
  const m      = text.match(/const BADGE = \{([^}]+)\}/);
  if (!m) return [];
  return [...m[1].matchAll(/(\w+):'([^']+)'/g)].map(([, k, v]) => [k, v]);
}

// ── Push new product to products.js ───────────────────────────────────
async function addProduct(p) {
  const s = await getSettings();
  if (!s.token) throw new Error('No GitHub token — click the 🍄 icon to set it up.');

  const repo    = s.repo   || DEFAULT_REPO;
  const branch  = s.branch || DEFAULT_BRANCH;
  const headers = {
    'Authorization': `token ${s.token}`,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json'
  };

  const getRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/products.js?ref=${branch}`,
    { headers }
  );
  if (!getRes.ok) throw new Error((await getRes.json()).message);

  const file    = await getRes.json();
  const bytes   = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  let content   = new TextDecoder().decode(bytes);

  const parts   = [
    `  {"title":${JSON.stringify(p.title)}`,
    `"price":"${p.price}"`,
    `"compare_at":""`,
    `"cat":"${p.cat}"`,
    p.isNew ? `"isNew":true` : null,
    `"image":${JSON.stringify(p.image)}}`
  ].filter(Boolean);
  const entry = parts.join(',"');

  content = content.replace(/\n?\];\s*$/, `,\n${entry}\n];`);

  const pushRes = await fetch(
    `https://api.github.com/repos/${repo}/contents/products.js`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add: ${p.title}`,
        content: toBase64(content),
        sha:     file.sha,
        branch
      })
    }
  );
  if (!pushRes.ok) throw new Error((await pushRes.json()).message);
}

// ── Helpers ────────────────────────────────────────────────────────────
async function getSettings() {
  return new Promise(resolve =>
    chrome.storage.local.get('shroomlab_settings', d => resolve(d.shroomlab_settings || {}))
  );
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192)
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
}
