const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'www');
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const name of ['index.html','auth.html','avatar.html','play.html','studio.html','css','js','assets']) {
  fs.cpSync(path.join(root, name), path.join(dest, name), { recursive: true });
}
console.log('KAVIX web files copied to www/');
