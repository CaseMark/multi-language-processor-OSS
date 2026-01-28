/**
 * Client-side document processor for extracting text from PDFs, RTF files, text files, and images.
 * Uses pdfjs-dist for PDF text extraction, rtf-parser for RTF files, and Case.dev OCR for scanned documents/images.
 */

import { authenticatedFetch } from '@/lib/case-dev/api-key';

export interface ExtractionResult {
  text: string;
  pageCount: number;
  method: 'pdf-text' | 'plain-text' | 'rtf-text' | 'ocr';
}

// Dynamically load PDF.js
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing must be done on client side');
  }

  if (pdfjsLib) return pdfjsLib;

  pdfjsLib = await import('pdfjs-dist');
  // Use CDN worker for reliability
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  return pdfjsLib;
}

/**
 * Upload a file to Case.dev Vaults and get a download URL for OCR processing
 */
async function uploadToVaultsForOCR(file: File): Promise<string> {
  // First, get or create a vault for OCR processing
  // We'll use a default vault ID or create one if needed
  const listResponse = await authenticatedFetch('/api/vaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list-vaults' }),
  });

  let vaultId: string;

  if (listResponse.ok) {
    const vaults = await listResponse.json();
    // Look for an existing OCR vault or use the first available
    const ocrVault = vaults.vaults?.find((v: any) => v.name === 'mlp-ocr-processing');
    if (ocrVault) {
      vaultId = ocrVault.id;
    } else if (vaults.vaults?.length > 0) {
      vaultId = vaults.vaults[0].id;
    } else {
      // Create a new vault for OCR processing
      const createResponse = await authenticatedFetch('/api/vaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: 'mlp-ocr-processing',
          description: 'Vault for Multi-Language Processor OCR documents',
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create vault for OCR processing');
      }

      const newVault = await createResponse.json();
      vaultId = newVault.id;
    }
  } else {
    throw new Error('Failed to list vaults');
  }

  // Get presigned upload URL
  const uploadResponse = await authenticatedFetch('/api/vaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'upload',
      vaultId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      metadata: {
        source: 'multi-language-processor',
        purpose: 'ocr',
      },
    }),
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.error || 'Failed to get upload URL');
  }

  const { uploadUrl, objectId } = await uploadResponse.json();
  console.log(`[DocProcessor] Got upload URL for objectId: ${objectId}`);

  // Upload the file directly to the presigned URL
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error('Failed to upload file to vault');
  }

  console.log(`[DocProcessor] File uploaded to vault, fetching download URL...`);

  // Now get the download URL by calling the 'get' action
  const getResponse = await authenticatedFetch('/api/vaults', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get',
      vaultId,
      objectId,
    }),
  });

  if (!getResponse.ok) {
    const error = await getResponse.json();
    throw new Error(error.error || 'Failed to get download URL from vault');
  }

  const vaultObject = await getResponse.json();
  const downloadUrl = vaultObject.downloadUrl;

  if (!downloadUrl) {
    throw new Error('Vault object does not have a download URL');
  }

  console.log(`[DocProcessor] Got download URL: ${downloadUrl.substring(0, 50)}...`);
  return downloadUrl;
}

/**
 * Process a document using Case.dev OCR
 */
async function processWithOCR(file: File, onProgress?: (status: string) => void): Promise<ExtractionResult> {
  console.log(`[DocProcessor] Starting OCR for ${file.name}`);
  onProgress?.('Uploading document...');

  // Upload to Vaults to get a URL
  const documentUrl = await uploadToVaultsForOCR(file);

  onProgress?.('Submitting for OCR...');

  // Submit for OCR processing
  const processResponse = await authenticatedFetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'process',
      documentUrl,
      engine: 'doctr', // Best quality engine
    }),
  });

  if (!processResponse.ok) {
    const error = await processResponse.json();
    throw new Error(error.error || 'Failed to submit document for OCR');
  }

  const { id: jobId } = await processResponse.json();
  console.log(`[DocProcessor] OCR job submitted: ${jobId}`);

  onProgress?.('Processing OCR...');

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 60; // 2 minutes max
  const pollInterval = 2000; // 2 seconds

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;

    const statusResponse = await authenticatedFetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'status',
        jobId,
      }),
    });

    if (!statusResponse.ok) {
      console.warn(`[DocProcessor] OCR status check failed, attempt ${attempts}`);
      continue;
    }

    const status = await statusResponse.json();
    console.log(`[DocProcessor] OCR status: ${status.status}`);

    if (status.status === 'completed') {
      // Status is complete, now download the actual text
      onProgress?.('Downloading OCR results...');

      const downloadResponse = await authenticatedFetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'download',
          jobId,
          format: 'text',
        }),
      });

      if (!downloadResponse.ok) {
        const error = await downloadResponse.json();
        throw new Error(error.error || 'Failed to download OCR results');
      }

      const result = await downloadResponse.json();
      const text = result.text || '';
      const pageCount = status.page_count || status.pageCount || 1;

      console.log(`[DocProcessor] OCR complete: ${text.length} chars extracted, ${pageCount} pages`);

      return {
        text,
        pageCount,
        method: 'ocr',
      };
    } else if (status.status === 'failed') {
      throw new Error(status.error || 'OCR processing failed');
    }

    // Update progress
    if (status.progress) {
      onProgress?.(`Processing OCR... ${Math.round(status.progress * 100)}%`);
    }
  }

  throw new Error('OCR processing timed out');
}

/**
 * Extract text from a PDF file using pdfjs-dist (client-side)
 * Falls back to OCR if the PDF appears to be scanned/image-based
 */
async function extractTextFromPDF(file: File, onProgress?: (status: string) => void): Promise<ExtractionResult> {
  try {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;

    const textParts: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Reconstruct text with original layout using position information
      const items = textContent.items;
      let pageText = '';
      let lastY = -1;
      let lastX = -1;

      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        if (!('str' in item)) continue;

        const textItem = item as any;
        const str = textItem.str;
        if (!str) continue;

        const transform = textItem.transform;
        const x = transform[4]; // X position
        const y = transform[5]; // Y position

        // Detect line breaks based on Y position change
        if (lastY !== -1 && Math.abs(y - lastY) > 5) {
          // Significant Y change = new line
          pageText += '\n';
          lastX = -1;
        } else if (lastX !== -1 && x - lastX > 50) {
          // Large horizontal gap = likely a tab or column break
          pageText += ' ';
        } else if (lastX !== -1 && str.trim() && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
          // Add space between words if needed
          pageText += ' ';
        }

        pageText += str;
        lastY = y;
        lastX = x + (textItem.width || 0);
      }

      if (pageText.trim()) {
        textParts.push(pageText.trim());
      }
    }

    const fullText = textParts.join('\n\n');

    // If we got very little text, the PDF might be scanned/image-based - use OCR
    if (fullText.trim().length < 50 && pageCount > 0) {
      console.log('[DocProcessor] PDF appears to be scanned or image-based, using OCR');
      return processWithOCR(file, onProgress);
    }

    console.log(`[DocProcessor] Extracted ${fullText.length} chars from ${pageCount} pages`);

    return {
      text: fullText,
      pageCount,
      method: 'pdf-text',
    };
  } catch (error) {
    // If PDF extraction fails, try OCR as fallback
    if (error instanceof Error && error.message.includes('OCR')) {
      throw error; // Re-throw OCR errors
    }
    console.log('[DocProcessor] PDF extraction failed, trying OCR fallback');
    return processWithOCR(file, onProgress);
  }
}

/**
 * Extract text from a plain text file
 */
async function extractTextFromPlainText(file: File): Promise<ExtractionResult> {
  const text = await file.text();
  return {
    text,
    pageCount: 1,
    method: 'plain-text',
  };
}

/**
 * Extract text from an RTF file using rtf-parser
 */
async function extractTextFromRTF(file: File): Promise<ExtractionResult> {
  try {
    // Dynamically import rtf-parser
    const parseRTF = await import('rtf-parser');
    const rtfString = await file.text();

    // Parse RTF using callback-based API wrapped in a promise
    const rtfDoc = await new Promise<any>((resolve, reject) => {
      parseRTF.default.string(rtfString, (err: Error | null, doc: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc);
        }
      });
    });

    // Extract plain text from RTF document
    // Structure: RTFDocument -> paragraphs -> spans with 'value' property
    const textParts: string[] = [];

    if (rtfDoc.content && Array.isArray(rtfDoc.content)) {
      for (const paragraph of rtfDoc.content) {
        const paragraphText: string[] = [];

        if (paragraph.content && Array.isArray(paragraph.content)) {
          for (const span of paragraph.content) {
            // RTFSpan objects have a 'value' property with the text
            if (span.value) {
              paragraphText.push(span.value);
            }
          }
        }

        // Join spans in a paragraph and add to text parts
        if (paragraphText.length > 0) {
          textParts.push(paragraphText.join(''));
        }
      }
    }

    // Join paragraphs with newlines
    const text = textParts.join('\n');

    console.log(`[DocProcessor] Extracted ${text.length} chars from RTF (${textParts.length} paragraphs)`);

    return {
      text: text.trim(),
      pageCount: 1,
      method: 'rtf-text',
    };
  } catch (error) {
    console.error('[DocProcessor] RTF extraction error:', error);
    throw new Error('Failed to extract text from RTF file. Please ensure the file is a valid RTF document.');
  }
}

/**
 * Extract text from an image using OCR
 */
async function extractTextFromImage(file: File, onProgress?: (status: string) => void): Promise<ExtractionResult> {
  console.log(`[DocProcessor] Processing image with OCR: ${file.name}`);
  return processWithOCR(file, onProgress);
}

/**
 * Convert a file to base64 for server-side OCR
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Main function to process a document.
 * Returns extracted text, using OCR for scanned documents and images.
 */
export async function processDocument(
  file: File,
  onProgress?: (status: string) => void
): Promise<ExtractionResult> {
  const mimeType = file.type;
  const fileName = file.name.toLowerCase();

  console.log(`[DocProcessor] Processing ${file.name} (${mimeType})`);

  if (mimeType === 'text/plain') {
    return extractTextFromPlainText(file);
  }

  if (mimeType === 'application/pdf') {
    return extractTextFromPDF(file, onProgress);
  }

  // Handle RTF files (MIME type can be application/rtf or text/rtf, or empty for .rtf files)
  if (mimeType === 'application/rtf' || mimeType === 'text/rtf' || fileName.endsWith('.rtf')) {
    return extractTextFromRTF(file);
  }

  // Handle images - use OCR
  if (mimeType.startsWith('image/') || 
      fileName.endsWith('.png') || 
      fileName.endsWith('.jpg') || 
      fileName.endsWith('.jpeg') || 
      fileName.endsWith('.webp')) {
    return extractTextFromImage(file, onProgress);
  }

  throw new Error(`Unsupported file type: ${mimeType}. Supported: PDF, RTF, TXT, and images (PNG, JPEG, WebP).`);
}
