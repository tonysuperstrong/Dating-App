const bcrypt = require('bcryptjs');

const hash = '$2b$10$X/A4K7S8N66G8YB8RL4LJuMKTghyboXIfbzgGpGF.da7NzyDptbZu';
const passwordToTest = '123456';

bcrypt.compare(passwordToTest, hash).then(res => {
    console.log(`Password "${passwordToTest}" match:`, res);
});
