const express = require("express")
const app = express();
const cors = require("cors");
const pool = require("./dbConnect")
const jwt = require('jsonwebtoken')

const secretKey = process.env.AUTH_KEY;

let port = "4001";

app.use(cors())
app.use(express.json())

// Middleware to authenticate JWT tokens
const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.sendStatus(401);

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};


app.get("/api/test", async (req, res) => {
    let msg = [{ success: "Successful API request" }, { failure: "Failed API request!" }]
    try {
        return res.status(200).send("Hello")
    } catch (err) {
        return res.sendStatus(500)
    }
})

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body
        const result = await pool.query("SELECT uid FROM user_details WHERE email=($1) AND password=($2)", [email, password])
        const user = result.rows[0];
        if (user) {
            if (email == "admin@mail.com")
                result.rows[0].type = "admin"
            const token = jwt.sign({ id: user.uid, useremail: email }, secretKey);
            return res.status(200).json({"token" : token, "type": result.rows[0].type, "uid": result.rows[0].uid})
        }
        return res.sendStatus(404);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
})

app.get('/api/authenticate', authenticateJWT, (req, res) => {
    res.status(200).json({ message: true });
});

app.post("/api/add-tenant-user", async (req, res) => {
    try {
        const { name, email, password, address, company, mobile, adminid, role = "user" } = req.body;
        // Should add company, date_of_register
        const result = await pool.query("SELECT name FROM user_details WHERE email=($1)", [email])
        const userQuery = "select role from user_role_management where uid=($1)"
        const managerQuery = userQuery + " and role ='admin';"
        const value = [adminid]

        const typeChecker = role === "manager" ? await pool.query(managerQuery, value) : await pool.query(userQuery, value)

        if(typeChecker.rowCount <= 0){
            return res.status(300).json({ accessDenied: "Sorry you cannot add this type of user" }); 
        }
        const adderType = typeChecker.rows[0].role
        console.log("Adder Type: ", adderType);

        if (result.rowCount > 0) {
            return res.status(300).json({ emailExist: "Email already exists!!" });
        } else {
            if(adderType === "admin" || (adderType === "manager" && role === "user")){

                //     Insert Statement for adding tenant and user
                const result2 = await pool.query("INSERT INTO user_details(name, email, password, address, mobile) VALUES ($1, $2, $3, $4, $5) RETURNING uid", [name, email, password, address, mobile]);
                
                const result3 = await pool.query("INSERT INTO user_role_management(uid, admin_id, role) VALUES($1, $2, $3)", [result2.rows[0].uid, adminid, role])
                
                return res.status(200).json({ uid: result2.rows[0].uid });  
                
            }
            else{
                console.log("accessDenied: Sorry you cannot add this type of user");
                return res.status(300).json({ accessDenied: "Sorry you cannot add this type of user" });
            }  
        }
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: err.message });
    }
})

app.post("/api/add-device", async(req, res)=>{
    try {
        const { device_id, lat, longi, name, uid, min_value=0, max_value=0 } = req.body;  
        const result = await pool.query("SELECT device_id FROM device WHERE device_id=($1)", [device_id])
        if (result.rowCount == 0) {

            const isValidUserId = await pool.query("SELECT uid FROM user_details WHERE uid=($1)", [uid])

            if (isValidUserId.rowCount > 0) {
                //     Insert Statement Device parameters 
                await pool.query("INSERT INTO device(device_id, LOGITUDE,LATITUDE,name) VALUES ($1, $2, $3, $4)", [device_id, lat, longi, name]);
                await pool.query("INSERT INTO device_management(uid, device_id, access) VALUES ($1, $2, $3)", [uid, device_id, 'true'])
                await pool.query("INSERT INTO DEVICE_PARAMS(mac_address, MIN_VALUE, MAX_VALUE) VALUES($1, $2, $3);", [device_id, min_value, max_value])

                return res.status(200).json({ result: "Success" });
            } else {
                return res.status(300).json({ invalidUserId: "UserID not Present...Record Not Inserted" });
            }
        } else {
            return res.status(300).json({ DeviceExist: "Device already exists!!" });
            
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
})

// Not required for now
app.post("/api/device-management", async(req, res) => {
    try {
        const {uid, device_id, access} = req.body;
        const result = await pool.query("SELECT device_id FROM device WHERE device_id=($1)", [device_id])
        if(result.rowCount >=1 ){
            await pool.query("INSERT INTO device_management(uid, device_id, access) VALUES ($1, $2, $3)", [uid, device_id, access])
            return res.status(200).json({ result: "Success" });
        } else {
            return res.status(300).json({ invalidUserId: "Device not found...Record Not Inserted" });
        }
    } catch (err) {
        return res.status(500).json({error: err.message});
    }
})


app.get("/api/get-devices", async(req, res)=>{
    try {
        const uid = req.header("user_id");
        const typeOfuser = await pool.query("SELECT role from user_role_management where uid=($1)", [uid])

        if(typeOfuser.rows[0].role === "admin"){
            
            const devices = await pool.query("SELECT * FROM device;")
            return res.status(200).json(devices.rows)

        } 
        else {

            const result = await pool.query("SELECT device_id from device_management where uid = ($1) and access='true';", [uid]);
            if(result.rowCount === 0) {
                return res.status(401).json({error: "No devices"})
            } else{
                const deviceIds = result.rows.map((row) => row.device_id);
                const devices = await pool.query("SELECT * from device where device_id = any ($1);", [deviceIds]) // modify here
                return res.status(200).json(devices.rows)
            }
        }
    } catch (err) {
        return res.status(500).json({error: err.message});
    }
})

app.get("/api/device-max", async(req, res)=>{
    try {
        const device_id = decodeURIComponent(req.header("device_id"));
        const max_value = await pool.query("SELECT MAX_VALUE FROM DEVICE_PARAMS WHERE mac_address = $1;", [device_id]);

        // Check if any rows were returned
        if (max_value.rowCount > 0) {
            return res.status(200).json({ max_value: max_value.rows[0].max_value });
        } else {
            return res.status(404).json({ error: "No device values found" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
})


app.put("/api/device-max", async(req, res)=>{
    try {
        const device_id = decodeURIComponent(req.header("device_id"));
        const new_max = decodeURIComponent(req.header("max_value"));
        const max_value = await pool.query("SELECT MAX_VALUE FROM DEVICE_PARAMS WHERE mac_address = $1;", [device_id]);

        // Check if any rows were returned
        if (max_value.rowCount > 0) {
            await pool.query("UPDATE DEVICE_PARAMS SET MAX_VALUE=$1 where mac_address=$2", [new_max, device_id])
            return res.status(200).json({ result: true });
        } else {
            return res.status(404).json({ error: "No device values found" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
})


app.put("/api/device-name", async(req, res)=>{
    try {
        const device_id = decodeURIComponent(req.header("device_id"));
        const new_name = decodeURIComponent(req.header("new_name"));
        const name = await pool.query("SELECT name FROM device WHERE device_id = $1;", [device_id]);

        // Check if any rows were returned
        if (name.rowCount > 0) {
            await pool.query("UPDATE device SET name=$1 where device_id=$2", [new_name, device_id])
            return res.status(200).json({ result: true });
        } else {
            return res.status(404).json({ error: "No devices found" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
})




// get total value
app.get("/api/get-sensor-value", async (req, res) => {
    try {
        const device_id = decodeURIComponent(req.header("device_id"));
        const device_value = await pool.query("SELECT * FROM DEVICE_VALUES WHERE mac_address = $1 ORDER BY id DESC LIMIT 1;", [device_id]);

        // Check if any rows were returned
        if (device_value.rows.length > 0) {
            // Send the first row as the response
            return res.status(200).json({ device_id: device_value.rows[0] });
        } else {
            return res.status(404).json({ error: "No device values found" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


// get current day's sensor value
app.get("/api/current-day-sensor-value", async (req, res) => {
    try {
        const device_id = decodeURIComponent(req.header("device_id"));
        const previous_day_value = await pool.query("SELECT count FROM DEVICE_VALUES WHERE mac_address = $1 AND timestamp >= current_date - interval '1 day' AND timestamp < current_date ORDER BY id DESC LIMIT 1;", [device_id]);

        
        // Check if any rows were returned
        if (previous_day_value.rows.length > 0) {
            const total_value = await pool.query("SELECT count FROM DEVICE_VALUES WHERE mac_address = $1 ORDER BY id DESC LIMIT 1;", [device_id]);
            
            const prev_value = previous_day_value.rows[0].count;
            const total_count_value = total_value.rows[0].count;
            const currentValue = total_count_value - prev_value;

            // return current day's value
            return res.status(200).json({currentDayValue: currentValue});
        } else {
            const result = await pool.query("SELECT * from device where device_id = $1", [device_id]);
            if(result.rowCount > 0){
                const total_value = await pool.query("SELECT count FROM DEVICE_VALUES WHERE mac_address = $1 ORDER BY id DESC LIMIT 1;", [device_id]);
                if(total_value.rowCount > 0){
                    return res.status(200).json({currentDayValue: total_value.rows[0].count});
                } else {
                    return res.status(200).json({currentDayValue: 0});
                }
            }
            return res.status(404).json({ error: "No device values found" });
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});


app.get("/api/device-report", async(req, res) => {
    try {
        const device_id = decodeURIComponent(req.header("device_id"));
        const name = await pool.query("select name from device where device_id=$1", [device_id]);

        
        // Check if any rows were returned
        if (name.rows.length > 0) {
            const total_value = await pool.query("select d.device_id as mac, d.name, dv.timestamp, dv.count from device d, device_values dv where d.device_id=dv.mac_address and d.device_id=$1;", [device_id]);
            
            console.log(total_value)
            // return current day's value
            return res.status(200).json(total_value.rows);
        } else {
            return res.status(404).json({ error: "No devices found" });
        } 
    } catch (err) {
        return res.status(404).json({"error": err.message});
    }
})

// Not required for now
app.get("/api/get-tenant-user", async(req, res) => {
    try {
        const uid = req.header("uid")
        const role = req.header("role")


        const typeOfUser = await pool.query("SELECT role from user_role_management where uid=($1)", [uid])


        if(typeOfUser.rows[0].role === "admin"){
            const user = await pool.query("select * from user_details where uid in (select uid from user_role_management where role=$1);", [role])
            return res.status(200).json(user.rows)
        } else {
            const user = await pool.query("select * from user_details where uid in (select uid from user_role_management where role=($1) and admin_id=($2));", [role, uid])
            return res.status(200).json(user.rows)
        }
        
    } catch (err) {
        return res.status(500).json({error: err.message})
    }
})

// Not required for now
app.get("/api/get-user", async(req, res) => {
    try {
        const uid = req.header("uid")
        const user = await pool.query("select * from user_details where uid in (select uid from user_role_management where role='user' and admin_id=$1);", [uid])
        return res.status(200).json(user.rows)
    } catch (err) {
        return res.status(500).json({error: err.message})
    }
})

app.listen(port, () => {
    console.log(`Server running at ${port}`)
})