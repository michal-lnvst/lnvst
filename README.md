# Webflow to GetResponse Webhook Integration

Complete webhook solution integrating:
- **Newsletter form** → GetResponse
- **Contact form** → Email + GetResponse (with spam filtering)
- **Cookie consent** → GDPR-compliant logging

All deployed on **Koyeb** in a single service.

## Features

- ✅ Newsletter form integration with GetResponse
- ✅ Contact form with email notifications
- ✅ Basic spam filtering (keywords, patterns, capitalization)
- ✅ GDPR-compliant consent logging with auto-cleanup (12 months)
- ✅ SQLite database (no separate DB needed)
- ✅ Email notifications via Nodemailer
- ✅ Error handling and logging
- ✅ Health check endpoint
- ✅ Optimized for free tier (&lt; 1000 requests/month)

## Prerequisites

- Node.js 18+ installed locally
- Webflow site with a form
- GetResponse account
- Koyeb account (for deployment)
- GitHub account (to host the code)

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Your Credentials

#### GetResponse API Key
1. Log in to [GetResponse](https://app.getresponse.com)
2. Go to **Integrations** → **API**
3. Create a new API key (or use an existing one)
4. Copy your API key

#### GetResponse List/Campaign ID
1. In GetResponse, go to **Contacts**
2. Find your newsletter list
3. Note the **Campaign ID** (visible in the URL or list settings)

#### Email Configuration
For sending contact form notifications, choose one:

**Option 1: Gmail (Easiest)**
1. Enable 2-factor authentication in your Google account
2. Go to [App passwords](https://myaccount.google.com/apppasswords)
3. Generate an app-specific password
4. Use your Gmail in `SMTP_USER` and the app password in `SMTP_PASS`

**Option 2: SendGrid**
1. Sign up at [SendGrid](https://sendgrid.com)
2. Go to **Settings** → **API Keys** → Create API key
3. Use: `SMTP_HOST=smtp.sendgrid.net`, `SMTP_USER=apikey`, `SMTP_PASS=your_api_key`

**Option 3: Mailgun**
1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Get SMTP credentials from dashboard
3. Use provided SMTP host, user, and password

### 3. Create .env File

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
PORT=3000
NODE_ENV=development

# GetResponse
GETRESPONSE_API_KEY=your_api_key_here
GETRESPONSE_LIST_ID=your_campaign_id_here

# Email (for contact form notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ADMIN_EMAIL=you@yourdomain.com

# Database
DATABASE_PATH=./data/app.db
```

### 4. Test Locally

```bash
npm start
```

The server will start on `http://localhost:3000`

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

## Webflow Configuration

### Newsletter Form

1. Open your newsletter form in Webflow Designer
2. Click on the **Form element**
3. Go to **Settings panel** (right side)
4. In the form settings, find "**On submit**" or **"Form action"** section
5. Select **"Redirect to custom webhook"** or **"POST to custom URL"**
6. Enter your webhook endpoint: `https://your-koyeb-domain.koyeb.app/webhook/webflow`
7. Make sure your form has an **Email field** (it will send all form fields to the webhook)

### Contact Form

1. Create a form with at least: `email`, `name`, `message` fields
2. In form settings, select **"POST to custom URL"**
3. Enter: `https://your-koyeb-domain.koyeb.app/webhook/contact`
4. Form data will be:
   - ✅ Added to GetResponse
   - ✅ Sent to your admin email
   - ✅ Stored in database for reference
   - ✅ Checked for spam

### Cookie Consent Logging

The consent logging is **frontend-handled**:

1. **Store choice locally:**
   ```javascript
   localStorage.setItem('consent-choice', 'accept'); // or 'reject'
   ```

2. **On first consent decision**, send to backend for GDPR compliance:
   ```javascript
   fetch('https://your-koyeb-domain.koyeb.app/api/consent/log', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       userIdentifier: 'user@example.com', // or anonymous ID
       consentType: 'analytics', // or 'marketing', etc.
       consentGiven: true
     })
   });
   ```

3. **Backend automatically:**
   - Logs the decision
   - Sets expiration to 12 months
   - Deletes expired logs daily
   - GDPR compliant ✅

### 2. Deploy and Get Your URL

Once deployed on Koyeb, your webhook URL will be:
```
https://your-service-name-xxxxx.koyeb.app
```

Update this URL in your Webflow form settings.

### 3. Field Mapping

The webhook automatically extracts email from common field names:
- `email`
- Fields containing "email" in the name
- First field of type `email`

If your email field has a different name, edit the `extractEmailFromWebflowData()` function in `index.js`.

## Deployment on Koyeb

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Webflow to GetResponse webhook"
git remote add origin https://github.com/YOUR_USERNAME/webflow-getresponse-webhook.git
git push -u origin main
```

### 2. Deploy on Koyeb

1. Sign up at [Koyeb](https://koyeb.com) (free tier available)
2. Click **Create Web Service**
3. **GitHub** → Select your repository
4. **Deployment settings:**
   - **Builder:** Node.js
   - **Build command:** `npm install`
   - **Run command:** `npm start`
5. **Environment variables:** Add all variables from your `.env`:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `GETRESPONSE_API_KEY`
   - `GETRESPONSE_LIST_ID`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
   - `ADMIN_EMAIL`
   - `DATABASE_PATH=./data/app.db`
6. Click **Deploy**

### 3. Get Your Public URL

Once deployed, Koyeb will give you a public URL like:
```
https://webflow-getresponse-xxxxx.koyeb.app
```

### 4. Configure Webflow Form

1. Go back to your Webflow form in Designer
2. Click the form element
3. In settings, find the "On submit" section
4. Make sure "POST to custom URL" is selected
5. Update the URL to: `https://your-koyeb-url.koyeb.app/webhook/webflow`
6. Publish your site

## Testing the Integration

### Test Newsletter Webhook

```bash
curl -X POST http://localhost:3000/webhook/webflow \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User"
  }'
```

### Test Contact Form Webhook

```bash
curl -X POST http://localhost:3000/webhook/contact \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@example.com",
    "name": "John Doe",
    "message": "This is a test message"
  }'
```

### Test Consent Logging

```bash
curl -X POST http://localhost:3000/api/consent/log \
  -H "Content-Type: application/json" \
  -d '{
    "userIdentifier": "user@example.com",
    "consentType": "analytics",
    "consentGiven": true
  }'
```

### Test with Live Webflow Forms

1. Fill out and submit your form on published Webflow site
2. Check the server logs: `npm start` output
3. Verify:
   - Contact in GetResponse (newsletter)
   - Email received at `ADMIN_EMAIL` (contact form)
   - Database entries created

## Troubleshooting

### "Email not found in submission"
- Ensure your Webflow form field is named `email` or contains "email"
- Check Koyeb logs for field names in incoming data
- Update `extractEmailFromWebflowData()` if needed

### "Email sending failed"
- Verify `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are correct
- For Gmail: use [app password](https://myaccount.google.com/apppasswords)
- Check email provider's documentation for SMTP settings
- Verify `ADMIN_EMAIL` is set

### "GetResponse API error"
- Verify `GETRESPONSE_API_KEY` is valid and not expired
- Check `GETRESPONSE_LIST_ID` matches an existing campaign
- Try listing contacts via GetResponse API to verify access

### Consent logs not creating
- Ensure request has `userIdentifier`, `consentType`, `consentGiven`
- Check that Koyeb environment variables are set
- Verify database path is writable

### Database issues on Koyeb
- SQLite works on Koyeb but files may be lost on redeploy
- For critical data, migrate to PostgreSQL (see next section)

## Optional: Using PostgreSQL Instead of SQLite

For production deployments on Koyeb, consider PostgreSQL for persistent storage:

1. In Koyeb dashboard, create a Managed PostgreSQL database
2. Get connection string: `postgresql://user:pass@host:port/dbname`
3. Install package: `npm install pg`
4. Replace `better-sqlite3` with `pg` module
5. Update database functions to use PostgreSQL syntax

This keeps data across redeployments and scales better.

## API Reference

### POST /webhook/webflow
Newsletter form submission to GetResponse.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

**Response:** `{ "success": true, "message": "Contact added to GetResponse" }`

---

### POST /webhook/contact
Contact form submission with email notification and spam filtering.

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "message": "I have a question..."
}
```

**Response:** `{ "success": true, "message": "Thank you for your message" }`

**Features:**
- ✅ Spam filtering (detects keywords, links, patterns)
- ✅ Email sent to `ADMIN_EMAIL`
- ✅ Contact added to GetResponse
- ✅ Stored in SQLite for reference

---

### POST /api/consent/log
GDPR-compliant consent logging (called from frontend).

**Request Body:**
```json
{
  "userIdentifier": "user@example.com",
  "consentType": "analytics",
  "consentGiven": true
}
```

**Response:** `{ "success": true, "message": "Consent logged" }`

**Features:**
- ✅ Logged to SQLite
- ✅ Auto-expires after 12 months
- ✅ Daily cleanup task runs automatically
- ✅ GDPR compliant

---

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-03-19T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Customization

### Modify Form Field Extraction

Edit `extractEmailFromWebflowData()` in `index.js` to match your form field names.

Example for a custom email field name:
```javascript
function extractEmailFromWebflowData(data) {
  // Check for custom field name first
  if (data.newsletter_email) return data.newsletter_email;
  // Fall back to defaults
  if (data.email) return data.email;
  // ... rest of function
}
```

### Add More Contact Fields to GetResponse

Update `addContactToGetResponse()` to send additional fields:

```javascript
const contactData = {
  email: email,
  name: name || email,
  phone: data.phone, // Add more fields
  campaign: {
    campaignId: listId
  }
};
```

## Security Best Practices

- ✅ Keep `GETRESPONSE_API_KEY` secure and never commit to version control
- ✅ Use HTTPS for all API calls (Koyeb provides this automatically)
- ✅ Validate email format before sending to GetResponse
- ✅ Monitor logs for errors and suspicious activity
- ✅ Use environment variables for all sensitive credentials

## Support

For issues with:
- **Webflow:** Check [Webflow Webhooks Documentation](https://developers.webflow.com/#webhooks)
- **GetResponse:** Visit [GetResponse API Docs](https://apidocs.getresponse.com/)
- **Koyeb:** See [Koyeb Documentation](https://docs.koyeb.com/)

## License

MIT

---

**Created:** 2024
**Version:** 1.0.0
#   l n v s t  
 