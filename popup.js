const DEFAULT_SITE = 'https://kumarprem886.github.io/ShroomLab_3D/';

async function init() {
  const { shroomlab_settings: s, shroomlab_queue: q = [] } =
    await chrome.storage.local.get(['shroomlab_settings', 'shroomlab_queue']);

  document.getElementById('site-url').value = s?.siteUrl || DEFAULT_SITE;

  if (s?.token) {
    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('btn-reset').style.display = 'block';
  } else {
    if (s?.repo) document.getElementById('repo').value = s.repo;
  }

  renderQueue(q);
}

function renderQueue(q) {
  const list  = document.getElementById('queue-list');
  const label = document.getElementById('queue-label');
  const badge = document.getElementById('hdr-badge');
  const btn   = document.getElementById('btn-push');

  badge.textContent = q.length;
  label.textContent = q.length ? `Queue (${q.length})` : 'Queue';
  btn.disabled = q.length === 0;
  btn.textContent = q.length
    ? `🚀 Push ${q.length} product${q.length > 1 ? 's' : ''} to GitHub`
    : '🚀 Push to GitHub';

  if (!q.length) {
    list.innerHTML = '<div class="q-empty">No products queued yet.<br>Right-click images to add.</div>';
    return;
  }

  list.innerHTML = q.map((p, i) => {
    const img = p.image || (p.images && p.images[0]) || '';
    return `
      <div class="q-item">
        ${img ? `<img class="q-item-img" src="${img}">` : '<div class="q-item-img"></div>'}
        <div class="q-item-info">
          <div class="q-item-title">${p.title}</div>
          <div class="q-item-cat">${p.cat} · ₹${p.price}</div>
        </div>
        <button class="btn-clear" data-i="${i}" style="flex-shrink:0">×</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.btn-clear[data-i]').forEach(b =>
    b.addEventListener('click', async () => {
      const { shroomlab_queue: q2 = [] } = await chrome.storage.local.get('shroomlab_queue');
      q2.splice(+b.dataset.i, 1);
      await chrome.storage.local.set({ shroomlab_queue: q2 });
      renderQueue(q2);
    })
  );
}

// ── Save token ────────────────────────────────────────────────────────
document.getElementById('btn-save').addEventListener('click', async () => {
  const token   = document.getElementById('token').value.trim();
  const repo    = document.getElementById('repo').value.trim() || 'kumarprem886/ShroomLab_3D';
  const siteUrl = document.getElementById('site-url').value.trim() || DEFAULT_SITE;
  if (!token) { document.getElementById('token').focus(); return; }

  await chrome.storage.local.set({ shroomlab_settings: { token, repo, branch: 'main', siteUrl } });
  document.getElementById('saved-msg').style.display = 'block';
  setTimeout(() => {
    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('btn-reset').style.display = 'block';
  }, 800);
});

// ── Reset token ───────────────────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', () => {
  document.getElementById('setup-section').style.display = 'block';
  document.getElementById('btn-reset').style.display = 'none';
  document.getElementById('token').value = '';
  document.getElementById('token').focus();
});

// ── Clear queue ───────────────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', async () => {
  await chrome.storage.local.remove('shroomlab_queue');
  renderQueue([]);
});

// ── Push all to GitHub ────────────────────────────────────────────────
document.getElementById('btn-push').addEventListener('click', async () => {
  const btn    = document.getElementById('btn-push');
  const status = document.getElementById('push-status');
  btn.disabled = true;
  status.className = 'push-status loading';
  status.textContent = '🚀 Pushing to GitHub…';

  chrome.runtime.sendMessage({ type: 'PUSH_QUEUE' }, res => {
    if (res?.ok) {
      status.className = 'push-status success';
      status.textContent = `✅ ${res.count} product${res.count > 1 ? 's' : ''} pushed! Live in ~1 min.`;
      renderQueue([]);
    } else {
      status.className = 'push-status error';
      status.textContent = '❌ ' + (res?.error || 'Push failed');
      btn.disabled = false;
    }
  });
});

// ── Site URL ──────────────────────────────────────────────────────────
document.getElementById('site-url').addEventListener('change', async () => {
  const { shroomlab_settings: s } = await chrome.storage.local.get('shroomlab_settings');
  const siteUrl = document.getElementById('site-url').value.trim() || DEFAULT_SITE;
  await chrome.storage.local.set({ shroomlab_settings: { ...(s || {}), siteUrl } });
});

document.getElementById('btn-visit').addEventListener('click', () => {
  const url = document.getElementById('site-url').value.trim() || DEFAULT_SITE;
  chrome.tabs.create({ url });
  window.close();
});

init();
