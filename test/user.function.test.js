// Load environment variables before importing Prisma or the Express app.
require("dotenv").config();

// Functional tests must never use the development database.
if (
  !process.env.TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
) {
  throw new Error(
    "TEST_DATABASE_URL must exist and be different from DATABASE_URL.",
  );
}

// Point Prisma and the application to the test database.
// This must be done before importing Prisma or the Express app.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require("supertest");
const prisma = require("../db/prisma");
const { app, server } = require("../app");

// The Supertest agent keeps cookies between HTTP requests.
// This allows the tests to log on and maintain a session for subsequent requests.
let agent;
let saveRes;
let csrfToken;
let taskId;

const testUser = {
  name: "John Deere",
  email: "jdeere@example.com",
  password: "Pa$$word20",
};

beforeAll(async () => {
  // Begin with a known database state.
  // Tasks must be removed before users because of the foreign key.
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  // This agent stores the JWT cookie returned by register and logon.
  agent = request.agent(app);
});

afterAll(async () => {
  // Close database and server resources so Jest can exit cleanly.
  await prisma.$disconnect();

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        return reject(error);
      }

      return resolve();
    });
  });
});

describe("register, authenticate, and log off a user", () => {
  it("46. creates the user entry", async () => {
    saveRes = await agent
    .post("/api/users/register")
    // Jest cannot use the browser widget, so provide the private test bypass.
    .set("X-Recaptcha-Test", process.env.RECAPTCHA_BYPASS)
    .send(testUser);

    expect(saveRes.status).toBe(201);
  });

  it("47. registration returns the expected name", () => {
    expect(saveRes.body.name).toBe(testUser.name);
  });

  it("48. registration returns a CSRF token", () => {
    expect(saveRes.body.csrfToken).toBeDefined();
  });

  it("49. logs on as the newly registered user", async () => {
    saveRes = await agent
      .post("/api/users/logon")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    // Logon creates a fresh JWT and CSRF token.
    csrfToken = saveRes.body.csrfToken;

    expect(saveRes.status).toBe(200);
  });

 it("50. retrieves the authenticated user's task list", async () => {
  const response = await agent.get("/api/tasks");

  expect(response.status).toBe(200);
  expect(response.body.tasks).toBeInstanceOf(Array);
  expect(response.body.pagination).toBeDefined();
});

it("51. creates a task through the REST API", async () => {
  const response = await agent
    .post("/api/tasks")
    .set("X-CSRF-Token", csrfToken)
    .send({
      title: "Test REST task operations",
      priority: "high",
    });

  expect(response.status).toBe(201);
  expect(response.body.id).toBeDefined();
  expect(response.body.title).toBe("Test REST task operations");
  expect(response.body.priority).toBe("high");
  expect(response.body.isCompleted).toBe(false);

  taskId = response.body.id;
});

it("52. retrieves one task through the REST API", async () => {
  const response = await agent.get(`/api/tasks/${taskId}`);

  expect(response.status).toBe(200);
  expect(response.body.id).toBe(taskId);
  expect(response.body.title).toBe("Test REST task operations");
  expect(response.body.priority).toBe("high");
});

it("53. updates the task through the REST API", async () => {
  const response = await agent
    .patch(`/api/tasks/${taskId}`)
    .set("X-CSRF-Token", csrfToken)
    .send({
      title: "Updated REST task",
      isCompleted: true,
      priority: "low",
    });

  expect(response.status).toBe(200);
  expect(response.body.id).toBe(taskId);
  expect(response.body.title).toBe("Updated REST task");
  expect(response.body.isCompleted).toBe(true);
  expect(response.body.priority).toBe("low");
});

it("54. deletes the task through the REST API", async () => {
  const response = await agent
    .delete(`/api/tasks/${taskId}`)
    .set("X-CSRF-Token", csrfToken);

  expect(response.status).toBe(200);
  expect(response.body.id).toBe(taskId);
});

it("55. confirms that the deleted task no longer exists", async () => {
  const response = await agent.get(`/api/tasks/${taskId}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Task not found.");
});


it("56. logs off the authenticated user", async () => {
    const response = await agent
      .post("/api/users/logoff")
      .set("X-CSRF-TOKEN", csrfToken);

    expect(response.status).toBe(200);
  });

it("57. rejects task access after the user logs off", async () => {
    const response = await agent.get("/api/tasks");

    expect(response.status).toBe(401);
  });
});