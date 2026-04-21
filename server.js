require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// CORS configuration
app.use(cors());
app.use(express.json());

console.log('Starting server...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'NOT SET');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'Set' : 'NOT SET');
console.log('PORT:', process.env.PORT || 3000);

// Test if Supabase can be imported
let supabase;
try {
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: SUPABASE_URL or SUPABASE_KEY not set!');
    process.exit(1);
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client created');
} catch (error) {
  console.error('ERROR creating Supabase client:', error.message);
  process.exit(1);
}

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Server running' });
});

// ==================== AUTH ENDPOINTS ====================

// Sign Up
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
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user with simple hashing
    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      user: { id: newUser.id, username: newUser.username }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Signup failed: ' + error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const crypto = require('crypto');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    if (hashedPassword !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed: ' + error.message });
  }
});

// ==================== TRIPS ENDPOINTS ====================

// Get all trips for a user
app.get('/api/trips', async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }

    const { data: trips, error } = await supabase
      .from('trips')
      .select('*')
      .eq('userId', userId)
      .order('startDate', { ascending: false });

    if (error) throw error;

    // Calculate total for each trip
    const tripsWithTotals = await Promise.all(
      trips.map(async (trip) => {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amountInTripCurrency')
          .eq('tripId', trip.id);

        const totalAmount = expenses
          ? expenses.reduce((sum, exp) => sum + parseFloat(exp.amountInTripCurrency || 0), 0)
          : 0;

        return { ...trip, totalAmount };
      })
    );

    res.json(tripsWithTotals);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Failed to fetch trips: ' + error.message });
  }
});

// Create new trip
app.post('/api/trips', async (req, res) => {
  try {
    const { userId, destination, startDate, endDate, currency, reason } = req.body;

    if (!userId || !destination || !startDate || !endDate || !currency) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { data: newTrip, error } = await supabase
      .from('trips')
      .insert([{
        userId,
        destination,
        startDate,
        endDate,
        currency,
        reason: reason || ''
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(newTrip);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Failed to create trip: ' + error.message });
  }
});

// ==================== EXPENSES ENDPOINTS ====================

// Get expenses for a trip
app.get('/api/expenses', async (req, res) => {
  try {
    const tripId = req.query.tripId;

    if (!tripId) {
      return res.status(400).json({ message: 'Trip ID required' });
    }

    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('tripId', tripId)
      .order('date', { ascending: false });

    if (error) throw error;

    res.json(expenses || []);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Failed to fetch expenses: ' + error.message });
  }
});

// Create new expense
app.post('/api/expenses', async (req, res) => {
  try {
    const {
      tripId,
      date,
      originalAmount,
      originalCurrency,
      amountInTripCurrency,
      exchangeRate,
      type,
      description,
      receiptImage
    } = req.body;

    if (!tripId || !date || !originalAmount || !type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { data: newExpense, error } = await supabase
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

    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ message: 'Failed to create expense: ' + error.message });
  }
});

// Update expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const { date, originalAmount, originalCurrency, amountInTripCurrency, exchangeRate, type, description } = req.body;

    const { data: updatedExpense, error } = await supabase
      .from('expenses')
      .update({
        date,
        originalAmount: parseFloat(originalAmount),
        originalCurrency,
        amountInTripCurrency: parseFloat(amountInTripCurrency),
        exchangeRate: parseFloat(exchangeRate),
        type,
        description
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (error) throw error;

    res.json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ message: 'Failed to update expense: ' + error.message });
  }
});

// Delete expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (error) throw error;

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: 'Failed to delete expense: ' + error.message });
  }
});

// Export to Excel
app.get('/api/export/excel', async (req, res) => {
  try {
    const tripId = req.query.tripId;

    if (!tripId) {
      return res.status(400).json({ message: 'Trip ID required' });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError) throw tripError;

    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('tripId', tripId)
      .order('date', { ascending: true });

    if (expensesError) throw expensesError;

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Description', key: 'description', width: 20 },
      { header: 'Original Amount', key: 'originalAmount', width: 15 },
      { header: `Amount (${trip.currency})`, key: 'amountInTripCurrency', width: 15 },
      { header: 'Exchange Rate', key: 'exchangeRate', width: 12 }
    ];

    expenses.forEach((expense) => {
      worksheet.addRow({
        date: new Date(expense.date).toLocaleDateString(),
        type: expense.type,
        description: expense.description,
        originalAmount: `${parseFloat(expense.originalAmount).toFixed(2)} ${expense.originalCurrency}`,
        amountInTripCurrency: parseFloat(expense.amountInTripCurrency).toFixed(2),
        exchangeRate: parseFloat(expense.exchangeRate || 1).toFixed(4)
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=expenses_${trip.destination}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting:', error);
    res.status(500).json({ message: 'Failed to export: ' + error.message });
  }
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});