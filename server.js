const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const admin = require('firebase-admin');

const app = express();

// =========================
// Initialize Firebase Admin
// =========================
const firebaseConfig = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf8'));
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
});
const db = admin.firestore();

// =========================
// Multer Configs
// =========================
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// =========================
// Utilities
// =========================
function generateOTP() {
  return `OTP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateArtistID() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function bufferToBase64(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

// =========================
// Express Middleware
// =========================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.set('trust proxy', 1); // <-- needed if behind HTTPS proxy/load balancer
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,      // <--- MUST be true for HTTPS
    httpOnly: true,
    sameSite: 'lax',   // allows fetch with credentials
  }
}));

app.use('/static', express.static(path.join(__dirname, 'public/static')));

// =========================
// ROUTES: Pages
// =========================
app.get('/', (req, res) => {
  if (req.session.artistID) {
    if (req.session.userRole === 'admin') return res.redirect('/admin-dashboard');
    return res.redirect('/home');
  }
  res.redirect('/home');
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/create-account', (req, res) => res.sendFile(path.join(__dirname, 'public', 'create-account.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.get('/team', (req, res) => res.sendFile(path.join(__dirname, 'public', 'team.html')));
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shop.html')));
app.get('/contact-us', (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact-us.html')));
app.get('/settings', (req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));
app.get('/admin-dashboard', (req, res) => {
  if (!req.session.artistID || req.session.userRole !== 'admin') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});
app.get('/home', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});
app.get('/profile/:username', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/profile', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/event', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'event.html'));
});

// =========================
// API: Authentication
// =========================
app.post('/api/login', async (req, res) => {
  const { artistID, password } = req.body;
  if (!artistID || !password) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const doc = await db.collection('users').doc(artistID).get();
    if (!doc.exists) return res.status(401).json({ error: 'Invalid artistID' });

    const user = doc.data();
    if (user.otpActive) {
      const isValidOTP = await bcrypt.compare(password, user.password);
      if (isValidOTP) return res.status(403).json({ error: 'reset_password', artistID });
      else return res.status(401).json({ error: 'Wrong OTP' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Wrong password' });

    req.session.artistID = artistID;
    req.session.userRole = user.role;
    res.json({ role: user.role });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { artistID, newPassword } = req.body;
  if (!artistID || !newPassword || newPassword.length < 4)
    return res.status(400).json({ error: 'Invalid input' });

  try {
    const doc = await db.collection('users').doc(artistID).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const user = doc.data();
    if (!user.otpActive) return res.status(400).json({ error: 'Password reset not allowed' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.collection('users').doc(artistID).update({
      password: hashedNewPassword,
      otpActive: false,
    });

    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    console.error('Reset password error:', e);
    res.status(500).json({ error: 'DB error on update' });
  }
});

app.post('/api/generate-otp', async (req, res) => {
  const { artistID } = req.body;
  if (!artistID) return res.status(400).json({ error: 'Missing artistID' });

  try {
    const otp = generateOTP();
    const plainOTP = otp.slice(4);
    const hashedOTP = await bcrypt.hash(plainOTP, 10);

    const userRef = db.collection('users').doc(artistID);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: 'User not found' });

    await userRef.update({ password: hashedOTP, otpActive: true });
    res.json({ otp: plainOTP });
  } catch (err) {
    console.error('Error generating OTP:', err);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

app.get('/api/current-user', async (req, res) => {
  if (!req.session.artistID) {
    return res.status(401).json({ loggedIn: false });
  }

  try {
    const userDoc = await db.collection('users').doc(req.session.artistID).get();

    if (!userDoc.exists) {
      return res.status(404).json({ loggedIn: false });
    }

    const user = userDoc.data();

    res.json({
      loggedIn: true,
      artistID: user.artistID,
      artistName: user.artistName,
      role: user.role,
      profilePhotoPath: user.profilePhotoPath
    });

  } catch (err) {
    console.error('Current user error:', err);
    res.status(500).json({ loggedIn: false });
  }
});

// =========================
// API: Create Account
// =========================
app.post('/api/create-account', memoryUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { artistName, email, role, bio = '', musicType, password } = req.body;
    if (!artistName || !email || !role || !password || !musicType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const artistID = generateArtistID();
    const userDoc = await db.collection('users').doc(artistID).get();
    const emailQuery = await db.collection('users').where('email', '==', email).get();

    if (userDoc.exists || !emailQuery.empty) return res.status(500).json({ error: 'User exists or invalid' });

    const hashedPassword = await bcrypt.hash(password, 10);
    let profilePhotoBase64 = '/static/default-pfp.png';
    if (req.file) profilePhotoBase64 = bufferToBase64(req.file.buffer, req.file.mimetype);

    await db.collection('users').doc(artistID).set({
      artistID,
      artistName,
      email,
      password: hashedPassword,
      role,
      bio,
      musicType,
      profilePhotoPath: profilePhotoBase64,
      createdAt: new Date().toISOString(),
    });

    res.json({ message: 'Account created successfully', artistID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

// =========================
// All other APIs (unchanged)
// =========================

// =========================
// Server start
// =========================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
