import Joi from "joi";

import {
  callPostJsonApi,
  callHappyPostJsonApi,
  callHappyPostJsonApiWithAuth,
  validateObject,
} from "./testlib/common-api-test-utils.js";

import {
  directorySchema,
  bucketListSchema,
  userAssertion,
  errorOfCode,
  userListSchema,
  sessionListSchema,
  userListWithPermissionsSchema
} from "./testlib/common-test-schema.js";

import { validators } from "../dist/validators.js";
import exp from "constants";

const DEFAULT_USER_NAME = "admin";
const UPDATED_USER_DISPLAY_NAME = "Updated Administrator"
const DEFAULT_PASSWORD = "PleaseChangeMe@YourEarliest2Day";

const LOGOUT_ALL_MESSAGE = "Batch logout message";

const UPDATED_PASSWORD = "UpdatedPassword";

let vars = {
  apiKey: null,
  existingUserDisplayName: null,
};

describe("User Suite", () => {
  test("(user/login): Affirmative", async () => {
    const data = await callHappyPostJsonApi(200, "/user/login", {
      userName: DEFAULT_USER_NAME,
      password: DEFAULT_PASSWORD,
    });

    await validateObject(data, userAssertion);

    vars.apiKey = data.apiKey;
  });

  test("(user/logout): Affirmative", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/logout",
      {
        message: "Logout invoked from test case.",
      }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
    });
  });

  test("(user/assert): Ensure apiKey is invalidated", async () => {
    const response = await callPostJsonApi("/user/assert", {}, vars.apiKey);
    expect(response.status).toEqual(401);
    let data = await response.json();

    await validateObject(data, {
      hasError: validators.hasErrorTruthy,
      error: errorOfCode("API_KEY_EXPIRED"),
    });
  });

  test("(user/login): Again", async () => {
    const data = await callHappyPostJsonApi(200, "/user/login", {
      userName: DEFAULT_USER_NAME,
      password: DEFAULT_PASSWORD,
    });

    await validateObject(data, userAssertion);

    vars.apiKey = data.apiKey;
  });

  test("(user/list): Affirmative", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/list",
      {}
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
      userList: userListSchema,
    });

    let user = data.userList.find(user => user.userName === "admin");
    expect(user).not.toBeFalsy();

    vars.existingUserDisplayName = user.displayName;
  });

  test("(user/update-profile): Affirmative", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/update-profile",
      {
        displayName: UPDATED_USER_DISPLAY_NAME,
      }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
    });
  });

  test("(user/list): Confirm profile was updated", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/list",
      {}
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
      userList: userListSchema,
    });

    let user = data.userList.find(user => user.userName === "admin");
    expect(user).not.toBeFalsy();
    expect(user.displayName).toBe(UPDATED_USER_DISPLAY_NAME);
  });

  test("(user/update-profile): Revert name change", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/update-profile",
      {
        displayName: vars.existingUserDisplayName,
      }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
    });
  });

  test("(user/update-password): Affirmative", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/update-password",
      {
        currentPassword: DEFAULT_PASSWORD,
        newPassword: UPDATED_PASSWORD,
      }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
    });
  });

  test("(user/assert): Ensure apiKey is invalidated when password is updated", async () => {
    const response = await callPostJsonApi("/user/assert", {}, vars.apiKey);
    expect(response.status).toEqual(401);
    let data = await response.json();

    await validateObject(data, {
      hasError: validators.hasErrorTruthy,
      error: errorOfCode("API_KEY_EXPIRED"),
    });
  });

  test("(user/login): With changed password", async () => {
    const data = await callHappyPostJsonApi(200, "/user/login", {
      userName: DEFAULT_USER_NAME,
      password: UPDATED_PASSWORD,
    });

    await validateObject(data, userAssertion);

    vars.apiKey = data.apiKey;
  });

  test("(user/update-password): Revert password change", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/update-password",
      {
        currentPassword: UPDATED_PASSWORD,
        newPassword: DEFAULT_PASSWORD,
      }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
    });
  });

  test("(user/login): With reverted password", async () => {
    const data = await callHappyPostJsonApi(200, "/user/login", {
      userName: DEFAULT_USER_NAME,
      password: DEFAULT_PASSWORD,
    });

    await validateObject(data, userAssertion);

    vars.apiKey = data.apiKey;
  });

  test("(user/list-all-sessions): List all sessions", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/list-all-sessions",
      {}
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
      sessionList: sessionListSchema,
    });
  });

  test("(user/logout-all-sessions): Logout all sessions", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/logout-all-sessions",
      { message: LOGOUT_ALL_MESSAGE }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
    });
  });

  test("(user/assert): Ensure apiKey is invalidated when password is updated", async () => {
    const response = await callPostJsonApi("/user/assert", {}, vars.apiKey);
    expect(response.status).toEqual(401);
    let data = await response.json();

    await validateObject(data, {
      hasError: validators.hasErrorTruthy,
      error: errorOfCode("API_KEY_EXPIRED"),
    });
  });

  test("(user/login): Affirmative", async () => {
    const data = await callHappyPostJsonApi(200, "/user/login", {
      userName: DEFAULT_USER_NAME,
      password: DEFAULT_PASSWORD,
    });

    await validateObject(data, userAssertion);

    vars.apiKey = data.apiKey;
  });

  test("(user/find): Affirmative (simple query)", async () => {
    const data = await callHappyPostJsonApiWithAuth(200,
      vars.apiKey,
      "/user/find",
      {
        filters: [{
          by: "userName",
          userName: DEFAULT_USER_NAME,
          userId: null
        }],
        includeGlobalPermissions: true
      }
    );

    await validateObject(data, {
      hasError: validators.hasErrorFalsy,
      userList: userListWithPermissionsSchema
    });
  });
});
