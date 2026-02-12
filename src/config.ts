// Replace with your actual production URL when deployed
export const PROD_API_URL = 'http://dating-app-prod.ap-southeast-2.elasticbeanstalk.com'; 
// Use your computer's local IP address for Expo Go testing
// export const DEV_API_URL = 'http://192.168.68.88:3000';
export const DEV_API_URL = 'http://192.168.68.88:3000';
// export const DEV_API_URL = 'https://legal-lies-hang.loca.lt';

// Automatically select URL based on environment
// Note: __DEV__ is a global variable in React Native
export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
