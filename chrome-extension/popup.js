document.addEventListener('DOMContentLoaded', () => {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const stateLabel = document.getElementById('stateLabel');
    const statusDesc = document.getElementById('statusDesc');
  
    // Ambil state terkini dari script storage
    chrome.storage.local.get(['fdmEnabled'], (result) => {
      // Default: true (aktif) jika undefined
      const isEnabled = result.fdmEnabled !== false; 
      toggleSwitch.checked = isEnabled;
      updateUI(isEnabled);
      updateBadge(isEnabled);
    });
  
    // Tangkap perubahan toggle
    toggleSwitch.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.local.set({ fdmEnabled: isEnabled }, () => {
        updateUI(isEnabled);
        updateBadge(isEnabled);
      });
    });
  
    function updateUI(isEnabled) {
      if (isEnabled) {
        stateLabel.textContent = "Aktif";
        stateLabel.style.color = "#10b981";
        statusDesc.textContent = "Ekstensi siap menangkap download.";
      } else {
        stateLabel.textContent = "Nonaktif";
        stateLabel.style.color = "#ef4444";
        statusDesc.textContent = "Download akan ditangani oleh sistem Chrome.";
      }
    }

    function updateBadge(isEnabled) {
        // Tampilkan teks 'OFF' merah kecil di ikon jika ekstensi dimatikan
        if (isEnabled) {
            chrome.action.setBadgeText({ text: "" });
        } else {
            chrome.action.setBadgeText({ text: "OFF" });
            chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
        }
    }
  });
