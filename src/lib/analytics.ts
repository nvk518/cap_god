import type { AnalyticsEventName } from './analyticsEvents'

export { AnalyticsEvent } from './analyticsEvents'
export type { AnalyticsEventName } from './analyticsEvents'

type AnalyticsValue = string | number | boolean

type AnalyticsParams = Record<string, AnalyticsValue | undefined>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function gtag(...args: unknown[]): void {
  if (typeof window.gtag === 'function') {
    window.gtag(...args)
  }
}

function cleanParams(params?: AnalyticsParams): Record<string, AnalyticsValue> | undefined {
  if (!params) {
    return undefined
  }

  const cleaned: Record<string, AnalyticsValue> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      cleaned[key] = value
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined
}

export function trackEvent(eventName: string, params?: AnalyticsParams): void {
  gtag('event', eventName, cleanParams(params))
}

export function trackButtonClick(eventName: AnalyticsEventName, params?: AnalyticsParams): void {
  trackEvent(eventName, params)
}
