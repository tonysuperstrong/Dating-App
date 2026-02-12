const db = require('./server/db_config');

async function checkUser() {
  try {
    const user = await db('users').where('username', 'like', '%tonyleung%').orWhere('username', 'like', '%gmail.com%').first();
    console.log('User found:', user);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
