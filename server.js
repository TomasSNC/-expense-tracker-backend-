console.log('=== PROCESS START ===');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());

try {
  console.log('1. Requiring dotenv...');
  require('dotenv').config();
  console.log('   ✓ dotenv loaded');

  console.log('2. Checking environment variables...');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ SET' : '✗ MISSING');
  console.log('   SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✓ SET' : '✗ MISSING');
  console.log('   PORT:', process.env.PORT || '3000 (default)');

  console.log('3. Requiring express...');
  const express = require('express');
  console.log('   ✓ express loaded');

  console.log('4. Requiring cors...');
  const cors = require('cors');
  console.log('   ✓ cors loaded');

  console.log('5. Requiring crypto...');
  const crypto = require('crypto');
  console.log('   ✓ crypto loaded');

  console.log('6. Creating express app...');
  const app = express();
  console.log('   ✓ app created');

  console.log('7. Setting up middleware...');
  app.use(cors());
  app.use(express.json());
  console.log('   ✓ middleware set up');

  console.log('8. Creating test route...');
  app.get('/', (req, res) => {
    res.json({ message: 'Server running' });
  });
  console.log('   ✓ GET / route created');

  console.log('9. Attempting to require Supabase...');
  const { createClient } = require('@supabase/supabase-js');
  console.log('   ✓ Supabase module loaded');

  console.log('10. Creating Supabase client...');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  console.log('   ✓ Supabase client created');

  console.log('11. Setting up auth endpoints...');
  
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Missing fields' });
      }

      const hashed = crypto.createHash('sha256').update(password).digest('hex');
      const { data, error } = await supabase
        .from('users')
        .insert([{ username, password: hashed }])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ message: error.message });
      }

      res.json({ user: { id: data.id, username: data.username } });
    } catch (e) {
      console.error('Signup error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: 'Missing fields' });
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !data) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const hashed = crypto.createHash('sha256').update(password).digest('hex');
      if (hashed !== data.password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      res.json({ user: { id: data.id, username: data.username } });
    } catch (e) {
      console.error('Login error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.get('/api/trips', async (req, res) => {
    try {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ message: 'User ID required' });

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('userId', userId);

      if (error) throw error;

      const trips = await Promise.all((data || []).map(async (trip) => {
        const { data: expenses } = await supabase.from('expenses').select('amountInTripCurrency').eq('tripId', trip.id);
        const total = (expenses || []).reduce((s, e) => s + parseFloat(e.amountInTripCurrency || 0), 0);
        return { ...trip, totalAmount: total };
      }));

      res.json(trips);
    } catch (e) {
      console.error('Get trips error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/trips', async (req, res) => {
    try {
      const { userId, destination, startDate, endDate, currency, reason } = req.body;
      if (!userId || !destination || !startDate || !endDate || !currency) {
        return res.status(400).json({ message: 'Missing fields' });
      }

      const { data, error } = await supabase
        .from('trips')
        .insert([{ userId, destination, startDate, endDate, currency, reason: reason || '' }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (e) {
      console.error('Create trip error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.get('/api/expenses', async (req, res) => {
    try {
      const tripId = req.query.tripId;
      if (!tripId) return res.status(400).json({ message: 'Trip ID required' });

      const { data, error } = await supabase.from('expenses').select('*').eq('tripId', tripId);
      if (error) throw error;
      res.json(data || []);
    } catch (e) {
      console.error('Get expenses error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.post('/api/expenses', async (req, res) => {
    try {
      const { tripId, date, originalAmount, originalCurrency, amountInTripCurrency, exchangeRate, type, description, receiptImage } = req.body;
      if (!tripId || !date || !originalAmount || !type) return res.status(400).json({ message: 'Missing fields' });

      const { data, error } = await supabase
        .from('expenses')
        .insert([{ tripId, date, originalAmount: parseFloat(originalAmount), originalCurrency: originalCurrency || 'USD', amountInTripCurrency: parseFloat(amountInTripCurrency || originalAmount), exchangeRate: parseFloat(exchangeRate || 1), type, description: description || '', receiptImage: receiptImage || null }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (e) {
      console.error('Create expense error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.put('/api/expenses/:id', async (req, res) => {
    try {
      const { date, originalAmount, originalCurrency, amountInTripCurrency, exchangeRate, type, description } = req.body;
      const { data, error } = await supabase
        .from('expenses')
        .update({ date, originalAmount: parseFloat(originalAmount), originalCurrency, amountInTripCurrency: parseFloat(amountInTripCurrency), exchangeRate: parseFloat(exchangeRate), type, description })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (e) {
      console.error('Update error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.delete('/api/expenses/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ message: 'Deleted' });
    } catch (e) {
      console.error('Delete error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  app.get('/api/export/excel', async (req, res) => {
    try {
      const tripId = req.query.tripId;
      if (!tripId) return res.status(400).json({ message: 'Trip ID required' });

      const { data: trip, error: tripError } = await supabase.from('trips').select('*').eq('id', tripId).single();
      if (tripError) throw tripError;

      const { data: expenses, error: expError } = await supabase.from('expenses').select('*').eq('tripId', tripId);
      if (expError) throw expError;

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Expenses');

      worksheet.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Description', key: 'description', width: 20 },
        { header: 'Amount', key: 'originalAmount', width: 15 },
        { header: `Total (${trip.currency})`, key: 'amountInTripCurrency', width: 15 },
        { header: 'Rate', key: 'exchangeRate', width: 12 }
      ];

      (expenses || []).forEach(e => worksheet.addRow({
        date: new Date(e.date).toLocaleDateString(),
        type: e.type,
        description: e.description,
        originalAmount: `${parseFloat(e.originalAmount).toFixed(2)} ${e.originalCurrency}`,
        amountInTripCurrency: parseFloat(e.amountInTripCurrency).toFixed(2),
        exchangeRate: parseFloat(e.exchangeRate || 1).toFixed(4)
      }));

      worksheet.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=expenses_${trip.destination}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error('Export error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  console.log('   ✓ All endpoints set up');

  console.log('12. Starting server...');
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ SUCCESS: Server listening on port ${PORT}`);
  });

  console.log('=== SERVER STARTED SUCCESSFULLY ===');

} catch (error) {
  console.error('❌ FATAL ERROR:');
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}