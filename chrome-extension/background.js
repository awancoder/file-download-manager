chrome.downloads.onCreated.addListener((downloadItem) => {
  // Cegah loop jika URL dari localhost atau kita sudah handle
  if (downloadItem.url.startsWith('http://localhost') || downloadItem.url.startsWith('http://127.0.0.1') || downloadItem.state !== 'in_progress') {
    return;
  }

  // Abaikan URL blob: dan data: tidak bisa diunduh di luar browser (misalnya dari Mega.nz)
  if (downloadItem.url.startsWith('blob:') || downloadItem.url.startsWith('data:')) {
    return;
  }

  // Batalkan download bawaan Chrome
  chrome.downloads.cancel(downloadItem.id);

  // Cari informasi file yang dibatalkan
  chrome.downloads.search({ id: downloadItem.id }, (results) => {
    if (results && results.length > 0) {
      const item = results[0];
      
      chrome.cookies.getAll({ url: item.url }, (cookies) => {
        let cookieFilters = cookies ? cookies.map(c => c.name + '=' + c.value).join('; ') : '';
        
        const payload = {
          url: item.url,
          filename: item.filename,
          fileSize: item.fileSize || 0,
          cookie: cookieFilters,
          userAgent: navigator.userAgent,
          referrer: item.referrer || item.url
        };

        fetch('http://127.0.0.1:5050/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
          console.log('Berhasil dikirim ke File Download Manager:', data);
        })
        .catch(err => {
          console.error('Gagal mengirim ke File Download Manager.', err);
        });
      });
    }
  });
});
