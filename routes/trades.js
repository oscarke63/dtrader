const express = require('express');
const auth = require('../middleware/auth');
const db = require('../db');
const router = express.Router();

router.post('/', auth, (req, res) => {
  const { account_id, symbol, trade_type, direction, stake, entry_price } = req.body;
  const acc = db.prepare('SELECT * FROM accounts WHERE id=? AND user_id=?').get(account_id, req.user.userId);
  if (!acc) return res.status(404).json({ success: false, message: 'Account not found' });
  if (acc.balance < stake) return res.status(400).json({ success: false, message: 'Insufficient balance' });

  db.prepare('UPDATE accounts SET balance=balance-? WHERE id=?').run(stake, account_id);
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO trades (user_id,account_id,symbol,trade_type,direction,stake,entry_price) VALUES(?,?,?,?,?,?,?)'
  ).run(req.user.userId, account_id, symbol, trade_type, direction, stake, entry_price);

  res.json({ success: true, tradeId: lastInsertRowid });
});

router.post('/:id/settle', auth, (req, res) => {
  const { exit_price, result, pnl } = req.body;
  const trade = db.prepare('SELECT * FROM trades WHERE id=? AND user_id=?').get(req.params.id, req.user.userId);
  if (!trade) return res.status(404).json({ success: false });
  if (trade.result !== 'pending') return res.status(400).json({ success: false, message: 'Already settled' });

  db.prepare('UPDATE trades SET exit_price=?,result=?,pnl=? WHERE id=?').run(exit_price, result, pnl, trade.id);
  if (result === 'win') {
    db.prepare('UPDATE accounts SET balance=balance+? WHERE id=?').run(trade.stake + pnl, trade.account_id);
  }
  res.json({ success: true, result, pnl });
});

router.get('/history', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM trades WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.userId);
  res.json({ success: true, trades: t });
});

module.exports = router;