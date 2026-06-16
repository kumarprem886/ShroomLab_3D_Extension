async function init() {
  const { shroomlab_settings: s } = await chrome.storage.local.get('shroomlab_settings');

  if (s?.token) {
    // Already configured — show active state
    document.getElementById('ready-msg').style.display = 'block';
    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('btn-reset').style.display = 'block';
  } else {
    // Pre-fill repo if partially saved
    if (s?.repo) document.getElementById('repo').value = s.repo;
  }
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  const repo  = document.getElementById('repo').value.trim() || 'kumarprem886/ShroomLab_3D';

  if (!token) {
    document.getElementById('token').focus();
    return;
  }

  await chrome.storage.local.set({
    shroomlab_settings: { token, repo, branch: 'main' }
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

init();
