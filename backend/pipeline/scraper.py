import requests
from bs4 import BeautifulSoup
URL = "https://catalog.uic.edu/ucat/colleges-depts/engineering/cs/bs-data-science-computer-science/"
page = requests.get(URL)

print(page.text)
soup = BeautifulSoup(page.content, "html.parser")
courseList = soup.find_all("table", class_="sc_courselist")

# testing our soup
# print(soup.title.text)
# print(soup.find("h1").text)
# tables = soup.find_all("table")
# print(len(tables)) 

for table in courseList:
    courses = table.find_all("a", class_="bubblelink code")
    for course in courses:
        row = course.find_parent("tr")
        tds = row.find_all("td")

        course_name = tds[1].text.strip()
        numHours = tds[2].text.strip() if len(tds) > 2 else ""

        print(course["title"], course_name, numHours)
        
        


