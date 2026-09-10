const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const hasilRoutes = require('./routes/hasil');
const examRoutes = require('./routes/exam');
const uploadRoutes = require('./routes/upload');
const pdfRoutes = require('./routes/pdf');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hasil', hasilRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/pdf', pdfRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;