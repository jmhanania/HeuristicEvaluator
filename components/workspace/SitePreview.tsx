'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { Severity } from '@/db/schema'
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
  stepUrl: string
  captureMethod: string
}

export function SitePreview({ screenshotUrl, highlight, stepUrl, captureMethod }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const drawHighlight = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to match the rendered image exactly
    if (img) {
      canvas.width = img.clientWidth
      canvas.height = img.clientHeight
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!highlight || !img) return

    const { bbox, severity, label } = highlight

    // Scale from screenshot pixel coords to display pixel coords.
    // img.naturalWidth is the actual pixel width of the JPEG.
    // img.clientWidth is how wide it renders on screen.
    const scaleX = img.clientWidth / (img.naturalWidth || img.clientWidth)
    const scaleY = img.clientHeight / (img.naturalHeight || img.clientHeight)

    const x = bbox.x * scaleX
    const y = bbox.y * scaleY
    const w = bbox.width * scaleX
    const h = bbox.height * scaleY

    // Fill
    ctx.fillStyle = SEVERITY_RGBA[severity]
    ctx.fillRect(x, y, w, h)

    // Border
    ctx.strokeStyle = SEVERITY_BORDER[severity]
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    // Label pill above the box
    const pill = label.slice(0, 48)
    ctx.font = 'bold 11px system-ui, sans-serif'
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
  }, [highlight])

  // Redraw on highlight change or image resize
  useEffect(() => {
    drawHighlight()
  }, [drawHighlight])

  // Resize observer so the canvas stays in sync if the panel is resized
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const ro = new ResizeObserver(() => drawHighlight())
    ro.observe(img)
    return () => ro.disconnect()
  }, [drawHighlight])

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
              onLoad={drawHighlight}
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
