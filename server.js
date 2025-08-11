const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const admin = require('firebase-admin');
const app = express();

// Initialize Firebase Admin from base64 env var
const firebaseConfig = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf8'));
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
  storageBucket: firebaseConfig.project_id + ".appspot.com" // <-- Make sure your bucket is correct
});
const db = admin.firestore();
const bucket = admin.storage().bucket(); // Get default bucket

// Multer configs
const profilePhotoUpload = multer({
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    cb(null, true);
  },
});

const postUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image/video files allowed'));
  },
});

function generateOTP() {
  return `OTP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateArtistID() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
}));

app.use('/static', express.static(path.join(__dirname, 'public/static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/logo.png', express.static(path.join(__dirname, 'public/static/logo.png')));

// ROUTES

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

// API: Get logged-in user's profile data
app.get('/api/profile', async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const doc = await db.collection('users').doc(req.session.artistID).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const user = doc.data();
    res.json({
      artistName: user.artistName,
      profilePhotoPath: user.profilePhotoPath,
      bio: user.bio,
      musicType: user.musicType,
      role: user.role,
    });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Login
app.post('/api/login', async (req, res) => {
  const { artistID, password } = req.body;
  if (!artistID) return res.status(400).json({ error: 'Missing artistID' });

  try {
    const doc = await db.collection('users').doc(artistID).get();
    if (!doc.exists) return res.status(401).json({ error: 'Invalid artistID' });

    const user = doc.data();
    if (!password || password.trim() === '') {
      const newOTP = generateOTP();
      await db.collection('users').doc(artistID).update({ password: newOTP });
      return res.json({ otp: newOTP.slice(4), message: 'OTP generated. Use this to login and reset your password.' });
    }

    if (user.password.startsWith('OTP-')) {
      if (password === user.password.slice(4)) return res.status(403).json({ error: 'reset_password', artistID });
      return res.status(401).json({ error: 'Wrong OTP' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Wrong password' });

    req.session.artistID = artistID;
    req.session.userRole = user.role;
    res.json({ role: user.role });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Reset password
app.post('/api/reset-password', async (req, res) => {
  const { artistID, newPassword } = req.body;
  if (!artistID || !newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Invalid input' });

  try {
    const doc = await db.collection('users').doc(artistID).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const user = doc.data();
    if (!user.password.startsWith('OTP-')) return res.status(400).json({ error: 'Password reset not allowed' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection('users').doc(artistID).update({ password: hashed });
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'DB error on update' });
  }
});

// API: Create account with profile photo upload
app.post('/api/create-account', profilePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const { artistName, email, role, bio = '', musicType, password } = req.body;
    if (!artistName || !email || !role || !password || !musicType) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const artistID = generateArtistID();
    const userDoc = await db.collection('users').doc(artistID).get();
    const emailQuery = await db.collection('users').where('email', '==', email).get();

    if (userDoc.exists || !emailQuery.empty) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'User exists or invalid' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profilePhotoPath = req.file ? `/uploads/${req.file.filename}` : '/static/default-profile.png';

    await db.collection('users').doc(artistID).set({
      artistID,
      artistName,
      email,
      password: hashedPassword,
      role,
      bio,
      musicType,
      profilePhotoPath,
      createdAt: new Date().toISOString(),
    });

    res.json({ message: 'Account created successfully', artistID });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

// API: Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/event', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'event.html'));
});

// Poll endpoints
app.get('/api/polls', async (req, res) => {
  try {
    const snapshot = await db.collection('polls').get();
    const polls = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(polls);
  } catch {
    res.status(500).json({ error: 'DB error' });
  }
});

// ADMIN ONLY: Create polls/events
app.post('/api/polls', async (req, res, next) => {
  if (req.session.userRole !== 'admin') return res.status(403).json({ error: 'Only admins can create polls/events' });
  next();
}, multer({ dest: 'uploads/' }).array('songs'), async (req, res) => {
  try {
    const { eventName } = req.body;
    const files = req.files;
    const names = req.body.names ? JSON.parse(req.body.names) : [];

    if (!eventName || !files || !names || files.length !== names.length) {
      return res.status(400).json({ error: 'Missing or mismatched poll data' });
    }

    const batch = db.batch();
    files.forEach((file, i) => {
      const pollRef = db.collection('polls').doc();
      batch.set(pollRef, {
        eventName,
        songName: names[i],
        songPath: `/uploads/${file.filename}`,
        votes: 0,
      });
    });
    await batch.commit();

    res.json({ message: 'Poll created' });
  } catch {
    res.status(500).json({ error: 'DB error on poll creation' });
  }
});

// ADMIN ONLY: Delete polls/events
app.delete('/api/polls/:id', async (req, res) => {
  if (req.session.userRole !== 'admin') return res.status(403).json({ error: 'Only admins can delete polls/events' });
  const pollId = req.params.id;
  try {
    const pollRef = db.collection('polls').doc(pollId);
    await pollRef.delete();
    res.json({ message: 'Poll/event deleted successfully' });
  } catch {
    res.status(500).json({ error: 'Failed to delete poll/event' });
  }
});

// USERS CAN VOTE, ADMINS CAN'T
app.post('/api/vote', async (req, res, next) => {
  if (req.session.userRole === 'admin') return res.status(403).json({ error: 'Admins cannot vote' });
  next();
}, async (req, res) => {
  const { pollId } = req.body;
  if (!pollId) return res.status(400).json({ error: 'Missing poll ID' });
  try {
    const pollRef = db.collection('polls').doc(pollId);
    await db.runTransaction(async (t) => {
      const doc = await t.get(pollRef);
      if (!doc.exists) throw 'Poll not found';
      const newVotes = (doc.data().votes || 0) + 1;
      t.update(pollRef, { votes: newVotes });
    });
    res.json({ message: 'Vote counted' });
  } catch {
    res.status(500).json({ error: 'Vote failed' });
  }
});

// ==== MODIFIED POST CREATION ROUTE TO UPLOAD MEDIA TO FIREBASE STORAGE ====
app.post('/api/post', postUpload.single('media'), async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });

  const content = req.body.content || '';
  let mediaURL = null;
  let mediaType = null;

  try {
    if (req.file) {
      const fileName = `posts/${Date.now()}-${req.file.originalname}`;
      const file = req.file;

      // Upload buffer to Firebase Storage
      const fileUpload = bucket.file(fileName);
      await fileUpload.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        public: true,
      });

      // Make the file public
      await fileUpload.makePublic();

      mediaURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
    }

    const postDoc = await db.collection('posts').add({
      artistID: req.session.artistID,
      content,
      mediaPath: mediaURL,
      mediaType,
      createdAt: new Date().toISOString(),
    });

    res.json({ message: 'Post created', postId: postDoc.id });
  } catch (error) {
    console.error('Error uploading post media:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ==== MODIFIED POSTS FETCH ROUTE TO PROVIDE MEDIA PATH DIRECTLY ====
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

      // Count likes
      const likesSnap = await db.collection('likes').where('postID', '==', post.id).get();
      post.likeCount = likesSnap.size;

      // Count comments
      const commentsSnap = await db.collection('comments').where('postID', '==', post.id).get();
      post.commentCount = commentsSnap.size;

      // MEDIA: use mediaPath directly (URL to Firebase Storage file)
      post.mediaPath = post.mediaPath || null;

      return post;
    }));

    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Serve media for a post by ID (optional, since media URLs are public now)
// You can remove this route if you want, frontend loads media directly from Firebase URLs
app.get('/api/post-media/:postId', async (req, res) => {
  const postId = req.params.postId;
  try {
    const doc = await db.collection('posts').doc(postId).get();
    if (!doc.exists || !doc.data().mediaPath) return res.status(404).send('Media not found');
    // Redirect to the public Firebase Storage URL
    res.redirect(doc.data().mediaPath);
  } catch {
    res.status(404).send('Media not found');
  }
});

// Like/unlike toggle endpoint
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
      // Unlike
      await db.collection('likes').doc(likeQuery.docs[0].id).delete();
      return res.json({ message: 'Unliked' });
    } else {
      // Like
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

// Comment on post endpoint
app.post('/api/comment', async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });
  const { postID, comment } = req.body;
  if (!postID || !comment) return res.status(400).json({ error: 'Missing postID or comment' });

  try {
    const commentRef = await db.collection('comments').add({
      postID,
      artistID: req.session.artistID,
      comment,
      createdAt: new Date().toISOString(),
    });
    res.json({ message: 'Comment added', commentId: commentRef.id });
  } catch {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a post
app.get('/api/comments/:postID', async (req, res) => {
  const postID = req.params.postID;
  try {
    const snapshot = await db.collection('comments')
      .where('postID', '==', postID)
      .orderBy('createdAt', 'asc')
      .get();

    const comments = await Promise.all(snapshot.docs.map(async doc => {
      const comment = doc.data();
      comment.id = doc.id;

      const userDoc = await db.collection('users').doc(comment.artistID).get();
      if (userDoc.exists) {
        comment.artistName = userDoc.data().artistName;
        comment.profilePhotoPath = userDoc.data().profilePhotoPath;
      }

      return comment;
    }));

    res.json(comments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// API: Get logged-in user info
app.get('/api/user', async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const doc = await db.collection('users').doc(req.session.artistID).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const user = doc.data();
    res.json({
      artistID: user.artistID,
      artistName: user.artistName,
      email: user.email,
      role: user.role,
    });
  } catch {
    res.status(500).json({ error: 'DB error' });
  }
});

// ==========================
// ADD THIS AT THE BOTTOM BELOW ALL YOUR EXISTING CODE
// ==========================

const sqlite3 = require('sqlite3').verbose();
const sqliteDBPath = path.join(__dirname, 'LNPL.db');
const sqliteDB = new sqlite3.Database(sqliteDBPath);

// Helper: Compare two objects shallowly via JSON stringify (basic, but works)
function hasChanged(oldData, newData) {
  return JSON.stringify(oldData) !== JSON.stringify(newData);
}

// Sync users from SQLite to Firebase
async function syncUsers() {
  return new Promise((resolve, reject) => {
    sqliteDB.all("SELECT * FROM users", async (err, rows) => {
      if (err) return reject(err);
      try {
        for (const user of rows) {
          const docRef = db.collection('users').doc(user.artistID.toString());
          const docSnap = await docRef.get();
          if (!docSnap.exists || hasChanged(docSnap.data(), user)) {
            await docRef.set(user);
            console.log(`Synced user ${user.artistID}`);
          }
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Sync posts from SQLite to Firebase
async function syncPosts() {
  return new Promise((resolve, reject) => {
    sqliteDB.all("SELECT * FROM posts", async (err, rows) => {
      if (err) return reject(err);
      try {
        for (const post of rows) {
          const docRef = db.collection('posts').doc(post.id.toString());
          const docSnap = await docRef.get();
          if (!docSnap.exists || hasChanged(docSnap.data(), post)) {
            await docRef.set(post);
            console.log(`Synced post ${post.id}`);
          }
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Main periodic sync function
async function periodicSync() {
  try {
    await syncUsers();
    await syncPosts();
    console.log('Periodic sync completed at', new Date().toISOString());
  } catch (error) {
    console.error('Periodic sync error:', error);
  }
}
app.put('/api/profile', async (req, res) => {
  const { profilePicPath, bio, musicType } = req.body;
  const userId = req.session?.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 1. Update SQLite
    db.run(
      `UPDATE users SET profilePhotoPath = ?, bio = ?, musicType = ? WHERE id = ?`,
      [profilePicPath, bio, musicType, userId],
      async function (err) {
        if (err) {
          console.error('SQLite update error:', err);
          return res.status(500).json({ error: 'Failed to update SQL' });
        }

        try {
          // 2. Update Firestore
          const userRef = admin.firestore().collection('users').doc(String(userId));
          await userRef.set(
            { profilePhotoPath: profilePicPath, bio, musicType },
            { merge: true }
          );

          res.json({ success: true });
        } catch (firestoreErr) {
          console.error('Firestore update error:', firestoreErr);
          res.json({
            success: true,
            firestoreError: 'Firestore update failed',
          });
        }
      }
    );
  } catch (e) {
    console.error('Profile update route error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});
// Run first sync on server start
periodicSync();

// Set interval every 5 minutes (300,000 ms)
setInterval(periodicSync, 300000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
