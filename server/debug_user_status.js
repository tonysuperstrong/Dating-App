
const db = require('./db_config');

async function debugUser() {
    try {
        const user = await db('users').where('username', 'tonyleung').first();
        if (!user) {
            console.log('User tonyleung not found');
            process.exit(0);
        }
        
        console.log(`User: ${user.username} (${user.id})`);

        // Matches
        const matches = await db('matches')
            .where('user1_id', user.id)
            .orWhere('user2_id', user.id);
        
        console.log('\nMatches:');
        console.table(matches);

        // Date Requests
        const dates = await db('scheduled_dates')
            .where('sender_id', user.id)
            .orWhere('receiver_id', user.id);
            
        console.log('\nDate Requests:');
        console.table(dates);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debugUser();
