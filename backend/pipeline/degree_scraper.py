import requests
from bs4 import BeautifulSoup
import time
import json

URL = "https://catalog.uic.edu/ucat/degree-programs/degree-minors/"
page = requests.get(URL)
soup = BeautifulSoup(page.content, "html.parser")

degree_urls = []
table = soup.find("table", class_="sc_degreeinfo")
for link in table.find_all("a"):
    href = link.get("href", "")
    if href.startswith("/ucat/colleges-depts/"):
        full_url = "https://catalog.uic.edu" + href
        degree_urls.append(full_url)
print(f"Found {len(degree_urls)} degree pages")


degree_option_list = {}

#all the degrees offered (240 for now)
for degree in degree_urls:
    url = degree
    degree_page = requests.get(url)
    degree_soup = BeautifulSoup(degree_page.content, "html.parser")
    
    sections = {} #sections
    name = degree_soup.find("h1").text.strip()   #name 
    degree_id = url.rstrip("/").split("/colleges-depts/")[-1].replace("/", "-")  #degree ID

    print(f"Scraping {degree_id}")

    breadcrumbs = degree_soup.select("#breadcrumb a")
    college = breadcrumbs[3].text.strip() if len(breadcrumbs) > 3 else ""  #the college of the degree is always 4th item in URL

    #type of degree logic
    degree_type = ""
    if "minor" in name.lower():
        degree_type = "minor"
    elif "bs" in name.lower() or "ba" in name.lower():
        degree_type = "undergraduate"
    else:
        degree_type = "other"
    
    #each table inside the pages (Gen Eds, Degree Requirements, Concentrations)
    for h3 in degree_soup.find_all("h3"):
        section_name = h3.text.strip()
        section_id = section_name.lower().replace(" ", "-")
        next_table = h3.find_next_sibling("table", class_="sc_courselist")
        if not next_table:
            continue  
        courses = next_table.find_all("a", class_="bubblelink code")
        degree_courses = []

        #Building the list of courses in each sections
        for course in courses:
            row = course.find_parent("tr")
            tds = row.find_all("td")
            degree_courses.append(course["title"].replace("\u00a0", " "))

        sections[section_id] = {
            "section_name": section_name,
            "section_hours" : None,
            "courses": degree_courses
        }
        
    degree_option_list[degree_id] = {
        "name" : name,
        "type_of_degree" : degree_type,
        "college" : college,
        "sections" :  sections
        }
    
    time.sleep(1)

with open("degrees.json", "w") as f:
    json.dump(degree_option_list, f, indent=2)

print(f"Done {len(degree_option_list)} degrees saved.")


        