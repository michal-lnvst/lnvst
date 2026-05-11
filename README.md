# lnvst Webhook Service

Node.js service for handling:

- newsletter signups -> GetResponse newsletter list
- contact form submissions -> SQLite + optional email notification + GetResponse contact leads list
- cookie consent logs -> SQLite with automatic cleanup

Designed to be deployed on Koyeb and connected to Webflow forms.

## Endpoints

- `POST /webhook/newsletter`
- `POST /webhook/contact`
- `POST /api/consent/log` (legacy compatibility)
- `POST /api/consent/preferences`
- `POST /api/consent/withdraw`
- `GET /api/consent/preferences/:consentId`
- `GET /health`

Legacy compatibility:

- `POST /webhook/webflow` -> same handler as `/webhook/newsletter`

## Requirements

- Node.js 18+
- GetResponse account
- Koyeb account
- Webflow project

## Environment Variables

Copy `.env.example` to `.env` for local development.

Required for GetResponse:

```env
GETRESPONSE_API_KEY=your_api_key_here
GETRESPONSE_LIST_ID_NEWSLETTER=your_newsletter_campaign_id_here
GETRESPONSE_LIST_ID_CONTACTS=your_contact_leads_campaign_id_here
```

Optional for additional contact data in GetResponse:

```env
GETRESPONSE_CUSTOM_FIELD_ID_COMPANY=
GETRESPONSE_CUSTOM_FIELD_ID_PHONE=
GETRESPONSE_CUSTOM_FIELD_ID_MESSAGE=
```

These IDs are `customFieldId` values from GetResponse custom fields. If set, the app maps form values (company, phone, message) into those fields.

Optional for email notifications:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ADMIN_EMAIL=you@yourdomain.com
```

General:

```env
PORT=3000
NODE_ENV=development
DATABASE_PATH=./data/app.db

# Browser access from Webflow domain(s)
CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com

# Consent retention and hashing
CONSENT_RETENTION_MONTHS=12
CONSENT_HASH_SALT=replace_with_random_secret

# Contact anti-spam (lightweight)
CONTACT_MIN_SUBMIT_SECONDS=3
CONTACT_RATE_LIMIT_WINDOW_MS=60000
CONTACT_RATE_LIMIT_MAX=5
CONTACT_HONEYPOT_FIELDS=company_fax

# Optional browser redirects for contact form submissions
CONTACT_SUCCESS_REDIRECT_URL=https://example.com/contact-success
CONTACT_ERROR_REDIRECT_URL=https://example.com/contact-error
CONTACT_SUCCESS_REDIRECT_URL_PL=https://example.com/pl/kontakt/dziekujemy
CONTACT_SUCCESS_REDIRECT_URL_EN=https://example.com/en/contact/thank-you
CONTACT_ERROR_REDIRECT_URL_PL=https://example.com/pl/kontakt/blad
CONTACT_ERROR_REDIRECT_URL_EN=https://example.com/en/contact/error

# Optional browser redirects for newsletter submissions
NEWSLETTER_SUCCESS_REDIRECT_URL=https://example.com/newsletter/success
NEWSLETTER_ERROR_REDIRECT_URL=https://example.com/newsletter/error
NEWSLETTER_SUCCESS_REDIRECT_URL_PL=https://example.com/pl/newsletter/sukces
NEWSLETTER_SUCCESS_REDIRECT_URL_EN=https://example.com/en/newsletter/success
NEWSLETTER_ERROR_REDIRECT_URL_PL=https://example.com/pl/newsletter/blad
NEWSLETTER_ERROR_REDIRECT_URL_EN=https://example.com/en/newsletter/error
```

Notes:

- if SMTP is not configured correctly, contact submissions still save to the database
- `.env` is ignored by Git and should never be committed

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

## Local Test Examples

Newsletter:

```bash
curl -X POST http://localhost:3000/webhook/newsletter \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User"}'
```

Contact:

```bash
curl -X POST http://localhost:3000/webhook/contact \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@example.com","name":"John Doe","message":"Hello"}'
```

Consent log (legacy endpoint):

```bash
curl -X POST http://localhost:3000/api/consent/log \
  -H "Content-Type: application/json" \
  -d '{"userIdentifier":"user@example.com","consentType":"analytics","consentGiven":true}'
```

Consent preferences (new endpoint):

```bash
curl -X POST http://localhost:3000/api/consent/preferences \
  -H "Content-Type: application/json" \
  -d '{"consentId":"11111111-1111-1111-1111-111111111111","action":"save_preferences","preferences":{"analytics":true,"marketing":false,"personalization":false},"policyVersion":"2026-03","bannerVersion":"v1","consentSource":"webflow_modal"}'
```

## Webflow Setup

Configure your forms to POST to these URLs:

- newsletter form -> `https://your-service.koyeb.app/webhook/newsletter`
- contact form -> `https://your-service.koyeb.app/webhook/contact`

The newsletter endpoint tries to extract the email from common field names such as `email` or any key containing `email`.

## Koyeb Deployment

1. Push this repository to GitHub.
2. In Koyeb, create a new service from the GitHub repository.
3. Use:
   - build command: `npm install`
   - run command: `npm start`
   - port: `3000`
4. Add environment variables from your local `.env` to Koyeb.
5. Deploy and test `/health`.

Recommended Koyeb variables:

```env
PORT=3000
NODE_ENV=production
DATABASE_PATH=./data/app.db
GETRESPONSE_API_KEY=...
GETRESPONSE_LIST_ID_NEWSLETTER=...
GETRESPONSE_LIST_ID_CONTACTS=...
```

Optional SMTP variables can be added later.

## Behavior Summary

`POST /webhook/newsletter`

- validates that an email can be extracted
- sends contact to the newsletter list in GetResponse

`POST /webhook/contact`

- validates email
- applies basic spam filtering
- applies lightweight anti-spam controls:
  - honeypot hidden field check
  - optional minimum form-fill time check
  - per-IP rate limiting
- stores submission in SQLite
- attempts email notification if SMTP is configured
- attempts to add the contact to the GetResponse contacts list
- optionally maps company/phone/message to GetResponse custom fields

### Contact Form Anti-Spam Setup (No CAPTCHA)

Use this setup if you want low friction and can tolerate occasional spam.

1. Add a hidden honeypot input in your Webflow contact form, for example `company_fax`.
2. When the form loads, store a timestamp in a hidden input, for example `form_started_at`.
3. Keep the defaults in `.env` (or tune):
   - `CONTACT_MIN_SUBMIT_SECONDS=3`
   - `CONTACT_RATE_LIMIT_WINDOW_MS=60000`
   - `CONTACT_RATE_LIMIT_MAX=5`
   - `CONTACT_HONEYPOT_FIELDS=company_fax`

Backend behavior:

- submissions with filled honeypot field are silently accepted but ignored
- submissions faster than minimum threshold are silently accepted but ignored
- bursts over rate limit return `429 Too Many Requests`

### Contact Form Thank-You Page Redirect

If your Webflow form posts directly to the backend, the browser will otherwise land on the raw API response.

Set these environment variables to redirect users back to your site:

- `CONTACT_SUCCESS_REDIRECT_URL=https://yourdomain.com/contact-success`
- `CONTACT_ERROR_REDIRECT_URL=https://yourdomain.com/contact-error`

Behavior:

- browser form submissions are redirected with `303 See Other`
- API requests still receive JSON
- redirect URLs get query params like `success=1`, `message=...`, or `error=...`

### Newsletter Thank-You Page (PL/EN)

`POST /webhook/newsletter` now behaves like contact form responses for browser submits:

- if redirect URL vars are set, user is redirected with `303 See Other`
- if redirect URL vars are not set, backend renders a built-in thank-you/error HTML page
- language is auto-detected from `lang`/`locale` (query/body), `Accept-Language`, and referrer path (`/pl/` or `/en/`)

Recommended env vars for separate language pages:

- `NEWSLETTER_SUCCESS_REDIRECT_URL_PL=https://yourdomain.com/pl/newsletter/dziekujemy`
- `NEWSLETTER_SUCCESS_REDIRECT_URL_EN=https://yourdomain.com/en/newsletter/thank-you`
- `NEWSLETTER_ERROR_REDIRECT_URL_PL=https://yourdomain.com/pl/newsletter/blad`
- `NEWSLETTER_ERROR_REDIRECT_URL_EN=https://yourdomain.com/en/newsletter/error`

Equivalent PL/EN vars are available for contact form redirects:

- `CONTACT_SUCCESS_REDIRECT_URL_PL=...`
- `CONTACT_SUCCESS_REDIRECT_URL_EN=...`
- `CONTACT_ERROR_REDIRECT_URL_PL=...`
- `CONTACT_ERROR_REDIRECT_URL_EN=...`

`POST /api/consent/log`

- stores consent decision in SQLite
- sets 12-month expiration
- expired records are cleaned up automatically

`POST /api/consent/preferences`

- stores full cookie preferences for categories: necessary, analytics, marketing, personalization
- records consent metadata: action, policy version, banner version, locale, region
- stores pseudonymous proof fields (IP, user agent, optional hashed user identifier)
- returns normalized preferences that your frontend should enforce immediately

`POST /api/consent/withdraw`

- creates a consent event that revokes non-essential categories
- should be available from privacy settings/footer at all times

`GET /api/consent/preferences/:consentId`

- returns latest non-expired preferences for a consent ID
- useful for restoring settings when the user returns

## GDPR Cookie Management (Webflow)

Recommended UI model (matches your plan):

- modal with two tabs:
  - tab 1: summary and legal description
  - tab 2: category toggles (granular controls)
- global actions outside tabs: Accept all, Reject all, Save settings
- permanent "Change cookie settings" link to reopen modal and withdraw consent

Implementation playbook and copy-paste script:

- see `docs/webflow-cookie-consent.md`

Critical GDPR behavior rules:

- do not load analytics/marketing scripts until user gives consent
- Reject all must be as visible/easy as Accept all
- category toggles must default to off (except necessary)
- log policy/banner version with each consent action
- allow withdrawal at any time with same effort as giving consent

## Current Caveat

The GetResponse integration is implemented, but if requests return authentication errors, verify the API key and header format against the GetResponse account you're deploying with. The app will still run even if GetResponse or SMTP are not configured correctly.

## Security

- do not commit `.env`
- do not expose API keys in frontend code
- use Koyeb environment variables in production

## License

MIT
