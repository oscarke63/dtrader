require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/deposits', require('./routes/deposits'));
app.use('/api/trades', require('./routes/trades'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// SPA fallback
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
// catch-all for undefined routes (not found)
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ success: false, message: 'Not found' });
  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 DTrader on port ${PORT}`));