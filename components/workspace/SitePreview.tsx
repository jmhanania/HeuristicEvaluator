'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { Severity, Finding } from '@/db/schema'
import { SEVERITY_RGBA, SEVERITY_BORDER } from './SeverityBadge'

interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ActiveHighlight {
  bbox: BBox
  severity: Severity
  label: string
}

interface Props {
  screenshotUrl: string | null
  highlight: ActiveHighlight | null
  findings: Finding[]          // all findings — used to draw persistent pins
  stepUrl: string
  captureMethod: string
}

function parseBbox(raw: string | null): BBox | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    return typeof p.x === 'number' ? p : null
  } catch { return null }
}

export function SitePreview({ screenshotUrl, highlight, findings, stepUrl, captureMethod }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Findings with bboxes, assigned a stable pin number
  const pins = findings
    .filter(f => f.status !== 'dismissed' && parseBbox(f.evidenceBbox))
    .map((f, i) => ({
      number: i + 1,
      bbox: parseBbox(f.evidenceBbox)!,
      severity: f.severity as Severity,
      label: f.title,
      id: f.id,
    }))

  const draw = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img ? img.clientWidth : 0
    canvas.height = img ? img.clientHeight : 0
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!img) return

    const scaleX = img.clientWidth / (img.naturalWidth || img.clientWidth)
    const scaleY = img.clientHeight / (img.naturalHeight || img.clientHeight)

    // Draw all pins (dimmed when something else is hovered)
    const hasHover = !!highlight
    for (const pin of pins) {
      const isActive = highlight
        ? (highlight.bbox.x === pin.bbox.x && highlight.bbox.y === pin.bbox.y)
        : false
      const alpha = hasHover && !isActive ? 0.3 : 1

      const x = pin.bbox.x * scaleX
      const y = pin.bbox.y * scaleY
      const w = pin.bbox.width * scaleX
      const h = pin.bbox.height * scaleY

      ctx.globalAlpha = alpha

      // Fill rect
      ctx.fillStyle = SEVERITY_RGBA[pin.severity]
      ctx.fillRect(x, y, w, h)

      // Border
      ctx.strokeStyle = SEVERITY_BORDER[pin.severity]
      ctx.lineWidth = isActive ? 2.5 : 1.5
      ctx.strokeRect(x, y, w, h)

      // Numbered circle badge at top-left corner of bbox
      const r = 10
      const bx = Math.max(r, x)
      const by = Math.max(r, y)

      ctx.fillStyle = SEVERITY_BORDER[pin.severity]
      ctx.beginPath()
      ctx.arc(bx, by, r, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(pin.number), bx, by)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'

      ctx.globalAlpha = 1
    }

    // If hovering, draw the active highlight label pill on top
    if (highlight) {
      const { bbox, severity, label } = highlight
      const x = bbox.x * scaleX
      const y = bbox.y * scaleY

      ctx.font = 'bold 11px system-ui, sans-serif'
      const pill = label.slice(0, 48)
      const textW = ctx.measureText(pill).width
      const pillH = 18
      const pillX = Math.min(x, canvas.width - textW - 12)
      const pillY = Math.max(0, y - pillH - 2)

      ctx.fillStyle = SEVERITY_BORDER[severity]
      ctx.beginPath()
      ctx.roundRect(pillX, pillY, textW + 12, pillH, 4)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.fillText(pill, pillX + 6, pillY + 13)
    }
  }, [highlight, pins])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(img)
    return () => ro.disconnect()
  }, [draw])

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-800/60 px-3 py-2">
        <span className="truncate font-mono text-[11px] text-slate-400">{stepUrl}</span>
        <span className="ml-auto shrink-0 rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">
          {captureMethod === 'bookmarklet' ? 'bookmarklet' : 'uploaded'}
        </span>
      </div>

      {/* Screenshot + canvas overlay */}
      <div className="relative flex-1 overflow-auto">
        {screenshotUrl ? (
          <>
            <img
              ref={imgRef}
              src={screenshotUrl}
              alt="Page screenshot"
              className="block w-full"
              onLoad={draw}
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute left-0 top-0"
              style={{ width: '100%', height: '100%' }}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500 text-sm">
            No screenshot captured yet.
          </div>
        )}
      </div>
    </div>
  )
}
