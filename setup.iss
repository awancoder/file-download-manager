; ============================================================
; KUSTOMISASI UNTUK FILE DOWNLOAD MANAGER
; ============================================================
#define MyAppName "File Download Manager"           ; Nama Aplikasi
#define MyAppVersion "26.4.20"                     ; Versi (dari neutralino.config.json)
#define MyAppPublisher "Awan Digitals"             ; Publisher
#define MyAppExeName "FileDownloadManager.exe"      ; Nama file .exe eksekusi utama
#define MyIconFile "resources\icons\appIcon.ico"    ; Path ke file ikon aplikasi

[Setup]
; ID Aplikasi (Bisa diganti dengan GUID unik baru jika perlu)
AppId={{23029DF2-BE11-47C5-A267-3F649705BE8A}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://www.awandigitals.com
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoTextVersion={#MyAppVersion}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName=Internet
AllowNoIcons=yes
; Nama file installer yang dihasilkan
OutputBaseFilename=File_Download_Manager_v{#MyAppVersion}
; Ikon untuk installer Setup.exe
SetupIconFile={#MyIconFile}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\appIcon.ico
PrivilegesRequired=lowest
; Force close the app before install if still running
CloseApplications=yes
CloseApplicationsFilter=file-download-manager.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startmenuicon"; Description: "Create a &Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; File utama hasil build Neutralino (sesuaikan dengan binaryName di config)
; Catatan: Pastikan sudah menjalankan 'neu build' sebelum mengompice script Inno Setup ini.
Source: "dist\file-download-manager\file-download-manager-win_x64.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion
Source: "dist\file-download-manager\resources.neu"; DestDir: "{app}"; Flags: ignoreversion

; Sertakan folder ekstensi (NodeJS Backend)
Source: "extensions\*"; DestDir: "{app}\extensions"; Flags: ignoreversion recursesubdirs createallsubdirs

; Sertakan folder Chrome Extension (Interceptor)
Source: "chrome-extension\*"; DestDir: "{app}\chrome-extension"; Flags: ignoreversion recursesubdirs createallsubdirs

; Copy file ikon ke folder instalasi agar bisa dipakai shortcut
Source: "{#MyIconFile}"; DestDir: "{app}"; DestName: "appIcon.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\appIcon.ico"; Tasks: startmenuicon; AppUserModelID: "AwanDigitals.FileDownloadManager"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\appIcon.ico"; Tasks: desktopicon; AppUserModelID: "AwanDigitals.FileDownloadManager"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Hapus registry startup entry saat uninstall
Filename: "reg.exe"; Parameters: "delete ""HKCU\Software\Microsoft\Windows\CurrentVersion\Run"" /v ""FileDownloadManager"" /f"; Flags: runhidden nowait; RunOnceId: "RemoveStartupReg"

[UninstallDelete]
; Hapus folder settings di AppData
Type: filesandordirs; Name: "{userappdata}\com.awandigitals.file-download-manager"
; Hapus auth file di Temp
Type: files; Name: "{tmp}\.fdm_auth.json"
; Hapus log file di USERPROFILE
Type: files; Name: "{%USERPROFILE}\fdm-extension.log"
; Hapus Neutralino internal storage folder
Type: filesandordirs; Name: "{app}\.storage"

[Registry]
; Pastikan registry startup key dihapus saat uninstall (backup method)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueName: "FileDownloadManager"; Flags: uninsdeletevalue
