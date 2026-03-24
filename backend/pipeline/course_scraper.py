import requests
from bs4 import BeautifulSoup
import time
import json

subjects = [
    "ASP",   # Academic Skills Program
    "ACTG",  # Accounting
    "ANAT",  # Anatomy and Cell Biology
    "ANTH",  # Anthropology
    "AHS",   # Applied Health Sciences
    "ARAB",  # Arabic
    "ARCH",  # Architecture
    "ART",   # Art
    "AH",    # Art History
    "BCMG",  # Biochemistry and Molecular Genetics
    "BIOS",  # Biological Sciences
    "BHIS",  # Biomedical and Health Information Sciences
    "BME",   # Biomedical Engineering
    "BPS",   # Biopharmaceutical Sciences
    "BSTT",  # Biostatistics
    "BLST",  # Black Studies
    "BA",    # Business Administration
    "CC",    # Campus Courses
    "CST",   # Catholic Studies
    "CEES",  # Central and Eastern European Studies
    "CHE",   # Chemical Engineering
    "CHEM",  # Chemistry
    "CHIN",  # Chinese
    "CME",   # Civil, Materials, and Environmental Engineering
    "CL",    # Classics
    "COMM",  # Communication
    "CHSC",  # Community Health Sciences
    "CS",    # Computer Science
    "CLJ",   # Criminology, Law, and Justice
    "CI",    # Curriculum and Instruction
    "DES",   # Design
    "DLG",   # Dialogue
    "DHD",   # Disability and Human Development
    "EAES",  # Earth and Environmental Sciences
    "ECON",  # Economics
    "ED",    # Education
    "EDPS",  # Educational Policy Studies
    "EPSY",  # Educational Psychology
    "ECE",   # Electrical and Computer Engineering
    "ENGR",  # Engineering
    "ENGL",  # English
    "ELSI",  # English Language and Support for Internationals
    "ENTR",  # Entrepreneurship
    "FIN",   # Finance
    "FR",    # French
    "GWS",   # Gender and Women's Studies
    "GEOG",  # Geography
    "GER",   # Germanic Studies
    "GLAS",  # Global Asian Studies
    "GKA",   # Greek, Ancient
    "GKM",   # Greek, Modern
    "GAMD",  # Guaranteed Admissions Medicine
    "HIM",   # Health Information Management
    "HEB",   # Hebrew
    "HNUR",  # Hindi-Urdu
    "HIST",  # History
    "HON",   # Honors College Courses
    "HN",    # Human Nutrition
    "HUM",   # Humanities
    "IE",    # Industrial Engineering
    "IDS",   # Information and Decision Sciences
    "IT",    # Information Technology
    "IDEA",  # Interdisciplinary Education in the Arts
    "IPHS",  # Interdisciplinary Public Health Sciences
    "ISA",   # Interdisciplinary Studies in the Arts
    "INST",  # International Studies
    "ITAL",  # Italian
    "JPN",   # Japanese
    "JST",   # Jewish Studies
    "KN",    # Kinesiology
    "KOR",   # Korean
    "LAT",   # Latin
    "LALS",  # Latin American and Latino Studies
    "LAS",   # Liberal Arts and Sciences
    "LIB",   # Library and Information Science
    "LING",  # Linguistics
    "LCSL",  # Literatures, Cultural Studies, and Linguistics
    "LITH",  # Lithuanian
    "MGMT",  # Management
    "MKTG",  # Marketing
    "MENG",  # Master of Engineering
    "MCS",   # Mathematical Computer Science
    "MATH",  # Mathematics
    "MTHT",  # Mathematics Teaching
    "ME",    # Mechanical Engineering
    "MIM",   # Microbiology and Immunology
    "MILS",  # Military Science
    "MOVI",  # Moving Image Arts
    "MUSE",  # Museum and Exhibition Studies
    "MUS",   # Music
    "NAST",  # Native American Studies
    "NATS",  # Natural Sciences
    "NS",    # Naval Science
    "NEUS",  # Neuroscience
    "NURS",  # Nursing Core
    "NUEL",  # Nursing Elective
    "OT",    # Occupational Therapy
    "PATH",  # Pathology
    "PSCI",  # Pharmaceutical Sciences
    "PCOL",  # Pharmacology
    "PHAR",  # Pharmacy
    "PMPR",  # Pharmacy Practice
    "PSOP",  # Pharmacy Systems, Outcomes, and Policy
    "PHIL",  # Philosophy
    "PT",    # Physical Therapy
    "PHYS",  # Physics
    "PHYB",  # Physiology and Biophysics
    "POL",   # Polish
    "POLS",  # Political Science
    "PORT",  # Portuguese
    "PSCH",  # Psychology
    "PA",    # Public Administration
    "PUBH",  # Public Health
    "PPOL",  # Public Policy
    "PPA",   # Public Policy Analysis
    "RES",   # Real Estate Studies
    "RELS",  # Religious Studies
    "RUSS",  # Russian
    "SLAV",  # Slavic and Baltic Languages and Literatures
    "SJ",    # Social Justice
    "SOC",   # Sociology
    "SPAN",  # Spanish
    "SPED",  # Special Education
    "STAT",  # Statistics
    "SABR",  # Study Abroad
    "THTR",  # Theatre
    "UPA",   # Urban and Public Affairs
    "UPP",   # Urban Planning and Policy
    "US",    # Urban Studies
]
coursesList = {  }

for subject in subjects:
    print(f"Scraping {subject}")
    url = f"https://catalog.uic.edu/ucat/course-descriptions/{subject.lower()}/"
    page = requests.get(url)
    soup = BeautifulSoup(page.content, "html.parser")
    
    for courseblock in soup.find_all("div", class_="courseblock"):
        title = courseblock.find("p", class_="courseblocktitle").text.strip()
        # "RES 450.  Real Estate Data Analysis.  3 or 4 hours. This format means that we haveto split the sentence by the period to get the individual information
        parts = title.split(".")  #split into list of strings divided by period
        course_id = parts[0].strip().replace("\u00a0", " ")   # "RES 450"
        name = parts[1].strip() # "Real Estate Data Analysis"
        hours = parts[2].strip().replace("hours", "").strip() # "3 or 4"
        
        desc = courseblock.find("p", class_="courseblockdesc").text.strip()
        prereqs = desc.split("Prerequisite(s):")[1].strip() if "Prerequisite(s):" in desc else ""  #Prerequisites are in description so split where found
        prereqs = prereqs.replace("\u00a0", " ")

        coursesList[course_id] = {
            "name" : name,
            "hours" : hours,
            "prerequisites" : prereqs,
            "description" : desc
        }
    time.sleep(1)

with open("courses.json", "w") as f:
    json.dump(coursesList, f, indent=2)

print(f"Done {len(coursesList)} courses saved.")

#for id, data in coursesList.items():
    #print(id, data)