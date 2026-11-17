# Return a list of places and place details based on a query string

## Overview

The Text Search (New) capability in the Places API Web Service allows you to
search for a set of places and retrieve their details based on a text query
string (e.g., "pizza in New York", "shoe stores near Ottawa", or "123 Main
Street"). The service responds with a list of candidate places matching the
query and any configured location bias or refinement filters.

## Endpoint & Request Structure

A Text Search (New) request is an HTTP `POST` request to the following endpoint:

```http
POST https://places.googleapis.com/v1/places:searchText
```

### Required Headers

| Header                    | Value / Description                          |
| :------------------------ | :------------------------------------------- |
| `Content-Type`            | `application/json`                           |
| `X-Goog-Api-Key`          | Your Google Maps Platform API key.           |
| `X-Goog-FieldMask`        | Comma-separated list of fields to return (no |
:                           : spaces allowed). **Required**; omitting this :
:                           : header returns an error.                     :
| `X-Goog-Maps-Solution-ID` | `gmp_git_agentskills_v1` (Required for usage |
:                           : attribution).                                :

--------------------------------------------------------------------------------

## Required Parameters

### 1. `textQuery` (Body Parameter)

The text string on which to search (e.g., `"restaurant"`, `"123 Main Street"`,
or `"Best place to visit in San Francisco"`). Results are ordered based on
perceived relevance.

*   **Phone Numbers**: Include the country code followed by a space (e.g., E.164
    format) and set `regionCode` to match the country.
*   **Not Intended For**:
    *   Queries with too many concepts/constraints (e.g.,
        `"Market Street San Francisco San Jose Airport"`).
    *   Non-mapped postal elements (e.g., `"C/O John Smith 123 Main Street"`,
        `"P.O. Box 13"`).
    *   Unavailable business/location combinations (e.g.,
        `"Tesco near Dallas, Texas"`).
    *   Ambiguous queries, historical names, unofficial vanity names,
        non-geospatial intent, or raw latitude/longitude coordinates
        (`"37.422131,-122.084801"`).

### 2. `FieldMask` (Header or `$fields` URL Parameter)

You must explicitly specify the fields to return in the `Place` response object
via `X-Goog-FieldMask`. There is no default field list.

*   **Format**: Comma-separated list without spaces (e.g.,
    `places.displayName,places.formattedAddress`).
*   **Wildcard**: `*` retrieves all fields (useful for development, strongly
    discouraged in production due to latency and billing costs).

#### FieldMask SKU Tiers

Requesting fields triggers billing at the highest SKU tier included in your
mask:

*   **Text Search Essentials (ID Only SKU)**: `places.attributions`,
    `places.id`, `places.consumerAlert`, `places.name` (resource name in format
    `places/PLACE_ID`), `nextPageToken`, `places.movedPlace`,
    `places.movedPlaceId`
*   **Text Search Pro SKU**: `places.accessibilityOptions`,
    `places.addressComponents`, `places.addressDescriptor`,
    `places.adrFormatAddress`, `places.businessStatus`,
    `places.containingPlaces`, `places.displayName` (text name of the place),
    `places.formattedAddress`, `places.googleMapsLinks`,
    `places.googleMapsTypeLabel`, `places.googleMapsUri`,
    `places.iconBackgroundColor`, `places.iconMaskBaseUri`, `places.location`,
    `places.openingDate`, `places.photos`, `places.plusCode`,
    `places.postalAddress`, `places.primaryType`,
    `places.primaryTypeDisplayName`, `places.pureServiceAreaBusiness`,
    `places.shortFormattedAddress`, `places.searchUri`,
    `places.subDestinations`, `places.timeZone`, `places.types`,
    `places.utcOffsetMinutes`, `places.viewport`, `places.entrances`,
    `places.navigationPoints`
*   **Text Search Enterprise SKU**: `places.currentOpeningHours`,
    `places.currentSecondaryOpeningHours`, `places.internationalPhoneNumber`,
    `places.nationalPhoneNumber`, `places.priceLevel`, `places.priceRange`,
    `places.rating`, `places.regularOpeningHours`,
    `places.regularSecondaryOpeningHours`, `places.transitStation`,
    `places.userRatingCount`, `places.websiteUri`
*   **Text Search Enterprise + Atmosphere SKU**: `places.allowsDogs`,
    `places.curbsidePickup`, `places.delivery`, `places.dineIn`,
    `places.editorialSummary`, `places.evChargeAmenitySummary`,
    `places.evChargeOptions`, `places.fuelOptions`, `places.generativeSummary`,
    `places.goodForChildren`, `places.goodForGroups`,
    `places.goodForWatchingSports`, `places.liveMusic`,
    `places.menuForChildren`, `places.neighborhoodSummary`,
    `places.parkingOptions`, `places.paymentOptions`, `places.outdoorSeating`,
    `places.reservable`, `places.restroom`, `places.reviews`,
    `places.reviewSummary`, `routingSummaries`, `places.servesBeer`,
    `places.servesBreakfast`, `places.servesBrunch`, `places.servesCocktails`,
    `places.servesCoffee`, `places.servesDessert`, `places.servesDinner`,
    `places.servesLunch`, `places.servesVegetarianFood`, `places.servesWine`,
    `places.takeout`

--------------------------------------------------------------------------------

## Optional Parameters (JSON Body)

| Parameter                          | Type            | Description & Constraints       |
| :--------------------------------- | :-------------- | :------------------------------ |
| `includedType`                     | `string`        | Biases results to a single      |
:                                    :                 : place type from Table A (e.g.,  :
:                                    :                 : `"bar"`, `"pharmacy"`). Table B :
:                                    :                 : values cannot be used as        :
:                                    :                 : filters. Ignored for hotel or   :
:                                    :                 : geopolitical queries.           :
| `strictTypeFiltering`              | `boolean`       | Used with `includedType`. If    |
:                                    :                 : `true`, only returns places     :
:                                    :                 : matching `includedType`.        :
:                                    :                 : Defaults to `false`.            :
| `locationBias`                     | `object`        | Biases results toward a region  |
:                                    :                 : (`circle` or `rectangle`).      :
:                                    :                 : Results outside the area can    :
:                                    :                 : still be returned. Cannot be    :
:                                    :                 : used with                       :
:                                    :                 : `locationRestriction`.          :
:                                    :                 : Overridden if `textQuery`       :
:                                    :                 : contains an explicit location   :
:                                    :                 : (e.g., `"Market in              :
:                                    :                 : Barcelona"`).                   :
| `locationRestriction`              | `object`        | Restricts results strictly      |
:                                    :                 : within a `rectangle` viewport   :
:                                    :                 : (categorical queries only).     :
:                                    :                 : Cannot be used with             :
:                                    :                 : `locationBias`.                 :
| `pageSize`                         | `integer`       | Number of results per page (1   |
:                                    :                 : to 20). Defaults to 20.         :
:                                    :                 : Replaces deprecated             :
:                                    :                 : `maxResultCount`. Maximum of 60 :
:                                    :                 : results returned across all     :
:                                    :                 : pages.                          :
| `pageToken`                        | `string`        | Pass `nextPageToken` from a     |
:                                    :                 : previous response to fetch the  :
:                                    :                 : next page. All other request    :
:                                    :                 : parameters must remain          :
:                                    :                 : identical to the initial        :
:                                    :                 : request.                        :
| `priceLevels`                      | `array<string>` | Restricts results to specified  |
:                                    :                 : price levels\:                  :
:                                    :                 : `"PRICE_LEVEL_INEXPENSIVE"`,    :
:                                    :                 : `"PRICE_LEVEL_MODERATE"`,       :
:                                    :                 : `"PRICE_LEVEL_EXPENSIVE"`,      :
:                                    :                 : `"PRICE_LEVEL_VERY_EXPENSIVE"`. :
:                                    :                 : (`PRICE_LEVEL_FREE` is not      :
:                                    :                 : allowed in requests). Applies   :
:                                    :                 : to Food/Drink, Services, and    :
:                                    :                 : Shopping types.                 :
| `minRating`                        | `number`        | Minimum average user rating     |
:                                    :                 : between `0.0` and `5.0` in      :
:                                    :                 : increments of `0.5` (values     :
:                                    :                 : like `0.6` round up to `1.0`).  :
| `openNow`                          | `boolean`       | If `true`, returns only places  |
:                                    :                 : open at the time of the query.  :
| `rankPreference`                   | `string`        | `"RELEVANCE"` (default for      |
:                                    :                 : categorical queries) or         :
:                                    :                 : `"DISTANCE"`. Leave unset for   :
:                                    :                 : non-categorical queries.        :
| `languageCode`                     | `string`        | Language code for results       |
:                                    :                 : (defaults to `"en"`). Invalid   :
:                                    :                 : codes return                    :
:                                    :                 : `INVALID_ARGUMENT`.             :
| `regionCode`                       | `string`        | Two-character CLDR code (e.g.,  |
:                                    :                 : `"us"`, `"gb"`) to format       :
:                                    :                 : addresses and bias results.     :
| `includePureServiceAreaBusinesses` | `boolean`       | If `true`, includes businesses  |
:                                    :                 : that visit/deliver to customers :
:                                    :                 : without a physical storefront   :
:                                    :                 : (e.g., plumbers, food trucks).  :
:                                    :                 : These omit `formattedAddress`   :
:                                    :                 : in the response.                :
| `includeFutureOpeningBusinesses`   | `boolean`       | If `true`, includes businesses  |
:                                    :                 : expected to open in the future  :
:                                    :                 : (defaults to `false`). Request  :
:                                    :                 : `places.businessStatus` and     :
:                                    :                 : `places.openingDate` in the     :
:                                    :                 : field mask.                     :
| `evOptions`                        | `object`        | Filters EV charging stations    |
:                                    :                 : via `minimumChargingRateKw`     :
:                                    :                 : (number) and `connectorTypes`   :
:                                    :                 : (array of strings, e.g.,        :
:                                    :                 : `"EV_CONNECTOR_TYPE_J1772"`,    :
:                                    :                 : `"EV_CONNECTOR_TYPE_TESLA"`).   :

### Defining `locationBias` and `locationRestriction`

*   **Circle** (Supported by `locationBias` only; `radius` in meters between
    `0.0` and `50000.0`):

    ```json
    "locationBias": {
      "circle": {
        "center": { "latitude": 37.7937, "longitude": -122.3965 },
        "radius": 500.0
      }
    }
    ```
*   **Rectangle Viewport** (Supported by both `locationBias` and
    `locationRestriction`; `low` = southwest corner, `high` = northeast corner):

    ```json
    "locationRestriction": {
      "rectangle": {
        "low": { "latitude": 40.477398, "longitude": -74.259087 },
        "high": { "latitude": 40.91618, "longitude": -73.70018 }
      }
    }
    ```

--------------------------------------------------------------------------------

## Code Examples

### 1. Basic Text Search with Price Filtering (cURL)

```bash
curl -X POST -d '{
  "textQuery": "Spicy Vegetarian Food in Sydney, Australia",
  "priceLevels": ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"],
  "pageSize": 5
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: YOUR_API_KEY' \
-H 'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.priceLevel,nextPageToken' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://places.googleapis.com/v1/places:searchText'
```

### 2. Location Bias, Open Now, and Type Filtering (JavaScript `fetch`)

```javascript
async function searchPlacesByText() {
  const endpoint = 'https://places.googleapis.com/v1/places:searchText';

  const requestBody = {
    textQuery: 'vegetarian food',
    includedType: 'restaurant',
    strictTypeFiltering: true,
    openNow: true,
    pageSize: 10,
    locationBias: {
      circle: {
        center: { latitude: 37.7937, longitude: -122.3965 },
        radius: 500.0
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': 'YOUR_API_KEY',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating',
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log(data.places);
}
```

### 3. EV Charger Search with Minimum Charging Rate (cURL)

```bash
curl -X POST -d '{
  "textQuery": "EV Charging Station Mountain View",
  "pageSize": 4,
  "evOptions": {
    "minimumChargingRateKw": 10,
    "connectorTypes": ["EV_CONNECTOR_TYPE_J1772", "EV_CONNECTOR_TYPE_TESLA"]
  }
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: YOUR_API_KEY' \
-H 'X-Goog-FieldMask: places.displayName,places.evChargeOptions' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
'https://places.googleapis.com/v1/places:searchText'
```

### 4. Specialized Queries (Transit, Entrances, Future Openings)

*   **Transit Stations**: Include `places.transitStation` in `X-Goog-FieldMask`
    to retrieve affiliated transit agencies, lines, vehicle icons, alerts,
    stops, and departure boards.
*   **Entrances & Navigation Points**: Include
    `places.entrances,places.navigationPoints` in `X-Goog-FieldMask` to retrieve
    entry/exit coordinates and `navigationPointToken` values for use with the
    Routes API or Navigation SDK.
*   **Future Opening Businesses**: Set `"includeFutureOpeningBusinesses": true`
    in the body and include `places.businessStatus,places.openingDate` in
    `X-Goog-FieldMask`.

--------------------------------------------------------------------------------

## Response Structure

The API returns a JSON object containing a `places` array and an optional
`nextPageToken` if additional results are available:

```json
{
  "places": [
    {
      "id": "ChIJifIePKtZwokRVZ-UdRGkZzs",
      "formattedAddress": "367 Pitt St, Sydney NSW 2000, Australia",
      "priceLevel": "PRICE_LEVEL_MODERATE",
      "displayName": {
        "text": "Mother Chu's Vegetarian Kitchen",
        "languageCode": "en"
      }
    }
  ],
  "nextPageToken": "AeCrKXsZWzNVbPzO-MRWPu52jWO_Xx8aKwOQ69_Je3DxRpfdjClq8Ekwh3UcF2h2Jn75kL6PtWLGV4ecQri-GEUKN_OFpJkdVc-JL4Q"
}
```

### Pagination Workflow

To retrieve the next page of results, send a new `POST` request with the exact
same parameters as the previous request, adding `"pageToken": "<nextPageToken>"`
to the JSON body and ensuring `nextPageToken` is included in your
`X-Goog-FieldMask` if you need subsequent pages. Modifying other parameters
alongside `pageToken` will result in an `INVALID_ARGUMENT` error.
