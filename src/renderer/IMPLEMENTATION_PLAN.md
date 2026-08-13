# Implementation Plan: OS Printer Detection, Josh Label Driver Installer, Default Printer & Raw ESC/POS Test Print

Implement OS-level printer detection (Windows Spooler & USB WMI), automatic driver detection & installation for **Josh Label Printer**, default printer configuration, and native raw ESC/POS / TSPL test print capability.

## Technical Architecture & Workflow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ELECTRON RENDERER UI                                 │
│  - Displays OS Spooler Printers (e.g. "LD0801 Label Printer") & USB Hotplug Devices    │
│  - Driver Installation Dialog (Prompts user to install "Win Driver JOSH Label Printer") │
│  - Default Printer Prompt & Status Indicator                                           │
│  - "Test Print (ESC/POS & TSPL)" trigger button                                        │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ IPC Bridge (seznikApi)
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                                   ELECTRON MAIN PROCESS                                │
│                                                                                        │
│ 1. OS Native Spooler & Device Enumerated:                                              │
│    PowerShell `Get-Printer | Select Name, DriverName, PortName, PrinterStatus, Default`│
│    PowerShell `Get-PnpDevice -Class Printer, USB` for hotplug detection                │
│                                                                                        │
│ 2. Driver Installer Execution:                                                         │
│    Runs `backend/src/config/josh-files/Win Driver Driver JOSH Label Printer.exe`      │
│    with Windows Administrator privileges (`Start-Process -Verb RunAs -Wait`)          │
│                                                                                        │
│ 3. Set Default Printer:                                                                │
│    PowerShell `(Get-WmiObject -Class Win32_Printer -Filter "Name='$name'").SetDefault()` │
│    or `Set-Printer -Name '$name' -IsDefault $true`                                     │
│                                                                                        │
│ 4. Native Raw Test Printing:                                                           │
│    Transmits raw ESC/POS / TSPL binary commands directly to printer spooler queue      │
│    via PowerShell `[System.IO.File]::WriteAllBytes` / Out-Printer or Win32 Raw API      │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

---

## Proposed Changes

### Electron Main Process & Services

#### PrinterService.ts (`src/services/PrinterService.ts`)
- Implement `getOsPrinters()` using PowerShell command `Get-Printer` to fetch installed Windows/Mac system printers dynamically.
- Implement `setAsDefaultPrinter(printerName: string)` to execute PowerShell command to make the selected printer the OS default printer.
- Implement `sendRawTestPrint(printerName: string, printType: 'RECEIPT' | 'LABEL')` to write raw ESC/POS & TSPL label commands directly to the printer spooler.

#### DriverService.ts (`src/services/DriverService.ts`)
- Add execution logic for `Win Driver Driver JOSH Label Printer.exe` located at `c:\Users\omen\Seznik-app\backend\src\config\josh-files\Win Driver Driver JOSH Label Printer.exe`.
- Trigger elevated UAC process (`Start-Process -FilePath "..." -Verb RunAs -Wait`).

#### Shared Types (`src/shared/types.ts`)
- Extend `PrinterDevice` and `SeznikApiBridge` with `getOsPrinters`, `installJoshDriver`, `setDefaultPrinter`, and `printRawEscPos`.

#### IPC Handlers (`src/main/ipc/index.ts`)
- Register IPC handlers for `printer:getOsPrinters`, `driver:installJosh`, `printer:setDefault`, `printer:rawTestPrint`.

---

### React Renderer UI

#### Dashboard (`src/renderer/src/pages/Dashboard.tsx`)
- Add "OS Printers Detected" section showing system printers (e.g., `LD0801 Label Printer`).
- Add Driver Install Modal / Banner prompting: *"Josh Label Printer detected. Install driver (Win Driver Driver JOSH Label Printer.exe)?"*
- Add "Set as Default Printer" button and status badge.
- Connect "Test Print" button to transmit ESC/POS and TSPL test print receipts/labels directly to the printer spooler.

---

## Verification Plan

### Automated Verification
1. Run `npx tsc --noEmit` and `npx tsc -p tsconfig.node.json --noEmit` to verify type safety.
2. Run `npx vite build` to ensure renderer compilation.

### Manual Verification
1. Fetch system printers via `Get-Printer` to detect installed printers (e.g. `LD0801 Label Printer` as shown in user screenshot).
2. Trigger Josh Driver Installer launch.
3. Test setting default printer and verifying default state.
4. Execute ESC/POS raw test print.
