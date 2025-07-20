import User from "../models/User";
import * as emailValidator from "email-validator";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "");

export async function signup(req: Request, res: Response) {
  const { email, password, firstName, lastName } = req.body;

  // 1. Validate Input
  if (!email || !password) {
    return res
      .status(422)
      .json({ status: "ERROR", message: "Missing email or password fields" });
  }

  if (!emailValidator.validate(email)) {
    return res
      .status(422)
      .json({ status: "ERROR", message: "Enter a valid email address" });
  }

  // Basic password strength check
  if (password.length < 8) {
    return res.status(422).json({
      status: "ERROR",
      message: "Password must be at least 8 characters long",
    });
  }

  try {
    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        status: "ERROR",
        message: "A user with this email already exists",
      });
    }

    // 3. Create new user (password will be hashed automatically by the model)
    const newUser = await User.create({
      email,
      password,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });

    // 4. Send Success Response (password is automatically excluded by the model)
    return res.status(201).json({
      status: "OK",
      message: "Account successfully created!",
      user: newUser.toJSON(),
    });
  } catch (error: any) {
    console.error("Signup Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        status: "ERROR",
        message: "A user with this email already exists",
      });
    }
    return res.status(500).json({
      status: "ERROR",
      message: "Failed to create account due to server error",
    });
  }
}

// --- Login Function ---
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  // 1. Validate Input
  if (!email || !password) {
    return res
      .status(400)
      .json({ status: "ERROR", message: "Missing email or password" });
  }

  try {
    // 2. Find user by email
    const user = await User.findOne({ email });

    // 3. Check if user exists and password is correct
    if (!user) {
      return res
        .status(401)
        .json({ status: "ERROR", message: "Invalid email or password" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ status: "ERROR", message: "Invalid email or password" });
    }

    // 4. Generate JWT Token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "7d", // Token expires in 7 days
    });

    // 5. Send Success Response with JWT token
    return res.status(200).json({
      status: "OK",
      message: "Login successful",
      user: user.toJSON(),
      token: token,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res
      .status(500)
      .json({ status: "ERROR", message: "Login failed due to server error" });
  }
}

// --- Google OAuth Login ---
export async function googleAuth(req: Request, res: Response) {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      status: "ERROR",
      message: "Missing Google token",
    });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({
        status: "ERROR",
        message: "Invalid Google token",
      });
    }

    const email = payload.email;
    const firstName = payload.given_name;
    const lastName = payload.family_name;

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      user = await User.create({
        email,
        password: randomPassword,
        firstName,
        lastName,
      });
    }

    const tokenPayload = { userId: user.id, email: user.email };
    const jwtToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      status: "OK",
      message: "Login successful",
      user: user.toJSON(),
      token: jwtToken,
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(401).json({
      status: "ERROR",
      message: "Failed to authenticate with Google",
    });
  }
}

// --- Logout Function ---
export function logout(req: Request, res: Response) {
  // With JWT stored in localStorage, logout is handled client-side
  // This endpoint can be used for additional cleanup if needed in the future
  return res.status(200).json({ status: "OK", message: "Logout successful" });
}

// --- Check Authentication Status Function ---
export function checkAuth(req: Request, res: Response) {
  const user = res.locals.user;

  if (!user) {
    return res.status(401).json({
      status: "ERROR",
      message: "Authentication failed, user not found after token validation.",
    });
  }

  return res.status(200).json({
    status: "OK",
    message: "Authenticated",
    user: {
      id: user.id,
      email: user.email,
    },
  });
}
