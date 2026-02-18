const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Feedback = require('../models/Feedback');
const Question = require('../models/Question');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');

// Helper to parser Roman Numerals
const romanToNum = (roman) => {
    if (!roman) return null;
    roman = roman.toString().trim().toUpperCase();
    if (roman === 'I') return 1;
    if (roman === 'II') return 2;
    if (roman === 'III') return 3;
    if (roman === 'IV') return 4;
    return parseInt(roman) || null;
};

// @desc    Upload Excel data
// @route   POST /api/admin/upload-excel
// @access  Private (Admin)
const uploadExcel = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('Please upload an Excel file');
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    const fileName = req.file.originalname;

    const results = {
        students: 0,
        faculty: 0,
        subjects: 0,
    };

    // 1. Check for Alloc File (Subjects & Faculty)
    if (fileName.toLowerCase().includes('alloc')) {
        const sheet = workbook.Sheets[sheetNames[0]]; // Usually first sheet
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
                        results.faculty++;
                    }

                    // Upsert Subject
                    const type = subjectName.toUpperCase().includes('LAB') ? 'lab' : 'theory';
                    const subjectCode = `${subjectName.substring(0, 3).toUpperCase()}-${year}-${semester}-${section}`;

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
                    results.subjects++;
                }
            }
        }
    }
    // 2. Check for Attendance/Student List File
    else if (fileName.match(/^(II|III|IV)-.*\.xls/) || fileName.toUpperCase().includes('ATTENDANCE')) {
        let year = 2;
        if (fileName.toUpperCase().includes('IV')) year = 4;
        else if (fileName.toUpperCase().includes('III')) year = 3;
        else if (fileName.toUpperCase().includes('II')) year = 2;

        const defaultPassword = '1234';

        for (const sheetName of sheetNames) {
            let section = 'A';
            const fileNameUpper = fileName.toUpperCase();
            if (fileNameUpper.includes('-C')) section = 'C';
            else if (fileNameUpper.includes('-B')) section = 'B';
            else if (fileNameUpper.includes('-A')) section = 'A';

            const sheet = workbook.Sheets[sheetName];
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0 });

            for (const row of rows) {
                if (row && row.length > 0) {
                    const rollIdRaw = String(row[0]).trim();
                    const match = rollIdRaw.match(/([0-9]+[A-Z][0-9]+[A-Z]?[A-Z0-9]+)/);

                    if (match) {
                        const rollId = match[0];
                        const name = row[1] ? String(row[1]).trim() : `Student ${rollId}`;

                        try {
                            const exists = await Student.findOne({ rollId });
                            if (!exists) {
                                const hashedPassword = await bcrypt.hash(defaultPassword, 10);
                                await Student.create({
                                    rollId,
                                    name,
                                    year,
                                    semester: (year >= 2) ? 2 : 1,
                                    section,
                                    password: hashedPassword,
                                    feedbackStatus: []
                                });
                                results.students++;
                            } else {
                                // Optional: Update existing student details if needed
                                exists.name = name;
                                exists.year = year;
                                exists.semester = (year >= 2) ? 2 : 1;
                                exists.section = section;
                                await exists.save();
                                // We don't increment results.students for updates to avoid confusion or we can add results.updatedStudents
                            }
                        } catch (err) {
                            console.error(`Error processing student ${rollId}:`, err.message);
                        }
                    }
                }
            }
        }
    }
    // 3. Fallback to standard sheet names
    else {
        // Process Faculty first (dependencies)
        if (sheetNames.includes('Faculty')) {
            const facultyData = xlsx.utils.sheet_to_json(workbook.Sheets['Faculty']);
            for (const f of facultyData) {
                await Faculty.findOneAndUpdate(
                    { facultyId: f.facultyId },
                    { name: f.name, department: f.department },
                    { upsert: true, new: true }
                );
                results.faculty++;
            }
        }

        // Process Students
        if (sheetNames.includes('Students')) {
            const studentData = xlsx.utils.sheet_to_json(workbook.Sheets['Students']);
            for (const s of studentData) {
                // Check if student exists
                const existingStudent = await Student.findOne({ rollId: s.rollId });

                if (existingStudent) {
                    // Update existing
                    existingStudent.name = s.name;
                    existingStudent.year = s.year;
                    existingStudent.semester = s.semester;
                    existingStudent.section = s.section;
                    // We don't update password here as it is fixed to RollID logic
                    await existingStudent.save();
                } else {
                    // Create new
                    // Password is required by schema, so we set it.
                    // Although login uses direct RollID check, we store a hash of RollID for consistency/fallback.
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(s.rollId.toUpperCase(), salt);

                    await Student.create({
                        rollId: s.rollId,
                        name: s.name,
                        year: s.year,
                        semester: s.semester,
                        section: s.section,
                        password: hashedPassword, // Schema requires this
                        department: s.department || 'AIML'
                    });
                }
                results.students++;
            }
        }

        // Process Subjects
        if (sheetNames.includes('Subjects')) {
            const subjectData = xlsx.utils.sheet_to_json(workbook.Sheets['Subjects']);
            for (const sub of subjectData) {
                const faculty = await Faculty.findOne({ facultyId: sub.facultyId });
                if (faculty) {
                    await Subject.findOneAndUpdate(
                        { subjectCode: sub.subjectCode },
                        {
                            subjectName: sub.subjectName,
                            type: sub.type, // theory/lab
                            year: sub.year,
                            semester: sub.semester,
                            section: sub.section,
                            facultyId: faculty._id,
                        },
                        { upsert: true, new: true }
                    );
                    results.subjects++;
                }
            }
        }
    }

    res.json({ message: 'Data imported successfully', results });
});

// @desc    Create/Update Questions
// @route   POST /api/admin/questions
// @access  Private (Admin)
const createQuestions = asyncHandler(async (req, res) => {
    const { type, questions, isActive } = req.body;

    if (!type || !questions) {
        res.status(400);
        throw new Error('Type and questions are required');
    }

    // Deactivate existing active set for this type if setting new one to active
    if (isActive) {
        await Question.updateMany({ type }, { isActive: false });
    }

    const questionSet = await Question.create({
        type,
        questions,
        isActive: isActive || false,
    });

    res.status(201).json(questionSet);
});

// @desc    Get all question sets
// @route   GET /api/admin/questions
// @access  Private (Admin)
const getQuestions = asyncHandler(async (req, res) => {
    const questionSets = await Question.find({}).sort({ createdAt: -1 });
    res.json(questionSets);
});

// @desc    Update a question set
// @route   PUT /api/admin/questions/:id
// @access  Private (Admin)
const updateQuestions = asyncHandler(async (req, res) => {
    const { questions, type, isActive } = req.body;
    const questionSet = await Question.findById(req.params.id);

    if (questionSet) {
        if (isActive && !questionSet.isActive) {
            // Deactivate others of the same type if activating this one
            await Question.updateMany({ type: type || questionSet.type }, { isActive: false });
        }

        questionSet.questions = questions || questionSet.questions;
        questionSet.type = type || questionSet.type;
        questionSet.isActive = isActive !== undefined ? isActive : questionSet.isActive;

        const updatedSet = await questionSet.save();
        res.json(updatedSet);
    } else {
        res.status(404);
        throw new Error('Question set not found');
    }
});

// @desc    Delete a question set
// @route   DELETE /api/admin/questions/:id
// @access  Private (Admin)
const deleteQuestions = asyncHandler(async (req, res) => {
    const questionSet = await Question.findById(req.params.id);

    if (questionSet) {
        await questionSet.deleteOne();
        res.json({ message: 'Question set removed' });
    } else {
        res.status(404);
        throw new Error('Question set not found');
    }
});

// @desc    Activate a question set
// @route   PATCH /api/admin/questions/:id/activate
// @access  Private (Admin)
const toggleActiveQuestions = asyncHandler(async (req, res) => {
    const questionSet = await Question.findById(req.params.id);

    if (questionSet) {
        // Deactivate all others of the same type
        await Question.updateMany({ type: questionSet.type }, { isActive: false });

        questionSet.isActive = true;
        await questionSet.save();

        res.json({ message: 'Question set activated' });
    } else {
        res.status(404);
        throw new Error('Question set not found');
    }
});

// @desc    Clear Feedback
// @route   DELETE /api/admin/clear-feedback
// @access  Private (Admin)
const clearFeedback = asyncHandler(async (req, res) => {
    await Feedback.deleteMany({});
    // Reset student feedback status?
    // It's in the Student model as `feedbackStatus`.
    await Student.updateMany({}, { feedbackStatus: [] });

    res.json({ message: 'Feedback cleared' });
});

// @desc    Clear Students
// @route   DELETE /api/admin/clear-students
// @access  Private (Admin)
const clearStudents = asyncHandler(async (req, res) => {
    // Also clear associated feedback? Usually yes.
    await Feedback.deleteMany({});
    await Student.deleteMany({});
    res.json({ message: 'Students and their feedback cleared' });
});

module.exports = {
    uploadExcel,
    createQuestions,
    getQuestions,
    updateQuestions,
    deleteQuestions,
    toggleActiveQuestions,
    clearFeedback,
    clearStudents,
};
