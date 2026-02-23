const db = require('./db_config');

async function cleanupLocalPosts() {
  try {
    const localPosts = await db('posts')
      .select('id', 'description', 'images')
      .where('images', 'like', 'file://%');

    console.log('Posts with local image paths:', localPosts.length);
    if (localPosts.length > 0) {
      console.table(localPosts);
      const deleted = await db('posts')
        .whereIn('id', localPosts.map(p => p.id))
        .del();
      console.log(`Deleted ${deleted} posts with local file:// image paths.`);
    } else {
      console.log('No posts with local image paths found.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error cleaning up local posts:', error);
    process.exit(1);
  }
}

cleanupLocalPosts();

