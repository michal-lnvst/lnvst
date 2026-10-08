# lnvst Webhook Service

Node.js service for handling:

- newsletter signups -> GetResponse newsletter list
- contact form submissions -> SQLite + optional email notification + GetResponse contact leads list

Designed to be deployed on Koyeb and connected to Webflow forms.

## Endpoints

- `POST /webhook/newsletter`
- `POST /webhook/contact`
- `POST /webhook/rebranding`
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
GETRESPONSE_LIST_ID_REBRANDING=your_rebranding_leads_campaign_id_here
GETRESPONSE_CUSTOM_FIELD_ID_BUDGET=
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

# Contact anti-spam (lightweight)
CONTACT_MIN_SUBMIT_SECONDS=3
CONTACT_RATE_LIMIT_WINDOW_MS=60000
CONTACT_RATE_LIMIT_MAX=5
CONTACT_HONEYPOT_FIELDS=company_fax
CONTACT_DEBUG_LOG_VALUES=false
CONTACT_DEBUG_LOG_INCLUDE_RAW=false

# Optional browser redirects for contact form submissions
CONTACT_SUCCESS_REDIRECT_URL=https://example.com/contact-success
CONTACT_ERROR_REDIRECT_URL=https://example.com/contact-error
```

Notes:

- if SMTP is not configured correctly, contact submissions still save to the database
- `.env` is ignored by Git and should never be committed
- for GDPR-friendly diagnostics, keep `CONTACT_DEBUG_LOG_INCLUDE_RAW=false` (default)

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

## Webflow Setup

Configure your forms to POST to these URLs:

- newsletter form -> `https://your-service.koyeb.app/webhook/newsletter`
- contact form -> `https://your-service.koyeb.app/webhook/contact`
- rebranding form -> `https://your-service.koyeb.app/webhook/rebranding` (requires a budget field; optional `REBRANDING_NOTIFY_EMAIL` (default lena@lenivastudio.com), `REBRANDING_SUCCESS_REDIRECT_URL`, `REBRANDING_ERROR_REDIRECT_URL`)

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

For persistent contact logs on Koyeb, use a mounted volume and update:

```env
DATABASE_PATH=/data/app.db
```

### Koyeb Persistent Storage (required for GDPR log durability)

1. In Koyeb service settings, add a persistent volume.
2. Mount it at `/data`.
3. Set environment variable: `DATABASE_PATH=/data/app.db`.
4. Redeploy the service.
5. Verify logs show `Loaded existing database` on restart (not `Created new database`).

If you keep `DATABASE_PATH=./data/app.db` in production, logs may be lost on instance replacement.

Email notifications: set `RESEND_API_KEY` (and `RESEND_FROM`, a sender on a domain verified in Resend) to send via the Resend HTTPS API; otherwise the SMTP variables are used.

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
- attempts email notification if Resend or SMTP is configured
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

## Current Caveat

The GetResponse integration is implemented, but if requests return authentication errors, verify the API key and header format against the GetResponse account you're deploying with. The app will still run even if GetResponse or SMTP are not configured correctly.

## Security

- do not commit `.env`
- do not expose API keys in frontend code
- use Koyeb environment variables in production

## License

MIT
