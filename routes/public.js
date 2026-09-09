const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const bundles = require('../config/bundles');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('home', { page: 'home', bundles });
});

router.get('/pricing', (req, res) => {
  res.render('pricing', { page: 'pricing', bundles });
});

router.get('/apply', (req, res) => {
  const validBundleIds = bundles.map((b) => b.id);
  const preselected = validBundleIds.includes(req.query.bundle) ? req.query.bundle : '';
  res.render('apply', {
    page: 'apply',
    bundles,
    submitted: false,
    errors: null,
    values: { bundle_interest: preselected },
  });
});

router.post('/apply', (req, res) => {
  const { name, business_name, email, phone, coverage_area, bundle_interest, message } = req.body;

  const errors = [];
  if (!name || !name.trim()) errors.push('Name is required.');
  if (!business_name || !business_name.trim()) errors.push('Business name is required.');
  if (!email || !email.trim()) errors.push('Email is required.');
  if (!phone || !phone.trim()) errors.push('Phone is required.');
  if (!coverage_area || !coverage_area.trim()) errors.push('Coverage area is required.');

  if (errors.length) {
    return res.status(400).render('apply', {
      page: 'apply',
      bundles,
      submitted: false,
      errors,
      values: req.body,
    });
  }

  db.prepare(`
    INSERT INTO interest_submissions (name, business_name, email, phone, coverage_area, bundle_interest, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    business_name.trim(),
    email.trim(),
    phone.trim(),
    coverage_area.trim(),
    bundle_interest || 'unsure',
    (message || '').trim()
  );

  res.render('apply', { page: 'apply', bundles, submitted: true, errors: null, values: {} });
});

router.get('/login', (req, res) => {
  if (req.session && req.session.clientId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { page: 'login', error: null, next: req.query.next || '/dashboard' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const next = req.body.next || '/dashboard';

  const client = db.prepare('SELECT * FROM clients WHERE username = ?').get((username || '').trim());
  if (!client || client.status !== 'active' || !bcrypt.compareSync(password || '', client.password_hash)) {
    return res.status(401).render('login', {
      page: 'login',
      error: 'Incorrect username or password.',
      next,
    });
  }

  req.session.clientId = client.id;
  res.redirect(next.startsWith('/') ? next : '/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
