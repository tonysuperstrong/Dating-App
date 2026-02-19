
const db = require('./db_config');

async function resetLikes() {
    try {
        console.log('Resetting all post likes...');
        
        // Delete all rows from post_likes
        await db('post_likes').del();
        
        // Reset likes count in posts table
        await db('posts').update({ likes: 0 });
        
        console.log('All likes have been reset.');
        process.exit(0);
    } catch (error) {
        console.error('Error resetting likes:', error);
        process.exit(1);
    }
}

resetLikes();
