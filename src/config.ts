// Replace with your actual production URL when deployed
export const PROD_API_URL = 'http://your-production-api.elasticbeanstalk.com'; 
export const DEV_API_URL = 'http://localhost:3000';

// Automatically select URL based on environment
// Note: __DEV__ is a global variable in React Native
export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
