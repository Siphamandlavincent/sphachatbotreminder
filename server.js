require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3010; // Changed to a new port number

app.use(bodyParser.json());
app.use(express.static(__dirname));

// Input validation middleware
const validateChatInput = (req, res, next) => {
    const { message, model } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required and must be a string' });
    }
    if (message.length > 2000) {
        return res.status(400).json({ error: 'Message is too long (max 2000 characters)' });
    }
    next();
};

// Store reminders in memory
let reminders = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/chat', validateChatInput, async (req, res) => {
    const message = req.body.message;
    const selectedModel = req.body.model || "openrouter/auto";
    
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: selectedModel,
            messages: [{ "role": "user", "content": message }]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3008',
                'X-Title': 'AI Chatbot with Reminders'
            },
            timeout: 30000 // 30 second timeout
        });

        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error('Invalid response format from AI service');
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'Request timeout' });
        }
        
        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        res.status(error.response?.status || 500).json({ 
            error: 'Error communicating with AI service',
            details: error.response?.data?.error || error.message 
        });
    }
});

// Validate reminder input
const validateReminderInput = (req, res, next) => {
    const { title, date, time } = req.body;
    if (!title || !date || !time) {
        return res.status(400).json({ error: 'Title, date, and time are required' });
    }
    if (new Date(`${date}T${time}`) < new Date()) {
        return res.status(400).json({ error: 'Reminder time must be in the future' });
    }
    next();
};

app.post('/api/reminders', validateReminderInput, (req, res) => {
    const { title, date, time } = req.body;
    const reminder = {
        id: Date.now(),
        title,
        datetime: `${date}T${time}`,
        created: new Date().toISOString()
    };
    reminders.push(reminder);
    res.json(reminder);
});

app.get('/api/reminders', (req, res) => {
    res.json(reminders);
});

app.delete('/api/reminders/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const initialLength = reminders.length;
    reminders = reminders.filter(r => r.id !== id);
    
    if (reminders.length === initialLength) {
        return res.status(404).json({ error: 'Reminder not found' });
    }
    res.json({ success: true });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});