require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const COLLECTION = 'feedbackEntries';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = await admin.auth().verifyIdToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/feedback — return all entries newest first (admin only)
app.get('/api/feedback', requireAuth, async (req, res) => {
  try {
    const snap = await db.collection(COLLECTION).orderBy('timestamp', 'desc').limit(100).get();
    const entries = snap.docs.map(doc => {
      const data = doc.data();
      // Normalise Firestore Timestamp objects → ISO string
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        data.timestamp = data.timestamp.toDate().toISOString();
      }
      return { id: doc.id, ...data };
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
});

// POST /api/feedback — save a new entry
app.post('/api/feedback', async (req, res) => {
  try {
    const { name, location, rating, comment } = req.body;
    if (!comment || !rating) {
      return res.status(400).json({ error: 'comment and rating are required' });
    }
    const entry = {
      name: name || '',
      location,
      rating: parseInt(rating, 10),
      comment,
      timestamp: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(entry);
    const saved = { id: ref.id, ...entry };

    // Forward to Google Sheets webhook (non-blocking)
    if (process.env.GOOGLE_SHEET_WEBHOOK) {
      fetch(process.env.GOOGLE_SHEET_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saved),
      }).catch(err => console.error('Google Sheets webhook error:', err));
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// POST /api/sync-sheets — push all existing entries to Google Sheets (admin only)
app.post('/api/sync-sheets', requireAuth, async (req, res) => {
  if (!process.env.GOOGLE_SHEET_WEBHOOK) {
    return res.status(400).json({ error: 'Google Sheets webhook not configured' });
  }
  try {
    const snap = await db.collection(COLLECTION).orderBy('timestamp', 'asc').get();
    const entries = snap.docs.map(doc => {
      const data = doc.data();
      if (data.timestamp && typeof data.timestamp.toDate === 'function') {
        data.timestamp = data.timestamp.toDate().toISOString();
      }
      return { id: doc.id, ...data };
    });

    // Send each row sequentially to avoid Apps Script rate limits
    let sent = 0;
    for (const entry of entries) {
      await fetch(process.env.GOOGLE_SHEET_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      sent++;
    }
    res.json({ synced: sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;
