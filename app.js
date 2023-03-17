const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
app.use(express.json());

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

let database = null;
const initializeDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};
initializeDatabaseAndServer();
//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await database.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const compare = await bcrypt.compare(password, dbUser.password);
    if (compare === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      console.log("Successful login of the user");
      const payLoad = {
        username: username,
      };
      const jwtToken = jwt.sign(payLoad, "secret");
      response.send({ jwtToken });
    }
  }
});
const authentication = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//convert pascal to camel case
const convertStatePascalToCamel = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};
app.get("/states/", authentication, async (request, response) => {
  const getAllStatesQuery = `SELECT * FROM state;`;
  const allStates = await database.all(getAllStatesQuery);
  response.send(
    allStates.map((each) => {
      return convertStatePascalToCamel(each);
    })
  );
});
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateBasedOnId = `SELECT * FROM state WHERE state_id='${stateId}';`;
  const state = await database.get(getStateBasedOnId);
  response.send(convertStatePascalToCamel(state));
});
//API 4
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES
    (
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'
    );
        `;
  await database.run(createDistrictQuery);
  response.send("District Successfully Added");
});
//convert pascal to camel case
const convertDistrictPascalToCamel = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};
//API 5
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictBasedOnId = `SELECT * FROM district WHERE district_id='${districtId}';`;
    const district = await database.get(getDistrictBasedOnId);
    response.send(convertDistrictPascalToCamel(district));
  }
);
//API 6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id='${districtId}';`;
    await database.run(deleteQuery);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district 
    SET 
    district_name='${districtName}',
    state_id='${stateId}',
    cases='${cases}',
    cured='${cured}',
    active='${active}',
    deaths='${deaths}'
    WHERE 
    district_id='${districtId}'`;
    await database.run(updateQuery);
    response.send("District Details Updated");
  }
);
//API 8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT SUM(cases) AS a,
    SUM(cured) AS b,
    SUM(active) AS c,
    SUM(deaths) AS d
    FROM 
    district
    WHERE
    state_id='${stateId}'
    GROUP BY 
    state_id;`;
    const getStats = await database.get(getStatsQuery);
    response.send({
      totalCases: getStats.a,
      totalCured: getStats.b,
      totalActive: getStats.c,
      totalDeaths: getStats.d,
    });
  }
);
module.exports = app;
