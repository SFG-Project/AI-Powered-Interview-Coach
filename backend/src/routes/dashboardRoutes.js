const express = require("express");
const { admin, isFirebaseAdminInitialized } = require("../config/firebaseAdmin");
const { getDashboardForUser } = require("../services/dashboardService");

function createDashboardRoutes({ requireAuthenticatedUser }) {
  const router = express.Router();

  router.get("/me", requireAuthenticatedUser, async (req, res) => {
    logDashboardRouteHit(req.authUser?.uid);
    if (!isFirebaseAdminInitialized()) {
      console.warn(
        "[dashboard/me] Firebase Admin is not initialized. Returning config error."
      );
      res.status(503).json({
        message: "Firebase Admin credentials are not configured on the backend.",
        errorCode: "firebase-admin-not-configured",
        errorMessage: "Firebase Admin credentials are not configured on the backend.",
      });
      return;
    }

    try {
      const payload = await getDashboardForUser(admin.firestore(), req.authUser.uid);
      logDashboardRouteResult(req.authUser?.uid, payload?.summary?.totalInterviews);
      res.status(200).json(payload);
    } catch (error) {
      const code = typeof error?.code === "string" ? error.code : undefined;
      const message =
        error instanceof Error ? error.message : "Failed to load dashboard data.";
      console.error("[dashboard/me] Failed to load dashboard data.", {
        errorCode: code || "unknown",
        errorMessage: message,
      });

      res.status(500).json({
        message: "Failed to load dashboard data.",
        errorCode: code,
        errorMessage: message,
      });
    }
  });

  return router;
}

module.exports = {
  createDashboardRoutes,
};

function logDashboardRouteHit(uid) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const hasUserId = typeof uid === "string" && Boolean(uid.trim());
  console.info(`[dashboard/me] GET hit. userIdFound=${hasUserId}.`);
}

function logDashboardRouteResult(uid, completedInterviews) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const completedCount = Number.isFinite(Number(completedInterviews))
    ? Number(completedInterviews)
    : 0;
  const hasUserId = typeof uid === "string" && Boolean(uid.trim());

  console.info(
    `[dashboard/me] userIdFound=${hasUserId}. completedSessions=${completedCount}.`
  );
}

function isDevelopmentEnvironment() {
  return process.env.NODE_ENV !== "production";
}
