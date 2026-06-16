document.getElementById('btn-manual').addEventListener('click', () => {
  chrome.storage.local.remove('pendingProduct');
  chrome.windows.create({
    url: chrome.runtime.getURL('product_form.html'),
    type: 'popup',
    width: 440,
    height: 680,
    focused: true
  });
  window.close();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  window.close();
});
