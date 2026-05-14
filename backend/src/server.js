require("dotenv").config();

const cors = require("cors");
const express = require("express");
const {
  admin,
  initializeFirebaseAdmin,
  isFirebaseAdminInitialized,
} = require("./config/firebaseAdmin");
const { interviewRoutes } = require("./routes/interviewRoutes");
const { createDashboardRoutes } = require("./routes/dashboardRoutes");
const { createAdminRoutes } = require("./routes/adminRoutes");
const { getProgressForUser } = require("./services/progressService");
const { getFeedbackReportsForUser } = require("./services/feedbackReportsService");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL;
const FRONTEND_URLS = process.env.FRONTEND_URLS;
const USERS_COLLECTION = "users";
const FIRESTORE_HEALTH_COLLECTION = "healthChecks";
const FIRESTORE_HEALTH_DOC_ID = "landingPageConnectivityProbe";
const NETLIFY_APP_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_CAREER_FIELDS = [
  "Software Developer",
  "Data Analyst",
  "Business Analyst",
  "Project Manager",
  "Cybersecurity Analyst",
  "Other",
];
const ALLOWED_EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const ALLOWED_INTERVIEW_TYPES = ["Technical", "Behavioural", "HR", "Mixed"];
const ALLOWED_DIFFICULTIES = ["Easy", "Medium", "Hard"];
const USER_ROLE_ADMIN = "admin";
const USER_ROLE_USER = "user";
const DEFAULT_ADMIN_IDENTIFIER = "admin";
const DEFAULT_ADMIN_EMAIL = "admin@sfg.com";
const DEFAULT_ADMIN_PASSWORD = "Password123!";
const DEFAULT_ADMIN_DISPLAY_NAME = "Admin";
const corsConfiguration = createCorsConfiguration({
  frontendUrl: FRONTEND_URL,
  frontendUrls: FRONTEND_URLS,
});
const corsOptions = {
  origin: corsConfiguration.originEvaluator,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(logApiRequestMetadata);

const firebaseAdminInitialization = initializeFirebaseAdmin();
logCorsStartupConfiguration(corsConfiguration);
logFirebaseStartupConfiguration(firebaseAdminInitialization);
void seedDefaultAdminUser();
logMissingCriticalEnvironmentVariables();
app.use("/api/interview", interviewRoutes);
app.use("/api/dashboard", createDashboardRoutes({ requireAuthenticatedUser }));
app.use(
  "/api/admin",
  createAdminRoutes({ requireAuthenticatedUser, requireAdminUser })
);

app.get("/api/health", (_req, res) => {
  res.json({ message: "Backend is running" });
});

app.post("/api/auth/signup", async (req, res) => {
  logSignUpRouteHit(req);

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
          uid: createdUser.uid,
          firstName,
          lastName,
          fullName: displayName,
          displayName,
          email,
          industry,
          careerField: industry,
          role: USER_ROLE_USER,
          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    logSignUpSuccess(email, createdUser.uid);
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
    logSignUpFailure(email, normalizedError.code);
    res.status(normalizedError.httpStatus).json({
      errorCode: normalizedError.code,
      message: normalizedError.message,
    });
  }
});

app.post("/api/auth/signin", async (req, res) => {
  logSignInRouteHit(req);

  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ message: "Signin payload must be a JSON object." });
    return;
  }

  const identifier =
    getTrimmedString(payload.email) ||
    getTrimmedString(payload.identifier) ||
    getTrimmedString(payload.username);
  const password = getTrimmedString(payload.password);
  const normalizedIdentifier = identifier ? identifier.toLowerCase() : undefined;
  const normalizedEmail = resolveSignInEmail(normalizedIdentifier);
  const firebaseWebApiKey = getFirebaseWebApiKey();

  if (!normalizedEmail || !password) {
    res.status(400).json({
      errorCode: "invalid-argument",
      message: "Email or Admin identifier and password are required.",
    });
    return;
  }

  if (!firebaseWebApiKey) {
    console.warn(
      "[auth/signin] Missing environment variable: FIREBASE_WEB_API_KEY."
    );

    res.status(503).json({
      errorCode: "firebase-web-api-key-missing",
      message: "FIREBASE_WEB_API_KEY is missing on the backend.",
    });
    return;
  }

  try {
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
        firebaseWebApiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
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

      logSignInFailure({
        email: normalizedEmail,
        normalizedErrorCode: normalizedError.code,
        providerErrorCode: message,
      });

      res.status(normalizedError.httpStatus).json({
        errorCode: normalizedError.code,
        message: normalizedError.message,
      });
      return;
    }

    logSignInSuccess(normalizedEmail);
    const localId = getTrimmedString(body.localId);
    const role = await getUserRoleForUid(localId, getTrimmedString(body.email));
    const isAdmin = role === USER_ROLE_ADMIN;
    logSignInRoleResolution(normalizedEmail, role, localId);
    logSignInResponsePayload(normalizedEmail, {
      localId,
      role,
      isAdmin,
      idToken: getTrimmedString(body.idToken),
    });

    res.json({
      idToken: getTrimmedString(body.idToken),
      refreshToken: getTrimmedString(body.refreshToken),
      expiresIn: getTrimmedString(body.expiresIn),
      localId,
      email: getTrimmedString(body.email),
      role,
      isAdmin,
    });
  } catch (error) {
    const serializedError = toSerializableError(error);
    logSignInFailure({
      email: normalizedEmail,
      normalizedErrorCode: "request-failed",
      providerErrorCode: serializedError.code,
      details: serializedError.message,
    });

    res.status(500).json({
      errorCode: "request-failed",
      message: "Sign in failed due to an upstream authentication request error.",
    });
  }
});

app.get("/api/auth/session", requireAuthenticatedUser, (req, res) => {
  const role = normalizeUserRole(req.authUser?.role);

  res.status(200).json({
    uid: getTrimmedString(req.authUser?.uid),
    email: getTrimmedString(req.authUser?.email),
    displayName: getTrimmedString(req.authUser?.displayName),
    role,
    isAdmin: role === USER_ROLE_ADMIN,
  });
});

app.get("/api/settings/me", requireAuthenticatedUser, async (req, res) => {
  const firestore = getFirestoreForSettingsOrRespond(res);
  if (!firestore) {
    return;
  }

  try {
    const settingsSnapshot = await ensureUserSettingsDocument(firestore, req.authUser);
    res.status(200).json(buildSettingsResponse(settingsSnapshot));
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to fetch settings.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.put("/api/settings/profile", requireAuthenticatedUser, async (req, res) => {
  const firestore = getFirestoreForSettingsOrRespond(res);
  if (!firestore) {
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ message: "Profile payload must be a JSON object." });
    return;
  }

  const fullName = getRequiredTrimmedString(payload.fullName);
  const email = getRequiredTrimmedString(payload.email);
  const careerField = getTrimmedString(payload.careerField);
  const experienceLevel = getTrimmedString(payload.experienceLevel);

  if (!fullName) {
    res.status(400).json({ message: "fullName is required." });
    return;
  }

  if (!email) {
    res.status(400).json({ message: "email is required." });
    return;
  }

  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ message: "email must be a valid email address." });
    return;
  }

  if (!careerField || !ALLOWED_CAREER_FIELDS.includes(careerField)) {
    res.status(400).json({ message: "careerField is invalid." });
    return;
  }

  if (!experienceLevel || !ALLOWED_EXPERIENCE_LEVELS.includes(experienceLevel)) {
    res.status(400).json({ message: "experienceLevel is invalid." });
    return;
  }

  try {
    await ensureUserSettingsDocument(firestore, req.authUser);
    await firestore.collection(USERS_COLLECTION).doc(req.authUser.uid).set(
      {
        uid: req.authUser.uid,
        fullName,
        email,
        careerField,
        experienceLevel,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const updatedSnapshot = await firestore
      .collection(USERS_COLLECTION)
      .doc(req.authUser.uid)
      .get();

    res.status(200).json(buildSettingsResponse(updatedSnapshot));
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to update profile settings.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.put("/api/settings/preferences", requireAuthenticatedUser, async (req, res) => {
  const firestore = getFirestoreForSettingsOrRespond(res);
  if (!firestore) {
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    res.status(400).json({ message: "Preferences payload must be a JSON object." });
    return;
  }

  const preferredInterviewType = getTrimmedString(payload.preferredInterviewType);
  const defaultDifficulty = getTrimmedString(payload.defaultDifficulty);
  const notesValue = getOptionalString(payload.notes);

  if (
    !preferredInterviewType ||
    !ALLOWED_INTERVIEW_TYPES.includes(preferredInterviewType)
  ) {
    res.status(400).json({ message: "preferredInterviewType is invalid." });
    return;
  }

  if (!defaultDifficulty || !ALLOWED_DIFFICULTIES.includes(defaultDifficulty)) {
    res.status(400).json({ message: "defaultDifficulty is invalid." });
    return;
  }

  if (notesValue === null) {
    res.status(400).json({ message: "notes must be a string." });
    return;
  }

  if ((notesValue || "").length > 1000) {
    res.status(400).json({ message: "notes must not exceed 1000 characters." });
    return;
  }

  try {
    await ensureUserSettingsDocument(firestore, req.authUser);
    await firestore.collection(USERS_COLLECTION).doc(req.authUser.uid).set(
      {
        uid: req.authUser.uid,
        preferredInterviewType,
        defaultDifficulty,
        notes: (notesValue || "").trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const updatedSnapshot = await firestore
      .collection(USERS_COLLECTION)
      .doc(req.authUser.uid)
      .get();

    res.status(200).json(buildSettingsResponse(updatedSnapshot));
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to update interview preferences.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.get("/api/progress/me", requireAuthenticatedUser, async (req, res) => {
  const firestore = getFirestoreForSettingsOrRespond(res);
  if (!firestore) {
    return;
  }

  logProgressRouteHit(req.authUser?.uid);

  try {
    const progressPayload = await getProgressForUser(firestore, req.authUser.uid);
    logProgressRouteResult(
      req.authUser?.uid,
      progressPayload?.overview?.completedInterviews
    );
    res.status(200).json(progressPayload);
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to load progress.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.get("/api/feedback-reports/me", requireAuthenticatedUser, async (req, res) => {
  const firestore = getFirestoreForSettingsOrRespond(res);
  if (!firestore) {
    return;
  }

  logFeedbackReportsRouteHit(req.authUser?.uid);

  try {
    const feedbackReportsPayload = await getFeedbackReportsForUser(
      firestore,
      req.authUser.uid
    );
    logFeedbackReportsRouteResult(
      req.authUser?.uid,
      feedbackReportsPayload?.reports?.length
    );
    res.status(200).json(feedbackReportsPayload);
  } catch (error) {
    const normalizedError = toSerializableError(error);
    res.status(500).json({
      message: "Failed to load feedback reports.",
      errorCode: normalizedError.code,
      errorMessage: normalizedError.message,
    });
  }
});

app.get("/api/firestore/health", async (req, res) => {
  const origin = getTrimmedString(req.headers.origin) || "unknown-origin";
  console.info(`[firestore/health] GET hit from ${origin}.`);

  const firestore = getFirestoreOrRespond(res);
  if (!firestore) {
    return;
  }

  try {
    await firestore
      .collection(FIRESTORE_HEALTH_COLLECTION)
      .doc(FIRESTORE_HEALTH_DOC_ID)
      .get();

    console.info("[firestore/health] Connection check succeeded.");
    res.json({ status: "connected" });
  } catch (error) {
    const normalizedError = toSerializableError(error);
    const status = mapErrorCodeToStatus(normalizedError.code);
    console.warn("[firestore/health] Connection check failed.", {
      status,
      errorCode: normalizedError.code || "unknown",
      errorMessage: normalizedError.message,
    });

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
      role: normalizeUserRole(data.role),
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

logAuthRouteRegistration();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

async function requireAuthenticatedUser(req, res, next) {
  if (!isFirebaseAdminInitialized()) {
    res.status(500).json({
      message: "Firebase Admin credentials are not configured on the backend.",
      errorCode: "firebase-admin-not-configured",
    });
    return;
  }

  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ message: "Missing or invalid Authorization header." });
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const role = await getUserRoleForUid(decodedToken.uid, decodedToken.email);
    req.authUser = {
      uid: decodedToken.uid,
      email: typeof decodedToken.email === "string" ? decodedToken.email : "",
      displayName: typeof decodedToken.name === "string" ? decodedToken.name : "",
      role,
    };
    next();
  } catch (error) {
    const serializedError = toSerializableError(error);
    console.warn(
      `[auth/token] Token verification failed. errorCode=${
        serializedError.code || "unknown"
      }.`
    );

    res.status(401).json({ message: "Invalid or expired authentication token." });
  }
}

function requireAdminUser(req, res, next) {
  const role = normalizeUserRole(req.authUser?.role);

  if (role !== USER_ROLE_ADMIN) {
    res.status(403).json({
      message: "Admin access is required for this resource.",
      errorCode: "admin-access-required",
    });
    return;
  }

  next();
}

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  const trimmedToken = token.trim();
  return trimmedToken || null;
}

function getFirestoreForSettingsOrRespond(res) {
  if (!isFirebaseAdminInitialized()) {
    console.warn(
      "[firestore/settings] Firebase Admin is not initialized. Returning config error."
    );
    res.status(503).json({
      status: "config-error",
      message: "Firebase Admin credentials are not configured on the backend.",
      errorCode: "firebase-admin-not-configured",
      errorMessage: "Firebase Admin credentials are not configured on the backend.",
    });
    return null;
  }

  return admin.firestore();
}

async function ensureUserSettingsDocument(firestore, authUser) {
  const docRef = firestore.collection(USERS_COLLECTION).doc(authUser.uid);
  let snapshot = await docRef.get();

  if (!snapshot.exists) {
    const defaults = await getDefaultSettingsValues(authUser, undefined);

    await docRef.set({
      uid: authUser.uid,
      role: normalizeUserRole(authUser.role),
      status: "active",
      email: defaults.email,
      fullName: defaults.fullName,
      careerField: defaults.careerField,
      experienceLevel: defaults.experienceLevel,
      preferredInterviewType: defaults.preferredInterviewType,
      defaultDifficulty: defaults.defaultDifficulty,
      notes: defaults.notes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return await docRef.get();
  }

  const data = snapshot.data() || {};
  const normalizedValues = await getDefaultSettingsValues(authUser, data);

  const patch = {};

  if (typeof data.uid !== "string" || data.uid.trim() !== authUser.uid) {
    patch.uid = authUser.uid;
  }

  const normalizedRole = normalizeUserRole(data.role);
  if (data.role !== normalizedRole) {
    patch.role = normalizedRole;
  }

  if (typeof data.email !== "string" || !data.email.trim()) {
    patch.email = normalizedValues.email;
  }

  if (typeof data.status !== "string" || !data.status.trim()) {
    patch.status = "active";
  }

  if (typeof data.fullName !== "string" || !data.fullName.trim()) {
    patch.fullName = normalizedValues.fullName;
  }

  if (!ALLOWED_CAREER_FIELDS.includes(data.careerField)) {
    patch.careerField = normalizedValues.careerField;
  }

  if (!ALLOWED_EXPERIENCE_LEVELS.includes(data.experienceLevel)) {
    patch.experienceLevel = normalizedValues.experienceLevel;
  }

  if (!ALLOWED_INTERVIEW_TYPES.includes(data.preferredInterviewType)) {
    patch.preferredInterviewType = normalizedValues.preferredInterviewType;
  }

  if (!ALLOWED_DIFFICULTIES.includes(data.defaultDifficulty)) {
    patch.defaultDifficulty = normalizedValues.defaultDifficulty;
  }

  const currentNotes = typeof data.notes === "string" ? data.notes : "";
  if (currentNotes.length > 1000) {
    patch.notes = currentNotes.slice(0, 1000);
  } else if (typeof data.notes !== "string") {
    patch.notes = normalizedValues.notes;
  }

  if (!data.createdAt) {
    patch.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }

  if (Object.keys(patch).length > 0) {
    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await docRef.set(patch, { merge: true });
    snapshot = await docRef.get();
  }

  return snapshot;
}

async function getDefaultSettingsValues(authUser, existingData) {
  const authUserRecord = await getAuthUserRecord(authUser.uid);
  const displayNameFromExisting = getTrimmedString(existingData?.displayName);
  const displayNameFromAuth = getTrimmedString(authUserRecord?.displayName);
  const displayNameFromToken = getTrimmedString(authUser.displayName);

  const firstName = getTrimmedString(existingData?.firstName);
  const lastName = getTrimmedString(existingData?.lastName);
  const fullNameFromNames = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    email:
      getTrimmedString(existingData?.email) ||
      getTrimmedString(authUserRecord?.email) ||
      getTrimmedString(authUser.email) ||
      "",
    fullName:
      getTrimmedString(existingData?.fullName) ||
      displayNameFromExisting ||
      fullNameFromNames ||
      displayNameFromAuth ||
      displayNameFromToken ||
      "",
    careerField: ALLOWED_CAREER_FIELDS.includes(existingData?.careerField)
      ? existingData.careerField
      : "Software Developer",
    experienceLevel: ALLOWED_EXPERIENCE_LEVELS.includes(existingData?.experienceLevel)
      ? existingData.experienceLevel
      : "Intermediate",
    preferredInterviewType: ALLOWED_INTERVIEW_TYPES.includes(
      existingData?.preferredInterviewType
    )
      ? existingData.preferredInterviewType
      : "Technical",
    defaultDifficulty: ALLOWED_DIFFICULTIES.includes(existingData?.defaultDifficulty)
      ? existingData.defaultDifficulty
      : "Medium",
    notes:
      typeof existingData?.notes === "string" ? existingData.notes.slice(0, 1000) : "",
  };
}

async function getAuthUserRecord(uid) {
  try {
    return await admin.auth().getUser(uid);
  } catch {
    return null;
  }
}

function buildSettingsResponse(snapshot) {
  const data = snapshot.data() || {};

  return {
    uid: snapshot.id,
    role: normalizeUserRole(data.role),
    email: typeof data.email === "string" ? data.email : "",
    fullName: typeof data.fullName === "string" ? data.fullName : "",
    careerField: ALLOWED_CAREER_FIELDS.includes(data.careerField)
      ? data.careerField
      : "Software Developer",
    experienceLevel: ALLOWED_EXPERIENCE_LEVELS.includes(data.experienceLevel)
      ? data.experienceLevel
      : "Intermediate",
    preferredInterviewType: ALLOWED_INTERVIEW_TYPES.includes(data.preferredInterviewType)
      ? data.preferredInterviewType
      : "Technical",
    defaultDifficulty: ALLOWED_DIFFICULTIES.includes(data.defaultDifficulty)
      ? data.defaultDifficulty
      : "Medium",
    notes: typeof data.notes === "string" ? data.notes : "",
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
  };
}

function toIsoTimestamp(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return null;
}

function getValidatedUserId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function getFirestoreOrRespond(res) {
  if (!isFirebaseAdminInitialized()) {
    console.warn(
      "[firestore] Firebase Admin is not initialized. Returning config error."
    );
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

function logApiRequestMetadata(req, _res, next) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  const origin = normalizeOrigin(req.headers.origin) || "no-origin-header";
  const hasAuthorizationHeader = Boolean(readBearerToken(req.headers.authorization));
  console.info("[api/request]", {
    method: req.method,
    path: req.path,
    origin,
    hasAuthorizationHeader,
  });

  next();
}

function createCorsConfiguration({ frontendUrl, frontendUrls }) {
  const explicitOrigins = resolveConfiguredCorsOrigins(frontendUrl, frontendUrls);
  const hasOnlyLocalOrigins =
    explicitOrigins.length > 0 && explicitOrigins.every(isLocalDevelopmentOrigin);
  const hasConfiguredNetlifyOrigin = hasAnyConfiguredNetlifyOrigin(frontendUrl, frontendUrls);
  const allowNetlifyOriginsFallback =
    !isDevelopmentEnvironment() && (hasOnlyLocalOrigins || hasConfiguredNetlifyOrigin);

  return {
    explicitOrigins,
    allowNetlifyOriginsFallback,
    originEvaluator(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);

      if (!normalizedOrigin) {
        callback(null, true);
        return;
      }

      const isExplicitlyAllowed =
        explicitOrigins.length === 0 || explicitOrigins.includes(normalizedOrigin);
      const isNetlifyFallbackAllowed =
        allowNetlifyOriginsFallback && NETLIFY_APP_ORIGIN_PATTERN.test(normalizedOrigin);
      const isAllowed = isExplicitlyAllowed || isNetlifyFallbackAllowed;

      if (!isAllowed) {
        console.warn("[cors] Blocked request origin.", {
          origin: normalizedOrigin,
          explicitOrigins,
          allowNetlifyOriginsFallback,
        });
      }

      callback(null, isAllowed);
    },
  };
}

function resolveConfiguredCorsOrigins(frontendUrl, frontendUrls) {
  const normalizedOrigins = resolveConfiguredCorsOriginInputs(frontendUrl, frontendUrls)
    .map((value) => normalizeOrigin(value))
    .filter((value) => Boolean(value));

  return Array.from(new Set(normalizedOrigins));
}

function resolveConfiguredCorsOriginInputs(frontendUrl, frontendUrls) {
  const rawInputs = [frontendUrl, frontendUrls]
    .filter((value) => typeof value === "string")
    .join(",");

  if (!rawInputs.trim()) {
    return [];
  }

  return rawInputs
    .split(/[,\n;\s]+/)
    .map((value) => unwrapQuotedString(value))
    .filter((value) => Boolean(value));
}

function hasAnyConfiguredNetlifyOrigin(frontendUrl, frontendUrls) {
  return resolveConfiguredCorsOriginInputs(frontendUrl, frontendUrls).some((value) => {
    const normalizedOrigin = normalizeOrigin(value);
    return Boolean(normalizedOrigin) && NETLIFY_APP_ORIGIN_PATTERN.test(normalizedOrigin);
  });
}

function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = unwrapQuotedString(value);
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

function unwrapQuotedString(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.length < 2) {
    return trimmed;
  }

  const firstCharacter = trimmed[0];
  const lastCharacter = trimmed[trimmed.length - 1];
  const hasWrappingQuotes =
    (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === "`") &&
    firstCharacter === lastCharacter;

  if (!hasWrappingQuotes) {
    return trimmed;
  }

  return trimmed.slice(1, -1).trim();
}

function isLocalDevelopmentOrigin(origin) {
  if (typeof origin !== "string") {
    return false;
  }

  return (
    origin.startsWith("http://localhost") ||
    origin.startsWith("https://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://127.0.0.1")
  );
}

function logCorsStartupConfiguration(configuration) {
  if (!configuration || typeof configuration !== "object") {
    return;
  }

  const explicitOrigins = Array.isArray(configuration.explicitOrigins)
    ? configuration.explicitOrigins
    : [];

  if (!explicitOrigins.length) {
    console.warn(
      "[cors] FRONTEND_URL/FRONTEND_URLS not configured. Allowing requests from any origin."
    );
  } else {
    console.info("[cors] Explicitly allowed origins:", explicitOrigins);
  }

  if (configuration.allowNetlifyOriginsFallback) {
    console.warn(
      "[cors] Netlify origin fallback enabled in production. Allowing *.netlify.app origins in addition to explicit origins."
    );
  }
}

function logFirebaseStartupConfiguration(initializationResult) {
  const initialized = initializationResult?.initialized === true;
  console.info("[firebase-admin/startup] Initialization summary.", {
    initialized,
    serviceAccountPathConfigured: Boolean(
      getTrimmedString(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    ),
    projectIdConfigured: Boolean(getTrimmedString(process.env.FIREBASE_PROJECT_ID)),
    clientEmailConfigured: Boolean(getTrimmedString(process.env.FIREBASE_CLIENT_EMAIL)),
    privateKeyConfigured: Boolean(getTrimmedString(process.env.FIREBASE_PRIVATE_KEY)),
    databaseUrlConfigured: Boolean(getTrimmedString(process.env.FIREBASE_DATABASE_URL)),
  });
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

function getRequiredTrimmedString(value) {
  const trimmedValue = getTrimmedString(value);
  return trimmedValue || undefined;
}

function getOptionalString(value) {
  if (value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    return null;
  }

  return value;
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
  const normalizedProviderCode = normalizeProviderErrorCode(code);

  if (normalizedProviderCode === "INVALID_LOGIN_CREDENTIALS") {
    return {
      httpStatus: 401,
      code: "auth/invalid-credential",
      message: "Invalid email or password.",
    };
  }

  if (normalizedProviderCode === "INVALID_PASSWORD") {
    return {
      httpStatus: 401,
      code: "auth/wrong-password",
      message: "Incorrect password.",
    };
  }

  if (normalizedProviderCode === "EMAIL_NOT_FOUND") {
    return {
      httpStatus: 401,
      code: "auth/invalid-credential",
      message: "Invalid email or password.",
    };
  }

  if (normalizedProviderCode === "INVALID_EMAIL") {
    return {
      httpStatus: 400,
      code: "auth/invalid-email",
      message: "Please enter a valid email address.",
    };
  }

  if (normalizedProviderCode === "USER_DISABLED") {
    return {
      httpStatus: 403,
      code: "auth/user-disabled",
      message: "This account has been disabled.",
    };
  }

  if (normalizedProviderCode === "TOO_MANY_ATTEMPTS_TRY_LATER") {
    return {
      httpStatus: 429,
      code: "auth/too-many-requests",
      message: "Too many login attempts. Please try again later.",
    };
  }

  if (normalizedProviderCode === "OPERATION_NOT_ALLOWED") {
    return {
      httpStatus: 403,
      code: "auth/operation-not-allowed",
      message: "Email/password sign-in is not enabled for this Firebase project.",
    };
  }

  if (
    normalizedProviderCode === "API_KEY_INVALID" ||
    normalizedProviderCode === "INVALID_API_KEY"
  ) {
    return {
      httpStatus: 503,
      code: "firebase-web-api-key-invalid",
      message: "Backend Firebase web API key is invalid for sign-in.",
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

function normalizeProviderErrorCode(value) {
  const rawValue = getTrimmedString(value);
  if (!rawValue) {
    return undefined;
  }

  if (rawValue.includes(":")) {
    return rawValue.split(":")[0].trim();
  }

  const uppercaseValue = rawValue.toUpperCase();
  if (uppercaseValue.includes("API KEY NOT VALID")) {
    return "API_KEY_INVALID";
  }

  return rawValue;
}

function logMissingCriticalEnvironmentVariables() {
  if (!getFirebaseWebApiKey()) {
    console.warn(
      "[config] Missing environment variable: FIREBASE_WEB_API_KEY (required for /api/auth/signin)."
    );
  }
}

function getFirebaseWebApiKey() {
  return getTrimmedString(process.env.FIREBASE_WEB_API_KEY);
}

function resolveSignInEmail(identifier) {
  const normalizedIdentifier = getTrimmedString(identifier)?.toLowerCase();
  if (!normalizedIdentifier) {
    return undefined;
  }

  if (normalizedIdentifier === getAdminSeedIdentifier()) {
    return getAdminSeedEmail().toLowerCase();
  }

  if (!EMAIL_PATTERN.test(normalizedIdentifier)) {
    return undefined;
  }

  return normalizedIdentifier;
}

async function getUserRoleForUid(uid, email) {
  const normalizedEmail = getTrimmedString(email)?.toLowerCase();
  if (normalizedEmail === getAdminSeedEmail().toLowerCase()) {
    return USER_ROLE_ADMIN;
  }

  if (!uid || !isFirebaseAdminInitialized()) {
    return USER_ROLE_USER;
  }

  try {
    const userDocRef = admin.firestore().collection(USERS_COLLECTION).doc(uid);
    const userSnapshot = await userDocRef.get();

    if (!userSnapshot.exists) {
      return USER_ROLE_USER;
    }

    const data = userSnapshot.data() || {};
    const normalizedRole = normalizeUserRole(data.role);

    if (data.role !== normalizedRole) {
      await userDocRef.set(
        {
          role: normalizedRole,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    return normalizedRole;
  } catch (error) {
    const serializedError = toSerializableError(error);
    console.warn(
      `[auth/role] Failed to resolve role for uid=${uid}. errorCode=${
        serializedError.code || "unknown"
      }.`
    );
    return USER_ROLE_USER;
  }
}

function normalizeUserRole(value) {
  const normalized = getTrimmedString(value)?.toLowerCase();
  return normalized === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_USER;
}

async function seedDefaultAdminUser() {
  if (!isFirebaseAdminInitialized()) {
    return;
  }

  const adminEmail = getAdminSeedEmail();
  const adminPassword = getAdminSeedPassword();
  const adminIdentifier = getAdminSeedIdentifier();

  if (!adminEmail || !adminPassword) {
    console.warn("[admin/seed] Missing admin seed credentials. Skipping admin seeding.");
    return;
  }

  try {
    const firestore = admin.firestore();
    let adminUser;

    try {
      adminUser = await admin.auth().getUserByEmail(adminEmail);
      await admin.auth().updateUser(adminUser.uid, {
        password: adminPassword,
        displayName: DEFAULT_ADMIN_DISPLAY_NAME,
      });
    } catch (error) {
      if (error && typeof error === "object" && error.code === "auth/user-not-found") {
        adminUser = await admin.auth().createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: DEFAULT_ADMIN_DISPLAY_NAME,
        });
      } else {
        throw error;
      }
    }

    await firestore
      .collection(USERS_COLLECTION)
      .doc(adminUser.uid)
      .set(
        {
          uid: adminUser.uid,
          firstName: DEFAULT_ADMIN_DISPLAY_NAME,
          lastName: "",
          fullName: DEFAULT_ADMIN_DISPLAY_NAME,
          displayName: DEFAULT_ADMIN_DISPLAY_NAME,
          email: adminEmail,
          industry: "Software Developer",
          careerField: "Software Developer",
          role: USER_ROLE_ADMIN,
          status: "active",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    console.info(
      `[admin/seed] Default admin ready. role=${USER_ROLE_ADMIN}. Sign-in identifier="${adminIdentifier}" maps to ${adminEmail}.`
    );
    logSeededAdminRecord(adminUser.uid, adminEmail, adminIdentifier);
  } catch (error) {
    const serializedError = toSerializableError(error);
    console.warn(
      `[admin/seed] Failed to seed default admin. errorCode=${
        serializedError.code || "unknown"
      } message="${serializedError.message}".`
    );
  }
}

function getAdminSeedIdentifier() {
  const identifier = getTrimmedString(process.env.ADMIN_SEED_IDENTIFIER)?.toLowerCase();
  return identifier || DEFAULT_ADMIN_IDENTIFIER;
}

function getAdminSeedEmail() {
  return getTrimmedString(process.env.ADMIN_SEED_EMAIL) || DEFAULT_ADMIN_EMAIL;
}

function getAdminSeedPassword() {
  return getTrimmedString(process.env.ADMIN_SEED_PASSWORD) || DEFAULT_ADMIN_PASSWORD;
}

function logSignInFailure({ email, normalizedErrorCode, providerErrorCode, details }) {
  const detailText = details ? ` details="${details}"` : "";
  const providerCodeText = providerErrorCode
    ? ` providerErrorCode=${providerErrorCode}`
    : "";
  const maskedEmail = maskEmail(email);

  console.warn(
    `[auth/signin] Failed for ${maskedEmail}. normalizedErrorCode=${normalizedErrorCode}.${providerCodeText}${detailText}`
  );
}

function logAuthRouteRegistration() {
  console.info(
    "[startup] Registered auth routes: POST /api/auth/signup, POST /api/auth/signin, GET /api/auth/session. Admin routes mounted at /api/admin."
  );
}

function logSignUpRouteHit(req) {
  const origin = getTrimmedString(req.headers.origin) || "unknown-origin";
  console.info(`[auth/signup] ${req.method} ${req.path} hit from ${origin}`);
}

function logSignUpSuccess(email, uid) {
  const maskedEmail = maskEmail(email);
  const hasUid = typeof uid === "string" && Boolean(uid.trim());
  console.info(`[auth/signup] Success for ${maskedEmail}. uidCreated=${hasUid}.`);
}

function logSignUpFailure(email, normalizedErrorCode) {
  const maskedEmail = maskEmail(email);
  console.warn(
    `[auth/signup] Failed for ${maskedEmail}. normalizedErrorCode=${normalizedErrorCode || "unknown"}.`
  );
}

function logSignInRouteHit(req) {
  const origin = getTrimmedString(req.headers.origin) || "unknown-origin";
  console.info(`[auth/signin] ${req.method} ${req.path} hit from ${origin}`);
}

function logSignInSuccess(email) {
  const maskedEmail = maskEmail(email);
  console.info(`[auth/signin] Success for ${maskedEmail}.`);
}

function logSignInRoleResolution(email, role, uid) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const maskedEmail = maskEmail(email);
  const normalizedRole = normalizeUserRole(role);
  const hasUid = typeof uid === "string" && Boolean(uid.trim());
  console.info(
    `[auth/signin] Role resolved for ${maskedEmail}. role=${normalizedRole}. uidFound=${hasUid}.`
  );
}

function logSignInResponsePayload(email, payload) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const maskedEmail = maskEmail(email);
  console.info("[auth/signin] Response payload summary.", {
    email: maskedEmail,
    role: normalizeUserRole(payload?.role),
    isAdmin: payload?.isAdmin === true,
    localIdFound: typeof payload?.localId === "string" && Boolean(payload.localId.trim()),
    idTokenFound: typeof payload?.idToken === "string" && Boolean(payload.idToken.trim()),
  });
}

function logSeededAdminRecord(uid, email, identifier) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const maskedEmail = maskEmail(email);
  const hasUid = typeof uid === "string" && Boolean(uid.trim());
  console.info("[admin/seed] Seeded admin record.", {
    identifier,
    email: maskedEmail,
    role: USER_ROLE_ADMIN,
    uidFound: hasUid,
  });
}

function logProgressRouteHit(uid) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const hasUserId = typeof uid === "string" && Boolean(uid.trim());
  console.info(`[progress/me] GET hit. userIdFound=${hasUserId}.`);
}

function logProgressRouteResult(uid, completedInterviews) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const completedCount = Number.isFinite(Number(completedInterviews))
    ? Number(completedInterviews)
    : 0;
  const hasUserId = typeof uid === "string" && Boolean(uid.trim());
  console.info(
    `[progress/me] userIdFound=${hasUserId}. completedSessions=${completedCount}.`
  );
}

function logFeedbackReportsRouteHit(uid) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const hasUserId = typeof uid === "string" && Boolean(uid.trim());
  console.info(`[feedback-reports/me] GET hit. userIdFound=${hasUserId}.`);
}

function logFeedbackReportsRouteResult(uid, reportCount) {
  if (!isDevelopmentEnvironment()) {
    return;
  }

  const completedCount = Number.isFinite(Number(reportCount))
    ? Number(reportCount)
    : 0;
  const hasUserId = typeof uid === "string" && Boolean(uid.trim());
  console.info(
    `[feedback-reports/me] userIdFound=${hasUserId}. completedReports=${completedCount}.`
  );
}

function isDevelopmentEnvironment() {
  return process.env.NODE_ENV !== "production";
}

function maskEmail(email) {
  if (typeof email !== "string") {
    return "unknown-email";
  }

  const trimmedEmail = email.trim();
  const atIndex = trimmedEmail.indexOf("@");

  if (atIndex <= 0) {
    return "invalid-email";
  }

  const localPart = trimmedEmail.slice(0, atIndex);
  const domain = trimmedEmail.slice(atIndex + 1);
  const visiblePrefix = localPart.slice(0, 1);
  const visibleSuffix = localPart.slice(-1);

  if (localPart.length === 1) {
    return `${visiblePrefix}***@${domain}`;
  }

  return `${visiblePrefix}***${visibleSuffix}@${domain}`;
}
