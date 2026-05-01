'use client'

import { useRef, useEffect } from 'react'
import type { Severity } from '@/db/schema'
import { SEVERITY_BORDER, SEVERITY_RGBA } from '@/components/workspace/SeverityBadge'

export interface Pin {
  number: number
  bbox: { x: number; y: number; width: number; height: number }
  severity: Severity
}

interface Props {
  screenshotUrl: string
  pins: Pin[]
}

export function PinnedScreenshot({ screenshotUrl, pins }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function draw() {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = img.clientWidth
    canvas.height = img.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scaleX = img.clientWidth / (img.naturalWidth || img.clientWidth)
    const scaleY = img.clientHeight / (img.naturalHeight || img.clientHeight)

    for (const pin of pins) {
      const x = pin.bbox.x * scaleX
      const y = pin.bbox.y * scaleY
      const w = pin.bbox.width * scaleX
      const h = pin.bbox.height * scaleY

      // Subtle fill + border
      ctx.fillStyle = SEVERITY_RGBA[pin.severity]
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = SEVERITY_BORDER[pin.severity]
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, w, h)

      // Number badge at top-left of bbox
      const badgeR = 10
      const bx = Math.max(badgeR, x)
      const by = Math.max(badgeR, y)

      ctx.fillStyle = SEVERITY_BORDER[pin.severity]
      ctx.beginPath()
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#fff'
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(pin.number), bx, by)
      ctx.textAlign = 'start'
      ctx.textBaseline = 'alphabetic'
    }
  }

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const ro = new ResizeObserver(draw)
    ro.observe(img)
    return () => ro.disconnect()
  })

  return (
    <div className="relative">
      <img
        ref={imgRef}
        src={screenshotUrl}
        alt="Step screenshot"
        className="block w-full rounded-lg"
        onLoad={draw}
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-0 top-0 rounded-lg"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
