const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel")

const requireAuthUser = (req, res, next) => {
  // Accept token from cookie, Authorization header, or request body
  const tokenFromCookie = req.cookies && req.cookies.jwt_login;
  const authHeader = req.headers && req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.split(" ")[1];
  const tokenFromBody = req.body && req.body.token;

  const token = tokenFromCookie || tokenFromHeader || tokenFromBody;
  const source = tokenFromCookie ? 'cookie' : tokenFromHeader ? 'authorization header' : tokenFromBody ? 'body' : 'none';
  console.log("token récu avec succée:", token, "(source:", source + ")");

  if (token) {
    jwt.verify(token, process.env.net_Secret, async (err, decodedToken) => {
      if (err) {
        console.log("il ya une erreur au niveau du token", err.message);
        if (req.session) {
          req.session.user = null; // session null
        } else {
          req.user = null;
        }
        // If token expired, return a clear message so client can re-authenticate
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
      } else {
        const foundUser = await userModel.findById(decodedToken.id);
        if (req.session) {
          req.session.user = foundUser; // session get user
        } else {
          // fallback when express-session isn't configured
          req.user = foundUser;
          console.warn('Warning: req.session is undefined — user stored on req.user instead');
        }
        return next();
      }
    });
  } else {
    if (req.session) {
      req.session.user = null; // session null
    } else {
      req.user = null;
    }
    return res.status(401).json({ error: 'No token provided' });
  }
};
module.exports = { requireAuthUser };