const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    uploadExcel,
    createQuestions,
    getQuestions,
    updateQuestions,
    deleteQuestions,
    toggleActiveQuestions,
    clearFeedback,
    clearStudents,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/upload-excel', protect, authorize('admin'), upload.single('file'), uploadExcel);
router.route('/questions')
    .get(protect, authorize('admin'), getQuestions)
    .post(protect, authorize('admin'), createQuestions);

router.route('/questions/:id')
    .put(protect, authorize('admin'), updateQuestions)
    .delete(protect, authorize('admin'), deleteQuestions);

router.patch('/questions/:id/activate', protect, authorize('admin'), toggleActiveQuestions);
router.delete('/clear-feedback', protect, authorize('admin'), clearFeedback);
router.delete('/clear-students', protect, authorize('admin'), clearStudents);

module.exports = router;
