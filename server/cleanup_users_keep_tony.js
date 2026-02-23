const db = require('./db_config');

async function cleanupUsers() {
  try {
    const keepUsernames = ['tonyleung', 'tonyleungdkkf'];

    const keepUsers = await db('users')
      .whereIn('username', keepUsernames)
      .orWhere('name', 'Tony Leung');

    if (keepUsers.length === 0) {
      console.log('No users matching Tony Leung found. Aborting to avoid deleting everything.');
      process.exit(1);
    }

    const keepIds = keepUsers.map(u => u.id);
    console.log('Keeping users:', keepUsers.map(u => `${u.id} (${u.username || u.name})`));

    const usersToDelete = await db('users').whereNotIn('id', keepIds).select('id');
    const deleteIds = usersToDelete.map(u => u.id);
    console.log(`Found ${deleteIds.length} users to delete.`);

    if (deleteIds.length === 0) {
      console.log('Nothing to delete.');
      process.exit(0);
    }

    // Delete dependent records first
    const deletedMessagesBySender = await db('messages')
      .whereIn('sender_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedMessagesBySender} messages from deleted users (sender).`);

    const deletedMessagesByMatch = await db('messages')
      .whereIn('match_id', function () {
        this.select('id')
          .from('matches')
          .whereIn('user1_id', deleteIds)
          .orWhereIn('user2_id', deleteIds);
      })
      .del();
    console.log(`Deleted ${deletedMessagesByMatch} messages from matches involving deleted users.`);

    const deletedCommentsByUser = await db('comments')
      .whereIn('user_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedCommentsByUser} comments from deleted users.`);

    const deletedPostLikesByUser = await db('post_likes')
      .whereIn('user_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedPostLikesByUser} post likes from deleted users.`);

    const deletedScheduledDates = await db('scheduled_dates')
      .whereIn('sender_id', deleteIds)
      .orWhereIn('receiver_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedScheduledDates} scheduled dates involving deleted users.`);

    const deletedMatches = await db('matches')
      .whereIn('user1_id', deleteIds)
      .orWhereIn('user2_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedMatches} matches involving deleted users.`);

    const deletedPollVotes = await db('user_polls')
      .whereIn('user_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedPollVotes} poll votes from deleted users.`);

    const deletedDailyVotes = await db('user_daily_votes')
      .whereIn('user_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedDailyVotes} daily topic votes from deleted users.`);

    const deletedNotifications = await db('notifications')
      .whereIn('user_id', deleteIds)
      .del()
      .catch(() => 0);
    console.log(`Deleted ${deletedNotifications} notifications for deleted users (if table exists).`);

    // Delete posts made by deleted users (comments, likes already cleaned)
    const deletedCommentsByPost = await db('comments')
      .whereIn('post_id', function () {
        this.select('id')
          .from('posts')
          .whereIn('user_id', deleteIds);
      })
      .del();
    console.log(`Deleted ${deletedCommentsByPost} comments on posts from deleted users.`);

    const deletedPostLikesByPost = await db('post_likes')
      .whereIn('post_id', function () {
        this.select('id')
          .from('posts')
          .whereIn('user_id', deleteIds);
      })
      .del();
    console.log(`Deleted ${deletedPostLikesByPost} likes on posts from deleted users.`);

    const deletedPosts = await db('posts')
      .whereIn('user_id', deleteIds)
      .del();
    console.log(`Deleted ${deletedPosts} posts from deleted users.`);

    // Finally delete users
    const deletedUsers = await db('users')
      .whereIn('id', deleteIds)
      .del();
    console.log(`Deleted ${deletedUsers} users.`);

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupUsers();
