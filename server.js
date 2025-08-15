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
  storageBucket: firebaseConfig.project_id + ".appspot.com"
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

app.get('/profile/:username', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/api/profile/:username', async (req, res) => {
  const usernameRaw = req.params.username;
  const username = usernameRaw.replace(/^@/, '').trim();

  console.log('Fetching profile for:', username);

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('artistName', '==', username).limit(1).get();

    if (snapshot.empty) {
      console.log('No user found for:', username);
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    res.json({
      artistName: userData.artistName,
      profilePhotoPath: userData.profilePhotoPath,
      bio: userData.bio,
      musicType: userData.musicType,
      role: userData.role,
    });
  } catch (err) {
    console.error('Error fetching user by username:', err);
    res.status(500).json({ error: 'Server error' });
  }
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

app.post('/api/generate-otp', async (req, res) => {
  try {
    const { artistID } = req.body;
    if (!artistID) {
      return res.status(400).json({ error: 'Missing artistID' });
    }

    const otp = generateOTP();
    const plainOTP = otp.slice(4);
    const hashedOTP = await bcrypt.hash(plainOTP, 10);

    const userRef = db.collection('users').doc(artistID);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    await userRef.update({
      password: hashedOTP,
      otpActive: true,
    });

    res.json({ otp: plainOTP });
  } catch (err) {
    console.error('Error generating OTP:', err);
    res.status(500).json({ error: 'Failed to generate OTP' });
  }
});

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

// API: Update profile with Firebase only, no SQLite
app.put('/api/profile', async (req, res) => {
  const { profilePhotoPath, bio, musicType } = req.body;
  const artistID = req.session.artistID;

  if (!artistID) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userRef = db.collection('users').doc(artistID);
    await userRef.set(
      { profilePhotoPath, bio, musicType },
      { merge: true }
    );
    res.json({ success: true });
  } catch (firestoreErr) {
    console.error('Firestore update error:', firestoreErr);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// API: Login
app.post('/api/login', async (req, res) => {
  const { artistID, password } = req.body;
  if (!artistID) return res.status(400).json({ error: 'Missing artistID' });
  if (!password) return res.status(400).json({ error: 'Missing password' });

  try {
    const doc = await db.collection('users').doc(artistID).get();
    if (!doc.exists) return res.status(401).json({ error: 'Invalid artistID' });

    const user = doc.data();

    if (user.otpActive) {
      const isValidOTP = await bcrypt.compare(password, user.password);
      if (isValidOTP) {
        return res.status(403).json({ error: 'reset_password', artistID });
      } else {
        return res.status(401).json({ error: 'Wrong OTP' });
      }
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

// API: Reset password
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
    const profilePhotoPath = req.file ? `/uploads/${req.file.filename}` : '/static/default-pfp.png';

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
app.post('/api/polls', (req, res, next) => {
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
app.post('/api/vote', (req, res, next) => {
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

// POST creation route with media upload to Firebase Storage
app.post('/api/post', postUpload.single('media'), async (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });

  const content = req.body.content || '';
  let mediaURL = null;
  let mediaType = null;

  console.log('Received post request. File:', req.file);
  try {
    if (req.file && req.file.buffer) {
      const timestamp = Date.now();
      const fileName = `posts/${timestamp}-${req.file.originalname}`;
      const fileUpload = bucket.file(fileName);

      await fileUpload.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
      });

      await fileUpload.makePublic();
      mediaURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';

      console.log('File uploaded successfully:', mediaURL);
    }

    const postDoc = await db.collection('posts').add({
      artistID: req.session.artistID,
      content,
      mediaPath: mediaURL,
      mediaType,
      createdAt: new Date().toISOString(),
    });

    console.log('Post created with ID:', postDoc.id, 'mediaURL:', mediaURL);

    res.json({
      message: 'Post created',
      postId: postDoc.id,
      mediaPath: mediaURL,
      mediaType,
      content
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});



// Fetch posts with user info and like/comment counts
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

      post.mediaPath = post.mediaPath || null;

      return post;
    }));

    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Like/unlike toggle
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

// Comment on post
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

// Server listening
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));