const db = require('./db_config');

async function checkPosts() {
    try {
        const posts = await db('posts')
            .join('users', 'posts.user_id', 'users.id')
            .select('posts.id', 'users.username', 'users.id as user_id', 'posts.description');
        console.table(posts);
        process.exit(0);
    } catch (error) {
        console.error('Error fetching posts:', error);
        process.exit(1);
    }
}

checkPosts();