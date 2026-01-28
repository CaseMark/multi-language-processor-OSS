'use client';

/**
 * API Key Management for Case.dev
 * 
 * Stores the Case.dev API key in localStorage for client-side use.
 * The key is passed to API routes via headers for server-side operations.
 */

const API_KEY_STORAGE_KEY = 'case_api_key';

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get the stored API key from localStorage
 */
export function getApiKey(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

/**
 * Store the API key in localStorage
 */
export function setApiKey(apiKey: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
}

/**
 * Remove the API key from localStorage
 */
export function clearApiKey(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

/**
 * Check if an API key is stored
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * Validate API key format
 * Must start with 'sk_case_' and be the appropriate length (typically 40+ chars)
 */
export function isValidApiKeyFormat(apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmedKey = apiKey.trim();

  if (!trimmedKey.startsWith('sk_case_')) {
    return { valid: false, error: 'API key must start with sk_case_' };
  }

  // sk_case_ is 8 chars, typical key is around 40-50 chars total
  if (trimmedKey.length < 20) {
    return { valid: false, error: 'API key is too short' };
  }

  if (trimmedKey.length > 100) {
    return { valid: false, error: 'API key is too long' };
  }

  return { valid: true };
}

/**
 * Get last 4 characters of API key for display
 */
export function getApiKeyLast4(apiKey: string): string {
  if (!apiKey || apiKey.length < 4) return '****';
  return apiKey.slice(-4);
}

/**
 * Get headers with API key for fetch requests
 */
export function getAuthHeaders(): Record<string, string> {
  const apiKey = getApiKey();
  if (!apiKey) return {};
  return {
    'X-Case-Api-Key': apiKey,
  };
}

/**
 * Make an authenticated fetch request to internal API routes
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured. Please log in first.');
  }

  const headers = new Headers(options.headers);
  headers.set('X-Case-Api-Key', apiKey);

  return fetch(url, {
    ...options,
    headers,
  });
}
