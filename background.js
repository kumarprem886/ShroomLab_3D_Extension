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
  if (msg.type === 'PUSH_QUEUE') {
    pushQueue().then(count => sendResponse({ ok: true, count }))
               .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'CREATE_CATEGORY') {
    createCategory(msg.category).then(() => sendResponse({ ok: true }))
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

// ── Create new category in both HTML files ────────────────────────────
async function createCategory({ key, label, color }) {
  const s = await getSettings();
  if (!s.token) throw new Error('No GitHub token — click the 🍄 icon to set it up.');

  const repo    = s.repo   || DEFAULT_REPO;
  const branch  = s.branch || DEFAULT_BRANCH;
  const headers = {
    'Authorization': `token ${s.token}`,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json'
  };

  for (const filename of ['index.html', 'catalogue.html']) {
    const { sha, content: html } = await ghGet(filename, repo, branch, headers);

    // Skip if already registered
    if (html.includes(`${key}:'`) || html.includes(`${key}: '`)) continue;

    let updated = html;

    // 1. Badge CSS — insert before first </style>
    updated = updated.replace(
      /(<\/style>)/,
      `    .badge-${key} { background: ${color}; color: #fff; }\n  $1`
    );

    // 2. Filter button — insert before halloween button
    updated = updated.replace(
      /(<button[^>]+data-cat="halloween"[^>]*>[\s\S]*?<\/button>)/,
      `<button class="filter-btn" data-cat="${key}">${label} <span id="cnt-${key}"></span></button>\n    $1`
    );

    // 3. BADGE entry
    updated = updated.replace(
      /(const BADGE = \{)([^}]+)(\})/,
      `$1$2, ${key}:'${label}'$3`
    );

    // 4. BADGE_CLASS entry
    updated = updated.replace(
      /(const BADGE_CLASS = \{)([^}]+)(\})/,
      `$1$2, ${key}:'badge-${key}'$3`
    );

    await ghPut(filename, updated, sha, `Add category: ${label}`, repo, branch, headers);
  }
}

// ── Push entire queue in one commit ───────────────────────────────────
async function pushQueue() {
  const s = await getSettings();
  if (!s.token) throw new Error('No GitHub token — click the 🍄 icon to set it up.');

  const queue = await new Promise(resolve =>
    chrome.storage.local.get('shroomlab_queue', d => resolve(d.shroomlab_queue || []))
  );
  if (!queue.length) throw new Error('Queue is empty.');

  const repo    = s.repo   || DEFAULT_REPO;
  const branch  = s.branch || DEFAULT_BRANCH;
  const headers = {
    'Authorization': `token ${s.token}`,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json'
  };

  const { sha, content } = await ghGet('products.js', repo, branch, headers);

  const entries = queue.map(p => {
    const imgField = p.images && p.images.length > 1
      ? `,"image":${JSON.stringify(p.images[0])},"images":${JSON.stringify(p.images)}`
      : `,"image":${JSON.stringify(p.image)}`;
    const parts = [
      `  {"title":${JSON.stringify(p.title)}`,
      `"price":"${p.price}"`,
      `"compare_at":""`,
      `"cat":"${p.cat}"`,
      p.isNew ? `"isNew":true` : null
    ].filter(Boolean);
    return parts.join(',') + imgField + '}';
  });

  const updated = content.replace(/\n?\];\s*$/, entries.map(e => `,\n${e}`).join('') + '\n];');
  await ghPut('products.js', updated, sha, `Add ${queue.length} products`, repo, branch, headers);

  await new Promise(resolve => chrome.storage.local.remove('shroomlab_queue', resolve));
  return queue.length;
}

// ── Push new product to products.js (retries on SHA mismatch) ────────
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

  const imgField = p.images && p.images.length > 1
    ? `,"image":${JSON.stringify(p.images[0])},"images":${JSON.stringify(p.images)}`
    : `,"image":${JSON.stringify(p.image)}`;

  const parts = [
    `  {"title":${JSON.stringify(p.title)}`,
    `"price":"${p.price}"`,
    `"compare_at":""`,
    `"cat":"${p.cat}"`,
    p.isNew ? `"isNew":true` : null
  ].filter(Boolean);
  const entry = parts.join(',') + imgField + '}';

  for (let attempt = 0; attempt < 3; attempt++) {
    const { sha, content } = await ghGet('products.js', repo, branch, headers);
    const updated = content.replace(/\n?\];\s*$/, `,\n${entry}\n];`);
    try {
      await ghPut('products.js', updated, sha, `Add: ${p.title}`, repo, branch, headers);
      return;
    } catch (e) {
      if (attempt === 2 || e.status !== 409) throw e;
      // 409 = SHA mismatch — wait for GitHub to propagate, then re-fetch and retry
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

// ── GitHub API helpers ─────────────────────────────────────────────────
async function ghGet(filename, repo, branch, headers) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filename}?ref=${branch}`,
    { headers }
  );
  if (!res.ok) throw new Error((await res.json()).message);
  const file  = await res.json();
  const bytes = Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0));
  return { sha: file.sha, content: new TextDecoder().decode(bytes) };
}

async function ghPut(filename, content, sha, message, repo, branch, headers) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filename}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message, content: toBase64(content), sha, branch })
    }
  );
  if (!res.ok) {
    const body = await res.json();
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
}

// ── Misc helpers ───────────────────────────────────────────────────────
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
