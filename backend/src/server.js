import app from './app.js';
import { config } from './config/env.js';

const PORT = config.port || 5001;

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Environment: ${config.nodeEnv}`);
});
