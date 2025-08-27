const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const expressSession = require("express-session");
const cookieParser = require("cookie-parser");
const bcryptjs = require("bcryptjs");
const connection = require("./database");
const nodemailer = require("nodemailer");
const officegen = require("officegen");
const romanize = require("romanize");
const PDFDocument = require("pdfkit");

const app = express();

app.use(cors({
  origin: ['https://capstone-auto-checker.vercel.app',],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  expressSession({
    secret: "mySecretKey",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(cookieParser("mySecretKey"));

//START FUNCTIONS

//Check for duplicate in register
const checkExist = async (uidStudent, Uid_Professor, Uid_Section) => {
  try {
    const query =
      "SELECT COUNT(*) as count from enrolled_sections WHERE Student_Uid = ? AND Professor_Uid = ? AND Section_Uid = ?";
    const [count] = await connection.query(query, [
      uidStudent,
      Uid_Professor,
      Uid_Section,
    ]);
    if (count[0].count === 0) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
};
//Check if correct TUPCID and GSFE ACC or they're exists
const accountExistFpass = async (TUPCID, GSFEACC) => {
  try{
    const query1 = "SELECT COUNT(*) as count from student_accounts WHERE TUPCID = ? AND GSFEACC = ?";
    const query2 = "SELECT COUNT(*) as count from faculty_accounts WHERE TUPCID = ? AND GSFEACC = ?";
    const [count1] = await connection.query(query1, [TUPCID, GSFEACC]);
    const [count2] = await connection.query(query2, [TUPCID, GSFEACC]);
    if(count1[0].count > 0 || count2[0].count > 0){
      return true;
    }else{
      return false;
    }
  }catch(error){
    throw error
  }
};

//Check if the testpaper is exist
const checktestexists = async (TUPCID, UID, test_name) => {
  try {
    const query =
      "SELECT COUNT(*) as count from testpapers WHERE Professor_ID = ? AND UID_test = ? AND test_name = ?";
    const [count] = await connection.query(query, [TUPCID, UID, test_name]);
    if (count[0].count === 0) {
      return false;
    } else {
      return true;
    }
  } catch (error) {
    return res.status(500).send({ message: "Internal server error" });
  }
};

const checktestbankexist = async (TUPCID, UID, test_name) =>{
  try{
    const query = "SELECT COUNT(*) as count FROM preset_questions WHERE Professor_ID = ? AND TESTNAME = ? AND UID = ?"
    const [count] = await connection.query(query, [TUPCID, test_name, UID]);
    if(count[0].count === 0){
      return false;
    }else{
      return true;
    }
  }catch(error){
    return res.status(500).send({ message: "Internal server error" });
  }
};
//Check if the Uid_Test is already published
const checkPublish = async (Uid_Test) => {
  try {
    const query =
      "SELECT COUNT(*) as count from publish_test WHERE Uid_Test = ?";
    const [count] = await connection.query(query, [Uid_Test]);
    if (count[0].count === 0) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
};

//Getting the info of Professor
const getInfoProf = async (UidProf) => {
  try {
    const query =
      "SELECT SUBJECTDEPT, SURNAME, FIRSTNAME, MIDDLENAME, TUPCID FROM faculty_accounts WHERE uid = ?";
    const [row] = await connection.query(query, [UidProf]);
    return row;
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
};
//Getting info of Student
const getInfo = async (Student_Uid) => {
  try {
    const query =
      "SELECT TUPCID, SURNAME, FIRSTNAME, MIDDLENAME FROM student_accounts WHERE uid = ?";
    const [row] = await connection.query(query, [Student_Uid]);
    return row;
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
};
//Alert after registering the GSFE 
const sendAlert = async (GSFEACC) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "eos2022to2023@gmail.com",
      pass: "ujfshqykrtepqlau",
    },
  });
  const mailOptions = {
    from: "eos2022to2023@gmail.com",
    to: GSFEACC,
    subject: "Alert!",
    text: `Good day! Your Gsfe Account ${GSFEACC} is registered in tupcautochecker.online, if you are the one who registered disregard the message.`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw err;
  }
};
//For matchCode sending code
const sendCode = async (GSFEACC, code) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "eos2022to2023@gmail.com",
      pass: "ujfshqykrtepqlau",
    },
  });

  const mailOptions = {
    from: "eos2022to2023@gmail.com",
    to: GSFEACC,
    subject: "Forgot Password Code",
    text: `Good day! In order to update your password in the current account, please use the following 6-digit code: ${code}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw err;
  }
};
//For sending the Message to the developer
const Reportproblem = async (GSFEACC, MESSAGE) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "eos2022to2023@gmail.com",
      pass: "ujfshqykrtepqlau",
    },
  });
  const mailOptions = {
    from: "eos2022to2023@gmail.com",
    to: "tupconlinetestpaperchecker@gmail.com",
    subject: "Web application problem",
    text: `Report from user ${GSFEACC} \r\nMessage: ${MESSAGE}`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw err;
  }
};

//Check if there is a existing result for student
const checkResultExits = async(TUPCID, UID) => {
  try{
    const query = "SELECT COUNT(*) as count FROM student_results WHERE TUPCID = ? AND UID = ?"
    const [count] = await connection.query(query, [TUPCID, UID]);
    if(count[0].count === 0){
      return true;
    }else{
      return false;
    }
  }catch(error){
    throw error;
  }

}
// Checking if the account is exist for student and faculty
const checkAccount = async (TUPCID) => {
  try {
    const checkquery = "SELECT TUPCID from student_accounts WHERE TUPCID = ?";
    const checkquery2 = "SELECT TUPCID from faculty_accounts WHERE TUPCID = ?";
    const [accounts] = await connection.query(checkquery, [TUPCID]);
    const [accounts2] = await connection.query(checkquery2, [TUPCID]);
    return accounts.length || accounts2.length > 0;
  } catch (error) {
    throw error;
  }
};
// Checking the type of the TUPCID either student or faculty
const checkType = async (table, Tupcid, Password, accountType) => {
  try {
    const query = `SELECT * FROM ${table}_accounts WHERE ${
      table == "admin" ? "Account_Number = ?" : "TUPCID = ?"
    }`;
    const [rows] = await connection.query(query, [Tupcid]);
    if (rows.length === 0) {
      return { accountType: null };
    }
    const user = rows[0];
    let storedPassword = table === "admin" ? user.Password : user.PASSWORD;
    let storedUid = table === "admin" ? user.Uid_Account : user.uid;
    const isPasswordMatch = await bcryptjs.compare(Password, storedPassword);
    if (isPasswordMatch) {
      return { accountType: accountType, uid: storedUid };
    } else {
      return { accountType: null };
    }
  } catch (error) {
    throw error;
  }
};

//Checking what account type for forgetpassword
const accountType = async (TUPCID) => {
  try {
    const student = "SELECT TUPCID FROM student_accounts WHERE TUPCID = ?";
    const faculty = "SELECT TUPCID FROM faculty_accounts WHERE TUPCID = ?";
    const [resultstudent] = await connection.query(student, [TUPCID]);
    const [resultfaculty] = await connection.query(faculty, [TUPCID]);

    if (resultfaculty.length > 0) {
      return "faculty";
    } else if (resultstudent.length > 0) {
      return "student";
    } else {
      return null;
    }
  } catch (err) {
    throw err;
  }
};
//END FUNCTIONS

app.get('/', (req, res) => {
  res.json({ message: 'Backend is working!', timestamp: new Date() });
});

app.post("/StudentRegister", async (req, res) => {
  const {
    TUPCID,
    SURNAME,
    FIRSTNAME,
    MIDDLENAME,
    GSFEACC,
    COURSE,
    SECTION,
    YEAR,
    STATUS,
    PASSWORD,
  } = req.body;

  //If the TUPCID is already registered
  try {
    await sendAlert(GSFEACC);
    const isAccountExist = await checkAccount(TUPCID);

    if (isAccountExist) {
      return res.status(409).send({
        message: "Account already registered",
      });
    }

    if (STATUS !== "REGULAR" && STATUS !== "IRREGULAR") {
      return res.status(400).send({ message: "Invalid STATUS" });
    }

    const hashedPassword = await bcryptjs.hash(PASSWORD, 10);
    const uidTUPCID = await bcryptjs.hash(TUPCID, 2);

    const insertQuery =
      "INSERT INTO student_accounts (uid, TUPCID, SURNAME, FIRSTNAME, MIDDLENAME, GSFEACC, COURSE, SECTION, YEAR, STATUS, PASSWORD, REGISTEREDDATE) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";

    await connection.query(insertQuery, [
      uidTUPCID,
      TUPCID,
      SURNAME,
      FIRSTNAME,
      MIDDLENAME,
      GSFEACC,
      COURSE,
      SECTION,
      YEAR,
      STATUS,
      hashedPassword,
    ]);

    return res.status(200).send({ message: "Account successfully registered" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).send({ message: "Server error" });
  }
});

app.post("/FacultyRegister", async (req, res) => {
  const {
    TUPCID,
    SURNAME,
    FIRSTNAME,
    MIDDLENAME,
    GSFEACC,
    SUBJECTDEPT,
    PASSWORD,
  } = req.body;

  //If the TUPCID is already registered
  try {
    await sendAlert(GSFEACC);
    const isAccountExist = await checkAccount(TUPCID);
    console.log("Hello?", TUPCID);
    if (isAccountExist) {
      return res.status(409).send({
        message: "Account already registered",
      });
    }
    const hashedPassword = await bcryptjs.hash(PASSWORD, 10);
    const uidTUPCID = await bcryptjs.hash(TUPCID, 2);

    const insertQuery =
      "INSERT INTO faculty_accounts (uid, TUPCID, SURNAME, FIRSTNAME, MIDDLENAME, GSFEACC, SUBJECTDEPT, PASSWORD, REGISTEREDDATE) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";

    await connection.query(insertQuery, [
      uidTUPCID,
      TUPCID,
      SURNAME,
      FIRSTNAME,
      MIDDLENAME,
      GSFEACC,
      SUBJECTDEPT,
      hashedPassword,
    ]);
    console.log("Hello?", uidTUPCID);
    console.log("Hell???o?", uidTUPCID);
    return res.status(200).send({ message: "Account successfully registered" });
  } catch (error) {
    throw error;
  }
});

//Login for student and Faculty
app.post("/Login", async (req, res) => {
  const { Tupcid, Password } = req.body;
  try {
    const studentLoginResult = await checkType(
      "student",
      Tupcid,
      Password,
      "student"
    );
     console.log("Working")
    const facultyLoginResult = await checkType(
      "faculty",
      Tupcid,
      Password,
      "faculty"
    );
    const adminLoginResult = await checkType(
      "admin",
      Tupcid,
      Password,
      "admin"
    );

    let accountType = "";

    if (studentLoginResult.accountType === "student") {
      res.json({ accountType: "student", Uid: studentLoginResult.uid });
      accountType = "student"; // Set account type for insertion
    } else if (facultyLoginResult.accountType === "faculty") {
      res.json({ accountType: "faculty", Uid: facultyLoginResult.uid });
      accountType = "faculty"; // Set account type for insertion
    } else if (adminLoginResult.accountType === "admin") {
      res.json({ accountType: "admin", Uid: adminLoginResult.uid });
      accountType = "admin"; // Set account type for insertion
    } else {
      res.status(404).json({ message: "Account or Password invalid" });
      return;
    }

    // Set other data for insertion
    const TUPCID = Tupcid;
    const PROFILE = accountType;
    const STATUS = "ONLINE";
    const TIMESTAMP = new Date();

    // Check if there's a record with the same TUPCID and STATUS 'ONLINE'
    const checkOnlineStatusQuery =
      "SELECT * FROM login_log WHERE TUPCID = ? AND STATUS = ?";
    const checkOnlineStatusValues = [TUPCID, STATUS];
    const [existingOnlineRecord] = await connection.query(
      checkOnlineStatusQuery,
      checkOnlineStatusValues
    );

    if (existingOnlineRecord.length > 0) {
      // If the record with 'ONLINE' status exists, update its timestamp
      const updateLoginLogQuery =
        "UPDATE login_log SET TIMESTAMP = ? WHERE TUPCID = ? AND STATUS = ?";
      const updateLoginLogValues = [TIMESTAMP, TUPCID, STATUS];
      await connection.query(updateLoginLogQuery, updateLoginLogValues);
    } else {
      // Insert into login_log table if no 'ONLINE' record exists
      const loginLogQuery =
        "INSERT INTO login_log (TUPCID, PROFILE, STATUS, TIMESTAMP) VALUES (?, ?, ?, ?)";
      const loginLogValues = [TUPCID, PROFILE, STATUS, TIMESTAMP];
      await connection.query(loginLogQuery, loginLogValues);
    }

    // Insert into overalllogin_log table
    const overallLoginLogQuery =
      "INSERT INTO overalllogin_log (TUPCID, PROFILE, STATUS, TIMESTAMP) VALUES (?, ?, ?, ?)";
    const overallLoginLogValues = [TUPCID, PROFILE, STATUS, TIMESTAMP];
    await connection.query(overallLoginLogQuery, overallLoginLogValues);
  } catch (error) {
    console.error("Error during login:", error);
    res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
});

//Forgetpassword
app.post("/ForgetPassword", async (req, res) => {
  const { TUPCID, GSFEACC } = req.query;
  const min = 100000;
  const max = 999999;
  const randomNumber = Math.floor(Math.random() * (max - min + 1) + min);
  const code = randomNumber.toString().padStart(6, "0");
  try {
    const isExist = await accountExistFpass(TUPCID, GSFEACC);
    if (isExist) {
      sendCode(GSFEACC, code);
      const query =
        "INSERT INTO passwordreset_accounts (TUPCID, GSFEACC, code, accountType) values (?, ?, ?, ?)";
      const accounttype = await accountType(TUPCID);
      await connection.query(query, [TUPCID, GSFEACC, code, accounttype]);
      return res
        .status(200)
        .send({ message: "Successfully send to your GSFE ACCOUNT!" });
    } else {
      return res.status(409).send({ message: "Wrong TUPCID or GSFE Account" });
    }
  } catch (err) {
    return res
      .status(500)
      .send({ message: "There is a problem try again later" });
  }
});

//MatchCode
app.post("/MatchCode", async (req, res) => {
  const { Code } = req.body;
  try {
    const query =
      "SELECT TUPCID, accountType FROM passwordreset_accounts WHERE code = ?";
    const [coderows] = await connection.query(query, [Code]);
    const deleteCode = "DELETE FROM passwordreset_accounts WHERE code = ?";
    await connection.query(deleteCode, [Code]);
    if (coderows.length > 0) {
      const { TUPCID, accountType } = coderows[0];
      return res.status(200).send({ TUPCID, accountType });
    } else {
      return res.status(409).send({ message: "Wrong Code" });
    }
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});
//UpdatePassword
app.put("/UpdatePassword", async (req, res) => {
  const { NewPassword } = req.body;
  const { TUPCID } = req.query;
  try {
    const hashedPassword = await bcryptjs.hash(NewPassword, 10);
    const accounttype = await accountType(TUPCID);
    const query = `UPDATE ${accounttype}_accounts SET PASSWORD = ? WHERE TUPCID = ?`;
    await connection.query(query, [hashedPassword, TUPCID]);
    return res.status(200).send({ message: "Done" });
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//Aside
//Faculty
app.get("/FacultyAside", async (req, res) => {
  const { UidProf } = req.query;
  try {
    const query = "SELECT * FROM faculty_accounts WHERE uid = ?";
    const [row] = await connection.query(query, [UidProf]);
    return res.status(200).json(row);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});
//Student
app.get("/StudentAside", async (req, res) => {
  const { TUPCID } = req.query;
  try {
    const query = "SELECT * FROM student_accounts WHERE uid = ?";
    const [row] = await connection.query(query, [TUPCID]);
    return res.status(200).json(row);
  } catch (err) {}
});

//Student_Admin
app.get("/Admin_Students", async (req, res) => {
  try {
    const query = "SELECT * FROM student_accounts";
    const [rows] = await connection.query(query);

    // Modify the date format for each row
    const formattedRows = rows.map((row) => {
      const date = new Date(row.REGISTEREDDATE);
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      return {
        ...row,
        REGISTEREDDATE: formattedDate,
      };
    });

    return res.status(200).json(formattedRows);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//Faculty
app.get("/Admin_Faculty", async (req, res) => {
  try {
    const query = "SELECT * FROM faculty_accounts";
    const [row] = await connection.query(query);
    const formattedRows = row.map((row) => {
      const date = new Date(row.REGISTEREDDATE);
      const formattedDate = date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      return {
        ...row,
        REGISTEREDDATE: formattedDate,
      };
    });

    return res.status(200).json(formattedRows);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/Admin_FacultyTestList", async (req, res) => {
  try {
    const query =
      "SELECT Professor_FirstName, Professor_MiddleName, Professor_LastName, Professor_SubjectDept, Professor_ID, TestName, Subject, Section_Name, Uid_Test FROM faculty_testlist";
    const [row] = await connection.query(query);
    return res.status(200).json(row);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//Api_key for the vision
app.get("/Getting", async(req,res) => {
  try{
    const query = "SELECT Secret FROM admin"
    const [api] = await connection.query(query);
    const secured = api[0].Secret.slice(-3).padStart(api[0].Secret.length, "*")
    return res.status(200).send(secured);
  }catch(error){
    return res.status(500).send({ message: "Internal server error" });
  }
})

app.get("/Getting2", async(req,res) => {
  try{
    const query = "SELECT Secret FROM admin"
    const [api] = await connection.query(query);
    return res.status(200).send(api);
  }catch(error){
    return res.status(500).send({ message: "Internal server error" });
  }
})


//Changing the api
app.post("/Change", async(req, res) => {
  const {secret} = req.body
  try {
    const query = "UPDATE admin SET Secret = ? WHERE id = '1'"
    await connection.query(query, [secret]);
    return res.status(200).send({message: "Successful"})
  } catch (error) {
    throw error
  }
})

//Admin
app.get("/AdminAside", async (req, res) => {
  const { Uid_Account } = req.query;
  try {
    const query =
      "SELECT Account_Number, Username FROM admin_accounts WHERE Uid_Account = ?";
    const [row] = await connection.query(query, [Uid_Account]);
    return res.status(200).json(row);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//ReportProblem
//Faculty
app.get("/FacultyReportProblem", async (req, res) => {
  const { UidProf } = req.query;
  try {
    const query = "SELECT GSFEACC FROM faculty_accounts WHERE uid = ?";
    const [row] = await connection.query(query, [UidProf]);
    return res.status(200).send(row[0]);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//Student
app.get("/StudentReportProblem", async (req, res) => {
  const { TUPCID } = req.query;
  try {
    const query = "SELECT GSFEACC FROM student_accounts WHERE uid = ?";
    const [row] = await connection.query(query, [TUPCID]);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});

app.post("/ReportProblem", (req, res) => {
  const { GSFEACC, MESSAGE } = req.body;
  try {
    Reportproblem(GSFEACC, MESSAGE);
    return res.status(200).send({ message: "DONE" });
  } catch (err) {
    throw err;
  }
});
//Admin

// FacultyTestList
app.get("/TestListSectionName", async (req, res) => {
  const { UidProf } = req.query;
  try {
    const query =
      "SELECT Subject, Section_Name, Uid_Section FROM faculty_sections WHERE Uid_Professor = ?";
    const [section_names] = await connection.query(query, [UidProf]);
    return res.status(200).json(section_names);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//Checking TestName
app.get("/CheckTestName", async (req, res) => {
  const { TestName, Subject, SectionName, Semester } = req.query;
  try {
    const query =
      "SELECT COUNT(*) as count FROM faculty_testlist WHERE TestName = ? AND Subject = ? AND Section_Name = ? AND Semester = ? ";
    const [count] = await connection.query(query, [
      TestName,
      Subject,
      SectionName,
      Semester,
    ]);
    if (count[0].count > 0) {
      return res.status(409).send({ message: "Existing Testname" });
    } else {
      return res.status(200).send({ message: "Nice" });
    }
  } catch (err) {
    throw err;
  }
});

app.post("/TestList", async (req, res) => {
  const {
    TestName,
    Subject,
    UidTest,
    UidProf,
    SectionName,
    Semester,
    Uid_section,
  } = req.body;
  try {
    const infos = await getInfoProf(UidProf);
    const query1 =
      "INSERT INTO faculty_testlist (Professor_FirstName, Professor_MiddleName, Professor_LastName, Professor_SubjectDept, Professor_ID, TestName, Subject, Section_Name, Semester, Uid_Section, Uid_Test, Uid_Professor, date_created) values (?, ?, ? ,? ,?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    await connection.query(query1, [
      infos[0].FIRSTNAME,
      infos[0].MIDDLENAME,
      infos[0].SURNAME,
      infos[0].SUBJECTDEPT,
      infos[0].TUPCID,
      TestName,
      Subject,
      SectionName,
      Semester,
      Uid_section,
      UidTest,
      UidProf,
    ]);
    return res.status(200).send({ message: "done" });
  } catch (err) {
    throw err;
  }
});

app.get("/TestList", async (req, res) => {
  const { UidProf } = req.query;
  try {
    const query = "SELECT * FROM faculty_testlist WHERE Uid_Professor = ?";
    const [row] = await connection.query(query, [UidProf]);
    return res.status(200).json(row);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/CheckPublish", async (req, res) => {
  const [Uids] = req.body;
  try {
    const existingItems = [];
    for (let i = 0; i < Uids.length; i++) {
      const query =
        "SELECT COUNT(*) as count FROM publish_test WHERE Uid_Test = ?";
      const [row] = await connection.query(query, [Uids[i]]);
      if (row[0].count === 1) {
        existingItems.push(Uids[i]);
      }
    }
    return res.status(200).json({ existingItems });
  } catch (err) {
    throw err;
  }
});

app.delete("/TestList", async (req, res) => {
  const { UidTest } = req.query;
  try {
    const query1 = "DELETE FROM publish_test WHERE Uid_Test = ?";
    const query = "DELETE FROM faculty_testlist WHERE Uid_Test = ?";
    await connection.query(query1, [UidTest]);
    await connection.query(query, [UidTest]);
    return res.status(200).send({ message: "Done" });
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

app.post("/PublishTest", async (req, res) => {
  const { Uid_Prof } = req.query;
  const { TestName, UidTest, Subject, SectionName, Semester, SectionUid } =
    req.body;
  const TupcId = await getInfoProf(Uid_Prof);
  try {
    const checking = await checkPublish(UidTest);
    if (checking) {
      const query =
        "INSERT INTO publish_test (Professor_ID, Uid_Professor, Section_Uid, Uid_Test, Subject, Section_Name, Semester, TestName) values (?, ?, ?, ?, ?, ?, ? ,?)";
      await connection.query(query, [
        TupcId[0].TUPCID,
        Uid_Prof,
        SectionUid,
        UidTest,
        Subject,
        SectionName,
        Semester,
        TestName,
      ]);
      return res.status(200).send({ message: "Done" });
    } else {
      return res.status(409).send({ message: "Already publish" });
    }
  } catch (err) {
    throw err;
  }
});

//Faculty section
app.put("/Faculty_sections", async (req, res) => {
  const { UidProf, UidSection, SectionName, Subject, Year, Course, Section } =
    req.body;
  try {
    const query =
      "INSERT INTO faculty_sections (Uid_Professor, Uid_Section, Section_Name, Course, Year, Section, Subject, date_created) values (?, ?, ?, ?, ?, ?, ?, NOW())";
    await connection.query(query, [
      UidProf,
      UidSection,
      SectionName,
      Course,
      Year,
      Section,
      Subject,
    ]);
    return res.status(200).send({ message: "done" });
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/Faculty_sections", async (req, res) => {
  const { UidProf } = req.query;
  try {
    const query = "SELECT * FROM faculty_sections WHERE Uid_Professor = ?";
    const [sections] = await connection.query(query, [UidProf]);
    return res.status(200).json(sections);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

app.get("/Faculty_StudentList", async (req, res) => {
  const { Uid_Section, Section } = req.query;
  try {
    const query =
      "SELECT * FROM enrolled_sections WHERE Section_Uid = ? AND Section_Name = ? ";
    const [row] = await connection.query(query, [Uid_Section, Section]);
    return res.status(200).send(row);
  } catch (err) {
    return res.status(500).send({ message: "Internal Server error" });
  }
});

app.delete("/Faculty_Students", async (req, res) => {
  const { Uid_Section, Section, Professor_Uid } = req.query;
  const { selected } = req.body;
  try {
    const selectedStudents = selected.map(() => "?").join(",");
    const query = `DELETE FROM enrolled_sections WHERE Student_TUPCID IN (${selectedStudents}) AND Professor_Uid = ? AND Section_Uid = ? AND Section_Name = ?`;
    await connection.query(query, [
      ...selected,
      Professor_Uid,
      Uid_Section,
      Section,
    ]);
    return res.status(200).send({ message: "Mission accomplished" });
  } catch (err) {
    throw err;
  }
});
//Student
app.get("/StudentTestList", async (req, res) => {
  const { uidsection } = req.query;
  try {
    const query = "SELECT * FROM faculty_sections WHERE Uid_Section = ?";
    const [row] = await connection.query(query, [uidsection]);
    if (row.length > 0) {
      return res.status(200).json(row);
    } else {
      return res
        .status(204)
        .send({ message: "Wrong UID or no section with that UID" });
    }
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

app.put("/StudentTestList", async (req, res) => {
  const { uidStudent } = req.query;
  const { Uid_Professor, Uid_Section, Section_Name, Subject } = req.body;
  try {
    const StudentName = await getInfo(uidStudent);
    const checking = await checkExist(uidStudent, Uid_Professor, Uid_Section);
    if (checking) {
      const query =
        "INSERT INTO enrolled_sections (Student_TUPCID, Student_FirstName,  Student_MiddleName, Student_LastName, Student_Uid, Professor_Uid, Section_Uid, Section_Name, Section_Subject, date_added) values (?, ?, ?, ?, ?, ?, ? ,? ,?, NOW())";
      const { FIRSTNAME, MIDDLENAME, SURNAME, TUPCID } = StudentName[0];
      await connection.query(query, [
        TUPCID,
        FIRSTNAME,
        MIDDLENAME,
        SURNAME,
        uidStudent,
        Uid_Professor,
        Uid_Section,
        Section_Name,
        Subject,
      ]);
      return res.status(200).send({ message: "Inserted" });
    } else {
      return res.status(409).send({ message: "Already enrolled" });
    }
  } catch (err) {
    throw err;
  }
});

app.get("/StudentSectionList", async (req, res) => {
  const { uidStudent } = req.query;
  try {
    const queryTUPCID = "SELECT TUPCID FROM student_accounts WHERE uid = ?";
    const [accountRow] = await connection.query(queryTUPCID, [uidStudent]);
    const TUPCID = accountRow[0]?.TUPCID;

    if (!TUPCID) {
      return res
        .status(404)
        .send({ message: "No TUPCID found for the provided uid" });
    }

    const queryEnrolledSections =
      "SELECT * FROM enrolled_sections WHERE Student_Uid = ?";
    const [row] = await connection.query(queryEnrolledSections, [uidStudent]);
    if (row.length === 0) {
      return res
        .status(404)
        .send({ message: "No enrolled sections found for the student" });
    }

    const uidSections = row.map((section) => section.Section_Uid);
    const subjectsections = row.map((subject) => subject.Section_Subject);

    const examUIDQuery =
      "SELECT * FROM publish_test WHERE Section_Uid IN (?) AND Subject IN (?)";
    const [examRows] = await connection.query(examUIDQuery, [
      uidSections,
      subjectsections,
    ]);

    if (examRows.length === 0) {
      return res.status(509).send({
        message: "No published tests found for the enrolled sections",
      });
    }
    const examUIDs = examRows.map((exam) => exam.Uid_Test);
    const scoreQuery =
      "SELECT UID, TOTALSCORE, MAXSCORE FROM student_results WHERE TUPCID = ? AND UID IN (?)";
    const [scoreRows] = await connection.query(scoreQuery, [TUPCID, examUIDs]);

    const scoreMap = {};
    scoreRows.forEach((score) => {
      scoreMap[score.UID] = {
        totalScore: score.TOTALSCORE,
        maxScore: score.MAXSCORE,
      };
    });

    const combinedData = {
      enrolledSections: row,
      examUIDs: examUIDs,
      studentScores: scoreMap,
      testNameMap: examRows,
    };

    return res.status(200).send(combinedData);
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "Problem at the server" });
  }
});

//Settings
//DEMO
app.get("/facultyinfos", async (req, res) => {
  const { TUPCID } = req.query;
  try {
    const query = "SELECT * from faculty_accounts WHERE uid = ?";
    const [getall] = await connection.query(query, [TUPCID]);
    if (getall.length > 0) {
      const {
        TUPCID,
        FIRSTNAME,
        SURNAME,
        MIDDLENAME,
        SUBJECTDEPT,
        GSFEACC,
        PASSWORD,
      } = getall[0];
      return res.status(202).send({
        Tupcid: TUPCID,
        FIRSTNAME,
        SURNAME,
        MIDDLENAME,
        SUBJECTDEPT,
        GSFEACC,
        PASSWORD,
      });
    } else {
      return res.status(404).send({ message: "Person not found" });
    }
  } catch (error) {
    return res.status(500).send({ message: "Failed to fetch TUPCID" });
  }
});

app.put("/updatefacultyinfos/:TUPCID", async (req, res) => {
  const { TUPCID } = req.params;
  const updatedData = req.body;
  try {
    const datas = Object.keys(updatedData)
      .map((key) => `${key} = ?`)
      .join(",");
    const query = `UPDATE faculty_accounts SET ${datas} WHERE uid = ?`;
    connection.query(
      query,
      [...Object.values(updatedData), TUPCID],
      (err, result) => {
        if (err) {
          console.error("Error updating student data:", err);
          return res.status(500).send({ message: "Database error" });
        }
        return res
          .status(200)
          .send({ message: "Student updated successfully" });
      }
    );
  } catch (error) {
    console.log(error);
  }
});

app.get("/studinfos", async (req, res) => {
  const { TUPCID } = req.query;
  try {
    const query = "SELECT * from student_accounts WHERE uid = ?";
    const [getall] = await connection.query(query, [TUPCID]);
    if (getall.length > 0) {
      const {
        TUPCID,
        FIRSTNAME,
        SURNAME,
        MIDDLENAME,
        COURSE,
        SECTION,
        YEAR,
        STATUS,
        GSFEACC,
        PASSWORD,
      } = getall[0];
      return res.status(202).send({
        Tupcid: TUPCID,
        FIRSTNAME,
        SURNAME,
        MIDDLENAME,
        COURSE,
        SECTION,
        YEAR,
        STATUS,
        GSFEACC,
        PASSWORD,
      });
    }
  } catch (error) {
    return res.status(500).send({ message: "Failed to fetch TUPCID" });
  }
});

app.put("/updatestudentinfos", async (req, res) => {
  const { TUPCID } = req.query;
  const updatedData = req.body;
  try {
    const datas = Object.keys(updatedData)
      .map((key) => `${key} = ?`)
      .join(",");
    const query = `UPDATE student_accounts SET ${datas} WHERE uid = ?`;
    connection.query(
      query,
      [...Object.values(updatedData), TUPCID],
      (err, result) => {
        if (err) {
          console.error("Error updating student data:", err);
          return res.status(500).send({ message: "Database error" });
        }
        return res
          .status(200)
          .send({ message: "Student updated successfully" });
      }
    );
  } catch (error) {
    console.log(error);
  }
});

app.post("/createtestpaper", async (req, res) => {
  const { TUPCID, UID, test_name, section_name, subject, semester, data } =
    req.body;
    console.log(TUPCID, UID, test_name, section_name, subject, semester, data)
  try {
    const exists = await checktestexists(TUPCID, UID, test_name);
    console.log(exists)
    if (exists) {
      const query =
        "UPDATE testpapers SET questions = ? WHERE Professor_ID = ? AND UID_test = ? AND test_name = ?";
      await connection.query(query, [
        JSON.stringify(data),
        TUPCID,
        UID,
        test_name,
      ]);
      return res.status(200).send({ message: "Updated successfully" });
    } else {
      const insertQuery =
        " INSERT INTO testpapers (Professor_ID, UID_test, test_name, section_name, subject, semester, questions, test_created) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
      const insertValues = [
        TUPCID,
        UID,
        test_name,
        section_name,
        subject,
        semester,
        JSON.stringify(data),
      ];
      await connection.query(insertQuery, insertValues);
      return res
        .status(200)
        .json({ message: "Data added to the test successfully" });
    }
  } catch (error) {
    console.error("Error adding data to the test:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});
app.put("/updatetestpaper", async (req, res) => {
  try {
    const { TUPCID, uid, section_name } = req.query;
    const { data } = req.body;
    const updateQuery = `
      UPDATE testpapers
      SET
        questions = ?,
        test_created = NOW() 
      WHERE Professor_ID = ? AND UID_test = ? AND section_name = ?;
    `;

    const updateValues = [JSON.stringify(data), TUPCID, uid, section_name];

    await connection.query(updateQuery, updateValues);

    res.status(200).json({ message: "Data updated successfully" });
  } catch (error) {
    console.error("Error updating data:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.get("/generateTestPaperpdf/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    const query = `
      SELECT questions, semester, subject, test_name FROM testpapers WHERE UID_test = ?;
    `;

    const [testdata] = await connection.query(query, [uid]);

    const questionsData = JSON.parse(testdata[0].questions);
    const test_name = testdata[0].test_name;
    const semester = testdata[0].semester;
    const subject = testdata[0].subject;

    // Create a new PDF document
    const doc = new PDFDocument({
      layout: "portrait",
      margins: {
        top: 50,
        bottom: 50,
        left: 72,
        right: 72,
      },
    });
    const filename = ` ${test_name}.pdf`;

    // Set the title based on TEST NUMBER and TEST NAME
    const title = doc.text(
      `${semester}: ${subject}  ${test_name}               UID:${uid}`,
      {
        bold: true,
        fontSize: 24,
        align: "left",
      }
    );
    doc.moveDown();
    const boxX = 65;
    const boxY = 80;
    const boxWidth = 520;
    const boxHeight = 170;

    // Draw a rectangle
    doc.rect(boxX, boxY, boxWidth, boxHeight).stroke();

    // Text to be placed inside the box
    const directionsText = `    GENERAL INSTRUCTIONS:
    1. Strictly no erasure. 
    2. Answer in order and completely.
    3. Put your answer in the corresponding boxes.
    4. Put extra space per letter.
    5. Put an X if you don't know the answer before submitting.
    6. Write your answer in UPPERCASE letter.`;

    doc.text(directionsText, boxX + 50, boxY + 10, {
      width: boxWidth - 20,
      lineGap: 10,
      fontSize: 12,
    });
    doc.moveDown();

    const groupedQuestions = {};

    // Group questions by questionType
    questionsData.forEach((item, index) => {
      const questionType = item.questionType;
      const question = item.question;
      const options = item.options;
      const score = item.score;

      // Check if both questionType and question are defined and not empty
      if (questionType && question) {
        if (!groupedQuestions[questionType]) {
          groupedQuestions[questionType] = [];
        }
        groupedQuestions[questionType].push({ question, options, score });
      }
    });

    // Create a counter to track the number of unique question types
    let testCounter = 1;

    // Iterate through the grouped questions and add them to the PDF document
    for (const questionType in groupedQuestions) {
      const questionsOfType = groupedQuestions[questionType];
      if (questionsOfType.length > 0) {
        // Convert the testCounter to a Roman numeral
        const romanNumeral = romanize(testCounter);

        // Determine the display text based on question type
        let displayText = "";
        let instructions = "";
        if (questionType === "MultipleChoice") {
          displayText = "Multiple Choice";
        } else if (questionType === "TrueFalse") {
          displayText = "TRUE or FALSE";
          instructions =
            "Write T if the statement is TRUE or F if the statement is FALSE.";
        } else if (questionType === "Identification") {
          displayText = "Identification";
        }

        const score = questionsOfType[0].score;
        doc.moveDown();
        const ptsText = score > 1 ? "pts. each" : score === 1 ? "pt." : "";
        const questionTypeHeading = doc.text(
          `TEST ${romanNumeral}. ${displayText}`,
          {
            bold: true,
            fontSize: 16,
            color: "black",
          }
        );

        // Add the instructions
        const instructionParagraph = doc.text(instructions, {
          fontSize: 12,
          color: "black",
        });

        doc.moveDown();
        let questionNumber = 1; // Initialize question number

        questionsOfType.forEach((questionData, index) => {
          // Check if a new column should be started
          if (index > 0 && index % 20 === 0) {
            questionTypeHeading.addPage();
          }

          const questionParagraph = doc.text(
            `${questionNumber}. ${questionData.question}`
          );
          doc.moveDown(0.5);

          // Add the question text or options as needed
          if (questionType === "MultipleChoice") {
            if (questionData.options && questionData.options.length > 0) {
              const validOptions = questionData.options
                .filter(option => option.text !== undefined && option.text !== "")
                .map(
                  (option, optionIndex) =>
                    ` ${String.fromCharCode(97 + optionIndex)}.) ${option.text}\n`
                )
                .join(""); // Join valid options with a newline character

              if (validOptions !== "") {
                doc.text(validOptions);
                doc.moveDown();
              }
            }
          }

          questionNumber++;
          doc.moveDown();
        });

        testCounter++;
        doc.moveDown();
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Finalize the PDF and end the response stream
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating PDF");
  }
});


app.get("/generateTestPaperdoc/:uid", async (req, res) => {
  try {
    const { uid } = req.params; // Extract parameters from URL

    // Fetch data from the database based on the parameters
    const query = `
      SELECT questions, test_name, subject, semester FROM testpapers WHERE UID_test = ?;
    `;

    const [testdata] = await connection.query(query, [uid]);

    // Extract the questions, test_number, and test_name from the database response
    const questionsData = JSON.parse(testdata[0].questions);
    const test_name = testdata[0].test_name;
    const semester = testdata[0].semester;
    const subject = testdata[0].subject;

    // Create a new Word document
    const docx = officegen("docx");
    const filename = `${test_name}.docx`;

    // Define a function to add a paragraph with a specific style
    function addStyledParagraph(text, style) {
      const paragraph = docx.createP();
      paragraph.addText(text, style);
    }

    const title = `${semester}:  ${subject}  ${test_name}                                  UID: ${uid}`;
    docx.createP().addText(title, {
      bold: true,
      fontSize: 16,
      color: "black",
    });

    addStyledParagraph("GENERAL INSTRUCTIONS:", { bold: true });
    addStyledParagraph("1. STRICTLY NO ERASURE AND READ DIRECTIONS", {
      bold: true,
    });
    addStyledParagraph(
      "2. WRITE IN UPPERCASE ANSWER IN ORDER AND COMPLETELY ",
      { bold: true }
    );
    addStyledParagraph("3. PUT YOUR ANSWER IN THE CORRESPONDING BOXES ONLY", {
      bold: true,
    });
    addStyledParagraph("4. PUT EXTRA SPACE PER LETTER", { bold: true });
    addStyledParagraph("5. WRITE IN ENGINEERING LETTER", { bold: true });
    addStyledParagraph("EXAMPLE:", { bold: true });
    addStyledParagraph(" A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", {
      bold: true,
    });
    addStyledParagraph(" 0 1 2 3 4 5 6 7 8 9", { bold: true });

    docx.createP().addText("");
    const groupedQuestions = {};

    // Group questions by questionType
    questionsData.forEach((item) => {
      const questionType = item.questionType;
      const question = item.question;
      const options = item.options;
      const score = item.score;

      // Check if both questionType and question are defined and not empty
      if (questionType && question) {
        if (!groupedQuestions[questionType]) {
          groupedQuestions[questionType] = [];
        }
        groupedQuestions[questionType].push({ question, options, score });
      }
    });

    // Create a counter to track the number of unique question types
    let testCounter = 1;

    // Iterate through the grouped questions and add them to the Word document
    for (const questionType in groupedQuestions) {
      const questionsOfType = groupedQuestions[questionType];
      if (questionsOfType.length > 0) {
        // Convert the testCounter to a Roman numeral
        const romanNumeral = romanize(testCounter);

        // Determine the display text based on question type
        let displayText = "";
        let instructions = "";
        if (questionType === "MultipleChoice") {
          displayText = "Multiple Choice";
          instructions = "";
        } else if (questionType === "TrueFalse") {
          displayText = "TRUE or FALSE";
          instructions =
            "Write T if the statement is TRUE or F if the statement is FALSE.";
        } else if (questionType === "Identification") {
          displayText = "Identification";
        }

        const score = questionsOfType[0].score;
        addStyledParagraph(
          `TEST ${romanNumeral}. ${displayText} (${score} pts. each)`,
          {
            bold: true,
            fontSize: 16,
            color: "black",
          }
        );

        addStyledParagraph(instructions, {
          fontSize: 12,
          color: "black",
        });

        let questionNumber = 1; // Initialize question number

        questionsOfType.forEach((questionData, index) => {
          if (index > 0 && index % 20 === 0) {
            docx.createP().addText("\f");
          }

          addStyledParagraph(`${questionNumber}. ${questionData.question}`, {
            color: "black",
          });

          if (questionType === "MultipleChoice") {
            if (questionData.options && questionData.options.length > 0) {
              const validOptions = questionData.options
                .filter(option => option.text !== undefined && option.text !== "")
                .map((option, optionIndex) => {
                  return `  ${String.fromCharCode(97 + optionIndex)}.) ${option.text}`;
                });
              validOptions.forEach(validOption => addStyledParagraph(validOption, { color: "black" }));
            }
          }

          questionNumber++; // Increment question number
        });

        testCounter++; // Increment testCounter for the next type
      }
    }

    // Pipe the Word document to the response stream for download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    docx.generate(res);
  } catch (error) {
    console.error("Error generating Word document:", error);
    res.status(500).send("Error generating Word document");
  }
});

app.get("/getquestionstypeandnumber", async (req, res) => {
  const { TUPCID, uid } = req.query;

  try {
    // Construct the SQL query to retrieve the questions data
    const query =
      "SELECT questions FROM testpapers WHERE Professor_ID = ? AND UID_test = ?";
    // Execute the query with the provided parameters
    const [testdata] = await connection.query(query, [TUPCID, uid]);

    if (testdata.length >= 1) {
      // Extract questions data from the response
      const questionsData = JSON.parse(testdata[0].questions);

      // Extract questionNumber and questionType from questionsData
      const questionNumbers = questionsData.map(
        (question) => question.questionNumber
      );
      const questionTypes = questionsData.map(
        (question) => question.questionType
      );

      // Construct the response object with questionNumber and questionType
      const responseData = {
        questionNumbers,
        questionTypes,
      };

      res.status(200).json(responseData);
    } else {
      res.status(404).json({ error: "test data not found" });
    }
  } catch (error) {
    console.error("Error retrieving test data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/generateAnswerSheet/:uid/:sectionname", async (req, res) => {
  try {
    const { uid, sectionname } = req.params; // Extract parameters from the URL

    console.log("uid:", uid);
    console.log("sectionname:", sectionname);
    // Fetch data from the database based on the parameters
    const query = `
    SELECT questions, test_name
    FROM testpapers
    WHERE TRIM(UID_test) = ?;
  `;

    const query2 = `
    SELECT e.Student_TUPCID, s.FIRSTNAME, s.MIDDLENAME, s.SURNAME
    FROM enrolled_sections e
    INNER JOIN student_accounts s ON e.Student_TUPCID = s.TUPCID
    WHERE e.section_name = ?;
    `;

    const [testData] = await connection.query(query, [uid.trim()]);

    // Execute the second query to fetch data from 'enrollments' and 'student_accounts'
    const [studentData] = await connection.query(query2, [sectionname]);

    const test_name = testData[0].test_name;

    // Create a new PDF document
    const doc = new PDFDocument({
      size: "letter",
      margins: {
        top: 30,
        bottom: 10,
        left: 70,
        right: 20,
      },
    });
    const filename = `${test_name}.pdf`;
    const middleY = doc.page.width / 2;

    // Set the initial position for the dashed line
    doc.moveTo(middleY, 0).lineTo(middleY, 800).dash(3, { space: 5 }).stroke();

    // Reset the dash settings to default for further drawings
    doc.undash();
    // Define the box size and spacing
    const boxSize = 15;
    const boxSpacing = 1;
    const boxesPerQuestion = 10;

    // Define the line weight for boxes
    const boxLineWeight = 0.01;
    doc.fontSize(10);

    const boxStrokeColor = "#818582";

    if (studentData.length == 0) {
      const TUPCIDSTUDENT = "TUPC-XX-XXXX";
      const FIRSTNAME = "FIRSTNAME";
      const SURNAME = "SURNAME";

      // Define column widths and spacing
      const columnWidth = 200;
      doc.lineWidth(5);

      const questionsData = JSON.parse(testData[0].questions);
      const groupedQuestions = {};

      questionsData.forEach((item) => {
        const questionType = item.questionType;
        const type = item.type;

        if (questionType) {
          if (!groupedQuestions[questionType]) {
            groupedQuestions[questionType] = [];
          }
          groupedQuestions[questionType].push({
            questionNumber: item.questionNumber,
            type: item.type,
          });
        }
      });

      for (const questionType in groupedQuestions) {
        const questionsOfType = groupedQuestions[questionType];

        if (questionsOfType.length > 0) {
          let displayText = ``;

          if (questionType === "MultipleChoice") {
            displayText = "                MULTIPLE CHOICE";
          } else if (questionType === "TrueFalse") {
            displayText = "                TRUE OR FALSE";
          } else if (questionType === "Identification") {
            displayText = "                 IDENTIFICATION";
          }
          let alignment = "left";
          //Names
          doc.text(`${SURNAME}`, 95, 55, {
            width: columnWidth + 270,
            fontSize: 12,
            align: alignment,
            bold: true,
          });
          doc.moveDown(0.5);
          doc.text(`TUPCID: ${TUPCIDSTUDENT}`, {
            width: columnWidth + 270,
            fontSize: 12,
            align: alignment,
            bold: true,
          });
          doc.moveDown(0.5);
          doc.text(`UID: ${uid}`, {
            width: columnWidth + 210,
            fontSize: 12,
            align: alignment,
            bold: true,
          });

          if (questionsOfType[0].type === "TYPE 2") {
            typeoftest = "TYPE 2";
            alignment = "center";
          }
          //<10

          if (questionsOfType[0].type === "TYPE 2") {
            doc.text(`${uppercasedSurname}`, 40, 55, {
              width: columnWidth + 206,
              fontSize: 12,
              align: "right",
              bold: true,
            });
            doc.moveDown(0.5);
            doc.text(`TUPCID: ${Student_TUPCID}`, {
              width: columnWidth + 270,
              fontSize: 12,
              align: "right",
              bold: true,
            });
            doc.moveDown(0.5);
            doc.text(`UID: ${uid}`, {
              width: columnWidth + 212,
              fontSize: 12,
              align: "right",
              bold: true,
            });
          } else {
          }

          if (
            //Goods
            questionsOfType[0].type === "TYPE 1" &&
            questionType === "MultipleChoice"
          ) {
            doc
              .rect(35, 30, columnWidth + 30, 733)
              .stroke()
              .strokeColor("black");
          } else if (
            questionsOfType[0].type === "TYPE 1" &&
            questionType === "TrueFalse"
          ) {
            doc
              .rect(35, 30, columnWidth + 30, 733)
              .stroke()
              .strokeColor("black");
          } else if (
            questionsOfType[0].type === "TYPE 1" &&
            questionType === "Identification"
          ) {
            doc
              .rect(35, 30, columnWidth + 30, 733)
              .stroke()
              .strokeColor("black");
          }
          //Type 2 boxes
          if (
            questionsOfType[0].type === "TYPE 2" &&
            questionType === "MultipleChoice"
          ) {
            doc
              .rect(70 + 275, 30, columnWidth + 30, 733)
              .stroke()
              .strokeColor("black");
          } else if (
            //Goods
            questionsOfType[0].type === "TYPE 2" &&
            questionType === "TrueFalse"
          ) {
            doc
              .rect(70 + 275, 30, columnWidth + 30, 733)
              .stroke()
              .strokeColor("black");
          } else if (
            //Goods
            questionsOfType[0].type === "TYPE 2" &&
            questionType === "Identification"
          ) {
            doc
              .rect(70 + 275, 30, columnWidth + 30, 733)
              .stroke()
              .strokeColor("black");
          }

          //nice
          doc.text(`${displayText}`, 50, 110, {
            width: columnWidth + 540,
            align: alignment,
          });
          let questionNumber = 1;

          //<10
          doc.moveDown(3);
          questionsOfType.forEach(() => {
            if (questionNumber <= 9) {
              if (
                questionType === "Identification" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                //Goods
                doc.text(`${questionNumber}.  `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 118,
                  align: "right",
                });
              } else if (
                questionType === "TrueFalse" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 118,
                  align: "right",
                });
              } else if (
                questionType === "MultipleChoice" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + -98,
                  align: "center",
                });
              }
            }

            if (questionNumber >= 10) {
              if (
                questionType === "Identification" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc.text(`${questionNumber}.  `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 118,
                  align: "left",
                });
              } else if (
                questionType === "TrueFalse" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 118,
                  align: "right",
                });
              } else if (
                questionType === "MultipleChoice" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + -100,
                  align: "center",
                });
              }
            }

            if (questionNumber <= 9) {
              if (
                questionType === "Identification" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                //Goods
                doc.text(`${questionNumber}.  `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 118,
                  align: "right",
                });
              } else if (
                questionType === "TrueFalse" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 160,
                  align: "right",
                });
              } else if (
                questionType === "MultipleChoice" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + -98,
                  align: "center",
                });
              }
            }

            if (questionNumber >= 10) {
              if (
                questionType === "Identification" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc.text(`${questionNumber}.  `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 118,
                  align: "right",
                });
              } else if (
                questionType === "TrueFalse" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 160,
                  align: "right",
                });
              } else if (
                questionType === "MultipleChoice" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc.text(`${questionNumber}.   `, {
                  bold: true,
                  fontSize: 12,
                  width: columnWidth + 160,
                  align: "right",
                });
              }
            }

            // BOXES
            if (
              //Goods
              questionType === "MultipleChoice" &&
              questionsOfType[0].type === "TYPE 1"
            ) {
              doc
                .rect(doc.x + 55 + boxSpacing, doc.y - 16, boxSize, boxSize)
                .lineWidth(boxLineWeight)
                .stroke("#adb8af")
                .strokeColor("black");
            } else if (
              questionType === "Identification" &&
              questionsOfType[0].type === "TYPE 1"
            ) {
              doc
                .rect(doc.x + 45, doc.y - 16, 140, boxSize)
                .lineWidth(boxLineWeight)
                .stroke("#adb8af")
                .strokeColor("black");
            } else if (
              questionType === "TrueFalse" &&
              questionsOfType[0].type === "TYPE 1"
            ) {
              doc
                .rect(doc.x + 55 + boxSpacing, doc.y - 16, boxSize, boxSize)
                .lineWidth(boxLineWeight)
                .stroke("#adb8af")
                .strokeColor("black");
            } else if (
              questionType === "MultipleChoice" &&
              questionsOfType[0].type === "TYPE 2"
            ) {
              doc
                .rect(doc.x + 365, doc.y - 16, boxSize, boxSize)
                .lineWidth(boxLineWeight)
                .stroke("#adb8af")
                .strokeColor("black");
            } else if (
              questionType === "Identification" &&
              questionsOfType[0].type === "TYPE 2"
            ) {
              doc
                .rect(doc.x + 365, doc.y - 16, 140, boxSize)
                .lineWidth(boxLineWeight)
                .stroke("#adb8af")
                .strokeColor("black");
            } else if (
              //Goods
              questionType === "TrueFalse" &&
              questionsOfType[0].type === "TYPE 2"
            ) {
              doc
                .rect(doc.x + 365, doc.y - 16, boxSize, boxSize)
                .lineWidth(boxLineWeight)
                .stroke("#adb8af")
                .strokeColor("black");
            }

            doc.fill("black");
            doc.strokeColor("black");
            doc.moveDown(1.6);
            doc.lineWidth(5);
            questionNumber++;
          });
        }
      }
      doc.lineWidth(5);

      doc.moveDown(4);
    } else {
      for (const student of studentData) {
        // Extract student information
        const { Student_TUPCID, FIRSTNAME, SURNAME } = student;
        const uppercasedFirstName = FIRSTNAME.toUpperCase();
        const uppercasedSurname = SURNAME.toUpperCase();

        // Define column widths and spacing
        const columnWidth = 200;
        doc.lineWidth(5);

        // First rectangle informatiom

        const questionsData = JSON.parse(testData[0].questions);
        const groupedQuestions = {};

        questionsData.forEach((item) => {
          const questionType = item.questionType;
          const type = item.type;

          if (questionType) {
            if (!groupedQuestions[questionType]) {
              groupedQuestions[questionType] = [];
            }
            groupedQuestions[questionType].push({
              questionNumber: item.questionNumber,
              type: item.type,
            });
          }
        });

        for (const questionType in groupedQuestions) {
          const questionsOfType = groupedQuestions[questionType];

          if (questionsOfType.length > 0) {
            let displayText = ``;

            if (questionType === "MultipleChoice") {
              displayText = "                MULTIPLE CHOICE";
            } else if (questionType === "TrueFalse") {
              displayText = "                TRUE OR FALSE";
            } else if (questionType === "Identification") {
              displayText = "                 IDENTIFICATION";
            }
            // Determine the display text based on question type
            let alignment = "left";
            //Names
            doc.text(`${uppercasedSurname}`, 95, 55, {
              width: columnWidth + 270,
              fontSize: 12,
              align: alignment,
              bold: true,
            });
            doc.moveDown(0.5);
            doc.text(`TUPCID: ${Student_TUPCID}`, {
              width: columnWidth + 270,
              fontSize: 12,
              align: alignment,
              bold: true,
            });
            doc.moveDown(0.5);
            doc.text(`UID: ${uid}`, {
              width: columnWidth + 210,
              fontSize: 12,
              align: alignment,
              bold: true,
            });

            if (questionsOfType[0].type === "TYPE 2") {
              typeoftest = "TYPE 2";
              alignment = "center";
            }
            //<10

            if (
              questionsOfType[0].type === "TYPE 2" &&
              (questionType === "MultipleChoice" ||
                questionType === "TrueFalse")
            ) {
              doc.text(`${uppercasedSurname}`, 410, 55, {
                width: columnWidth + 230,
                fontSize: 12,
                align: "left",
                bold: true,
              });
              doc.moveDown(0.5);
              doc.text(`TUPCID: ${Student_TUPCID}`, {
                width: columnWidth + 270,
                fontSize: 12,
                align: "left",
                bold: true,
              });
              doc.moveDown(0.5);
              doc.text(`UID: ${uid}`, {
                width: columnWidth + 220,
                fontSize: 12,
                align: "left",
                bold: true,
              });
            } else if (
              questionsOfType[0].type === "TYPE 2" &&
              questionType === "Identification"
            ) {
              doc.text(`${uppercasedSurname}`, 415, 55, {
                width: columnWidth + 230,
                fontSize: 12,
                align: "left",
                bold: true,
              });
              doc.moveDown(0.5);
              doc.text(`TUPCID: ${Student_TUPCID}`, {
                width: columnWidth + 285,
                fontSize: 12,
                align: "left",
                bold: true,
              });
              doc.moveDown(0.5);
              doc.text(`UID: ${uid}`, {
                width: columnWidth + 233,
                fontSize: 12,
                align: "left",
                bold: true,
              });
            } else {
              // Handle other cases if needed
            }

            if (
              //Goods
              questionsOfType[0].type === "TYPE 1" &&
              questionType === "MultipleChoice"
            ) {
              doc
                .rect(35, 30, columnWidth + 30, 733)
                .stroke()
                .strokeColor("black");
            } else if (
              questionsOfType[0].type === "TYPE 1" &&
              questionType === "TrueFalse"
            ) {
              doc
                .rect(35, 30, columnWidth + 30, 733)
                .stroke()
                .strokeColor("black");
            } else if (
              questionsOfType[0].type === "TYPE 1" &&
              questionType === "Identification"
            ) {
              doc
                .rect(35, 30, columnWidth + 30, 733)
                .stroke()
                .strokeColor("black");
            }
            //Type 2 boxes
            if (
              questionsOfType[0].type === "TYPE 2" &&
              questionType === "MultipleChoice"
            ) {
              doc
                .rect(70 + 275, 30, columnWidth + 30, 733)
                .stroke()
                .strokeColor("black");
            } else if (
              //Goods
              questionsOfType[0].type === "TYPE 2" &&
              questionType === "TrueFalse"
            ) {
              doc
                .rect(70 + 275, 30, columnWidth + 30, 733)
                .stroke()
                .strokeColor("black");
            } else if (
              //Goods
              questionsOfType[0].type === "TYPE 2" &&
              questionType === "Identification"
            ) {
              doc
                .rect(70 + 275, 30, columnWidth + 30, 733)
                .stroke()
                .strokeColor("black");
            }

            //nice
            doc.text(`${displayText}`, 50, 110, {
              width: columnWidth + 564,
              align: alignment,
            });
            let questionNumber = 1;

            //<10
            doc.moveDown(3);
            questionsOfType.forEach(() => {
              if (questionNumber <= 9) {
                if (
                  questionType === "Identification" &&
                  questionsOfType[0].type === "TYPE 1"
                ) {
                  //Goods
                  doc.text(`${questionNumber}.  `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + -118,
                    align: "left",
                  });
                } else if (
                  questionType === "TrueFalse" &&
                  questionsOfType[0].type === "TYPE 1"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + -150,
                    align: "right",
                  });
                } else if (
                  questionType === "MultipleChoice" &&
                  questionsOfType[0].type === "TYPE 1"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + -98,
                    align: "center",
                  });
                }
              }

              if (questionNumber >= 10) {
                if (
                  questionType === "Identification" &&
                  questionsOfType[0].type === "TYPE 1"
                ) {
                  doc.text(`${questionNumber}.  `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + -118,
                    align: "left",
                  });
                } else if (
                  questionType === "TrueFalse" &&
                  questionsOfType[0].type === "TYPE 1"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + -150,
                    align: "right",
                  });
                } else if (
                  questionType === "MultipleChoice" &&
                  questionsOfType[0].type === "TYPE 1"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + -100,
                    align: "center",
                  });
                }
              }

              if (questionNumber <= 9) {
                if (
                  questionType === "Identification" &&
                  questionsOfType[0].type === "TYPE 2"
                ) {
                  //Goods
                  doc.text(`${questionNumber}.  `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + 118,
                    align: "right",
                  });
                } else if (
                  questionType === "TrueFalse" &&
                  questionsOfType[0].type === "TYPE 2"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + 160,
                    align: "right",
                  });
                } else if (
                  questionType === "MultipleChoice" &&
                  questionsOfType[0].type === "TYPE 2"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + 160,
                    align: "right",
                  });
                }
              }

              if (questionNumber >= 10) {
                if (
                  questionType === "Identification" &&
                  questionsOfType[0].type === "TYPE 2"
                ) {
                  doc.text(`${questionNumber}.  `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + 118,
                    align: "right",
                  });
                } else if (
                  questionType === "TrueFalse" &&
                  questionsOfType[0].type === "TYPE 2"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + 160,
                    align: "right",
                  });
                } else if (
                  questionType === "MultipleChoice" &&
                  questionsOfType[0].type === "TYPE 2"
                ) {
                  doc.text(`${questionNumber}.   `, {
                    bold: true,
                    fontSize: 12,
                    width: columnWidth + 160,
                    align: "right",
                  });
                }
              }

              // BOXES
              if (
                //Goods
                questionType === "MultipleChoice" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc
                  .rect(doc.x + 55 + boxSpacing, doc.y - 16, boxSize, boxSize)
                  .lineWidth(boxLineWeight)
                  .stroke("#adb8af")
                  .strokeColor("black");
              } else if (
                questionType === "Identification" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc
                  .rect(doc.x + 45, doc.y - 16, 140, boxSize)
                  .lineWidth(boxLineWeight)
                  .stroke("#adb8af")
                  .strokeColor("black");
              } else if (
                questionType === "TrueFalse" &&
                questionsOfType[0].type === "TYPE 1"
              ) {
                doc
                  .rect(doc.x + 55 + boxSpacing, doc.y - 16, boxSize, boxSize)
                  .lineWidth(boxLineWeight)
                  .stroke("#adb8af")
                  .strokeColor("black");
              } else if (
                questionType === "MultipleChoice" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc
                  .rect(doc.x + 365, doc.y - 16, boxSize, boxSize)
                  .lineWidth(boxLineWeight)
                  .stroke("#adb8af")
                  .strokeColor("black");
              } else if (
                questionType === "Identification" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc
                  .rect(doc.x + 365, doc.y - 16, 140, boxSize)
                  .lineWidth(boxLineWeight)
                  .stroke("#adb8af")
                  .strokeColor("black");
              } else if (
                //Goods
                questionType === "TrueFalse" &&
                questionsOfType[0].type === "TYPE 2"
              ) {
                doc
                  .rect(doc.x + 365, doc.y - 16, boxSize, boxSize)
                  .lineWidth(boxLineWeight)
                  .stroke("#adb8af")
                  .strokeColor("black");
              }

              doc.fill("black");
              doc.strokeColor("black");
              doc.moveDown(1.6);
              doc.lineWidth(5);
              questionNumber++;
            });
          }
        }
        doc.lineWidth(5);

        doc.moveDown(4);

        // Add a page break for the next student (except for the last one)
        if (student !== studentData[studentData.length - 1]) {
          doc.addPage();
          const middleY = doc.page.width / 2;

          // Set the initial position for the dashed line
          doc
            .moveTo(middleY, 0)
            .lineTo(middleY, 800)
            .dash(3, { space: 5 })
            .stroke();

          // Reset the dash settings to default for further drawings
          doc.undash();
        }
      }
    }

    // Pipe the PDF to the response stream
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Finalize the PDF and end the response stream
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Error generating PDF");
  }
});

app.get("/getquestionstypeandnumberandanswer", async (req, res) => {
  const { uid } = req.query;
  try {
    // Construct the SQL query to retrieve the questions data
    const query = `
      SELECT questions
      FROM testpapers
      WHERE UID_test = ?
    `;

    // Execute the query with the provided parameters
    const [testdata] = await connection.query(query, [uid]);

    if (testdata.length >= 1) {
      // Extract questions data from the response
      const questionsData = JSON.parse(testdata[0].questions);

      // Extract questionNumber, questionType, and answer from questionsData
      const questionNumbers = questionsData.map(
        (question) => question.questionNumber
      );
      const questionTypes = questionsData.map(
        (question) => question.questionType
      );
      const answers = questionsData.map((question) => question.answer);
      const score = questionsData.map((question) => question.score);
      const totalscore = questionsData.map((question) => question.TotalScore);

      const totalScoreValue = totalscore
        .filter((score) => typeof score === "number")
        .pop();

      // Construct the response object with questionNumber, questionType, and answers
      const responseData = {
        questionNumbers,
        questionTypes,
        answers,
        score,
        totalScoreValue,
      };

      res.status(200).json(responseData);
    } else {
      console.log("Test data not found for UID:", uid);
      res.status(404).json({ error: "test data not found" });
    }
  } catch (error) {
    console.error("Error retrieving test data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/results", async (req, res) => {
  try {
    const { TUPCID, UID, questionType, answers } = req.body;

    // Insert data into the database
    const query = `
      INSERT INTO results
      (TUPCID, UID, questionType, answers, results_takendate) 
      VALUES (?, ?, ?, ?, NOW())
    `;

    const values = [
      TUPCID || null,
      UID || null,
      JSON.stringify(questionType),
      JSON.stringify(answers),
    ];

    await connection.query(query, values);

    // Respond with a success message
    res
      .status(200)
      .json({ message: "Data added to the database successfully" });
  } catch (error) {
    console.error("Error adding data to the database:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.get("/resultsexist/:UID/:TUPCID", async (req, res) => {
  try {
    const { UID, TUPCID } = req.params;

    const query = `
      SELECT COUNT(*) AS count 
      FROM results 
      WHERE UID = ? AND TUPCID = ? AND UID IS NOT NULL AND TUPCID IS NOT NULL
    `;

    const values = [UID || null, TUPCID || null];

    const result = await connection.query(query, values);

    if (result && result.length > 0) {
      const count = result[0].count !== undefined ? result[0].count : 0;

      res.status(200).json({ count });
    } else {
      res.status(200).json({ count: 0 });
    }
  } catch (error) {
    console.error("Error checking data in the database:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.put("/updateresults/:TUPCID", async (req, res) => {
  try {
    const { TUPCID } = req.params;
    const { questionType, answers } = req.body;
    console.log("ID:", TUPCID);
    // Update the record in the database based on TUPCID
    const updateQuery = `
      UPDATE results
      SET questionType = ?, answers = ?, results_takendate = CURRENT_TIMESTAMP
      WHERE TUPCID = ?
    `;
    console.log("tupcid check:", TUPCID);
    const values = [
      JSON.stringify(questionType) || null,
      JSON.stringify(answers) || null,
      TUPCID || null,
    ];

    await connection.query(updateQuery, values);

    // Respond with a success message
    res
      .status(200)
      .json({ message: "Data updated in the database successfully" });
  } catch (error) {
    console.error("Error updating data in the database:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.message });
  }
});

app.get("/getstudentanswers", async (req, res) => {
  const { TUPCID, UID } = req.query;

  try {
    // Construct the SQL query to retrieve the student answers data with the latest timestamp
    const query = `
      SELECT TESTTYPE, results
      FROM  student_results
      WHERE TUPCID = ? AND UID = ?
    `;

    // Execute the query with the provided parameters
    const [studentAnswerData] = await connection.query(query, [TUPCID, UID]);

    if (studentAnswerData && studentAnswerData.length > 0) {
      const responseData = {
        studentAnswers: studentAnswerData[0], // Assuming results are structured in an array
      };
      console.log(responseData)
      res.status(200).json(responseData);
    } else {
      console.log("Student answer data not found for TUPCID:", TUPCID, "and UID:", UID);
      res.status(404).json({ error: "Student answer data not found" });
    }
  } catch (error) {
    console.error("Error retrieving student answer data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/Studentname/:TUPCID", async (req, res) => {
  const { TUPCID } = req.params;
  try {
    const query =
      "SELECT FIRSTNAME, MIDDLENAME, SURNAME FROM student_accounts WHERE TUPCID = ?";
    const [studentData] = await connection.query(query, [TUPCID]);

    if (studentData.length > 0) {
      const { FIRSTNAME, SURNAME, MIDDLENAME } = studentData[0];

      return res.status(202).send({
        TUPCID,
        FIRSTNAME,
        SURNAME,
        MIDDLENAME,
      });
    } else {
      return res.status(404).send({ message: "Student not found" });
    }
  } catch (error) {
    return res.status(500).send({ message: "Failed to fetch student data" });
  }
});

app.put("/updatestudentanswers/:studentid/:uid", async (req, res) => {
  const { studentid, uid } = req.params;

  try {
    // Fetch student answers from the results table
    const resultQuery = `
      SELECT answers
      FROM results
      WHERE TUPCID = ? AND UID = ?;
    `;
    const [result] = await connection.query(resultQuery, [studentid, uid]);

    // Fetch questions from the testpapers table
    const testpaperQuery = `
      SELECT questions
      FROM testpapers
      WHERE UID_test = ?;
    `;
    const [testpaper] = await connection.query(testpaperQuery, [uid]);

    if (result.length >= 1 && testpaper.length >= 1) {
      const studentAnswers = JSON.parse(result[0].answers);
      const testpaperQuestions = JSON.parse(testpaper[0].questions);

      const updatedAnswers = studentAnswers.map((answer) => {
        const matchingQuestion = testpaperQuestions.find(
          (question) =>
            question.questionNumber === answer.questionNumber &&
            question.type === answer.type
        );

        console.log("typeANSWER", answer.type);
        console.log("type", matchingQuestion.type);

        if (matchingQuestion && matchingQuestion.answer === answer.answer) {
          answer.score = matchingQuestion.score;
        } else {
          answer.score = 0;
        }

        return answer;
      });

      const updateQuery = `
        UPDATE results
        SET answers = ?
        WHERE TUPCID = ? AND UID = ?;
      `;
      await connection.query(updateQuery, [
        JSON.stringify(updatedAnswers),
        studentid,
        uid,
      ]);

      res.status(200).json({ updatedAnswers });
    } else {
      res
        .status(404)
        .json({ error: "Student answer data or testpaper not found" });
    }
  } catch (error) {
    console.error("Error updating student answers:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/Studentscores/:uid", async (req, res) => {
  const { uid } = req.params;

  try {
    const query = `SELECT sr.TUPCID, sr.TOTALSCORE, sr.MAXSCORE, sr.CORRECT, sr.WRONG, sa.FIRSTNAME, sa.SURNAME
      FROM student_results sr
      JOIN student_accounts sa ON sr.TUPCID = sa.TUPCID
      WHERE sr.UID = ? AND sr.results_out = (
        SELECT MAX(results_out)
        FROM student_results
        WHERE TUPCID = sr.TUPCID
      )`;
    const query2 = "SELECT questions FROM testpapers WHERE UID_test = ?";
    const [studentScores] = await connection.query(query, [uid]);
    const [qcount] = await connection.query(query2, [uid]);

    if (studentScores.length > 0) {
      const studentlist = studentScores.map((result) => ({
        TUPCID: result.TUPCID,
        FIRSTNAME: result.FIRSTNAME,
        SURNAME: result.SURNAME,
        TOTALSCORE: result.TOTALSCORE,
        CORRECT: result.CORRECT,
        WRONG: result.WRONG,
        MAXSCORE: result.MAXSCORE,
      }));

      let numQuestions = 0;
      if (qcount.length > 0) {
        console.log(qcount[0])
        const questions = JSON.parse(qcount[0].questions);
        numQuestions = questions.length - 1;
      } else {
        console.log("No questions found for UID:", uid);
      }
      return res.status(200).send({ studentlist, numQuestions });
    } else {
      return res.status(404).send({ message: "Student scores not found" });
    }
  } catch (error) {
    console.error("Failed to fetch student scores:", error);
    return res.status(500).send({ message: "Failed to fetch student scores" });
  }
});

app.get("/Studentname2", async (req, res) => {
  const { studentid } = req.query;
  try {
    const query = "SELECT TUPCID FROM student_accounts WHERE uid = ?";
    const [studentData] = await connection.query(query, [studentid]);

    if (studentData.length > 0) {
      const { TUPCID } = studentData[0];

      return res.status(202).send({
        TUPCID,
      });
    } else {
      return res.status(404).send({ message: "Student not found" });
    }
  } catch (error) {
    return res.status(500).send({ message: "Failed to fetch student data" });
  }
});

app.get("/myresult", async (req, res) => {
  const { TUPCID, uid } = req.query;

  try {
    const query =
      "SELECT results, CORRECT, WRONG, TOTALSCORE, MAXSCORE FROM student_results WHERE UID = ? AND TUPCID = ?";
    const [studentScores] = await connection.query(query, [uid, TUPCID]);

    if (studentScores.length > 0) {
      const resultlist = [];

      for (const result of studentScores) {
        const { results, CORRECT, WRONG, TOTALSCORE, MAXSCORE } = result;

        resultlist.push({ results, CORRECT, WRONG, TOTALSCORE, MAXSCORE });
      }

      return res.status(200).send({ resultlist });
    } else {
      return res.status(404).send({ message: "Student scores not found" });
    }
  } catch (error) {
    console.error("Failed to fetch student scores:", error);
    return res
      .status(500)
      .send({ message: "Failed to fetch student scores", error });
  }
});

app.get("/printstudentrecord/:uid", async (req, res) => {
  try {
    const { uid } = req.params;

    // Fetch student scores data with the latest record for each TUPCID
    const query = `
      SELECT sr.TUPCID, sr.CORRECT, sr.WRONG, sr.TOTALSCORE, sr.MAXSCORE, sr.results_out,
             sa.FIRSTNAME, sa.SURNAME
      FROM student_results sr
      JOIN (
        SELECT TUPCID, MAX(results_out) AS latest_result
        FROM student_results
        WHERE UID = ?
        GROUP BY TUPCID
      ) latest ON sr.TUPCID = latest.TUPCID AND sr.results_out = latest.latest_result
      JOIN student_accounts sa ON sr.TUPCID = sa.TUPCID
      WHERE sr.UID = ?
    `;

    const [studentScores] = await connection.query(query, [uid, uid]);

    if (studentScores.length > 0) {
      const studentlist = [];
      let idCounter = 1; // Initialize the counter for id

      for (const result of studentScores) {
        const {
          TUPCID,
          CORRECT,
          WRONG,
          TOTALSCORE,
          MAXSCORE,
          results_out,
          FIRSTNAME,
          SURNAME,
        } = result;

        studentlist.push({
          id: idCounter++, // Increment the counter for each record
          TUPCID,
          FIRSTNAME,
          SURNAME,
          TOTALSCORE,
          CORRECT,
          WRONG,
          MAXSCORE,
          results_out,
        });
      }

      // Generate Excel content using studentlist data
      let xlsx = officegen("xlsx");
      let sheet = xlsx.makeNewSheet();
      sheet.name = "Student Records";

      sheet.setCell("A1", "ID");
      sheet.setCell("B1", "TUPCID");
      sheet.setCell("C1", "FIRSTNAME");
      sheet.setCell("D1", "SURNAME");
      sheet.setCell("E1", "TOTALSCORE");
      sheet.setCell("F1", "Correct");
      sheet.setCell("G1", "Wrong");
      sheet.setCell("H1", "MAXSCORE");
      sheet.setCell("I1", "RESULTS TAKEN");

      // Add data to the sheet based on fetched records:
      studentlist.forEach((record, index) => {
        const rowIndex = index + 2;
        sheet.setCell(`A${rowIndex}`, record.id);
        sheet.setCell(`B${rowIndex}`, record.TUPCID);
        sheet.setCell(`C${rowIndex}`, record.FIRSTNAME);
        sheet.setCell(`D${rowIndex}`, record.SURNAME);
        sheet.setCell(`E${rowIndex}`, record.TOTALSCORE);
        sheet.setCell(`F${rowIndex}`, record.CORRECT);
        sheet.setCell(`G${rowIndex}`, record.WRONG);
        sheet.setCell(`H${rowIndex}`, record.MAXSCORE);
        const date = new Date(record.results_out);

        const formattedDate = date.toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        sheet.setCell(`I${rowIndex}`, formattedDate);
      });

      // Set headers for response
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="example.xlsx"'
      );

      // Pipe the generated Excel file directly to the response stream
      xlsx.generate(res);

      console.log("Excel file generation initiated for UID:", uid);
    } else {
      return res.status(404).send({ message: "Student scores not found" });
    }
  } catch (error) {
    console.error("Error while generating Excel file:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.put("/updateTotalScore/:TUPCID", async (req, res) => {
  try {
    const { TUPCID } = req.params;
    const { UID } = req.query;
    const { CORRECT, WRONG, TOTALSCORE } = req.body; // Get the updated values for correct and wrong answers

    // Update CORRECT and WRONG in the database for the given TUPCID
    const updateScoreQuery =
      "UPDATE student_results SET CORRECT = ?, WRONG = ?, TOTALSCORE = ? WHERE TUPCID = ? AND UID = ?";
    await connection.query(updateScoreQuery, [
      CORRECT,
      WRONG,
      TOTALSCORE,
      TUPCID,
      UID,
    ]);

    // Send success response
    res.status(200).send("CORRECT and WRONG updated successfully");
  } catch (error) {
    console.error("Error updating CORRECT and WRONG:", error);
    res.status(500).send("Error updating CORRECT and WRONG");
  }
});

//auditlogstart here
app.get("/generateloginaudit", async (req, res) => {
  try {
    const [loginRecords] = await connection.query(
      "SELECT TUPCID, PROFILE, STATUS, TIMESTAMP FROM overalllogin_log"
    );

    // Create a map to store login and logout times based on TUPCID
    const loginLogoutMap = {};

    loginRecords.forEach(({ TUPCID, PROFILE, STATUS, TIMESTAMP }) => {
      if (!loginLogoutMap[TUPCID]) {
        loginLogoutMap[TUPCID] = { profile: PROFILE };
      }

      if (STATUS === "ONLINE") {
        loginLogoutMap[TUPCID].loginTime = TIMESTAMP;
      } else if (STATUS === "OFFLINE") {
        loginLogoutMap[TUPCID].logoutTime = TIMESTAMP;
      }
    });

    // Format login and logout times to date and time strings
    const adminList = Object.keys(loginLogoutMap).map((TUPCID, index) => {
      const { loginTime, logoutTime, profile } = loginLogoutMap[TUPCID];

      const formattedLoginDate = loginTime
        ? new Date(loginTime).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;
      const formattedLoginTime = loginTime
        ? new Date(loginTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
          })
        : null;

      const formattedLogoutDate = logoutTime
        ? new Date(logoutTime).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;
      const formattedLogoutTime = logoutTime
        ? new Date(logoutTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
          })
        : null;

      return {
        id: index + 1,
        TUPCID,
        PROFILE: profile,
        loginDate: formattedLoginDate,
        loginTime: formattedLoginTime,
        logoutDate: formattedLogoutDate,
        logoutTime: formattedLogoutTime,
      };
    });

    // Create a new Excel document
    const officegen = require("officegen");
    let xlsx = officegen("xlsx");
    let sheet = xlsx.makeNewSheet();
    sheet.name = "AdminAuditLog";

    // Add headers to the sheet
    sheet.data[0] = [
      "No.",
      "ID ACCOUNT",
      "PROFILE",
      "LOGIN TIME",
      "LOGOUT TIME",
      "DATE",
    ];

    // Add data to the sheet
    adminList.forEach((admin, index) => {
      sheet.data[index + 1] = [
        admin.id,
        admin.TUPCID,
        admin.PROFILE,
        admin.loginTime || "N/A",
        admin.logoutTime || "N/A",
        admin.loginDate || "N/A",
      ];
    });

    // Set headers for response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="AdminAuditLog.xlsx"'
    );

    // Generate the Excel file and send it in the response
    xlsx.generate(res);

    console.log("Excel file generation initiated for Admin Audit Log");
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).send("Error generating Excel file");
  }
});

app.get("/generatefacultylog", async (req, res) => {
  try {
    // Fetch data from the 'faculty_accounts' table
    const [rows] = await connection.query(
      "SELECT TUPCID, SURNAME, FIRSTNAME, MIDDLENAME, GSFEACC, SUBJECTDEPT, REGISTEREDDATE FROM faculty_accounts"
    );

    const facultyList = [];

    rows.forEach((faculty, index) => {
      const date = new Date(faculty.REGISTEREDDATE);
      const formattedDate = date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      facultyList.push({
        id: index + 1,
        acc: faculty.TUPCID,
        firstName: faculty.FIRSTNAME,
        middleName: faculty.MIDDLENAME,
        surname: faculty.SURNAME,
        gsfeacc: faculty.GSFEACC,
        subjectDept: faculty.SUBJECTDEPT,
        register: formattedDate, // Add formatted date to the faculty list
      });
    });

    // Create a new Excel document
    let xlsx = officegen("xlsx");
    let sheet = xlsx.makeNewSheet();
    sheet.name = "FacultyAuditLog";

    // Add headers to the sheet
    sheet.data[0] = [
      "No.",
      "ID ACCOUNT",
      "FIRSTNAME",
      "MIDDLENAME",
      "SURNAME",
      "GSFE ACCOUNT",
      "SUBJECT DEPARTMENT",
      "REGISTERED DATE",
    ];

    // Add data to the sheet
    facultyList.forEach((faculty, index) => {
      sheet.data[index + 1] = [
        faculty.id,
        faculty.acc,
        faculty.firstName,
        faculty.middleName,
        faculty.surname,
        faculty.gsfeacc,
        faculty.subjectDept,
        faculty.register,
      ];
    });

    // Set headers for response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="FacultyAuditLog.xlsx"'
    );

    // Generate the Excel file and send it in the response
    xlsx.generate(res);

    console.log("Excel file generation initiated for Faculty Audit Log");
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).send("Error generating Excel file");
  }
});

app.get("/generatetestlistlog", async (req, res) => {
  try {
    // Fetch data from the 'faculty_testlist' table
    const [rows] = await connection.query(
      "SELECT Professor_ID, Professor_FirstName, Professor_MiddleName, Professor_LastName, Professor_SubjectDept, TestName, Subject, Section_Name, Semester, Uid_Section, Uid_Test, date_created FROM faculty_testlist"
    );

    // Create an instance of officegen Excel
    let xlsx = officegen("xlsx");
    let sheet = xlsx.makeNewSheet();
    sheet.name = "Test List Records";

    // Add headers to the sheet
    sheet.setCell("A1", "ID");
    sheet.setCell("B1", "Professor ID");
    sheet.setCell("C1", "First Name");
    sheet.setCell("D1", "Middle Name");
    sheet.setCell("E1", "Last Name");
    sheet.setCell("F1", "Subject Department");
    sheet.setCell("G1", "Test Name");
    sheet.setCell("H1", "Subject");
    sheet.setCell("I1", "Section Name");
    sheet.setCell("J1", "Semester");
    sheet.setCell("K1", "Uid Section");
    sheet.setCell("L1", "Uid Test");
    sheet.setCell("M1", "Date Created");

    // Add data to the sheet based on fetched records
    rows.forEach((record, index) => {
      const rowIndex = index + 2;
      sheet.setCell(`A${rowIndex}`, index + 1); // ID acting as index
      sheet.setCell(`B${rowIndex}`, record.Professor_ID);
      sheet.setCell(`C${rowIndex}`, record.Professor_FirstName);
      sheet.setCell(`D${rowIndex}`, record.Professor_MiddleName);
      sheet.setCell(`E${rowIndex}`, record.Professor_LastName);
      sheet.setCell(`F${rowIndex}`, record.Professor_SubjectDept);
      sheet.setCell(`G${rowIndex}`, record.TestName);
      sheet.setCell(`H${rowIndex}`, record.Subject);
      sheet.setCell(`I${rowIndex}`, record.Section_Name);
      sheet.setCell(`J${rowIndex}`, record.Semester);
      sheet.setCell(`K${rowIndex}`, record.Uid_Section);
      sheet.setCell(`L${rowIndex}`, record.Uid_Test);

      const date = new Date(record.date_created); // Assuming date_created is in 'YYYY-MM-DD HH:MM:SS' format
      const formattedDate = date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      sheet.setCell(`M${rowIndex}`, formattedDate); // Add formatted date to the sheet
    });

    // Set response headers for Excel file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="TestListRecords.xlsx"'
    );

    // Pipe the generated Excel file directly to the response stream
    xlsx.generate(res);

    console.log("Excel file generation initiated for Test List Records");
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).send("Error generating Excel file");
  }
});

app.get("/generatestudentlistlog", async (req, res) => {
  try {
    // Fetch data from the 'student_accounts' table
    const [rows] = await connection.query(
      "SELECT TUPCID, FIRSTNAME, MIDDLENAME, SURNAME, GSFEACC, COURSE, SECTION, YEAR, STATUS, REGISTEREDDATE FROM student_accounts"
    );

    const studentList = rows.map((student, index) => {
      const date = new Date(student.REGISTEREDDATE);
      const formattedDate = date.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      return {
        id: index + 1,
        TUPCID: student.TUPCID,
        FIRSTNAME: student.FIRSTNAME,
        MIDDLENAME: student.MIDDLENAME,
        SURNAME: student.SURNAME,
        GSFEACC: student.GSFEACC,
        COURSE: student.COURSE,
        SECTION: student.SECTION,
        YEAR: student.YEAR,
        STATUS: student.STATUS,
        REGISTEREDDATE: formattedDate, // Add formatted date to the object
      };
    });

    // Create a new instance of officegen
    const officegen = require("officegen");
    const xlsx = officegen("xlsx");

    // Create a new worksheet
    const sheet = xlsx.makeNewSheet();
    sheet.name = "StudentListRecords";

    // Add headers to the sheet
    sheet.data.push([
      "ID",
      "TUPCID",
      "FIRSTNAME",
      "MIDDLENAME",
      "SURNAME",
      "GSFEACC",
      "COURSE",
      "SECTION",
      "YEAR",
      "STATUS",
      "REGISTEREDDATE",
    ]);

    // Add data to the sheet based on fetched records
    studentList.forEach((student) => {
      sheet.data.push([
        student.id,
        student.TUPCID,
        student.FIRSTNAME,
        student.MIDDLENAME,
        student.SURNAME,
        student.GSFEACC,
        student.COURSE,
        student.SECTION,
        student.YEAR,
        student.STATUS,
        student.REGISTEREDDATE,
      ]);
    });

    // Set response headers for Excel file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="StudentListRecords.xlsx"'
    );

    // Pipe the generated Excel file directly to the response stream
    xlsx.generate(res, {
      finalize: (written) => {
        console.log("Excel file generation initiated for Student List Records");
      },
    });
  } catch (error) {
    console.error("Error generating Excel file:", error);
    res.status(500).send("Error generating Excel file");
  }
});

//PRESET OF QUESTIONS

app.post("/addtopreset", async (req, res) => {
  const { Professor_ID, TESTNAME, UID, data } = req.body;
  const questionsToSave = JSON.stringify(data);
  try{
    const exist = await checktestbankexist(Professor_ID, UID, TESTNAME);
    if(exist){
      const updatequery = "UPDATE preset_questions SET questions = ?, questions_saved = NOW() WHERE Professor_ID = ? AND UID = ? AND testname = ?"
      await connection.query(updatequery, [questionsToSave, Professor_ID, UID, TESTNAME]);
      return res.status(200).send({message: "Successfully update"})
    }else{
      const insertQuery = `
      INSERT INTO preset_questions (Professor_ID, TESTNAME, UID, questions, questions_saved)
      VALUES (?, ?, ?, ?, NOW())
    `;
    await connection.query(insertQuery, [Professor_ID, TESTNAME, UID, questionsToSave])
    return res.status(200).send({message: "Successfully inserted"})
    }
  }catch(error){
    throw error;
  }}
);

//Preset
app.get("/Preset", async (req, res) => {
  const { UidProf } = req.query;
  try {
    const query =
      "SELECT TESTNAME, UID, questions, questions_saved FROM preset_questions WHERE Professor_ID = ?";
    const [row] = await connection.query(query, [UidProf]);

    return res.status(200).json(row);
  } catch (err) {
    return res.status(500).send({ message: "Internal server error" });
  }
});

//for questions
app.get("/PresetQuestions", async (req, res) => {
  const { TestId } = req.query;

  try {
    const query = "SELECT questions FROM preset_questions WHERE UID = ?";
    const [row] = await connection.query(query, [TestId]);

    // Extract and filter out only the TotalScore object
    const allQuestions = row
      .flatMap((item) => {
        const parsedQuestions = JSON.parse(item.questions || "[]");
        return parsedQuestions;
      })
      .filter((question) => {
        if (question && "TotalScore" in question) {
          return false; // Filter out TotalScore
        }

        // Filter out options based on the answer
        if (question && question.options && question.answer) {
          question.options = question.options
            .filter((option) => option.label === question.answer)
            .map((option) => option.text); // Extracting text values from options
        }

        return true;
      });

    console.log("alldata:", allQuestions);
    return res.status(200).json(allQuestions);
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "Internal server error" });
  }
});

//logout

app.post("/studentlogout", async (req, res) => {
  const { TUPCID, PROFILE, STATUS } = req.body;
  const TIMESTAMP = new Date();

  try {
    const query = "SELECT TUPCID FROM student_accounts WHERE uid = ?";
    const [studentData] = await connection.query(query, [TUPCID]);

    if (studentData.length > 0) {
      const actualTUPCID = studentData[0].TUPCID;

      const checkOfflineStatusQuery =
        "SELECT * FROM login_log WHERE TUPCID = ? AND STATUS = ?";
      const checkOfflineStatusValues = [actualTUPCID, STATUS];
      const [existingOfflineRecord] = await connection.query(
        checkOfflineStatusQuery,
        checkOfflineStatusValues
      );

      if (existingOfflineRecord.length > 0) {
        const updateLoginLogQuery =
          "UPDATE login_log SET TIMESTAMP = ? WHERE TUPCID = ? AND STATUS = ?";
        const updateLoginLogValues = [TIMESTAMP, actualTUPCID, STATUS];
        await connection.query(updateLoginLogQuery, updateLoginLogValues);
      } else {
        const loginLogQuery =
          "INSERT INTO login_log (TUPCID, PROFILE, STATUS, TIMESTAMP) VALUES (?, ?, ?, ?)";
        const loginLogValues = [actualTUPCID, PROFILE, STATUS, TIMESTAMP];
        await connection.query(loginLogQuery, loginLogValues);

        const overallLoginLogQuery =
          "INSERT INTO overalllogin_log (TUPCID, PROFILE, STATUS, TIMESTAMP) VALUES (?, ?, ?, ?)";
        const overallLoginLogValues = [
          actualTUPCID,
          PROFILE,
          STATUS,
          TIMESTAMP,
        ];
        await connection.query(overallLoginLogQuery, overallLoginLogValues);
      }

      res.status(200).json({ message: "Logout successful" });
    } else {
      res.status(404).json({ message: "Invalid TUPCID" });
    }
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "An error occurred during logout" });
  }
});

app.post("/facultylogout", async (req, res) => {
  const { TUPCID, PROFILE, STATUS } = req.body;
  const TIMESTAMP = new Date();

  try {
    const query = "SELECT TUPCID FROM faculty_accounts WHERE uid = ?";
    const [facultyData] = await connection.query(query, [TUPCID]);

    if (facultyData.length > 0) {
      const actualTUPCID = facultyData[0].TUPCID;

      const checkOfflineStatusQuery =
        "SELECT * FROM login_log WHERE TUPCID = ? AND STATUS = ?";
      const checkOfflineStatusValues = [actualTUPCID, STATUS];
      const [existingOfflineRecord] = await connection.query(
        checkOfflineStatusQuery,
        checkOfflineStatusValues
      );

      if (existingOfflineRecord.length > 0) {
        const updateLoginLogQuery =
          "UPDATE login_log SET TIMESTAMP = ? WHERE TUPCID = ? AND STATUS = ?";
        const updateLoginLogValues = [TIMESTAMP, actualTUPCID, STATUS];
        await connection.query(updateLoginLogQuery, updateLoginLogValues);
      } else {
        const loginLogQuery =
          "INSERT INTO login_log (TUPCID, PROFILE, STATUS, TIMESTAMP) VALUES (?, ?, ?, ?)";
        const loginLogValues = [actualTUPCID, PROFILE, STATUS, TIMESTAMP];
        await connection.query(loginLogQuery, loginLogValues);

        const overallLoginLogQuery =
          "INSERT INTO overalllogin_log (TUPCID, PROFILE, STATUS, TIMESTAMP) VALUES (?, ?, ?, ?)";
        const overallLoginLogValues = [
          actualTUPCID,
          PROFILE,
          STATUS,
          TIMESTAMP,
        ];
        await connection.query(overallLoginLogQuery, overallLoginLogValues);
      }

      res.status(200).json({ message: "Logout successful" });
    } else {
      res.status(404).json({ message: "Invalid TUPCID" });
    }
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({ message: "An error occurred during logout" });
  }
});

//ADMIN DASHBOARD

app.get("/getstudentrecords", async (req, res) => {
  try {
    const query = "SELECT * FROM student_accounts";
    const [studentRecords] = await connection.query(query);

    // Format the REGISTEREDDATE field for each record
    const formattedStudentRecords = studentRecords.map((record) => {
      const formattedDate = new Date(record.REGISTEREDDATE).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
      return {
        ...record,
        REGISTEREDDATE: formattedDate,
      };
    });

    res.status(200).json(formattedStudentRecords);
  } catch (error) {
    console.error("Error fetching student records:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching student records" });
  }
});

app.get("/getfacultyrecords", async (req, res) => {
  try {
    const query = "SELECT * FROM faculty_accounts";
    const [facultyRecords] = await connection.query(query);

    // Format the REGISTEREDDATE field for each record
    const formattedFacultyRecords = facultyRecords.map((record) => {
      const formattedDate = new Date(record.REGISTEREDDATE).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      );
      return {
        ...record,
        REGISTEREDDATE: formattedDate,
      };
    });

    res.status(200).json(formattedFacultyRecords);
  } catch (error) {
    console.error("Error fetching faculty records:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching faculty records" });
  }
});

app.get("/getlogin", async (req, res) => {
  try {
    const query = "SELECT * FROM login_log";
    const [loginRecords] = await connection.query(query);

    // Create a map to store login and logout times based on TUPCID
    const loginLogoutMap = {};

    loginRecords.forEach(({ TUPCID, STATUS, TIMESTAMP }) => {
      if (STATUS === "ONLINE") {
        loginLogoutMap[TUPCID] = { loginTime: TIMESTAMP };
      } else if (STATUS === "OFFLINE" && loginLogoutMap[TUPCID]) {
        loginLogoutMap[TUPCID].logoutTime = TIMESTAMP;
      }
    });

    // Format login and logout times to 12-hour format
    const formattedData = Object.keys(loginLogoutMap).map((TUPCID) => {
      const loginDateTime = new Date(loginLogoutMap[TUPCID].loginTime);
      const logoutDateTime = loginLogoutMap[TUPCID].logoutTime
        ? new Date(loginLogoutMap[TUPCID].logoutTime)
        : null;

      const loginDate = loginDateTime.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const loginTime = loginDateTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      });

      const logoutDate = logoutDateTime
        ? logoutDateTime.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;
      const logoutTime = logoutDateTime
        ? logoutDateTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
          })
        : null;

      return {
        TUPCID,
        loginDate,
        loginTime,
        logoutDate,
        logoutTime,
      };
    });

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching login records:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching login records" });
  }
});

//sending result to database:

app.post("/sendresult", async (req, res) => {
  const {
    studentid,
    uid,
    testtype2,
    result,
    correct,
    wrong,
    totalscore,
    maxscore,
  } = req.body;
  
  try {
    const check = await checkResultExits(studentid, uid);
    if(check){
      const query = `INSERT INTO student_results (
        TUPCID, UID,TESTTYPE, results, CORRECT, WRONG, TOTALSCORE, MAXSCORE, results_out)
        VALUES (?,?,?,?,?,?,?,?,NOW()
      )`;
  
      const values = [
        studentid,
        uid,
        JSON.stringify(testtype2),
        JSON.stringify(result),
        correct,
        wrong,
        totalscore,
        maxscore,
      ];
      await connection.query(query, values);
  
      return res.status(200).send({ message: "Data added to the test successfully" });
    }else{
      const query = `UPDATE student_results SET results = ?, CORRECT = ?, WRONG = ?, TOTALSCORE = ?, MAXSCORE = ?, results_out = NOW() WHERE TUPCID = ? AND UID = ?`;
      await connection.query(query, [JSON.stringify(result), correct, wrong, totalscore, maxscore,studentid, uid])
      return res.status(200).send({ message: "Data updated to the test successfully" });
    }
   
  } catch (error) {
    throw error
  }
});

app.get("/Studentname2", async (req, res) => {
  const { studentid } = req.query;
  console.log("studentid: ", studentid);

  try {
    const query = `SELECT FIRSTNAME, MIDDLENAME, SURNAME FROM student_accounts WHERE TUPCID = ?`;
    const [studentData] = await connection.query(query, [studentid]);
    console.log(studentData);

    if (studentData.length > 0) {
      const { FIRSTNAME, SURNAME, MIDDLENAME } = studentData[0];
      return res.status(202).send({
        FIRSTNAME,
        SURNAME,
        MIDDLENAME,
      });
    } else {
      return res.status(404).send({ message: "Student not found" });
    }
  } catch (error) {
    throw error;
  }
});

//Additional
//For Combo boxes
app.post("/AddCombo", async (req, res) => {
  const { types } = req.query;
  const keys = Object.keys(req.body);
  try {
    const maxIdQuery = `SELECT MAX(id) as maxId FROM ${types.toLowerCase()}combo`;
    const [maxIdResult] = await connection.query(maxIdQuery);
    const nextId = (maxIdResult[0].maxId || 0) + 1;
    
    const columns = ['id', ...keys].join(', ');
    const placeholders = ['?', ...keys.map(() => '?')].join(', ');
    const values = [nextId, ...keys.map(key => req.body[key])];
    
    const query = `INSERT INTO ${types.toLowerCase()}combo (${columns}) VALUES (${placeholders})`;
    await connection.query(query, values);
    
    console.log("DONE");
    return res.status(200).send({ message: "DONE" });
  } catch (error) {
    throw error;
  }
});
app.post("/DeleteCombo", async (req, res) => {
  const { types } = req.query;
  const keys = Object.keys(req.body);
  try {
    if (keys.length > 0) {
      const key = keys[0];
      const value = req.body[key];
      console.log(key, value);
      const query = `DELETE FROM ${types.toLowerCase()}combo WHERE ${key} = ?`;
      await connection.query(query, [value]);
      return res.status(200).send({ message: "Done" });
    }
  } catch (error) {
    throw error;
  }
});

//Register - Faculty and Student
app.get("/Course", async (req, res) => {
  try {
    const query = "SELECT * FROM coursecombo";
    const [row] = await connection.query(query);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});
app.get("/Section", async (req, res) => {
  try {
    const query = "SELECT * FROM sectioncombo";
    const [row] = await connection.query(query);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});
app.get("/Year", async (req, res) => {
  try {
    const query = "SELECT * FROM yearcombo";
    const [row] = await connection.query(query);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});
app.get("/SubjectDept", async (req, res) => {
  try {
    const query = "SELECT * FROM subdeptcombo";
    const [row] = await connection.query(query);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});
app.get("/Semester", async (req, res) => {
  try {
    const query = "SELECT * FROM semestercombo";
    const [row] = await connection.query(query);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});
app.get("/Period", async (req, res) => {
  try {
    const query = "SELECT * FROM periodcombo";
    const [row] = await connection.query(query);
    return res.status(200).send(row);
  } catch (err) {
    throw err;
  }
});

// Start the server
app.listen(3001, () => {
  console.log("Server is running on port 3001");
});
