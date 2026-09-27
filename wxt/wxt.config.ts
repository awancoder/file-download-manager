import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: '.',
  manifest: {
    name: 'File Download Manager',
    description: 'An extension to intercept downloads and send them to the File Download Manager desktop application.',
    author: 'Awan Digitals',
    permissions: ['downloads', 'cookies', 'declarativeNetRequest', 'storage', 'webRequest', 'tabs'],
    host_permissions: [
      'http://localhost:*/*',
      'http://127.0.0.1:*/*',
      '<all_urls>',
    ],
    icons: {
      16: 'icon.png',
      32: 'icon.png',
      48: 'icon.png',
      128: 'icon.png',
    },
  },
});
