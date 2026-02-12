const db = require('./db_config');

async function findUsers() {
    try {
        const users = await db('users').select('id', 'username', 'name', 'gender', 'type');
        console.table(users);
        process.exit(0);
    } catch (error) {
        console.error('Error finding users:', error);
        process.exit(1);
    }
}

findUsers();
