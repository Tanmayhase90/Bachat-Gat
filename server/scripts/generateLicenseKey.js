const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { generateKey } = require('../src/controllers/licenseController');

const [, , machineId, expiryDate] = process.argv;

if (!machineId || !expiryDate) {
  console.error('Usage: npm run license:generate -- <machine-id> <YYYY-MM-DD>');
  process.exit(1);
}

console.log(generateKey(machineId, expiryDate));
