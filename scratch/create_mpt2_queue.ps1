$ErrorActionPreference = 'SilentlyContinue'
# Add POS58 Driver if not present
if (-not (Get-PrinterDriver -Name 'POS58' -ErrorAction SilentlyContinue)) {
    Add-PrinterDriver -Name 'POS58'
}

# Add or update MPT-II Printer Queue
if (-not (Get-Printer -Name 'MPT-II' -ErrorAction SilentlyContinue)) {
    Add-Printer -Name 'MPT-II' -DriverName 'POS58' -PortName 'nul:' -PrintProcessor 'winprint' -DataType 'RAW'
} else {
    Set-Printer -Name 'MPT-II' -DriverName 'POS58' -PortName 'nul:' -PrintProcessor 'winprint' -DataType 'RAW'
}

# Also ensure POS58 Printer queue is mapped to nul: instead of dead USB006
if (Get-Printer -Name 'POS58 Printer' -ErrorAction SilentlyContinue) {
    Set-Printer -Name 'POS58 Printer' -PortName 'nul:' -ErrorAction SilentlyContinue
}

# Set Default Printer
(New-Object -ComObject WScript.Network).SetDefaultPrinter('MPT-II')
(Get-WmiObject -Class Win32_Printer -Filter "Name='MPT-II'").SetDefaultPrinter()
