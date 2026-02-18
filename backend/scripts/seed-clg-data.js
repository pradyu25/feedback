const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Feedback = require('../models/Feedback');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dataDir = path.join(__dirname, '..', '..', 'clgdata');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
        console.log('MongoDB Connected');
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const romanToNum = (roman) => {
    if (!roman) return null;
    roman = roman.toString().trim().toUpperCase();
    if (roman === 'I') return 1;
    if (roman === 'II') return 2;
    if (roman === 'III') return 3;
    if (roman === 'IV') return 4;
    return parseInt(roman) || null;
};

const seedData = async () => {
    await connectDB();

    console.log('Clearing existing data...');
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    await Subject.deleteMany({});
    await Feedback.deleteMany({});

    // 1. Parse Alloc Files (Subjects & Faculty)
    const allocFiles = fs.readdirSync(dataDir).filter(f => f.includes('Alloc') && f.endsWith('.xlsx'));

    for (const file of allocFiles) {
        console.log(`Processing Alloc File: ${file}`);
        const workbook = xlsx.readFile(path.join(dataDir, file));
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 'A', range: 0, limit: 100, defval: '' });

        for (const row of rows) {
            if (row.A && row.E && row.B && row.C) {
                const subjectName = row.A.toString().trim();
                const yearStr = row.B;
                const semStr = row.C;
                const section = row.D ? row.D.toString().trim() : 'A';
                const facultyName = row.E.toString().trim();

                const year = romanToNum(yearStr);
                const semester = romanToNum(semStr);

                if (year && semester && subjectName !== 'SUBJECT' && subjectName !== 'MOOCS') {
                    // Upsert Faculty
                    let faculty = await Faculty.findOne({ name: facultyName });
                    if (!faculty) {
                        faculty = await Faculty.create({
                            facultyId: `F${Date.now()}${Math.floor(Math.random() * 1000)}`,
                            name: facultyName,
                            department: 'AIML'
                        });
                    }

                    // Upsert Subject
                    const type = subjectName.toUpperCase().includes('LAB') ? 'lab' : 'theory';
                    const subjectCode = `${subjectName.substring(0, 3).toUpperCase()}-${year}-${semester}-${section}`; // Code generation

                    await Subject.findOneAndUpdate(
                        { subjectCode },
                        {
                            subjectName,
                            type,
                            year,
                            semester,
                            section,
                            facultyId: faculty._id
                        },
                        { upsert: true }
                    );

                    console.log(`Upserted Subject: ${subjectName} (${type}) for Y${year}-S${semester} Sec${section}`);
                }
            }
        }
    }

    // 2. Parse Attendance Files (Students)
    // Match files starting with roman numerals (I, II, III, IV) and likely ending in .xls/.xlsx
    const attFiles = fs.readdirSync(dataDir).filter(f => {
        const name = f.toUpperCase();
        return (name.startsWith('II') || name.startsWith('III') || name.startsWith('IV')) && (name.endsWith('.XLS') || name.endsWith('.XLSX'));
    });
    const defaultPassword = '1234'; // Model pre-save hook will hash this

    for (const file of attFiles) {
        console.log(`Processing Attendance File: ${file}`);

        let year = 2; // Default
        if (file.toUpperCase().startsWith('IV')) year = 4;
        else if (file.toUpperCase().startsWith('III')) year = 3;
        else if (file.toUpperCase().startsWith('II')) year = 2;

        try {
            // Use readFileSync to handle potential path/character issues robustly
            const buffer = fs.readFileSync(path.join(dataDir, file));
            const workbook = xlsx.read(buffer, { type: 'buffer' });

            for (const sheetName of workbook.SheetNames) {
                // Determine section from filename or sheet name
                // Filename precedence
                let section = 'A';
                const fUpper = file.toUpperCase();

                // Allow for mulitple sections in one file (handled by sheet-level logic if needed, 
                // but currently files seem to be per-section or combined)
                // If combined (e.g. "A & B"), we might need logic inside the sheet loop or assume sheets map to sections.
                // However, based on file list: "II-A.xls" (Specific), "II-II ... A & B ..." (Combined).
                // If it's a combined file, usually sheets are named "II-II A", "II-II B".

                // Simple heuristic for section from Sheet Name if possible
                const sUpper = sheetName.toUpperCase();
                if (sUpper.includes('SEC-C') || sUpper.endsWith(' C') || sUpper.includes('-C')) section = 'C';
                else if (sUpper.includes('SEC-B') || sUpper.endsWith(' B') || sUpper.includes('-B')) section = 'B';
                else if (sUpper.includes('SEC-A') || sUpper.endsWith(' A') || sUpper.includes('-A')) section = 'A';
                else {
                    // Fallback to filename
                    if (fUpper.includes('-C')) section = 'C';
                    else if (fUpper.includes('-B')) section = 'B';
                    else section = 'A';
                }

                console.log(`Parsing Sheet: ${sheetName} -> Y${year} Sec ${section}`);
                const sheet = workbook.Sheets[sheetName];
                const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });

                let percentageColIndex = 5; // Default for these known XLS files
                let headerFound = false;

                for (const row of rows) {
                    if (!row || row.length === 0) continue;

                    // Check for header row
                    if (!headerFound) {
                        const headerIndex = row.findIndex(cell =>
                            cell && String(cell).toLowerCase().includes('percentage')
                        );
                        if (headerIndex !== -1) {
                            percentageColIndex = headerIndex;
                            headerFound = true;
                            console.log(`Found Percentage column at index ${percentageColIndex}`);
                            continue; // Skip header row
                        }

                        // Also check for "Total Held" etc to ensure we aren't misidentifying data as header if header is missing
                        // But usually header comes before data.

                        // If we see a RollID, assume we passed headers or they are missing.
                    }

                    // Locate Roll ID Code
                    const rollPat = /([0-9]+[A-Z][0-9]+[A-Z]?[A-Z0-9]+)/;
                    let rollIndex = -1;

                    if (row[1] && String(row[1]).match(rollPat)) rollIndex = 1;
                    else if (row[0] && String(row[0]).match(rollPat)) rollIndex = 0;

                    if (rollIndex !== -1) {
                        const rollIdRaw = String(row[rollIndex]).trim();
                        const match = rollIdRaw.match(rollPat);

                        if (match) {
                            const rollId = match[0];
                            const name = row[rollIndex + 1] ? String(row[rollIndex + 1]).trim() : `Student ${rollId}`;

                            let attendancePercentage = 0;
                            // Use detected or default index
                            if (row[percentageColIndex] !== undefined) {
                                attendancePercentage = parseFloat(row[percentageColIndex]);
                                if (isNaN(attendancePercentage)) attendancePercentage = 0;
                            } else {
                                // Fallback: try index 3 (legacy) if index 5 is undefined
                                if (row[3] !== undefined && percentageColIndex === 5) { // Only fallback if we used default
                                    // But index 3 is explicitly TotalHeld in these files.
                                    // Better to stick to 0 if missing.
                                }
                            }

                            try {
                                const exists = await Student.findOne({ rollId });
                                if (!exists) {
                                    await Student.create({
                                        rollId,
                                        name,
                                        year,
                                        semester: (year === 2 || year === 3 || year === 4) ? 2 : 1,
                                        section,
                                        password: defaultPassword,
                                        attendancePercentage,
                                        feedbackStatus: []
                                    });
                                }
                            } catch (err) {
                                console.error(`Error adding student ${rollId}:`, err.message);
                            }
                        }
                    }
                }
            }
        } catch (fileErr) {
            console.error(`Failed to read file ${file}:`, fileErr.message);
        }
    }

    console.log('Data seeding complete!');
    process.exit();
};

seedData();
