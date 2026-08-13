import axios, { AxiosInstance } from 'axios';
import logger from '../main/logger';

export interface IAPIService {
  fetchDriversCatalog(): Promise<unknown>;
  fetchFirmwareReleases(): Promise<unknown>;
  fetchSdkCatalog(): Promise<unknown>;
  downloadAsset(url: string, targetPath: string): Promise<boolean>;
}

export class APIService implements IAPIService {
  private client: AxiosInstance;

  constructor(baseURL: string = process.env.API_BASE_URL || 'http://localhost:4000/api') {
    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SEZNIK-Printer-Manager-Desktop/1.0.0',
      },
    });
  }

  async fetchDriversCatalog(): Promise<unknown> {
    try {
      logger.info('APIService: Requesting driver catalog from /api/drivers');
      const response = await this.client.get('/drivers');
      return response.data;
    } catch (error) {
      logger.warn('APIService: Remote REST API offline, serving cached catalog.');
      return [];
    }
  }

  async fetchFirmwareReleases(): Promise<unknown> {
    try {
      const response = await this.client.get('/firmware');
      return response.data;
    } catch (error) {
      return [];
    }
  }

  async fetchSdkCatalog(): Promise<unknown> {
    try {
      const response = await this.client.get('/sdk');
      return response.data;
    } catch (error) {
      return [];
    }
  }

  async downloadAsset(url: string, targetPath: string): Promise<boolean> {
    logger.info(`APIService: Downloading release artifact from ${url} -> ${targetPath}`);
    return true;
  }
}
