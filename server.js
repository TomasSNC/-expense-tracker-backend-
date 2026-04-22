require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

let supabase = null;

async function startServer() {
  try {
    console.log('Initializing...');
    
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    
    console.log('✅ Supabase initialized');

    // Health check
    app.get('/', (req, res) => {
      res.json({ message: 'Server running' });
    });

    // Signup
    app.post('/api/auth/signup', async (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

      try {
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        const { data, error } = await supabase
          .from('users')
          .insert([{ username, password: hashedPassword }])
          .select()
          .single();

        if (error) return res.status(400).json({ message: error.message });
        res.json({ user: { id: data.id, username: data.username } });
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Login
    app.post('/api/auth/login', async (req, res) => {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: 'Missing fields' });

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !data) return res.status(401).json({ message: 'Invalid credentials' });

        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        if (hashedPassword !== data.password) return res.status(401).json({ message: 'Invalid credentials' });

        res.json({ user: { id: data.id, username: data.username } });
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Get trips
    app.get('/api/trips', async (req, res) => {
      const userId = req.query.userId;
      if (!userId) return res.status(400).json({ message: 'User ID required' });

      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('userId', userId);

        if (error) throw error;

        const trips = await Promise.all((data || []).map(async (trip) => {
          const { data: expenses } = await supabase
            .from('expenses')
            .select('amountInTripCurrency')
            .eq('tripId', trip.id);
          const total = (expenses || []).reduce((s, e) => s + parseFloat(e.amountInTripCurrency || 0), 0);
          return { ...trip, totalAmount: total };
        }));

        res.json(trips);
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Create trip
    app.post('/api/trips', async (req, res) => {
      const { userId, destination, startDate, endDate, currency, reason } = req.body;
      if (!userId || !destination || !startDate || !endDate || !currency) {
        return res.status(400).json({ message: 'Missing fields' });
      }

      try {
        const { data, error } = await supabase
          .from('trips')
          .insert([{ userId, destination, startDate, endDate, currency, reason: reason || '' }])
          .select()
          .single();

        if (error) throw error;
        res.json(data);
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Get expenses
    app.get('/api/expenses', async (req, res) => {
      const tripId = req.query.tripId;
      if (!tripId) return res.status(400).json({ message: 'Trip ID required' });

      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('tripId', tripId);

        if (error) throw error;
        res.json(data || []);
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Create expense
    app.post('/api/expenses', async (req, res) => {
      const { tripId, date, originalAmount, originalCurrency, amountInTripCurrency, exchangeRate, type, description, receiptImage } = req.body;
      if (!tripId || !date || !originalAmount || !type) return res.status(400).json({ message: 'Missing fields' });

      try {
        const { data, error } = await supabase
          .from('expenses')
          .insert([{
            tripId,
            date,
            originalAmount: parseFloat(originalAmount),
            originalCurrency: originalCurrency || 'USD',
            amountInTripCurrency: parseFloat(amountInTripCurrency || originalAmount),
            exchangeRate: parseFloat(exchangeRate || 1),
            type,
            description: description || '',
            receiptImage: receiptImage || null
          }])
          .select()
          .single();

        if (error) throw error;
        res.json(data);
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Update expense
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
        res.status(500).json({ message: e.message });
      }
    });

    // Delete expense
    app.delete('/api/expenses/:id', async (req, res) => {
      try {
        const { error } = await supabase.from('expenses').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Deleted' });
      } catch (e) {
        res.status(500).json({ message: e.message });
      }
    });

    // Export Excel
    app.get('/api/export/excel', async (req, res) => {
      const tripId = req.query.tripId;
      if (!tripId) return res.status(400).json({ message: 'Trip ID required' });

      try {
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
        res.status(500).json({ message: e.message });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Startup error:', error.message);
    process.exit(1);
  }
}

startServer();