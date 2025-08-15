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
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
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
  res.redirect('/login');
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/create-account', (req, res) => res.sendFile(path.join(__dirname, 'public', 'create-account.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.get('/admin-dashboard', (req, res) => {
  if (!req.session.artistID || req.session.userRole !== 'admin') return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});
app.get('/home', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
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
// API: Profile
// =========================
app.get('/api/profile', async (req, res) => {
  const artistID = req.session.artistID;
  if (!artistID) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const userDoc = await db.collection('users').doc(artistID).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'User not found' });

    const userData = userDoc.data();
    res.json({
      artistID: userData.artistID,
      artistName: userData.artistName,
      profilePhotoPath: userData.profilePhotoPath,
      bio: userData.bio,
      musicType: userData.musicType,
      email: userData.email,
      role: userData.role,
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/profile', async (req, res) => {
  const { profilePhotoPath, bio, musicType } = req.body;
  const artistID = req.session.artistID;
  if (!artistID) return res.status(401).json({ error: 'Not authenticated' });

  try {
    await db.collection('users').doc(artistID).set({ profilePhotoPath, bio, musicType }, { merge: true });
    res.json({ success: true });
  } catch (firestoreErr) {
    console.error('Firestore update error:', firestoreErr);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// =========================
// API: Create Post
// =========================
app.post('/api/post', memoryUpload.single('media'), async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });

  const content = req.body.content || '';
  let mediaBase64 = null;
  let mediaType = null;

  try {
    if (req.file) {
      mediaBase64 = bufferToBase64(req.file.buffer, req.file.mimetype);
      mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
    }

    const postDoc = await db.collection('posts').add({
      artistID: req.session.artistID,
      content,
      mediaPath: mediaBase64,
      mediaType,
      createdAt: new Date().toISOString(),
    });

    res.json({
      message: 'Post created',
      postId: postDoc.id,
      mediaPath: mediaBase64,
      mediaType,
      content,
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// =========================
// API: Fetch Posts
// =========================
app.get('/api/posts', async (req, res) => {
  try {
    const snapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const posts = await Promise.all(snapshot.docs.map(async doc => {
      const post = doc.data();
      post.id = doc.id;

      const userDoc = await db.collection('users').doc(post.artistID).get();
      if (userDoc.exists) {
        post.artistName = userDoc.data().artistName;
        post.profilePhotoPath = userDoc.data().profilePhotoPath;
      }

      const likesSnap = await db.collection('likes').where('postID', '==', post.id).get();
      post.likeCount = likesSnap.size;

      const commentsSnap = await db.collection('comments').where('postID', '==', post.id).get();
      post.commentCount = commentsSnap.size;

      return post;
    }));

    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// =========================
// API: Like/Unlike
// =========================
app.post('/api/like', async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });
  const { postID } = req.body;
  if (!postID) return res.status(400).json({ error: 'Missing postID' });

  try {
    const likeQuery = await db.collection('likes')
      .where('postID', '==', postID)
      .where('artistID', '==', req.session.artistID)
      .limit(1)
      .get();

    if (!likeQuery.empty) {
      await db.collection('likes').doc(likeQuery.docs[0].id).delete();
      return res.json({ message: 'Unliked' });
    } else {
      await db.collection('likes').add({
        postID,
        artistID: req.session.artistID,
        createdAt: new Date().toISOString(),
      });
      return res.json({ message: 'Liked' });
    }
  } catch {
    res.status(500).json({ error: 'DB error' });
  }
});

// =========================
// Server start
// =========================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));