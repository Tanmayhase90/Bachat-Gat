const { auth, db } = require('../config/firebaseAdmin');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No Firebase ID token provided.' });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const profile = await db.collection('users').doc(decoded.uid).get();
    const data = profile.exists ? profile.data() : {};
    const role = (data.role_name || data.role || 'MEMBER').toUpperCase();

    if (data.isActive === false) {
      return res.status(403).json({ success: false, message: 'User account is inactive.' });
    }

    req.user = {
      ...decoded,
      ...data,
      id: decoded.uid,
      uid: decoded.uid,
      email: decoded.email || data.email,
      name: data.fullName || data.name || decoded.name || decoded.email,
      role,
      role_name: role,
      groupId: data.groupId || 'group_001',
      memberId: data.memberId || null,
    };
    return next();
  } catch (err) {
    const message = err.code === 'auth/id-token-expired' ? 'Token has expired. Please login again.' : 'Invalid Firebase ID token.';
    return res.status(401).json({ success: false, message });
  }
}

module.exports = authenticateToken;
