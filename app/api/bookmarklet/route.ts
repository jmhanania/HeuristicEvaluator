import { NextRequest, NextResponse } from 'next/server'

// Returns the tiny bookmarklet loader snippet.
// The user drags the rendered link to their bookmarks bar.
// Clicking it injects a <script> that fetches the full bookmarklet script
// from the server, which avoids the ~2 KB browser limit on javascript: URLs
// and ensures the script always reflects the current server origin.

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin

  // The loader is a minimal IIFE that appends a <script> tag.
  // ?t= cache-busts the script fetch so hot-reloaded changes are picked up.
  const loaderCode = [
    '(function(){',
    'var s=document.createElement("script");',
    's.src="' + origin + '/api/bookmarklet-script?t="+Date.now();',
    'document.head.appendChild(s);',
    '})()',
  ].join('')

  const bookmarkletHref = 'javascript:' + encodeURIComponent(loaderCode)

  // Return an HTML page with a draggable link. The app's Settings page
  // renders this in an iframe or fetches and displays it inline.
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Install Bookmarklet</title></head>
<body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#e2e8f0;">
  <p style="margin-bottom:16px;font-size:14px;color:#94a3b8;">
    Drag the button below to your bookmarks bar, then click it on any page you want to audit.
  </p>
  <a href="${bookmarkletHref}"
     style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;
            border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;
            cursor:grab;"
     onclick="return false;">
    &#128203; HeuristicEvaluator
  </a>
  <p style="margin-top:16px;font-size:12px;color:#475569;">
    Server: <code style="color:#94a3b8;">${origin}</code>
  </p>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
