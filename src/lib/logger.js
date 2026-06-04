const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  info: (...args) => {
    if (!isProd) console.log('[INFO]', ...args);
  },
  warn: (...args) => {
    console.warn('[WARN]', new Date().toISOString(), ...args);
  },
  error: (message, error) => {
    if (error) {
      console.error('[ERROR]', new Date().toISOString(), message, {
        message: error?.message,
        stack: isProd ? undefined : error?.stack,
      });
    } else {
      console.error('[ERROR]', new Date().toISOString(), message);
    }
  },
};
