CREATE DATABASE counterDB;

CREATE TABLE user_details (uid SERIAL PRIMARY KEY, name VARCHAR(30), password VARCHAR(30), address VARCHAR(50), mobile VARCHAR(10), email varchar(40));

CREATE TABLE user_role_management(rid SERIAL, uid INT , ADMIN_ID INT, ROLE VARCHAR(10),FOREIGN KEY (UID) REFERENCES user_details (uid), FOREIGN KEY (admin_id) REFERENCES user_details (uid), primary key (rid, uid));

INSERT INTO user_details (name, password, email) values ('admin',  'admin', 'admin@mail.com');
insert into user_role_management values (1, 1, 1, 'admin');

CREATE TABLE device (
	device_id VARCHAR(20), 
	LOGITUDE VARCHAR(20), 
	LATITUDE VARCHAR(20), 
	name VARCHAR(50), 
	PRIMARY KEY (device_id)
);


CREATE TABLE DEVICE_MANAGEMENT(
	UID INT, 
	DEVICE_ID VARCHAR(20), 
	ACCESS BOOLEAN, 
	PRIMARY KEY(UID, DEVICE_ID), 
	FOREIGN KEY (UID) REFERENCES user_details (uid), 
	FOREIGN KEY (device_id) REFERENCES device (device_id)
);



CREATE TABLE DEVICE_VALUES (
  id SERIAL PRIMARY KEY,
  mac_address VARCHAR(17) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  count INTEGER NOT NULL,
  FOREIGN KEY (mac_address) REFERENCES DEVICE (device_id)
);



CREATE TABLE DEVICE_PARAMS(
  mac_address VARCHAR(17) NOT NULL,
  MIN_VALUE INT,
  MAX_VALUE INT,
  FOREIGN KEY (mac_address) REFERENCES DEVICE (device_id)	 
);


-- Sample data insert command for device_values relation
INSERT INTO 
	device_values(mac_address, timestamp, count) 
	VALUES('B0:B2:1C:42:BC:9C', NOW(), 5)
;

-- Sample data insert command for device_params relation
INSERT INTO 
	DEVICE_PARAMS(mac_address, MIN, MAX) 
	VALUES('B0:B2:1C:42:BC:9C', 0, 1000)
;