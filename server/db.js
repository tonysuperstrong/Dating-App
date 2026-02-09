const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'dating.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.serialize(() => {
  // Users Table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    name TEXT,
    age INTEGER,
    bio TEXT,
    image TEXT,
    type TEXT,
    location TEXT,
    hobbies TEXT,
    language TEXT,
    ethnicity TEXT,
    gender TEXT
  )`, (err) => {
    if (!err) {
      // Add missing columns if table already existed without them
      const columnsToAdd = ['language', 'ethnicity', 'gender', 'personality_type', 'detailed_bio', 'partner_preferences', 'phone_number'];
      columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT`, (err) => {
          // Ignore error if column already exists
        });
      });
    }
  });

  // Matches/Chats Table
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    user1_id TEXT,
    user2_id TEXT,
    status TEXT,
    timestamp INTEGER
  )`);

  // Messages Table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    match_id TEXT,
    sender_id TEXT,
    text TEXT,
    timestamp INTEGER,
    FOREIGN KEY(match_id) REFERENCES matches(id)
  )`);

  // Posts Table (Instagram-style)
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    images TEXT, -- JSON string or comma-separated URLs
    description TEXT,
    song TEXT,
    song_preview TEXT,
    timestamp INTEGER,
    likes INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, (err) => {
    if (!err) {
      db.run(`ALTER TABLE posts ADD COLUMN song_preview TEXT`, (err) => {
        // Ignore error if column already exists
      });
    }
  });

  // Comments Table
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT,
    user_id TEXT,
    text TEXT,
    timestamp INTEGER,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Post Likes Table (to ensure unique likes)
  db.run(`CREATE TABLE IF NOT EXISTS post_likes (
    id TEXT PRIMARY KEY,
    post_id TEXT,
    user_id TEXT,
    timestamp INTEGER,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Seed Mock Users if empty
  db.get("SELECT count(*) as count FROM users", (err, row) => {
    if (row.count === 0) {
      console.log("Seeding mock users...");
      const stmt = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      
      const mockUsers = [
        ['1', 'jessica', 'pass', 'Jessica', 24, 'Loves hiking and coffee ☕️', '#FF6B6B', 'date', 'New York, USA', 'Hiking,Coffee,Photography'],
        ['2', 'david', 'pass', 'David', 28, 'Looking for a tennis partner 🎾', '#4ECDC4', 'sport', 'London, UK', 'Tennis,Gym,Cooking'],
        ['3', 'sarah', 'pass', 'Sarah', 22, 'Travel enthusiast ✈️', '#FFE66D', 'date', 'Paris, France', 'Travel,Art,Music'],
        ['4', 'michael', 'pass', 'Michael', 30, 'Tech enthusiast 💻', '#1A535C', 'sport', 'New York, USA', 'Tech,Gaming,Reading'],
        ['5', 'emma', 'pass', 'Emma', 26, 'Marathon runner 🏃‍♀️', '#FF9F1C', 'sport', 'London, UK', 'Running,Health,Travel']
      ];

      mockUsers.forEach(user => {
        stmt.run(user);
      });
      stmt.finalize();
    }
  });
});

module.exports = db;
