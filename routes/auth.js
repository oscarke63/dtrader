const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ success: false, message: 'All fields required' });
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
      return res.status(409).json({ success: false, message: 'Email taken' });

    const hash = await bcrypt.hash(password, 12);
    const { lastInsertRowid: userId } = db.prepare(
      'INSERT INTO users (email,password,name,phone) VALUES (?,?,?,?)'
    ).run(email, hash, name, phone || null);

    // Create both accounts
    db.prepare('INSERT INTO accounts (user_id,type,balance) VALUES (?,?,?)').run(userId, 'demo', 10000);
    db.prepare('INSERT INTO accounts (user_id,type,balance) VALUES (?,?,?)').run(userId, 'real', 0);

    const token = jwt.sign({ userId, email, name }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ success: true, token, user: { id: userId, email, name } });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET, { expiresIn: '30d' }
    );
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
  } catch(e) { console.error(e); res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;