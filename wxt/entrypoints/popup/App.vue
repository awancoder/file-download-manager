<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue';
import iconUrl from '/icon.png';

import { getFdmHost } from '../../utils/fdm-host';

const isEnabled = ref(true);
const currentTab = ref<'status' | 'detected'>('status');
const activeTabId = ref<number | null>(null);
const detectedItems = ref<any[]>([]);
const isFdmOnline = ref(true);
const downloadStatuses = ref<{ [key: string]: 'idle' | 'loading' | 'success' | 'error' }>({});

onMounted(async () => {
  const result = await chrome.storage.local.get(['fdmEnabled']);
  isEnabled.value = result.fdmEnabled !== false;
  updateBadge(isEnabled.value);

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].id !== undefined) {
    activeTabId.value = tabs[0].id;
    
    const key = `detected_${activeTabId.value}`;
    const storageData = await chrome.storage.local.get([key]);
    detectedItems.value = storageData[key] || [];
  }

  checkFdmStatus();

  chrome.storage.onChanged.addListener(handleStorageChange);
});

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChange);
});

function handleStorageChange(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
  if (areaName === 'local' && activeTabId.value) {
    const key = `detected_${activeTabId.value}`;
    if (changes[key]) {
      detectedItems.value = changes[key].newValue || [];
    }
  }
}

watch(isEnabled, async (val) => {
  await chrome.storage.local.set({ fdmEnabled: val });
  updateBadge(val);
});

function updateBadge(enabled: boolean) {
  if (enabled) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  }
}

async function checkFdmStatus() {
  try {
    const host = await getFdmHost();
    const res = await fetch(`${host}/api/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    isFdmOnline.value = res.ok;
  } catch {
    isFdmOnline.value = false;
  }
}

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes) return 'Unknown size';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function sendToFdm(item: any) {
  if (!isFdmOnline.value) {
    await checkFdmStatus();
    if (!isFdmOnline.value) {
      downloadStatuses.value[item.id] = 'error';
      alert('File Download Manager desktop app is offline. Please launch the app first.');
      return;
    }
  }

  downloadStatuses.value[item.id] = 'loading';

  try {
    const cookies = await chrome.cookies.getAll({ url: item.url });
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const payload = {
      url: item.url,
      filename: item.filename,
      fileSize: item.contentLength || 0,
      cookie: cookieString,
      userAgent: navigator.userAgent,
      referrer: item.url,
    };

    const host = await getFdmHost();
    const res = await fetch(`${host}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      downloadStatuses.value[item.id] = 'success';
      setTimeout(() => {
        downloadStatuses.value[item.id] = 'idle';
      }, 3000);
    } else {
      throw new Error('Server error');
    }
  } catch (err) {
    console.error('Failed to send download to FDM:', err);
    downloadStatuses.value[item.id] = 'error';
    setTimeout(() => {
      downloadStatuses.value[item.id] = 'idle';
    }, 4000);
  }
}

function getIconClass(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('video') || ct.includes('streaming') || ct.includes('segment')) return 'video';
  if (ct.includes('audio')) return 'audio';
  if (ct.includes('pdf') || ct.includes('document') || ct.includes('spreadsheet') || ct.includes('presentation') || ct.includes('csv')) return 'document';
  if (ct.includes('archive') || ct.includes('compressed')) return 'archive';
  return 'other';
}
</script>

<template>
  <div class="popup-card">
    <div class="header">
      <div class="header-brand">
        <img :src="iconUrl" alt="icon" class="brand-icon" />
        <h1 class="brand-title">FDM</h1>
      </div>
      <span class="desktop-status" :class="{ online: isFdmOnline }" :title="isFdmOnline ? 'Desktop App Connected' : 'Desktop App Disconnected'">
        <span class="pulse-dot"></span>
        {{ isFdmOnline ? 'Connected' : 'Offline' }}
      </span>
    </div>

    <div class="tab-nav">
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'status' }" 
        @click="currentTab = 'status'"
      >
        Control
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: currentTab === 'detected' }" 
        @click="currentTab = 'detected'"
      >
        Detected
        <span v-if="detectedItems.length > 0" class="badge">{{ detectedItems.length }}</span>
      </button>
    </div>

    <div v-if="currentTab === 'status'" class="tab-content fade-in">
      <div class="toggle-container" :class="{ 'is-active': isEnabled }">
        <div class="status-indicator">
          <span class="indicator-dot" :class="{ 'is-active': isEnabled }"></span>
          <span class="toggle-label" :class="{ active: isEnabled, inactive: !isEnabled }">
            {{ isEnabled ? 'Extension Active' : 'Extension Disabled' }}
          </span>
        </div>
        <label class="switch">
          <input type="checkbox" v-model="isEnabled" />
          <span class="slider"></span>
        </label>
      </div>

      <div class="status-box" :class="{ 'is-active': isEnabled }">
        <svg class="info-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="status-text">
          {{
            isEnabled
              ? 'Extension is ready to intercept downloads automatically.'
              : 'Extension disabled. Downloads will be handled by Chrome.'
          }}
        </div>
      </div>
    </div>

    <div v-else-if="currentTab === 'detected'" class="tab-content fade-in">
      <div v-if="detectedItems.length === 0" class="empty-state">
        <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4m16 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1m16-4H4" />
        </svg>
        <p class="empty-title">No media detected</p>
        <p class="empty-desc">Play a video or audio on the page to detect download links.</p>
      </div>

      <div v-else class="detected-list">
        <div v-for="item in detectedItems" :key="item.id" class="detected-item">
          <div class="item-icon-box" :class="getIconClass(item.contentType)">
            <svg v-if="getIconClass(item.contentType) === 'video'" class="item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else-if="getIconClass(item.contentType) === 'audio'" class="item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <svg v-else-if="getIconClass(item.contentType) === 'document'" class="item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <svg v-else-if="getIconClass(item.contentType) === 'archive'" class="item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <svg v-else class="item-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <div class="item-info">
            <p class="item-filename" :title="item.filename">{{ item.filename }}</p>
            <div class="item-meta">
              <span class="item-type">{{ item.contentType }}</span>
              <span class="item-separator">•</span>
              <span class="item-size">{{ formatBytes(item.contentLength) }}</span>
            </div>
          </div>

          <button 
            class="download-btn" 
            :class="downloadStatuses[item.id] || 'idle'"
            @click="sendToFdm(item)"
            :disabled="downloadStatuses[item.id] === 'loading'"
            title="Download via desktop FDM"
          >
            <svg v-if="!downloadStatuses[item.id] || downloadStatuses[item.id] === 'idle'" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <svg v-else-if="downloadStatuses[item.id] === 'loading'" class="btn-icon spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
            </svg>
            <svg v-else-if="downloadStatuses[item.id] === 'success'" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="downloadStatuses[item.id] === 'error'" class="btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popup-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  width: 22px;
  height: 22px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
}

.brand-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.025em;
}

.desktop-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  background-color: #f1f5f9;
  padding: 4px 8px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.desktop-status.online {
  color: #047857;
  background-color: #ecfdf5;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #94a3b8;
}

.online .pulse-dot {
  background-color: #10b981;
  animation: pulse-mini 2s infinite;
}

@keyframes pulse-mini {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.6;
  }
}

.tab-nav {
  display: flex;
  background-color: #e2e8f0;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.tab-btn {
  flex: 1;
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background-color: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tab-btn .badge {
  background-color: #3b82f6;
  color: #ffffff;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 700;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.toggle-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-container:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.toggle-container.is-active {
  border-color: rgba(16, 185, 129, 0.2);
  background: linear-gradient(to right, #ffffff, #f0fdf4);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #94a3b8;
  position: relative;
  transition: all 0.3s ease;
}

.indicator-dot.is-active {
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.indicator-dot.is-active::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  border: 2px solid #10b981;
  opacity: 0.4;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.5);
    opacity: 0;
  }
}

.toggle-label {
  font-size: 13px;
  font-weight: 600;
  transition: color 0.3s ease;
}

.toggle-label.active {
  color: #047857;
}

.toggle-label.inactive {
  color: #b91c1c;
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: #ffffff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input:checked + .slider {
  background-color: #10b981;
}

input:checked + .slider:before {
  transform: translateX(18px);
}

.status-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.status-box.is-active {
  border-color: rgba(16, 185, 129, 0.15);
  background-color: rgba(240, 253, 244, 0.5);
}

.info-icon {
  width: 14px;
  height: 14px;
  color: #64748b;
  flex-shrink: 0;
  margin-top: 1px;
}

.status-box.is-active .info-icon {
  color: #059669;
}

.status-text {
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
  text-align: left;
}

.status-box.is-active .status-text {
  color: #334155;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 15px;
  text-align: center;
  background: #ffffff;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
}

.empty-icon {
  width: 30px;
  height: 30px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.empty-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 4px 0;
}

.empty-desc {
  font-size: 10px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

.detected-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 2px;
}

.detected-list::-webkit-scrollbar {
  width: 4px;
}
.detected-list::-webkit-scrollbar-track {
  background: transparent;
}
.detected-list::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
.detected-list::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.detected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 6px 8px;
  transition: all 0.2s ease;
}

.detected-item:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.item-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  flex-shrink: 0;
}

.item-icon-box.video {
  background-color: #eff6ff;
  color: #3b82f6;
}

.item-icon-box.audio {
  background-color: #faf5ff;
  color: #a855f7;
}

.item-icon-box.document {
  background-color: #ecfdf5;
  color: #10b981;
}

.item-icon-box.archive {
  background-color: #fffbeb;
  color: #d97706;
}

.item-icon-box.other {
  background-color: #f1f5f9;
  color: #64748b;
}

.item-icon {
  width: 14px;
  height: 14px;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-filename {
  font-size: 11px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9.5px;
  color: #64748b;
}

.item-separator {
  color: #cbd5e1;
}

.download-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.download-btn:hover {
  background-color: #f8fafc;
  color: #0f172a;
  border-color: #94a3b8;
}

.download-btn.loading {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
  color: #94a3b8;
  cursor: not-allowed;
}

.download-btn.success {
  background-color: #ecfdf5;
  border-color: #34d399;
  color: #10b981;
}

.download-btn.error {
  background-color: #fef2f2;
  border-color: #fca5a5;
  color: #ef4444;
}

.btn-icon {
  width: 12px;
  height: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
