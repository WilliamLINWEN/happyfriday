// Main Express server file (placeholder)
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Bitbucket PR Description Generator API');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
