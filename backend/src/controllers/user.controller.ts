import { Request, Response } from "express";
import User from "../models/User";

/**
 * Controller for managing the authenticated user's own data.
 */
export const UsersController = {
  /**
   * GET /users/me - Get My Profile
   */
  async getMyProfile(req: Request, res: Response) {
    const userId = res.locals.user?.id; // Extracted by authenticateUser middleware

    if (!userId) {
      // This shouldn't happen if authenticateUser middleware is applied correctly
      return res
        .status(401)
        .json({ message: "User ID not found in authenticated request." });
    }

    try {
      const user = await User.findById(userId).select("-password");

      if (!user) {
        // Extremely unlikely if authentication middleware passed, but good practice
        return res
          .status(404)
          .json({ message: "Authenticated user not found." });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return res
        .status(500)
        .json({ message: "Failed to retrieve user profile." });
    }
  },

  /**
   * PATCH /users/me - Update My Profile
   */
  async updateMyProfile(req: Request, res: Response) {
    const userId = res.locals.user?.id;
    const { firstName, lastName } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "User ID not found in authenticated request." });
    }

    // Basic validation
    if (firstName !== undefined && typeof firstName !== "string") {
      return res.status(400).json({ message: "Invalid firstName format." });
    }

    if (lastName !== undefined && typeof lastName !== "string") {
      return res.status(400).json({ message: "Invalid lastName format." });
    }

    const dataToUpdate: { firstName?: string; lastName?: string } = {};
    if (firstName !== undefined) {
      dataToUpdate.firstName = firstName.trim() || undefined;
    }
    if (lastName !== undefined) {
      dataToUpdate.lastName = lastName.trim() || undefined;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update." });
    }

    try {
      const updatedUser = await User.findByIdAndUpdate(userId, dataToUpdate, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found." });
      }

      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      return res
        .status(500)
        .json({ message: "Failed to update user profile." });
    }
  },
};
