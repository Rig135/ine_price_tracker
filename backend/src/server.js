import app from './app.js';
import { config } from './config/env.js';

const PORT = config.port || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`Environment: ${config.nodeEnv}`);
});
