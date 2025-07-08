import aj from "../config/arcjet.js";

export const arcjetMiddleware = async (req, res, next) => {
  try {
    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ message: "Rate limit exceeded. Please try again later." });
      }
      if (decision.reason.isBot()) {
        return res.status(403).json({ message: "Bot detected" });
      }
      return res.status(403).json({ message: "Access denied by Arcjet" });
    }

    next();
  } catch (error) {
    console.error("ArcJet middleware error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}