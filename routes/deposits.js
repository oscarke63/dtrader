const express = require('express');
const axios = require('axios');
const auth = require('../middleware/auth');
const db = require('../db');
const router = express.Router();
const TUMA = process.env.TUMA_API_URL;
let tumaToken = null, tumaExp = 0;

async function getToken() {
  if (tumaToken && Date.now() < tumaExp - 60000) return tumaToken;
  const { data } = await axios.post(`${TUMA}/auth/token`, {
    email: process.env.TUMA_EMAIL, api_key: process.env.TUMA_API_KEY
  });
  if (!data.success) throw new Error('Tuma auth failed');
  tumaToken = data.token;
  tumaExp = Date.now() + data.expires_in * 1000;
  return tumaToken;
}

function formatPhone(p) {
  let n = p.replace(/\D/g, '');
  if (n.startsWith('0')) n = '254' + n.slice(1);
  if (!n.startsWith('254')) n = '254' + n;
  return n;
}

router.post('/mpesa', auth, async (req, res) => {
  try {
    const { amount, phone } = req.body;
    if (!amount || !phone) return res.status(400).json({ success: false, message: 'Amount and phone required' });
    if (amount < 1 || amount > 1000) return res.status(400).json({ success: false, message: 'Amount: $1-$1000' });

    const account = db.prepare('SELECT id FROM accounts WHERE user_id=? AND type=?').get(req.user.userId, 'real');
    if (!account) return res.status(404).json({ success: false, message: 'No real account' });

    const fp = formatPhone(phone);
    if (fp.length !== 12) return res.status(400).json({ success: false, message: 'Invalid phone' });

    const rate = parseFloat(process.env.USD_KES_RATE) || 130;
    const kes = Math.ceil(amount * rate);
    const ref = 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

    db.prepare('INSERT INTO deposits (user_id,account_id,method,amount,phone,status,reference) VALUES(?,?,?,?,?,?,?)')
      .run(req.user.userId, account.id, 'mpesa', amount, fp, 'pending', ref);

    const token = await getToken();
    const { data } = await axios.post(`${TUMA}/payment/stk-push`, {
      amount: kes, phone: fp,
      callback_url: process.env.TUMA_CALLBACK_URL,
      description: `DTrader $${amount} (${ref})`
    }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

    if (data.success) {
      db.prepare('UPDATE deposits SET checkout_id=? WHERE reference=?').run(data.data.checkout_request_id, ref);
      res.json({ success: true, message: 'Check your phone', reference: ref });
    } else {
      db.prepare("UPDATE deposits SET status='failed' WHERE reference=?").run(ref);
      res.status(400).json({ success: false, message: data.message || 'STK failed' });
    }
  } catch(e) {
    console.error('Deposit err:', e.response?.data || e.message);
    res.status(500).json({ success: false, message: 'Payment service error' });
  }
});

// Tuma callback
router.post('/callback', (req, res) => {
  try {
    const p = req.body;
    const cid = p.checkout_request_id;
    if (!cid) return res.json({ success: true });

    const dep = db.prepare("SELECT * FROM deposits WHERE checkout_id=? AND status='pending'").get(cid);
    if (!dep) return res.json({ success: true });

    if (p.result_code === 0 && p.status === 'completed') {
      db.prepare("UPDATE deposits SET status='completed', mpesa_receipt=?, completed_at=CURRENT_TIMESTAMP WHERE id=?")
        .run(p.mpesa_receipt_number || cid, dep.id);
      db.prepare('UPDATE accounts SET balance=balance+? WHERE id=?').run(dep.amount, dep.account_id);
      console.log(`✅ $${dep.amount} deposited (${dep.reference})`);
    } else {
      db.prepare("UPDATE deposits SET status='failed' WHERE id=?").run(dep.id);
    }
    res.json({ success: true });
  } catch(e) { console.error(e); res.json({ success: true }); }
});

router.get('/status/:ref', auth, (req, res) => {
  const d = db.prepare('SELECT status,amount,reference,created_at,completed_at FROM deposits WHERE reference=? AND user_id=?')
    .get(req.params.ref, req.user.userId);
  if (!d) return res.status(404).json({ success: false });
  res.json({ success: true, deposit: d });
});

router.get('/history', auth, (req, res) => {
  const d = db.prepare('SELECT * FROM deposits WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.userId);
  res.json({ success: true, deposits: d });
});

module.exports = router;