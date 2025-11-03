const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const admin = require("firebase-admin");

const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
});
app.use(limiter);

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

app.post("/api/saveProfile", async (req, res) => {
  try {
    const { username, bio, links, pfpUrl } = req.body;
    const linksArray = Array.isArray(links) ? links : (typeof links === "string" ? links.split(",").map(l => l.trim()) : []);

    await db.collection("profiles").doc(username).set(
      {
        username,
        bio: bio || "",
        links: linksArray,
        pfpUrl: pfpUrl || null,
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

app.get("/", (req, res) => {
  res.send("🚀 Vanity API running with Firestore support!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Vanity server running on port ${PORT}`));
