const db = require('./db_config');

async function resetMatches() {
    try {
        console.log('Resetting matches...');
        
        // 1. Get valid user IDs
        const users = await db('users').select('id');
        const validUserIds = users.map(u => u.id);
        
        // 2. Delete matches where either user is NOT in validUserIds
        const invalidMatches = await db('matches')
            .whereNotIn('user1_id', validUserIds)
            .orWhereNotIn('user2_id', validUserIds)
            .del();
        console.log(`Deleted ${invalidMatches} invalid matches (referencing deleted users).`);

        // 3. Reset matches for 'tonyleung' (mlelsge0z0ytcfmaya) so they can swipe again
        // We delete ANY match involving this user to give a fresh start
        const myId = 'mlelsge0z0ytcfmaya'; 
        const myMatches = await db('matches')
            .where('user1_id', myId)
            .orWhere('user2_id', myId)
            .del();
        console.log(`Deleted ${myMatches} matches for user ${myId} (Reset for testing).`);

        console.log('Matches table cleared/reset.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error resetting matches:', error);
        process.exit(1);
    }
}

resetMatches();
