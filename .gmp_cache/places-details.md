# Return detailed information about a specific place

To retrieve comprehensive details about a specific establishment or point of
interest using the Places API (New), initiate an HTTP `GET` request to the Place
Details endpoint using a valid `placeId`.

## Prerequisites

1.  **Google Cloud Project & API Key**: Ensure you have a Google Cloud project
    with billing enabled and the **Places API (New)** enabled.
2.  **Place ID**: You must have a valid `placeId` (e.g.,
    `ChIJj61dQgK6j4AR4GeTYWZsKWw`). You can obtain a Place ID from:
    -   Text Search (New) or Nearby Search (New)
    -   Autocomplete (New)
    -   Geocoding API, Routes API, or Address Validation API

--------------------------------------------------------------------------------

## Endpoint & Request Structure

A Place Details (New) request is an HTTP `GET` request to the following URL:

```http
GET https://places.googleapis.com/v1/places/{placeId}
```

### Required Headers & Parameters

1.  **API Key**: Pass via the `X-Goog-Api-Key` HTTP header or the `key` URL
    query parameter.
2.  **Usage Attribution**: Include the header
    `X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1` in all standard REST
    calls.
3.  **FieldMask (`X-Goog-FieldMask` or `fields` parameter)**: **Required.**
    There is no default list of returned fields; omitting the field mask results
    in an error.
    -   Pass a comma-separated list of fields with **no spaces** (e.g.,
        `id,displayName,formattedAddress`).
    -   While `*` can be used in development to retrieve all fields, it is
        strongly discouraged in production due to payload size and billing
        implications.
4.  **Place ID (`placeId`)**: Included directly in the URL path. Note that in
    responses, the `name` field contains the resource name (`places/PLACE_ID`),
    while the `id` field contains the standalone `PLACE_ID`.

### Optional Query Parameters

-   `languageCode`: The language in which to return results (defaults to `en`).
    Invalid codes return an `INVALID_ARGUMENT` error.
-   `regionCode`: A two-character CLDR code (e.g., `us`, `gb`) used to format
    the response and potentially omit the country name from `formattedAddress`
    if it matches.
-   `sessionToken`: User-generated string that tracks Autocomplete (New) calls
    as "sessions" for billing purposes when a Place Details call follows an
    Autocomplete call.

--------------------------------------------------------------------------------

## Field Masking and Billing SKUs

Only request the fields your application requires. The highest-tier field in
your `X-Goog-FieldMask` determines the SKU billed for the request.

| SKU Tier                        | Supported Fields                          |
| :------------------------------ | :---------------------------------------- |
| **Place Details Essentials (IDs | `attributions`, `consumerAlert`, `id`,    |
: Only)**                         : `movedPlace`, `movedPlaceId`, `name`      :
:                                 : (returns `places/PLACE_ID`), `photos`     :
| **Place Details Essentials**    | `addressComponents`, `addressDescriptor`  |
:                                 : (GA in India, experimental elsewhere),    :
:                                 : `adrFormatAddress`, `entrances`,          :
:                                 : `formattedAddress`, `location`,           :
:                                 : `navigationPoints`, `plusCode`,           :
:                                 : `postalAddress`, `shortFormattedAddress`, :
:                                 : `types`, `viewport`                       :
| **Place Details Pro**           | `accessibilityOptions`, `businessStatus`, |
:                                 : `containingPlaces`, `displayName`         :
:                                 : (human-readable text name),               :
:                                 : `googleMapsLinks`, `googleMapsTypeLabel`, :
:                                 : `googleMapsUri`, `iconBackgroundColor`,   :
:                                 : `iconMaskBaseUri`, `openingDate`,         :
:                                 : `primaryType`, `primaryTypeDisplayName`,  :
:                                 : `pureServiceAreaBusiness`,                :
:                                 : `subDestinations`, `timeZone`,            :
:                                 : `utcOffsetMinutes`                        :
| **Place Details Enterprise**    | `currentOpeningHours`,                    |
:                                 : `currentSecondaryOpeningHours`,           :
:                                 : `internationalPhoneNumber`,               :
:                                 : `nationalPhoneNumber`, `priceLevel`,      :
:                                 : `priceRange`, `rating`,                   :
:                                 : `regularOpeningHours`,                    :
:                                 : `regularSecondaryOpeningHours`,           :
:                                 : `transitStation`, `userRatingCount`,      :
:                                 : `websiteUri`                              :
| **Place Details Enterprise +    | `allowsDogs`, `curbsidePickup`,           |
: Atmosphere**                    : `delivery`, `dineIn`, `editorialSummary`, :
:                                 : `evChargeAmenitySummary`,                 :
:                                 : `evChargeOptions`, `fuelOptions`,         :
:                                 : `generativeSummary`, `goodForChildren`,   :
:                                 : `goodForGroups`, `goodForWatchingSports`, :
:                                 : `liveMusic`, `menuForChildren`,           :
:                                 : `neighborhoodSummary`, `outdoorSeating`,  :
:                                 : `parkingOptions`, `paymentOptions`,       :
:                                 : `reservable`, `restroom`, `reviews`,      :
:                                 : `reviewSummary`, `servesBeer`,            :
:                                 : `servesBreakfast`, `servesBrunch`,        :
:                                 : `servesCocktails`, `servesCoffee`,        :
:                                 : `servesDessert`, `servesDinner`,          :
:                                 : `servesLunch`, `servesVegetarianFood`,    :
:                                 : `servesWine`, `takeout`                   :

> **Note:** In the Legacy API, `name` returned the human-readable place name. In
> Places API (New), you must request `displayName` for the text name.

--------------------------------------------------------------------------------

## Code Examples

### 1. Basic Place Details Request (cURL)

Retrieve the ID, display name, formatted address, and Plus Code for a place:

```bash
curl -X GET \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  -H "X-Goog-FieldMask: id,displayName,formattedAddress,plusCode" \
  "https://places.googleapis.com/v1/places/ChIJj61dQgK6j4AR4GeTYWZsKWw"
```

**Response:**

```json
{
  "id": "ChIJj61dQgK6j4AR4GeTYWZsKWw",
  "formattedAddress": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
  "plusCode": {
    "globalCode": "849VCWC7+RW",
    "compoundCode": "CWC7+RW Mountain View, CA, USA"
  },
  "displayName": {
    "text": "Googleplex",
    "languageCode": "en"
  }
}
```

### 2. JavaScript (`fetch`) Implementation

```javascript
async function getPlaceDetails(placeId, apiKey, sessionToken = null) {
  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);

  // Optional parameters
  url.searchParams.append('languageCode', 'en');
  if (sessionToken) {
    url.searchParams.append('sessionToken', sessionToken);
  }

  const fields = [
    'id',
    'displayName',
    'formattedAddress',
    'rating',
    'regularOpeningHours',
    'websiteUri'
  ].join(',');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      'X-Goog-FieldMask': fields
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Place Details request failed (${response.status}): ${errorBody}`);
  }

  return await response.json();
}
```

--------------------------------------------------------------------------------

## Advanced Use Cases

### Handling Relocated / Moved Places

If a place has closed and moved to a new location, you can track its relocation
using `businessStatus`, `movedPlace`, and `movedPlaceId`.

```bash
curl -X GET \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  -H "X-Goog-FieldMask: id,displayName,businessStatus,movedPlace,movedPlaceId" \
  "https://places.googleapis.com/v1/places/ChIJUfQdGInVzkwRzAjmjzWB7CQ"
```

-   **Permanently Closed (Not Moved)**: Returns
    `"businessStatus": "CLOSED_PERMANENTLY"` and omits `movedPlace` and
    `movedPlaceId`.
-   **Moved to New Location**: Returns `"businessStatus": "CLOSED_PERMANENTLY"`
    along with `"movedPlace": "places/NEW_PLACE_ID"` and
    `"movedPlaceId": "NEW_PLACE_ID"`.
-   **Chained Relocations**: If a business relocated multiple times,
    `movedPlaceId` only points to the *next* location. Issue subsequent Place
    Details requests using the new `movedPlaceId` until `movedPlace` and
    `movedPlaceId` are omitted from the response.

### Entrances and Navigation Points

Request `entrances` and `navigationPoints` for large destinations like airports
or malls to guide users to specific gates or drop-off zones. `navigationPoints`
includes a `navigationPointToken` that can be passed to the Routes API or
Navigation SDK.

```bash
curl -X GET \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  -H "X-Goog-FieldMask: id,displayName,entrances,navigationPoints" \
  "https://places.googleapis.com/v1/places/ChIJVVVVVYx3j4ARP-3NGldc8qQ"
```

### Transit Station Information

For transit stations, include `transitStation` in the field mask to get
affiliated transit agencies, serving lines (including vehicle icons and line
colors), and stop locations.

```bash
curl -X GET \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  -H "X-Goog-FieldMask: id,displayName,transitStation" \
  "https://places.googleapis.com/v1/places/ChIJLVaKiQFZwokRgcybX3K6Pzg"
```

### Address Descriptors & Future Openings

-   **Address Descriptors**: Request `addressDescriptor` to receive relational
    location context (`landmarks` with spatial relationships/distances and
    containing `areas`).
-   **Future Openings**: Request `businessStatus,openingDate` to identify
    businesses opening within 90 days (returns
    `"businessStatus": "FUTURE_OPENING"` and an `openingDate` object with
    `year`, `month`, and `day`).
