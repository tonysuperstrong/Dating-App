const path = require('path');
const fs = require('fs');
require('dotenv').config();

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.resolve(__dirname, 'dating.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations')
    }
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 5432,
      ssl: {
        rejectUnauthorized: true,
        ca: fs.readFileSync(path.join(__dirname, 'certs/global-bundle.pem')).toString(),
      }
    },
    migrations: {
      directory: path.join(__dirname, 'migrations')
    }
  }
};
