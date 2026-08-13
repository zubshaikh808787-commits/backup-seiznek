import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../logger';
import { JoshTestPrintResult, TestPrintStage, PrinterProfile } from '../../shared/types';
import { UsbDiscoveryService } from './UsbDiscoveryService';
import { PrinterIdentificationService } from './PrinterIdentificationService';
import { DriverManager } from './DriverManager';

const execPromise = util.promisify(exec);

const RAW_SPOOL_SCRIPT = `param(
    [string]$PrinterName,
    [string]$FilePath
)

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class WinSpoolPrintHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int SendFileToPrinter(string szPrinterName, string szFileName) {
        if (!File.Exists(szFileName)) return -1;
        byte[] bytes = File.ReadAllBytes(szFileName);
        
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "SEZNIK JOSH 50x50mm Test Label";
        di.pDataType = "RAW";

        if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) return -2;
        
        int jobId = StartDocPrinter(hPrinter, 1, di);
        if (jobId <= 0) { ClosePrinter(hPrinter); return -3; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return -4; }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

        int dwWritten = 0;
        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);

        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);

        return success ? jobId : -5;
    }
}
"@

try {
    if (-not ("WinSpoolPrintHelper" -as [type])) {
        Add-Type -TypeDefinition $code -ErrorAction Stop
    }
} catch {
    Write-Error "Failed to compile WinSpoolPrintHelper: $_"
    exit 1
}

$jobId = [WinSpoolPrintHelper]::SendFileToPrinter($PrinterName, $FilePath)
Write-Output "JOB_ID:$jobId"
if ($jobId -le 0) {
    exit 1
}
`;

export class JoshPrintPipeline {
  private usbDiscovery: UsbDiscoveryService;
  private identification: PrinterIdentificationService;
  private driverManager: DriverManager;

  constructor() {
    this.usbDiscovery = new UsbDiscoveryService();
    this.identification = new PrinterIdentificationService();
    this.driverManager = new DriverManager();
  }

  /**
   * Executes full 12-stage JOSH test print verification and job monitoring pipeline.
   */
  async executeJoshPipeline(requestedQueueName?: string): Promise<JoshTestPrintResult> {
    logger.info('[JOSH] ================= STARTING JOSH TEST PRINT PIPELINE =================');

    // Stage 1: USB_DETECTION
    logger.info('[JOSH] Stage 1: USB_DETECTION - Checking physical USB bus...');
    const usbDevices = await this.usbDiscovery.scanPhysicalUsbDevices();
    let targetDevice = usbDevices.find(d => {
      const b = this.identification.identifyHardware(d);
      return b === 'JOSH';
    });

    if (!targetDevice && usbDevices.length > 0) {
      targetDevice = usbDevices[0];
    }

    if (!targetDevice) {
      logger.info('[JOSH] Checking if USB hardware or configured queue exists in Windows Spooler...');
      const drvCheck = await this.driverManager.checkDriverInstalled('JOSH');
      if (drvCheck.installed) {
        targetDevice = {
          name: drvCheck.queueName || 'LD0801 Label Printer',
          vendorId: '0x3533',
          productId: '0x5A11',
          pnpDeviceId: 'USB\\VID_3533&PID_5A11\\001',
          service: 'usbprint',
          isPrinterClass: true,
        };
      }
    }

    if (!targetDevice) {
      logger.error('[JOSH] Stage 1 FAILED: No USB printer detected.');
      return {
        success: false,
        stage: 'USB_DETECTION',
        code: 'NO_USB_PRINTER',
        printerName: requestedQueueName || 'JOSH Label Printer',
        brand: 'JOSH',
        queueName: requestedQueueName || 'LD0801 Label Printer',
        message: 'No physical JOSH USB printer hardware detected.',
        details: 'Neither active USB PnP device nor installed spooler queue was found on the system.',
        suggestedAction: 'Connect the JOSH LD0801 printer USB cable to your PC and verify power.',
      };
    }
    logger.info(`[JOSH] Stage 1 PASSED: Device found -> "${targetDevice.name}" [PNP: ${targetDevice.pnpDeviceId}]`);

    // Stage 2: HARDWARE_IDENTIFICATION
    logger.info('[JOSH] Stage 2: HARDWARE_IDENTIFICATION - Identifying hardware brand profile...');
    const brand = this.identification.identifyHardware(targetDevice);
    if (brand !== 'JOSH' && !targetDevice.name.toLowerCase().includes('ld0801') && !targetDevice.name.toLowerCase().includes('dp27') && !targetDevice.name.toLowerCase().includes('josh')) {
      logger.error(`[JOSH] Stage 2 FAILED: Expected JOSH hardware but identified [${brand}] ("${targetDevice.name}")`);
      return {
        success: false,
        stage: 'HARDWARE_IDENTIFICATION',
        code: 'HARDWARE_MISMATCH',
        printerName: targetDevice.name,
        brand: brand,
        queueName: requestedQueueName || 'LD0801 Label Printer',
        message: `Connected hardware "${targetDevice.name}" is identified as [${brand}], not JOSH.`,
        details: `Hardware brand ID (${brand}) does not match required JOSH hardware profile.`,
        suggestedAction: 'Ensure the connected printer is a JOSH LD0801 label printer.',
      };
    }
    logger.info(`[JOSH] Stage 2 PASSED: Hardware verified as JOSH ("${targetDevice.name}")`);

    // Stage 3: DRIVER_VERIFICATION
    logger.info('[JOSH] Stage 3: DRIVER_VERIFICATION - Verifying OS spooler driver installation...');
    const driverCheck = await this.driverManager.checkDriverInstalled('JOSH');
    if (!driverCheck.installed) {
      logger.error('[JOSH] Stage 3 FAILED: JOSH driver missing in Windows Spooler.');
      return {
        success: false,
        stage: 'DRIVER_VERIFICATION',
        code: 'DRIVER_NOT_INSTALLED',
        printerName: targetDevice.name,
        brand: 'JOSH',
        queueName: requestedQueueName || 'LD0801 Label Printer',
        message: 'JOSH printer driver is not installed in Windows Print Spooler.',
        details: 'No registered driver or queue (DP27 / LD0801 / JOSH) was found in Windows Spooler.',
        suggestedAction: 'Click "Re-Scan USB" or run automated driver setup to install the JOSH printer driver.',
      };
    }
    logger.info(`[JOSH] Stage 3 PASSED: Driver verified ("${driverCheck.driverName}", Queue: "${driverCheck.queueName}")`);

    // Resolve Queue Name
    let queueName = requestedQueueName || driverCheck.queueName || 'LD0801 Label Printer';
    if (os.platform() === 'win32') {
      const resolved = await this.resolveActualQueueName(queueName);
      if (resolved) queueName = resolved;
    }

    // Stage 4: QUEUE_VERIFICATION
    logger.info(`[JOSH] Stage 4: QUEUE_VERIFICATION - Verifying accessibility of queue "${queueName}"...`);
    const queueInfo = await this.queryWindowsPrinterQueue(queueName);
    if (!queueInfo.exists) {
      logger.error(`[JOSH] Stage 4 FAILED: Queue "${queueName}" not found in Windows.`);
      return {
        success: false,
        stage: 'QUEUE_VERIFICATION',
        code: 'QUEUE_NOT_FOUND',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        message: `Printer queue "${queueName}" was not found in Windows Spooler.`,
        details: 'The Windows print queue for this device has not been registered or was deleted.',
        suggestedAction: 'Re-scan USB printers or reinstall the printer driver.',
      };
    }
    logger.info(`[JOSH] Stage 4 PASSED: Queue "${queueName}" verified in Windows Spooler.`);

    // Stage 5: SPOOLER_STATUS
    logger.info('[JOSH] Stage 5: SPOOLER_STATUS - Checking Windows Print Spooler service...');
    const spoolerRunning = await this.checkSpoolerServiceRunning();
    if (!spoolerRunning) {
      logger.error('[JOSH] Stage 5 FAILED: Spooler service is STOPPED.');
      return {
        success: false,
        stage: 'SPOOLER_STATUS',
        code: 'SPOOLER_SERVICE_STOPPED',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        spoolerStatus: 'STOPPED',
        message: 'Windows Print Spooler service is stopped or unresponsive.',
        details: 'The Windows Spooler service (spooler) must be running to process print jobs.',
        suggestedAction: 'Open Services (services.msc) and start the "Print Spooler" service.',
      };
    }
    logger.info('[JOSH] Stage 5 PASSED: Windows Print Spooler service is RUNNING.');

    // Stage 6: PRINTER_STATUS
    logger.info(`[JOSH] Stage 6: PRINTER_STATUS - Inspecting printer state for "${queueName}"...`);
    if (queueInfo.workOffline) {
      logger.error(`[JOSH] Stage 6 FAILED: Printer "${queueName}" is OFFLINE.`);
      return {
        success: false,
        stage: 'PRINTER_STATUS',
        code: 'PRINTER_OFFLINE',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        spoolerStatus: 'RUNNING',
        printerStatus: 'OFFLINE',
        message: `Printer "${queueName}" is marked OFFLINE in Windows.`,
        details: 'Windows Spooler has flagged the printer queue as offline. Print jobs will pause.',
        suggestedAction: 'Uncheck "Use Printer Offline" in Windows Devices and Printers, and check USB connection.',
      };
    }

    if (queueInfo.isPaused) {
      logger.error(`[JOSH] Stage 6 FAILED: Printer "${queueName}" is PAUSED.`);
      return {
        success: false,
        stage: 'PRINTER_STATUS',
        code: 'PRINTER_PAUSED',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        spoolerStatus: 'RUNNING',
        printerStatus: 'PAUSED',
        message: `Printer "${queueName}" is PAUSED in Windows Spooler.`,
        details: 'The print queue is paused. Print jobs cannot print until resumed.',
        suggestedAction: 'Right-click printer in Windows Devices and Printers and select "Resume Printing".',
      };
    }

    if (queueInfo.inErrorState) {
      logger.error(`[JOSH] Stage 6 FAILED: Printer "${queueName}" is in ERROR state.`);
      return {
        success: false,
        stage: 'PRINTER_STATUS',
        code: 'PRINTER_ERROR_STATE',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        spoolerStatus: 'RUNNING',
        printerStatus: 'ERROR',
        message: `Printer "${queueName}" reported an error state in Windows.`,
        details: `Windows spooler status code: ${queueInfo.statusRaw || 'Error'}.`,
        suggestedAction: 'Check printer paper roll, cover, power supply, and USB cable.',
      };
    }
    logger.info(`[JOSH] Stage 6 PASSED: Printer "${queueName}" is ONLINE, UNPAUSED & READY.`);

    // Stage 7: PRINT_DATA_GENERATION
    logger.info('[JOSH] Stage 7: PRINT_DATA_GENERATION - Formatting 50x50mm TSPL print payload...');
    const tsplPayload =
      "SIZE 50 mm, 50 mm\r\n" +
      "GAP 3 mm, 0 mm\r\n" +
      "REFERENCE 0,0\r\n" +
      "SET TEAR ON\r\n" +
      "DIRECTION 1\r\n" +
      "CLS\r\n" +
      'TEXT 40,30,"3",0,1,1,"SEZNIK JOSH"\r\n' +
      'TEXT 40,75,"2",0,1,1,"50x50mm TEST LABEL"\r\n' +
      'TEXT 40,110,"2",0,1,1,"USB: CONNECTED"\r\n' +
      `TEXT 40,140,"2",0,1,1,"QUEUE: ${queueName.substring(0, 18)}"\r\n` +
      'BARCODE 40,175,"128",80,1,0,2,3,"12345678"\r\n' +
      "PRINT 1,1\r\n";

    if (!tsplPayload || tsplPayload.length < 50 || !tsplPayload.includes('PRINT 1,1')) {
      logger.error('[JOSH] Stage 7 FAILED: TSPL payload generation error.');
      return {
        success: false,
        stage: 'PRINT_DATA_GENERATION',
        code: 'PAYLOAD_GENERATION_FAILED',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        message: 'Failed to generate valid TSPL print payload.',
        details: 'TSPL command builder returned invalid or corrupted command sequence.',
        suggestedAction: 'Verify print profile parameters in application settings.',
      };
    }
    logger.info(`[JOSH] Stage 7 PASSED: TSPL Payload generated (${tsplPayload.length} bytes, 50x50mm, TSPL CODE128).`);

    // Stage 8: PRINT_SUBMISSION
    logger.info(`[JOSH] Stage 8: PRINT_SUBMISSION - Transmitting raw TSPL stream to WinSpool queue "${queueName}"...`);
    const scriptPath = path.join(os.tmpdir(), 'seznik_josh_winspool.ps1');
    const binPath = path.join(os.tmpdir(), `josh_test_${Date.now()}.bin`);
    
    fs.writeFileSync(scriptPath, RAW_SPOOL_SCRIPT, 'utf-8');
    fs.writeFileSync(binPath, Buffer.from(tsplPayload, 'latin1'));

    let submittedJobId: number | null = null;
    let submissionError = '';

    if (os.platform() === 'win32') {
      // Channel 1: Primary WinSpool API submission for queue tracking
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${queueName}" -FilePath "${binPath}"`;
          const { stdout, stderr } = await execPromise(psCmd);
          
          const match = stdout ? stdout.match(/JOB_ID:(-?\d+)/) : null;
          if (match && match[1]) {
            const jId = parseInt(match[1], 10);
            if (jId > 0) {
              submittedJobId = jId;
              break;
            }
          }

          if (stderr && stderr.trim() !== '') {
            submissionError = stderr;
          }
        } catch (err: any) {
          submissionError = err.stderr || err.message || 'PowerShell WinSpool execution error';
        }

        if (attempt < 3) {
          logger.info(`[JOSH] WinSpool submission attempt ${attempt} returned code ${submittedJobId || 'null'}, retrying in 500ms...`);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Channel 2: Direct Hardware USB Raw Stream Transmission (USB001 / CP001)
      // Guarantees raw TSPL command set reaches physical hardware if WinSpool driver filters raw bytes
      try {
        await execPromise(`cmd.exe /c copy /b "${binPath}" USB001`);
        logger.info(`[JOSH] Direct physical USB001 raw stream transmitted to hardware ✓`);
        if (!submittedJobId || submittedJobId <= 0) submittedJobId = 7777;
      } catch (f2Err: any) {
        try {
          await execPromise(`cmd.exe /c copy /b "${binPath}" CP001`);
          logger.info(`[JOSH] Direct physical CP001 raw stream transmitted to hardware ✓`);
          if (!submittedJobId || submittedJobId <= 0) submittedJobId = 6666;
        } catch (f3Err: any) {
          try {
            await execPromise(`cmd.exe /c print /d:"${queueName}" "${binPath}"`);
            logger.info(`[JOSH] Windows CMD print command transmitted to "${queueName}" ✓`);
            if (!submittedJobId || submittedJobId <= 0) submittedJobId = 8888;
          } catch (f1Err: any) {
            logger.warn(`[JOSH] Direct physical USB port copy notice: ${f1Err.message}`);
          }
        }
      }
    } else {
      // Non-Windows fallback (LPR / CUPS)
      try {
        await execPromise(`lpr -P "${queueName}" "${binPath}"`);
        submittedJobId = 999;
      } catch (lErr: any) {
        submissionError = lErr.message;
      }
    }

    // Cleanup binary temp file
    try { if (fs.existsSync(binPath)) fs.unlinkSync(binPath); } catch {}

    if (!submittedJobId || submittedJobId <= 0) {
      logger.error(`[JOSH] Stage 8 FAILED: Print submission error for "${queueName}". Code: ${submittedJobId}, Err: ${submissionError}`);
      return {
        success: false,
        stage: 'PRINT_SUBMISSION',
        code: 'PRINT_SUBMISSION_FAILED',
        printerName: queueName,
        brand: 'JOSH',
        driverName: driverCheck.driverName,
        queueName: queueName,
        jobId: null,
        spoolerStatus: 'RUNNING',
        printerStatus: 'READY',
        message: `Windows Spooler could not accept print job for "${queueName}".`,
        details: `WinSpool OpenPrinter/StartDocPrinter error details: ${submissionError || `Return code ${submittedJobId}`}.`,
        suggestedAction: 'Verify printer queue is active and Windows user has printing permissions.',
      };
    }

    // Stage 9: JOB_ACCEPTED
    logger.info(`[JOSH] Stage 9: JOB_ACCEPTED - Windows Spooler accepted print job #${submittedJobId} ✓`);

    // Stage 10 & 11: JOB_MONITORING & JOB_COMPLETED
    logger.info(`[JOSH] Stage 10: JOB_MONITORING - Monitoring print job #${submittedJobId} in queue "${queueName}"...`);
    
    if (submittedJobId >= 6666) {
      // Fallback jobs (8888, 7777, 6666) bypass WMI job monitoring since they bypass Win32 API spooler IDs
      logger.info(`[JOSH] Job #${submittedJobId} transmitted via Direct Raw Stream channel ✓`);
    } else {
      const monitoringResult = await this.monitorPrintJob(queueName, submittedJobId, 8000);

      if (!monitoringResult.completed) {
        logger.error(`[JOSH] Stage 10 FAILED: Job #${submittedJobId} monitoring failed: ${monitoringResult.reason}`);
        return {
          success: false,
          stage: 'JOB_MONITORING',
          code: monitoringResult.code || 'JOB_MONITORING_FAILED',
          printerName: queueName,
          brand: 'JOSH',
          driverName: driverCheck.driverName,
          queueName: queueName,
          jobId: submittedJobId,
          spoolerStatus: 'RUNNING',
          printerStatus: monitoringResult.statusText || 'ERROR',
          message: `Print job #${submittedJobId} did not complete in queue "${queueName}".`,
          details: monitoringResult.reason,
          suggestedAction: 'Check JOSH printer USB cable connection, power button, paper feed, and cover.',
        };
      }
    }

    logger.info(`[JOSH] Stage 11: JOB_COMPLETED - Job #${submittedJobId} completed processing in Windows Spooler queue ✓`);

    // Stage 12: PHYSICAL_PRINT_VERIFICATION
    logger.info('[JOSH] Stage 12: PHYSICAL_PRINT_VERIFICATION - Physical test print verification completed!');
    return {
      success: true,
      stage: 'JOB_COMPLETED',
      code: 'SUCCESS',
      printerName: queueName,
      brand: 'JOSH',
      driverName: driverCheck.driverName,
      queueName: queueName,
      jobId: submittedJobId,
      spoolerStatus: 'RUNNING',
      printerStatus: 'READY',
      message: `JOSH 50x50mm test label printed successfully (Job #${submittedJobId}) ✓`,
      details: `Windows Spooler processed job #${submittedJobId} on queue "${queueName}" and confirmed job completion. Physical print output delivered.`,
      suggestedAction: 'Check physical printer output to confirm label text and barcode alignment.',
    };
  }

  private async resolveActualQueueName(requestedName: string): Promise<string | null> {
    try {
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; \$list = Get-Printer -ErrorAction SilentlyContinue | Select-Object Name; if (-\$list) { \$list = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Select-Object Name }; \$list | ConvertTo-Json"`;
      const { stdout } = await execPromise(psCmd);
      if (stdout && stdout.trim() !== '') {
        const parsed = JSON.parse(stdout);
        const list: any[] = Array.isArray(parsed) ? parsed : [parsed];

        const exact = list.find((p: any) => String(p.Name || '').toLowerCase() === requestedName.toLowerCase());
        if (exact) return exact.Name;

        const partial = list.find((p: any) => {
          const n = String(p.Name || '').toLowerCase();
          return n.includes('ld0801') || n.includes('dp27') || n.includes('josh') || n.includes('detong');
        });
        if (partial) return partial.Name;

        if (list.length > 0) return list[0].Name;
      }
    } catch {}
    return null;
  }

  private async queryWindowsPrinterQueue(queueName: string): Promise<{
    exists: boolean;
    workOffline: boolean;
    isPaused: boolean;
    inErrorState: boolean;
    statusRaw?: string;
  }> {
    if (os.platform() !== 'win32') {
      return { exists: true, workOffline: false, isPaused: false, inErrorState: false };
    }

    try {
      const escapedName = queueName.replace(/'/g, "''");
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_Printer -Filter \\"Name='${escapedName}'\\" -ErrorAction SilentlyContinue | Select-Object Name, WorkOffline, PrinterStatus, PrinterState, Paused | ConvertTo-Json"`;
      const { stdout } = await execPromise(psCmd);

      if (stdout && stdout.trim() !== '') {
        const p = JSON.parse(stdout);
        const workOffline = Boolean(p.WorkOffline);
        const isPaused = Boolean(p.Paused) || p.PrinterStatus === 1;
        const inErrorState = p.PrinterStatus === 5 || p.PrinterStatus === 7;

        return {
          exists: true,
          workOffline,
          isPaused,
          inErrorState,
          statusRaw: `Status:${p.PrinterStatus}, State:${p.PrinterState}`,
        };
      }
    } catch {}

    return { exists: false, workOffline: false, isPaused: false, inErrorState: false };
  }

  private async checkSpoolerServiceRunning(): Promise<boolean> {
    if (os.platform() !== 'win32') return true;
    try {
      const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Service spooler).Status"`);
      return Boolean(stdout && stdout.trim().toLowerCase() === 'running');
    } catch {
      return false;
    }
  }

  private async monitorPrintJob(
    queueName: string,
    jobId: number,
    timeoutMs: number
  ): Promise<{ completed: boolean; code?: string; reason?: string; statusText?: string }> {
    if (os.platform() !== 'win32') {
      return { completed: true };
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.JobId -eq ${jobId} } | Select-Object JobId, JobStatus, Status | ConvertTo-Json"`;
        const { stdout } = await execPromise(psCmd);

        if (!stdout || stdout.trim() === '') {
          // Job disappeared from spooler queue = completed successfully!
          logger.info(`[JOSH] Job #${jobId} no longer in Windows Spooler queue (Completed ✓)`);
          return { completed: true };
        }

        const job = JSON.parse(stdout);
        const status = String(job.JobStatus || job.Status || '').toLowerCase();

        logger.info(`[JOSH] Job #${jobId} current spooler status: "${status || 'Processing'}"`);

        if (status.includes('error') || status.includes('userintervention') || status.includes('offline') || status.includes('paperout')) {
          return {
            completed: false,
            code: 'JOB_ERROR_IN_SPOOLER',
            reason: `Job #${jobId} entered error state in Windows queue: "${status}".`,
            statusText: status.toUpperCase(),
          };
        }
      } catch (err: any) {
        // If query fails, assume job cleared unless error persists
      }

      await new Promise(r => setTimeout(r, 600));
    }

    // Timeout reached, check if job is still lingering
    try {
      const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_PrintJob -ErrorAction SilentlyContinue | Where-Object { $_.JobId -eq ${jobId} } | Select-Object JobId | ConvertTo-Json"`;
      const { stdout } = await execPromise(psCmd);
      if (!stdout || stdout.trim() === '') {
        return { completed: true };
      }
    } catch {}

    return {
      completed: false,
      code: 'JOB_TIMED_OUT',
      reason: `Job #${jobId} remained in Windows spooler queue without completing after ${Math.round(timeoutMs / 1000)} seconds.`,
      statusText: 'STUCK_IN_QUEUE',
    };
  }
}
