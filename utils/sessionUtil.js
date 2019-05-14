// This middleware assumes cookieParser has been "used" before this
import {sendError} from "./responseHelper";

var crypto = require('crypto');

const twoHours = 7200000;
const tokenLength = 16;

var sessions = {};          // All currently logged-in Sessions
var duration = twoHours;
var cookieName = 'SeaQLAuth'; // Cookie key for authentication tokens

// Session-constructed objects represent an ongoing login session, including
// user details, login time, and time of last use, the latter for the purpose
// of timing-out sessions that have been unused for too long.
var Session = function(user) {
   this.username = user.username;
   this.firstName = user.firstName;
   this.lastName = user.lastName;
   this.email = user.email;
   this.role = user.role;
   this.loginTime = new Date().getTime();
   this.lastUsed = new Date().getTime();
};

Session.prototype.isAdmin = function() {
   return this.role === 1;
};

// Export a function that logs in |user| by creating an authToken and sending
// it back as a cookie, creating a Session for |user|, and saving it in
// |sessions| indexed by the authToken.
//
// 1 Cookie is tagged by |cookieName|, times out on the client side after
// |duration| shown by the browser to the user, again to prevent hacking.
exports.makeSession = function makeSession(user, res) {
   var authToken = crypto.randomBytes(tokenLength).toString('hex');
   var session = new Session(user);

   res.cookie(cookieName, authToken, {maxAge: duration, httpOnly: true}); // 1
   sessions[authToken] = session;

   return authToken;
};

// Export a function to log out a user, given an authToken
exports.deleteSession = function(authToken) {
   delete sessions[authToken];
};

// Export a router that will find any Session associated with |req|, based on
// cookies, delete the Session if it has timed out, or attach the Session to
// |req| if it's current If |req| has an attached Session after this
// process, then down-chain routes will treat |req| as logged-in.
exports.router = function(req, res, next) {
   // If we present a session cookie that corresponds with one in |sessions|...
   if (req.cookies[cookieName] && sessions[req.cookies[cookieName]]) {
      // If the session was last used more than |duration| mS ago..
      if (sessions[req.cookies[cookieName]].lastUsed < new Date().getTime()
       - duration) {
         delete sessions[req.cookies[cookieName]];
      }
      else {
         req.session = sessions[req.cookies[cookieName]];
      }
   }
   next();
};

/**
 * Checks general login. If registering a user or logging in, continue with
 * processing the req, otherwise respond immediately with a 401 error.
 */
exports.checkLogin = function(req, res, next) {
   console.log(req.path);
   if (req.session || (req.method === 'POST' &&
    (req.path === '/users' || req.path === '/sessions'))) {
      next();
   } else
      sendError(res,401, 'Not logged in');
};

exports.cookieName = cookieName;
exports.sessions = sessions;