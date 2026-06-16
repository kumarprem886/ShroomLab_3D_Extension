async function loadSettings() {
  const { shroomlab_settings: s } = await chrome.storage.local.get('shroomlab_settings');
  if (!s) return;
  if (s.token)  document.getElementById('token').value  = s.token;
  if (s.repo)   document.getElementById('repo').value   = s.repo;
  if (s.branch) document.getElementById('branch').value = s.branch;
}

async function saveSettings() {
  const settings = {
    token:  document.getElementById('token').value.trim(),
    repo:   document.getElementById('repo').value.trim() || 'kumarprem886/ShroomLab_3D',
    branch: document.getElementById('branch').value.trim() || 'main'
  };
  await chrome.storage.local.set({ shroomlab_settings: settings });
  const msg = document.getElementById('saved-msg');
  msg.style.display = 'block';
  setTimeout(() => msg.style.display = 'none', 2500);
}

loadSettings();
