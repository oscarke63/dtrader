const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db');
const router = express.Router();

router.get('/', auth, (req, res) => {
  const accounts = db.prepare('SELECT id,type,balance,currency FROM accounts WHERE user_id=?').all(req.user.userId);
  res.json({ success: true, accounts });
});

router.post('/reset-demo', auth, (req, res) => {
  db.prepare('UPDATE accounts SET balance=10000 WHERE user_id=? AND type=?').run(req.user.userId, 'demo');
  res.json({ success: true, message: 'Demo reset' });
});

module.exports = router;