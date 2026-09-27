# Changelog

All notable changes to the File Download Manager application will be documented in this file.

## [v26.9.28] - 2026-09-28

### Added
- **Dynamic Backend Port Fallback & Auto-Discovery:** Implemented intelligent port conflict resolution (`EADDRINUSE`) scanning ports 5050–5070 dynamically with port caching, bridge file generation (`.fdm_backend_port`), and automatic port probing in Chrome and Firefox extensions.
- **WebView2 User Data Directory Isolation:** Isolated WebView2 user data profile directory for confirmation dialogs to prevent multi-instance runtime collisions and crashes on Windows.

### Fixed
- **Blank New Download Dialog:** Fixed an issue where the download confirmation dialog opened as a blank black window in production builds by removing deprecated `--load-dir-res` for bundled resources and including `resources/` in Inno Setup.
- **Filesystem API Method Alignment:** Corrected `removeFile` to `remove` in `confirm.js` per Neutralinojs v6 filesystem specifications to ensure temporary JSON payloads are properly cleaned up.
- **Safe Type Inspection for Download Actions:** Safeguarded URL and Torrent detection against undefined/non-string payloads in the listener backend.
- **Immediate Initial File Size Display:** Automatically populates the file size column upon download confirmation before progress events begin.

## [v26.9.19] - 2026-09-19

### Added
- **Revamped About Modal:** Redesigned the About modal with futuristic aesthetics: ambient radial glow, pulsating animated app logo, gradient typography, live version pill status, and interactive feature highlight cards (16x Multi-Thread, BitTorrent, HLS Stream, Custom DNS).
- **Synchronized Icon Reference Guide:** Updated the Info modal to reflect current features including the new sky-blue chain link icon for HLS streams, Retry button for zero-peer/failed downloads, table sorting/resizing guide, and bottom status bar terminal toggle.
- **Automated Extension Packaging:** Automated the generation and distribution of clean browser extension `.zip` archives (`chrome.zip`, `firefox.zip`) in the `browser-extensions` directory, accessible directly from the application's HTTP settings.
- **Inno Setup Automated Installer Pipeline:** Enhanced `build.js` with dynamic Inno Setup compiler detection (`ISCC.exe`) and automated one-command packaging (`npm run build`) to produce the standalone Windows installer (`Output/File_Download_Manager_v26.9.19.exe`).

### Changed
- **Full English Localization:** Audited and localized the entire application interface into English, including tooltips, confirmation prompts, error alerts, and extension API response messages.
- **Streamlined Secondary Buttons:** Standardized `.btn-secondary` and `.btn-cancel` styles across all modals to guarantee high text contrast and legibility.
- **HLS Stream Indicator:** Replaced the legacy triangle icon with a sky-blue chain link icon in the table speed column to clearly distinguish multi-segment HLS streams from regular video files.

### Fixed
- **Button Contrast Bug:** Resolved an issue in the Magnet modal where Cancel button text appeared white-on-white due to missing secondary button styling.
- **WebTorrent Update Spawn Error:** Resolved Windows `spawn EINVAL` error when updating WebTorrent engine dependencies directly from the desktop settings UI.
- **Dialog Inspector and Tray Management:** Fixed secondary confirm dialogs improperly launching devtools and eliminated duplicate system tray icon instances.

## [v26.6.8] - 2026-06-08

### Added
- **HLS Downloader (.m3u8):** Added full support for downloading HLS streaming video playlists. The downloader automatically parses the manifest, fetches all `.ts` video segments in parallel, and merges them sequentially.
- **Auto MP4 Conversion:** Automatically saves stitched HLS video streams with a `.mp4` extension instead of `.m3u8`, allowing immediate playback on most standard media players without any extra transcoding.
- **Tab Title-based Filename Sniffing:** Automatically detects and renames generic playlist/video streams (like `playlist.m3u8` or `videoplayback.mp4`) using the sanitized title of the active browser tab.
- **Automated Extension Zipping:** Updated the build process to automatically build and generate `.zip` extension files for both Google Chrome and Mozilla Firefox.
- **Installer Integration:** Updated the setup packager to copy the compiled Chrome and Firefox extension `.zip` files into a dedicated `browser-extensions` folder in the installation directory.
- **HTTP Settings UI Update:** Updated the Chrome Extension Setup button in the HTTP Settings tab to directly open the new `browser-extensions` directory, and rewritten the step-by-step instructions for loading `.zip` extensions.

## [v26.4.20] - 2026-04-20

### Added
- **Custom DNS Provider:** Added a DNS provider option (Google, Cloudflare, Quad9, OpenDNS, AdGuard, or Custom) in the settings menu to help bypass ISP-level blocking on HTTPS downloads.

### Fixed
- Minor improvements and bug fixes.

## [v26.4.11] - 2026-04-11

### Added
- **App Stats:** Implemented real-time system and application statistics monitoring.
- **Terminal Logging:** Added a built-in terminal log view for better process debugging and transparency.
- **Torrent & Magnet Support:** Introduced capabilities to download files directly using `.torrent` files or magnet links.
- **Log Management:** Added functionality to seamlessly clear or delete terminal logs.
- **Kill Active Downloads:** Provided an option to forcefully terminate active or frozen downloads.
- **Torrent Configuration:** Added dedicated settings for customizing torrent behaviors, such as connection limits.
- **WebTorrent Updater:** Added a built-in feature to easily check for and update the underlying WebTorrent engine.
- **Help Menu:** Introduced a new Help menu containing 'About' and 'Info' sections.

### Changed
- **UI Layout:** Changed the UI layout to a two-column layout with a sidebar and main content area.
- **Pagination Navigation:** Relocated the 'Previous' and 'Next' pagination buttons for improved accessibility.
- **Options Interface:** Completely revamped the Options UI for a more intuitive settings management experience.

### Fixed
- **Pause/Resume Logic:** Fixed an issue where downloads would implicitly continue running in the background despite being paused.
- **Deletion Handling:** Fixed an issue where the download status remained active even after the associated entry or file was deleted.

## [v26.3.22] - 2026-03-22

### Added
- **Minimalist User Interface:** Features a clean data table displaying essential download metrics including File Name, Size, Speed, Status, Progress, Date, and Action controls.
- **Essential Navigation:** Includes straightforward application menus for Add Link, Options, and Exit.
- **Configuration Options:** Provides dedicated settings to customize the Default Download Location, enable Run at Startup, and manage Browser Integration.
- **Multi-Thread Optimization:** Intelligently splits files into multiple chunks for simultaneous downloading. Connection concurrency scales dynamically with CPU capabilities to maximize throughput.
- **Anti-Scraping Bypass:** Leverages Chrome Extension integration to automatically extract session cookies and request headers (Referer, User-Agent), effectively bypassing Cloudflare or AWS S3 protections.
- **Instant Disk Allocation:** Utilizes NTFS sparse files on Windows to instantly allocate space for massive files (100GB+), eliminating system freezes during download initialization.
- **Smart Resume:** Seamlessly resumes interrupted or disconnected downloads without restarting from scratch.
- **Ultra Lightweight:** The core application footprint is highly optimized, requiring only ~10 MB of storage and minimal memory.
- **Run in Background:** Supports minimizing to the System Tray, allowing background active downloads without taskbar clutter.
