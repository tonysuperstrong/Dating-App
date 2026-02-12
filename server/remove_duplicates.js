const db = require('./db_config');

async function removeDuplicates() {
    try {
        console.log('Removing duplicate users...');
        
        // IDs to delete
        const idsToDelete = [
            'mlgsajwt1a5dfpo2aku' // tonyleung1027@gmail.com
        ];
        
        const count = await db('users')
            .whereIn('id', idsToDelete)
            .del();
            
        console.log(`Deleted ${count} users.`);
        
        console.log('Remaining users:');
        const remaining = await db('users').select('id', 'username', 'name');
        console.table(remaining);
        
        process.exit(0);
    } catch (error) {
        console.error('Error removing duplicates:', error);
        process.exit(1);
    }
}

removeDuplicates();