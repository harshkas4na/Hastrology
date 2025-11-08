require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // We will use this in the next steps

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // This lets your server read JSON from request bodies

// --- Schemas & Models (Define these first) ---

// User Schema
const UserSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true
  },
  dob: {
    type: String,
    required: true
  },
  birthTime: {
    type: String,
    required: true
  },
  birthPlace: {
    type: String,
    required: true
  }
});

// Horoscope Schema
const HoroscopeSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  horoscopeText: {
    type: String,
    required: true
  }
});

// Models
const User = mongoose.model('User', UserSchema);
const Horoscope = mongoose.model('Horoscope', HoroscopeSchema);


// --- API Routes ---

// Health Check Route
app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running' });
});

// User Registration Route
app.post('/api/user/register', async (req, res) => {
  try {
    const { walletAddress, dob, birthTime, birthPlace } = req.body;
    
    // Validate required fields
    if (!walletAddress || !dob || !birthTime || !birthPlace) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['walletAddress', 'dob', 'birthTime', 'birthPlace']
      });
    }
    
    // This command finds a user by walletAddress and creates/updates them
    const savedUser = await User.findOneAndUpdate(
      { walletAddress: walletAddress },
      { 
        walletAddress: walletAddress, 
        dob: dob, 
        birthTime: birthTime, 
        birthPlace: birthPlace 
      },
      { upsert: true, new: true, runValidators: true }
    );
    
    // Send a 201 "Created" status back
    res.status(201).json({
      message: 'User registered successfully',
      user: savedUser
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// Horoscope Status Route
app.get('/api/horoscope/status', async (req, res) => {
    try {
      const { walletAddress } = req.query;
      
      // Step 1: Check for User Registration
      const user = await User.findOne({ walletAddress });
      if (!user) {
        return res.status(200).json({ status: 'new_user' });
      }
      
      // Step 2: Check for Today's Horoscope
      const todayDateString = new Date().toISOString().split('T')[0];
      const horoscope = await Horoscope.findOne({ 
        walletAddress, 
        date: todayDateString 
      });
      
      // Step 3: Send the Correct Status
      if (horoscope) {
        return res.status(200).json({ 
          status: 'exists', 
          horoscope: horoscope.horoscopeText 
        });
      } else {
        return res.status(200).json({ status: 'clear_to_pay' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  });

// Horoscope Confirm Route
app.post('/api/horoscope/confirm', async (req, res) => {
    try {
      const { walletAddress, signature } = req.body;
      
      // MOCK LOGIC: Signature verification
      console.log('Signature received:', signature);
      // TODO: Add real Solana transaction verification logic here
      
      // Get User Details
      const user = await User.findOne({ walletAddress });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Call AI Server
      const aiResponse = await axios.post(
        `${process.env.AI_SERVER_URL}/generate_horoscope`,
        {
          dob: user.dob,
          birth_time: user.birthTime,
          birth_place: user.birthPlace
        }
      );
      
      const { horoscope_text } = aiResponse.data;
      
      // Save Horoscope
      const todayDateString = new Date().toISOString().split('T')[0];
      const newHoroscope = new Horoscope({
        walletAddress,
        date: todayDateString,
        horoscopeText: horoscope_text
      });
      await newHoroscope.save();
      
      // Return Response
      res.status(200).json({ horoscope_text });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: 'Server error',
        error: error.message
      });
    }
  });

// --- Connect to DB & Start Server ---

const PORT = process.env.PORT || 5001;

// MongoDB Connection Function
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not set in environment variables');
      process.exit(1);
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    // **THE FIX IS HERE:**
    // Start listening for requests *only after* the DB connection is successful
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1); // Exit the process with failure
  }
};

// Call the function to connect and start the server
connectDB();