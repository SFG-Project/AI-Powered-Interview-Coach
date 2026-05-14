const express = require("express");
const { admin, isFirebaseAdminInitialized } = require("../config/firebaseAdmin");
const {
  buildAdminReportsExportCsv,
  createUserByAdmin,
  getAdminDashboardPayload,
  getAdminReportDetails,
} = require("../services/adminDashboardService");

function createAdminRoutes({ requireAuthenticatedUser, requireAdminUser }) {
  const router = express.Router();

  router.use(requireAuthenticatedUser, requireAdminUser);

  router.get("/dashboard", async (req, res) => {
    const firestore = getFirestoreOrRespond(res, "dashboard");
    if (!firestore) {
      return;
    }

    try {
      const payload = await getAdminDashboardPayload(firestore, req.authUser);
      res.status(200).json(payload);
    } catch (error) {
      respondWithError(res, "Failed to load admin dashboard data.", error);
    }
  });

  router.post("/users", async (req, res) => {
    const firestore = getFirestoreOrRespond(res, "users:create");
    if (!firestore) {
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      res.status(400).json({ message: "User payload must be a JSON object." });
      return;
    }

    try {
      const result = await createUserByAdmin({
        firestore,
        auth: admin.auth(),
        payload,
      });

      res.status(201).json(result);
    } catch (error) {
      const normalizedError = toSerializableError(error);
      const statusCode = Number(error?.statusCode) || 500;
      res.status(statusCode).json({
        message: error instanceof Error ? error.message : "Failed to create user.",
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });
    }
  });

  router.get("/reports/export", async (_req, res) => {
    const firestore = getFirestoreOrRespond(res, "reports:export");
    if (!firestore) {
      return;
    }

    try {
      const csv = await buildAdminReportsExportCsv(firestore);
      const fileDate = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=\"admin-reports-${fileDate}.csv\"`
      );
      res.status(200).send(csv);
    } catch (error) {
      respondWithError(res, "Failed to export reports.", error);
    }
  });

  router.get("/reports/:sessionId", async (req, res) => {
    const firestore = getFirestoreOrRespond(res, "reports:detail");
    if (!firestore) {
      return;
    }

    try {
      const payload = await getAdminReportDetails(firestore, req.params.sessionId);
      res.status(200).json(payload);
    } catch (error) {
      const statusCode = Number(error?.statusCode) || 500;
      const normalizedError = toSerializableError(error);
      res.status(statusCode).json({
        message:
          error instanceof Error ? error.message : "Failed to load interview report details.",
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });
    }
  });

  router.post("/logs/clear", (_req, res) => {
    // This project does not currently persist operational logs in Firestore.
    // Keep this endpoint explicit and non-destructive until a logs collection exists.
    res.status(409).json({
      cleared: false,
      logsAvailable: false,
      message: "No stored log collection is configured, so logs cannot be cleared.",
    });
  });

  return router;
}

function getFirestoreOrRespond(res, routeKey) {
  if (!isFirebaseAdminInitialized()) {
    console.warn(
      `[admin/${routeKey}] Firebase Admin is not initialized. Returning config error.`
    );
    res.status(503).json({
      message: "Firebase Admin credentials are not configured on the backend.",
      errorCode: "firebase-admin-not-configured",
      errorMessage: "Firebase Admin credentials are not configured on the backend.",
    });
    return null;
  }

  return admin.firestore();
}

function respondWithError(res, fallbackMessage, error) {
  const normalizedError = toSerializableError(error);

  res.status(500).json({
    message: fallbackMessage,
    errorCode: normalizedError.code,
    errorMessage: normalizedError.message,
  });
}

function toSerializableError(error) {
  if (error instanceof Error) {
    return {
      code: typeof error.code === "string" ? error.code : undefined,
      message: error.message,
    };
  }

  return {
    code: undefined,
    message: "Unknown error",
  };
}

module.exports = {
  createAdminRoutes,
};
