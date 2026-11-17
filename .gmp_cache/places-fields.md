# Specify the Data Fields Included in Place Information Responses

## Overview

In the Places API (New), you must specify a **field mask** (also called a field
list) in every request to Place Details (New), Text Search (New), and Nearby
Search (New). The field mask defines the exact place data fields to return in
the response.

If you omit the field mask or pass an empty list, the API returns an error.
Specifying only the fields you need is critical for both performance (reducing
payload size and latency) and cost management (requests are billed at the
highest pricing tier SKU among the requested fields).

--------------------------------------------------------------------------------

## How to Specify the Field Mask

You pass the field mask using the `X-Goog-FieldMask` HTTP header (or the
`$fields` / `fields` URL query parameter).

### Syntax Rules

1.  **Comma-separated list**: Separate multiple fields with a comma and **no
    spaces** (e.g., `id,displayName,formattedAddress`).
2.  **Endpoint-specific prefixes**:

    -   **Place Details (New)** returns a single `Place` object at the root of
        the response. Specify fields directly:

        ```
        X-Goog-FieldMask: id,displayName,formattedAddress
        ```
    -   **Text Search (New)** and **Nearby Search (New)** return a list of
        `Place` objects inside a `places` array. You must prefix every place
        field with `places.`:

        ```
        X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress
        ```
    -   **Pagination in Text Search (New)**: To retrieve the `nextPageToken` at
        the root level alongside place fields, include `nextPageToken` without
        the `places.` prefix:

        ```
        X-Goog-FieldMask: places.id,places.displayName,nextPageToken
        ```
3.  **Sub-fields**: You can request specific sub-fields of a complex object
    using dot notation (e.g., `displayName.text` or `places.displayName.text`).
4.  **Wildcard (`*`)**: While `*` retrieves all fields, **do not use it in
    production**. It triggers the highest possible billing SKU (`Enterprise +
    Atmosphere`) and returns a large payload.

--------------------------------------------------------------------------------

## Place Data Fields by Pricing Tier (SKU)

Requests are billed based on the highest-tier field included in your
`X-Goog-FieldMask`. Notice that some fields belong to different pricing tiers
depending on whether you call Place Details, Text Search, or Nearby Search.

### 1. Essentials (IDs Only) Tier

*Note: For Nearby Search (New), these fields are billed at the **Nearby Search
Pro** tier.*

Property Field  | Description                        | Place Details SKU     | Text Search SKU       | Nearby Search SKU
:-------------- | :--------------------------------- | :-------------------- | :-------------------- | :----------------
`attributions`  | Data attributions for the place    | Essentials (IDs Only) | Essentials (IDs Only) | Pro
`consumerAlert` | Consumer alert details             | Essentials (IDs Only) | Essentials (IDs Only) | Pro
`id`            | Unique Place ID                    | Essentials (IDs Only) | Essentials (IDs Only) | Pro
`movedPlace`    | Resource name of the moved place   | Essentials (IDs Only) | Essentials (IDs Only) | Pro
`movedPlaceId`  | Place ID of the moved place        | Essentials (IDs Only) | Essentials (IDs Only) | Pro
`name`          | Resource name (`places/PLACE_ID`)  | Essentials (IDs Only) | Essentials (IDs Only) | Pro
`nextPageToken` | Token for the next page of results | *N/A*                 | Essentials (IDs Only) | *N/A*
`photos`        | Array of photo references          | Essentials (IDs Only) | Pro                   | Pro

### 2. Essentials Tier (Place Details) / Pro Tier (Search)

*These location and address fields are billed at the **Essentials** tier for
Place Details (New), and at the **Pro** tier for Text Search (New) and Nearby
Search (New).*

Property Field          | Description                                   | Place Details SKU | Text Search SKU | Nearby Search SKU
:---------------------- | :-------------------------------------------- | :---------------- | :-------------- | :----------------
`addressComponents`     | Structured address components                 | Essentials        | Pro             | Pro
`addressDescriptor`     | Relational neighborhood/landmark descriptors  | Essentials        | Pro             | Pro
`adrFormatAddress`      | Address in `adr` microformat                  | Essentials        | Pro             | Pro
`formattedAddress`      | Human-readable address                        | Essentials        | Pro             | Pro
`location`              | Latitude and longitude coordinates            | Essentials        | Pro             | Pro
`plusCode`              | Open Location Code (Plus Code)                | Essentials        | Pro             | Pro
`postalAddress`         | Postal address in localized format            | Essentials        | Pro             | Pro
`shortFormattedAddress` | Short human-readable address                  | Essentials        | Pro             | Pro
`types`                 | Array of place type classifications           | Essentials        | Pro             | Pro
`viewport`              | Recommended viewport for displaying the place | Essentials        | Pro             | Pro

### 3. Pro Tier

*These fields are billed at the **Pro** tier across Place Details, Text Search,
and Nearby Search.*

Property Field            | Description
:------------------------ | :----------
`accessibilityOptions`    | Wheelchair accessibility features (parking, entrance, restroom, seating)
`businessStatus`          | Operational status (`OPERATIONAL`, `CLOSED_TEMPORARILY`, `CLOSED_PERMANENTLY`)
`containingPlaces`        | Parent places that contain this place
`displayName`             | Localized name of the place (contains `text` and `languageCode`)
`entrances`               | Entrance locations for the place
`googleMapsLinks`         | Deep links to Google Maps actions (directions, reviews, photos, etc.)
`googleMapsTypeLabel`     | Localized type label displayed on Google Maps
`googleMapsUri`           | URI to view the place on Google Maps
`iconBackgroundColor`     | Hex color code for the place icon background
`iconMaskBaseUri`         | Base URI for the place icon mask
`navigationPoints`        | Specific routing/navigation drop-off or access points
`openingDate`             | Date the place opened or will open
`primaryType`             | Primary classification type of the place
`primaryTypeDisplayName`  | Localized display name of the primary type
`pureServiceAreaBusiness` | Boolean indicating if the business visits customers without a physical storefront
`subDestinations`         | Sub-destinations within a larger place (e.g., airport terminals)
`timeZone`                | IANA time zone object
`utcOffsetMinutes`        | Offset from UTC in minutes

### 4. Enterprise Tier

*These contact, hours, price, and rating fields are billed at the **Enterprise**
tier across all three endpoints.*

Property Field                 | Description
:----------------------------- | :----------
`currentOpeningHours`          | Opening hours for the next 7 days, including special hours
`currentSecondaryOpeningHours` | Secondary opening hours (e.g., drive-through, delivery) for the next 7 days
`internationalPhoneNumber`     | Phone number with country code
`nationalPhoneNumber`          | Localized phone number
`priceLevel`                   | Categorical price level (e.g., `PRICE_LEVEL_MODERATE`)
`priceRange`                   | Specific price range for the place
`rating`                       | Aggregate user rating (1.0 to 5.0)
`regularOpeningHours`          | Standard weekly opening hours
`regularSecondaryOpeningHours` | Standard weekly secondary opening hours
`transitStation`               | Transit station information
`userRatingCount`              | Total number of user ratings
`websiteUri`                   | Official website URI of the business

### 5. Enterprise + Atmosphere Tier

*These amenities, dining, EV/fuel, reviews, and AI summary fields are billed at
the **Enterprise + Atmosphere** tier across all three endpoints.*

Property Field           | Description
:----------------------- | :----------
`allowsDogs`             | Whether dogs are allowed
`curbsidePickup`         | Offers curbside pickup
`delivery`               | Offers delivery
`dineIn`                 | Offers dine-in service
`editorialSummary`       | Brief summary of the place written by editors
`evChargeAmenitySummary` | AI-powered summary of amenities near an EV charging station
`evChargeOptions`        | EV charger connector types, speeds, and availability
`fuelOptions`            | Fuel types and prices at gas stations
`generativeSummary`      | AI-powered summary of the place
`goodForChildren`        | Suitable for children
`goodForGroups`          | Suitable for groups
`goodForWatchingSports`  | Good venue for watching sports
`liveMusic`              | Features live music
`menuForChildren`        | Offers a kids' menu
`neighborhoodSummary`    | AI-powered summary of the surrounding neighborhood
`outdoorSeating`         | Offers outdoor seating
`parkingOptions`         | Available parking types (free/paid lot, street, valet, garage)
`paymentOptions`         | Accepted payment methods (credit cards, cash only, NFC)
`reservable`             | Accepts reservations
`restroom`               | Has a public restroom
`reviews`                | Array of up to 5 user reviews
`reviewSummary`          | AI-powered summary of user reviews
`routingSummaries`       | Travel duration and distance summaries (when routing parameters are supplied)
`servesBeer`             | Serves beer
`servesBreakfast`        | Serves breakfast
`servesBrunch`           | Serves brunch
`servesCocktails`        | Serves cocktails
`servesCoffee`           | Serves coffee
`servesDessert`          | Serves dessert
`servesDinner`           | Serves dinner
`servesLunch`            | Serves lunch
`servesVegetarianFood`   | Serves vegetarian options
`servesWine`             | Serves wine
`takeout`                | Offers takeout

--------------------------------------------------------------------------------

## Code Examples

### Example 1: Place Details (New) Request

For Place Details, specify the field names directly in `X-Goog-FieldMask`
without a `places.` prefix.

```bash
curl -X GET \
  'https://places.googleapis.com/v1/places/ChIJj61dQgK6j4AR4GeTYWZsKWw' \
  -H 'Content-Type: application/json' \
  -H 'X-Goog-Api-Key: YOUR_API_KEY' \
  -H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
  -H 'X-Goog-FieldMask: id,displayName,formattedAddress,regularOpeningHours,rating'
```

### Example 2: Text Search (New) Request

For Text Search (and Nearby Search), prefix every place property with `places.`.
Include `nextPageToken` without a prefix if you need pagination.

```bash
curl -X POST \
  'https://places.googleapis.com/v1/places:searchText' \
  -H 'Content-Type: application/json' \
  -H 'X-Goog-Api-Key: YOUR_API_KEY' \
  -H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
  -H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.priceLevel,nextPageToken' \
  -d '{
    "textQuery": "Spicy Vegetarian Food in Sydney, Australia"
  }'
```

### Example 3: Nearby Search (New) in JavaScript (`fetch`)

```javascript
async function searchNearbyPlaces(lat, lng) {
  const url = 'https://places.googleapis.com/v1/places:searchNearby';

  // Prefix all Place fields with "places."
  const fieldMask = [
    'places.id',
    'places.displayName.text',
    'places.location',
    'places.FormattedAddress',
    'places.evChargeOptions'
  ].join(',');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      'X-Goog-FieldMask': fieldMask
    },
    body: JSON.stringify({
      includedTypes: ['electric_vehicle_charging_station'],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 5000.0
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.places;
}
```
