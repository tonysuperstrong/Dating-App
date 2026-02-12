const fs = require('fs');
const os = require('os');
const path = require('path');

// Get Local IP
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
};

const localIP = getLocalIP();
const configPath = path.join(__dirname, '../src/config.ts');
const configContent = `// Replace with your actual production URL when deployed
export const PROD_API_URL = 'http://dating-app-prod.ap-southeast-2.elasticbeanstalk.com'; 
// Use your computer's local IP address for Expo Go testing
export const DEV_API_URL = 'http://${localIP}:3000';

// Automatically select URL based on environment
// Note: __DEV__ is a global variable in React Native
export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
`;

fs.writeFileSync(configPath, configContent);
console.log(`Updated src/config.ts with local IP: ${localIP}`);
