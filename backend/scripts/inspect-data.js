const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');

const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
    console.log(`\n\n=== FILE: ${file} ===`);
    try {
        const workbook = xlsx.readFile(path.join(dataDir, file));

        workbook.SheetNames.forEach(sheetName => {
            console.log(`\n--- Sheet: ${sheetName} ---`);
            const sheet = workbook.Sheets[sheetName];

            // Limit to 20 rows to scan for structure
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, limit: 20 });

            // Print raw rows to help identify header
            rows.forEach((row, i) => {
                if (row.length > 0) {
                    console.log(`Row ${i}:`, JSON.stringify(row));
                }
            });
        });

    } catch (err) {
        console.error(`Error reading ${file}:`, err.message);
    }
});
