const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const payload = "\x1B\x40\x1B\x61\x01SEZNIK RAW TEST PRINT\r\n--------------------------------\r\nVEER 58mm RECEIPT\r\nDate: " + new Date().toLocaleDateString() + "\r\nStatus: DIRECT RAW TEST\r\n--------------------------------\r\n\x1B\x61\x01THANK YOU FOR USING SEZNIK!\r\n\r\n\r\n\x1D\x56\x00";
const tempFile = path.join(os.tmpdir(), 'test_raw_port.bin');
fs.writeFileSync(tempFile, Buffer.from(payload, 'latin1'));

console.log('Testing direct copy to USB ports...');
const ports = ['USB006', 'USB003', 'USB001', 'CP001'];

for (const port of ports) {
  try {
    console.log(`Trying cmd /c copy /b "${tempFile}" ${port}...`);
    const out = execSync(`cmd.exe /c copy /b "${tempFile}" ${port}`).toString();
    console.log(`Success on ${port}:`, out.trim());
  } catch (err) {
    console.log(`Failed on ${port}:`, err.message.trim());
  }
}
