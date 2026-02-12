const db = require('./server/db_config');

async function checkDuplicates() {
  try {
    const posts = await db('posts').select('*');
    const seen = new Set();
    const duplicates = [];
    
    for (const post of posts) {
      const key = `${post.user_id}-${post.description}-${post.timestamp}`;
      if (seen.has(key)) {
        duplicates.push(post.id);
      } else {
        seen.add(key);
      }
    }
    
    console.log('Duplicate IDs:', duplicates);
    if (duplicates.length > 0) {
        console.log('Removing duplicates...');
        await db('posts').whereIn('id', duplicates).del();
        console.log('Duplicates removed.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDuplicates();
