require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const publicRoutes = require('./routes/public');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.fmt = require('./utils/format');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionDir = path.join(path.dirname(process.env.DATABASE_PATH || './db/dispatchleads.db'), 'sessions');
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

app.use(
  session({
    store: new FileStore({ path: sessionDir, ttl: SESSION_MAX_AGE_MS / 1000, retries: 1 }),
    name: 'dispatchleads.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: SESSION_MAX_AGE_MS,
    },
  })
);

// Make the current year and a couple of globals available to every view.
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isClientLoggedIn = !!(req.session && req.session.clientId);
  res.locals.isAdminLoggedIn = !!(req.session && req.session.adminId);
  next();
});

app.use('/', publicRoutes);
app.use('/', clientRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).render('404', { page: '404' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Check the server logs for details.');
});

app.listen(PORT, () => {
  console.log(`DispatchLeads running at http://localhost:${PORT}`);
});
