const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");
require("dotenv").config();

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
  throw new Error("Missing Firebase environment variables.");
}

admin.initializeApp({
  credential: admin.credential.cert({
    type: TYPE,
    project_id: PROJECT_ID,
    private_key_id: PRIVATE_KEY_ID,
    private_key: PRIVATE_KEY.replace(/\\n/g, "\n"),
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

// --- RATE LIMIT ---
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
  })
);

// --- FIND PROFILE BY USERNAME ---
app.get("/api/findProfile", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: "Username required" });
    const snapshot = await db
      .collection("profiles")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (snapshot.empty)
      return res.status(404).json({ message: "User not found" });

    const doc = snapshot.docs[0];
    res.json(doc.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching profile" });
  }
});

// --- GET PROFILE BY UID ---
app.get("/api/getProfile/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const doc = await db.collection("profiles").doc(uid).get();
    if (!doc.exists) return res.status(404).json({ message: "User not found" });
    res.json(doc.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error fetching profile" });
  }
});

// --- SAVE OR UPDATE PROFILE ---
app.post("/api/saveProfile", async (req, res) => {
  try {
    const {
      uid,
      username,
      displayName,
      bio,
      links,
      pfpUrl,
      bannerUrl,
      background,
      cursor,
      glow,
      trail,
      font,
      youtube,
    } = req.body;

    if (!uid) return res.status(400).json({ error: "UID is required" });

    const linksArray = Array.isArray(links)
      ? links
      : typeof links === "string"
      ? links.split(",").map((l) => l.trim())
      : [];

    await db.collection("profiles").doc(uid).set(
      {
        username,
        displayName: displayName || username,
        bio: bio || "",
        links: linksArray,
        pfpUrl: pfpUrl || null,
        bannerUrl: bannerUrl || null,
        background: background || "default",
        cursor: cursor || "default",
        glow: !!glow,
        trail: !!trail,
        font: font || "Arial",
        youtube: youtube || "",
        updatedAt: new Date(),
      },
      { merge: true }
    );

    res.json({ message: "Profile saved successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error saving profile" });
  }
});

// --- REGISTER USER ---
app.post("/auth/registerUser", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const userRecord = await admin.auth().createUser({ email, password });
    res.status(201).json({
      message: "Account created successfully.",
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- LOGIN USER ---
app.post("/auth/loginUser", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const user = await admin.auth().getUserByEmail(email);
    res.status(200).json({
      message: "Login successful!",
      uid: user.uid,
      email: user.email,
    });
  } catch {
    res.status(400).json({ message: "Invalid credentials" });
  }
});

app.get("/", (req, res) => {
  res.send("🚀 Vanity API running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on ${PORT}`));
