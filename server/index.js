const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db_config'); // Use Knex instance

const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('OK');
});

// Socket.io Logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
  });

  socket.on('leave_room', (room) => {
      socket.leave(room);
      console.log(`User ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

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
    // const code = Math.floor(100000 + Math.random() * 900000).toString();
    const code = '123456'; // Fixed for development convenience
    
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
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  
  try {
      let query = db('users');

      if (currentUserId) {
          // 1. Exclude self
          query = query.whereNot('id', currentUserId);

          // 2. Exclude users already matched/liked
          // Find all match records involving currentUserId
          const existingMatches = await db('matches')
              .where('user1_id', currentUserId)
              .orWhere('user2_id', currentUserId)
              .select('user1_id', 'user2_id');
          
          const excludedIds = new Set();
          existingMatches.forEach(m => {
              if (m.user1_id !== currentUserId) excludedIds.add(m.user1_id);
              if (m.user2_id !== currentUserId) excludedIds.add(m.user2_id);
          });

          if (excludedIds.size > 0) {
              query = query.whereNotIn('id', Array.from(excludedIds));
          }
      }

      // Pagination
      query.limit(limit).offset(offset);

      const rows = await query;
      
      const users = rows.map(u => {
          let teams = [];
          try {
              teams = u.favorite_teams ? JSON.parse(u.favorite_teams) : [];
          } catch (e) {}
          return {
              ...u,
              hobbies: u.hobbies ? u.hobbies.split(',') : [],
              favorite_teams: teams
          };
      });
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
  console.log(`[GET /users/:id] Fetching user ${id}`);
  
  try {
      const row = await db('users').where('id', id).first();
      
      if (row) {
          console.log(`[GET /users/:id] User found: ${row.username}, hobbies: ${row.hobbies}`);
          row.hobbies = row.hobbies ? row.hobbies.split(',') : [];
          try {
              row.favorite_teams = row.favorite_teams ? JSON.parse(row.favorite_teams) : [];
          } catch (e) {
              console.error(`[GET /users/:id] Failed to parse favorite_teams for user ${id}:`, e);
              row.favorite_teams = [];
          }
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
    language, ethnicity, gender, personality_type, detailed_bio, partner_preferences, phone_number,
    favorite_teams
  } = req.body;
  
  const hobbiesStr = Array.isArray(hobbies) ? hobbies.join(',') : hobbies;
  const favoriteTeamsStr = Array.isArray(favorite_teams) ? JSON.stringify(favorite_teams) : favorite_teams;

  try {
      await db('users').where('id', id).update({
          username, password, name, age, bio, image, type, 
          location, hobbies: hobbiesStr, language, ethnicity, gender,
          personality_type, detailed_bio, partner_preferences, phone_number,
          favorite_teams: favoriteTeamsStr
      });
      res.json({ id, ...req.body });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// POST /signup
app.post('/signup', async (req, res) => {
  console.log('[POST /signup] Received signup request:', req.body.username);
  const { username, password, name, age, bio, image, type, location, hobbies, language, ethnicity, gender, phone_number } = req.body;
  
  try {
      // Check if username already exists
      const existingUser = await db('users').where({ username }).first();
      if (existingUser) {
          console.warn('[POST /signup] Username already exists:', username);
          return res.status(400).json({ error: 'Username already exists' });
      }

      const id = generateId();
      const hobbiesStr = Array.isArray(hobbies) ? hobbies.join(',') : hobbies;
      const hashedPassword = await bcrypt.hash(password, 10);

      const { personality_type, detailed_bio, partner_preferences, favorite_teams } = req.body;
      const favoriteTeamsStr = Array.isArray(favorite_teams) ? JSON.stringify(favorite_teams) : favorite_teams;

      console.log('[POST /signup] Creating user:', { id, username });

      await db('users').insert({
          id, username, password: hashedPassword, name, age, bio, image, type, 
          location, hobbies: hobbiesStr, language, ethnicity, gender, phone_number,
          personality_type, detailed_bio, partner_preferences, favorite_teams: favoriteTeamsStr
      });
      // Return success but exclude sensitive password data in a real app. 
      // Keeping response structure similar to before but omitting password is safer.
      console.log('[POST /signup] User created successfully');
      res.json({ id, username, name, age, bio, image, type, location, hobbies: hobbiesStr ? hobbiesStr.split(',') : [], language, ethnicity, gender, phone_number });
  } catch (err) {
      console.error('[POST /signup] Error:', err);
      res.status(500).json({ error: err.message });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
      // Case-insensitive username lookup
      const row = await db('users').whereRaw('LOWER(username) = LOWER(?)', [username]).first();
      
      if (row) {
          let isValid = false;
          let needsMigration = false;

          // 1. Try bcrypt compare
          isValid = await bcrypt.compare(password, row.password);

          // 2. If fail, check if it's a legacy plain text password
          if (!isValid && row.password === password) {
              isValid = true;
              needsMigration = true;
          }

          if (isValid) {
              // Migrate to hashed password if it was plain text
              if (needsMigration) {
                  const newHash = await bcrypt.hash(password, 10);
                  await db('users').where({ id: row.id }).update({ password: newHash });
                  console.log(`[Migration] Password for user ${username} migrated to hash.`);
              }

              row.hobbies = row.hobbies ? row.hobbies.split(',') : [];
              try {
                  row.favorite_teams = row.favorite_teams ? JSON.parse(row.favorite_teams) : [];
              } catch (e) {
                  row.favorite_teams = [];
              }
              // Don't send password back to client
              delete row.password;
              res.json(row);
          } else {
              res.status(401).json({ error: "Invalid credentials" });
          }
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
              db.raw('(SELECT timestamp FROM messages WHERE match_id = m.id ORDER BY timestamp DESC LIMIT 1) as last_message_time'),
              db.raw('(SELECT sender_id FROM messages WHERE match_id = m.id ORDER BY timestamp DESC LIMIT 1) as last_message_sender_id')
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
          lastMessageSenderId: u.last_message_sender_id || null,
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    try {
        // Get messages ordered by newest first for pagination
        const rows = await db('messages')
            .where('match_id', matchId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .offset(offset);
            
        // Reverse to return in chronological order (oldest first)
        res.json(rows.reverse());
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
        
        const messageData = { id, match_id: matchId, sender_id: senderId, text, timestamp };
        
        // Emit to room
        io.to(matchId).emit('receive_message', messageData);

        res.json(messageData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /posts (Feed)
app.get('/posts', async (req, res) => {
  const currentUserId = req.query.currentUserId;
  const userId = req.query.userId; // Filter by specific user
  const includeArchived = req.query.includeArchived === 'true';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

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

      // Filter archived
      if (!includeArchived) {
          query.where(function() {
              this.where('p.is_archived', false).orWhereNull('p.is_archived');
          });
      }

      // Pagination
      query.limit(limit).offset(offset);

      const rows = await query;
      const posts = rows.map(p => ({
          ...p,
          images: p.images ? p.images.split(',') : [],
          isLiked: !!p.isLiked,
          isArchived: !!p.is_archived
      }));
      res.json(posts);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// PUT /posts/:id/archive
app.put('/posts/:id/archive', async (req, res) => {
    const { id } = req.params;
    const { archived } = req.body; // true or false
    
    try {
        await db('posts').where('id', id).update({ is_archived: archived });
        res.json({ success: true, id, archived });
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

// GET /dates
app.get('/dates', async (req, res) => {
    const userId = req.query.userId;
    try {
        const rows = await db('scheduled_dates as d')
            .join('users as sender', 'd.sender_id', 'sender.id')
            .join('users as receiver', 'd.receiver_id', 'receiver.id')
            .where('d.sender_id', userId)
            .orWhere('d.receiver_id', userId)
            .select(
                'd.*',
                'sender.name as sender_name',
                'sender.image as sender_image',
                'receiver.name as receiver_name',
                'receiver.image as receiver_image'
            );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /dates
app.post('/dates', async (req, res) => {
    const { sender_id, receiver_id, date, time, location, description } = req.body;
    const id = generateId();
    const timestamp = Date.now();
    try {
        await db('scheduled_dates').insert({
            id, sender_id, receiver_id, date, time, location, description, status: 'pending', timestamp
        });
        res.json({ id, status: 'pending', timestamp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /dates/:id
app.put('/dates/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db('scheduled_dates').where('id', id).update({ status });
        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// Daily Topics
const DAILY_TOPICS_POOL = [
    { category: 'Food', question: 'Favorite Cuisine?', options: ['Italian', 'Japanese', 'Mexican', 'Chinese'] },
    { category: 'Book', question: 'Favorite Genre?', options: ['Sci-Fi', 'Romance', 'Mystery', 'Non-Fiction'] },
    { category: 'Music', question: 'Favorite Genre?', options: ['Pop', 'Rock', 'Jazz', 'Hip-Hop'] },
    { category: 'Movie', question: 'Favorite Genre?', options: ['Action', 'Comedy', 'Drama', 'Horror'] },
    { category: 'Travel', question: 'Dream Destination?', options: ['Beach', 'Mountain', 'City', 'Countryside'] },
    { category: 'Activity', question: 'Ideal Date?', options: ['Dinner', 'Movie', 'Walk', 'Adventure'] }
];

app.get('/daily-topic', async (req, res) => {
    const userId = req.query.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Get or Create Topic for Today
        let topic = await db('daily_topics').where('date', today).first();
        
        if (!topic) {
            const randomTopic = DAILY_TOPICS_POOL[Math.floor(Math.random() * DAILY_TOPICS_POOL.length)];
            const id = generateId();
            const optionsStr = JSON.stringify(randomTopic.options);
            
            await db('daily_topics').insert({
                id,
                date: today,
                category: randomTopic.category,
                question: randomTopic.question,
                options: optionsStr
            });
            
            topic = { id, date: today, ...randomTopic, options: optionsStr };
        }

        // Parse options if string
        if (typeof topic.options === 'string') {
            topic.options = JSON.parse(topic.options);
        }

        // 2. Check if user voted
        let userVote = null;
        let voteCounts = {};

        // Initialize vote counts
        topic.options.forEach(opt => voteCounts[opt] = 0);

        if (userId) {
            const voteRow = await db('user_daily_votes')
                .where({ user_id: userId, topic_id: topic.id })
                .first();
            if (voteRow) {
                userVote = voteRow.choice;
            }
        }

        // 3. Get all votes stats
        const allVotes = await db('user_daily_votes').where('topic_id', topic.id);
        allVotes.forEach(v => {
            if (voteCounts[v.choice] !== undefined) {
                voteCounts[v.choice]++;
            }
        });

        res.json({
            topic,
            userVote,
            voteCounts,
            totalVotes: allVotes.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/daily-topic/vote', async (req, res) => {
    const { userId, topicId, choice } = req.body;
    
    try {
        const existingVote = await db('user_daily_votes')
            .where({ user_id: userId, topic_id: topicId })
            .first();

        if (existingVote) {
            // Update vote
            await db('user_daily_votes')
                .where({ id: existingVote.id })
                .update({ choice, timestamp: Date.now() });
        } else {
            // Insert vote
            const id = generateId();
            await db('user_daily_votes').insert({
                id, user_id: userId, topic_id: topicId, choice, timestamp: Date.now()
            });
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- User Polls API ---

// GET /polls
app.get('/polls', async (req, res) => {
    const userId = req.query.userId;
    try {
        const polls = await db('user_polls as p')
            .join('users as u', 'p.user_id', 'u.id')
            .select('p.*', 'u.username', 'u.name', 'u.image as user_image')
            .orderBy('p.timestamp', 'desc');

        // Enhance with vote stats and user vote status
        const pollsWithStats = await Promise.all(polls.map(async (poll) => {
            const options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;
            
            // Get votes
            const votes = await db('user_poll_votes').where('poll_id', poll.id);
            const voteCounts = {};
            options.forEach(opt => voteCounts[opt] = 0);
            
            votes.forEach(v => {
                if (voteCounts[v.choice] !== undefined) voteCounts[v.choice]++;
            });

            let userVote = null;
            if (userId) {
                const myVote = votes.find(v => v.user_id === userId);
                if (myVote) userVote = myVote.choice;
            }

            return {
                ...poll,
                options,
                voteCounts,
                totalVotes: votes.length,
                userVote
            };
        }));

        res.json(pollsWithStats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /polls
app.post('/polls', async (req, res) => {
    const { userId, question, options } = req.body;
    const id = generateId();
    const timestamp = Date.now();
    const optionsStr = JSON.stringify(options);

    try {
        await db('user_polls').insert({
            id, user_id: userId, question, options: optionsStr, timestamp
        });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /polls/:id/vote
app.post('/polls/:id/vote', async (req, res) => {
    const { id } = req.params;
    const { userId, choice } = req.body;
    
    try {
        const existingVote = await db('user_poll_votes')
            .where({ user_id: userId, poll_id: id })
            .first();

        if (existingVote) {
             await db('user_poll_votes')
                .where({ id: existingVote.id })
                .update({ choice, timestamp: Date.now() });
        } else {
            const voteId = generateId();
            await db('user_poll_votes').insert({
                id: voteId, user_id: userId, poll_id: id, choice, timestamp: Date.now()
            });

            // NOTIFICATION LOGIC
            // Get poll owner
            const poll = await db('user_polls').where('id', id).first();
            if (poll && poll.user_id !== userId) {
                const notifId = generateId();
                await db('notifications').insert({
                    id: notifId,
                    user_id: poll.user_id, // Receiver (Poll Owner)
                    actor_id: userId,      // Voter
                    type: 'vote',
                    reference_id: id,
                    text: `voted on your poll: "${poll.question}"`,
                    timestamp: Date.now()
                });
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Notifications API ---

// GET /notifications
app.get('/notifications', async (req, res) => {
    const userId = req.query.userId;
    try {
        const notifs = await db('notifications as n')
            .join('users as u', 'n.actor_id', 'u.id')
            .where('n.user_id', userId)
            .select('n.*', 'u.username', 'u.image as actor_image')
            .orderBy('n.timestamp', 'desc');
        res.json(notifs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /notifications/read
app.post('/notifications/read', async (req, res) => {
    const { userId } = req.body;
    try {
        await db('notifications').where('user_id', userId).update({ is_read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Sport Events API ---

// GET /sport-events
app.get('/sport-events', async (req, res) => {
    const userId = req.query.userId;
    try {
        const events = await db('sport_events as e')
            .join('users as h', 'e.host_id', 'h.id')
            .select(
                'e.*',
                'h.name as host_name',
                'h.image as host_image'
            )
            .orderBy('e.timestamp', 'desc');

        // Enrich with participant count and joined status
        const enrichedEvents = await Promise.all(events.map(async (event) => {
            const participants = await db('event_participants').where('event_id', event.id);
            const joined = userId ? participants.some(p => String(p.user_id) === String(userId)) : false;
            return {
                ...event,
                currentPeople: participants.length,
                joined
            };
        }));

        res.json(enrichedEvents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /sport-events
app.post('/sport-events', async (req, res) => {
    const { host_id, sport, matchup, location, address, date, time, max_people, description } = req.body;
    const id = generateId();
    const timestamp = Date.now();
    try {
        await db('sport_events').insert({
            id, host_id, sport, matchup, location, address, date, time, max_people, description, timestamp
        });
        
        // Auto-join host
        const partId = generateId();
        await db('event_participants').insert({
            id: partId, event_id: id, user_id: host_id, timestamp
        });

        res.json({ id, ...req.body, timestamp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /sport-events/:id/join
app.post('/sport-events/:id/join', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    
    try {
        const event = await db('sport_events').where('id', id).first();
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        const countRes = await db('event_participants').where('event_id', id).count('id as count');
        // Handle different DB return types for count
        const count = countRes[0].count || countRes[0]['count(*)'];
        
        if (count >= event.max_people) {
            return res.status(400).json({ error: 'Event is full' });
        }

        const existing = await db('event_participants').where({ event_id: id, user_id }).first();
        if (existing) return res.json({ success: true, message: 'Already joined' });

        const partId = generateId();
        await db('event_participants').insert({
            id: partId, event_id: id, user_id, timestamp: Date.now()
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /sport-events/:id/leave
app.post('/sport-events/:id/leave', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.body;
    try {
        await db('event_participants').where({ event_id: id, user_id }).del();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
