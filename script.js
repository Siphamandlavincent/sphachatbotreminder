document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const conversationArea = document.querySelector('.conversation-area');
    const modelSelect = document.getElementById('model-select');
    const addReminderButton = document.getElementById('add-reminder-button');
    const reminderForm = document.getElementById('reminder-form');
    const saveReminderButton = document.getElementById('save-reminder');
    const cancelReminderButton = document.getElementById('cancel-reminder');
    const reminderList = document.getElementById('reminder-list');

    // Text-to-Speech setup
    const synth = window.speechSynthesis;
    let speaking = false;

    // Load alarm sound
    const alarmSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    alarmSound.loop = true;  // Enable sound looping

    function speakMessage(text) {
        if (speaking) {
            synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Get available voices and select a male voice
        const voices = synth.getVoices();
        const maleVoice = voices.find(voice => 
            voice.name.includes('Male') || 
            voice.name.includes('David') || 
            voice.name.includes('Mark')
        ) || voices[0];
        
        utterance.voice = maleVoice;
        utterance.rate = 1;
        utterance.pitch = 0.9;  // Slightly lower pitch for more natural male voice
        speaking = true;
        utterance.onend = () => speaking = false;
        synth.speak(utterance);
    }

    function scheduleReminder(reminder) {
        const reminderTime = new Date(reminder.datetime).getTime();
        const now = new Date().getTime();
        const delay = reminderTime - now;

        if (delay > 0) {
            setTimeout(() => {
                alarmSound.play();
                const acknowledged = confirm(`Reminder: ${reminder.title}\nClick OK to stop the alarm.`);
                if (acknowledged) {
                    alarmSound.pause();
                    alarmSound.currentTime = 0;
                }
            }, delay);
        }
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        displayMessage(message, 'user-message');
        messageInput.value = '';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    model: modelSelect.value
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const botResponse = data.choices[0].message.content;
            
            displayMessage(botResponse, 'bot-message');
            speakMessage(botResponse);

        } catch (error) {
            console.error('Error:', error);
            displayMessage('Sorry, I encountered an error. Please try again.', 'bot-message error');
        }
    }

    function displayMessage(text, className) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.textContent = text;
        conversationArea.appendChild(messageDiv);
        conversationArea.scrollTop = conversationArea.scrollHeight;
    }

    // Reminder functions
    function toggleReminderForm() {
        reminderForm.style.display = reminderForm.style.display === 'none' ? 'block' : 'none';
    }

    async function saveReminder() {
        const title = document.getElementById('reminder-title').value;
        const date = document.getElementById('reminder-date').value;
        const time = document.getElementById('reminder-time').value;

        if (!title || !date || !time) {
            alert('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch('/api/reminders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, date, time })
            });

            if (!response.ok) {
                throw new Error('Failed to save reminder');
            }

            const reminder = await response.json();
            addReminderToList(reminder);
            reminderForm.style.display = 'none';
            clearReminderForm();
            
            // Schedule alarm
            scheduleReminder(reminder);

        } catch (error) {
            console.error('Error:', error);
            alert('Failed to save reminder');
        }
    }

    function scheduleReminder(reminder) {
        const reminderTime = new Date(reminder.datetime).getTime();
        const now = new Date().getTime();
        const delay = reminderTime - now;

        if (delay > 0) {
            setTimeout(() => {
                alarmSound.play();
                alert(`Reminder: ${reminder.title}`);
            }, delay);
        }
    }

    function clearReminderForm() {
        document.getElementById('reminder-title').value = '';
        document.getElementById('reminder-date').value = '';
        document.getElementById('reminder-time').value = '';
    }

    function addReminderToList(reminder) {
        const li = document.createElement('li');
        const datetime = new Date(reminder.datetime);
        
        li.innerHTML = `
            <div>
                <strong>${reminder.title}</strong><br>
                <small>${datetime.toLocaleString()}</small>
            </div>
            <button class="delete-button" data-id="${reminder.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        const deleteButton = li.querySelector('.delete-button');
        deleteButton.addEventListener('click', async () => {
            try {
                const response = await fetch(`/api/reminders/${reminder.id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    li.remove();
                } else {
                    throw new Error('Failed to delete reminder');
                }
            } catch (error) {
                console.error('Error deleting reminder:', error);
                alert('Failed to delete reminder');
            }
        });
        
        reminderList.appendChild(li);
    }

    async function loadReminders() {
        try {
            const response = await fetch('/api/reminders');
            const reminders = await response.json();
            reminders.forEach(reminder => {
                addReminderToList(reminder);
                scheduleReminder(reminder);
            });
        } catch (error) {
            console.error('Error loading reminders:', error);
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    addReminderButton.addEventListener('click', toggleReminderForm);
    saveReminderButton.addEventListener('click', saveReminder);
    cancelReminderButton.addEventListener('click', () => {
        reminderForm.style.display = 'none';
        clearReminderForm();
    });

    // Load existing reminders
    loadReminders();
});