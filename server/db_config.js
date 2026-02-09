const knex = require('knex');
const config = require('./knexfile');

const environment = process.env.NODE_ENV || 'development';
const db = knex(config[environment]);

// Auto-migrate on startup (simple approach for this project)
const initDb = async () => {
  try {
    const exists = await db.schema.hasTable('users');
    if (!exists) {
      console.log('Initializing Database Schema...');
      
      // Users Table
      await db.schema.createTable('users', table => {
        table.string('id').primary();
        table.string('username');
        table.string('password');
        table.string('name');
        table.integer('age');
        table.text('bio');
        table.text('image');
        table.string('type');
        table.string('location');
        table.text('hobbies');
        table.string('language');
        table.string('ethnicity');
        table.string('gender');
        table.string('personality_type');
        table.text('detailed_bio');
        table.text('partner_preferences');
        table.string('phone_number');
      });

      // Matches Table
      await db.schema.createTable('matches', table => {
        table.string('id').primary();
        table.string('user1_id');
        table.string('user2_id');
        table.string('status');
        table.bigInteger('timestamp');
      });

      // Messages Table
      await db.schema.createTable('messages', table => {
        table.string('id').primary();
        table.string('match_id').references('matches.id');
        table.string('sender_id');
        table.text('text');
        table.bigInteger('timestamp');
      });

      // Posts Table
      await db.schema.createTable('posts', table => {
        table.string('id').primary();
        table.string('user_id').references('users.id');
        table.text('images');
        table.text('description');
        table.string('song');
        table.string('song_preview');
        table.bigInteger('timestamp');
        table.integer('likes').defaultTo(0);
      });

      // Comments Table
      await db.schema.createTable('comments', table => {
        table.string('id').primary();
        table.string('post_id').references('posts.id');
        table.string('user_id').references('users.id');
        table.text('text');
        table.bigInteger('timestamp');
      });

      // Post Likes Table
      await db.schema.createTable('post_likes', table => {
        table.string('id').primary();
        table.string('post_id').references('posts.id');
        table.string('user_id').references('users.id');
        table.bigInteger('timestamp');
      });
      
      console.log('Schema initialized successfully.');
    } else {
        // Migration for added columns (idempotent check)
        const hasPhone = await db.schema.hasColumn('users', 'phone_number');
        if (!hasPhone) {
             await db.schema.table('users', table => {
                 table.string('phone_number');
             });
        }
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

initDb();

module.exports = db;
