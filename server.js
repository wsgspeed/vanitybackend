// server/index.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");
require("dotenv").config(); // load .env variables

// Initialize Firebase Admin from environment variables
const {
  TYPE,
  PROJECT_ID,
  PRIVATE_KEY_ID,
  PRIVATE_KEY,
  CLIENT_EMAIL,
  CLIENT_ID,
  AUTH_URI,
  TOKEN_URI,
  AUTH_PROVIDER_X509_CERT_URL,
  CLIENT_X509_CERT_URL,
  UNIVERSE_DOMAIN,
} = process.env;

if (!PRIVATE_KEY || !CLIENT_EMAIL || !PROJECT_ID) {
  throw new Error("Missing Firebase environment variables. Check your .env!");
}

admin.initializeApp({
  credential: admin.credential.cert({
    type: TYPE,
    project_id: PROJECT_ID,
    private_key_id: PRIVATE_KEY_ID,
    private_key: PRIVATE_KEY.replace(/\\n/g, "\n"), // fix escaped newlines
    client_email: CLIENT_EMAIL,
    client_id: CLIENT_ID,
    auth_uri: AUTH_URI,
    token_uri: TOKEN_URI,
    auth_provider_x509_cert_url: AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: CLIENT_X509_CERT_URL,
    universe_domain: UNIVERSE_DOMAIN,
  }),
});

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());

// Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
});
app.use(limiter);

// Register user endpoint
app.post("/auth/registerUser", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  try {
    const userRecord = await admin.auth().createUser({ email, password });
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);

    res.status(201).json({
      message: "Account created successfully. Please verify your email.",
      verificationLink,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Login user endpoint
app.post("/auth/loginUser", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  try {
    const user = await admin.auth().getUserByEmail(email);
    res.status(200).json({
      message: "Login successful!",
      uid: user.uid,
      email: user.email,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Invalid credentials or user not found." });
  }
});

// Save profile endpoint
// server/index.js (or wherever your saveProfile endpoint is)
app.post("/api/saveProfile", async (req, res) => {
  try {
    const { uid, username, bio, links, pfpUrl } = req.body;

    if (!uid) return res.status(400).json({ error: "UID is required" });

    // Ensure links is always an array
    const linksArray = Array.isArray(links)
      ? links
      : typeof links === "string"
      ? links.split(",").map((l) => l.trim())
      : [];

    await db.collection("profiles").doc(uid).set(
      {
        username,
        bio: bio || "",
        links: linksArray,
        pfpUrl: pfpUrl || null,
        updatedAt: new Date(),
      },
      { merge: true } // merge ensures updates overwrite, not create new docs
    );

    res.json({ message: "Profile saved successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error saving profile" });
  }
});


// Get profile endpoint
app.get("/api/getProfile/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const doc = await db.collection("profiles").doc(username).get();
    if (!doc.exists)
      return res.status(404).json({ message: "User not found" });

    const data = doc.data();
    if (!Array.isArray(data.links)) data.links = [];

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching profile" });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("🚀 Vanity API running with Firestore support!");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Vanity server running on port ${PORT}`)
);

