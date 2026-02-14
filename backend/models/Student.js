const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
    rollId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4]
    },
    semester: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5, 6, 7, 8]
    },
    section: {
        type: String,
        required: true
    },
    department: {
        type: String,
        default: 'AIML'
    },
    password: {
        type: String,
        required: true
    },
    feedbackStatus: [{
        semester: { type: Number },
        status: {
            type: String,
            enum: ['not submitted', 'in progress', 'done'],
            default: 'not submitted'
        }
    }]
}, {
    timestamps: true
});

studentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

studentSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
