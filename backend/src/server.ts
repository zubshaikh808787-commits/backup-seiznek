import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import printersRouter from './routes/printers';
import driversRouter from './routes/drivers';
import sdkRouter from './routes/sdk';
import firmwareRouter from './routes/firmware';
import downloadRouter from './routes/download';
import logsRouter from './routes/logs';
import settingsRouter from './routes/settings';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/printers', printersRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/sdk', sdkRouter);
app.use('/api/firmware', firmwareRouter);
app.use('/api/download', downloadRouter);
app.use('/api/logs', logsRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'HEALTHY', service: 'SEZNIK Printer Manager API', version: '1.0.0' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[SEZNIK API Server] Listening on http://localhost:${PORT}`);
  });
}

export default app;
