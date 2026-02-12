
const BASE_URL = 'http://localhost:3000';

async function createTestUser() {
    const userData = {
        username: `test_female_${Date.now()}`,
        password: 'password123',
        name: 'Test Female',
        age: 25,
        bio: 'I am a test female user created for testing purposes.',
        image: '#FF69B4', // Pink color
        type: 'date',
        location: 'New York, USA',
        hobbies: 'Reading,Traveling,Coding',
        language: 'English',
        ethnicity: 'Asian',
        gender: 'Female',
        phone_number: '+15550001234'
    };

    console.log('Creating test user...', userData);

    try {
        const response = await fetch(`${BASE_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('User created successfully!');
            console.log('User ID:', data.id);
            console.log('Username:', data.username);
            console.log('Full Response:', data);
        } else {
            console.error('Failed to create user:', data);
        }

    } catch (error) {
        console.error('Error creating user:', error);
    }
}

createTestUser();
