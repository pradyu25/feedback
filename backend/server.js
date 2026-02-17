const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const hodRoutes = require('./routes/hodRoutes');
const adminRoutes = require('./routes/adminRoutes');

dotenv.config();

connectDB();

const app = express();

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use(cors({
    origin: '*',
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);


if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`));
}

module.exports = app;
