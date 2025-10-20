const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const {OAuth2Client} = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '195220715967-oco8l37o9bfudqms8sudetekgoug6l8h.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// simple in-memory session store (for demo only)
const sessions = new Map();

app.post('/login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'No idToken provided' });
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const sessionId = Math.random().toString(36).slice(2);
    sessions.set(sessionId, { payload, createdAt: Date.now() });
    res.cookie('session', sessionId, { httpOnly: true, sameSite: 'lax' });
    return res.json({ ok: true, user: { name: payload.name, picture: payload.picture, email: payload.email } });
  } catch (err) {
    console.error('Login verify error', err);
    return res.status(401).json({ error: 'Invalid ID token' });
  }
});

app.post('/logout', (req, res) => {
  const sid = req.cookies.session;
  if (sid && sessions.has(sid)) sessions.delete(sid);
  res.clearCookie('session');
  res.json({ ok: true });
});

app.get('/me', (req, res) => {
  const sid = req.cookies.session;
  if (!sid || !sessions.has(sid)) return res.status(401).json({ error: 'Not authenticated' });
  const s = sessions.get(sid);
  res.json({ ok: true, user: s.payload });
});

// Progress endpoints: store and retrieve per-session progress
app.post('/progress', (req, res) => {
  const sid = req.cookies.session;
  if (!sid || !sessions.has(sid)) return res.status(401).json({ error: 'Not authenticated' });
  const s = sessions.get(sid);
  s.progress = req.body.progress || s.progress || {};
  s.correctCount = req.body.correctCount || s.correctCount || {};
  s.incorrectQuestions = req.body.incorrectQuestions || s.incorrectQuestions || {};
  sessions.set(sid, s);
  res.json({ ok: true });
});

app.get('/progress', (req, res) => {
  const sid = req.cookies.session;
  if (!sid || !sessions.has(sid)) return res.status(401).json({ error: 'Not authenticated' });
  const s = sessions.get(sid);
  res.json({ ok: true, progress: s.progress || {}, correctCount: s.correctCount || {}, incorrectQuestions: s.incorrectQuestions || {} });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Auth server listening on', port));
