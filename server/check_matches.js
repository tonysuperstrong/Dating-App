const db = require('./db_config');

async function checkMatches() {
    try {
        const matches = await db('matches').select('*');
        console.table(matches);
        process.exit(0);
    } catch (error) {
        console.error('Error checking matches:', error);
        process.exit(1);
    }
}

checkMatches();
