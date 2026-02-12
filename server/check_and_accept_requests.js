
const db = require('./db_config');

async function checkAndAccept() {
    try {
        // 1. Get User ID for 'tonyleung'
        const user = await db('users').where('username', 'tonyleung').first();
        if (!user) {
            console.error('User tonyleung not found');
            process.exit(1);
        }
        const userId = user.id;
        console.log(`Checking requests for user: ${user.username} (${userId})`);

        // 2. Check Pending Match Requests (where I am user1)
        const pendingMatches = await db('matches')
            .where('user1_id', userId)
            .andWhere('status', 'pending');
        
        console.log(`Found ${pendingMatches.length} pending match requests.`);

        for (const m of pendingMatches) {
            console.log(`Accepting match ${m.id} with user ${m.user2_id}...`);
            await db('matches').where('id', m.id).update({ status: 'active' });
        }

        // 3. Check Pending Date Requests (where I am sender)
        const pendingDates = await db('scheduled_dates')
            .where('sender_id', userId)
            .andWhere('status', 'pending');

        console.log(`Found ${pendingDates.length} pending date requests.`);

        for (const d of pendingDates) {
            console.log(`Accepting date request ${d.id} with receiver ${d.receiver_id}...`);
            await db('scheduled_dates').where('id', d.id).update({ status: 'accepted' });
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAndAccept();
