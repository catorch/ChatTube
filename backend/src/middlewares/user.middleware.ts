import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

// Log JWT Secret availability at module load time
if (!process.env.JWT_SECRET) {
  console.warn(
    "WARNING: JWT_SECRET environment variable is not loaded at middleware module load time."
  );
} else {
  console.log("Middleware: JWT_SECRET seems available at module load.");
}

interface JwtPayload {
  userId: string;
  email: string;
  // Add other properties expected in your JWT payload
}

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token: string | null = null;
  const cookieName = "authToken"; // Use the same name as set in login

  // 1. Check Authorization header (for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.cookies && req.cookies[cookieName]) {
    // 2. Check Cookie if header not present (for web app)
    token = req.cookies[cookieName];
  }

  // 3. If no token found in either location, reject
  if (!token) {
    return res.status(401).json({ message: "Authentication token required" });
  }

  // 4. Verify the token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      // If user not found, the token is invalid/stale, clear the cookie
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user info to the request object (commonly used) or response locals
    res.locals.user = { id: (user._id as any).toString(), email: user.email };

    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    console.error("JWT Verification Error in Middleware:", error);

    // Handle verification errors (e.g., expired, invalid signature)
    if (error instanceof jwt.JsonWebTokenError) {
      // Clear potentially invalid cookie on verification failure
      res.clearCookie(cookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      // Also log the specific JWT error message before sending response
      console.error(`JWT Error Details: ${error.message}`);
      return res
        .status(401)
        .json({ message: `Invalid or expired token: ${error.message}` });
    }
    // Log generic errors too
    console.error("Non-JWT Authentication error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error during authentication" });
  }
};
