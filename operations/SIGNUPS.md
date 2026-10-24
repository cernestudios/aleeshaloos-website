# Aleesha website signups

The site has two separate flows: the public project enquiry form and the optional Halloween/Wobble signup forms.

## Resend
- The existing website sender uses the `RESEND_API_KEY` Cloudflare secret and `CONTACT_FROM_EMAIL`.
- The key shown in Aleesha’s Resend account is sending-only, restricted to `send.aleeshaloos.com`. The sender address configured in Cloudflare must match that verified domain.
- Signup confirmations use the same sending-only key. The signup handler does not create or update Resend contacts, segments, or topics.
- Do not put API keys or customer data in GitHub.

## Signup storage and activation
- Signups and the optional general-updates consent are stored in Cloudflare D1 using `signup-schema.sql`.
- Bind the D1 database as `SIGNUP_DB`.
- Set `HALLOWEEN_PDF_URL` to the live PDF URL.
- Set `SIGNUPS_ENABLED=true` only after the database and sender are configured and verified. Until then both signup forms remain paused; the Halloween PDF remains directly downloadable.
- Successful signups receive a confirmation email. Aleesha receives a notification at `hello@aleeshaloos.com`.
- General updates are not added to a Resend marketing list yet. Notion integration and future campaign-list sync are deferred to the next setup step.

## Pre-launch review
Use an owner-controlled address to verify the Halloween and Wobble flows, email delivery, D1 consent records, duplicate retries, invalid addresses, and paused-form behavior before enabling signups.
