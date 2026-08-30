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
    subtitle: 'Restaurants getting the most attention right now.',
    items: [
      {
        id: 'tonight-cafe',
        category: 'Cafe',
        title: 'The Courtyard Cafe',
        businessName: 'Quiet cafe for two',
        locality: 'Nearby',
        reason: '128 people interested',
        rating: 4.6,
        reviews: 128,
        distance: '2.4 km',
        price: 'Rs 700 for two',
        status: 'Open now',
      },
      {
        id: 'tonight-food',
        category: 'Restaurant',
        title: 'Market Table',
        businessName: 'Dinner and small plates',
        locality: 'City centre',
        reason: '245 people interested',
        rating: 4.4,
        reviews: 245,
        distance: '3.1 km',
        price: 'Rs 1,000 plan',
        offer: 'Combo offers',
      },
      {
        id: 'tonight-bistro',
        category: 'Bistro',
        title: 'Nori Street Kitchen',
        businessName: 'Asian bowls and grills',
        locality: 'Nearby',
        reason: '86 people interested',
        rating: 4.5,
        reviews: 86,
        distance: '4.8 km',
        price: 'From Rs 499',
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
        title: 'Momo Junction',
        businessName: 'Momos and chaat trail',
        locality: 'Market area',
        reason: 'Under Rs. 1000',
        rating: 4.3,
        reviews: 312,
        distance: '1.8 km',
        price: 'Under Rs 500',
      },
      {
        id: 'budget-thali',
        category: 'Restaurant',
        title: 'Daily Thali House',
        businessName: 'North Indian thali',
        locality: 'Mall road',
        reason: 'Under Rs. 1000',
        rating: 4.2,
        reviews: 94,
        distance: '5 km',
        price: 'Rs 999 plan',
      },
      {
        id: 'budget-cafe',
        category: 'Cafe',
        title: 'Bean Street Cafe',
        businessName: 'Coffee and snacks',
        locality: 'Nearby',
        reason: 'Under Rs. 1000',
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
