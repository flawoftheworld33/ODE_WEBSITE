const express = require('express');
const path = require('path');
const app = express();
// This tells it to use the cloud provider's port, or default to 3000 locally
const port = process.env.PORT || 3000; 

app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});