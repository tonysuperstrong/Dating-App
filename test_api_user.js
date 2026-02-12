
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const USER_ID = 'mlg9cts8xdfwjrx3eo'; // Test Female ID

async function testGetUser() {
    try {
        console.log(`Fetching user ${USER_ID}...`);
        const response = await fetch(`${BASE_URL}/users/${USER_ID}`);
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(text);
            return;
        }
        const user = await response.json();
        console.log('User Data:');
        console.log(JSON.stringify(user, null, 2));
    } catch (err) {
        console.error(err);
    }
}

testGetUser();
