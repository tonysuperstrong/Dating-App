require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db_config'); // Use Knex instance

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Helper to generate ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// OTP Store (In-Memory)
const otpStore = new Map();

// POST /auth/send-otp
app.post('/auth/send-otp', (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store with timestamp (expires in 5 mins)
    otpStore.set(phoneNumber, {
        code,
        expires: Date.now() + 5 * 60 * 1000
    });

    console.log(`[OTP] Generated code ${code} for ${phoneNumber}`);

    // In a real app, send via SMS gateway. Here, return it for testing.
    res.json({ success: true, message: 'OTP sent', code }); 
});

// POST /auth/verify-otp
app.post('/auth/verify-otp', (req, res) => {
    const { phoneNumber, code } = req.body;
    
    if (!otpStore.has(phoneNumber)) {
        return res.status(400).json({ error: 'No OTP found for this number' });
    }

    const data = otpStore.get(phoneNumber);
    
    if (Date.now() > data.expires) {
        otpStore.delete(phoneNumber);
        return res.status(400).json({ error: 'OTP expired' });
    }

    if (data.code !== code) {
        return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Success! Clear the OTP
    otpStore.delete(phoneNumber);
    res.json({ success: true, verified: true });
});

// GET /users (Explore)
app.get('/users', async (req, res) => {
  const currentUserId = req.query.currentUserId;
  
  try {
      const rows = await db('users').whereNot('id', currentUserId || '');
      
      const users = rows.map(u => ({
          ...u,
          hobbies: u.hobbies ? u.hobbies.split(',') : []
      }));
      res.json(users);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// GET /users/search
app.get('/users/search', async (req, res) => {
  const query = req.query.q;
  const currentUserId = req.query.currentUserId;

  if (!query) {
      res.json([]);
      return;
  }
  
  try {
      const rows = await db('users')
          .where(builder => {
              builder.where('username', 'like', `%${query}%`)
                     .orWhere('name', 'like', `%${query}%`);
          })
          .whereNot('id', currentUserId || '');
          
      const users = rows.map(u => ({
          ...u,
          hobbies: u.hobbies ? u.hobbies.split(',') : []
      }));
      res.json(users);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// GET /users/:id (Get Single User)
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[GET /users/:id] Requested ID: ${id}`);
  
  try {
      const row = await db('users').where('id', id).first();
      
      if (row) {
          row.hobbies = row.hobbies ? row.hobbies.split(',') : [];
          console.log(`[GET /users/:id] User found: ${row.username}`);
          res.json(row);
      } else {
          console.warn(`[GET /users/:id] User not found for ID: ${id}`);
          res.status(404).json({ error: "User not found" });
      }
  } catch (err) {
      console.error(`[GET /users/:id] Database error: ${err.message}`);
      res.status(500).json({ error: err.message });
  }
});

// PUT /users/:id (Update Profile)
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    username, password, name, age, bio, image, type, location, hobbies, 
    language, ethnicity, gender, personality_type, detailed_bio, partner_preferences, phone_number 
  } = req.body;
  
  const hobbiesStr = Array.isArray(hobbies) ? hobbies.join(',') : hobbies;

  try {
      await db('users').where('id', id).update({
          username, password, name, age, bio, image, type, 
          location, hobbies: hobbiesStr, language, ethnicity, gender,
          personality_type, detailed_bio, partner_preferences, phone_number
      });
      res.json({ id, ...req.body });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /signup
app.post('/signup', async (req, res) => {
  const { username, password, name, age, bio, image, type, location, hobbies, language, ethnicity, gender, phone_number } = req.body;
  const id = generateId();
  const hobbiesStr = Array.isArray(hobbies) ? hobbies.join(',') : hobbies;

  try {
      await db('users').insert({
          id, username, password, name, age, bio, image, type, 
          location, hobbies: hobbiesStr, language, ethnicity, gender, phone_number
      });
      res.json({ id, username, password, name, age, bio, image, type, location, hobbies: hobbiesStr ? hobbiesStr.split(',') : [], language, ethnicity, gender, phone_number });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
      const row = await db('users').where({ username, password }).first();
      if (row) {
          row.hobbies = row.hobbies ? row.hobbies.split(',') : [];
          res.json(row);
      } else {
          res.status(401).json({ error: "Invalid credentials" });
      }
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// GET /matches
app.get('/matches', async (req, res) => {
  const userId = req.query.userId;
  
  try {
      const rows = await db('matches as m')
          .join('users as u', function() {
              this.on('m.user1_id', '=', 'u.id').orOn('m.user2_id', '=', 'u.id')
          })
          .where(function() {
              this.where('m.user1_id', userId).orWhere('m.user2_id', userId)
          })
          .whereNot('u.id', userId)
          .select(
              'm.id as match_id', 
              'm.status', 
              'm.user1_id', 
              'm.user2_id', 
              'u.*',
              // Subqueries are tricky in Knex, using raw for the subquery part or separate queries is often easier.
              // For simplicity and compatibility, let's try a raw selection for the message parts if possible, 
              // or just fetch messages separately. 
              // Let's stick to the raw subquery for now as it's efficient.
              db.raw('(SELECT text FROM messages WHERE match_id = m.id ORDER BY timestamp DESC LIMIT 1) as last_message_text'),
              db.raw('(SELECT timestamp FROM messages WHERE match_id = m.id ORDER BY timestamp DESC LIMIT 1) as last_message_time')
          );

      const matches = rows.map(u => ({
          id: u.match_id,
          user1_id: u.user1_id,
          user2_id: u.user2_id,
          user: {
              id: u.id,
              username: u.username,
              name: u.name,
              age: u.age,
              bio: u.bio,
              image: u.image,
              location: u.location,
              hobbies: u.hobbies ? u.hobbies.split(',') : []
          },
          lastMessage: u.last_message_text || "Start chatting!",
          timestamp: u.last_message_time || u.timestamp || Date.now(),
          status: u.status
      }));
      res.json(matches);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /matches (Like/Match)
app.post('/matches', async (req, res) => {
    const { fromUserId, toUserId } = req.body;
    console.log(`[POST /matches] Like request from ${fromUserId} to ${toUserId}`);

    try {
        const row = await db('matches')
            .where(function() {
                this.where({ user1_id: fromUserId, user2_id: toUserId })
                    .orWhere({ user1_id: toUserId, user2_id: fromUserId })
            })
            .first();

        if (row) {
            console.log(`[POST /matches] Found existing match:`, row);
            if (row.status === 'pending' && row.user1_id === toUserId) {
                // They liked me first! It's a match!
                console.log(`[POST /matches] Reciprocal match! Updating to active.`);
                await db('matches').where('id', row.id).update({ status: 'active' });
                res.json({ id: row.id, status: 'active', match: true });
            } else {
                console.log(`[POST /matches] Returning existing match state.`);
                res.json(row);
            }
        } else {
            console.log(`[POST /matches] Creating new pending match.`);
            const id = generateId();
            const timestamp = Date.now();
            await db('matches').insert({
                id, user1_id: fromUserId, user2_id: toUserId, status: 'pending', timestamp
            });
            res.json({ id, status: 'pending', match: false });
        }
    } catch (err) {
         console.error(`[POST /matches] DB Error: ${err.message}`);
         res.status(500).json({ error: err.message });
    }
});

// POST /matches/:id/accept
app.post('/matches/:id/accept', async (req, res) => {
    const { id } = req.params;
    try {
        await db('matches').where('id', id).update({ status: 'active' });
        res.json({ success: true, status: 'active' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /matches/:id/decline
app.post('/matches/:id/decline', async (req, res) => {
    const { id } = req.params;
    try {
        await db('matches').where('id', id).delete();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /messages
app.get('/messages/:matchId', async (req, res) => {
    const { matchId } = req.params;
    try {
        const rows = await db('messages').where('match_id', matchId).orderBy('timestamp', 'asc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /messages
app.post('/messages', async (req, res) => {
    const { matchId, senderId, text } = req.body;
    const id = generateId();
    const timestamp = Date.now();
    try {
        await db('messages').insert({ id, match_id: matchId, sender_id: senderId, text, timestamp });
        res.json({ id, text, timestamp, senderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /posts (Feed)
app.get('/posts', async (req, res) => {
  const currentUserId = req.query.currentUserId;
  const userId = req.query.userId; // Filter by specific user

  try {
      const query = db('posts as p')
          .join('users as u', 'p.user_id', 'u.id')
          .leftJoin('post_likes as pl', function() {
              this.on('p.id', '=', 'pl.post_id').andOn('pl.user_id', '=', db.raw('?', [currentUserId || '']))
          })
          .select(
              'p.*',
              'u.username',
              'u.name',
              'u.image as user_image',
              db.raw('CASE WHEN pl.id IS NOT NULL THEN 1 ELSE 0 END as isLiked')
          )
          .orderBy('p.timestamp', 'desc');

      if (userId) {
          query.where('p.user_id', userId);
      }

      const rows = await query;
      const posts = rows.map(p => ({
          ...p,
          images: p.images ? p.images.split(',') : [],
          isLiked: !!p.isLiked
      }));
      res.json(posts);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /posts (Create Post)
app.post('/posts', async (req, res) => {
  const { user_id, images, description, song, song_preview } = req.body;
  const id = generateId();
  const timestamp = Date.now();
  const imagesStr = Array.isArray(images) ? images.join(',') : images;

  try {
      await db('posts').insert({
          id, user_id, images: imagesStr, description, song, song_preview, timestamp, likes: 0
      });
      res.json({ id, user_id, images: imagesStr, description, song, song_preview, timestamp, likes: 0 });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /posts/:id/like
app.post('/posts/:id/like', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
     res.status(400).json({ error: 'user_id required' });
     return;
  }

  try {
      const row = await db('post_likes').where({ post_id: id, user_id }).first();

      if (row) {
          // Unlike
          await db('post_likes').where({ post_id: id, user_id }).delete();
          await db('posts').where('id', id).decrement('likes', 1);
          res.json({ success: true, liked: false });
      } else {
          // Like
          const likeId = generateId();
          const timestamp = Date.now();
          await db('post_likes').insert({ id: likeId, post_id: id, user_id, timestamp });
          await db('posts').where('id', id).increment('likes', 1);
          res.json({ success: true, liked: true });
      }
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// GET /posts/:id/comments
app.get('/posts/:id/comments', async (req, res) => {
  const { id } = req.params;
  try {
      const rows = await db('comments as c')
          .join('users as u', 'c.user_id', 'u.id')
          .where('c.post_id', id)
          .orderBy('c.timestamp', 'asc')
          .select('c.*', 'u.username', 'u.name', 'u.image as user_image');
      res.json(rows);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /posts/:id/comments
app.post('/posts/:id/comments', async (req, res) => {
  const { id } = req.params; // post_id
  const { user_id, text } = req.body;
  const commentId = generateId();
  const timestamp = Date.now();
  
  try {
      await db('comments').insert({ id: commentId, post_id: id, user_id, text, timestamp });
      res.json({ id: commentId, post_id: id, user_id, text, timestamp });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`To connect from emulator/device, use your machine's IP address instead of localhost`);
});
