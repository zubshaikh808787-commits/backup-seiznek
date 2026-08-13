import { SystemLogEntry } from '../shared/types';
import logger from '../main/logger';

export interface ILoggingService {
  logAction(actionType: string, message: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', details?: string): Promise<SystemLogEntry>;
  getLogHistory(): Promise<SystemLogEntry[]>;
}

export class LoggingService implements ILoggingService {
  private logHistory: SystemLogEntry[] = [
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      level: 'INFO',
      actionType: 'SYSTEM_BOOT',
      message: 'SEZNIK Printer Manager initialized cleanly.',
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 180000).toISOString(),
      level: 'INFO',
      actionType: 'USB_DETECTION',
      message: 'Connected device enumerated: SEZNIK POS-80 Ultra (VID: 0x0FE6, PID: 0x811E)',
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'INFO',
      actionType: 'DRIVER_INSTALL',
      message: 'Automated 2-in-1 Dual driver mapping completed on USB001.',
    },
  ];

  async logAction(actionType: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO', details?: string): Promise<SystemLogEntry> {
    const entry: SystemLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level,
      actionType,
      message,
      details,
    };
    this.logHistory.unshift(entry);
    
    if (level === 'ERROR') logger.error(`[${actionType}] ${message}`, { details });
    else if (level === 'WARN') logger.warn(`[${actionType}] ${message}`, { details });
    else logger.info(`[${actionType}] ${message}`, { details });

    return entry;
  }

  async getLogHistory(): Promise<SystemLogEntry[]> {
    return this.logHistory;
  }
}
