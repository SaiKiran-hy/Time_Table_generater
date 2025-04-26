let subjects = [];
let teachers = [];
let classes = [];

// Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechSynthesis = window.speechSynthesis;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = SpeechSynthesis;

const listeningStatusSpan = document.getElementById('listeningStatus');

if (recognition) {
    recognition.continuous = false; // Listen for a single utterance
    recognition.lang = 'en-US';
    recognition.interimResults = false; // Don't show interim results
}

// Helper function to generate ordinal suffixes
function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Load data from localStorage when the page loads
document.addEventListener('DOMContentLoaded', function () {
    loadFromLocalStorage();
    updateSubjectList();
    updateTeacherList();
    updateTeacherSubjects();
    updateClassList();
    showPanel('subjects'); // Show subjects panel by default
});

// Load data from localStorage
function loadFromLocalStorage() {
    subjects = JSON.parse(localStorage.getItem('subjects')) || [];
    teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    classes = JSON.parse(localStorage.getItem('classes')) || [];
}

// Save data to localStorage
function saveToLocalStorage() {
    localStorage.setItem('subjects', JSON.stringify(subjects));
    localStorage.setItem('teachers', JSON.stringify(teachers));
    localStorage.setItem('classes', JSON.stringify(classes));
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
function addSubject() {
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
        return false; // Indicate failure
    }

    if (subjects.some(subject => subject.name.toLowerCase() === subjectName.toLowerCase())) {
        showMessage('subjectMessage', 'Subject already exists.', 'error');
        speak('Subject already exists.');
        return false; // Indicate failure
    }

    const subject = {
        id: Date.now(),
        name: subjectName,
        hours: subjectHours,
        requiresLab: requiresLab,
        priority: subjectPriority // This line sets the priority
    };
    subjects.push(subject);
    saveToLocalStorage();
    updateSubjectList();
    updateTeacherSubjects();
    document.getElementById('subjectForm').reset();
    showMessage('subjectMessage', 'Subject added successfully!', 'success');
    speak(`Subject ${subjectName} added successfully!`);
    return true; // Indicate success
}

// Update subject list - MODIFIED HERE
function updateSubjectList() {
    const list = document.getElementById('subjectList');
    list.innerHTML = subjects.map(subject => {
        // Determine the priority display text
        let priorityText = '';
        // Check if priority is a number and is within the expected range (1, 2, or 3)
        if (typeof subject.priority === 'number' && !isNaN(subject.priority)) {
            if (subject.priority === 1) {
                priorityText = 'High';
            } else if (subject.priority === 2) {
                priorityText = 'Medium';
            } else if (subject.priority === 3) {
                priorityText = 'Low';
            } else {
                 // If priority is a number but outside 1-3, show the number
                 priorityText = `Priority: ${subject.priority}`;
            }
             priorityText = ` (Priority: ${priorityText})`; // Format as (Priority: ...)
        }
        // If subject.priority is undefined, null, or not a number, priorityText remains ''

        return `
<li class="subject-item">
    <span>${subject.name} (${subject.hours}hrs) ${subject.requiresLab ? '- Lab Required' : ''}${priorityText}</span>
    <button class="delete-btn" onclick="deleteSubject(${subject.id})">Delete</button>
</li>
`;
    }).join('');
}

// Delete subject
function deleteSubject(id) {
    const subjectToDelete = subjects.find(subject => subject.id === id);
    if (confirm(`Are you sure you want to delete subject: ${subjectToDelete.name}?`)) {
        subjects = subjects.filter(subject => subject.id !== id);
        saveToLocalStorage();
        updateSubjectList();
        updateTeacherSubjects();
        showMessage('subjectMessage', 'Subject deleted successfully!', 'success');
        speak(`Subject ${subjectToDelete.name} deleted successfully!`);
    }
}

// Update teacher subjects dropdown
function updateTeacherSubjects() {
    const select = document.getElementById('teacherSubjects');
    select.innerHTML = subjects.map(subject =>
        `<option value="${subject.id}">${subject.name}</option>`
    ).join('');
}

// Add teacher
function addTeacher() {
    const teacherNameInput = document.getElementById('teacherName');
    const teacherSubjectsSelect = document.getElementById('teacherSubjects');
    const teacherYearsSelect = document.getElementById('teacherYears');

    const teacherName = teacherNameInput.value.trim();
    const teacherSubjectIds = Array.from(teacherSubjectsSelect.selectedOptions).map(option => parseInt(option.value));
    const teacherYears = Array.from(teacherYearsSelect.selectedOptions).map(option => parseInt(option.value));

    if (!teacherName || teacherSubjectIds.length === 0 || teacherYears.length === 0) {
        showMessage('teacherMessage', 'Please fill all fields correctly.', 'error');
        speak('Please fill all fields correctly for the teacher.');
        return false; // Indicate failure
    }

     if (teachers.some(teacher => teacher.name.toLowerCase() === teacherName.toLowerCase())) {
        showMessage('teacherMessage', 'Teacher already exists.', 'error');
        speak('Teacher already exists.');
        return false; // Indicate failure
    }

    const teacher = {
        id: Date.now(),
        name: teacherName,
        subjects: subjects.filter(subject => teacherSubjectIds.includes(subject.id)),
        years: teacherYears
    };

    teachers.push(teacher);
    saveToLocalStorage();
    updateTeacherList();
    document.getElementById('teacherForm').reset();
    showMessage('teacherMessage', 'Teacher added successfully!', 'success');
    speak(`Teacher ${teacherName} added successfully!`);
    return true; // Indicate success
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
function deleteTeacher(id) {
     const teacherToDelete = teachers.find(teacher => teacher.id === id);
      if (confirm(`Are you sure you want to delete teacher: ${teacherToDelete.name}?`)) {
        teachers = teachers.filter(teacher => teacher.id !== id);
        saveToLocalStorage();
        updateTeacherList();
        showMessage('teacherMessage', 'Teacher deleted successfully!', 'success');
        speak(`Teacher ${teacherToDelete.name} deleted successfully!`);
    }
}

// Add class
function addClass() {
    const classYearInput = document.getElementById('classYear');
    const classSectionInput = document.getElementById('classSection');
    const studentsCountInput = document.getElementById('studentsCount');

    const classYear = parseInt(classYearInput.value);
    const classSection = classSectionInput.value.trim();
    const studentsCount = parseInt(studentsCountInput.value);

    if (!classSection || isNaN(studentsCount) || isNaN(classYear)) { // Also check if year is a number
        showMessage('classMessage', 'Please fill all fields correctly.', 'error');
        speak('Please fill all fields correctly for the class.');
        return false; // Indicate failure
    }

    if (classes.some(cls => cls.year === classYear && cls.section.toLowerCase() === classSection.toLowerCase())) {
        showMessage('classMessage', 'Class already exists.', 'error');
        speak('Class already exists.');
        return false; // Indicate failure
    }

    const classSectionObj = {
        id: Date.now(),
        year: classYear,
        section: classSection,
        studentsCount: studentsCount
    };
    classes.push(classSectionObj);
    saveToLocalStorage();
    updateClassList(); // Call updateClassList to display the classes
    document.getElementById('classForm').reset();
    showMessage('classMessage', 'Class added successfully!', 'success');
    speak(`Class ${getOrdinal(classYear)} Year, Section ${classSection} added successfully!`);
    return true; // Indicate success
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
function deleteClass(id) {
     const classToDelete = classes.find(cls => cls.id === id);
     if (confirm(`Are you sure you want to delete class: ${getOrdinal(classToDelete.year)} Year - Section ${classToDelete.section}?`)) {
        classes = classes.filter(cls => cls.id !== id);
        saveToLocalStorage();
        updateClassList();
        showMessage('classMessage', 'Class deleted successfully!', 'success');
        speak(`Class ${getOrdinal(classToDelete.year)} Year, Section ${classToDelete.section} deleted successfully!`);
    }
}

// Add clear data functionality
function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
        localStorage.clear();
        subjects = [];
        teachers = [];
        classes = [];
        updateSubjectList();
        updateTeacherList();
        updateTeacherSubjects();
        updateClassList(); // Also update class list
        document.getElementById('timetableResult').innerHTML = '';
        showMessage('subjectMessage', 'All data cleared successfully!', 'success');
        speak('All data cleared successfully!');
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
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const timeSlots = ['9:00AM - 9:50AM', '10:00AM - 10:50AM', '11:00AM - 11:10AM', '11:10AM - 12:00PM', '12:00PM - 12:50PM', '12:50PM - 1:30PM', '1:30PM - 2:20PM', '2:30PM - 3:20PM', '3:30PM - 4:20PM'];

        // Initialize empty timetable for each class
        const schoolTimetable = {};
        classes.forEach(cls => {
            schoolTimetable[cls.id] = {};
             days.forEach(day => {
                schoolTimetable[cls.id][day] = {};
                timeSlots.forEach(slot => {
                    schoolTimetable[cls.id][day][slot] = null;
                });
            });
        });

        // Keep track of teacher availability
        const teacherAvailability = {};
        teachers.forEach(teacher => {
            teacherAvailability[teacher.id] = {};
            days.forEach(day => {
                timeSlots.forEach(slot => {
                    teacherAvailability[teacher.id][day] = teacherAvailability[teacher.id][day] || {};
                    teacherAvailability[teacher.id][day][slot] = true; // Initially available
                });
            });
        });

         // Track subject hours remaining for each class
        const classSubjectHours = {};
        classes.forEach(cls => {
            classSubjectHours[cls.id] = {};
            subjects.forEach(subject => {
                classSubjectHours[cls.id][subject.id] = subject.hours;
            });
        });


        // Simple scheduling algorithm (can be improved)
        classes.forEach(cls => {
            days.forEach(day => {
                timeSlots.forEach(slot => {
                     // Skip break and lunch slots for scheduling subjects/teachers
                    if (slot === '11:00AM - 11:10AM' || slot === '12:50PM - 1:30PM') {
                         // Assign Break and Lunch
                        schoolTimetable[cls.id][day][slot] = slot === '11:00AM - 11:10AM' ? 'Break' : 'Lunch';
                        return; // Move to the next slot
                    }

                    // Find a subject with remaining hours for this class
                    const availableSubjects = subjects.filter(subject =>
                        classSubjectHours[cls.id][subject.id] > 0
                    ).sort((a, b) => {
                        // Prioritize subjects with higher priority (lower value)
                        if (a.priority !== b.priority) {
                            return a.priority - b.priority;
                        }
                        // Then prioritize subjects with more remaining hours
                        return classSubjectHours[cls.id][b.id] - classSubjectHours[cls.id][a.id];
                    });

                    if (availableSubjects.length > 0) {
                        const subject = availableSubjects[0];

                        // Find an available teacher for this subject and class year
                        const availableTeacher = teachers.find(teacher =>
                            teacher.subjects.some(s => s.id === subject.id) &&
                            teacher.years.includes(cls.year) &&
                            teacherAvailability[teacher.id][day][slot]
                        );

                        if (availableTeacher) {
                            // Assign the subject and teacher to the timetable slot
                            schoolTimetable[cls.id][day][slot] = {
                                subject: subject,
                                teacher: availableTeacher
                            };

                            // Decrease remaining hours for the subject for this class
                            classSubjectHours[cls.id][subject.id]--;

                            // Mark the teacher as unavailable for this slot
                            teacherAvailability[availableTeacher.id][day][slot] = false;
                        }
                    }
                });
            });
        });


        renderTimetable(schoolTimetable, days, timeSlots, classSubjectHours);
         speak('Timetable generated successfully!');
    } catch (error) {
        console.error('Error generating timetable:', error);
        showMessage('timetableResult', 'Error generating timetable.', 'error');
        speak('Error generating timetable.');
    }
}

// Render the generated timetable
function renderTimetable(schoolTimetable, days, timeSlots, classSubjectHours) {
    let html = '';

    classes.forEach(cls => {
        html += `<h3>Timetable for ${getOrdinal(cls.year)} Year - Section ${cls.section}</h3>`;
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
                    const cell = schoolTimetable[cls.id][day][slot];
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
        const unscheduledSubjects = subjects.filter(subject =>
             // Check if there's any class that still needs this subject scheduled
             Object.values(classSubjectHours).some(hours => hours[subject.id] > 0)
        );

        if (unscheduledSubjects.length > 0 && !document.getElementById(`unscheduled-warning-${cls.id}`)) {
             // Only add the warning once per class if needed
            html += `
            <div id="unscheduled-warning-${cls.id}" class="message error" style="display: block; margin-top: 1rem;">
                Warning: Could not schedule all hours for ${getOrdinal(cls.year)} Year - Section ${cls.section}. Remaining:
                ${subjects.filter(subject => classSubjectHours[cls.id][subject.id] > 0)
                           .map(s => `${s.name} (${classSubjectHours[cls.id][s.id]} hours)`).join(', ')}.
            </div>
`;
        } else if (unscheduledSubjects.length === 0 && document.getElementById(`unscheduled-warning-${cls.id}`)) {
             // Remove warning if it exists and all subjects are scheduled for this class
             document.getElementById(`unscheduled-warning-${cls.id}`).style.display = 'none';
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
    // Don't auto-hide messages when using voice for potential debugging
    // setTimeout(() => {
    //     messageElement.style.display = 'none';
    // }, 3000);
}


// --- Voice Integration ---

// Speak a message
function speak(text) {
    if (synth && text) {
        // Cancel any ongoing speech before starting a new one
        if (synth.speaking) {
            synth.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        // Optional: Set voice
        // const voices = synth.getVoices();
        // utterance.voice = voices.find(voice => voice.name === '...'); // Find a preferred voice

        synth.speak(utterance);
    }
}

// Start listening for voice commands
function startListening(formId) {
    if (recognition) {
        recognition.onstart = function() {
            console.log('Speech recognition started.');
            listeningStatusSpan.textContent = 'Listening...';
            listeningStatusSpan.style.display = 'inline';
             // Consider stopping speaking when listening starts
             if (synth.speaking) {
                synth.cancel();
             }
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript.trim();
            console.log('--- Recognized Speech Result ---'); // Added marker
            console.log('Transcript:', transcript);       // Added label
            console.log('Confidence:', event.results[0][0].confidence); // Optional: See confidence
            console.log('------------------------------'); // Added marker
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
                  // This can happen if the user clicks away or the recognition is explicitly stopped
             }
             else if (event.error === 'not-allowed') {
                 showMessage(formId.replace('Form', 'Message'), 'Microphone permission denied. Please allow microphone access.', 'error');
                 speak('Microphone permission denied. Please allow microphone access.');
             }
             else {
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

    // --- Global Commands (should work from any panel) ---
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
        // Optionally trigger generation immediately if they say "generate timetable"
        if (command.includes('generate timetable')) {
             generateTimetable();
        }
        return;
     }
     if (command.includes('clear all data') || command.includes('reset data')) {
         clearAllData(); // clearAllData includes a confirmation, which is good
         return;
     }
     if (command.includes('stop listening')) {
         if (recognition && recognition.recognizing) {
             recognition.stop();
             speak('Listening stopped.');
         }
         return;
     }
      if (command.includes('speak instructions')) {
         // Trigger the speak instructions button for the current panel
         const speakButton = document.querySelector(`#${formId} .voice-controls button:nth-child(2)`);
         if (speakButton) {
             speakButton.click();
         } else {
             speak('No instructions available for this panel.');
         }
         return;
      }


    // --- Commands specific to the current form ---
    let commandRecognized = false; // Flag to check if a specific command was processed

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

    // If no specific command was recognized for the current panel
    if (!commandRecognized) {
         // You could provide a general "command not understood" message here,
         // but it might be annoying if the user just says something unrelated.
         // It's often better to stay silent or provide instructions again.
         // speak('Command not understood. Please try again or say speak instructions.');
    }
}

// Process voice commands for adding subjects
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
         // Now parse details from the remaining command string
    } else {
         // If the command doesn't start with "add subject", check for key phrases
         if (!command.includes('subject') && !command.includes('hours') && !command.includes('lab') && !command.includes('priority')) {
              // If no relevant keywords are present, it's likely not a subject command
              return false;
         }
    }


    // Try to extract Subject Name (anything after "subject" or at the start if intent was found)
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
    // We need at least a name and hours, or a name and explicit lab/priority setting
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


// Process voice commands for adding teachers
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
    // We need at least a name and subjects, or a name and years
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

// Process voice commands for adding classes
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
    // We need year, section, and student count
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


// Speak the generated timetable
function speakTimetable() {
    const timetableResultDivs = document.querySelectorAll('#timetableResult h3, #timetableResult table, #timetableResult .message');
    if (timetableResultDivs.length === 0) {
        speak('The timetable has not been generated yet.');
        return;
    }

     // Stop any ongoing speech before reading the timetable
     if (synth.speaking) {
        synth.cancel();
     }

    speak('Here is the generated timetable:');

    // Iterate through the elements and speak their text content
    let delay = 0; // Add slight delay between speaking elements
    timetableResultDivs.forEach(element => {
        let textToSpeak = element.innerText.trim();
         if (textToSpeak) {
             // Clean up table text for speaking (remove excessive whitespace/symbols)
             if (element.tagName === 'TABLE') {
                 // Replace multiple spaces/newlines with a single space for speaking
                 textToSpeak = textToSpeak.replace(/\s+/g, ' ').replace(/--/g, ' empty '); // Replace '--' with 'empty'
                 // Optional: Further parse table structure for better reading (e.g., "Monday 9:00 AM Math with Mr. Smith")
                 // This requires more complex parsing of the table HTML
             } else if (element.tagName === 'H3') {
                 textToSpeak = textToSpeak.replace('Timetable for', 'Timetable for'); // Just read the heading
             } else if (element.classList.contains('message')) {
                 textToSpeak = textToSpeak.replace('Warning:', 'Warning:'); // Read warning as is
             }


             const utterance = new SpeechSynthesisUtterance(textToSpeak);
             utterance.lang = 'en-US';
              // Adjust rate/pitch if needed
             // utterance.rate = 0.9;
             // utterance.pitch = 1.0;

             // Add a small delay before speaking this part
             utterance.addEventListener('start', () => {
                // You could use setTimeout here, but Event Listeners might chain better
             });

             synth.speak(utterance);
         }
    });

     // No direct way to know when the *last* utterance finishes in a loop like this
     // A more robust approach would involve queuing utterances and listening to the 'end' event of the last one.
     // For now, we'll just rely on the general flow.
}