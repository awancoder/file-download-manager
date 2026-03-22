# File Download Manager ⚡

File Download Manager is a super-lightweight and innovative open-source desktop software, tailored specifically for capturing and downloading massive files in parallel (much like **Internet Download Manager (IDM)**), directly to your PC.

Built with **[Neutralino.js](https://neutralino.js.org/)** for a tiny desktop interface footprint, and powered by a purely native *NodeJS Multi-Thread Engine*, this application can completely saturate your WiFi/Fiber bandwidth limit.

## ✨ Key Features

- **Ultra Lightweight UI**: Native Desktop interface that is incredibly fast, clean, reactive, and memory efficient (< 100MB RAM).
- **Chrome Extension Interceptor**: Automatically catches downloads directly from your built-in Google Chrome browser. Sneaks in intelligently to "steal" exact Cookies and HTTP headers (such as `Referer` & `User-Agent`) to break through Anti-Scraping / Cloudflare protections.
- **Parallel Multi-Thread Engine (Ultra Fast)**: Splits 1 single download into **16 Simultaneous Chunks (TCP Pipes)**, squeezing out the maximum speed from your computer's internet capabilities for massive files (e.g., 100 GB). *(Denoted by the 2 Yellow Lightning Bolts icon).*
- **Instant Pre-Allocation (Sparse File)**: Instantaneously allocates 100GB of disk space on Windows NTFS in just 0.001 seconds, ensuring your HardDrive/PC won't slow down or freeze when a massive download begins.
- **Auto-Fallback & Resume**: If a legacy server doesn't support file chunking, this smart engine falls back gracefully to standard *1-Thread* mode (Green Lightning). Moreover, interrupted downloads can be recovered (*HTTP Range Resume*) without restarting from zero!
- **S3 Auto-Bypass Expiration**: Automatically detects Amazon S3 links with extreme short-lifespan expirations (e.g., `X-Amz-Expires=10`), and force-starts them instantly by bypassing the UI confirmation to guarantee they are grabbed before dying.
- **Background Tray Ghost**: The app stays constantly ready via the Windows *System Tray* background process even if you close the main window.
- **Structured Download History**: All downloaded media records are beautifully sorted, featuring quick native SVG icons to *"Open File"* or *"Open Folder"* without manually delving into Windows Explorer.

## 📦 System Prerequisites

Before installing this tool, ensure your system has the following core tools:

1. **[Node.js](https://nodejs.org/)** & Npm.
2. **[Neutralino CLI](https://neutralino.js.org/docs/cli/neu-cli/)**: Install globally via CMD:
   ```bash
   npm install -g @neutralinojs/neu
   ```

## 🛠️ Setup & Installation

1. **Open CMD** to clone this project locally and jump inside:
   ```bash
   cd file-download-manager
   ```

2. **Install Core Node Server Dependencies**:
   ```bash
   cd extensions/listener
   npm install
   cd ../../
   ```

3. **Install the Extension into Google Chrome**:
   - Navigate to `chrome://extensions/` in your Chrome Browser.
   - Toggle **Developer mode** ON at the top right of the page.
   - Click **Load unpacked**, then locate *(select folder)* to the `chrome-extension/` directory embedded within this project.

4. **Run the App in Developer Mode**:
   Return to your root terminal path and type:
   ```bash
   neu run
   ```

## 🚀 Compiling for Production (*Building EXE*)

Once customized and perfectly modified, roll it into a standalone Desktop Executable (`.exe`):

```bash
neu build
```
Your ready-to-deploy application will be served fully compiled inside the `/dist/` folder!

## 📜 License

Free to distribute, rebuild, or remix under the umbrella of the Open-Source ISC License.
