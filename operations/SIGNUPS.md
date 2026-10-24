# Aleesha website signups — activation
The public pages are deployed, but forms stay closed until the email account and bindings below are verified. Existing contact enquiries keep their original RESEND_API_KEY.

## Account
A welcome email confirms Daniele has a Resend login at daniele@cernestudios.com. This does not identify the current production key's team. Confirm that team owns send.aleeshaloos.com. Invite Aleesha or establish her own team and verify its sending domain before replacing credentials.

## Resend
Create two segments: Wobble waitlist and General updates.
Create two topics: Wobble release news and Aleesha updates, both with opt-out defaults.
Use the appropriate topic on EVERY marketing broadcast. Never send an unscoped broadcast to these segments.
Create a dedicated full-access API key for signup contact management; store only as SIGNUP_RESEND_API_KEY in Cloudflare.
The existing CONTACT_FROM_EMAIL must belong to a domain verified in that same Resend team.
No customer data belongs in GitHub.

## Cloudflare Pages production bindings
Create a D1 database for delivery/consent records; execute signup-schema.sql and bind as SIGNUP_DB.
Set RESEND_WOBBLE_SEGMENT, RESEND_GENERAL_SEGMENT, RESEND_WOBBLE_TOPIC, RESEND_GENERAL_TOPIC to real IDs.
Set HALLOWEEN_PDF_URL to the final https://aleeshaloos.com/...pdf URL only after upload.
Set SIGNUPS_ENABLED=true only after testing against the chosen account.
Redeploy after changing bindings.
Each successful request persists its source and consent version, updates Resend preferences only when requested, and sends a welcome email. Existing globally unsubscribed addresses are not silently resubscribed. Failed requests return an error, never a success bubble.
The delivery/consent log is separate from the Resend subscriber list. Download-only requests never enter the marketing list.

## Daily summary
Deploy daily-signup-summary.js as a separate Worker. Bind the same D1 and SIGNUP_RESEND_API_KEY / CONTACT_FROM_EMAIL / SIGNUPS_ENABLED.
Add cron 5 * * * *. The Worker sends after 18:00 Australia/Sydney once daily, with daylight-saving handled in code. It retries failed sends with a deterministic idempotency key. There are no immediate owner notifications.
Scheduled cleanup removes download-only records older than 30 days and network hashes after two days.
If this Worker is not deployed, no summary or scheduled cleanup runs.

## Finish the public pages
Replace Halloween decorative placeholder with supplied cover; upload the final PDF and update Coming soon copy.
Replace Buy me a matcha inactive card with verified Ko-fi URL.
Notion sync is optional and not enabled. Once Aleesha chooses a workspace, add a narrowly scoped Notion integration and server-side sync; Resend remains authoritative for subscription preferences.

## Prelaunch test
Use an owner-controlled email to test each form with checkbox on/off, duplicate retry, wrong address, missing configuration, provider failure, existing unsubscribed address, downloaded PDF, and the summary.
Confirm mobile thank-you bubble replaces the form, and no signup success appears on errors.

