# Knock for Cadence browser Push Notifications

Research date: 21 November 2026. Resolves [Evaluate Knock for Cadence browser push](https://github.com/alexmayku/ai-hero-project/issues/3), under [the Cadence push decision map](https://github.com/alexmayku/ai-hero-project/issues/1). Documentation research only; no accounts, credentials, purchases, implementation or real-device delivery tests. Provider selection remains a human decision.

## Finding and recommendation

**Knock can orchestrate the two lesson Q&A Push Notifications through Firebase Cloud Messaging (FCM), subject to browser permission/platform support and an SDK compatibility check.** Knock explicitly documents a web-push implementation using FCM, browser registration and a service worker. Its in-app feed is a separate destination: adding a feed or React notification bell alone does not provide device push while Cadence is out of view. [Knock web-push tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm), [channel types](https://docs.knock.app/integrations/overview).

Keep two choices available: Knock + FCM for managed workflow delivery/operations, or direct standards-based Web Push for a narrower dependency/cost footprint with more application-owned operations. Neither removes permission, installation, lifecycle or durable-event work. Recommendation: if choosing Knock, validate one real browser delivery with pinned SDK versions before implementation planning is finalized. This is a technical recommendation, not provider approval.

## Prerequisites and browser boundary

The documented transport is `Cadence server → Knock workflow/FCM channel → FCM → browser push service → service worker/device notification`. Configure a Firebase project and an FCM channel per Knock environment with the Firebase project ID and complete service-account JSON. Keep these credentials and Knock's secret API key off the client. Store recipient device registration tokens in the channel's `tokens` array (or device objects). FCM supports a notification per unique token. No native iOS app or APNs-native integration is required for this documented web path. [Knock FCM integration](https://docs.knock.app/integrations/push/firebase).

The browser needs HTTPS, Push API support, Firebase SDK configuration, VAPID web credentials, notification permission and a service worker. Firebase's current guide describes root `firebase-messaging-sw.js`. [Firebase web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started).

On iPhone/iPad, the established support floor is iOS/iPadOS 16.4 and a web app added to the Home Screen; request permission in response to direct user interaction. A regular website tab is not an equivalent acceptance target. Desktop Safari support began with Safari 16.1 on macOS; current WebKit still describes Home Screen web apps for iOS/iPadOS, including newer Declarative Web Push. Test the actual selected browser/OS combinations rather than promise every mobile browser. [WebKit iOS push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/).

**Current documentation mismatch:** Firebase's web setup page (last updated 18 November 2026) now recommends `register`/`onRegistered` and Firebase Installation IDs, labels `getToken` registration tokens deprecated and says not to mix the registration-management APIs. Knock's tutorial and FCM channel contract still use `getToken` and `tokens`. Do not put an Installation ID into Knock's token array on assumption. Confirm supported Firebase SDK/version and Knock's migration support in a focused integration test or with the providers before adopting the new API. The published legacy token route remains documented, but its future removal/version timing was not established. [Firebase current setup](https://firebase.google.com/docs/cloud-messaging/web/get-started), [Knock FCM contract](https://docs.knock.app/integrations/push/firebase).

## Identity and subscription lifecycle

Knock channel data is per recipient and environment. Missing required channel data skips the push step. `setChannelData` overwrites the previous channel data; it is not an atomic append. Invalid token removal is opt-in on bounced deliveries, and expiry/opt-out handling remains application work. [Channel data semantics](https://docs.knock.app/managing-recipients/setting-channel-data).

Proposed Cadence design, not an existing capability:

- Use stable Cadence user IDs (serialized consistently) as Knock recipient IDs. Bind registrations using the authenticated server session, never a posted arbitrary user ID.
- Store each browser installation separately with owner, token, timestamps and revocation state. Serialize/reconcile per-user updates so registering a second device does not erase the first; removing one must preserve others.
- Reconcile registration on return/startup, handle permission revocation, expired registrations and account deletion. Enable invalid-token deregistration and ensure a local mirror does not reintroduce removed tokens.
- On logout/account switching, detach that browser from the previous account before binding it to another. Browser permission belongs to the origin, not the Cadence account. Agree whether signed-out browsers should receive any later notifications; default design should prevent cross-account disclosure.
- Keep browser opt-in distinct from application notification preferences. Removing a server token does not revoke browser permission; browsers control that permission. Knock's tutorial clears the entire array as a simple unsubscribe example, which must be adapted for multiple devices. [Knock tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm).

## Fit with this repository and server events

Inspected baseline `979e285`: [package.json](../../package.json) uses React 19, React Router 8.3, Node server, Drizzle and better-sqlite3; [react-router.config.ts](../../react-router.config.ts) enables SSR. No Knock or Firebase dependency is present. Question/comment creation and reply creation exist in both [lesson route](../../app/routes/courses.$slug.lessons.$lessonId.tsx) and [instructor questions route](../../app/routes/instructor.questions.tsx). Session identity is a numeric user ID in [session.ts](../../app/lib/session.ts); [api.switch-user.ts](../../app/routes/api.switch-user.ts) deliberately changes it for development. README's suggested Knock account is not configured push infrastructure.

Proposed implementation boundary: browser APIs and Firebase initialization run after hydration in client-only code, with capability checks; registration is submitted to a server action authenticated from the session. Place Knock client/secrets in a server-only module. Serve the service worker as a real static JavaScript asset, not an SSR fallback page. The tutorial's Next.js `use client` and `NEXT_PUBLIC_*` conventions must be adapted to this Vite/React Router app, not pasted literally.

Resolve recipient rules before coding: a qualifying Student question targets its course Instructor, and a qualifying reply targets the original question author. Centralize event emission across both existing write paths. Proposed durable design: commit comment/reply plus an outbox event in the same SQLite transaction, then dispatch separately with retries. A direct external call after a DB insert can lose notifications on a crash; sending before commit can notify about rolled-back work. Store event ID, recipient, workflow/payload version, attempt state and last error. This outbox and worker do not currently exist.

Knock exposes server workflow triggers with recipients, actor and data. Use stable event-specific keys and minimal IDs/deep links; authorize the destination again when opened. Do not assume setting `actor` automatically prevents all self-notifications: the documented automatic exclusion concerns Object subscribers. [Workflow trigger API](https://docs.knock.app/send-notifications/triggering-workflows/api).

## Delivery, retries and duplicate suppression

Knock retries retryable provider/network failures up to **8 times over 30 minutes**, with exponential backoff and jitter. Terminal failures can be inspected and manually retried in its dashboard. These retries begin after Knock accepts work; they cannot recover an event Cadence never submitted. [Delivery pipeline](https://docs.knock.app/send-notifications/delivering-notifications).

Workflow-trigger `Idempotency-Key` suppresses identical successful requests for **24 hours** by default; changed parameters with the same key error. Only the trigger endpoint currently supports this header. Keep a local durable deduplication record for longer replays, and never generate a fresh key on each retry. No exactly-once device-display guarantee was found. [API idempotency](https://docs.knock.app/api-reference/overview).

**Push `sent` means accepted by the push provider, not displayed or read.** Knock does not support push delivery tracking beyond `sent`; any client receipt/engagement acknowledgement must be explicitly implemented. Do not use missing acknowledgement alone to resend indefinitely. [Message statuses](https://docs.knock.app/send-notifications/message-statuses).

Knock's default FCM notification payload is automatically displayed in the background; foreground handling is application code. Avoid adding a second background display handler that duplicates the automatic notification. Data-only handling is a different implementation choice and needs separate verification. [Knock tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm).

## Development and acceptance evidence still required

Knock sandbox mode generates/previews messages but never calls the provider; it can be configured without provider credentials. It is useful for workflow assertions, not proof of device delivery. Use isolated development configuration and real credentials with sandbox disabled for the device test. [Sandbox semantics](https://docs.knock.app/integrations/overview#sandbox-mode).

Recommended future checks: both event-writing routes; correct recipient and no unwanted self-send; denied/default/granted permission; unsupported browser; iOS uninstalled versus Home Screen; foreground/background; browser/device offline and return; notification click to authorized lesson/thread; two devices; same-browser account switching/logout; token revocation/rotation; concurrent registration; replay inside/outside the idempotency window; transient provider failure; no secret in browser bundles. Use HTTPS reachable from physical phones. Mock provider calls for deterministic application tests and separately record real-device results. For any future `app/` changes run `npm run typecheck`, then `npm run test` per AGENTS.md. No application changes or application tests were made for this research-only branch.

## Current published costs

Live pricing page retrieved 21 November 2026; USD amounts, excluding any taxes or unrelated services. [Knock pricing](https://knock.app/pricing):

| Plan | Monthly base | Included messages | Additional usage |
| --- | ---: | ---: | --- |
| Free | $0 | 10,000 | No posted free-tier overage unit price; provider says no hard cap and contacts customers over limit |
| Starter | $250 | 50,000 | $0.005/message |
| Enterprise | Custom annual agreement | Negotiated | Volume and monthly-notified-user options |

Billing is per message to a user on a channel, not workflow trigger; failed/bounced messages are excluded. Multiple channels add messages. Stored profiles/workflows/channels are unlimited. Starter also includes 2,500 guide recipients ($0.05 extra each) and 2,000 agent credits ($0.01 extra each); neither feature is needed here. Free includes 500 of each. Logs: 30 days on Free/Starter, 90 on Enterprise. Downstream services are separately billed.

For push-only Starter, `monthly USD = 250 + 0.005 × max(0, billable messages − 50,000)`: 50,000 costs $250; 100,000 costs $500. Estimate event volume × eligible recipients × successful sends, accounting for preference skips. Multiple device tokens generate multiple deliveries, but the public pricing wording does not unambiguously settle multi-device billing units; confirm against usage telemetry/provider before a final budget. Development traffic's billing treatment also needs confirmation.

FCM itself is listed as **no-cost**. Other Firebase/Google Cloud products, application hosting, storage, worker execution and operations can incur separate costs. [Firebase pricing](https://firebase.google.com/pricing).

## Direct Web Push comparison and remaining decisions

The open-source Node `web-push` library accepts browser `PushSubscription` endpoint/keys, encrypts payloads and sends using VAPID. It exposes response status, TTL, urgency and coalescing topics. This can run in Cadence's Node architecture without Knock or Firebase client SDK; browser vendors still supply push services. [Library source/README](https://github.com/web-push-libs/web-push).

Engineering trade-off: direct push removes Knock's platform bill and FCM token/API integration dependency but leaves Cadence owning recipient storage, invalid endpoint cleanup, scheduling/retries, deduplication, logs, templates/preferences and operational tooling. It retains the same browser permission/install constraints and requires infrastructure/engineering cost, so it is not a zero-cost system. Knock supplies orchestration and managed provider retries while both choices still require a reliable Cadence event boundary.

Human decisions remain: provider and acceptable cost step-up; supported browser/OS matrix; precise qualifying reply/self-notification rules; opt-in/logout/content policy; acceptable delay/expiry and operational ownership. Technical follow-up: prove the current Knock/FCM SDK compatibility, multi-device billing and real-device behavior before claiming readiness. No vendor choice is made by closing this research ticket.
