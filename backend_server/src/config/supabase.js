const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

let supabaseClient = null;

/**
 * Initialize and return Supabase client
 * @returns {Object} Supabase client instance
 */
const getSupabaseClient = () => {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error('Supabase configuration missing');
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      }
    });

    logger.info('Supabase client initialized successfully');
    return supabaseClient;
  } catch (error) {
    logger.error('Failed to initialize Supabase client:', error);
    throw error;
  }
};

/**
 * Test Supabase connection
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.from('users').select('count').limit(1);
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet
      throw error;
    }
    
    logger.info('Supabase connection test successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection test failed:', error);
    return false;
  }
};

module.exports = {
  getSupabaseClient,
  testConnection
};
