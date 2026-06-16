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
      imgUrl: info.srcUrl || '',
      pageTitle: tab?.title || '',
      pageUrl: tab?.url || ''
    }
  });

  chrome.windows.create({
    url: chrome.runtime.getURL('product_form.html'),
    type: 'popup',
    width: 440,
    height: 680,
    focused: true
  });
});
