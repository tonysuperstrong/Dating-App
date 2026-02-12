const db = require('./db_config');

async function cleanupUsers() {
    try {
        // IDs to delete (from previous find_users.js output)
        // testerB_1770610387000 (mlenpid6vm49pfe5jgs)
        // debugB_1770610589387 (mlentuj1xbmai4pis3)
        // debugA_1770610589332 (mlentuir436bphbara2)
        // testerA_1770610386932 (mlenpicrlvte1l552p)
        // test_phone_user_1770613260953 (mlepf3yj9l67rksbdz8)
        // testuser_1770614519814 (mleq63cfaeesmplsd4)

        const usernamesToDelete = [
            'testerB_', 
            'debugB_', 
            'debugA_', 
            'testerA_', 
            'test_phone_user_', 
            'testuser_'
        ];

        console.log('Cleaning up test users...');

        for (const pattern of usernamesToDelete) {
            const users = await db('users').where('username', 'like', `${pattern}%`);
            for (const user of users) {
                console.log(`Deleting user: ${user.username} (${user.id})`);
                // Delete associated matches first
                await db('matches').where('user1_id', user.id).orWhere('user2_id', user.id).delete();
                // Delete associated messages? (If any)
                // Delete posts? (If any)
                await db('users').where('id', user.id).delete();
            }
        }
        
        console.log('Cleanup complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error cleaning up users:', error);
        process.exit(1);
    }
}

cleanupUsers();
