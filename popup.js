const DEFAULT_SITE = 'https://kumarprem886.github.io/ShroomLab_3D/';

async function init() {
  const { shroomlab_settings: s } = await chrome.storage.local.get('shroomlab_settings');

  // Site URL — always shown, default pre-filled
  document.getElementById('site-url').value = s?.siteUrl || DEFAULT_SITE;

  if (s?.token) {
    document.getElementById('ready-msg').style.display = 'block';
    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('btn-reset').style.display = 'block';
  } else {
    if (s?.repo) document.getElementById('repo').value = s.repo;
  }
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const token   = document.getElementById('token').value.trim();
  const repo    = document.getElementById('repo').value.trim() || 'kumarprem886/ShroomLab_3D';
  const siteUrl = document.getElementById('site-url').value.trim() || DEFAULT_SITE;

  if (!token) { document.getElementById('token').focus(); return; }

  await chrome.storage.local.set({
    shroomlab_settings: { token, repo, branch: 'main', siteUrl }
  });

  document.getElementById('saved-msg').style.display = 'block';
  setTimeout(() => {
    document.getElementById('ready-msg').style.display = 'block';
    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('btn-reset').style.display = 'block';
  }, 800);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  document.getElementById('ready-msg').style.display = 'none';
  document.getElementById('setup-section').style.display = 'block';
  document.getElementById('btn-reset').style.display = 'none';
  document.getElementById('token').value = '';
  document.getElementById('token').focus();
});

// Save site URL whenever it changes
document.getElementById('site-url').addEventListener('change', async () => {
  const { shroomlab_settings: s } = await chrome.storage.local.get('shroomlab_settings');
  const siteUrl = document.getElementById('site-url').value.trim() || DEFAULT_SITE;
  await chrome.storage.local.set({
    shroomlab_settings: { ...(s || {}), siteUrl }
  });
});

// Visit button
document.getElementById('btn-visit').addEventListener('click', () => {
  const url = document.getElementById('site-url').value.trim() || DEFAULT_SITE;
  chrome.tabs.create({ url });
  window.close();
});

init();
