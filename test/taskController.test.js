// Load the database URLs from the root .env file.
require("dotenv").config();

// Controller tests must never delete records from the development database.
if (
  !process.env.TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
) {
  throw new Error(
    "TEST_DATABASE_URL must exist and be different from DATABASE_URL.",
  );
}

// Point Prisma to the test database before importing the Prisma Client.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { EventEmitter } = require("events");
const httpMocks = require("node-mocks-http");

// Import Prisma only after DATABASE_URL points to the test database.
const prisma = require("../db/prisma");

const {
  index,
  show,
  create,
  update,
  deleteTask,
} = require("../controllers/taskController");

const waitForRouteHandlerCompletion = require(
  "./waitForRouteHandlerCompletion",
);

// These values are shared by tests that build on previously created data.
let user1 = null;
let user2 = null;
let saveRes = null;
let saveData = null;
let saveTaskId = null;

beforeAll(async () => {
  // Start from a predictable database state.
  // Tasks must be deleted first because they reference users.
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();

  // These users give new tasks valid foreign-key owners.
  user1 = await prisma.user.create({
    data: {
      name: "Bob",
      email: "bob@sample.com",
      hashedPassword: "nonsense",
    },
  });

  user2 = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@sample.com",
      hashedPassword: "nonsense",
    },
  });
});

afterAll(async () => {
  // Close Prisma so Jest can exit without leaving an open connection.
  await prisma.$disconnect();
});

describe("testing task creation", () => {
  it("14. can't create a task without a user id", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: {
        title: "first task",
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    // Ensure the catch block must execute for this test to pass.
    expect.assertions(1);

    try {
      await waitForRouteHandlerCompletion(create, req, res);
    } catch (error) {
      expect(error.name).toBe("TypeError");
    }
  });

  it("15. can't create a task with an unknown user id", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: {
        title: "first task",
      },
      user: {
        id: 999999,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    // Prisma should reject a task whose owner does not exist.
    expect.assertions(1);

    try {
      await waitForRouteHandlerCompletion(create, req, res);
    } catch (error) {
      expect(error.name).toBe("PrismaClientKnownRequestError");
    }
  });

  it("16. creates a task when a valid user id is provided", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: {
        title: "first task",
      },
      user: {
        id: user1.id,
      },
    });

    // Save the response because tests 17–19 inspect the created task.
    saveRes = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(create, req, saveRes);

    expect(saveRes.statusCode).toBe(201);
  });

  it("17. returns the created task's title", () => {
    saveData = saveRes._getJSONData();
    saveTaskId = saveData.id;

    expect(saveData.title).toBe("first task");
  });

  it("18. defaults the created task to incomplete", () => {
    expect(saveData.isCompleted).toBe(false);
  });

  it("19. doesn't expose the task owner's user id", () => {
    expect(saveData.userId).toBeUndefined();
  });
});

describe("testing task retrieval", () => {
  it("20. can't retrieve tasks without a user id", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      query: {},
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    // The controller should fail when JWT middleware has not supplied req.user.
    expect.assertions(1);

    try {
      await waitForRouteHandlerCompletion(index, req, res);
    } catch (error) {
      expect(error.name).toBe("TypeError");
    }
  });

  it("21. returns status 200 for the authenticated user's tasks", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      query: {},
      user: {
        id: user1.id,
      },
    });

    // Later tests reuse this completed response.
    saveRes = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(index, req, saveRes);

    expect(saveRes.statusCode).toBe(200);
  });

  it("22. returns one task for the authenticated user", () => {
    saveData = saveRes._getJSONData();

    expect(saveData.tasks).toHaveLength(1);
  });

  it("23. returns the expected task title", () => {
    expect(saveData.tasks[0].title).toBe("first task");
  });

  it("24. doesn't expose the task owner's user id", () => {
    expect(saveData.tasks[0].userId).toBeUndefined();
  });

    it("25. returns 404 when the authenticated user has no tasks", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      query: {},
      user: {
        id: user2.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(index, req, res);

    expect(res.statusCode).toBe(404);
  });

  it("26. retrieves the created task for its owner", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      params: {
        id: String(saveTaskId),
      },
      user: {
        id: user1.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(show, req, res);

    expect(res.statusCode).toBe(200);
  });

  it("27. prevents another user from retrieving the task", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      params: {
        id: String(saveTaskId),
      },
      user: {
        id: user2.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(show, req, res);

    expect(res.statusCode).toBe(404);
  });
});

describe("testing task update and deletion", () => {
  it("28. allows the owner to mark the task as completed", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      params: {
        id: String(saveTaskId),
      },
      body: {
        isCompleted: true,
      },
      user: {
        id: user1.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(update, req, res);

    const updatedTask = res._getJSONData();

    expect(updatedTask.isCompleted).toBe(true);
  });

  it("29. prevents another user from updating the task", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      params: {
        id: String(saveTaskId),
      },
      body: {
        isCompleted: false,
      },
      user: {
        id: user2.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(update, req, res);

    expect(res.statusCode).toBe(404);
  });

  it("30. prevents another user from deleting the task", async () => {
    const req = httpMocks.createRequest({
      method: "DELETE",
      params: {
        id: String(saveTaskId),
      },
      user: {
        id: user2.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(deleteTask, req, res);

    expect(res.statusCode).toBe(404);
  });

  it("31. allows the owner to delete the task", async () => {
    const req = httpMocks.createRequest({
      method: "DELETE",
      params: {
        id: String(saveTaskId),
      },
      user: {
        id: user1.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(deleteTask, req, res);

    expect(res.statusCode).toBe(200);
  });

  it("32. returns 404 after all of the owner's tasks are deleted", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      query: {},
      user: {
        id: user1.id,
      },
    });

    const res = httpMocks.createResponse({
      eventEmitter: EventEmitter,
    });

    await waitForRouteHandlerCompletion(index, req, res);

    expect(res.statusCode).toBe(404);
  });
});