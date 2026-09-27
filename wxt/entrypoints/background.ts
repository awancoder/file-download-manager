import { getFdmHost } from '../utils/fdm-host';

const MEDIA_TYPES = [
  'video/',
  'audio/',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/x-msdownload',
  'application/vnd.android.package-archive',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-mpegurl',
  'application/vnd.apple.mpegurl',
  'application/dash+xml'
];

const DOWNLOAD_EXTENSIONS = [
  '.mp4', '.mkv', '.avi', '.mov', '.flv', '.webm', '.m3u8', '.mpd',
  '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
  '.pdf', '.epub', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv',
  '.exe', '.msi', '.apk', '.dmg', '.iso', '.bin'
];

const IGNORED_EXTENSIONS = [
  '.js', '.css', '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.json', '.xml', '.txt',
  '.ts', '.m4s'
];

function getFilenameAndExtension(urlStr: string, contentDisposition?: string, contentType?: string) {
  let filename = '';
  
  if (contentDisposition) {
    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i;
    const matches = filenameRegex.exec(contentDisposition);
    if (matches && matches[1]) {
      filename = matches[1].replace(/['"]/g, '').trim();
      if (filename.startsWith("UTF-8''")) {
        try {
          filename = decodeURIComponent(filename.substring(7));
        } catch (_) {}
      } else {
        try {
          filename = decodeURIComponent(filename);
        } catch (_) {}
      }
    }
  }

  if (!filename) {
    try {
      const url = new URL(urlStr);
      const pathname = url.pathname;
      const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastSegment) {
        filename = decodeURIComponent(lastSegment);
      }
    } catch (_) {}
  }

  if (!filename || filename === '/' || filename.trim() === '') {
    filename = 'detected_media_' + Date.now();
  }

  let ext = '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot !== -1 && lastDot < filename.length - 1) {
    ext = filename.substring(lastDot).toLowerCase();
    const qMark = ext.indexOf('?');
    if (qMark !== -1) {
      ext = ext.substring(0, qMark);
      const fQMark = filename.indexOf('?');
      if (fQMark !== -1) {
        filename = filename.substring(0, fQMark);
      }
    }
  }

  if (!ext && contentType) {
    const mimeMap: { [key: string]: string } = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/x-matroska': '.mkv',
      'video/quicktime': '.mov',
      'video/x-flv': '.flv',
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/aac': '.aac',
      'application/pdf': '.pdf',
      'application/zip': '.zip',
      'application/x-zip-compressed': '.zip',
      'application/x-rar-compressed': '.rar',
      'application/rar': '.rar',
      'application/x-7z-compressed': '.7z',
      'application/x-msdownload': '.exe',
      'application/vnd.android.package-archive': '.apk',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'application/vnd.ms-powerpoint': '.ppt',
      'text/csv': '.csv',
      'application/csv': '.csv',
      'application/x-mpegurl': '.m3u8',
      'application/vnd.apple.mpegurl': '.m3u8',
      'application/dash+xml': '.mpd',
      'video/mp2t': '.ts',
      'video/iso.segment': '.m4s',
    };
    
    for (const [mime, extension] of Object.entries(mimeMap)) {
      if (contentType.toLowerCase().includes(mime)) {
        ext = extension;
        filename += ext;
        break;
      }
    }
    
    if (!ext) {
      if (contentType.startsWith('video/')) {
        ext = '.mp4';
        filename += ext;
      } else if (contentType.startsWith('audio/')) {
        ext = '.mp3';
        filename += ext;
      }
    }
  }

  return { filename, ext };
}

function getNiceContentType(contentType: string, ext: string): string {
  const cLower = contentType.toLowerCase();
  const eLower = ext.toLowerCase();

  if (['.m3u8', '.mpd'].includes(eLower) || cLower.includes('mpegurl') || cLower.includes('dash+xml')) {
    return 'Streaming Playlist';
  }
  if (['.ts', '.m4s'].includes(eLower) || cLower.includes('mp2t') || cLower.includes('iso.segment')) {
    return 'Media Stream Segment';
  }
  if (cLower.startsWith('video/') || ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.ts'].includes(eLower)) {
    return 'Video (' + (eLower ? eLower.substring(1).toUpperCase() : 'Media') + ')';
  }
  if (cLower.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(eLower)) {
    return 'Audio (' + (eLower ? eLower.substring(1).toUpperCase() : 'Media') + ')';
  }
  if (cLower === 'application/pdf' || eLower === '.pdf') {
    return 'PDF Document';
  }
  if (['.xls', '.xlsx'].includes(eLower) || cLower.includes('excel') || cLower.includes('spreadsheet')) {
    return 'Excel Spreadsheet';
  }
  if (['.doc', '.docx'].includes(eLower) || cLower.includes('word') || cLower.includes('msword')) {
    return 'Word Document';
  }
  if (['.ppt', '.pptx'].includes(eLower) || cLower.includes('powerpoint') || cLower.includes('presentation')) {
    return 'PowerPoint Presentation';
  }
  if (eLower === '.csv' || cLower.includes('csv')) {
    return 'CSV Data File';
  }
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(eLower) || cLower.includes('compressed') || cLower.includes('zip') || cLower.includes('rar')) {
    return 'Compressed Archive';
  }
  if (['.exe', '.msi', '.apk', '.dmg', '.iso'].includes(eLower)) {
    return 'Installer / Disk Image';
  }
  return 'Downloadable File';
}

export default defineBackground(() => {
  // 1. Intersepsi download default Chrome
  chrome.downloads.onCreated.addListener(async (downloadItem) => {
    const { fdmEnabled } = await chrome.storage.local.get(['fdmEnabled']);
    const isEnabled = fdmEnabled !== false;

    if (!isEnabled) {
      console.log('Extension is disabled. Downloads will be handled by Chrome.');
      return;
    }

    if (
      downloadItem.url.startsWith('http://localhost') ||
      downloadItem.url.startsWith('http://127.0.0.1') ||
      downloadItem.state !== 'in_progress'
    ) {
      return;
    }

    if (downloadItem.url.startsWith('blob:') || downloadItem.url.startsWith('data:')) {
      return;
    }

    try {
      await fetch(`${FDM_HOST}/api/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      console.log('File Download Manager is offline. Downloads will be handled by Chrome.');
      return;
    }

    chrome.downloads.cancel(downloadItem.id);

    const results = await chrome.downloads.search({ id: downloadItem.id });
    if (!results || results.length === 0) return;
    const item = results[0];

    const cookies = await chrome.cookies.getAll({ url: item.url });
    const cookie = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const payload = {
      url: item.url,
      filename: item.filename,
      fileSize: item.fileSize || 0,
      cookie,
      userAgent: navigator.userAgent,
      referrer: item.referrer || item.url,
    };

    try {
      const host = await getFdmHost();
      const res = await fetch(`${host}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log('Dikirim ke File Download Manager:', data);
    } catch (err) {
      console.error('Gagal mengirim ke FDM:', err);
      chrome.downloads.resume(downloadItem.id);
    }
  });

  // 2. Deteksi media/file dari lalu lintas jaringan secara pasif (seperti IDM)
  chrome.webRequest.onHeadersReceived.addListener(
    async (details) => {
      if (details.url.includes('127.0.0.1:') || details.url.includes('localhost:')) {
        return;
      }

      if (details.tabId === -1) return;

      const { fdmEnabled } = await chrome.storage.local.get(['fdmEnabled']);
      if (fdmEnabled === false) return;

      const headers = details.responseHeaders || [];
      const contentTypeHeader = headers.find(h => h.name.toLowerCase() === 'content-type');
      const contentLengthHeader = headers.find(h => h.name.toLowerCase() === 'content-length');
      const contentDispositionHeader = headers.find(h => h.name.toLowerCase() === 'content-disposition');

      const contentType = contentTypeHeader ? contentTypeHeader.value || '' : '';
      const contentLength = contentLengthHeader ? parseInt(contentLengthHeader.value || '0', 10) : 0;
      const contentDisposition = contentDispositionHeader ? contentDispositionHeader.value || '' : '';

      const url = details.url;
      
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return;
      }

      const { filename, ext } = getFilenameAndExtension(url, contentDisposition, contentType);

      let isDownloadable = false;
      const cLower = contentType.toLowerCase();
      const isMediaResource = details.type === 'media';
      const isMimeMatch = MEDIA_TYPES.some(t => cLower.startsWith(t));
      const isExtMatch = DOWNLOAD_EXTENSIONS.includes(ext);
      const isAttachment = contentDisposition.toLowerCase().includes('attachment');

      if (isMediaResource || isMimeMatch || isExtMatch || isAttachment) {
        isDownloadable = true;
      }

      if (IGNORED_EXTENSIONS.includes(ext)) {
        isDownloadable = false;
      }

      if (!isDownloadable) return;

      let finalFilename = filename;
      const isPlaylist = ['.m3u8', '.mpd'].includes(ext) || cLower.includes('mpegurl') || cLower.includes('dash+xml');
      const isGenericMedia = ['.mp4', '.ts', '.webm', '.mkv'].includes(ext) && 
        (filename.toLowerCase().startsWith('playlist') || 
         filename.toLowerCase().startsWith('index') || 
         filename.toLowerCase().startsWith('stream') || 
         filename.toLowerCase().startsWith('video') || 
         filename.toLowerCase().startsWith('videoplayback'));

      if (isPlaylist || isGenericMedia) {
        try {
          const tab = await chrome.tabs.get(details.tabId);
          if (tab && tab.title) {
            const sanitizedTitle = tab.title.replace(/[\\/:*?"<>|]/g, '_').trim();
            if (sanitizedTitle) {
              finalFilename = sanitizedTitle + ext;
            }
          }
        } catch (err) {
          console.error('Failed to get tab title for media filename:', err);
        }
      }

      const key = `detected_${details.tabId}`;
      const storageData = await chrome.storage.local.get([key]);
      let list = storageData[key] || [];

      const existingIndex = list.findIndex((item: any) => item.url === url);

      const itemData = {
        id: url + '_' + Date.now(),
        url: url,
        filename: finalFilename,
        contentType: getNiceContentType(contentType, ext),
        contentLength: contentLength,
        mimeType: contentType,
        detectedAt: Date.now()
      };

      if (existingIndex !== -1) {
        list[existingIndex] = { ...list[existingIndex], ...itemData, id: list[existingIndex].id };
      } else {
        list.unshift(itemData);
      }

      if (list.length > 30) {
        list = list.slice(0, 30);
      }

      await chrome.storage.local.set({ [key]: list });
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders']
  );

  // 3. Bersihkan data deteksi ketika tab dimuat ulang atau ditutup
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      const key = `detected_${tabId}`;
      await chrome.storage.local.remove([key]);
    }
  });

  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const key = `detected_${tabId}`;
    await chrome.storage.local.remove([key]);
  });
});
