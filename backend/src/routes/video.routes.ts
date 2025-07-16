import { Router } from "express";
import * as videoController from "../controllers/video.controller";
import { authenticateUser } from "../middlewares/user.middleware";

const videoRouter = Router();

// All video routes require authentication
videoRouter.use(authenticateUser);

// Process a new video
videoRouter.post("/process", videoController.processVideo);

// Get all videos with pagination and filtering
videoRouter.get("/", videoController.getVideos);

// Get a specific video by videoId
videoRouter.get("/:videoId", videoController.getVideo);

// Search video chunks for RAG
videoRouter.post("/search", videoController.searchVideoChunks);

export default videoRouter;
