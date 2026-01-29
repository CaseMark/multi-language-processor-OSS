import { NextRequest, NextResponse } from 'next/server';

/**
 * OCR API Route
 * 
 * Handles document OCR processing using Case.dev OCR API.
 * Supports submitting documents for processing and retrieving results.
 */

const CASE_API_BASE = 'https://api.case.dev';

// Helper to get API key from request headers
function getApiKeyFromRequest(request: NextRequest): string | null {
  return request.headers.get('X-Case-Api-Key');
}

/**
 * POST /api/ocr
 *
 * Submit a document for OCR processing or retrieve results.
 *
 * Body for submitting:
 * {
 *   action: 'process',
 *   documentUrl: string,
 *   engine?: 'doctr' | 'paddleocr'
 * }
 *
 * Body for checking status:
 * {
 *   action: 'status',
 *   jobId: string
 * }
 *
 * Body for downloading results (call after status is 'completed'):
 * {
 *   action: 'download',
 *   jobId: string,
 *   format?: 'text' | 'json' | 'pdf'
 * }
 */
export async function POST(request: NextRequest) {
  const apiKey = getApiKeyFromRequest(request);
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required. Please log in first.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'process': {
        const { documentUrl, engine = 'doctr' } = body;
        
        if (!documentUrl) {
          return NextResponse.json(
            { error: 'documentUrl is required' },
            { status: 400 }
          );
        }

        const response = await fetch(`${CASE_API_BASE}/ocr/v1/process`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            document_url: documentUrl,
            engine,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[OCR] Process error:', errorData);
          return NextResponse.json(
            { error: errorData.message || 'Failed to submit document for OCR' },
            { status: response.status }
          );
        }

        const result = await response.json();
        return NextResponse.json(result);
      }

      case 'status':
      case 'retrieve': {
        // 'retrieve' is kept for backwards compatibility, but 'status' is preferred
        const { jobId } = body;

        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400 }
          );
        }

        const response = await fetch(`${CASE_API_BASE}/ocr/v1/${jobId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[OCR] Status error:', errorData);
          return NextResponse.json(
            { error: errorData.message || 'Failed to retrieve OCR job status' },
            { status: response.status }
          );
        }

        const result = await response.json();
        return NextResponse.json(result);
      }

      case 'download': {
        const { jobId, format = 'text' } = body;

        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400 }
          );
        }

        if (!['text', 'json', 'pdf'].includes(format)) {
          return NextResponse.json(
            { error: 'format must be one of: text, json, pdf' },
            { status: 400 }
          );
        }

        const response = await fetch(`${CASE_API_BASE}/ocr/v1/${jobId}/download/${format}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[OCR] Download error:', errorData);
          return NextResponse.json(
            { error: errorData.message || 'Failed to download OCR results' },
            { status: response.status }
          );
        }

        if (format === 'text') {
          const text = await response.text();
          return NextResponse.json({ text });
        }

        // For json format, return the parsed JSON
        if (format === 'json') {
          const result = await response.json();
          return NextResponse.json(result);
        }

        // For pdf format, return the binary data as base64
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        return NextResponse.json({ pdf: base64 });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use 'process', 'status', or 'download'.` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[OCR] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR processing failed' },
      { status: 500 }
    );
  }
}
