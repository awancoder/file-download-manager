# File Download Manager ⚡

File Download Manager is a super-lightweight and innovative open-source desktop software, tailored specifically for capturing and downloading massive files in parallel, directly to your PC.

Built with **[Neutralino.js](https://neutralino.js.org/)** for a tiny desktop interface footprint, and powered by a purely native *NodeJS Multi-Thread Engine*, this application can completely saturate your WiFi/Fiber bandwidth limit while maintaining a highly responsive UI.

## 🏗️ Architecture Overview

**File Download Manager** operates as a three-tier system:

1. **Desktop UI** (Neutralino.js) - Lightweight native window running your frontend  
2. **Node.js Backend Server** (Listener Extension) - HTTP API server (`http://127.0.0.1:5050`) managing downloads and multi-threading  
3. **Chrome Extension** - Intercepts Chrome downloads, extracts cookies/headers, and forwards them to the backend

When you start the app, it automatically launches the Node.js server in the background. The Chrome extension communicates with this server on port 5050, allowing seamless download interception.

## ✨ Key Features

- **Chrome Download Interception**: Automatically catches downloads directly from Google Chrome. The extension extracts exact cookies, HTTP headers (`Referer`, `User-Agent`, etc.) to bypass Anti-Scraping and Cloudflare protections.
  
- **16-Thread Parallel Download Engine**: Splits a single download into **16 simultaneous TCP chunks**, saturating your maximum available bandwidth for large files (100 GB+). Falls back gracefully to single-thread mode for servers that don't support chunking.

- **HTTP Range Resume**: Interrupted downloads can be recovered without restarting from zero. Supports proper HTTP Range request handling for resuming failed chunks.

- **Instant Sparse File Pre-Allocation**: On Windows NTFS, allocates massive disk space (100 GB) in milliseconds without blocking the system. Prevents HDD slowdown when starting large downloads.

- **S3 Auto-Bypass Expiration Detection**: Automatically detects Amazon S3 links with short-lived expiration tokens (e.g., `X-Amz-Expires=10`) and force-starts them instantly, bypassing UI confirmation to avoid timeout.

- **Unified Download Table Interface**: Single view combining active and historical downloads. Dynamic drag-to-resize columns that remember your exact width preferences between sessions.

- **Smart Pagination**: Effortlessly handles thousands of download histories by showing 25 items per page. Prevents UI lag and excessive memory usage.

- **Persistent Window State**: Remembers your exact window position, size, and maximized state. Window state is restored when you restart the app.

- **Windows System Tray Integration**: App stays ready in the system tray even when the main window is closed. Minimize to tray without closing the backend service.

- **Quick Download Actions**: Native action buttons to *Open File*, *Open Folder*, or permanently delete download history entries without navigating Windows Explorer.

## 📦 System Requirements

- **Operating System**: Windows 10+ (currently designed for Windows; Linux/Mac support possible via Neutralino)
- **Node.js**: 14.0.0 or higher
- **Browser**: Google Chrome 90+ (for the extension)
- **RAM**: Minimum 256 MB
- **Disk Space**: 100 MB for app + space for downloaded files
- **Internet**: Required for downloading files

For development, also ensure:
- **Neutralino CLI**: Latest version (install globally via npm)
- **npm or yarn**: For managing Node.js dependencies

## 🛠️ Setup & Installation

### Prerequisites Installation

1. **Install Node.js & npm** from https://nodejs.org/ (choose LTS version)

2. **Install Neutralino CLI** globally:
   ```bash
   npm install -g @neutralinojs/neu
   ```

### Project Setup

1. **Clone and enter the project directory**:
   ```bash
   git clone <repository-url>
   cd file-download-manager
   ```

2. **Install Node.js dependencies for the backend listener**:
   ```bash
   cd extensions/listener
   npm install
   cd ../../
   ```

3. **Install the Chrome Extension**:
   - Open Google Chrome and go to `chrome://extensions/`
   - Toggle **Developer mode** ON (top-right corner)
   - Click **Load unpacked**
   - Select the `chrome-extension/` folder from this project
   - The extension will now appear in your extensions list

### Running the Application

1. **Start the desktop app** (opens Neutralino window + Node.js backend):
   ```bash
   neu run
   ```
   This automatically:
   - Launches the Neutralino desktop UI
   - Starts the Node.js server on `http://127.0.0.1:5050`
   - Connects to the Chrome extension

2. **Enable the Chrome extension** (if not already enabled)

3. **Test it**: Try downloading a file from Chrome. It should be intercepted and handled by the File Download Manager instead of Chrome's default downloader

**Note**: The Node.js backend server must be running for the Chrome extension to work. The server exits when you close the Neutralino window or quit the app.

## 🚀 Compiling for Production (*Building EXE*)

Once customized and perfected, build a standalone Desktop Executable (`.exe`):

```bash
neu build
```

Your production-ready application will be compiled into the `/dist/` folder. This generates:
- Single `.exe` file with embedded resources
- All dependencies bundled (Node.js listener, resources)
- Ready for redistribution

**Note**: Users will still need to install the Chrome extension manually by loading the `chrome-extension/` folder through `chrome://extensions/`

## 🔧 Troubleshooting

### Extension not intercepting downloads
- Verify the desktop app is running (check system tray or taskbar for Neutralino window)
- Confirm Node.js server is running on port 5050 (check terminal output for "Server running on port 5050")
- Ensure the Chrome extension is enabled in `chrome://extensions/`
- Check if a firewall or antivirus is blocking localhost:5050

### Downloads fail or never start
- Check that the backend `extensions/listener` npm dependencies are installed correctly
- Verify the Chrome extension has permission to access the download URL's domain
- Check browser console (DevTools) for any error messages
- Try restarting both the Chrome extension and desktop app

### Large files not being chunked
- Some servers don't support HTTP Range requests. The engine automatically falls back to single-thread mode.
- If a server is blocking range requests, consider using a download manager that supports proxies or VPNs

### Performance issues
- Ensure no other bandwidth-intensive applications are running
- Check if your ISP throttles parallel connections (some networks limit per-connection speed)
- Monitor CPU usage - 16 threads should use ~2-4 CPU cores depending on disk speed

## 📖 Development Notes

### How Download Interception Works

1. **Chrome Extension** listens for `chrome.downloads.onCreated` events
2. Immediately **cancels** the Chrome download (before it saves)
3. **Extracts** cookies, User-Agent, Referer, and other headers
4. **Sends HTTP POST** to `http://127.0.0.1:5050/api/download` with all metadata
5. **Backend Server** receives request and delegates to `MultiThreadEngine`
6. **MultiThreadEngine** splits the file into 16 chunks and downloads in parallel
7. **Desktop UI** updates progress in real-time
8. **Download history** is saved to persistent storage

### Modifying the Multi-Thread Engine

Edit `extensions/listener/MultiThreadEngine.js` to:
- Change chunk count (currently 16)
- Add custom retry logic for failed chunks
- Implement custom headers or proxy support

### Adding Custom UI Features

Edit `resources/js/main.js` to add:
- Custom download directory selection
- Speed limiters
- Scheduling for future downloads
- Download categories or tagging

All UI state is automatically persisted to Neutralino storage.

## 🏷️ Versioning

To update the app version across all files at once, run:

```bash
npm run versi -- 26.3.25
```

This will automatically update the version in:
- `package.json`
- `package-lock.json`
- `neutralino.config.json`
- `setup.iss`
- `chrome-extension/manifest.json`

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs via GitHub issues
- Suggest new features or improvements
- Submit pull requests with enhancements
- Improve documentation or translations

## 📜 License

Licensed under the **ISC License** — Free to use, distribute, rebuild, remix, and modify for any purpose. See the [LICENSE](LICENSE) file for full terms.

**Third-party credits:**
- [Neutralino.js](https://neutralino.js.org/) - Lightweight desktop app framework
- [Express.js](https://expressjs.com/) - Node.js HTTP server
- [node-downloader-helper](https://www.npmjs.com/package/node-downloader-helper) - Download utilities

---

**File Download Manager** © 2024. Designed for maximum download speeds with minimum system overhead.
