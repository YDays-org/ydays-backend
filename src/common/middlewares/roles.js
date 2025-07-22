export const roleCheck = (roles) => (req, res, next) => {
  console.log('roleCheck middleware - req.user:', req.user);
  console.log('roleCheck middleware - required roles:', roles);
  
  if (!req.user) {
    console.error('roleCheck: req.user is undefined - auth middleware may not have run');
    return res.status(401).json({ success: false, message: "Unauthorized: User not authenticated." });
  }
  
  if (!roles.includes(req.user.role)) {
    console.log('roleCheck: User role', req.user.role, 'not in required roles:', roles);
    return res.status(403).json({ success: false, message: "Forbidden: Insufficient role." });
  }
  
  console.log('roleCheck: Access granted for user role:', req.user.role);
  next();
}; 