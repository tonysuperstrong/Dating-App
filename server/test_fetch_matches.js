
const BASE_URL = 'http://localhost:3000';
const USER_ID = 'mlenpicrlvte1l552p'; // The user from the logs

async function testFetchMatches() {
    console.log(`Fetching matches for User (${USER_ID})...`);

    try {
        const response = await fetch(`${BASE_URL}/matches?userId=${USER_ID}`);
        const matches = await response.json();

        console.log(`Found ${matches.length} matches.`);
        console.log(JSON.stringify(matches, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

testFetchMatches();
