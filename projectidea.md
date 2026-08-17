# Zumers Project Idea

## Core Idea

Zumers is built around one question:

```text
Never wonder what to do today?
```

The platform should help users decide what to do based on mood, location,
friends, offers, and nearby available options.

The Facebook-like social features are an engagement layer, not the core
business. Feed, friends, groups, chat, voting, reactions, and sharing exist so
users can discuss plans and make decisions together.

The core business is discovery and decision-making.

## User Flow Vision

The top search button in the logged-in user interface is reserved for the core
experience.

Example:

```text
mera mood aaj khane ka kar raha hai
```

When a user searches this, Zumers should understand the intent and show nearby
good options, such as restaurants, street food vendors, cafes, offers, events,
travel options, or local activities.

The result should consider:

- User location
- User mood or intent
- Business category and tags
- Distance
- Active offers
- Opening status
- Popularity and engagement
- Friends' activity later
- Group preferences later

If the user selects a restaurant, event, or vendor, they should be able to share
it with friends or groups. Friends can vote, suggest another option, or discuss
the plan in chat.

## Business Side Principle

Businesses will not use the normal user interface.

Every business will manage itself only through the business login and dashboard.
The business dashboard is where vendors provide the structured data that the
future user-facing discovery algorithm will consume.

Business accounts can include:

- Street food vendors
- Restaurants
- Cafes
- Travel providers
- Event hosts
- Local service providers
- Larger venues or premium businesses

The product should support small street vendors and large businesses in the same
system.

## Business Dashboard Purpose

The business dashboard must become the data engine for user discovery.

A business should be able to manage:

- Business identity
- Category and subcategory
- Location and service area
- Exact address and map data
- Contact details
- Description
- Offerings, menu, packages, services, or events
- Opening hours
- Today's update
- Active offers
- Media such as cover photo, gallery, menu, or videos
- Booking/contact preferences
- Availability
- Verification/onboarding status

This data should later power user search, recommendations, maps, group sharing,
booking, and analytics.

## Recommendation Logic Direction

The future discovery algorithm should match user intent to business data.

Example user intents:

- hungry
- date plan
- friends hangout
- family dinner
- street food
- budget food
- premium restaurant
- late night
- weekend trip
- event today
- nearby offer

Business data should include matching fields:

- Mood tags
- Category
- Subcategory
- Cuisine or service tags
- Price range
- Best time to visit
- Group suitability
- Family suitability
- Open now status
- Distance
- Active offer status

## Social Layer Role

The social layer helps the discovery result spread and become a plan.

Users should be able to:

- Share a business/event/offer to a friend
- Share it in a group
- Vote on options
- Suggest alternate businesses or events
- Chat around the plan
- Save places
- React/comment/share

This makes Zumers more than a directory. It becomes a social decision platform.

## Current Development Focus

For now, the priority is to develop the business side first.

The goal is not only business login. The goal is to collect enough high-quality
business data so that later the user-facing search can connect to it.

Recommended business-side build order:

1. Business profile data model
2. Category, subcategory, and mood tags
3. Location fields and map coordinates
4. Opening hours and availability
5. Offers and today updates
6. Media/gallery/menu/package uploads
7. Booking/contact settings
8. Business analytics
9. Verification and approval workflow
10. User-facing discovery connection later

## Success Definition

Zumers succeeds when a user can open the app, express a mood or intent, and get
useful nearby options that can immediately become a plan with friends.

The business dashboard succeeds when a vendor can manage everything needed to be
discovered by those users without using the normal user interface.
