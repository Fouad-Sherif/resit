const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db_access = require("./Db.js");
const db = db_access.db;
const cookieParser = require("cookie-parser");
const server = express();
const port = 555;
const secret_key = "DdsdsdKKFDDFDdvfddvxvc4dsdvdsvdb";
server.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
server.use(express.json());
server.use(cookieParser());
const generateToken = (id, isAdmin) => {
  return jwt.sign({ id, isAdmin }, secret_key, { expiresIn: "1h" });
};
const verifyToken = (req, res, next) => {
  const token = req.cookies.authToken;
  console.log("Token received:", token);
  if (!token) return res.status(401).send("unauthorized");
  jwt.verify(token, secret_key, (err, details) => {
    if (err) return res.status(403).send("invalid or expired token");
    req.userDetails = details;

    next();
  });
};
server.post("/user/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  db.get(`SELECT * FROM USER WHERE EMAIL=?  `, [email], (err, row) => {
    bcrypt.compare(password, row.PASSWORD, (err, isMatch) => {
      if (err) {
        return res.status(500).send("error comparing password.");
      }
      if (!isMatch) {
        return res.status(401).send("invalid credentials");
      } else {
        let userID = row.ID;
        let isAdmin = row.ISADMIN;
        const token = generateToken(userID, isAdmin);

        res.cookie("authToken", token, {
          httpOnly: true,
          sameSite: "none",
          secure: true,
          maxAge: 3600000,
        });
        return res.status(200).json({ id: userID, admin: isAdmin });
      }
    });
  });
});

server.post(`/user/register`, (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const password = req.body.password;
  const isadmin = req.body.isAdmin;
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).send("error hashing password");
    }
    db.run(
      `INSERT INTO USER (name,email,password,isadmin) VALUES (?,?,?,?)`,
      [name, email, hashedPassword, isadmin],
      (err) => {
        if (err) {
          return res.status(401).send(err);
        } else return res.status(200).send(`registration successfull`);
      }
    );
  });
});

server.post(`/gyms/addgym`, verifyToken, (req, res) => {
  const isAdmin = req.userDetails.isAdmin;
  if (isAdmin !== 1) return res.status(403).send("you are not an admin");
  const gym = req.body.name;
  const price = parseInt(req.body.price, 10);
  const available = parseInt(req.body.available, 10);
  let query = `INSERT INTO GYM (NAME,PRICE,AVAILABLE) VALUES
    (?,?,?)`;
  db.run(query, [gym, price, available], (err) => {
    if (err) {
      console.log(err);
      return res.send(err);
    } else {
      return res.send(`gym added successfully`);
    }
  });
});

server.get(`/gyms`, verifyToken, (req, res) => {
  const isAdmin = req.userDetails.isAdmin;
  if (isAdmin !== 1) return res.status(403).send("you are not an admin");
  const query = `SELECT * FROM GYM`;
  db.all(query, (err, rows) => {
    if (err) {
      console.log(err);
      return res.send(err);
    } else {
      return res.json(rows);
    }
  });
});

server.get(`/gyms/search`, (req, res) => {
  let gym = req.query.name;
  let query = `SELECT * FROM GYM WHERE AVAILABLE>0`;
  if (gym) query += ` AND NAME='${gym}'`;

  db.all(query, (err, rows) => {
    if (err) {
      console.log(err);
      return res.send(err);
    } else {
      return res.json(rows);
    }
  });
});

server.post(`/book`, verifyToken, (req, res) => {
  let gym = req.query.name;
  let query = `SELECT * FROM GYM WHERE NAME='${gym}'`;

  db.get(query, (err, row) => {
    if (err) {
      console.log(err);
      return res.send(err);
    } else {
      let gymID = row.ID;
      let userID = req.userDetails.id;
      let query2 = `INSERT INTO BOOKING (USER_ID,GYM_ID) VALUES (${parseInt(
        userID,
        10
      )},${gymID})`;
      console.log(query2);
      db.run(query2, (err) => {
        if (err) {
          console.log(err);
          return res.send(err);
        } else {
          let available = parseInt(row.AVAILABLE, 10);
          available = available - 1;
          query = `UPDATE GYM SET AVAILABLE=${available} WHERE ID=${gymID}`;
          console.log(query);
          db.run(query, (err) => {
            if (err) {
              console.log(err);
              return res.send(err);
            } else res.send(`booked successfully`);
          });
        }
      });
    }
  });
});

server.listen(port, () => {
  console.log(`server started at port ${port}`);
  db.serialize(() => {
    db.run(db_access.createUserTable, (err) => {
      if (err) console.log("error creating user table " + err);
    });
    db.run(db_access.createGymTable, (err) => {
      if (err) console.log("error creating gym table " + err);
    });
    db.run(db_access.createBookingTable, (err) => {
      if (err) console.log("error creating booking table " + err);
    });
  });
});
