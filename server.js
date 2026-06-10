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

// GET /api/feedback — return all entries newest first
app.get('/api/feedback', async (req, res) => {
  try {
    const snap = await db.collection(COLLECTION).orderBy('timestamp', 'desc').get();
    const entries = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    res.status(201).json({ id: ref.id, ...entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;
