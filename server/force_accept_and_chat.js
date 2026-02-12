
const db = require('./db_config');

async function forceAccept() {
    try {
        console.log('Forcing all matches to active...');
        await db('matches').update({ status: 'active' });

        // Get the match between tonyleung and test_full
        // We know the ID from previous debug: acaec0351d22ffed333f
        const matchId = 'acaec0351d22ffed333f';
        const match = await db('matches').where('id', matchId).first();

        if (match) {
            console.log(`Found match ${matchId}. Adding welcome message...`);
            
            // Check if message exists
            const msg = await db('messages').where('match_id', matchId).first();
            if (!msg) {
                const senderId = match.user1_id; // test_full
                await db('messages').insert({
                    id: Date.now().toString(),
                    match_id: matchId,
                    sender_id: senderId,
                    text: "Hi! I've accepted your request. Let's chat!",
                    timestamp: Date.now()
                });
                console.log('Added welcome message.');
            } else {
                console.log('Message already exists.');
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

forceAccept();
