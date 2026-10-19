const fs = require('fs');
const path = require('path');

const apiEnv = path.join(__dirname, '..', 'apps', 'api', '.env');
const example = path.join(__dirname, '..', 'env.example');

if (!fs.existsSync(apiEnv) && fs.existsSync(example)) {
  fs.copyFileSync(example, apiEnv);
  console.log('Created apps/api/.env from env.example');
}
