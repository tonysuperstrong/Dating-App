const db = require('./db_config');

async function checkUser() {
    try {
        const users = await db('users').select('id', 'username', 'hobbies', 'language', 'ethnicity');
        console.log('Checking all users:');
        users.forEach(u => {
             console.log(`User: ${u.username} (${u.id})`);
             console.log(`  Hobbies: ${u.hobbies} (Type: ${typeof u.hobbies})`);
             console.log(`  Language: ${u.language}`);
             console.log(`  Ethnicity: ${u.ethnicity}`);
             console.log('---');
        });
        process.exit(0);
    } catch (error) {
        console.error('Error fetching users:', error);
        process.exit(1);
    }
}

checkUser();
