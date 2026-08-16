param(
    [string]$PortName = "COM4"
)

try {
    $port = New-Object System.IO.Ports.SerialPort $PortName, 9600, "None", 8, "One"
    $port.ReadTimeout = 4000
    $port.WriteTimeout = 4000
    $port.Open()

    $esc = [char]0x1B
    $gs = [char]0x1D
    $text = "$esc@$esc" + "a" + [char]1 + "SEZNIK POS STORE`r`n--------------------------------`r`nVEER 58mm TEST RECEIPT`r`n--------------------------------`r`nStatus: REAL PRINT VERIFIED`r`nDate: " + (Get-Date).ToShortDateString() + "`r`n--------------------------------`r`nTHANK YOU FOR USING SEZNIK!`r`n`r`n`r`n$gs" + "V" + [char]0
    
    $bytes = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetBytes($text)
    $port.Write($bytes, 0, $bytes.Length)
    $port.Close()
    Write-Host "SUCCESS: Real ESC/POS printed to $PortName !"
} catch {
    Write-Host "FAILED on $PortName : $($_.Exception.Message)"
}
