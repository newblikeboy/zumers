import type { DiscoverySearchResult } from './types'

export type DiscoveryShowcaseItem = {
  id: string
  category: string
  title: string
  businessName: string
  locality: string
  reason: string
  rating?: number
  reviews?: number
  distance?: string
  price?: string
  status?: string
  offer?: string
  dateLabel?: string
  imageUrl?: string
  source?: DiscoverySearchResult
}

export type DiscoverySectionData = {
  id: string
  title: string
  subtitle: string
  items: DiscoveryShowcaseItem[]
}

// Temporary fallback content until Zumers has dedicated recommendation APIs.
// Search API results are mapped into these sections first whenever available.
export const discoveryDemoSections: DiscoverySectionData[] = [
  {
    id: 'tonight',
    title: 'In the spotlight',
    subtitle: 'Events, dining, and activities worth opening first.',
    items: [
      {
        id: 'tonight-cafe',
        category: 'Cafe',
        title: 'Quiet cafe for two',
        businessName: 'Zumers pick',
        locality: 'Nearby',
        reason: 'Popular for date nights',
        rating: 4.6,
        reviews: 128,
        distance: '2.4 km',
        price: 'Rs 700 for two',
        status: 'Open now',
      },
      {
        id: 'tonight-food',
        category: 'Food',
        title: 'Dinner with friends',
        businessName: 'Zumers pick',
        locality: 'City centre',
        reason: 'Good for groups',
        rating: 4.4,
        reviews: 245,
        distance: '3.1 km',
        price: 'Rs 1,000 plan',
        offer: 'Combo offers',
      },
      {
        id: 'tonight-music',
        category: 'Live Events',
        title: 'Acoustic night out',
        businessName: 'Zumers events',
        locality: 'Nearby',
        reason: 'Trending this weekend',
        rating: 4.5,
        reviews: 86,
        distance: '4.8 km',
        price: 'From Rs 499',
        dateLabel: 'Sat',
      },
    ],
  },
  {
    id: 'budget',
    title: 'Great plans under Rs 1,000',
    subtitle: 'Budget-friendly picks that still feel planned.',
    items: [
      {
        id: 'budget-street-food',
        category: 'Street Food',
        title: 'Momos and chaat trail',
        businessName: 'Local favourites',
        locality: 'Market area',
        reason: 'Best with friends',
        rating: 4.3,
        reviews: 312,
        distance: '1.8 km',
        price: 'Under Rs 500',
      },
      {
        id: 'budget-games',
        category: 'Activities',
        title: 'Bowling and snacks',
        businessName: 'Zumers activity',
        locality: 'Mall road',
        reason: 'Works for groups',
        rating: 4.2,
        reviews: 94,
        distance: '5 km',
        price: 'Rs 999 plan',
      },
      {
        id: 'budget-wellness',
        category: 'Wellness',
        title: 'Evening wellness reset',
        businessName: 'Zumers calm',
        locality: 'Nearby',
        reason: 'Peaceful after work',
        rating: 4.7,
        reviews: 64,
        distance: '2.9 km',
        price: 'From Rs 399',
      },
    ],
  },
  {
    id: 'weekend',
    title: 'Events this weekend',
    subtitle: 'Comedy, music, workshops, and local experiences to shortlist.',
    items: [
      {
        id: 'weekend-comedy',
        category: 'Comedy',
        title: 'Stand-up night',
        businessName: 'Weekend stage',
        locality: 'Arts district',
        reason: 'Good for two people',
        rating: 4.5,
        reviews: 146,
        distance: '6.2 km',
        price: 'From Rs 399',
        dateLabel: 'Sun',
      },
      {
        id: 'weekend-workshop',
        category: 'Workshop',
        title: 'Pottery and coffee',
        businessName: 'Creative studio',
        locality: 'Old town',
        reason: 'Relaxed weekend plan',
        rating: 4.8,
        reviews: 72,
        distance: '4.4 km',
        price: 'From Rs 899',
        dateLabel: 'Sat',
      },
    ],
  },
]
