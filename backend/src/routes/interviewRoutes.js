const express = require("express");
const {
  startInterviewSession,
  submitInterviewAnswer,
  skipInterviewQuestion,
  endInterviewSession,
  getInterviewSession,
  getInterviewHistoryForUser,
  getRuntimeMode,
  getUserId,
} = require("../services/interviewService");

const router = express.Router();

function resolveUserId(req) {
  return getUserId(
    req.headers["x-user-id"] ||
      req.body?.userId ||
      req.query?.userId ||
      req.headers["x-user"]
  );
}

function sendError(res, error) {
  const status = Number(error?.statusCode) || 500;
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message
      : "Interview request failed.";
  res.status(status).json({ message });
}

router.post("/start", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const payload = await startInterviewSession(req.body || {}, userId);
    res.status(201).json(payload);
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:sessionId/answer", async (req, res) => {
  try {
    const payload = await submitInterviewAnswer(req.params.sessionId, req.body || {});
    res.json(payload);
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:sessionId/skip", async (req, res) => {
  try {
    const payload = await skipInterviewQuestion(req.params.sessionId, req.body || {});
    res.json(payload);
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/:sessionId/end", async (req, res) => {
  try {
    const payload = await endInterviewSession(req.params.sessionId);
    res.json(payload);
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/history/me", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const history = await getInterviewHistoryForUser(userId);
    res.json({
      userId,
      sessions: history,
      runtime: getRuntimeMode(),
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/:sessionId", async (req, res) => {
  try {
    const payload = await getInterviewSession(req.params.sessionId);
    res.json(payload);
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = {
  interviewRoutes: router,
};
