import type { NewFinding } from '@/db/schema'
import type { AuditProfile } from '@/db/schema'
import { runNNGChecks } from './nng'

export function runCodifiedChecks(
  profile: AuditProfile,
  scrubbedHtml: string,
  stepId: string,
): NewFinding[] {
  switch (profile) {
    case 'nng':
      return runNNGChecks(scrubbedHtml, stepId)
    case 'ecommerce_baymard':
      // Baymard checks include NNG base plus ecommerce-specific rules.
      // Baymard codified checks are Phase 2b — stubbed here.
      return runNNGChecks(scrubbedHtml, stepId)
    case 'wcag22_only':
      // WCAG-only profile skips heuristic checks entirely.
      // axe-core handles WCAG; codified WCAG 2.2 checks are Phase 2b.
      return []
  }
}
