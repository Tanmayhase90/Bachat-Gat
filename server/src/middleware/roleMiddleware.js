/**
 * Authorizes access based on user role_name (e.g. 'ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER')
 * @param  {...string} roles Allowed roles
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = (req.user.role_name || req.user.role || 'MEMBER').toUpperCase();
    const normalizedRoles = roles.map((r) => r.toUpperCase());

    // ADMIN always has full system permissions
    if (userRole === 'ADMIN' || normalizedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of roles: [${roles.join(', ')}]. Current role: ${userRole}`,
    });
  };
}

module.exports = authorizeRoles;
