
const BASE_URL = 'http://localhost:3000';
const USER_ID = 'mlelxjvpnbqh332s5xn'; // One of the IDs for tonyleungdkkf
const JESSICA_ID = '1';

async function testLike() {
    console.log(`Attempting to like Jessica (${JESSICA_ID}) as User (${USER_ID})...`);

    try {
        const response = await fetch(`${BASE_URL}/matches`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fromUserId: USER_ID,
                toUserId: JESSICA_ID
            }),
        });

        const data = await response.json();
        console.log('Response:', data);

        if (data.status === 'pending') {
            console.log('SUCCESS: Pending match created.');
        } else if (data.status === 'active') {
            console.log('SUCCESS: Active match created.');
        } else {
            console.log('Unexpected status:', data.status);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testLike();
