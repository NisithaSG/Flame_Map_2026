import sqlite3
import json

#defining a connection and the cursor

connection = sqlite3.connect('flamemap.db')

cursor = connection.cursor()

#create courses table

courses_command = """CREATE TABLE IF NOT EXISTS
courses(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT UNIQUE NOT NULL,
    name TEXT,
    hours TEXT,
    prerequisites TEXT,
    description TEXT,
    prereq_parsed TEXT
)"""

degree_command = """CREATE TABLE IF NOT EXISTS
degrees(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    degree_id TEXT UNIQUE NOT NULL,
    name TEXT,
    total_hours NULL,
    type_of_degree TEXT,
    college TEXT
)"""

section_command = """CREATE TABLE IF NOT EXISTS
sections(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    degree_id TEXT REFERENCES degrees(degree_id),
    section_name TEXT,
    section_hours NULL,
    courses TEXT
)"""

cursor.execute(courses_command)
cursor.execute(degree_command)
cursor.execute(section_command)
connection.commit()

#check the table was created
#cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
#print(cursor.fetchall())
#cursor.execute("PRAGMA table_info(courses)")
#print(cursor.fetchall())

with open("courses.json", "r") as f: #opening courses.json
    courses = json.load(f)

with open("degrees.json", "r") as d:
    degrees = json.load(d)

#courses table
for course_id, data in courses.items():
    cursor.execute("""
    INSERT OR IGNORE INTO courses (course_id, name, hours, prerequisites, description, prereq_parsed)
    VALUES (?, ?, ?, ?, ?, ?)""", (
        course_id,
        data["name"],
        data["hours"],
        data["prerequisites"],
        data["description"],
        json.dumps(data["prereq_parsed"])  # convert dict to string for storage
    ))
print(f"Done: Inserted {len(courses)} courses.")
connection.commit()

#degrees table 
for degree_id, data in degrees.items():
    cursor.execute("""
    INSERT OR IGNORE INTO degrees (degree_id, name, total_hours, type_of_degree, college)
    VALUES (?, ?, ?, ?, ?)""", (
        degree_id,
        data["name"],
        data.get("total_hours", None), #since null for now
        data["type_of_degree"],
        data["college"],
    ))
print(f"Done: Inserted {len(degrees)} degrees.")
connection.commit()

#sections table
for degree_id, degree_data in degrees.items():
    for section_id, section_data in degree_data["sections"].items():
        cursor.execute("""
            INSERT OR IGNORE INTO sections (degree_id, section_name, section_hours, courses)
            VALUES (?, ?, ?, ?)
        """, (
            degree_id,
            section_data["section_name"],
            section_data.get("section_hours", None), #since null for now
            json.dumps(section_data["courses"])  # list → JSON string
        ))

print(f"Done: Inserted {len(degrees)} related sections.")
connection.commit()
# read it back
#cursor.execute("SELECT * FROM courses WHERE course_id = ?", ("CS 211",))
#print(cursor.fetchone())