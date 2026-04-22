const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

console.log('Server initializing...');

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Server running' });
});

// Auth signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

    // For now, just accept signup (no database)
    res.json({ user: { id: '1', username } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Auth login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

    // For now, just accept login (no database)
    res.json({ user: { id: '1', username } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get trips
app.get('/api/trips', async (req, res) => {
  try {
    res.json([]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create trip
app.post('/api/trips', async (req, res) => {
  try {
    const { destination } = req.body;
    res.json({ id: '1', destination, totalAmount: 0 });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get expenses
app.get('/api/expenses', async (req, res) => {
  try {
    res.json([]);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create expense
app.post('/api/expenses', async (req, res) => {
  try {
    res.json({ id: '1', amountInTripCurrency: 0 });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    res.json({ id: req.params.id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Delete expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Export Excel
app.get('/api/export/excel', async (req, res) => {
  try {
    res.json({ message: 'Export not implemented' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server on port ${port}`);
});