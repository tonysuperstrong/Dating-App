const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const awsConnection = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, 'certs/global-bundle.pem')).toString(),
  }
};

module.exports = {
  development: {
    client: 'pg',
    connection: awsConnection,
    migrations: {
      directory: path.join(__dirname, 'migrations')
    }
  },
  production: {
    client: 'pg',
    connection: awsConnection,
    migrations: {
      directory: path.join(__dirname, 'migrations')
    }
  }
};
