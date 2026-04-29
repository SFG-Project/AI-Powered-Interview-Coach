require("dotenv").config();

const cors = require("cors");
const express = require("express");
const {
  admin,
  initializeFirebaseAdmin,
  isFirebaseAdminInitialized,
} = require("./config/firebaseAdmin");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const USERS_COLLECTION = "users";
const FIRESTORE_HEALTH_COLLECTION = "healthChecks";
const FIRESTORE_HEALTH_DOC_ID = "landingPageConnectivityProbe";

app.use(
  cors(
    FRONTEND_URL
      ? {
          origin: FRONTEND_URL,
        }
      : undefined
  )
);
app.use(express.json());

initializeFirebaseAdmin();

app.get("/api/health", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.post("/api/auth/signup", async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ message: "Signup payload must be a JSON object." });
    return;
  }

  const firstName = getTrimmedString(payload.firstName);
  const lastName = getTrimmedString(payload.lastName);
  const email = getTrimmedString(payload.email);
  const industry = getTrimmedString(payload.industry);
  const password = getTrimmedString(payload.password);

  if (!firstName || !lastName || !email || !industry || !password) {
    res.status(400).json({
      errorCode: "invalid-argument",
      message: "firstName, lastName, email, industry and password are required.",
    });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({
      errorCode: "auth/weak-password",
      message: "Password is too weak. Use at least 8 characters.",
    });
    return;
  }

  if (!isFirebaseAdminInitialized()) {
    res.status(503).json({
      errorCode: "firebase-admin-not-configured",
      message: "Firebase Admin credentials are not configured on the backend.",
    });
    return;
  }

  const firestore = admin.firestore();
  const displayName = `${firstName} ${lastName}`.trim();
  let createdUser = null;

  try {
    createdUser = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    await firestore
      .collection(USERS_COLLECTION)
      .doc(createdUser.uid)
      .set(
        {
          firstName,
          lastName,
          displayName,
          email,
          industry,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    res.status(201).json({ id: createdUser.uid });
  } catch (error) {
    if (createdUser?.uid) {
      try {
        await admin.auth().deleteUser(createdUser.uid);
      } catch {
        // Ignore rollback failures and return the original error.
      }
    }

    const normalizedError = normalizeAuthError(error);
    res.status(normalizedError.httpStatus).json({
      errorCode: normalizedError.code,
      message: normalizedError.message,
    });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ message: "Signin payload must be a JSON object." });
    return;
  }

  const email = getTrimmedString(payload.email);
  const password = getTrimmedString(payload.password);

  if (!email || !password) {
    res.status(400).json({
      errorCode: "invalid-argument",
      message: "Email and password are required.",
    });
    return;
  }

  if (!FIREBASE_WEB_API_KEY) {
    res.status(503).json({
      errorCode: "firebase-web-api-key-missing",
      message: "FIREBASE_WEB_API_KEY is missing on the backend.",
    });
    return;
  }

  try {
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
        FIREBASE_WEB_API_KEY
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const body = await readJsonBody(signInResponse);

    if (!signInResponse.ok) {
      const message = getTrimmedString(
        body?.error && typeof body.error === "object" ? body.error.message : undefined
      );
      const normalizedError = normalizeSignInApiError(message);
      res.status(normalizedError.httpStatus).json({
        errorCode: normalizedError.code,
        message: normalizedError.message,
      });
      return;
    }

    res.json({
      idToken: getTrimmedString(body.idToken),
      refreshToken: getTrimmedString(body.refreshToken),
      expiresIn: getTrimmedString(body.expiresIn),
      localId: getTrimmedString(body.localId),
      email: getTrimmedString(body.email),
    });
  } catch (error) {
    res.status(500).json({
      errorCode: "request-failed",
      message: error instanceof Error ? error.message : "Sign in failed.",
    });
  }
});

app.get("/api/firestore/health", async (_req, res) => {
  const firestore = getFirestoreOrRespond(res);
  if (!firestore) {
    return;
  }

  try {
    await firestore
      .collection(FIRESTORE_HEALTH_COLLECTION)
      .doc(FIRESTORE_HEALTH_DOC_ID)
      .get();

    res.json({ status: "connected" });
  } catch (error) {
    const normalizedError = toSerializableError(error);
    const status = mapErrorCodeToStatus(normalizedError.code);

    res.status(500).json({
      status,
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.get("/api/users/:userId", async (req, res) => {
  const userId = getValidatedUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({ message: "A valid userId is required." });
    return;
  }

  const firestore = getFirestoreOrRespond(res);
  if (!firestore) {
    return;
  }

  try {
    const userDoc = await firestore.collection(USERS_COLLECTION).doc(userId).get();

    if (!userDoc.exists) {
      res.status(404).json({ message: "User profile not found." });
      return;
    }

    const data = userDoc.data() || {};

    res.json({
      id: userDoc.id,
      displayName: typeof data.displayName === "string" ? data.displayName : undefined,
      email: typeof data.email === "string" ? data.email : undefined,
    });
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to fetch user profile.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.put("/api/users/:userId", async (req, res) => {
  const userId = getValidatedUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({ message: "A valid userId is required." });
    return;
  }

  const firestore = getFirestoreOrRespond(res);
  if (!firestore) {
    return;
  }

  const profile = req.body;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    res.status(400).json({
      message: "Profile payload must be a JSON object.",
    });
    return;
  }

  const payload = {};

  if ("displayName" in profile) {
    if (typeof profile.displayName !== "string") {
      res.status(400).json({ message: "displayName must be a string." });
      return;
    }

    payload.displayName = profile.displayName.trim();
  }

  if ("email" in profile) {
    if (typeof profile.email !== "string") {
      res.status(400).json({ message: "email must be a string." });
      return;
    }

    payload.email = profile.email.trim();
  }

  payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  try {
    await firestore.collection(USERS_COLLECTION).doc(userId).set(payload, {
      merge: true,
    });

    res.json({ id: userId });
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to save user profile.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

function getValidatedUserId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function getFirestoreOrRespond(res) {
  if (!isFirebaseAdminInitialized()) {
    res.status(503).json({
      status: "config-error",
      errorCode: "firebase-admin-not-configured",
      errorMessage: "Firebase Admin credentials are not configured on the backend.",
    });
    return null;
  }

  return admin.firestore();
}

function mapErrorCodeToStatus(code) {
  if (code === "permission-denied" || code === "unauthenticated") {
    return "read-blocked";
  }

  if (code === "invalid-argument" || code === "failed-precondition") {
    return "config-error";
  }

  return "request-failed";
}

function toSerializableError(error) {
  if (error instanceof Error) {
    const code =
      typeof error.code === "string"
        ? error.code
        : undefined;
    return {
      code,
      message: error.message,
    };
  }

  return {
    code: undefined,
    message: "Unknown error",
  };
}

function getTrimmedString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeAuthError(error) {
  const code = typeof error?.code === "string" ? error.code : undefined;

  if (code === "auth/email-already-exists") {
    return {
      httpStatus: 409,
      code: "auth/email-already-in-use",
      message: "An account with this email already exists.",
    };
  }

  if (code === "auth/invalid-email") {
    return {
      httpStatus: 400,
      code: "auth/invalid-email",
      message: "Please enter a valid email address.",
    };
  }

  if (code === "auth/invalid-password") {
    return {
      httpStatus: 400,
      code: "auth/weak-password",
      message: "Password is too weak. Use at least 8 characters.",
    };
  }

  return {
    httpStatus: 500,
    code,
    message: error instanceof Error ? error.message : "Unable to create account.",
  };
}

function normalizeSignInApiError(code) {
  if (
    code === "INVALID_LOGIN_CREDENTIALS" ||
    code === "INVALID_PASSWORD" ||
    code === "EMAIL_NOT_FOUND"
  ) {
    return {
      httpStatus: 401,
      code: "auth/invalid-credential",
      message: "Invalid email or password.",
    };
  }

  if (code === "INVALID_EMAIL") {
    return {
      httpStatus: 400,
      code: "auth/invalid-email",
      message: "Please enter a valid email address.",
    };
  }

  if (code === "USER_DISABLED") {
    return {
      httpStatus: 403,
      code: "auth/user-disabled",
      message: "This account has been disabled.",
    };
  }

  if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return {
      httpStatus: 429,
      code: "auth/too-many-requests",
      message: "Too many login attempts. Please try again later.",
    };
  }

  return {
    httpStatus: 401,
    code: "auth/invalid-credential",
    message: "Unable to sign in right now. Please try again.",
  };
}

async function readJsonBody(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
