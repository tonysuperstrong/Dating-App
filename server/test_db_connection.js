require('dotenv').config();
const knex = require('knex');
const config = require('./knexfile');

const environment = 'production'; // Force production to test RDS connection
const db = knex(config[environment]);

async function testConnection() {
  console.log('Testing connection to RDS...');
  console.log('Host:', process.env.DB_HOST);
  console.log('User:', process.env.DB_USER);
  console.log('Database:', process.env.DB_NAME);

  try {
    const result = await db.raw('SELECT 1+1 AS result');
    console.log('Connection successful!');
    console.log('Test query result:', result.rows[0]);
  } catch (error) {
    console.error('Connection failed:', error.message);
    if (error.code === '28P01') {
        console.error('Check your password in .env file.');
    }
  } finally {
    await db.destroy();
  }
}

testConnection();
