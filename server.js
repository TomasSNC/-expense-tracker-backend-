require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

console.log('=== SERVER STARTING ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET ✓' : 'MISSING ✗');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'SET ✓' : 'MISSING ✗');
console.log('PORT:', process.env.PORT || 3000);

// Test Supabase import
console.log('Importing Supabase...');
try {
  const { createClient } = require('@supabase/supabase-js');
  console.log('Supabase imported ✓');
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  
  console.log('Creating client...');
  const supabase = createClient(url, key);
  console.log('Client created ✓');
  
  // Test connection
  console.log('Testing connection...');
  supabase.from('users').select('count', { count: 'exact', head: true }).then(result => {
    console.log('Connection test result:', result);
  }).catch(err => {
    console.log('Connection test error:', err.message);
  });
  
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}

// Basic health check
app.get('/', (req, res) => {
  res.json({ message: 'Server running', timestamp: new Date().toISOString() });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});