const sqlite3 = require('sqlite3').verbose();
const admin = require('firebase-admin');
const path = require('path');

// Firebase init
const firebaseConfig = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf8'));
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
});
const dbFirebase = admin.firestore();

// Path to your LNPL.db
const sqliteDBPath = path.join(__dirname, 'LNPL.db');
const sqliteDB = new sqlite3.Database(sqliteDBPath, sqlite3.OPEN_READONLY);

function migrateUsers() {
  return new Promise((resolve, reject) => {
    sqliteDB.all("SELECT * FROM users", async (err, rows) => {
      if (err) return reject(err);

      try {
        for (const user of rows) {
          await dbFirebase.collection('users').doc(user.artistID.toString()).set(user);
          console.log(`Migrated user: ${user.artistID}`);
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

function migratePosts() {
  return new Promise((resolve, reject) => {
    sqliteDB.all("SELECT * FROM posts", async (err, rows) => {
      if (err) return reject(err);

      try {
        for (const post of rows) {
          await dbFirebase.collection('posts').doc(post.id.toString()).set(post);
          console.log(`Migrated post: ${post.id}`);
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function migrate() {
  try {
    await migrateUsers();
    await migratePosts();
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    sqliteDB.close();
    process.exit(0);
  }
}

migrate();
