// Import the Joi schemas that will be tested.
const { userSchema } = require("../validation/userSchema");
const {
  taskSchema,
  patchTaskSchema,
} = require("../validation/taskSchema");

describe("user object validation tests", () => {
  it("1. doesn't permit a trivial password", () => {
    const { error } = userSchema.validate(
      {
        name: "Bob",
        email: "bob@sample.com",
        password: "password",
      },
      { abortEarly: false },
    );

    // A weak password should produce a password validation error.
    expect(
      error.details.find((detail) => detail.context.key === "password"),
    ).toBeDefined();
  });

  it("2. requires an email", () => {
    const { error } = userSchema.validate(
      {
        name: "Bob",
        password: "StrongPassword1!",
      },
      { abortEarly: false },
    );

    // The error details should identify the missing email field.
    expect(
      error.details.find((detail) => detail.context.key === "email"),
    ).toBeDefined();
  });

  it("3. doesn't accept an invalid email", () => {
    const { error } = userSchema.validate(
      {
        name: "Bob",
        email: "not-an-email",
        password: "StrongPassword1!",
      },
      { abortEarly: false },
    );

    expect(
      error.details.find((detail) => detail.context.key === "email"),
    ).toBeDefined();
  });

  it("4. requires a password", () => {
    const { error } = userSchema.validate(
      {
        name: "Bob",
        email: "bob@sample.com",
      },
      { abortEarly: false },
    );

    expect(
      error.details.find((detail) => detail.context.key === "password"),
    ).toBeDefined();
  });

  it("5. requires a name", () => {
    const { error } = userSchema.validate(
      {
        email: "bob@sample.com",
        password: "StrongPassword1!",
      },
      { abortEarly: false },
    );

    expect(
      error.details.find((detail) => detail.context.key === "name"),
    ).toBeDefined();
  });

  it("6. requires the name to contain 3 to 30 characters", () => {
    const { error } = userSchema.validate(
      {
        name: "Bo",
        email: "bob@sample.com",
        password: "StrongPassword1!",
      },
      { abortEarly: false },
    );

    expect(
      error.details.find((detail) => detail.context.key === "name"),
    ).toBeDefined();
  });

  it("7. returns no error for a valid user", () => {
    const { error } = userSchema.validate({
      name: "Bob",
      email: "bob@sample.com",
      password: "StrongPassword1!",
    });

    expect(error).toBeFalsy();
  });
});

describe("task object validation tests", () => {
  it("8. requires a title", () => {
    const { error } = taskSchema.validate(
      {
        isCompleted: false,
        priority: "medium",
      },
      { abortEarly: false },
    );

    expect(
      error.details.find((detail) => detail.context.key === "title"),
    ).toBeDefined();
  });

  it("9. requires isCompleted to be valid when it is provided", () => {
    const { error } = taskSchema.validate(
      {
        title: "Complete homework",
        isCompleted: "not-a-boolean",
      },
      { abortEarly: false },
    );

    expect(
      error.details.find(
        (detail) => detail.context.key === "isCompleted",
      ),
    ).toBeDefined();
  });

  it("10. defaults isCompleted to false when it is not provided", () => {
    const { value } = taskSchema.validate({
      title: "Complete homework",
    });

    expect(value.isCompleted).toBe(false);
  });

  it("11. keeps isCompleted true when true is provided", () => {
    const { value } = taskSchema.validate({
      title: "Complete homework",
      isCompleted: true,
    });

    expect(value.isCompleted).toBe(true);
  });
});

describe("patch task object validation tests", () => {
  it("12. doesn't require a title", () => {
    const { error } = patchTaskSchema.validate({
      isCompleted: true,
    });

    expect(error).toBeFalsy();
  });

  it("13. leaves isCompleted undefined when it is not provided", () => {
    const { value } = patchTaskSchema.validate({
      title: "Updated task title",
    });

    expect(value.isCompleted).toBeUndefined();
  });
});