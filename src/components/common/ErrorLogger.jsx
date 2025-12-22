import { base44 } from '@/api/base44Client';

export const logError = async (errorData) => {
  try {
    const user = await base44.auth.me().catch(() => null);
    
    await base44.entities.AppError.create({
      organization_id: user?.organization_id || user?.id || 'unknown',
      user_id: user?.id,
      user_email: user?.email,
      page: errorData.page,
      action_name: errorData.action,
      error_message: errorData.error?.message || String(errorData.error),
      error_stack: errorData.error?.stack,
      metadata: {
        ...errorData.metadata,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      severity: errorData.severity || 'error'
    });
  } catch (logErr) {
    console.error('Failed to log error:', logErr);
  }
};

export const withErrorLogging = (fn, page, action) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError({ page, action, error });
      throw error;
    }
  };
};