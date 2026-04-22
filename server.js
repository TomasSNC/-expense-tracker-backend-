const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

console.log('Server initializing...');

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Server running' });
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
    res.json({ user: { id: '1', username } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing fields' });
    res.json({ user: { id: '1', username } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/trips', (req, res) => {
  res.json([]);
});

app.post('/api/trips', (req, res) => {
  res.json({ id: '1', destination: req.body.destination, totalAmount: 0 });
});

app.get('/api/expenses', (req, res) => {
  res.json([]);
});

app.post('/api/expenses', (req, res) => {
  res.json({ id: '1' });
});

app.put('/api/expenses/:id', (req, res) => {
  res.json({ id: req.params.id });
});

app.delete('/api/expenses/:id', (req, res) => {
  res.json({ message: 'Deleted' });
});

app.get('/api/export/excel', (req, res) => {
  res.json({ message: 'Not implemented' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: err.message });
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`✅ Server on port ${port}`);
});

// Handle process errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});