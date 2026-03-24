require('dotenv').config();

const express = require('express');
const axios = require('axios');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');
const validator = require('validator');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);
    CREATE INDEX IF NOT EXISTS idx_consent_expires ON consent_logs(expires_at);
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

app.post('/webhook/contact', async (req, res) => {
  try {
    console.log('Contact form submission received:', req.body);

    const email = extractEmailFromWebflowData(req.body);
    const name = extractNameFromWebflowData(req.body) || 'Anonymous';
    const message = extractMessageFromWebflowData(req.body);
    const ipAddress = req.ip;

    // Validate email
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Basic spam filtering
    if (isSpam(message, email, name)) {
      console.warn(`Spam detected from ${email}`);
      // Still return 200 to not reveal to spammers
      return res.status(200).json({ success: true, message: 'Submission received' });
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
    res.status(200).json({ success: true, message: 'Thank you for your message' });

  } catch (error) {
    console.error('Contact webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SPAM FILTERING
// ============================================

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

app.post('/api/consent/log', async (req, res) => {
  try {
    const { userIdentifier, consentType, consentGiven } = req.body;

    // Validate input
    if (!userIdentifier || !consentType || consentGiven === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log consent with 12-month expiration
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    db.run(
      `INSERT INTO consent_logs (user_identifier, consent_type, consent_given, expires_at)
       VALUES (?, ?, ?, ?)`,
      [userIdentifier, consentType, consentGiven ? 1 : 0, expiresAt.toISOString()]
    );
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

    // Prepare contact data for GetResponse
    const contactData = {
      email: email,
      name: name || email,
      campaign: {
        campaignId: listId
      }
    };

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
