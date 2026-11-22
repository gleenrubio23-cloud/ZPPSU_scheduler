-- Sample data. Run after schema.sql.
-- Default logins: admin / admin123, chair / chair123, faculty accounts / faculty123

INSERT INTO settings (name, value) VALUES
 ('w_degree','40'), ('w_skills','30'), ('w_cert','15'), ('w_experience','15');

INSERT INTO departments (id, code, name) VALUES
 (1,'CCS','College of Computer Studies'),
 (2,'CAS','College of Arts and Sciences');

INSERT INTO fields (id, name) VALUES
 (1,'Computer Science'), (2,'Information Technology'), (3,'Information Systems'),
 (4,'Mathematics'), (5,'Computer Engineering'), (6,'English / Communication'), (7,'Statistics');

INSERT INTO skills (id, name) VALUES
 (1,'Java Programming'), (2,'Python Programming'), (3,'Web Development (PHP)'),
 (4,'Database Management (SQL)'), (5,'Computer Networking'), (6,'Data Structures and Algorithms'),
 (7,'Statistics and Data Analysis'), (8,'Systems Analysis and Design'), (9,'Cybersecurity'),
 (10,'Technical Writing'), (11,'Calculus'), (12,'Mobile Development');

INSERT INTO users (id, username, password_hash, full_name, email, role, department_id) VALUES
 (1,'admin','$2b$10$iaSvrPuV15qLWEJb9tefAuquKSTaJSaoP8dGMNCgSbOP4bVQEGt6a','System Administrator','admin@school.edu','admin',NULL),
 (2,'chair','$2b$10$zmAIt9EUweVaXxDXqwRvVuJPxyxPvDz1fjIJRNWY5/CQLk8zvkZRi','Maria Santos','msantos@school.edu','chair',1),
 (3,'jcruz','$2b$10$2Rc1OagLslwL8wF6ARNR6Og/kHc4rzRE6X8IZu.Plr.6lqF0XpTZG','Juan Dela Cruz','jcruz@school.edu','faculty',1),
 (4,'areyes','$2b$10$2Rc1OagLslwL8wF6ARNR6Og/kHc4rzRE6X8IZu.Plr.6lqF0XpTZG','Ana Reyes','areyes@school.edu','faculty',1),
 (5,'rgarcia','$2b$10$2Rc1OagLslwL8wF6ARNR6Og/kHc4rzRE6X8IZu.Plr.6lqF0XpTZG','Roberto Garcia','rgarcia@school.edu','faculty',1),
 (6,'lmendoza','$2b$10$2Rc1OagLslwL8wF6ARNR6Og/kHc4rzRE6X8IZu.Plr.6lqF0XpTZG','Liza Mendoza','lmendoza@school.edu','faculty',2),
 (7,'pbautista','$2b$10$2Rc1OagLslwL8wF6ARNR6Og/kHc4rzRE6X8IZu.Plr.6lqF0XpTZG','Paolo Bautista','pbautista@school.edu','faculty',1);

INSERT INTO faculty_profiles (user_id, employee_no, employment_status, academic_rank, max_units, years_teaching, industry_years) VALUES
 (3,'F-2015-003','full_time','Assistant Professor',21,10,3),
 (4,'F-2018-011','full_time','Instructor III',21,7,2),
 (5,'F-2012-002','full_time','Associate Professor',18,13,5),
 (6,'F-2016-020','full_time','Assistant Professor',21,9,0),
 (7,'F-2023-031','part_time','Instructor I',9,2,6);

INSERT INTO faculty_degrees (faculty_id, level, title, field_id, institution, year_graduated, status, verified_by) VALUES
 (3,'bachelor','BS Computer Science',1,'State University',2012,'verified',2),
 (3,'master','MS Computer Science',1,'State University',2017,'verified',2),
 (4,'bachelor','BS Information Technology',2,'City College',2015,'verified',2),
 (4,'master','Master in Information Technology',2,'Technological University',2020,'verified',2),
 (5,'bachelor','BS Computer Engineering',5,'Polytechnic University',2008,'verified',2),
 (5,'master','MS Information Technology',2,'Polytechnic University',2012,'verified',2),
 (5,'doctorate','Doctor in Information Technology',2,'Technological University',2019,'verified',2),
 (6,'bachelor','BS Mathematics',4,'State University',2013,'verified',1),
 (6,'master','MS Applied Statistics',7,'State University',2018,'verified',1),
 (7,'bachelor','BS Information Systems',3,'City College',2017,'verified',2),
 (7,'master','Master in Information Systems',3,'City College',2025,'pending',NULL);

INSERT INTO faculty_skills (faculty_id, skill_id, proficiency) VALUES
 (3,1,5),(3,2,4),(3,6,5),(3,4,3),
 (4,3,5),(4,4,5),(4,8,4),(4,12,3),
 (5,5,5),(5,9,5),(5,4,3),(5,1,3),
 (6,7,5),(6,11,5),(6,2,3),
 (7,3,4),(7,12,5),(7,8,4),(7,4,4);

INSERT INTO faculty_certifications (faculty_id, name, issuer, year_obtained, skill_id, status, verified_by) VALUES
 (3,'Oracle Certified Professional: Java SE','Oracle',2019,1,'verified',2),
 (4,'MySQL Database Administrator','Oracle',2021,4,'verified',2),
 (5,'Cisco Certified Network Associate (CCNA)','Cisco',2016,5,'verified',2),
 (5,'CompTIA Security+','CompTIA',2020,9,'verified',2),
 (7,'Associate Android Developer','Google',2022,12,'pending',NULL);

INSERT INTO faculty_availability (faculty_id, day, start_time, end_time) VALUES
 (7,6,'07:00','18:00'), (7,5,'17:00','21:00');

INSERT INTO subjects (id, code, title, units, hours_per_week, department_id, min_degree_level, room_type) VALUES
 (1,'CC101','Introduction to Computing',3,3,1,'bachelor','lecture'),
 (2,'CC102','Computer Programming 1 (Java)',3,5,1,'bachelor','laboratory'),
 (3,'CC104','Data Structures and Algorithms',3,5,1,'master','laboratory'),
 (4,'IM101','Information Management (Database)',3,5,1,'bachelor','laboratory'),
 (5,'NET101','Networking 1',3,5,1,'master','laboratory'),
 (6,'WS101','Web Systems and Technologies',3,5,1,'bachelor','laboratory'),
 (7,'IAS101','Information Assurance and Security',3,3,1,'master','lecture'),
 (8,'MATH101','Calculus 1',3,3,2,'master','lecture'),
 (9,'STAT101','Statistics and Probability',3,3,2,'master','lecture'),
 (10,'SAD101','Systems Analysis and Design',3,3,1,'bachelor','lecture');

INSERT INTO subject_fields (subject_id, field_id) VALUES
 (1,1),(1,2),(1,3),(2,1),(2,2),(2,5),(3,1),(4,2),(4,3),(4,1),(5,2),(5,5),
 (6,2),(6,3),(7,2),(7,1),(8,4),(9,7),(9,4),(10,3),(10,2);

INSERT INTO subject_skills (subject_id, skill_id) VALUES
 (2,1),(3,6),(3,1),(4,4),(5,5),(6,3),(6,4),(7,9),(8,11),(9,7),(10,8);

INSERT INTO faculty_subjects_taught (faculty_id, subject_id, terms_taught) VALUES
 (3,2,6),(3,3,4),(4,4,5),(4,6,4),(5,5,8),(5,7,3),(6,8,6),(6,9,5),(7,6,1);

INSERT INTO rooms (id, name, building, capacity, type) VALUES
 (1,'Room 201','Main Building',45,'lecture'),
 (2,'Room 202','Main Building',45,'lecture'),
 (3,'Room 301','Main Building',50,'lecture'),
 (4,'ComLab 1','IT Building',40,'laboratory'),
 (5,'ComLab 2','IT Building',40,'laboratory');

INSERT INTO terms (id, school_year, semester, is_active) VALUES
 (1,'2026-2027','1st Semester',FALSE),
 (2,'2026-2027','2nd Semester',TRUE);

INSERT INTO sections (id, name, program, year_level, size, department_id) VALUES
 (1,'BSIT 1-A','BS Information Technology',1,40,1),
 (2,'BSIT 2-A','BS Information Technology',2,38,1),
 (3,'BSCS 1-A','BS Computer Science',1,35,1);

INSERT INTO offerings (id, term_id, subject_id, section_id, enrolled, faculty_id, match_score, assigned_by, assigned_at) VALUES
 (1,2,2,1,40,3,89.50,2,NOW()),
 (2,2,1,1,40,NULL,NULL,NULL,NULL),
 (3,2,4,2,38,NULL,NULL,NULL,NULL),
 (4,2,5,2,36,NULL,NULL,NULL,NULL),
 (5,2,3,3,35,NULL,NULL,NULL,NULL),
 (6,2,8,3,48,NULL,NULL,NULL,NULL),
 (7,2,6,2,38,NULL,NULL,NULL,NULL);

INSERT INTO schedules (offering_id, room_id, day, start_time, end_time) VALUES
 (1,4,1,'08:00','10:30'),
 (1,4,3,'08:00','10:30');

-- The rows above were inserted with fixed ids, so move each id counter past the largest id.
SELECT setval(pg_get_serial_sequence('departments', 'id'), (SELECT MAX(id) FROM departments));
SELECT setval(pg_get_serial_sequence('fields', 'id'), (SELECT MAX(id) FROM fields));
SELECT setval(pg_get_serial_sequence('skills', 'id'), (SELECT MAX(id) FROM skills));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('faculty_degrees', 'id'), (SELECT MAX(id) FROM faculty_degrees));
SELECT setval(pg_get_serial_sequence('faculty_certifications', 'id'), (SELECT MAX(id) FROM faculty_certifications));
SELECT setval(pg_get_serial_sequence('faculty_availability', 'id'), (SELECT MAX(id) FROM faculty_availability));
SELECT setval(pg_get_serial_sequence('subjects', 'id'), (SELECT MAX(id) FROM subjects));
SELECT setval(pg_get_serial_sequence('rooms', 'id'), (SELECT MAX(id) FROM rooms));
SELECT setval(pg_get_serial_sequence('terms', 'id'), (SELECT MAX(id) FROM terms));
SELECT setval(pg_get_serial_sequence('sections', 'id'), (SELECT MAX(id) FROM sections));
SELECT setval(pg_get_serial_sequence('offerings', 'id'), (SELECT MAX(id) FROM offerings));
SELECT setval(pg_get_serial_sequence('schedules', 'id'), (SELECT MAX(id) FROM schedules));
