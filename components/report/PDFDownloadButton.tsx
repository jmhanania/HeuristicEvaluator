'use client'

import dynamic from 'next/dynamic'
import type { PDFDocumentProps } from './PDFDocument'

// Load the entire button (including react-pdf) only on the client.
// A single ssr:false boundary avoids the double-dynamic issue where
// PDFDownloadLink receives a null document during the loading phase.
const PDFDownloadButtonInner = dynamic(
  () => import('./PDFDownloadButtonInner').then(m => m.PDFDownloadButtonInner),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-500 print:hidden"
      >
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading PDF...
      </button>
    ),
  },
)

interface Props extends PDFDocumentProps {
  filename: string
}

export function PDFDownloadButton(props: Props) {
  return <PDFDownloadButtonInner {...props} />
}
