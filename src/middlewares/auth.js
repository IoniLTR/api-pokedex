const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // {id, username, role, iat, exp}
    return next();
  } catch (e) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
};