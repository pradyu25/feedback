const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400);
        throw new Error('Please provide username and password');
    }

    const safeUsername = String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let user;
    let role;

    // Check if student (Case Insensitive)
    const student = await Student.findOne({
        rollId: { $regex: new RegExp(`^${safeUsername}$`, 'i') }
    });

    if (student) {
        user = student;
        role = 'student';
    } else {
        // Check if admin/hod (Case Insensitive)
        const adminHod = await User.findOne({
            username: { $regex: new RegExp(`^${safeUsername}$`, 'i') }
        });

        if (adminHod) {
            user = adminHod;
            role = adminHod.role;
        }
    }

    let passwordMatch = false;

    if (user) {
        if (role === 'student') {
            // Restrict password to strictly be the student's Roll ID in uppercase
            if (password === String(user.rollId).toUpperCase()) {
                passwordMatch = true;
            }
        } else {
            // Admin/HOD use standard hash check
            if (await user.matchPassword(password)) {
                passwordMatch = true;
            }
        }
    }

    if (passwordMatch) {
        res.json({
            _id: user._id,
            username: user.username || user.rollId,
            name: user.name,
            role: role,
            token: generateToken(user._id, role),
        });
    } else {
        res.status(401);
        throw new Error('Invalid username or password');
    }
});

module.exports = { authUser };
