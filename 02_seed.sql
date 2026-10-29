USE smart_healthcare;
INSERT INTO roles VALUES(1,'Admin'),(2,'Doctor'),(3,'Staff');
INSERT INTO departments VALUES(1,'General Medicine'),(2,'Pediatrics'),(3,'Dental');
INSERT INTO medications VALUES(1,'Demo Medication A','Fictional sample'),(2,'Demo Medication B','Fictional sample'),(3,'Demo Medication C','Fictional sample');
INSERT INTO patients VALUES(1,'P-001','Alex Sample','2000-01-15','Unspecified','0000000000','Demo Address',CURRENT_TIMESTAMP),(2,'P-002','Jamie Sample','1998-06-20','Unspecified','0000000001','Demo Address',CURRENT_TIMESTAMP),(3,'P-003','Taylor Sample','2002-09-10','Unspecified','0000000002','Demo Address',CURRENT_TIMESTAMP);
