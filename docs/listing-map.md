# Listing map: pin, map search, neighbourhood block

## Pin in the listing forms

`components/LocationPicker.tsx` adds an optional "Konumu haritada işaretle" step to `/ilan-ver` (PostListing) and `/ilan-duzenle/[id]` (ListingEditor). The map opens on the chosen neighbourhood, district or province. The owner places the pin by clicking, dragging it or using "Harita merkezini işaretle", then picks one of two options:

- **Yaklaşık konum göster** (the default)
- **Tam konumu göster**

The form sends `latitude`, `longitude` and `locationPrecision`. An empty `latitude` and `longitude` remove the pin. A request without these fields leaves the pin unchanged.

The map centre comes from `GET /api/locations/center?city&district&neighborhoodId` (`lib/geocode.ts`), which only signed-in users can call:

- It looks up OpenStreetMap Nominatim on the server, using only names from our own il/ilçe/mahalle lists.
- It sends the User-Agent `EstateMarket24/1.0 (+SITE_URL/iletisim)`.
- Requests are serialised and spaced at least 1.1 s apart on each instance.
- Answers are cached in memory for 30 days and must fall inside the chosen province.
- If no usable answer comes back, it uses the province centroid from `data/province-centers.json`.

## Storage and privacy (`lib/listing-location.ts`)

| Field | Exact | Approximate (default) |
|---|---|---|
| `listings.latitude/longitude` | the pin | pin moved 250–600 m in a random direction, rounded to 3 decimals |
| `presentation.location` | `{precision:"exact"}` | `{precision:"approximate", exact:{lat,lng}}` |

- The columns always hold the **public point**. Map search, the bbox filter and the neighbourhood lookup all read the columns. Searching therefore cannot reveal an exact pin.
- `parseListing` (`lib/server.ts`) removes `presentation.location.exact`, so no public page or API returns it.
- `GET /api/listings/[id]` adds `pin` (the exact pin) only for the owner or an admin, for the edit form.
- Saving the same approximate pin again keeps the earlier public point, so repeated edits cannot be averaged to find the address.
- The server checks that a pin is inside Türkiye's bounding box and within 220 km of the chosen province's centroid. If a PATCH moves the listing to another province and the stored pin no longer fits, the pin is cleared.
- No schema change was needed. A future migration could add `CREATE INDEX ... ON listings(latitude, longitude)`. The bbox filter is already written as plain `BETWEEN` ranges so such an index could serve it.

## Map search on /ilanlar

`components/PropertyMap.tsx` shows the map view (list view stays the default):

- Pinned listings appear as price markers in the visitor's display currency, in compact form (for example `≈ €158,2 B`).
- Nearby markers are grouped by screen distance.
- Clicking a marker opens a popup card.
- "Bu alanda ara" sets `bbox=minLng,minLat,maxLng,maxLat`. The list beside the map is then limited to pinned listings inside that box.

The API behaves as follows:

- `GET /api/listings?map=1` returns only pinned listings, plus `unlocated`, the number of listings matching the filters that have no pin. The map shows that number as "Konumu olmayan N ilan listede".
- Sample listings sit at their province centre and count as unlocated.
- The older `bounds` parameter still works for saved links.

## Neighbourhood block (`lib/neighborhood-info.ts`)

The block shows the nearest school, hospital, pharmacy, supermarket, metro/rail/tram/bus/ferry stop, beach, sea, park and mosque within 2 km of the public point, with distance and estimated walking time.

- Only the server calls the OpenStreetMap Overpass API (`OVERPASS_URL` can override the endpoint).
- The result is stored in `presentation.nearby` as `{fetchedAt, point, radiusM, approximate, items:[{type,name,distanceM}]}`.
- A lookup runs in the background after a save that sets or moves the pin. It also runs lazily from `GET /api/listings/[id]/nearby` when the stored result is missing, older than 30 days, measured from another point, or failed more than 6 hours ago.
- Concurrent lookups for one listing share a single request, and each instance sends only one Overpass request at a time.
- A failure keeps the previous result.
- The block credits "© OpenStreetMap katkıcıları (ODbL)". When the point is approximate, distances are marked with "~".
