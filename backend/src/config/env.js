import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  cronSecret: process.env.CRON_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-cron-secret'),
  mockStoreUrl: process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com'
};
