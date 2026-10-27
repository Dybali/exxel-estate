# Estatemarket24 panorama processor

This worker consumes a durable queue on the hosted Site. It downloads source
photos from a private R2 binding, stitches them with Hugin, validates full sphere
coverage, and sends back a private 2048 × 1024 JPEG. The owner previews it and
explicitly adds it to their listing. Existing ready-made panoramas still work.

## Deploy

Build the Dockerfile from the repository root. Deploy the independent Blueprint
at `services/tour-worker/render.yaml` as one background worker in Frankfurt.
The Standard (1 CPU / 2 GB) plan is an initial capacity target, not a measured
production guarantee. Confirm current pricing and approve the paid service
before provisioning. A persistent private repository or container registry must
be connected to the hosting account; the Site's short-lived Git credential must
never be used for Render deployment.

Set the same random **secret**, at least 32 characters, in the Site runtime and
the worker as `CAPTURE_WORKER_TOKEN`. Set `CAPTURE_SITE_URL` on the worker to
the canonical HTTPS Site origin. Do not set a path or query. No inbound worker
port is needed. Never put secrets in Git, build arguments, image layers or logs.
Set `HUGIN_BIN` only for nonstandard local Hugin locations.

After deploying the Site, start the worker and verify authenticated claims.
The capture UI accepts jobs only after a worker heartbeat in the last 90 seconds.
Keep one consumer initially; a claim lease prevents duplicate completion when
workers restart. A heartbeat renews the two-minute lease every 20 seconds.
Lost jobs are retried up to three claims; each tool is limited to 180 seconds
and each job to 15 minutes. A canceled or expired lease cannot upload a result.

Jobs expire after 24 hours. Claim polling deletes expired private source and
result objects. Finished/failed jobs delete their sources immediately; accepted
results use the listing media store and are retained with the listing.
Expired object cleanup runs when the worker is online, not on a separate clock.
No public URL is provided for source images. Use a fresh worker secret to revoke
a worker and redeploy the Site to apply it.

## Capture limits and quality

12–40 overlapping photos from a single optical center, same lens and exposure.
Client images are resized to a 1600px longest side before upload. The server
caps each source at 6 MB / 16 megapixels. Up to three open jobs and twelve new
jobs per owner per day. A verified seller account is required. Source groups
are isolated by owner ID. Queue and preview endpoints use private/no-store.

Phone guide: 8 views around the horizon, 8 tilted 45° upward, 8 tilted 45°
downward, plus the ceiling and floor (26 total). These are manual instructions,
not sensor-verified alignment. The default 65° horizontal lens angle is a user
adjustable estimate; verify on the actual phone before relying on it. A browser
does not expose calibrated camera intrinsics. Camera tracks stop when the
dialog closes, the page is hidden, or the component unmounts.

Only a connected overlap graph and >=99.5% rendered alpha coverage pass.
These checks detect disconnected/partial inputs, not every geometric defect.
Parallax, moving subjects, low texture and bad focal length still cause failure.
No missing pixels or dimensions are invented. Real multi-device room captures
and 2 GB Linux load testing remain required before broad release.

This is photo stitching and a tour editor, **not automatic measured floor-plan
generation or a Zillow SDK integration**. Existing uploaded plans can be used
for room pins and walking arrows; reliable automatic plans need a separate
capture/measurement/reconstruction workflow and validation.

## Validation performed

Windows Hugin 2025.0.1: controlled 18-view sphere, real private local R2 upload,
authenticated queue claim/download, actual processing, result upload and owner
preview. Result 2048 × 1024, 100% alpha coverage, 965 control points, about
52 seconds on the development PC. This fixture is perspective views generated
from a known panorama, **not a real handheld room capture**. A separate browser
test uses a synthetic camera device only to test capture controls and cleanup.
The Docker/Linux build requires validation after hosting is connected.

The root Cloudflare Site API implements `/api/tour-capture`. The independent
`apps/api` Nest service does not implement this endpoint yet. Point the worker
at the root Site. The generated standalone `apps/web` UI requires a proxy to
this API or an equivalent implementation before using this feature independently.
