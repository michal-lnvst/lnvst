require('dotenv').config();

const express = require('express');
const axios = require('axios');
const initSqlJs = require('sql.js');
const multer = require('multer');
const nodemailer = require('nodemailer');
const validator = require('validator');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CONSENT_RETENTION_MONTHS = Number(process.env.CONSENT_RETENTION_MONTHS || 12);
const CONSENT_HASH_SALT = process.env.CONSENT_HASH_SALT || '';
const CONSENT_ACTIONS = new Set(['accept_all', 'reject_all', 'save_preferences', 'withdraw']);
const CONSENT_CATEGORIES = ['necessary', 'analytics', 'marketing', 'personalization'];
const CONTACT_MIN_SUBMIT_SECONDS = Number(process.env.CONTACT_MIN_SUBMIT_SECONDS || 3);
const CONTACT_RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS || 60000);
const CONTACT_RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX || 5);
const CONTACT_DEBUG_LOG_VALUES = process.env.CONTACT_DEBUG_LOG_VALUES === 'true';
const CONTACT_DEBUG_LOG_INCLUDE_RAW = process.env.CONTACT_DEBUG_LOG_INCLUDE_RAW === 'true';
const CONTACT_HONEYPOT_FIELDS = (process.env.CONTACT_HONEYPOT_FIELDS || 'company_fax')
  .split(',')
  .map(field => field.trim().toLowerCase())
  .filter(Boolean);
const CONTACT_SUCCESS_REDIRECT_URL = process.env.CONTACT_SUCCESS_REDIRECT_URL || '';
const CONTACT_ERROR_REDIRECT_URL = process.env.CONTACT_ERROR_REDIRECT_URL || '';

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
const multipartFormParser = multer().none();

// ============================================
// DATABASE INITIALIZATION
// ============================================

const dbPath = process.env.DATABASE_PATH || './data/app.db';
const dbDir = path.dirname(dbPath);
let db = null;
let SQL = null;

// Initialize database
async function initializeDatabase() {
  // Initialize SQL.js
  SQL = await initSqlJs();

  // Create database directory if it doesn't exist
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

    CREATE TABLE IF NOT EXISTS consent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_identifier TEXT NOT NULL,
      consent_type TEXT NOT NULL,
      consent_given BOOLEAN NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS consent_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consent_id TEXT NOT NULL,
      action TEXT NOT NULL,
      necessary INTEGER NOT NULL DEFAULT 1,
      analytics INTEGER NOT NULL DEFAULT 0,
      marketing INTEGER NOT NULL DEFAULT 0,
      personalization INTEGER NOT NULL DEFAULT 0,
      consent_source TEXT,
      policy_version TEXT,
      banner_version TEXT,
      locale TEXT,
      region TEXT,
      user_identifier_hash TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);
    CREATE INDEX IF NOT EXISTS idx_consent_expires ON consent_logs(expires_at);
    CREATE INDEX IF NOT EXISTS idx_consent_preferences_consent_id ON consent_preferences(consent_id);
    CREATE INDEX IF NOT EXISTS idx_consent_preferences_expires ON consent_preferences(expires_at);
  `);

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
      return res.status(400).json({ error: 'Email not found in submission' });
    }

    // Send to GetResponse newsletter list
    await addContactToGetResponse(email, req.body, 'newsletter');

    console.log(`Successfully added ${email} to GetResponse newsletter list`);
    res.status(200).json({ success: true, message: 'Contact added to GetResponse newsletter' });

  } catch (error) {
    console.error('Newsletter webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

app.post('/webhook/newsletter', webhookNewsletterHandler);
app.post('/webhook/webflow', webhookNewsletterHandler); // backwards compatibility

// ============================================
// CONTACT FORM WEBHOOK
// ============================================

app.post('/webhook/contact', multipartFormParser, async (req, res) => {
  try {
    const ipAddress = getClientIp(req);
    const ipHash = hashForLogs(ipAddress);
    const contentType = (req.headers['content-type'] || '').toString();
    const userAgent = (req.headers['user-agent'] || '').toString();
    const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];

    console.log('Contact form submission received metadata:', {
      ipHash,
      contentType,
      bodyKeys,
      userAgent: userAgent.slice(0, 180)
    });

    if (CONTACT_DEBUG_LOG_VALUES) {
      console.log('Contact form payload preview:', buildPayloadPreview(req.body));
    }

    if (isEmptyObjectPayload(req.body)) {
      console.warn(`Empty contact payload from ipHash=${ipHash}; likely bot probe or unsupported content-type (${contentType || 'unknown'})`);
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' });
    }

    const rateLimit = getContactRateLimitStatus(ipAddress);
    if (rateLimit.limited) {
      return respondForContactRequest(req, res, 429, {
        error: 'Too many submissions. Please try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }

    if (isHoneypotTriggered(req.body)) {
      console.warn(`Honeypot triggered from ipHash=${ipHash}`);
      return respondForContactRequest(req, res, 200, { success: true, message: 'Submission received' });
    }

    if (isSubmittedTooQuickly(req.body)) {
      console.warn(`Submission rejected due to fast submit from ipHash=${ipHash}`);
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
      console.warn(`Spam detected from emailHash=${hashForLogs(email)}`);
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

    console.log(`Contact form submitted by emailHash=${hashForLogs(email)}`);
    return respondForContactRequest(req, res, 200, { success: true, message: 'Thank you for your message' });

  } catch (error) {
    console.error('Contact webhook error:', error.message);
    return respondForContactRequest(req, res, 500, { error: error.message });
  }
});

// ============================================
// SPAM FILTERING
// ============================================

function getContactRateLimitStatus(ipAddress) {
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

  const key = ipAddress || 'unknown';
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
  const rawMessage = (message || '').toString();
  const messageStr = rawMessage.toLowerCase();
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

  // Check for excessive capitalization (computed from original message casing)
  const alphaCount = (rawMessage.match(/[A-Za-z]/g) || []).length;
  const upperCount = (rawMessage.match(/[A-Z]/g) || []).length;
  const capsRatio = upperCount / (alphaCount || 1);
  if (capsRatio > 0.5 && rawMessage.length > 20) return true;

  // Message is optional, but if provided it should be reasonable length
  if (messageStr.length > 0 && messageStr.length < 5) return true;
  if (messageStr.length > 5000) return true;

  return false;
}

function isEmptyObjectPayload(payload) {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.keys(payload).length === 0
  );
}

function hashForLogs(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (!normalized) return 'none';

  return crypto
    .createHash('sha256')
    .update(`${CONSENT_HASH_SALT}:${normalized}`)
    .digest('hex')
    .slice(0, 16);
}

function buildPayloadPreview(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const preview = {};
  const sensitiveFieldPattern = /(email|name|message|phone|company|firma|comment|inquiry|enquiry)/i;

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      const isSensitiveField = sensitiveFieldPattern.test(key);

      if (CONTACT_DEBUG_LOG_INCLUDE_RAW) {
        preview[key] = value.length > 250 ? `${value.slice(0, 250)}...[truncated]` : value;
      } else if (isSensitiveField) {
        preview[key] = `[redacted len=${value.length} hash=${hashForLogs(value)}]`;
      } else {
        preview[key] = value.length > 120 ? `${value.slice(0, 120)}...[truncated]` : value;
      }
      continue;
    }

    if (Array.isArray(value)) {
      preview[key] = `[array:${value.length}]`;
      continue;
    }

    if (value && typeof value === 'object') {
      preview[key] = '[object]';
      continue;
    }

    preview[key] = value;
  }

  return preview;
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

function respondForContactRequest(req, res, statusCode, payload) {
  if (requestPrefersHtml(req)) {
    const redirectBaseUrl = statusCode >= 400
      ? (CONTACT_ERROR_REDIRECT_URL || CONTACT_SUCCESS_REDIRECT_URL)
      : CONTACT_SUCCESS_REDIRECT_URL;
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

async function sendContactEmailNotification(email, name, message) {
  try {
    if (!process.env.ADMIN_EMAIL || !process.env.SMTP_HOST) {
      console.warn('Email configuration missing, skipping notification');
      return;
    }

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Form Submission from ${name || email}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${escapeHtml(name || 'Anonymous')} (${escapeHtml(email)})</p>
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
// COOKIE CONSENT LOGGING
// ============================================

function hashIdentifier(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (!normalized) return null;

  return crypto
    .createHash('sha256')
    .update(`${CONSENT_HASH_SALT}:${normalized}`)
    .digest('hex');
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || '';
}

function getRetentionExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + CONSENT_RETENTION_MONTHS);
  return expiresAt;
}

function normalizeConsentPreferences(rawPreferences = {}, action = 'save_preferences') {
  const base = {
    necessary: true,
    analytics: Boolean(rawPreferences.analytics),
    marketing: Boolean(rawPreferences.marketing),
    personalization: Boolean(rawPreferences.personalization)
  };

  if (action === 'accept_all') {
    return {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true
    };
  }

  if (action === 'reject_all' || action === 'withdraw') {
    return {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false
    };
  }

  return base;
}

function parseConsentPayload(body = {}) {
  const requestedAction = (body.action || 'save_preferences').toString().trim().toLowerCase();
  const action = CONSENT_ACTIONS.has(requestedAction) ? requestedAction : null;

  if (!action) {
    throw new Error('Invalid action. Allowed: accept_all, reject_all, save_preferences, withdraw');
  }

  const consentIdRaw = (body.consentId || '').toString().trim();
  const consentId = consentIdRaw || crypto.randomUUID();

  if (consentId.length > 120) {
    throw new Error('consentId is too long');
  }

  const preferences = normalizeConsentPreferences(body.preferences || {}, action);

  return {
    consentId,
    action,
    preferences,
    consentSource: (body.consentSource || 'webflow').toString().slice(0, 80),
    policyVersion: (body.policyVersion || '').toString().slice(0, 40),
    bannerVersion: (body.bannerVersion || '').toString().slice(0, 40),
    locale: (body.locale || '').toString().slice(0, 20),
    region: (body.region || '').toString().slice(0, 20),
    userIdentifierHash: hashIdentifier(body.userIdentifier)
  };
}

function mapFirstRow(result) {
  if (!result || result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = {};
  const [firstRow] = result[0].values;

  result[0].columns.forEach((column, index) => {
    row[column] = firstRow[index];
  });

  return row;
}

function persistConsentPreference(req, payload) {
  const expiresAt = getRetentionExpiryDate();
  const ipAddress = getClientIp(req);
  const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);

  db.run(
    `INSERT INTO consent_preferences (
      consent_id, action, necessary, analytics, marketing, personalization,
      consent_source, policy_version, banner_version, locale, region,
      user_identifier_hash, ip_address, user_agent, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.consentId,
      payload.action,
      payload.preferences.necessary ? 1 : 0,
      payload.preferences.analytics ? 1 : 0,
      payload.preferences.marketing ? 1 : 0,
      payload.preferences.personalization ? 1 : 0,
      payload.consentSource,
      payload.policyVersion,
      payload.bannerVersion,
      payload.locale,
      payload.region,
      payload.userIdentifierHash,
      ipAddress,
      userAgent,
      expiresAt.toISOString()
    ]
  );

  saveDatabase();

  return {
    consentId: payload.consentId,
    action: payload.action,
    preferences: payload.preferences,
    expiresAt: expiresAt.toISOString()
  };
}

app.post('/api/consent/preferences', (req, res) => {
  try {
    const payload = parseConsentPayload(req.body);
    const stored = persistConsentPreference(req, payload);

    console.log(`Consent preference stored: ${stored.consentId} - ${stored.action}`);

    res.status(200).json({
      success: true,
      ...stored,
      categories: CONSENT_CATEGORIES
    });
  } catch (error) {
    console.error('Consent preferences error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/consent/withdraw', (req, res) => {
  try {
    const payload = parseConsentPayload({
      ...req.body,
      action: 'withdraw',
      preferences: {
        analytics: false,
        marketing: false,
        personalization: false
      }
    });

    const stored = persistConsentPreference(req, payload);
    console.log(`Consent withdrawn: ${stored.consentId}`);

    res.status(200).json({
      success: true,
      ...stored,
      categories: CONSENT_CATEGORIES
    });
  } catch (error) {
    console.error('Consent withdrawal error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/consent/preferences/:consentId', (req, res) => {
  try {
    const consentId = (req.params.consentId || '').toString().trim();
    if (!consentId) {
      return res.status(400).json({ error: 'consentId is required' });
    }

    const result = db.exec(
      `SELECT consent_id, action, necessary, analytics, marketing, personalization,
              consent_source, policy_version, banner_version, locale, region,
              created_at, expires_at
       FROM consent_preferences
       WHERE consent_id = ? AND expires_at >= ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [consentId, new Date().toISOString()]
    );

    const row = mapFirstRow(result);
    if (!row) {
      return res.status(404).json({ error: 'Consent record not found' });
    }

    return res.status(200).json({
      success: true,
      consentId: row.consent_id,
      action: row.action,
      preferences: {
        necessary: Boolean(row.necessary),
        analytics: Boolean(row.analytics),
        marketing: Boolean(row.marketing),
        personalization: Boolean(row.personalization)
      },
      consentSource: row.consent_source,
      policyVersion: row.policy_version,
      bannerVersion: row.banner_version,
      locale: row.locale,
      region: row.region,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    });
  } catch (error) {
    console.error('Consent lookup error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch consent record' });
  }
});

app.post('/api/consent/log', async (req, res) => {
  try {
    const { userIdentifier, consentType, consentGiven, consentId } = req.body;

    // Validate input
    if (!userIdentifier || !consentType || consentGiven === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log consent with retention expiration (legacy table)
    const expiresAt = getRetentionExpiryDate();

    db.run(
      `INSERT INTO consent_logs (user_identifier, consent_type, consent_given, expires_at)
       VALUES (?, ?, ?, ?)`,
      [userIdentifier, consentType, consentGiven ? 1 : 0, expiresAt.toISOString()]
    );

    // Mirror legacy log into consent_preferences to maintain a single source of truth
    const normalizedType = consentType.toString().trim().toLowerCase();
    const basePreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false
    };

    if (normalizedType === 'all') {
      basePreferences.analytics = Boolean(consentGiven);
      basePreferences.marketing = Boolean(consentGiven);
      basePreferences.personalization = Boolean(consentGiven);
    } else if (Object.prototype.hasOwnProperty.call(basePreferences, normalizedType)) {
      basePreferences[normalizedType] = Boolean(consentGiven);
    }

    const mirroredPayload = parseConsentPayload({
      action: consentGiven ? 'save_preferences' : 'reject_all',
      consentId,
      preferences: basePreferences,
      consentSource: 'legacy_api',
      userIdentifier
    });

    persistConsentPreference(req, mirroredPayload);

    saveDatabase();

    console.log(`Consent logged: ${userIdentifier} - ${consentType} - ${consentGiven}`);

    res.status(200).json({ success: true, message: 'Consent logged' });

  } catch (error) {
    console.error('Consent logging error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AUTO-CLEANUP EXPIRED CONSENT LOGS
// ============================================

function cleanupExpiredLogs() {
  if (!db) {
    console.debug('cleanupExpiredLogs: db not initialized yet');
    return;
  }

  try {
    const now = new Date().toISOString();
    db.run(`
      DELETE FROM consent_logs WHERE expires_at < ?
    `, [now]);
    db.run(`
      DELETE FROM consent_preferences WHERE expires_at < ?
    `, [now]);
    saveDatabase();
    console.log('Cleaned up expired consent logs');
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
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
  const listId = listType === 'contacts'
    ? process.env.GETRESPONSE_LIST_ID_CONTACTS
    : process.env.GETRESPONSE_LIST_ID_NEWSLETTER;

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

    if (customFieldValues.length > 0) {
      contactData.customFieldValues = customFieldValues;
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
    await initializeDatabase();

    // Do first cleanup after DB is ready
    cleanupExpiredLogs();
    setInterval(cleanupExpiredLogs, 24 * 60 * 60 * 1000);

    server = app.listen(PORT, () => {
      console.log(`🚀 Webhook server running on port ${PORT}`);
      console.log(`📝 Webflow webhook endpoint: http://localhost:${PORT}/webhook/webflow`);
      console.log(`📧 Contact webhook endpoint: http://localhost:${PORT}/webhook/contact`);
      console.log(`🔒 Consent logging endpoint: http://localhost:${PORT}/api/consent/log`);
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
