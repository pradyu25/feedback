const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'clgdata');
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
    try {
        const workbook = xlsx.readFile(path.join(dataDir, file));
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        console.log(`FILE: ${file}`);
        console.log(`SHEET: ${sheetName}`);
        console.log(`REF: ${sheet['!ref']}`);

        // Get rows as arrays
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Print header row (usually row 0 or 1)
        if (json.length > 0) console.log('ROW 0:', JSON.stringify(json[0]));
        if (json.length > 1) console.log('ROW 1:', JSON.stringify(json[1]));
        if (json.length > 2) console.log('ROW 2:', JSON.stringify(json[2]));

        console.log('-----------------------------------');
    } catch (e) {
        console.error(e);
    }
});
