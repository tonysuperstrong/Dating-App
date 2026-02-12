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

      // Scheduled Dates Table
      await db.schema.createTable('scheduled_dates', table => {
        table.string('id').primary();
        table.string('sender_id').references('users.id');
        table.string('receiver_id').references('users.id');
        table.string('date');
        table.string('time');
        table.string('location');
        table.text('description');
        table.string('status'); // pending, accepted, rejected, cancelled
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

        // Check for scheduled_dates table existence (migration)
        const hasDatesTable = await db.schema.hasTable('scheduled_dates');
        if (!hasDatesTable) {
             await db.schema.createTable('scheduled_dates', table => {
                table.string('id').primary();
                table.string('sender_id').references('users.id');
                table.string('receiver_id').references('users.id');
                table.string('date');
                table.string('time');
                table.string('location');
                table.text('description');
                table.string('status');
                table.bigInteger('timestamp');
             });
        }

        // Check for is_archived column in posts (migration)
        const hasIsArchived = await db.schema.hasColumn('posts', 'is_archived');
        if (!hasIsArchived) {
             await db.schema.table('posts', table => {
                 table.boolean('is_archived').defaultTo(false);
             });
        }

        // Check for favorite_teams column in users (migration)
        const hasFavoriteTeams = await db.schema.hasColumn('users', 'favorite_teams');
        if (!hasFavoriteTeams) {
             await db.schema.table('users', table => {
                 table.text('favorite_teams'); // JSON string array of team names
             });
        }

        // Check for daily_topics table
        const hasDailyTopics = await db.schema.hasTable('daily_topics');
        if (!hasDailyTopics) {
             await db.schema.createTable('daily_topics', table => {
                 table.string('id').primary();
                 table.string('date'); // YYYY-MM-DD
                 table.string('category'); // 'Food', 'Book', 'Music'
                 table.string('question');
                 table.text('options'); // JSON string array of options
             });
        }

        // Check for user_daily_votes table
        const hasUserDailyVotes = await db.schema.hasTable('user_daily_votes');
        if (!hasUserDailyVotes) {
             await db.schema.createTable('user_daily_votes', table => {
                 table.string('id').primary();
                 table.string('user_id').references('users.id');
                 table.string('topic_id').references('daily_topics.id');
                 table.string('choice');
                 table.bigInteger('timestamp');
             });
        }

        // Check for user_polls table
        const hasUserPolls = await db.schema.hasTable('user_polls');
        if (!hasUserPolls) {
             await db.schema.createTable('user_polls', table => {
                 table.string('id').primary();
                 table.string('user_id').references('users.id');
                 table.string('question');
                 table.text('options'); // JSON string array
                 table.bigInteger('timestamp');
             });
        }

        // Check for user_poll_votes table
        const hasUserPollVotes = await db.schema.hasTable('user_poll_votes');
        if (!hasUserPollVotes) {
             await db.schema.createTable('user_poll_votes', table => {
                 table.string('id').primary();
                 table.string('user_id').references('users.id');
                 table.string('poll_id').references('user_polls.id');
                 table.string('choice');
                 table.bigInteger('timestamp');
             });
        }

        // Check for notifications table
        const hasNotifications = await db.schema.hasTable('notifications');
        if (!hasNotifications) {
             await db.schema.createTable('notifications', table => {
                 table.string('id').primary();
                 table.string('user_id').references('users.id'); // Receiver
                 table.string('actor_id').references('users.id'); // Sender/Actor
                 table.string('type'); // 'vote', 'comment', 'like', 'match'
                 table.string('reference_id'); // poll_id, post_id, etc.
                 table.string('text'); // Notification text
                 table.boolean('is_read').defaultTo(false);
                 table.bigInteger('timestamp');
             });
        }
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

initDb();

module.exports = db;
