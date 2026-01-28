'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { getApiKey, setApiKey, hasApiKey, isValidApiKeyFormat } from '@/lib/case-dev/api-key';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeySet: () => void;
}

export function ApiKeyModal({ isOpen, onClose, onApiKeySet }: ApiKeyModalProps) {
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load existing API key if present
  useEffect(() => {
    if (isOpen) {
      const existingKey = getApiKey();
      if (existingKey) {
        setApiKeyValue(existingKey);
      }
    }
  }, [isOpen]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const trimmedKey = apiKeyValue.trim();

    if (!trimmedKey) {
      setError('Please enter your API key');
      setLoading(false);
      return;
    }

    // Client-side validation
    const validation = isValidApiKeyFormat(trimmedKey);
    if (!validation.valid) {
      setError(validation.error || 'Invalid API key format');
      setLoading(false);
      return;
    }

    try {
      // Server-side verification
      const response = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmedKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to verify API key');
        setLoading(false);
        return;
      }

      // Key verified successfully, save it
      setApiKey(trimmedKey);
      setSuccess(true);

      // Brief delay to show success state
      setTimeout(() => {
        onApiKeySet();
        onClose();
        setSuccess(false);
      }, 800);
    } catch (err) {
      console.error('Error verifying API key:', err);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={hasApiKey() ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4">
        <Card>
          <CardHeader>
            <CardTitle>Connect case.dev Account</CardTitle>
            <CardDescription>
              Enter your case.dev API key to enable document processing, OCR, and translation features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>API key verified and connected successfully!</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="api-key">case.dev API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="sk_case_..."
                value={apiKeyValue}
                onChange={(e) => {
                  setApiKeyValue(e.target.value);
                  setError(null);
                }}
                disabled={loading || success}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apiKeyValue) {
                    handleConnect();
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://console.case.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  console.case.dev
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </p>
            </div>

            <Button onClick={handleConnect} disabled={!apiKeyValue || loading || success} className="w-full">
              {loading ? 'Verifying...' : success ? 'Connected!' : 'Connect case.dev'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your API key is stored locally in your browser and never sent to our servers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ApiKeyModal;
