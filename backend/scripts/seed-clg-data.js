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
    const attFiles = fs.readdirSync(dataDir).filter(f => f.includes('ATTENDANCE') && f.endsWith('.xlsx'));
    const defaultPassword = '1234'; // Model pre-save hook will hash this

    for (const file of attFiles) {
        console.log(`Processing Attendance File: ${file}`);
        let year = 2;
        if (file.includes('IV-II')) year = 4;
        else if (file.includes('III-II')) year = 3;
        else if (file.includes('II-II')) year = 2;

        const workbook = xlsx.readFile(path.join(dataDir, file));

        for (const sheetName of workbook.SheetNames) {
            // Deduce Section from sheet name
            let section = 'A';
            if (sheetName.includes('C')) section = 'C';
            else if (sheetName.includes('B')) section = 'B';
            else if (sheetName.includes('A')) section = 'A';

            console.log(`Parsing Sheet: ${sheetName} -> Y${year} Sec ${section}`);
            const sheet = workbook.Sheets[sheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });

            for (const row of rows) {
                if (row && row.length > 0) {
                    const rollIdRaw = String(row[0]).trim();
                    // Match pattern: digits + letter + digits
                    const match = rollIdRaw.match(/([0-9]+[A-Z][0-9]+[A-Z]?[A-Z0-9]+)/);

                    if (match) {
                        const rollId = match[0];
                        const name = row[1] ? String(row[1]).trim() : `Student ${rollId}`;

                        try {
                            const exists = await Student.findOne({ rollId });
                            if (!exists) {
                                await Student.create({
                                    rollId,
                                    name,
                                    year,
                                    semester: 2, // Assuming II sem
                                    section,
                                    password: defaultPassword,
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
    }

    console.log('Data seeding complete!');
    process.exit();
};

seedData();
