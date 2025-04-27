// Global variables
let subjects = [];
let teachers = [];
let classes = [];

// Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechSynthesis = window.speechSynthesis;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = SpeechSynthesis;

// Configure speech recognition if available
if (recognition) {
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    console.log('Speech recognition initialized');
} else {
    console.warn('Speech recognition not available in this browser');
}

// Helper function to generate ordinal suffixes
function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Load data when the page loads
document.addEventListener('DOMContentLoaded', function () {
    loadData();
    showPanel('subjects'); // Show subjects panel by default
});

// Load data from API
async function loadData() {
    try {
        // Load subjects
        const subjectsResponse = await fetch('/api/subjects');
        subjects = await subjectsResponse.json();
        updateSubjectList();
        updateTeacherSubjects();
        
        // Load teachers
        const teachersResponse = await fetch('/api/teachers');
        teachers = await teachersResponse.json();
        updateTeacherList();
        
        // Load classes
        const classesResponse = await fetch('/api/classes');
        classes = await classesResponse.json();
        updateClassList();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Event listeners
document.getElementById('subjectForm').addEventListener('submit', function (event) {
    event.preventDefault();
    addSubject();
});

document.getElementById('teacherForm').addEventListener('submit', function (event) {
    event.preventDefault();
    addTeacher();
});

document.getElementById('classForm').addEventListener('submit', function (event) {
    event.preventDefault();
    addClass();
});

// Show/hide panels
function showPanel(panelId) {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    document.querySelector(`[onclick="showPanel('${panelId}')"]`).classList.add('active');
}

// Add subject
async function addSubject() {
    const subjectNameInput = document.getElementById('subjectName');
    const subjectHoursInput = document.getElementById('subjectHours');
    const requiresLabInput = document.getElementById('requiresLab');
    const subjectPriorityInput = document.getElementById('subjectPriority');

    const subjectName = subjectNameInput.value.trim();
    const subjectHours = parseInt(subjectHoursInput.value);
    const requiresLab = requiresLabInput.checked;
    const subjectPriority = parseInt(subjectPriorityInput.value);

    if (!subjectName || isNaN(subjectHours) || isNaN(subjectPriority)) {
        showMessage('subjectMessage', 'Please fill all fields correctly.', 'error');
        speak('Please fill all fields correctly.');
        return false;
    }

    try {
        const response = await fetch('/api/subjects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: subjectName,
                hours: subjectHours,
                requiresLab: requiresLab,
                priority: subjectPriority
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add subject');
        }

        const newSubject = await response.json();
        subjects.push(newSubject);
        updateSubjectList();
        updateTeacherSubjects();
        document.getElementById('subjectForm').reset();
        showMessage('subjectMessage', 'Subject added successfully!', 'success');
        speak(`Subject ${subjectName} added successfully!`);
        return true;
    } catch (error) {
        showMessage('subjectMessage', error.message, 'error');
        speak(error.message);
        return false;
    }
}

// Update subject list
function updateSubjectList() {
    const list = document.getElementById('subjectList');
    list.innerHTML = subjects.map(subject => {
        // Determine the priority display text
        let priorityText = '';
        if (typeof subject.priority === 'number' && !isNaN(subject.priority)) {
            if (subject.priority === 1) {
                priorityText = 'High';
            } else if (subject.priority === 2) {
                priorityText = 'Medium';
            } else if (subject.priority === 3) {
                priorityText = 'Low';
            } else {
                priorityText = `Priority: ${subject.priority}`;
            }
            priorityText = ` (Priority: ${priorityText})`;
        }

        return `
<li class="subject-item">
    <span>${subject.name} (${subject.hours}hrs) ${subject.requiresLab ? '- Lab Required' : ''}${priorityText}</span>
    <button class="delete-btn" onclick="deleteSubject(${subject.id})">Delete</button>
</li>
`;
    }).join('');
}

// Delete subject
async function deleteSubject(id) {
    const subjectToDelete = subjects.find(subject => subject.id === id);
    if (confirm(`Are you sure you want to delete subject: ${subjectToDelete.name}?`)) {
        try {
            const response = await fetch(`/api/subjects/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete subject');
            }

            subjects = subjects.filter(subject => subject.id !== id);
            updateSubjectList();
            updateTeacherSubjects();
            showMessage('subjectMessage', 'Subject deleted successfully!', 'success');
            speak(`Subject ${subjectToDelete.name} deleted successfully!`);
        } catch (error) {
            showMessage('subjectMessage', error.message, 'error');
            speak(error.message);
        }
    }
}

// Update teacher subjects dropdown
function updateTeacherSubjects() {
    const select = document.getElementById('teacherSubjects');
    if (select) {
        select.innerHTML = subjects.map(subject =>
            `<option value="${subject.id}">${subject.name}</option>`
        ).join('');
        console.log('Updated teacher subjects dropdown with:', subjects);
    } else {
        console.error('Teacher subjects dropdown element not found');
    }
}

// Add teacher
async function addTeacher() {
    const teacherNameInput = document.getElementById('teacherName');
    const teacherSubjectsSelect = document.getElementById('teacherSubjects');
    const teacherYearsSelect = document.getElementById('teacherYears');

    const teacherName = teacherNameInput.value.trim();
    const teacherSubjectIds = Array.from(teacherSubjectsSelect.selectedOptions).map(option => parseInt(option.value));
    const teacherYears = Array.from(teacherYearsSelect.selectedOptions).map(option => parseInt(option.value));
    
    console.log('Teacher form data:', {
        name: teacherName,
        subjectIds: teacherSubjectIds,
        years: teacherYears
    });

    if (!teacherName || teacherSubjectIds.length === 0 || teacherYears.length === 0) {
        showMessage('teacherMessage', 'Please fill all fields correctly.', 'error');
        speak('Please fill all fields correctly for the teacher.');
        return false;
    }

    try {
        const response = await fetch('/api/teachers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: teacherName,
                subjectIds: teacherSubjectIds,
                years: teacherYears
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add teacher');
        }

        const newTeacher = await response.json();
        teachers.push(newTeacher);
        updateTeacherList();
        document.getElementById('teacherForm').reset();
        showMessage('teacherMessage', 'Teacher added successfully!', 'success');
        speak(`Teacher ${teacherName} added successfully!`);
        return true;
    } catch (error) {
        showMessage('teacherMessage', error.message, 'error');
        speak(error.message);
        return false;
    }
}

// Update teacher list
function updateTeacherList() {
    const list = document.getElementById('teacherList');
    list.innerHTML = teachers.map(teacher => `
<li class="teacher-item">
    <span>${teacher.name} - Teaching: ${teacher.subjects.map(s => s.name).join(', ')} - Years: ${teacher.years.map(year => getOrdinal(year)).join(', ')}</span>
    <button class="delete-btn" onclick="deleteTeacher(${teacher.id})">Delete</button>
</li>
`).join('');
}

// Delete teacher
async function deleteTeacher(id) {
    const teacherToDelete = teachers.find(teacher => teacher.id === id);
    if (confirm(`Are you sure you want to delete teacher: ${teacherToDelete.name}?`)) {
        try {
            const response = await fetch(`/api/teachers/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete teacher');
            }

            teachers = teachers.filter(teacher => teacher.id !== id);
            updateTeacherList();
            showMessage('teacherMessage', 'Teacher deleted successfully!', 'success');
            speak(`Teacher ${teacherToDelete.name} deleted successfully!`);
        } catch (error) {
            showMessage('teacherMessage', error.message, 'error');
            speak(error.message);
        }
    }
}

// Add class
async function addClass() {
    const classYearInput = document.getElementById('classYear');
    const classSectionInput = document.getElementById('classSection');
    const studentsCountInput = document.getElementById('studentsCount');

    const classYear = parseInt(classYearInput.value);
    const classSection = classSectionInput.value.trim();
    const studentsCount = parseInt(studentsCountInput.value);

    if (!classSection || isNaN(studentsCount) || isNaN(classYear)) {
        showMessage('classMessage', 'Please fill all fields correctly.', 'error');
        speak('Please fill all fields correctly for the class.');
        return false;
    }

    try {
        const response = await fetch('/api/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                year: classYear,
                section: classSection,
                studentsCount: studentsCount
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add class');
        }

        const newClass = await response.json();
        classes.push(newClass);
        updateClassList();
        document.getElementById('classForm').reset();
        showMessage('classMessage', 'Class added successfully!', 'success');
        speak(`Class ${getOrdinal(classYear)} Year, Section ${classSection} added successfully!`);
        return true;
    } catch (error) {
        showMessage('classMessage', error.message, 'error');
        speak(error.message);
        return false;
    }
}

// Update class list
function updateClassList() {
    const list = document.getElementById('classList');
    list.innerHTML = classes.map(cls => `
<li class="class-item">
    <span>${getOrdinal(cls.year)} Year - Section ${cls.section} (${cls.studentsCount} students)</span>
    <button class="delete-btn" onclick="deleteClass(${cls.id})">Delete</button>
</li>
`).join('');
}

// Delete class
async function deleteClass(id) {
    const classToDelete = classes.find(cls => cls.id === id);
    if (confirm(`Are you sure you want to delete class: ${getOrdinal(classToDelete.year)} Year - Section ${classToDelete.section}?`)) {
        try {
            const response = await fetch(`/api/classes/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete class');
            }

            classes = classes.filter(cls => cls.id !== id);
            updateClassList();
            showMessage('classMessage', 'Class deleted successfully!', 'success');
            speak(`Class ${getOrdinal(classToDelete.year)} Year, Section ${classToDelete.section} deleted successfully!`);
        } catch (error) {
            showMessage('classMessage', error.message, 'error');
            speak(error.message);
        }
    }
}

// Clear all data
async function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        try {
            const response = await fetch('/api/clear', {
                method: 'POST'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to clear data');
            }

            subjects = [];
            teachers = [];
            classes = [];
            updateSubjectList();
            updateTeacherList();
            updateTeacherSubjects();
            updateClassList();
            document.getElementById('timetableResult').innerHTML = '';
            showMessage('subjectMessage', 'All data cleared successfully!', 'success');
            speak('All data cleared successfully!');
        } catch (error) {
            showMessage('subjectMessage', error.message, 'error');
            speak(error.message);
        }
    }
}

// Generate timetable
async function generateTimetable() {
    if (subjects.length === 0 || teachers.length === 0 || classes.length === 0) {
        showMessage('timetableResult', 'Please add subjects, teachers, and classes first.', 'error');
        speak('Please add subjects, teachers, and classes first.');
        return;
    }

    try {
        const response = await fetch('/api/timetable/generate', {
            method: 'POST'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate timetable');
        }

        const timetableData = await response.json();
        renderTimetable(timetableData);
        speak('Timetable generated successfully!');
    } catch (error) {
        console.error('Error generating timetable:', error);
        showMessage('timetableResult', error.message, 'error');
        speak('Error generating timetable.');
    }
}

// Render the generated timetable
function renderTimetable(timetableData) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const timeSlots = [
        '9:00AM - 9:50AM', 
        '10:00AM - 10:50AM', 
        '11:00AM - 11:10AM',  // Break
        '11:10AM - 12:00PM', 
        '12:00PM - 12:50PM', 
        '12:50PM - 1:30PM',   // Lunch
        '1:30PM - 2:20PM', 
        '2:30PM - 3:20PM', 
        '3:30PM - 4:20PM'
    ];
    
    let html = '';
    const timetable = timetableData.timetable;
    const unscheduledInfo = timetableData.unscheduledInfo;
    
    // For each class, render its timetable
    Object.keys(timetable).forEach(classId => {
        const classData = timetable[classId];
        const classInfo = classData.classInfo;
        
        html += `<h3>Timetable for ${getOrdinal(classInfo.year)} Year - Section ${classInfo.section}</h3>`;
        html += `
<div class="timetable-wrapper">
    <table class="timetable">
        <tr>
            <th>Day/Hour</th>
            ${timeSlots.map(slot => {
                if (slot === '11:00AM - 11:10AM') {
                    return `<th style="background-color: lightgray;">11:00AM - 11:10AM</th>`;
                }
                if (slot === '12:50PM - 1:30PM') {
                    return `<th style="background-color: lightgray;">12:50PM - 1:30PM</th>`;
                }
                return `<th>${slot}</th>`;
            }).join('')}
        </tr>
`;

        days.forEach((day, dayIndex) => {
            html += `<tr><td><strong>${day}</strong></td>`;

            timeSlots.forEach(slot => {
                if (slot === '11:00AM - 11:10AM' && dayIndex === 0) {
                    // Merge Break cell across all 6 days
                    html += `<td rowspan="6" style="background-color: lightgray; text-align: center; font-weight: bold; font-size: 14px; padding: 32px; writing-mode: vertical-rl; text-orientation: upright;letter-spacing: 25px;">
BREAK
</td>
`;
                } else if (slot === '12:50PM - 1:30PM' && dayIndex === 0) {
                    // Merge Lunch cell across all 6 days
                    html += `<td rowspan="6" style="background-color: lightgray; text-align: center; font-weight: bold; font-size: 14px;padding:30px;writing-mode: vertical-rl; text-orientation: upright;letter-spacing: 25px;"> LUNCH</td>`;
                } else if (slot !== '11:00AM - 11:10AM' && slot !== '12:50PM - 1:30PM') {
                    const cell = classData.timetable[day][slot];
                    html += `
                    <td>
                        ${cell && cell.subject ? `<strong>${cell.subject.name}</strong><br>${cell.teacher.name}` : '-'}
                    </td>
                `;
                }
            });

            html += `</tr>`;
        });

        html += `</table></div>`;
        
        // Show warning if some subjects couldn't be scheduled for this class
        const classUnscheduled = Object.values(unscheduledInfo).filter(info => info.unscheduledHours > 0);
        if (classUnscheduled.length > 0) {
            html += `
            <div class="message error" style="display: block; margin-top: 1rem;">
                Warning: Could not schedule all hours. Remaining:
                ${classUnscheduled.map(info => `${info.name} (${info.unscheduledHours} hours)`).join(', ')}.
            </div>
`;
        }
    });

    document.getElementById('timetableResult').innerHTML = html;
}

// Show success/error messages
function showMessage(elementId, message, type) {
    const messageElement = document.getElementById(elementId);
    messageElement.textContent = message;
    messageElement.className = `message ${type}`;
    messageElement.style.display = 'block';
}

// Speak a message
function speak(text) {
    if (synth && text) {
        // Cancel any ongoing speech before starting a new one
        if (synth.speaking) {
            synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        synth.speak(utterance);
    }
}

// Start listening for voice commands
function startListening(formId) {
    if (recognition) {
        // Create a visual indicator for listening status if it doesn't exist
        let listeningStatusSpan = document.getElementById('listeningStatus');
        if (!listeningStatusSpan) {
            listeningStatusSpan = document.createElement('span');
            listeningStatusSpan.id = 'listeningStatus';
            document.body.appendChild(listeningStatusSpan);
        }

        recognition.onstart = function() {
            console.log('Speech recognition started.');
            listeningStatusSpan.textContent = 'Listening...';
            listeningStatusSpan.style.display = 'inline';
            listeningStatusSpan.style.color = 'red';
            listeningStatusSpan.style.fontWeight = 'bold';
            
            // Show a message to the user that we're listening
            showMessage(formId.replace('Form', 'Message'), 'Listening... Please speak now.', 'success');
            
            // Consider stopping speaking when listening starts
            if (synth.speaking) {
                synth.cancel();
            }
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript.trim();
            console.log('--- Recognized Speech Result ---');
            console.log('Transcript:', transcript);
            console.log('Confidence:', event.results[0][0].confidence);
            console.log('------------------------------');
            
            // Show what was recognized
            showMessage(formId.replace('Form', 'Message'), `Recognized: "${transcript}"`, 'success');
            
            // Process the command
            processVoiceCommand(transcript, formId);
        };

        recognition.onerror = function(event) {
            console.error('Speech Recognition Error:', event.error);
            listeningStatusSpan.textContent = '';
            listeningStatusSpan.style.display = 'none';

            if (event.error === 'no-speech') {
                showMessage(formId.replace('Form', 'Message'), 'No speech detected. Please try again.', 'error');
                speak('No speech detected. Please try again.');
            } else if (event.error === 'aborted') {
                console.log('Speech recognition aborted.');
            } else if (event.error === 'not-allowed') {
                showMessage(formId.replace('Form', 'Message'), 'Microphone permission denied. Please allow microphone access.', 'error');
                speak('Microphone permission denied. Please allow microphone access.');
            } else {
                showMessage(formId.replace('Form', 'Message'), `Voice input error: ${event.error}. Please try again.`, 'error');
                speak('Sorry, there was a voice input error. Please try again.');
            }
        };

        recognition.onend = function() {
            console.log('Speech recognition ended.');
            listeningStatusSpan.textContent = '';
            listeningStatusSpan.style.display = 'none';
        };

        // Stop any ongoing speech before starting to listen
        if (synth.speaking) {
            synth.cancel();
        }

        try {
            recognition.start();
            // Visual indicator is handled in onstart
        } catch (error) {
            console.error('Error starting speech recognition:', error);
            showMessage(formId.replace('Form', 'Message'), 'Speech recognition is already active or not supported.', 'error');
            speak('Speech recognition is not available or already active.');
        }
    } else {
        alert('Speech Recognition API is not supported in this browser.');
        speak('Speech Recognition is not supported in this browser.');
    }
}

// Process voice commands based on the current form
function processVoiceCommand(command, formId) {
    command = command.toLowerCase();

    // Global Commands
    if (command.includes('go to subjects') || command.includes('show subjects')) {
        showPanel('subjects');
        speak('Showing subjects panel.');
        return;
    }
    if (command.includes('go to teachers') || command.includes('show teachers')) {
        showPanel('teachers');
        speak('Showing teachers panel.');
        return;
    }
    if (command.includes('go to classes') || command.includes('show classes')) {
        showPanel('classes');
        speak('Showing classes panel.');
        return;
    }
    if (command.includes('go to generate') || command.includes('show generate') || command.includes('generate timetable')) {
        showPanel('generate');
        speak('Showing generate timetable panel.');
        if (command.includes('generate timetable')) {
            generateTimetable();
        }
        return;
    }
    if (command.includes('clear all data') || command.includes('reset data')) {
        clearAllData();
        return;
    }

    // Form-specific commands
    let commandRecognized = false;

    if (formId === 'subjectForm') {
        commandRecognized = processSubjectCommand(command);
    } else if (formId === 'teacherForm') {
        commandRecognized = processTeacherCommand(command);
    } else if (formId === 'classForm') {
        commandRecognized = processClassCommand(command);
    } else if (formId === 'generate') {
        if (command.includes('speak timetable') || command.includes('read timetable')) {
            speakTimetable();
            commandRecognized = true;
        } else if (command.includes('generate')) {
            generateTimetable();
            commandRecognized = true;
        }
    }
}

// Speak the generated timetable
function speakTimetable() {
    const timetableResultDivs = document.querySelectorAll('#timetableResult h3, #timetableResult table, #timetableResult .message');
    if (timetableResultDivs.length === 0) {
        speak('The timetable has not been generated yet.');
        return;
    }

    speak('Here is the generated timetable:');

    // Iterate through the elements and speak their text content
    timetableResultDivs.forEach(element => {
        let textToSpeak = element.innerText.trim();
        if (textToSpeak) {
            if (element.tagName === 'TABLE') {
                textToSpeak = textToSpeak.replace(/\s+/g, ' ').replace(/--/g, ' empty ');
            }
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.lang = 'en-US';
            synth.speak(utterance);
        }
    });
}

// Process voice commands for subjects, teachers, and classes
function processSubjectCommand(command) {
    const subjectNameInput = document.getElementById('subjectName');
    const subjectHoursInput = document.getElementById('subjectHours');
    const requiresLabInput = document.getElementById('requiresLab');
    const subjectPriorityInput = document.getElementById('subjectPriority');

    let subjectNameFound = null;
    let hoursFound = null;
    let requiresLabFound = null; // true, false, or null if not specified
    let priorityFound = null; // 1, 2, 3, or null if not specified

    // Look for "add subject" or similar intent
    const addSubjectIntent = command.match(/^(?:add|create)\s+subject\s+(.+)$/);
    if (addSubjectIntent) {
        command = addSubjectIntent[1].trim(); // Process the rest of the command
    } else {
        // If the command doesn't start with "add subject", check for key phrases
        if (!command.includes('subject') && !command.includes('hours') && !command.includes('lab') && !command.includes('priority')) {
            // If no relevant keywords are present, it's likely not a subject command
            return false;
        }
    }

    // Try to extract Subject Name
    const nameMatch = command.match(/^(?:subject\s+is\s+|name\s+is\s+)?(.+?)(?:\s+(?:\d+\s+hours|requires\s+lab|priority|hours|lab|priority)|$)/);
    if (nameMatch && nameMatch[1]) {
        subjectNameFound = nameMatch[1].trim();
        subjectNameInput.value = subjectNameFound;
    } else if (addSubjectIntent && addSubjectIntent[1]) {
        // If intent was found, maybe the whole remaining string is the name
        const potentialName = addSubjectIntent[1].trim();
        // Avoid setting simple numbers or single words that are clearly not names
        if (potentialName.split(/\s+/).length > 0 && !/^\d+$/.test(potentialName)) {
            subjectNameFound = potentialName;
            subjectNameInput.value = subjectNameFound;
        }
    }

    // Try to extract Hours
    const hoursMatch = command.match(/(\d+)\s+(?:hour|hours)/);
    if (hoursMatch && hoursMatch[1]) {
        hoursFound = parseInt(hoursMatch[1]);
        subjectHoursInput.value = hoursFound;
    }

    // Try to extract Lab requirement
    if (command.includes('requires lab') || command.includes('with lab') || command.includes('has lab') || command.includes('lab yes')) {
        requiresLabFound = true;
        requiresLabInput.checked = true;
    } else if (command.includes('no lab') || command.includes('without lab')) {
        requiresLabFound = false;
        requiresLabInput.checked = false;
    }

    // Try to extract Priority
    const priorityMatch = command.match(/(?:priority\s+is|set\s+priority\s+to)\s+(high|medium|low|\d)/);
    if (priorityMatch && priorityMatch[1]) {
        const priorityText = priorityMatch[1];
        if (priorityText === 'high' || priorityText === '1') {
            priorityFound = 1;
        } else if (priorityText === 'medium' || priorityText === '2') {
            priorityFound = 2;
        } else if (priorityText === 'low' || priorityText === '3') {
            priorityFound = 3;
        } else if (!isNaN(parseInt(priorityText))) {
            priorityFound = parseInt(priorityText);
            if (priorityFound < 1) priorityFound = 1;
            if (priorityFound > 3) priorityFound = 3;
        }
        subjectPriorityInput.value = priorityFound;
    }

    // Determine if we have enough information to attempt adding the subject
    if (subjectNameFound && (!isNaN(hoursFound) || requiresLabFound !== null || priorityFound !== null)) {
        // Attempt to add the subject. The addSubject function will validate all fields.
        const success = addSubject();
        return success; // Return true if addSubject was called
    } else if (command.includes('add subject')) {
        // If the user said "add subject" but we couldn't parse enough details
        let feedback = 'Okay, I heard "add subject", but I need more information. ';
        if (!subjectNameFound) feedback += 'Please say the subject name. ';
        if (isNaN(hoursFound)) feedback += 'How many hours per week? ';
        // Only ask about lab/priority if they weren't mentioned at all
        if (requiresLabFound === null && !command.includes('lab')) feedback += 'Does it require a lab? ';
        if (priorityFound === null && !command.includes('priority')) feedback += 'What is the priority? ';

        speak(feedback + 'Please try again.');
        return true; // Indicate that a relevant command was recognized, even if not fully processed
    }

    return false; // Command was not recognized as an add subject command
}

function processTeacherCommand(command) {
    const teacherNameInput = document.getElementById('teacherName');
    const teacherSubjectsSelect = document.getElementById('teacherSubjects');
    const teacherYearsSelect = document.getElementById('teacherYears');

    let teacherNameFound = null;
    let subjectNamesFound = [];
    let yearsFound = [];

    // Look for "add teacher" or similar intent
    const addTeacherIntent = command.match(/^(?:add|create)\s+teacher\s+(.+)$/);
    if (addTeacherIntent) {
        command = addTeacherIntent[1].trim(); // Process the rest of the command
    } else {
        // If the command doesn't start with "add teacher", check for key phrases
        if (!command.includes('teacher') && !command.includes('teaches') && !command.includes('years') && !command.includes('available for')) {
            return false;
        }
    }

    // Try to extract Teacher Name
    const nameMatch = command.match(/^(?:teacher\s+is\s+|name\s+is\s+)?(.+?)(?:\s+(?:teaches|teaching|available\s+for|years)|$)/);
    if (nameMatch && nameMatch[1]) {
        teacherNameFound = nameMatch[1].trim();
        teacherNameInput.value = teacherNameFound;
    } else if (addTeacherIntent && addTeacherIntent[1]) {
        const potentialName = addTeacherIntent[1].trim();
        if (potentialName.split(/\s+/).length > 0) {
            teacherNameFound = potentialName;
            teacherNameInput.value = teacherNameFound;
        }
    }

    // Try to extract Subjects Taught
    const teachesMatch = command.match(/(?:teaches|teaching)\s+(.+?)(?:\s+(?:available\s+for|years)|$)/);
    if (teachesMatch && teachesMatch[1]) {
        subjectNamesFound = teachesMatch[1].split(/ and |, /).map(s => s.trim()).filter(s => s);
        // Select subjects in the dropdown based on recognized names
        // Clear existing selections first
        Array.from(teacherSubjectsSelect.options).forEach(option => {
            option.selected = false;
        });
        // Select new ones
        Array.from(teacherSubjectsSelect.options).forEach(option => {
            if (subjectNamesFound.some(name => option.text.toLowerCase().includes(name.toLowerCase()))) {
                option.selected = true;
            }
        });
    }

    // Try to extract Available Years
    const yearsMatch = command.match(/(?:available for|years)\s+(.+)$/);
    if (yearsMatch && yearsMatch[1]) {
        const yearTexts = yearsMatch[1].split(/ and |, /).map(y => y.trim().toLowerCase()).filter(y => y);
        yearsFound = yearTexts.map(yearText => {
            if (yearText.includes('first') || yearText === '1st' || yearText === '1') return 1;
            if (yearText.includes('second') || yearText === '2nd' || yearText === '2') return 2;
            if (yearText.includes('third') || yearText === '3rd' || yearText === '3') return 3;
            if (yearText.includes('fourth') || yearText === '4th' || yearText === '4') return 4;
            return NaN;
        }).filter(year => !isNaN(year));

        // Select years in the dropdown
        // Clear existing selections first
        Array.from(teacherYearsSelect.options).forEach(option => {
            option.selected = false;
        });
        // Select new ones
        Array.from(teacherYearsSelect.options).forEach(option => {
            if (yearsFound.includes(parseInt(option.value))) {
                option.selected = true;
            }
        });
    }

    // Determine if we have enough information to attempt adding the teacher
    if (teacherNameFound && (subjectNamesFound.length > 0 || yearsFound.length > 0)) {
        const success = addTeacher();
        return success; // Return true if addTeacher was called
    } else if (command.includes('add teacher')) {
        let feedback = 'Okay, I heard "add teacher", but I need more information. ';
        if (!teacherNameFound) feedback += 'Please say the teacher\'s name. ';
        if (subjectNamesFound.length === 0 && !command.includes('teaches') && !command.includes('teaching')) feedback += 'What subjects do they teach? ';
        if (yearsFound.length === 0 && !command.includes('years') && !command.includes('available for')) feedback += 'What years are they available for? ';

        speak(feedback + 'Please try again.');
        return true; // Indicate that a relevant command was recognized
    }

    return false; // Command was not recognized as an add teacher command
}

function processClassCommand(command) {
    const classYearInput = document.getElementById('classYear');
    const classSectionInput = document.getElementById('classSection');
    const studentsCountInput = document.getElementById('studentsCount');

    let yearFound = null;
    let sectionFound = null;
    let studentsCountFound = null;

    // Look for "add class" or similar intent
    const addClassIntent = command.match(/^(?:add|create)\s+class\s+(.+)$/);
    if (addClassIntent) {
        command = addClassIntent[1].trim(); // Process the rest of the command
    } else {
        // If the command doesn't start with "add class", check for key phrases
        if (!command.includes('class') && !command.includes('year') && !command.includes('section') && !command.includes('students')) {
            return false;
        }
    }

    // Try to extract Year
    const yearMatch = command.match(/(?:year\s+is|year)\s+(first|second|third|fourth|1|2|3|4|1st|2nd|3rd|4th)/);
    if (yearMatch && yearMatch[1]) {
        const yearText = yearMatch[1].toLowerCase();
        if (yearText.includes('first') || yearText === '1st' || yearText === '1') yearFound = 1;
        else if (yearText.includes('second') || yearText === '2nd' || yearText === '2') yearFound = 2;
        else if (yearText.includes('third') || yearText === '3rd' || yearText === '3') yearFound = 3;
        else if (yearText.includes('fourth') || yearText === '4th' || yearText === '4') yearFound = 4;
        if (yearFound !== null) {
            classYearInput.value = yearFound;
        }
    } else if (addClassIntent) {
        // If intent was found, check the start of the remaining command for a year number
        const potentialYearMatch = command.match(/^(first|second|third|fourth|1|2|3|4|1st|2nd|3rd|4th)/);
        if (potentialYearMatch && potentialYearMatch[1]) {
            const yearText = potentialYearMatch[1].toLowerCase();
            if (yearText.includes('first') || yearText === '1st' || yearText === '1') yearFound = 1;
            else if (yearText.includes('second') || yearText === '2nd' || yearText === '2') yearFound = 2;
            else if (yearText.includes('third') || yearText === '3rd' || yearText === '3') yearFound = 3;
            else if (yearText.includes('fourth') || yearText === '4th' || yearText === '4') yearFound = 4;
            if (yearFound !== null) {
                classYearInput.value = yearFound;
            }
        }
    }

    // Try to extract Section
    const sectionMatch = command.match(/(?:section\s+is|section)\s+([a-zA-Z0-9]+)(?:\s+with|\s+students|$)/);
    if (sectionMatch && sectionMatch[1]) {
        sectionFound = sectionMatch[1].trim().toUpperCase(); // Assuming sections are uppercase
        classSectionInput.value = sectionFound;
    }

    // Try to extract Students Count
    const studentsMatch = command.match(/(\d+)\s+students/);
    if (studentsMatch && studentsMatch[1]) {
        studentsCountFound = parseInt(studentsMatch[1]);
        studentsCountInput.value = studentsCountFound;
    }

    // Determine if we have enough information to attempt adding the class
    if (yearFound !== null && sectionFound && studentsCountFound !== null) {
        const success = addClass();
        return success; // Return true if addClass was called
    } else if (command.includes('add class')) {
        let feedback = 'Okay, I heard "add class", but I need more information. ';
        if (yearFound === null && !command.includes('year')) feedback += 'Please say the year. ';
        if (!sectionFound && !command.includes('section')) feedback += 'Please say the section. ';
        if (studentsCountFound === null && !command.includes('students')) feedback += 'How many students? ';

        speak(feedback + 'Please try again.');
        return true; // Indicate that a relevant command was recognized
    }

    return false; // Command was not recognized as an add class command
}