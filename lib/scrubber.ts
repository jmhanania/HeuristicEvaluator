import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'

// Tags we keep in the scrubbed output. Everything else is unwrapped (children
// promoted) rather than deleted, so text content is never lost.
const KEPT_TAGS = new Set([
  // Structure
  'html', 'body', 'main', 'nav', 'header', 'footer', 'section', 'article',
  'aside', 'form', 'fieldset', 'legend', 'ul', 'ol', 'li', 'table', 'thead',
  'tbody', 'tr', 'td', 'th', 'caption', 'dialog', 'details', 'summary',
  'div', 'span',
  // Interactive
  'a', 'button', 'input', 'select', 'textarea', 'label', 'option', 'optgroup',
  // Content
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'time', 'abbr',
  'img', 'figure', 'figcaption', 'blockquote', 'code', 'pre',
  // Shadow DOM convention: bookmarklet wraps shadow roots in this tag
  'shadow-boundary',
])

// Attributes we keep. Everything else is stripped.
const KEPT_ATTRIBUTES = new Set([
  'id', 'class', 'role', 'type', 'name', 'for', 'href', 'alt',
  'placeholder', 'required', 'disabled', 'checked', 'selected', 'readonly',
  'action', 'method', 'enctype', 'target', 'multiple', 'step',
  'min', 'max', 'minlength', 'maxlength', 'pattern', 'autocomplete', 'inputmode',
  // ARIA
  'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-required',
  'aria-invalid', 'aria-expanded', 'aria-haspopup', 'aria-controls',
  'aria-live', 'aria-busy', 'aria-atomic', 'aria-relevant', 'aria-hidden',
  'aria-current', 'aria-selected', 'aria-checked', 'aria-modal',
  'aria-orientation', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow',
  'aria-errormessage', 'aria-details',
  // Shadow boundary metadata (set by bookmarklet)
  'data-shadow-host',
])

// Tags removed entirely (children also discarded).
const REMOVE_TAGS = [
  'script', 'style', 'link', 'meta', 'noscript', 'template',
  'object', 'embed', 'iframe',
]

export interface ScrubResult {
  scrubbed: string
  stats: {
    removedElements: number
    strippedAttributes: number
    shadowBoundariesFound: number
  }
}

// ---------------------------------------------------------------------------
// scrubHtml
// Processes serialized HTML received from the bookmarklet. At this point
// Shadow DOM has already been flattened by the bookmarklet's live-DOM walker
// and injected as <shadow-boundary> elements. This function strips noise and
// normalises attributes for LLM consumption.
// ---------------------------------------------------------------------------
export function scrubHtml(rawHtml: string): ScrubResult {
  const $ = cheerio.load(rawHtml)
  let removedElements = 0
  let strippedAttributes = 0
  const shadowBoundariesFound = $('shadow-boundary').length

  // Pass 1: remove noise tags wholesale (children included)
  REMOVE_TAGS.forEach(tag => {
    const count = $(tag).length
    $(tag).remove()
    removedElements += count
  })

  // Pass 2: remove SVGs that are decorative (more than 10 child nodes)
  $('svg').each((_, el) => {
    if ($(el).find('*').length > 10) {
      $(el).remove()
      removedElements++
    }
  })

  // Pass 3: strip base64 src (embedded images, fonts)
  $('[src]').each((_, el) => {
    const src = $(el).attr('src') ?? ''
    if (src.startsWith('data:')) {
      $(el).removeAttr('src')
      strippedAttributes++
    }
  })

  // Pass 4: strip form field values (PII prevention)
  $('input, textarea').each((_, el) => {
    $(el).removeAttr('value')
    strippedAttributes++
  })

  // Pass 5: strip all data-* except our shadow-boundary marker
  $('*').each((_, el) => {
    const attribs = { ...((el as Element).attribs ?? {}) }
    for (const attr of Object.keys(attribs)) {
      if (attr.startsWith('data-') && attr !== 'data-shadow-host') {
        $(el).removeAttr(attr)
        strippedAttributes++
      }
    }
  })

  // Pass 6: normalise href — strip query params longer than 20 chars (token heuristic)
  $('[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    try {
      const url = new URL(href, 'https://x.invalid')
      const clean = new URLSearchParams()
      url.searchParams.forEach((v, k) => {
        if (v.length <= 20) clean.set(k, v)
      })
      const qs = clean.toString()
      $(el).attr('href', url.pathname + (qs ? `?${qs}` : ''))
    } catch {
      // Relative or malformed URL — leave as-is
    }
  })

  // Pass 7: unwrap non-structural tags (keep children, discard the wrapper)
  // We iterate bottom-up so parent unwraps don't disrupt children.
  $('*')
    .toArray()
    .reverse()
    .forEach(el => {
      const tag = (el as Element).tagName?.toLowerCase()
      if (tag && !KEPT_TAGS.has(tag)) {
        $(el).replaceWith($(el).contents())
        removedElements++
      }
    })

  // Pass 8: strip disallowed attributes from surviving elements
  $('*').each((_, el) => {
    const attribs = { ...((el as Element).attribs ?? {}) }
    for (const attr of Object.keys(attribs)) {
      if (!KEPT_ATTRIBUTES.has(attr)) {
        $(el).removeAttr(attr)
        strippedAttributes++
      }
    }
  })

  return {
    scrubbed: $.html(),
    stats: { removedElements, strippedAttributes, shadowBoundariesFound },
  }
}

// ---------------------------------------------------------------------------
// selectorExists
// Used by analyze.ts to validate Gemini's evidence_selector against the
// scrubbed DOM before accepting a finding.
// ---------------------------------------------------------------------------
export function selectorExists(scrubbedHtml: string, selector: string): boolean {
  try {
    const $ = cheerio.load(scrubbedHtml)
    return $(selector).length > 0
  } catch {
    return false
  }
}
