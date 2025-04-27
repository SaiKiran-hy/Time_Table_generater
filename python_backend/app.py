from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
import json
import random
import sqlite3
import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database setup
DB_PATH = 'timetable.db'

# Helper function to get database connection
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize database
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create subjects table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        hours INTEGER NOT NULL,
        requires_lab BOOLEAN NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 2,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create teachers table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create teacher_subject table (many-to-many)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teacher_subject (
        teacher_id INTEGER,
        subject_id INTEGER,
        PRIMARY KEY (teacher_id, subject_id),
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
    )
    ''')
    
    # Create teacher_year table (many-to-many)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS teacher_year (
        teacher_id INTEGER,
        year INTEGER,
        PRIMARY KEY (teacher_id, year),
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE CASCADE
    )
    ''')
    
    # Create classes table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        section TEXT NOT NULL,
        students_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, section)
    )
    ''')
    
    # Create timetable_entries table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS timetable_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL,
        day TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        subject_id INTEGER,
        teacher_id INTEGER,
        is_break BOOLEAN NOT NULL DEFAULT 0,
        UNIQUE(class_id, day, time_slot),
        FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL,
        FOREIGN KEY (teacher_id) REFERENCES teachers (id) ON DELETE SET NULL
    )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Routes for serving static files
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('static/css', filename)

@app.route('/static/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('static/js', filename)

# API Routes
@app.route('/api/subjects', methods=['GET', 'POST'])
def handle_subjects():
    if request.method == 'GET':
        conn = get_db_connection()
        subjects = conn.execute('SELECT * FROM subjects').fetchall()
        conn.close()
        
        result = []
        for subject in subjects:
            result.append({
                'id': subject['id'],
                'name': subject['name'],
                'hours': subject['hours'],
                'requiresLab': bool(subject['requires_lab']),
                'priority': subject['priority']
            })
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        
        conn = get_db_connection()
        # Check if subject already exists
        existing_subject = conn.execute('SELECT * FROM subjects WHERE name = ?', 
                                      (data['name'],)).fetchone()
        if existing_subject:
            conn.close()
            return jsonify({'error': 'Subject already exists'}), 400
        
        # Create new subject
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO subjects (name, hours, requires_lab, priority)
            VALUES (?, ?, ?, ?)
        ''', (data['name'], data['hours'], data.get('requiresLab', False), data.get('priority', 2)))
        
        # Get the ID of the newly created subject
        subject_id = cursor.lastrowid
        conn.commit()
        
        # Fetch the newly created subject
        new_subject = conn.execute('SELECT * FROM subjects WHERE id = ?', (subject_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'id': new_subject['id'],
            'name': new_subject['name'],
            'hours': new_subject['hours'],
            'requiresLab': bool(new_subject['requires_lab']),
            'priority': new_subject['priority']
        }), 201

@app.route('/api/subjects/<int:subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    conn = get_db_connection()
    
    # Check if subject exists
    subject = conn.execute('SELECT * FROM subjects WHERE id = ?', (subject_id,)).fetchone()
    if not subject:
        conn.close()
        return jsonify({'error': 'Subject not found'}), 404
    
    # Delete the subject
    conn.execute('DELETE FROM subjects WHERE id = ?', (subject_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Subject deleted successfully'}), 200

@app.route('/api/teachers', methods=['GET', 'POST'])
def handle_teachers():
    if request.method == 'GET':
        conn = get_db_connection()
        teachers = conn.execute('SELECT * FROM teachers').fetchall()
        result = []
        
        for teacher in teachers:
            teacher_id = teacher['id']
            
            # Get subjects for this teacher
            subjects_query = '''
                SELECT s.* FROM subjects s
                JOIN teacher_subject ts ON s.id = ts.subject_id
                WHERE ts.teacher_id = ?
            '''
            subjects = conn.execute(subjects_query, (teacher_id,)).fetchall()
            
            # Get years for this teacher
            years_query = 'SELECT year FROM teacher_year WHERE teacher_id = ?'
            years = [row['year'] for row in conn.execute(years_query, (teacher_id,)).fetchall()]
            
            # Build teacher object with subjects and years
            teacher_obj = {
                'id': teacher_id,
                'name': teacher['name'],
                'subjects': [{
                    'id': subject['id'],
                    'name': subject['name'],
                    'hours': subject['hours'],
                    'requiresLab': bool(subject['requires_lab']),
                    'priority': subject['priority']
                } for subject in subjects],
                'years': years
            }
            
            result.append(teacher_obj)
        
        conn.close()
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        conn = get_db_connection()
        
        # Check if teacher already exists
        existing_teacher = conn.execute('SELECT * FROM teachers WHERE name = ?', 
                                      (data['name'],)).fetchone()
        if existing_teacher:
            conn.close()
            return jsonify({'error': 'Teacher already exists'}), 400
        
        # Create new teacher
        cursor = conn.cursor()
        cursor.execute('INSERT INTO teachers (name) VALUES (?)', (data['name'],))
        teacher_id = cursor.lastrowid
        
        # Add subject relationships
        subject_ids = data.get('subjectIds', [])
        print(f"Adding subject relationships for teacher {teacher_id}: {subject_ids}")
        for subject_id in subject_ids:
            cursor.execute('INSERT INTO teacher_subject (teacher_id, subject_id) VALUES (?, ?)',
                         (teacher_id, subject_id))
        
        # Add year relationships
        years = data.get('years', [])
        for year in years:
            cursor.execute('INSERT INTO teacher_year (teacher_id, year) VALUES (?, ?)',
                         (teacher_id, year))
        
        conn.commit()
        
        # Fetch the newly created teacher with relationships
        teacher = conn.execute('SELECT * FROM teachers WHERE id = ?', (teacher_id,)).fetchone()
        
        # Get subjects for this teacher
        subjects_query = '''
            SELECT s.* FROM subjects s
            JOIN teacher_subject ts ON s.id = ts.subject_id
            WHERE ts.teacher_id = ?
        '''
        subjects = conn.execute(subjects_query, (teacher_id,)).fetchall()
        
        # Get years for this teacher
        years_query = 'SELECT year FROM teacher_year WHERE teacher_id = ?'
        years = [row['year'] for row in conn.execute(years_query, (teacher_id,)).fetchall()]
        
        conn.close()
        
        return jsonify({
            'id': teacher_id,
            'name': teacher['name'],
            'subjects': [{
                'id': subject['id'],
                'name': subject['name'],
                'hours': subject['hours'],
                'requiresLab': bool(subject['requires_lab']),
                'priority': subject['priority']
            } for subject in subjects],
            'years': years
        }), 201

@app.route('/api/teachers/<int:teacher_id>', methods=['DELETE'])
def delete_teacher(teacher_id):
    conn = get_db_connection()
    
    # Check if teacher exists
    teacher = conn.execute('SELECT * FROM teachers WHERE id = ?', (teacher_id,)).fetchone()
    if not teacher:
        conn.close()
        return jsonify({'error': 'Teacher not found'}), 404
    
    # Delete the teacher (cascade will handle relationships due to foreign key constraints)
    conn.execute('DELETE FROM teachers WHERE id = ?', (teacher_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Teacher deleted successfully'}), 200

@app.route('/api/classes', methods=['GET', 'POST'])
def handle_classes():
    if request.method == 'GET':
        conn = get_db_connection()
        classes = conn.execute('SELECT * FROM classes').fetchall()
        conn.close()
        
        result = []
        for class_obj in classes:
            result.append({
                'id': class_obj['id'],
                'year': class_obj['year'],
                'section': class_obj['section'],
                'studentsCount': class_obj['students_count']
            })
        return jsonify(result)
    
    elif request.method == 'POST':
        data = request.json
        conn = get_db_connection()
        
        # Check if class already exists
        existing_class = conn.execute(
            'SELECT * FROM classes WHERE year = ? AND section = ?', 
            (data['year'], data['section'])
        ).fetchone()
        
        if existing_class:
            conn.close()
            return jsonify({'error': 'Class already exists'}), 400
        
        # Create new class
        cursor = conn.cursor()
        print(f"Creating class: Year={data['year']}, Section={data['section']}, Students={data['studentsCount']}")
        cursor.execute('''
            INSERT INTO classes (year, section, students_count)
            VALUES (?, ?, ?)
        ''', (data['year'], data['section'], data['studentsCount']))
        
        # Get the ID of the newly created class
        class_id = cursor.lastrowid
        conn.commit()
        
        # Fetch the newly created class
        new_class = conn.execute('SELECT * FROM classes WHERE id = ?', (class_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'id': new_class['id'],
            'year': new_class['year'],
            'section': new_class['section'],
            'studentsCount': new_class['students_count']
        }), 201

@app.route('/api/classes/<int:class_id>', methods=['DELETE'])
def delete_class(class_id):
    conn = get_db_connection()
    
    # Check if class exists
    class_obj = conn.execute('SELECT * FROM classes WHERE id = ?', (class_id,)).fetchone()
    if not class_obj:
        conn.close()
        return jsonify({'error': 'Class not found'}), 404
    
    # Delete the class
    conn.execute('DELETE FROM classes WHERE id = ?', (class_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Class deleted successfully'}), 200

@app.route('/api/timetable/generate', methods=['POST'])
def generate_timetable():
    conn = get_db_connection()
    
    # Clear any existing timetable entries
    conn.execute('DELETE FROM timetable_entries')
    conn.commit()
    
    # Get all subjects, teachers, and classes
    subjects = conn.execute('SELECT * FROM subjects').fetchall()
    classes = conn.execute('SELECT * FROM classes').fetchall()
    
    # Get teachers with their subjects and years
    teachers = []
    teacher_rows = conn.execute('SELECT * FROM teachers').fetchall()
    
    for teacher in teacher_rows:
        teacher_id = teacher['id']
        
        # Get subjects for this teacher
        subjects_query = '''
            SELECT s.* FROM subjects s
            JOIN teacher_subject ts ON s.id = ts.subject_id
            WHERE ts.teacher_id = ?
        '''
        teacher_subjects = conn.execute(subjects_query, (teacher_id,)).fetchall()
        
        # Get years for this teacher
        years_query = 'SELECT year FROM teacher_year WHERE teacher_id = ?'
        teacher_years = [row['year'] for row in conn.execute(years_query, (teacher_id,)).fetchall()]
        
        teachers.append({
            'id': teacher_id,
            'name': teacher['name'],
            'subjects': teacher_subjects,
            'years': teacher_years
        })
    
    # Check if we have all required data
    if not subjects or not teachers or not classes:
        conn.close()
        return jsonify({'error': 'Please add subjects, teachers, and classes first'}), 400
    
    # Define days and time slots
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    time_slots = [
        '9:00AM - 9:50AM', 
        '10:00AM - 10:50AM', 
        '11:00AM - 11:10AM',  # Break
        '11:10AM - 12:00PM', 
        '12:00PM - 12:50PM', 
        '12:50PM - 1:30PM',   # Lunch
        '1:30PM - 2:20PM', 
        '2:30PM - 3:20PM', 
        '3:30PM - 4:20PM'
    ]
    
    # Track subject hours remaining for each class
    class_subject_hours = {}
    for class_obj in classes:
        class_subject_hours[class_obj['id']] = {}
        for subject in subjects:
            class_subject_hours[class_obj['id']][subject['id']] = subject['hours']
    
    # Track teacher availability
    teacher_availability = {}
    for teacher in teachers:
        teacher_availability[teacher['id']] = {}
        for day in days:
            teacher_availability[teacher['id']][day] = {}
            for slot in time_slots:
                teacher_availability[teacher['id']][day][slot] = True
    
    # First, add break and lunch slots for all classes
    for class_obj in classes:
        for day in days:
            # Add break slot
            conn.execute('''
                INSERT INTO timetable_entries (class_id, day, time_slot, is_break)
                VALUES (?, ?, ?, ?)
            ''', (class_obj['id'], day, '11:00AM - 11:10AM', True))
            
            # Add lunch slot
            conn.execute('''
                INSERT INTO timetable_entries (class_id, day, time_slot, is_break)
                VALUES (?, ?, ?, ?)
            ''', (class_obj['id'], day, '12:50PM - 1:30PM', True))
    
    # Now schedule subjects for each class
    for class_obj in classes:
        for day in days:
            for slot in time_slots:
                # Skip break and lunch slots
                if slot in ['11:00AM - 11:10AM', '12:50PM - 1:30PM']:
                    continue
                
                # Find subjects with remaining hours for this class, sorted by priority
                available_subjects = [
                    subject for subject in subjects 
                    if class_subject_hours[class_obj['id']][subject['id']] > 0
                ]
                
                # Sort by priority (lower number = higher priority)
                available_subjects.sort(key=lambda s: (s['priority'], -class_subject_hours[class_obj['id']][s['id']]))
                
                if available_subjects:
                    subject = available_subjects[0]
                    
                    # Find an available teacher for this subject and class year
                    available_teachers = [
                        teacher for teacher in teachers
                        if any(s['id'] == subject['id'] for s in teacher['subjects'])
                        and class_obj['year'] in teacher['years']
                        and teacher_availability[teacher['id']][day][slot]
                    ]
                    
                    if available_teachers:
                        # Choose a teacher (you could implement more sophisticated selection)
                        teacher = available_teachers[0]
                        
                        # Create timetable entry
                        conn.execute('''
                            INSERT INTO timetable_entries (class_id, day, time_slot, subject_id, teacher_id, is_break)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', (class_obj['id'], day, slot, subject['id'], teacher['id'], False))
                        
                        # Update remaining hours and teacher availability
                        class_subject_hours[class_obj['id']][subject['id']] -= 1
                        teacher_availability[teacher['id']][day][slot] = False
    
    # Commit all changes to the database
    conn.commit()
    conn.close()
    
    # Return the generated timetable
    return get_timetable()

@app.route('/api/timetable', methods=['GET'])
def get_timetable():
    conn = get_db_connection()
    
    # Get all classes
    classes = conn.execute('SELECT * FROM classes').fetchall()
    
    # Define days and time slots
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    time_slots = [
        '9:00AM - 9:50AM', 
        '10:00AM - 10:50AM', 
        '11:00AM - 11:10AM',  # Break
        '11:10AM - 12:00PM', 
        '12:00PM - 12:50PM', 
        '12:50PM - 1:30PM',   # Lunch
        '1:30PM - 2:20PM', 
        '2:30PM - 3:20PM', 
        '3:30PM - 4:20PM'
    ]
    
    # Prepare the response
    timetable_data = {}
    
    for class_obj in classes:
        class_id = class_obj['id']
        timetable_data[class_id] = {
            'classInfo': {
                'id': class_obj['id'],
                'year': class_obj['year'],
                'section': class_obj['section'],
                'studentsCount': class_obj['students_count']
            },
            'timetable': {}
        }
        
        # Initialize empty timetable for this class
        for day in days:
            timetable_data[class_id]['timetable'][day] = {}
            for slot in time_slots:
                timetable_data[class_id]['timetable'][day][slot] = None
        
        # Get all timetable entries for this class
        entries = conn.execute(
            'SELECT * FROM timetable_entries WHERE class_id = ?', 
            (class_id,)
        ).fetchall()
        
        # Fill in the timetable
        for entry in entries:
            if entry['is_break']:
                timetable_data[class_id]['timetable'][entry['day']][entry['time_slot']] = {
                    'isBreak': True,
                    'breakType': 'Break' if '11:00AM' in entry['time_slot'] else 'Lunch'
                }
            else:
                # Get subject details
                subject = None
                if entry['subject_id']:
                    subject_data = conn.execute(
                        'SELECT * FROM subjects WHERE id = ?', 
                        (entry['subject_id'],)
                    ).fetchone()
                    if subject_data:
                        subject = {
                            'id': subject_data['id'],
                            'name': subject_data['name'],
                            'hours': subject_data['hours'],
                            'requiresLab': bool(subject_data['requires_lab']),
                            'priority': subject_data['priority']
                        }
                
                # Get teacher details
                teacher = None
                if entry['teacher_id']:
                    teacher_data = conn.execute(
                        'SELECT * FROM teachers WHERE id = ?', 
                        (entry['teacher_id'],)
                    ).fetchone()
                    if teacher_data:
                        # Get teacher subjects
                        subjects_query = '''
                            SELECT s.* FROM subjects s
                            JOIN teacher_subject ts ON s.id = ts.subject_id
                            WHERE ts.teacher_id = ?
                        '''
                        teacher_subjects = conn.execute(subjects_query, (teacher_data['id'],)).fetchall()
                        
                        # Get teacher years
                        years_query = 'SELECT year FROM teacher_year WHERE teacher_id = ?'
                        teacher_years = [row['year'] for row in conn.execute(years_query, (teacher_data['id'],)).fetchall()]
                        
                        teacher = {
                            'id': teacher_data['id'],
                            'name': teacher_data['name'],
                            'subjects': [{
                                'id': s['id'],
                                'name': s['name'],
                                'hours': s['hours'],
                                'requiresLab': bool(s['requires_lab']),
                                'priority': s['priority']
                            } for s in teacher_subjects],
                            'years': teacher_years
                        }
                
                timetable_data[class_id]['timetable'][entry['day']][entry['time_slot']] = {
                    'subject': subject,
                    'teacher': teacher
                }
    
    # Check for unscheduled subjects
    unscheduled_info = {}
    
    # Get all subjects with their total hours
    subjects = conn.execute('SELECT * FROM subjects').fetchall()
    class_count = len(classes)
    subject_total_hours = {subject['id']: subject['hours'] * class_count for subject in subjects}
    
    # Count scheduled hours
    scheduled_hours = {}
    scheduled_entries = conn.execute(
        'SELECT subject_id, COUNT(*) as count FROM timetable_entries WHERE is_break = 0 AND subject_id IS NOT NULL GROUP BY subject_id'
    ).fetchall()
    
    for entry in scheduled_entries:
        scheduled_hours[entry['subject_id']] = entry['count']
    
    # Calculate unscheduled hours
    for subject in subjects:
        subject_id = subject['id']
        scheduled = scheduled_hours.get(subject_id, 0)
        total = subject_total_hours.get(subject_id, 0)
        if scheduled < total:
            unscheduled_info[subject_id] = {
                'name': subject['name'],
                'unscheduledHours': total - scheduled
            }
    
    conn.close()
    
    return jsonify({
        'timetable': timetable_data,
        'unscheduledInfo': unscheduled_info
    })

@app.route('/api/clear', methods=['POST'])
def clear_data():
    # Delete all data from the database
    conn = get_db_connection()
    
    # Delete in order to respect foreign key constraints
    conn.execute('DELETE FROM timetable_entries')
    conn.execute('DELETE FROM teacher_subject')
    conn.execute('DELETE FROM teacher_year')
    conn.execute('DELETE FROM teachers')
    conn.execute('DELETE FROM subjects')
    conn.execute('DELETE FROM classes')
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'All data cleared successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
