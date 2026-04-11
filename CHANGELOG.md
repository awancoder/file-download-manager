# Changelog

All notable changes to the File Download Manager application will be documented in this file.

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
