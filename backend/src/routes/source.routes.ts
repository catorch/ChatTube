import { Router } from "express";
import * as sourceController from "../controllers/source.controller";
import { authenticateUser } from "../middlewares/user.middleware";

const sourceRouter = Router();

// All source routes require authentication
sourceRouter.use(authenticateUser);

// Process a new source (YouTube, PDF, etc.)
sourceRouter.post("/", sourceController.addSources);

// Get all sources with pagination and filtering
sourceRouter.get("/", sourceController.getSources);

// Get a specific source by sourceId
sourceRouter.get("/:sourceId", sourceController.getSource);

// Get processing status for a specific source
sourceRouter.get("/:sourceId/status", sourceController.getSourceStatus);

// Search source chunks for RAG
sourceRouter.post("/search", sourceController.searchSourceChunks);

export default sourceRouter;
