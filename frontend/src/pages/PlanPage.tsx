import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DiscoverySearchPanel,
  type DiscoverySearchPreset,
} from '../components/AppLayout'

const pendingLandingSearchKey = 'zumers.pendingLandingSearch'

export function PlanPage() {
  const routerLocation = useLocation()
  const [preset, setPreset] = useState<DiscoverySearchPreset | undefined>(() =>
    readPendingDiscoveryPreset((routerLocation.state as PlanLocationState | null)?.discoveryPreset),
  )

  useEffect(() => {
    setPreset(readPendingDiscoveryPreset((routerLocation.state as PlanLocationState | null)?.discoveryPreset))
  }, [routerLocation.key, routerLocation.state])

  return (
    <section className="plan-page plan-search-page">
      <DiscoverySearchPanel preset={preset} title="Search plans" />
    </section>
  )
}

type PlanLocationState = {
  discoveryPreset?: Partial<DiscoverySearchPreset>
}

function readPendingDiscoveryPreset(incoming?: Partial<DiscoverySearchPreset>) {
  if (incoming) {
    sessionStorage.removeItem(pendingLandingSearchKey)
  }
  const parsed = incoming ?? readStoredDiscoveryPreset()
  if (!parsed) return undefined
  const hasLocation = typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number'
  if (!parsed.query && !parsed.chips?.length && !hasLocation) return undefined

  return {
    autoRun: parsed.autoRun ?? true,
    chips: parsed.chips ?? [],
    key: parsed.key ?? Date.now(),
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    query: parsed.query ?? '',
    radiusKm: parsed.radiusKm,
  }
}

function readStoredDiscoveryPreset() {
    try {
      const raw = sessionStorage.getItem(pendingLandingSearchKey)
      if (!raw) return undefined
      sessionStorage.removeItem(pendingLandingSearchKey)
      return JSON.parse(raw) as Partial<DiscoverySearchPreset>
    } catch {
      sessionStorage.removeItem(pendingLandingSearchKey)
      return undefined
    }
}
