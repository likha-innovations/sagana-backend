const fs = require('fs');
const file = process.argv[2] || '.env.dev';

if (!fs.existsSync(file)) {
  console.error(`Error: Environment file "${file}" does not exist.`);
  process.exit(1);
}

const content = fs.readFileSync(file, 'utf8');
if (!/^\s*DATABASE_URL\s*=/m.test(content)) {
  console.error(`Error: DATABASE_URL is not defined in "${file}".`);
  process.exit(1);
}
