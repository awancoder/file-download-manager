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

- **Chrome/Firefox Download Interception**: Automatically catches downloads directly from Google Chrome and Mozilla Firefox. The extension extracts exact cookies, HTTP headers (`Referer`, `User-Agent`, etc.) to bypass Anti-Scraping and Cloudflare protections.

- **HLS Downloader (.m3u8 Support)**: Detects and downloads complete HTTP Live Streaming (HLS) `.m3u8` video streams. The downloader automatically parses the manifest, fetches all `.ts` segments in parallel, and merges them sequentially.

- **Auto MP4 Output**: Seamlessly saves stitched HLS video streams directly into a `.mp4` container, allowing immediate playback on standard media players without any extra transcoding.

- **Tab Title-based Renaming**: Automatically detects and replaces generic media filenames (like `playlist.m3u8` or `videoplayback.mp4`) with the sanitized title of the active browser tab.

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

3. **Build and package the Browser Extensions** (WXT + Vue 3):
   - WXT compiles Chrome and Firefox extensions, generating ready-to-load directories and zip packages automatically:
   ```bash
   cd wxt
   bun install
   bun run build
   bun run build:firefox
   bun run zip
   bun run zip:firefox
   cd ..
   ```
   - **Google Chrome**:
     - Open Chrome and navigate to `chrome://extensions/`
     - Enable **Developer mode** (top-right toggle)
     - Click **Load unpacked** and select the `wxt/.output/chrome-mv3/` folder (or drag and drop the `.zip` file from `wxt/.output/` if using a packed version)
   - **Mozilla Firefox**:
     - Open Firefox and navigate to `about:debugging`
     - Click **This Firefox** -> **Load Temporary Add-on...**
     - Select the `.zip` file from `wxt/.output/file-download-manager-extension-<version>-firefox.zip`

   For development with hot reload, run `bun run dev` inside `wxt/` — WXT will auto-open Chrome with the extension loaded.

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

## 🚀 Compiling for Production (*Building Installer*)

Once customized and perfected, compile the standalone Desktop Executable (`.exe`) and package it into a Windows Setup installer:

```bash
npm run build
```

This build script automatically:
1. Disables the developer console/inspector.
2. Builds and zips the browser extensions for both Chrome and Firefox into `wxt/.output/`.
3. Runs `neu build` to compile the Neutralino application binaries.
4. Generates a Windows Setup installer (`.exe`) using Inno Setup (ISCC).
5. Copies all browser extension `.zip` archives into a dedicated `browser-extensions` directory inside the application installation folder.

**Note**: Users can easily find and load the extension `.zip` files by navigating to **Settings** -> **HTTP** tab inside the installed application and clicking **Install / Setup Chrome Extension**, which opens the `browser-extensions/` folder directly.

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
node versioning.js 26.6.8
```

This will automatically update the version in:
- `package.json`
- `package-lock.json`
- `neutralino.config.json`
- `setup.iss`
- `wxt/package.json` (WXT generates the extension manifest version from here)

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
