const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the project directory
app.use(express.static(__dirname));

// Expose auth_config.json at /auth_config.json
app.get('/auth_config.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth_config.json'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
