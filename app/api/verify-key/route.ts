import { NextRequest, NextResponse } from 'next/server';

const CASE_API_BASE = 'https://api.case.dev';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();

    // Validate format
    if (!trimmedKey.startsWith('sk_case_')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Key should start with sk_case_' },
        { status: 400 }
      );
    }

    if (trimmedKey.length < 20) {
      return NextResponse.json(
        { error: 'API key is too short' },
        { status: 400 }
      );
    }

    // Verify API key by listing vaults (lightweight operation)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${CASE_API_BASE}/vault`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: 'API key verified successfully',
        });
      }

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your key and try again.' },
          { status: 401 }
        );
      }

      if (response.status === 403) {
        return NextResponse.json(
          { error: 'API key does not have permission to access vaults.' },
          { status: 403 }
        );
      }

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait a moment and try again.' },
          { status: 429 }
        );
      }

      // Try to get error message from response
      let errorMessage = `API verification failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error || errorData.message) {
          errorMessage = errorData.error || errorData.message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. Please check your connection and try again.' },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('Error verifying API key:', error);
    return NextResponse.json(
      { error: 'Failed to verify API key. Please try again.' },
      { status: 500 }
    );
  }
}
