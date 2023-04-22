const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const DbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;

const ConnectDbToServer = async () => {
  try {
    db = await open({
      filename: DbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running smoothly");
    });
  } catch (e) {
    console.log(`DB error is ${e}`);
  }
};

ConnectDbToServer();

// login api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  //   const HashPassword = await bcrypt.hash(password, 10);
  const Query = `SELECT * from user where username='${username}'`;
  const Data = await db.get(Query);
  if (Data === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    IsPasswordMatch = await bcrypt.compare(password, Data.password);
    if (IsPasswordMatch === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET");
      //   console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//create middleware
const authenticateToken = (request, response, next) => {
  let jwt_Token = null;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwt_Token = authHeader.split(" ")[1];
  }
  if (jwt_Token === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwt_Token, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//get with jwt token authentication
app.get("/states/", authenticateToken, async (request, response) => {
  const { states } = request;
  const Query = `SELECT * FROM state `;
  const StateData = await db.all(Query);
  response.send(
    StateData.map((eachState) => {
      return {
        stateId: eachState.state_id,
        stateName: eachState.state_name,
        population: eachState.population,
      };
    })
  );
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const Query = `SELECT * FROM state where state_id='${stateId}'`;
  const StateData = await db.get(Query);
  response.send({
    stateId: StateData.state_id,
    stateName: StateData.state_name,
    population: StateData.population,
  });
});

// POST method in district table with authentication

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const Query = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}')`;

  const Data = await db.run(Query);
  response.send("District Successfully Added");
});

//Get district details from district id
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const Query = `SELECT * FROM district WHERE district_id='${districtId}'`;
    const Data = await db.get(Query);
    response.send({
      districtId: Data.district_id,
      districtName: Data.district_name,
      stateId: Data.state_id,
      cases: Data.cases,
      cured: Data.cured,
      active: Data.active,
      deaths: Data.deaths,
    });
  }
);

//Delete district detail from db

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const Query = `DELETE FROM district WHERE district_id='${districtId}'`;
    const data = await db.run(Query);
    response.send("District Removed");
  }
);

//update method

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const Query = `UPDATE district
  set 
  district_name='${districtName}',
  state_id='${stateId}',
  cases='${cases}',
  cured='${cured}',
  active='${active}',
  deaths='${deaths}' 
  where district_id='${districtId}'`;

    const data = await db.run(Query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const Query = `SELECT 
  sum(cases) as total_cases,
  sum(cured) as total_cured,
  sum(active) as total_active,
  sum(deaths) as total_deaths
  FROM
  state left join district on district.state_id=state.state_id
  where state.state_id='${stateId}' `;
    const data = await db.get(Query);

    response.send({
      totalCases: data.total_cases,
      totalCured: data.total_cured,
      totalActive: data.total_active,
      totalDeaths: data.total_deaths,
    });
  }
);

module.exports = app;
