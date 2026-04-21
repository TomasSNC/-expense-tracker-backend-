require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
const path = require('path');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============ AUTH ENDPOINTS ============

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ TRIPS ENDPOINTS ============

app.get('/api/trips', async (req, res) => {
  try {
    const { userId } = req.query;

    const { data: trips, error } = await supabase
      .from('trips')
      .select(`
        *,
        expenses(id, amountInTripCurrency)
      `)
      .eq('userId', userId)
      .order('startDate', { ascending: false });

    if (error) throw error;

    // Calculate total and expense count
    const tripsWithCount = trips.map(trip => {
      const totalAmount = trip.expenses.reduce((sum, exp) => sum + parseFloat(exp.amountInTripCurrency || 0), 0);
      return {
        ...trip,
        expenseCount: trip.expenses.length,
        totalAmount: totalAmount.toFixed(2)
      };
    });

    res.json(tripsWithCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/trips', async (req, res) => {
  try {
    const { userId, destination, startDate, endDate, currency, reason } = req.body;

    const { data: trip, error } = await supabase
      .from('trips')
      .insert([{ userId, destination, startDate, endDate, currency, reason }])
      .select()
      .single();

    if (error) throw error;

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ EXPENSES ENDPOINTS ============

app.get('/api/expenses', async (req, res) => {
  try {
    const { tripId } = req.query;

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('tripId', tripId)
      .order('date', { ascending: true });

    if (error) throw error;

    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const {
      tripId,
      date,
      originalAmount,
      originalCurrency,
      type,
      description,
      amountInTripCurrency,
      exchangeRate,
      receiptImage
    } = req.body;

    // Compress receipt image if provided
    let compressedImage = null;
    if (receiptImage) {
      // Store as base64, Supabase will handle it
      compressedImage = receiptImage;
    }

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert([{
        tripId,
        date,
        originalAmount,
        originalCurrency,
        amountInTripCurrency,
        type,
        description,
        exchangeRate,
        receiptImage: compressedImage
      }])
      .select()
      .single();

    if (error) throw error;

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, originalAmount, originalCurrency, type, description, amountInTripCurrency, exchangeRate } = req.body;

    const { data: expense, error } = await supabase
      .from('expenses')
      .update({
        date,
        originalAmount,
        originalCurrency,
        type,
        description,
        amountInTripCurrency,
        exchangeRate
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ EXPORT ENDPOINTS ============

app.get('/api/export/excel', async (req, res) => {
  try {
    const { tripId } = req.query;

    // Get trip details
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    // Get all expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('tripId', tripId)
      .order('date', { ascending: true });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    // Set columns
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Original Amount', key: 'originalAmount', width: 18 },
      { header: 'Original Currency', key: 'originalCurrency', width: 18 },
      { header: `Amount (${trip.currency})`, key: 'amountInTripCurrency', width: 18 },
      { header: 'Expense Type', key: 'type', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Exchange Rate', key: 'exchangeRate', width: 15 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };

    // Add data
    expenses.forEach(expense => {
      worksheet.addRow({
        date: new Date(expense.date).toLocaleDateString('de-DE'),
        originalAmount: parseFloat(expense.originalAmount).toFixed(2),
        originalCurrency: expense.originalCurrency,
        amountInTripCurrency: parseFloat(expense.amountInTripCurrency).toFixed(2),
        type: expense.type,
        description: expense.description,
        exchangeRate: expense.exchangeRate || '-',
      });
    });

    // Add summary
    const totalRow = worksheet.lastRow.number + 2;
    worksheet.getRow(totalRow).getCell(1).value = 'TOTAL';
    worksheet.getRow(totalRow).getCell(1).font = { bold: true };
    worksheet.getRow(totalRow).getCell(4).value = {
      formula: `SUM(D2:D${worksheet.lastRow.number - 2})`
    };
    worksheet.getRow(totalRow).getCell(4).font = { bold: true };

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="expenses_${trip.destination}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ WEBHOOK FOR TELEGRAM BOT ============

app.post('/api/telegram/expense', async (req, res) => {
  try {
    const {
      userId,
      tripId,
      date,
      originalAmount,
      originalCurrency,
      type,
      description,
      amountInTripCurrency,
      exchangeRate,
      receiptImage
    } = req.body;

    const { data: expense, error } = await supabase
      .from('expenses')
      .insert([{
        tripId,
        date,
        originalAmount,
        originalCurrency,
        amountInTripCurrency,
        type,
        description,
        exchangeRate,
        receiptImage: receiptImage || null
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} in your browser`);
});
