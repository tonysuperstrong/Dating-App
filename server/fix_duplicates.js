
const db = require('./db_config');

async function fixDuplicates() {
    try {
        console.log('Fixing duplicate matches...');
        
        // Target: tonyleung (mlelsge0z0ytcfmaya) and Test Full User (mlepjha67c52vezn2bf)
        // Matches:
        // 4: acaec0351d22ffed333f (test -> tonyleung)
        // 5: 76429ebdb2a31ecfc0c4 (test -> tonyleungdkkf) - WAIT, this is a DIFFERENT tony user!

        // Let's look closer at the user list:
        // 5: 'mlelsge0z0ytcfmaya' | 'tonyleung'
        // 6: 'mlenmgidduvzhvzqv5' | 'tonyleungdkkf'

        // The user said "there's two female now".
        // Match 2: 'mleouhjhlky8pkrq3a' | 'mlel50tenr8i0uem0ne' (deleted user?) -> 'mlelsge0z0ytcfmaya' (tonyleung)
        
        // Let's check who 'mlel50tenr8i0uem0ne' is.
        const ghostUser = await db('users').where('id', 'mlel50tenr8i0uem0ne').first();
        console.log('Ghost User check:', ghostUser ? ghostUser : 'Not Found');

        if (!ghostUser) {
            console.log('Match 2 involves a deleted user. Deleting match mleouhjhlky8pkrq3a...');
            await db('matches').where('id', 'mleouhjhlky8pkrq3a').delete();
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixDuplicates();
