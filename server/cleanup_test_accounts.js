const db = require('./db_config');

async function cleanupTestAccounts() {
    try {
        console.log('Cleaning up test accounts...');
        
        // Define users to keep: Jessica (id 1) and any user starting with 'tony'
        // Define users to remove: 'david', 'sarah', 'michael', 'emma' and 'test_*'
        
        const usersToDelete = ['david', 'sarah', 'michael', 'emma'];
        
        // 1. Delete specific test users
        const countSpecific = await db('users')
            .whereIn('username', usersToDelete)
            .del();
        console.log(`Deleted ${countSpecific} specific test users (${usersToDelete.join(', ')}).`);

        // 2. Delete generated test users (starting with 'test_')
        const countGenerated = await db('users')
            .where('username', 'like', 'test_%')
            .del();
        console.log(`Deleted ${countGenerated} generated test users.`);

        console.log('Cleanup complete. Remaining users:');
        const remaining = await db('users').select('id', 'username', 'name');
        console.table(remaining);
        
        process.exit(0);
    } catch (error) {
        console.error('Error cleaning up accounts:', error);
        process.exit(1);
    }
}

cleanupTestAccounts();
