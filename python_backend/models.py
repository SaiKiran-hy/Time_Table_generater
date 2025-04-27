from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import relationship
from datetime import datetime

db = SQLAlchemy()

# Association tables for many-to-many relationships
teacher_subject = db.Table('teacher_subject',
    db.Column('teacher_id', db.Integer, db.ForeignKey('teacher.id'), primary_key=True),
    db.Column('subject_id', db.Integer, db.ForeignKey('subject.id'), primary_key=True)
)

teacher_year = db.Table('teacher_year',
    db.Column('teacher_id', db.Integer, db.ForeignKey('teacher.id'), primary_key=True),
    db.Column('year', db.Integer, primary_key=True)
)

class Subject(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    hours = db.Column(db.Integer, nullable=False)
    requires_lab = db.Column(db.Boolean, default=False)
    priority = db.Column(db.Integer, default=2)  # 1=High, 2=Medium, 3=Low
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'hours': self.hours,
            'requiresLab': self.requires_lab,
            'priority': self.priority
        }

class Teacher(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Many-to-many relationship with subjects
    subjects = relationship('Subject', secondary=teacher_subject, lazy='subquery',
                           backref=db.backref('teachers', lazy=True))
    
    # Many-to-many relationship with years (stored as integers)
    years = db.Column(db.JSON, nullable=False, default=list)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'subjects': [subject.to_dict() for subject in self.subjects],
            'years': self.years
        }

class Class(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(20), nullable=False)
    students_count = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Unique constraint for year and section combination
    __table_args__ = (db.UniqueConstraint('year', 'section', name='_year_section_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'year': self.year,
            'section': self.section,
            'studentsCount': self.students_count
        }

# Timetable entry model to store generated timetables
class TimetableEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    class_id = db.Column(db.Integer, db.ForeignKey('class.id'), nullable=False)
    day = db.Column(db.String(20), nullable=False)
    time_slot = db.Column(db.String(30), nullable=False)
    subject_id = db.Column(db.Integer, db.ForeignKey('subject.id'), nullable=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('teacher.id'), nullable=True)
    is_break = db.Column(db.Boolean, default=False)
    
    # Relationships
    class_obj = relationship('Class', backref='timetable_entries')
    subject = relationship('Subject', backref='timetable_entries')
    teacher = relationship('Teacher', backref='timetable_entries')
    
    # Unique constraint for class, day, and time_slot
    __table_args__ = (db.UniqueConstraint('class_id', 'day', 'time_slot', name='_class_day_timeslot_uc'),)
    
    def to_dict(self):
        if self.is_break:
            return {
                'id': self.id,
                'day': self.day,
                'timeSlot': self.time_slot,
                'isBreak': True,
                'breakType': 'Break' if 'Break' in self.time_slot else 'Lunch'
            }
        
        return {
            'id': self.id,
            'day': self.day,
            'timeSlot': self.time_slot,
            'isBreak': False,
            'subject': self.subject.to_dict() if self.subject else None,
            'teacher': self.teacher.to_dict() if self.teacher else None
        }
