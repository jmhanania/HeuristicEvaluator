// Direct (non-dynamic) import of react-pdf — only safe in browser context.
// This file is always loaded via dynamic import with ssr:false.
import { PDFDownloadLink } from '@react-pdf/renderer'
import { AuditPDFDocument } from './PDFDocument'
import type { PDFDocumentProps } from './PDFDocument'

interface Props extends PDFDocumentProps {
  filename: string
}

export function PDFDownloadButtonInner({ filename, ...docProps }: Props) {
  return (
    <PDFDownloadLink
      document={<AuditPDFDocument {...docProps} />}
      fileName={filename}
      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white print:hidden"
    >
      {({ loading, error }) =>
        error ? (
          <span className="text-red-400">PDF error</span>
        ) : loading ? (
          <>
            <svg className="h-4 w-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Building PDF...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Download PDF
          </>
        )
      }
    </PDFDownloadLink>
  )
}
