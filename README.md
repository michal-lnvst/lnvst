# lnvst Webhook Service

Node.js service for handling:

- newsletter signups -> GetResponse newsletter list
- contact form submissions -> SQLite + optional email notification + GetResponse contact leads list
- cookie consent logs -> SQLite with automatic cleanup

Designed to be deployed on Koyeb and connected to Webflow forms.

## Endpoints

- `POST /webhook/newsletter`
- `POST /webhook/contact`
- `POST /api/consent/log`
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

Consent log:

```bash
curl -X POST http://localhost:3000/api/consent/log \
  -H "Content-Type: application/json" \
  -d '{"userIdentifier":"user@example.com","consentType":"analytics","consentGiven":true}'
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
- stores submission in SQLite
- attempts email notification if SMTP is configured
- attempts to add the contact to the GetResponse contacts list

`POST /api/consent/log`

- stores consent decision in SQLite
- sets 12-month expiration
- expired records are cleaned up automatically

## Current Caveat

The GetResponse integration is implemented, but if requests return authentication errors, verify the API key and header format against the GetResponse account you're deploying with. The app will still run even if GetResponse or SMTP are not configured correctly.

## Security

- do not commit `.env`
- do not expose API keys in frontend code
- use Koyeb environment variables in production

## License

MIT
