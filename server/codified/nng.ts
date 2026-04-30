import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { ulid } from 'ulid'
import type { NewFinding } from '@/db/schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PartialFinding = Omit<NewFinding, 'id' | 'stepId' | 'createdAt' | 'scanId'>

function finding(partial: PartialFinding): PartialFinding {
  return partial
}

function hasLabel($: cheerio.CheerioAPI, el: Element): boolean {
  const $el = $(el)
  const id = $el.attr('id')
  const ariaLabel = $el.attr('aria-label')
  const ariaLabelledBy = $el.attr('aria-labelledby')
  const wrappingLabel = $el.closest('label').length > 0
  const explicitLabel = id ? $(`label[for="${id}"]`).length > 0 : false
  return !!(ariaLabel || ariaLabelledBy || wrappingLabel || explicitLabel)
}

// ---------------------------------------------------------------------------
// Individual checks
// Each returns PartialFinding[] — empty array means no violation found.
// ---------------------------------------------------------------------------

// H5: Every non-hidden, non-button input must have an accessible label.
function checkInputLabels($: cheerio.CheerioAPI): PartialFinding[] {
  const results: PartialFinding[] = []
  const unlabelledSelectors: string[] = []

  $('input').each((_, el) => {
    const type = ($(el).attr('type') ?? 'text').toLowerCase()
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return
    if (hasLabel($, el)) return

    const id = $(el).attr('id')
    const name = $(el).attr('name')
    const selector = id
      ? `input#${id}`
      : name
        ? `input[name="${name}"]`
        : `input[type="${type}"]`

    unlabelledSelectors.push(selector)
  })

  if (unlabelledSelectors.length > 0) {
    results.push(
      finding({
        source: 'codified',
        status: 'confirmed',
        framework: 'nng',
        heuristicId: 5,
        baymardCategory: null,
        wcagCriterion: '1.3.1',
        wcagLevel: 'A',
        generatedByProfile: 'nng',
        title: `${unlabelledSelectors.length} input(s) missing accessible labels`,
        description: `The following inputs have no <label>, aria-label, or aria-labelledby: ${unlabelledSelectors.slice(0, 5).join(', ')}${unlabelledSelectors.length > 5 ? ` and ${unlabelledSelectors.length - 5} more` : ''}.`,
        recommendation:
          'Add a visible <label for="inputId"> or aria-label to every input. Placeholder text is not a substitute — it disappears on focus and is not reliably announced by screen readers.',
        severity: 'major',
        evidenceSelector: unlabelledSelectors[0],
        evidenceDomSnippet: null,
        evidenceBbox: null,
        aiConfidence: null,
        dismissReason: null,
        rejectionReason: null,
      }),
    )
  }

  return results
}

// H5: Inputs that use placeholder as the only label (label exists but is
// visually hidden via placeholder-only pattern).
function checkPlaceholderOnlyLabels($: cheerio.CheerioAPI): PartialFinding[] {
  const results: PartialFinding[] = []
  const offenders: string[] = []

  $('input[placeholder]').each((_, el) => {
    const type = ($(el).attr('type') ?? 'text').toLowerCase()
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return

    const id = $(el).attr('id')
    const ariaLabel = $(el).attr('aria-label')
    const ariaLabelledBy = $(el).attr('aria-labelledby')
    const wrappingLabel = $(el).closest('label').length > 0
    const explicitLabel = id ? $(`label[for="${id}"]`).length > 0 : false
    const hasProperLabel = !!(ariaLabel || ariaLabelledBy || wrappingLabel || explicitLabel)

    if (!hasProperLabel) {
      const selector = id ? `input#${id}` : `input[placeholder="${$(el).attr('placeholder')}"]`
      offenders.push(selector)
    }
  })

  if (offenders.length > 0) {
    results.push(
      finding({
        source: 'codified',
        status: 'confirmed',
        framework: 'nng',
        heuristicId: 5,
        baymardCategory: null,
        wcagCriterion: null,
        wcagLevel: null,
        generatedByProfile: 'nng',
        title: `${offenders.length} input(s) use placeholder as sole label`,
        description: `These inputs rely on placeholder text as their only label: ${offenders.slice(0, 3).join(', ')}. Placeholder disappears on focus, leaving the user without a label mid-entry.`,
        recommendation:
          'Add a persistent visible label above or beside each input. The placeholder can remain as an example value hint, but must not carry the labelling responsibility.',
        severity: 'major',
        evidenceSelector: offenders[0],
        evidenceDomSnippet: null,
        evidenceBbox: null,
        aiConfidence: null,
        dismissReason: null,
        rejectionReason: null,
      }),
    )
  }

  return results
}

// H6: Check for breadcrumb navigation on pages with deep hierarchy signals.
// We look for a breadcrumb landmark; its absence is flagged for AI follow-up.
function checkBreadcrumbs($: cheerio.CheerioAPI): PartialFinding[] {
  const hasBreadcrumb =
    $('[aria-label*="breadcrumb" i]').length > 0 ||
    $('[class*="breadcrumb" i]').length > 0 ||
    $('nav ol li + li').length > 0 ||
    $('[role="navigation"] ol li + li').length > 0

  // Only flag absence if the page has multiple nav levels (depth signal)
  const hasDeepNav = $('nav ul ul, nav ol ol, [role="navigation"] ul ul').length > 0
  const hasMultipleNavs = $('nav, [role="navigation"]').length > 1

  if (!hasBreadcrumb && (hasDeepNav || hasMultipleNavs)) {
    return [
      finding({
        source: 'codified',
        status: 'confirmed',
        framework: 'nng',
        heuristicId: 6,
        baymardCategory: null,
        wcagCriterion: null,
        wcagLevel: null,
        generatedByProfile: 'nng',
        title: 'No breadcrumb navigation detected on a multi-level page',
        description:
          'The page has nested navigation or multiple nav landmarks, suggesting hierarchy depth, but no breadcrumb trail was found. Users cannot determine their current location or navigate up without using the browser back button.',
        recommendation:
          'Add a breadcrumb nav with aria-label="Breadcrumb" above the page main content. Each ancestor page should be a link; the current page should be the final non-linked item with aria-current="page".',
        severity: 'minor',
        evidenceSelector: 'nav',
        evidenceDomSnippet: null,
        evidenceBbox: null,
        aiConfidence: null,
        dismissReason: null,
        rejectionReason: null,
      }),
    ]
  }

  return []
}

// H3: Dialogs and modals must have a dismiss affordance (close or cancel button).
function checkModalDismiss($: cheerio.CheerioAPI): PartialFinding[] {
  const results: PartialFinding[] = []

  $('[role="dialog"], dialog').each((_, el) => {
    const $dialog = $(el)
    const dialogId = $dialog.attr('id') ?? $dialog.attr('aria-label') ?? 'unknown'

    const hasDismiss =
      $dialog.find('button[aria-label*="close" i], button[aria-label*="dismiss" i]').length > 0 ||
      $dialog.find('button').filter((_, btn) => {
        const text = $(btn).text().trim().toLowerCase()
        return ['close', 'cancel', 'dismiss', 'no', 'back'].some(w => text.includes(w))
      }).length > 0

    if (!hasDismiss) {
      const selector = $dialog.attr('id')
        ? `[role="dialog"]#${$dialog.attr('id')}`
        : '[role="dialog"]'

      results.push(
        finding({
          source: 'codified',
          status: 'confirmed',
          framework: 'nng',
          heuristicId: 3,
          baymardCategory: null,
          wcagCriterion: null,
          wcagLevel: null,
          generatedByProfile: 'nng',
          title: `Dialog "${dialogId}" has no visible close or cancel button`,
          description: `The dialog element has no button with a close, cancel, or dismiss label. Users who trigger it accidentally have no clear escape path without using the keyboard Escape key, which is not universally known.`,
          recommendation:
            'Add a clearly labelled close button (aria-label="Close dialog") in the dialog header. For confirmation dialogs, provide both a confirm and an explicit cancel action.',
          severity: 'major',
          evidenceSelector: selector,
          evidenceDomSnippet: null,
          evidenceBbox: null,
          aiConfidence: null,
          dismissReason: null,
          rejectionReason: null,
        }),
      )
    }
  })

  return results
}

// H4: Detect inconsistent labels on submit/primary action buttons across the page.
// Multiple submit-like buttons with different labels suggest inconsistency.
function checkConsistentCTALabels($: cheerio.CheerioAPI): PartialFinding[] {
  const submitLabels: string[] = []

  $('button[type="submit"], input[type="submit"]').each((_, el) => {
    const label =
      $(el).attr('value') ??
      $(el).attr('aria-label') ??
      $(el).text().trim()
    if (label) submitLabels.push(label.toLowerCase())
  })

  const unique = new Set(submitLabels)
  if (unique.size > 2) {
    return [
      finding({
        source: 'codified',
        status: 'confirmed',
        framework: 'nng',
        heuristicId: 4,
        baymardCategory: null,
        wcagCriterion: null,
        wcagLevel: null,
        generatedByProfile: 'nng',
        title: `Submit buttons use ${unique.size} different labels on the same page`,
        description: `Found these submit button labels: "${[...unique].join('", "')}". Multiple distinct labels for the same action type signals inconsistency and can confuse users about which action does what.`,
        recommendation:
          'Standardise primary action button labels. Use one consistent verb ("Save", "Continue", "Submit") throughout a flow. Vary labels only when actions are meaningfully different.',
        severity: 'minor',
        evidenceSelector: 'button[type="submit"]',
        evidenceDomSnippet: null,
        evidenceBbox: null,
        aiConfidence: null,
        dismissReason: null,
        rejectionReason: null,
      }),
    ]
  }

  return []
}

// H9: Check that error messages appear inline near their associated inputs,
// not only at the page level.
function checkInlineErrors($: cheerio.CheerioAPI): PartialFinding[] {
  const hasPageLevelAlert =
    $('[role="alert"], [aria-live="assertive"]').length > 0

  const hasInvalidInputs = $('[aria-invalid="true"]').length > 0

  if (!hasInvalidInputs) return []

  // For each invalid input, check proximity of an error message
  const missingInline: string[] = []

  $('[aria-invalid="true"]').each((_, el) => {
    const $el = $(el)
    const errMsgId = $el.attr('aria-errormessage') ?? $el.attr('aria-describedby')
    const hasLinkedError = errMsgId ? $(`#${errMsgId}`).length > 0 : false
    const hasSiblingError =
      $el.next('[role="alert"], .error, [class*="error"]').length > 0 ||
      $el.prev('[role="alert"], .error, [class*="error"]').length > 0

    if (!hasLinkedError && !hasSiblingError) {
      const id = $el.attr('id')
      const name = $el.attr('name')
      missingInline.push(id ? `#${id}` : name ? `[name="${name}"]` : '[aria-invalid="true"]')
    }
  })

  if (missingInline.length > 0 && hasPageLevelAlert) {
    return [
      finding({
        source: 'codified',
        status: 'confirmed',
        framework: 'nng',
        heuristicId: 9,
        baymardCategory: null,
        wcagCriterion: '3.3.1',
        wcagLevel: 'A',
        generatedByProfile: 'nng',
        title: `${missingInline.length} invalid input(s) lack inline error messages`,
        description: `These inputs are marked aria-invalid="true" but have no linked or adjacent error message: ${missingInline.slice(0, 3).join(', ')}. A page-level alert exists, but users must scan to discover which field failed.`,
        recommendation:
          'Pair each invalid input with an inline error message using aria-errormessage or aria-describedby. Place it immediately below the input. The message should name the field and explain what went wrong.',
        severity: 'major',
        evidenceSelector: missingInline[0],
        evidenceDomSnippet: null,
        evidenceBbox: null,
        aiConfidence: null,
        dismissReason: null,
        rejectionReason: null,
      }),
    ]
  }

  return []
}

// H6: Persistent navigation must be present on non-landing pages.
function checkPersistentNav($: cheerio.CheerioAPI): PartialFinding[] {
  const hasNav =
    $('nav').length > 0 ||
    $('[role="navigation"]').length > 0

  if (!hasNav) {
    return [
      finding({
        source: 'codified',
        status: 'confirmed',
        framework: 'nng',
        heuristicId: 6,
        baymardCategory: null,
        wcagCriterion: null,
        wcagLevel: null,
        generatedByProfile: 'nng',
        title: 'No navigation landmark found on this page',
        description:
          'The page has no <nav> or role="navigation" element. Users have no persistent landmark to orient themselves or move to other sections of the site.',
        recommendation:
          'Add a primary <nav aria-label="Main"> containing the site\'s top-level links. Keep it consistent across all pages.',
        severity: 'major',
        evidenceSelector: 'body',
        evidenceDomSnippet: null,
        evidenceBbox: null,
        aiConfidence: null,
        dismissReason: null,
        rejectionReason: null,
      }),
    ]
  }

  return []
}

// ---------------------------------------------------------------------------
// runChecks — public entry point
// ---------------------------------------------------------------------------

export function runNNGChecks(
  scrubbedHtml: string,
  stepId: string,
): NewFinding[] {
  const $ = cheerio.load(scrubbedHtml)

  const partials: PartialFinding[] = [
    ...checkInputLabels($),
    ...checkPlaceholderOnlyLabels($),
    ...checkBreadcrumbs($),
    ...checkModalDismiss($),
    ...checkConsistentCTALabels($),
    ...checkInlineErrors($),
    ...checkPersistentNav($),
  ]

  return partials.map(p => ({
    ...p,
    id: ulid(),
    stepId,
    scanId: null,
    createdAt: new Date(),
  }))
}
