param(
    [string]$PortName = "COM3"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $port = New-Object System.IO.Ports.SerialPort $PortName, 9600, "None", 8, "One"
    $port.ReadTimeout = 2000
    $port.WriteTimeout = 2000
    $port.Open()
    $text = "================================`r`n      SEZNIK BLUETOOTH TEST     `r`n            Port: $PortName     `r`n================================`r`n`r`n`r`n"
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($text)
    $port.Write($bytes, 0, $bytes.Length)
    $port.Close()
    Write-Host "SUCCESS: Data transmitted to $PortName !"
} catch {
    Write-Host "FAILED on $PortName : "$_.Exception.Message
}
