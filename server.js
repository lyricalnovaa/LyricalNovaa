const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();

const dbFile = './LNPL.db';
const db = new sqlite3.Database(dbFile);

const upload = multer({
  dest: path.join(__dirname, 'uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed'));
    }
    cb(null, true);
  },
});

// Create tables
const createUserTable = `CREATE TABLE IF NOT EXISTS users (
  artistID TEXT PRIMARY KEY,
  artistName TEXT,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  musicType TEXT,
  profilePhotoPath TEXT,
  createdAt TEXT
)`;

const createPollTable = `CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventName TEXT NOT NULL,
  songName TEXT NOT NULL,
  songPath TEXT NOT NULL,
  votes INTEGER DEFAULT 0
)`;

db.serialize(() => {
  db.run(createUserTable);
  db.run(createPollTable);
});

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

function generateOTP() {
  return `OTP-${Math.floor(100000 + Math.random() * 900000)}`;
}

function generateArtistID() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

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

app.get('/api/profile', (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });
  db.get('SELECT artistName, profilePhotoPath, bio, musicType FROM users WHERE artistID = ?', [req.session.artistID], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

app.post('/api/login', (req, res) => {
  const { artistID, password } = req.body;
  if (!artistID) return res.status(400).json({ error: 'Missing artistID' });

  db.get('SELECT * FROM users WHERE artistID = ?', [artistID], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid artistID' });

    if (!password || password.trim() === '') {
      const newOTP = generateOTP();
      db.run('UPDATE users SET password = ? WHERE artistID = ?', [newOTP, artistID], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to generate OTP' });
        return res.json({ otp: newOTP.slice(4), message: 'OTP generated. Use this to login and reset your password.' });
      });
      return;
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
  });
});

app.post('/api/reset-password', async (req, res) => {
  const { artistID, newPassword } = req.body;
  if (!artistID || !newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Invalid input' });

  db.get('SELECT * FROM users WHERE artistID = ?', [artistID], async (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.password.startsWith('OTP-')) return res.status(400).json({ error: 'Password reset not allowed' });

    const hashed = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE artistID = ?', [hashed, artistID], (err) => {
      if (err) return res.status(500).json({ error: 'DB error on update' });
      res.json({ message: 'Password updated successfully' });
    });
  });
});

app.post('/api/create-account', upload.single('profilePhoto'), async (req, res) => {
  try {
    const { artistName, email, role, bio = '', musicType, password } = req.body;
    if (!artistName || !email || !role || !password || !musicType) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const artistID = generateArtistID();
    db.get('SELECT * FROM users WHERE artistID = ? OR email = ?', [artistID, email], async (err, existingUser) => {
      if (err || existingUser) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Validation or user exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const profilePhotoPath = req.file ? `/uploads/${req.file.filename}` : '/static/default-profile.png';
      db.run(
        `INSERT INTO users (artistID, artistName, email, password, role, bio, musicType, profilePhotoPath, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [artistID, artistName, email, hashedPassword, role, bio, musicType, profilePhotoPath],
        (err) => {
          if (err) return res.status(500).json({ error: 'Database insert error' });
          res.json({ message: 'Account created successfully', artistID });
        });
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Server error occurred' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/event', (req, res) => {
  if (!req.session.artistID) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'event.html'));
});

// Poll endpoints
app.get('/api/polls', (req, res) => {
  db.all('SELECT * FROM polls', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// ADMIN ONLY: Create polls/events
app.post('/api/polls', (req, res, next) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create polls/events' });
  }
  next();
}, multer({ dest: 'uploads/' }).array('songs'), (req, res) => {
  const { eventName } = req.body;
  const files = req.files;
  const names = req.body.names ? JSON.parse(req.body.names) : [];

  if (!eventName || !files || !names || files.length !== names.length) {
    return res.status(400).json({ error: 'Missing or mismatched poll data' });
  }

  const stmt = db.prepare('INSERT INTO polls (eventName, songName, songPath) VALUES (?, ?, ?)');
  files.forEach((file, i) => {
    stmt.run(eventName, names[i], `/uploads/${file.filename}`);
  });
  stmt.finalize();

  res.json({ message: 'Poll created' });
});

// ADMIN ONLY: Delete polls/events
app.delete('/api/polls/:id', (req, res, next) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete polls/events' });
  }
  next();
});

app.delete('/api/polls/:id', (req, res) => {
  const pollId = req.params.id;
  db.run('DELETE FROM polls WHERE id = ?', [pollId], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to delete poll/event' });
    if (this.changes === 0) return res.status(404).json({ error: 'Poll/event not found' });
    res.json({ message: 'Poll/event deleted successfully' });
  });
});

// USERS CAN VOTE, ADMINS CAN'T
app.post('/api/vote', (req, res, next) => {
  if (req.session.userRole === 'admin') {
    return res.status(403).json({ error: 'Admins cannot vote' });
  }
  next();
}, (req, res) => {
  const { pollId } = req.body;
  if (!pollId) return res.status(400).json({ error: 'Missing poll ID' });
  db.run('UPDATE polls SET votes = votes + 1 WHERE id = ?', [pollId], (err) => {
    if (err) return res.status(500).json({ error: 'Vote failed' });
    res.json({ message: 'Vote counted' });
  });
});

// NEW - Return current logged-in user info (artistID and role)
app.get('/api/current-user', (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ artistID: req.session.artistID, role: req.session.userRole });
});

// NEW - Post creation endpoint
app.post('/api/post', (req, res) => {
  if (!req.session.artistID) return res.status(401).json({ error: 'Unauthorized' });

  const { content } = req.body;
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: 'Post content cannot be empty' });
  }

  // For now just console log the post, later you can add DB logic
  console.log(`User ${req.session.artistID} posted: ${content}`);

  res.json({ message: 'Post created!' });
});

// Auth redirect middleware (leave this last)
app.use((req, res, next) => {
  if (!req.session.artistID && !req.path.startsWith('/login') && !req.path.startsWith('/api')) {
    return res.redirect('/login');
  }
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
