const fs = require('fs');
const path = require('path');

const KEEP_FILES = [
  'stock_bulk.json',
  'favorites.json',
  'realtime-quote.json',
  'algo-screens.json'
];

module.exports = function cleanup() {
  const cacheDir = path.join(__dirname, 'cache');
  fs.readdir(cacheDir, (err, files) => {
    if (err) return console.error("❌ Failed to read cache folder:", err);

    files.forEach(file => {
      if (!KEEP_FILES.includes(file)) {
        const filePath = path.join(cacheDir, file);
        fs.unlink(filePath, err => {
          if (err) {
            console.error(`❌ Failed to delete ${file}:`, err);
          } else {
            console.log(`🗑️ Deleted old cache file: ${file}`);
          }
        });
      }
    });
  });
};
