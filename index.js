require('dotenv').config();

console.log('Node.js process started, env PORT:', process.env.PORT);

const express = require('express');
const axios = require('axios');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');
const validator = require('validator');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CONTACT_MIN_SUBMIT_SECONDS = Number(process.env.CONTACT_MIN_SUBMIT_SECONDS || 3);
const CONTACT_RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS || 60000);
const CONTACT_RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX || 5);
const CONTACT_HONEYPOT_FIELDS = (process.env.CONTACT_HONEYPOT_FIELDS || 'company_fax')
  .split(',')
  .map(field => field.trim().toLowerCase())
  .filter(Boolean);
const CONTACT_SUCCESS_REDIRECT_URL = process.env.CONTACT_SUCCESS_REDIRECT_URL || '';
const CONTACT_ERROR_REDIRECT_URL = process.env.CONTACT_ERROR_REDIRECT_URL || '';
const REBRANDING_SUCCESS_REDIRECT_URL = process.env.REBRANDING_SUCCESS_REDIRECT_URL || CONTACT_SUCCESS_REDIRECT_URL;
const REBRANDING_ERROR_REDIRECT_URL = process.env.REBRANDING_ERROR_REDIRECT_URL || CONTACT_ERROR_REDIRECT_URL;
const REBRANDING_NOTIFY_EMAIL = process.env.REBRANDING_NOTIFY_EMAIL || 'lena@lenivastudio.com';

const contactRateLimitStore = new Map();

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE INITIALIZATION
// ============================================

let dbPath = process.env.DATABASE_PATH || './data/app.db';
let dbDir = path.dirname(dbPath);
let db = null;
let SQL = null;

function switchToFallbackDatabasePath(reason) {
  const fallbackPath = '/tmp/app.db';
  console.warn(`Database path fallback: ${reason}. Using ${fallbackPath} instead.`);
  return fallbackPath;
}

// Initialize database
async function initializeDatabase() {
  console.log('Initializing database...');

  // Initialize SQL.js with an explicit WASM path for container environments.
  SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file)
  });

  // Create database directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        dbPath = switchToFallbackDatabasePath(`cannot create ${dbDir} (${error.code})`);
        dbDir = path.dirname(dbPath);
      } else {
        throw error;
      }
    }
  }

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    db = new SQL.Database(data);
    console.log('Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('Created new database');
  }

  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS rebranding_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      message TEXT,
      budget TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);
  `);

  console.log('Database initialized successfully');

  saveDatabase();
}

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Initialize database before starting server
let serverStarted = false;

// ============================================
// EMAIL SETUP
// ============================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ============================================
// NEWSLETTER WEBHOOK HANDLER (legacy /webflow alias included)
// ============================================


async function webhookNewsletterHandler(req, res) {
  try {
    console.log('Newsletter form submission received:', req.body);

    // Extract email from form data
    const email = extractEmailFromWebflowData(req.body);
    if (!email) {
      console.warn('No email found in submission');
      return respondForNewsletterRequest(req, res, 400, { error: 'Email not found in submission' });
    }

    // Send to GetResponse newsletter list
    await addContactToGetResponse(email, req.body, 'newsletter');

    console.log(`Successfully added ${email} to GetResponse newsletter list`);
    return respondForNewsletterRequest(req, res, 200, { success: true, message: 'Contact added to GetResponse newsletter' });

  } catch (error) {
    console.error('Newsletter webhook error:', error.message);
    return respondForNewsletterRequest(req, res, 500, { error: error.message });
  }
}
// Newsletter redirect/response logic
const NEWSLETTER_SUCCESS_REDIRECT_URL_PL = process.env.NEWSLETTER_SUCCESS_REDIRECT_URL_PL || '';
const NEWSLETTER_SUCCESS_REDIRECT_URL_EN = process.env.NEWSLETTER_SUCCESS_REDIRECT_URL_EN || '';
const NEWSLETTER_ERROR_REDIRECT_URL_PL = process.env.NEWSLETTER_ERROR_REDIRECT_URL_PL || '';
const NEWSLETTER_ERROR_REDIRECT_URL_EN = process.env.NEWSLETTER_ERROR_REDIRECT_URL_EN || '';

function getNewsletterLocale(req) {
  const referer = (req.headers.referer || req.headers.referrer || '').toString();
  return referer.includes('/en') ? 'en' : 'pl';
}

function respondForNewsletterRequest(req, res, statusCode, payload) {
  const locale = getNewsletterLocale(req);
  const successUrl = locale === 'pl' ? NEWSLETTER_SUCCESS_REDIRECT_URL_PL : NEWSLETTER_SUCCESS_REDIRECT_URL_EN;
  const errorUrl = locale === 'pl' ? NEWSLETTER_ERROR_REDIRECT_URL_PL : NEWSLETTER_ERROR_REDIRECT_URL_EN;
  const redirectBaseUrl = statusCode >= 400 ? (errorUrl || successUrl) : successUrl;
  const redirectUrl = buildRedirectUrl(redirectBaseUrl, payload);
  if (redirectUrl) {
    return res.redirect(303, redirectUrl);
  }
  return res.status(statusCode).json(payload);
}

app.post('/webhook/newsletter', webhookNewsletterHandler);
app.post('/webhook/webflow', webhookNewsletterHandler); // backwards compatibility

// ============================================
// CONTACT FORM WEBHOOK
// ============================================

app.post('/webhook/contact', async (req, res) => {
  try {
    console.log('Contact form submission received:', req.body);

    const ipAddress = getClientIp(req);

    const rateLimit = getContactRateLimitStatus(ipAddress);
    if (rateLimit.limited) {
      return respondForContactRequest(req, res, 429, {
        error: 'Too many submissions. Please try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }

    if (isHoneypotTriggered(req.body)) {
      console.warn(`Honeypot triggered from ${ipAddress}`);
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' });
    }

    if (isSubmittedTooQuickly(req.body)) {
      console.warn(`Submission rejected due to fast submit from ${ipAddress}`);
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' });
    }

    const email = extractEmailFromWebflowData(req.body);
    const name = extractNameFromWebflowData(req.body) || 'Anonymous';
    const message = extractMessageFromWebflowData(req.body);

    // Validate email
    if (!email || !validator.isEmail(email)) {
      return respondForContactRequest(req, res, 400, { error: 'Valid email required' });
    }

    // Basic spam filtering
    if (isSpam(message, email, name)) {
      console.warn(`Spam detected from ${email}`);
      // Still return 200 to not reveal to spammers
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' });
    }

    // Store in database
    db.run(
      `INSERT INTO contact_submissions (email, name, message, ip_address)
       VALUES (?, ?, ?, ?)`,
      [email, name, message, ipAddress]
    );
    saveDatabase();

    // Send email notification (optional - don't fail if missing credentials)
    try {
      await sendContactEmailNotification(email, name, message);
    } catch (err) {
      console.warn('Email notification skipped:', err.message);
    }

    // Optionally add to GetResponse (contact leads list)
    try {
      await addContactToGetResponse(email, { ...req.body, name, message }, 'contacts');
    } catch (err) {
      console.warn('Failed to add contact to GetResponse:', err.message);
      // Don't fail the request if GetResponse fails
    }

    console.log(`Contact form submitted by ${email}`);
    return respondForContactRequest(req, res, 200, { success: true, message: 'Thank you for your message' });

  } catch (error) {
    console.error('Contact webhook error:', error.message);
    return respondForContactRequest(req, res, 500, { error: error.message });
  }
});

// ============================================
// REBRANDING FORM WEBHOOK
// ============================================

app.post('/webhook/rebranding', async (req, res) => {
  const urls = { success: REBRANDING_SUCCESS_REDIRECT_URL, error: REBRANDING_ERROR_REDIRECT_URL };

  try {
    console.log('Rebranding form submission received');

    const ipAddress = getClientIp(req);

    const rateLimit = getContactRateLimitStatus(ipAddress, 'rebranding');
    if (rateLimit.limited) {
      return respondForContactRequest(req, res, 429, {
        error: 'Too many submissions. Please try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }, urls);
    }

    if (isHoneypotTriggered(req.body) || isSubmittedTooQuickly(req.body)) {
      console.warn(`Rebranding submission silently dropped (honeypot/fast submit) from ${ipAddress}`);
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' }, urls);
    }

    const email = extractEmailFromWebflowData(req.body);
    const name = extractNameFromWebflowData(req.body) || 'Anonymous';
    const message = extractMessageFromWebflowData(req.body);
    const budget = extractBudgetFromWebflowData(req.body);

    if (!email || !validator.isEmail(email)) {
      return respondForContactRequest(req, res, 400, { error: 'Valid email required' }, urls);
    }

    if (!budget) {
      return respondForContactRequest(req, res, 400, { error: 'Budget selection required' }, urls);
    }

    if (isSpam(message, email, name)) {
      console.warn(`Spam detected from ${email}`);
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' }, urls);
    }

    db.run(
      `INSERT INTO rebranding_submissions (email, name, message, budget, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [email, name, message, budget, ipAddress]
    );
    saveDatabase();

    try {
      await sendContactEmailNotification(email, name, message, {
        to: REBRANDING_NOTIFY_EMAIL,
        formLabel: 'Rebranding',
        budget
      });
    } catch (err) {
      console.warn('Email notification skipped:', err.message);
    }

    try {
      await addContactToGetResponse(email, { ...req.body, name, message }, 'rebranding');
    } catch (err) {
      console.warn('Failed to add rebranding lead to GetResponse:', err.message);
    }

    console.log(`Rebranding form submitted by ${email}`);
    return respondForContactRequest(req, res, 200, { success: true, message: 'Thank you for your message' }, urls);

  } catch (error) {
    console.error('Rebranding webhook error:', error.message);
    return respondForContactRequest(req, res, 500, { error: error.message }, urls);
  }
});
// ============================================
// SPAM FILTERING
// ============================================

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || '';
}

function getContactRateLimitStatus(ipAddress, scope = 'contact') {
  const now = Date.now();
  const safeWindowMs = Number.isFinite(CONTACT_RATE_LIMIT_WINDOW_MS) && CONTACT_RATE_LIMIT_WINDOW_MS > 0
    ? CONTACT_RATE_LIMIT_WINDOW_MS
    : 60000;
  const safeLimit = Number.isFinite(CONTACT_RATE_LIMIT_MAX) && CONTACT_RATE_LIMIT_MAX > 0
    ? CONTACT_RATE_LIMIT_MAX
    : 5;

  // Keep this map small over time.
  for (const [key, record] of contactRateLimitStore.entries()) {
    if (now - record.windowStart > safeWindowMs * 2) {
      contactRateLimitStore.delete(key);
    }
  }

  const key = `:`;
  const existing = contactRateLimitStore.get(key);

  if (!existing || now - existing.windowStart > safeWindowMs) {
    contactRateLimitStore.set(key, { count: 1, windowStart: now });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  contactRateLimitStore.set(key, existing);

  if (existing.count > safeLimit) {
    const remainingMs = Math.max(0, safeWindowMs - (now - existing.windowStart));
    return {
      limited: true,
      retryAfterSeconds: Math.ceil(remainingMs / 1000)
    };
  }

  return { limited: false, retryAfterSeconds: 0 };
}

function parseTimestampMs(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Treat values smaller than 1e12 as seconds.
    return value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return null;
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function extractStartedAtMs(data) {
  if (!data || typeof data !== 'object') return null;

  const startedAtKeys = [
    'formStartedAt',
    'form_started_at',
    'startedAt',
    'started_at',
    'submittedFromTs',
    'submitted_from_ts'
  ];

  for (const key of startedAtKeys) {
    const parsed = parseTimestampMs(data[key]);
    if (parsed) return parsed;
  }

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes('started') || lowerKey.includes('start_time')) && !lowerKey.includes('submit')) {
      const parsed = parseTimestampMs(value);
      if (parsed) return parsed;
    }
  }

  return null;
}

function isSubmittedTooQuickly(data) {
  if (CONTACT_MIN_SUBMIT_SECONDS <= 0) return false;

  const startedAtMs = extractStartedAtMs(data);
  if (!startedAtMs) return false;

  const elapsedMs = Date.now() - startedAtMs;
  if (elapsedMs < 0) return false;

  return elapsedMs < CONTACT_MIN_SUBMIT_SECONDS * 1000;
}

function isHoneypotTriggered(data) {
  if (!data || typeof data !== 'object') return false;
  if (CONTACT_HONEYPOT_FIELDS.length === 0) return false;

  for (const fieldName of CONTACT_HONEYPOT_FIELDS) {
    const matchingKey = Object.keys(data).find(key => key.toLowerCase() === fieldName);
    if (!matchingKey) continue;

    const value = data[matchingKey];
    if (typeof value === 'string' && value.trim().length > 0) {
      return true;
    }

    if (Array.isArray(value) && value.length > 0) {
      return true;
    }
  }

  return false;
}

function isSpam(message, email, name) {
  const messageStr = (message || '').toLowerCase();
  const emailStr = (email || '').toLowerCase();
  const nameStr = (name || '').toLowerCase();

  // Check for common spam patterns
  const spamPatterns = [
    /viagra|cialis|casino|lottery|bitcoin|crypto|nude|porn/gi,
    /click here|buy now|limited time|act now|urgent/gi,
    /href=|<a href|onclick/gi, // HTML/script injection
    /\d{4}\s?\d{4}\s?\d{4}\s?\d{4}/, // Credit card patterns
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(messageStr) || pattern.test(emailStr) || pattern.test(nameStr)) {
      return true;
    }
  }

  // Check for excessive links
  const linkCount = (messageStr.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) return true;

  // Check for excessive capitalization
  const capsRatio = (messageStr.match(/[A-Z]/g) || []).length / (messageStr.length || 1);
  if (capsRatio > 0.5 && messageStr.length > 20) return true;

  // Message is optional, but if provided it should be reasonable length
  if (messageStr.length > 0 && messageStr.length < 5) return true;
  if (messageStr.length > 5000) return true;

  return false;
}

function requestPrefersHtml(req) {
  const acceptHeader = (req.headers.accept || '').toString().toLowerCase();
  return acceptHeader.includes('text/html');
}

function buildRedirectUrl(baseUrl, payload = {}) {
  if (!baseUrl) return null;

  try {
    const url = new URL(baseUrl);

    if (typeof payload.success === 'boolean') {
      url.searchParams.set('success', payload.success ? '1' : '0');
    }

    if (payload.message) {
      url.searchParams.set('message', payload.message);
    }

    if (payload.error) {
      url.searchParams.set('error', payload.error);
    }

    if (payload.retryAfterSeconds) {
      url.searchParams.set('retryAfterSeconds', String(payload.retryAfterSeconds));
    }

    return url.toString();
  } catch (error) {
    console.warn('Invalid redirect URL configuration:', error.message);
    return null;
  }
}

function respondForContactRequest(req, res, statusCode, payload, urls = {}) {
  if (requestPrefersHtml(req)) {
    const successUrl = urls.success || CONTACT_SUCCESS_REDIRECT_URL;
    const errorUrl = urls.error || CONTACT_ERROR_REDIRECT_URL;
    const redirectBaseUrl = statusCode >= 400
      ? (errorUrl || successUrl)
      : successUrl;
    const redirectUrl = buildRedirectUrl(redirectBaseUrl, payload);

    if (redirectUrl) {
      return res.redirect(statusCode >= 400 ? 303 : 303, redirectUrl);
    }
  }

  return res.status(statusCode).json(payload);
}

// ============================================
// SEND CONTACT EMAIL NOTIFICATION
// ============================================

async function sendContactEmailNotification(email, name, message, options = {}) {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.SMTP_HOST) {
      console.warn('Email configuration missing, skipping notification');
      return;
    }

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: options.to || process.env.ADMIN_EMAIL,
      subject: `New ${options.formLabel || 'Contact'} Form Submission from ${name || email}`,
      html: `
        <h2>New ${options.formLabel || 'Contact'} Form Submission</h2>
        <p><strong>From:</strong> ${escapeHtml(name || 'Anonymous')} (${escapeHtml(email)})</p>
        ${options.budget ? `<p><strong>Budget:</strong> ${escapeHtml(options.budget)}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          Submitted at: ${new Date().toISOString()}
        </p>
      `
    });

    console.log(`Email notification sent for ${email}`);
  } catch (error) {
    console.error('Failed to send email notification:', error.message);
    throw error;
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return (text || '').replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// EXTRACT EMAIL FROM WEBFLOW DATA
// ============================================

function extractEmailFromWebflowData(data) {
  if (!data || typeof data !== 'object') return null;

  // Webflow form data structure varies - adapt based on your form fields
  // Common patterns:
  
  // If email is a direct field
  if (data.email) return data.email;
  
  // If email is nested in fields array
  if (Array.isArray(data)) {
    const emailField = data.find(
      field => field.name === 'email' || field.type === 'email'
    );
    if (emailField) return emailField.value;
  }

  // If data is an object with field names as keys
  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes('email') && typeof value === 'string') {
      return value;
    }
  }

  return null;
}

// ============================================
// GETRESPONSE API INTEGRATION
// ============================================

async function addContactToGetResponse(email, webflowData, listType = 'newsletter') {
  const apiKey = process.env.GETRESPONSE_API_KEY;
  const listIds = {
    contacts: process.env.GETRESPONSE_LIST_ID_CONTACTS,
    rebranding: process.env.GETRESPONSE_LIST_ID_REBRANDING
  };
  const listId = listIds[listType] || process.env.GETRESPONSE_LIST_ID_NEWSLETTER;

  if (!apiKey || !listId) {
    throw new Error('GetResponse API key or List ID not configured for ' + listType);
  }

  try {
    // Extract name if available from Webflow data
    const name = extractNameFromWebflowData(webflowData);
    const company = extractCompanyFromWebflowData(webflowData);
    const phone = extractPhoneFromWebflowData(webflowData);
    const message = extractMessageFromWebflowData(webflowData);

    // Prepare contact data for GetResponse
    const contactData = {
      email: email,
      name: name || email,
      campaign: {
        campaignId: listId
      }
    };

    const customFieldValues = [];
    const companyFieldId = process.env.GETRESPONSE_CUSTOM_FIELD_ID_COMPANY;
    const phoneFieldId = process.env.GETRESPONSE_CUSTOM_FIELD_ID_PHONE;
    const messageFieldId = process.env.GETRESPONSE_CUSTOM_FIELD_ID_MESSAGE;
    const budgetFieldId = process.env.GETRESPONSE_CUSTOM_FIELD_ID_BUDGET;
    const budget = listType === 'rebranding' ? extractBudgetFromWebflowData(webflowData) : '';

    if (companyFieldId && company) {
      customFieldValues.push({
        customFieldId: companyFieldId,
        value: [company]
      });
    }

    if (phoneFieldId && phone) {
      customFieldValues.push({
        customFieldId: phoneFieldId,
        value: [phone]
      });
    }

    if (messageFieldId && message) {
      customFieldValues.push({
        customFieldId: messageFieldId,
        value: [message]
      });
    }

    if (budgetFieldId && budget) {
      customFieldValues.push({
        customFieldId: budgetFieldId,
        value: [budget]
      });
    }

    if (customFieldValues.length > 0) {
      contactData.customFieldValues = customFieldValues;
    }

    if (listType === 'rebranding') {
      console.log('Rebranding budget:', JSON.stringify(budget), 'budgetFieldId set:', Boolean(budgetFieldId), 'customFieldValues:', JSON.stringify(customFieldValues));
    }

    // Make request to GetResponse API
    const response = await axios.post(
      'https://api.getresponse.com/v3/contacts',
      contactData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': `api-key ${apiKey}`
        }
      }
    );

    console.log('GetResponse API Response:', response.data);
    return response.data;

  } catch (error) {
    if (error.response?.status === 409) {
      // Contact already exists - this is OK
      console.log(`Contact ${email} already exists in GetResponse`);
      return { exists: true };
    }

    throw new Error(`GetResponse API error: ${error.response?.data?.message || error.message}`);
  }
}

// ============================================
// EXTRACT NAME FROM WEBFLOW DATA
// ============================================

function extractNameFromWebflowData(data) {
  if (!data || typeof data !== 'object') return null;

  // Try common name fields
  const nameFields = ['name', 'fullName', 'firstName', 'full_name', 'first_name'];
  
  for (const field of nameFields) {
    if (data[field]) return data[field];
  }

  // If data is an array, search through fields
  if (Array.isArray(data)) {
    const nameField = data.find(
      field => field.name?.toLowerCase().includes('name')
    );
    if (nameField) return nameField.value;
  }

  for (const [key, value] of Object.entries(data)) {
    if (key.toLowerCase().includes('name') && typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function extractMessageFromWebflowData(data) {
  if (!data || typeof data !== 'object') return '';

  const messageFields = ['message', 'comments', 'comment', 'inquiry', 'enquiry', 'body'];

  for (const field of messageFields) {
    if (typeof data[field] === 'string') return data[field];
  }

  if (Array.isArray(data)) {
    const messageField = data.find(
      field => messageFields.includes(field.name?.toLowerCase())
    );
    if (messageField) return messageField.value;
  }

  for (const [key, value] of Object.entries(data)) {
    if ((key.toLowerCase().includes('message') || key.toLowerCase().includes('comment')) && typeof value === 'string') {
      return value;
    }
  }

  return '';
}

function extractCompanyFromWebflowData(data) {
  if (!data || typeof data !== 'object') return '';

  const companyFields = ['company', 'firma', 'organization', 'organisation', 'business'];

  for (const field of companyFields) {
    if (typeof data[field] === 'string') return data[field];
  }

  if (Array.isArray(data)) {
    const companyField = data.find(
      field => companyFields.includes(field.name?.toLowerCase())
    );
    if (companyField) return companyField.value;
  }

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes('company') || lowerKey.includes('firma')) && typeof value === 'string') {
      return value;
    }
  }

  return '';
}

function extractBudgetFromWebflowData(data) {
  if (!data || typeof data !== 'object') return '';

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes('budget') || lowerKey.includes('bud\u017cet') || lowerKey.includes('budzet')) && typeof value === 'string') {
      return value.trim();
    }
  }

  return '';
}

function extractPhoneFromWebflowData(data) {
  if (!data || typeof data !== 'object') return '';

  const phoneFields = ['phone', 'telefon', 'telephone', 'mobile', 'phone_number'];

  for (const field of phoneFields) {
    if (typeof data[field] === 'string') return data[field];
  }

  if (Array.isArray(data)) {
    const phoneField = data.find(
      field => phoneFields.includes(field.name?.toLowerCase())
    );
    if (phoneField) return phoneField.value;
  }

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if ((lowerKey.includes('phone') || lowerKey.includes('telefon')) && typeof value === 'string') {
      return value;
    }
  }

  return '';
}

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'webflow-getresponse-webhook',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// SERVER START
// ============================================

let server;

async function startServer() {
  try {
    server = app.listen(PORT, () => {
      console.log(`🚀 Webhook server running on port ${PORT}`);
      console.log(`📝 Webflow webhook endpoint: http://localhost:${PORT}/webhook/webflow`);
      console.log(`📧 Contact webhook endpoint: http://localhost:${PORT}/webhook/contact`);
      console.log(`🎨 Rebranding webhook endpoint: http://localhost:${PORT}/webhook/rebranding`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please stop the existing server or change PORT in .env.`);
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });

    // Initialize the database after the port is already open so platform health checks can pass.
    initializeDatabase()
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        process.exit(1);
      });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  saveDatabase();

  if (server && server.close) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
