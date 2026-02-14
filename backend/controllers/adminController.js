const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Subject = require('../models/Subject');
const Feedback = require('../models/Feedback');
const Question = require('../models/Question');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');

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

    const results = {
        students: 0,
        faculty: 0,
        subjects: 0,
    };

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
            const updateOps = {
                $set: {
                    name: s.name,
                    year: s.year,
                    semester: s.semester,
                    section: s.section
                },
                $setOnInsert: {}
            };

            if (s.password) {
                const salt = await bcrypt.genSalt(10);
                updateOps.$set.password = await bcrypt.hash(String(s.password), salt);
            } else {
                // Default password for new students only
                const salt = await bcrypt.genSalt(10);
                updateOps.$setOnInsert.password = await bcrypt.hash('1234', salt);
            }

            await Student.findOneAndUpdate(
                { rollId: s.rollId },
                updateOps,
                { upsert: true, new: true }
            );
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
