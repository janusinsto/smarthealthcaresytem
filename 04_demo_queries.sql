USE smart_healthcare;
SELECT p.patient_code,p.full_name patient_name,a.appointment_datetime,a.status,u.full_name doctor_name FROM patients p JOIN appointments a ON a.patient_id=p.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id JOIN users u ON u.user_id=d.user_id;
SELECT status,COUNT(*) appointment_count FROM appointments GROUP BY status;
SELECT patient_id,patient_code,full_name FROM patients WHERE patient_id IN(SELECT patient_id FROM appointments GROUP BY patient_id HAVING COUNT(*)>0);
SELECT * FROM vw_appointment_details;
CALL sp_patient_appointment_history(1);
CALL sp_invoice_total(1);
