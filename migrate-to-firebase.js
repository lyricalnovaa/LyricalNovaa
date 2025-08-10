const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const firebaseConfig = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf8'));
admin.initializeApp({
  credential: admin.credential.cert(firebaseConfig),
});
const db = admin.firestore();

// Example: Load your local DB file (adjust path)
const localDB = JSON.parse(fs.readFileSync(path.join(__dirname, 'localdb.json'), 'utf8'));

async function migrate() {
  try {
    // Example for users collection
    const users = localDB.users; // Adjust based on your local DB structure
    for (const user of users) {
      await db.collection('users').doc(user.artistID).set(user);
      console.log(`Migrated user: ${user.artistID}`);
    }

    // Example for posts collection
    const posts = localDB.posts;
    for (const post of posts) {
      await db.collection('posts').doc(post.id).set(post);
      console.log(`Migrated post: ${post.id}`);
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
