// Utility for formatting API responses
export interface TAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export function formatSuccessResponse<T>(data: T, message?: string): TAPIResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

export function formatErrorResponse(error: string, statusCode?: number): TAPIResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString()
  };
}

export function formatValidationErrorResponse(errors: string[]): TAPIResponse {
  return {
    success: false,
    error: 'Validation failed',
    data: { validationErrors: errors },
    timestamp: new Date().toISOString()
  };
}
