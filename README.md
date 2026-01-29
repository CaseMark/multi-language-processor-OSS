# Multi-Language Document Processor

A document processing application that extracts text from images and PDFs using OCR, detects the source language, and translates documents to English. Built with Next.js and powered by [Case.dev](https://case.dev) APIs.

## Features

- **Document Upload**: Drag-and-drop support for PDFs, images (PNG, JPEG, WebP), RTF, and text files
- **OCR Processing**: Extract text from scanned documents and images using Case.dev OCR
- **Language Detection**: Automatically detect the source language from 100+ supported languages
- **Translation**: Translate documents to English with chunked processing for large files
- **Split-Pane Viewer**: View original and translated text side-by-side with synchronized scrolling
- **Bilingual Search**: Search across documents in both original and translated languages
- **Certified Export**: Generate translation certificates with translator credentials

## Case.dev Primitives Used

This application demonstrates integration with the following Case.dev APIs:

| API | Endpoint | Purpose |
|-----|----------|---------|
| **OCR** | `POST /ocr/v1/process` | Submit documents for text extraction |
| | `GET /ocr/v1/:id` | Check OCR job status |
| | `GET /ocr/v1/:id/download/text` | Download extracted text |
| **Translation** | `POST /translate/v1/detect` | Detect document language |
| | `POST /translate/v1/translate` | Translate text to English |
| **Vaults** | `GET /vault` | List vaults (used for API key verification) |

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Case.dev API key ([Get one here](https://console.case.dev))

### Installation

```bash
git clone https://github.com/CaseMark/multi-language-processor-OSS.git
cd multi-language-processor-OSS
bun install
```

### Configuration

Copy the environment template:

```bash
cp .env.example .env.local
```

The app uses client-side API key storage. Users enter their Case.dev API key in the UI, which is validated and stored in the browser's localStorage.

### Run Development Server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and enter your Case.dev API key to get started.

## How It Works

1. **Upload**: User uploads a document (PDF, image, or text file)
2. **Extract**: For images and scanned PDFs, text is extracted via OCR. For digital PDFs, text is extracted client-side using PDF.js
3. **Detect**: The extracted text is sent to the language detection API
4. **Translate**: If not already in English, the text is translated in chunks (max 4000 chars per request)
5. **View**: Documents are displayed in a split-pane viewer with the original and translated text
6. **Search**: Users can search across all documents in either language
7. **Export**: Translations can be exported with a certification statement

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── ocr/          # OCR processing endpoints
│   │   ├── translate/    # Translation endpoint
│   │   ├── detect-language/
│   │   └── verify-key/   # API key validation
│   └── page.tsx          # Main application page
├── components/
│   ├── processor/        # Document processing components
│   │   ├── DocumentUpload.tsx
│   │   ├── SplitPaneViewer.tsx
│   │   ├── BilingualSearch.tsx
│   │   └── CertifiedExport.tsx
│   └── ui/               # Shadcn UI components
├── lib/
│   ├── document-processor.ts  # Client-side text extraction
│   ├── case-dev/              # API key management
│   └── types/                 # TypeScript definitions
```

## Supported Languages

The application supports 100+ languages including:

- **Western European**: Spanish, French, German, Italian, Portuguese, Dutch
- **East Asian**: Chinese (Simplified/Traditional), Japanese, Korean
- **Middle Eastern**: Arabic, Hebrew, Persian, Turkish
- **South Asian**: Hindi, Bengali, Tamil, Telugu, Urdu
- **Cyrillic**: Russian, Ukrainian, Bulgarian, Serbian

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + Shadcn UI
- **PDF Processing**: pdfjs-dist
- **Icons**: Phosphor Icons

## License

[Apache 2.0](LICENSE)
