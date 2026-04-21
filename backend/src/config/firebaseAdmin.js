const admin = require("firebase-admin");

function hasRequiredFirebaseEnv(env) {
  return (
    Boolean(env.FIREBASE_PROJECT_ID) &&
    Boolean(env.FIREBASE_CLIENT_EMAIL) &&
    Boolean(env.FIREBASE_PRIVATE_KEY)
  );
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return { initialized: true };
  }

  if (!hasRequiredFirebaseEnv(process.env)) {
    console.warn(
      "[firebase-admin] Credentials not found. Skipping Firebase Admin initialization."
    );
    return { initialized: false };
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });

    console.log("[firebase-admin] Firebase Admin initialized.");
    return { initialized: true };
  } catch (error) {
    console.warn(
      `[firebase-admin] Initialization failed, continuing without Firebase: ${error.message}`
    );
    return { initialized: false };
  }
}

module.exports = {
  admin,
  initializeFirebaseAdmin,
};

