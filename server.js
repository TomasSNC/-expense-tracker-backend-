const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Server running' });
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server on ${port}`);
});