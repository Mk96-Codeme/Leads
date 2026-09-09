function requireClientAuth(req, res, next) {
  if (req.session && req.session.clientId) {
    return next();
  }
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdminAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.redirect('/admin/login');
}

module.exports = { requireClientAuth, requireAdminAuth };
