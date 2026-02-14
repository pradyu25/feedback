const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
    console.log(`\n\n=== FILE: ${file} ===`);
    const workbook = xlsx.readFile(path.join(dataDir, file));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    console.log('Range:', sheet['!ref']);

    // Get first 5 rows as arrays, including nulls
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, limit: 5, defval: null });

    rows.forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
});
