import test from "ava";

import { KnownLanguage } from "./languages";
import { getRunnerLogger } from "./logging";
import * as startProxyExports from "./start-proxy";
import { parseLanguage } from "./start-proxy";
import { setupTests } from "./testing-utils";

setupTests(test);

const toEncodedJSON = (data: any) =>
  Buffer.from(JSON.stringify(data)).toString("base64");

test("getCredentials prefers registriesCredentials over registrySecrets", async (t) => {
  const registryCredentials = Buffer.from(
    JSON.stringify([
      { type: "npm_registry", host: "npm.pkg.github.com", token: "abc" },
    ]),
  ).toString("base64");
  const registrySecrets = JSON.stringify([
    { type: "npm_registry", host: "registry.npmjs.org", token: "def" },
  ]);

  const credentials = startProxyExports.getCredentials(
    getRunnerLogger(true),
    registrySecrets,
    registryCredentials,
    undefined,
  );
  t.is(credentials.length, 1);
  t.is(credentials[0].host, "npm.pkg.github.com");
});

test("getCredentials throws an error when configurations are not an array", async (t) => {
  const registryCredentials = Buffer.from(
    JSON.stringify({ type: "npm_registry", token: "abc" }),
  ).toString("base64");

  t.throws(
    () =>
      startProxyExports.getCredentials(
        getRunnerLogger(true),
        undefined,
        registryCredentials,
        undefined,
      ),
    {
      message:
        "Expected credentials data to be an array of configurations, but it is not.",
    },
  );
});

test("getCredentials throws error when credential is not an object", async (t) => {
  const testCredentials = [["foo"], [null]].map(toEncodedJSON);

  for (const testCredential of testCredentials) {
    t.throws(
      () =>
        startProxyExports.getCredentials(
          getRunnerLogger(true),
          undefined,
          testCredential,
          undefined,
        ),
      {
        message: "Invalid credentials - must be an object",
      },
    );
  }
});

test("getCredentials throws error when credential missing host and url", async (t) => {
  const testCredentials = [
    [{ type: "npm_registry", token: "abc" }],
    [{ type: "npm_registry", token: "abc", host: null }],
    [{ type: "npm_registry", token: "abc", url: null }],
  ].map(toEncodedJSON);

  for (const testCredential of testCredentials) {
    t.throws(
      () =>
        startProxyExports.getCredentials(
          getRunnerLogger(true),
          undefined,
          testCredential,
          undefined,
        ),
      {
        message: "Invalid credentials - must specify host or url",
      },
    );
  }
});

test("getCredentials filters by language when specified", async (t) => {
  const mixedCredentials = [
    { type: "npm_registry", host: "npm.pkg.github.com", token: "abc" },
    { type: "maven_repository", host: "maven.pkg.github.com", token: "def" },
    { type: "nuget_feed", host: "nuget.pkg.github.com", token: "ghi" },
    { type: "goproxy_server", host: "goproxy.example.com", token: "jkl" },
  ];

  const credentials = startProxyExports.getCredentials(
    getRunnerLogger(true),
    undefined,
    toEncodedJSON(mixedCredentials),
    "java",
  );
  t.is(credentials.length, 1);
  t.is(credentials[0].type, "maven_repository");
});

test("getCredentials returns all credentials when no language specified", async (t) => {
  const mixedCredentials = [
    { type: "npm_registry", host: "npm.pkg.github.com", token: "abc" },
    { type: "maven_repository", host: "maven.pkg.github.com", token: "def" },
    { type: "nuget_feed", host: "nuget.pkg.github.com", token: "ghi" },
    { type: "goproxy_server", host: "goproxy.example.com", token: "jkl" },
  ];
  const credentialsInput = toEncodedJSON(mixedCredentials);

  const credentials = startProxyExports.getCredentials(
    getRunnerLogger(true),
    undefined,
    credentialsInput,
    undefined,
  );
  t.is(credentials.length, mixedCredentials.length);
});

test("getCredentials throws an error when non-printable characters are used", async (t) => {
  const invalidCredentials = [
    { type: "nuget_feed", host: "1nuget.pkg.github.com", token: "abc\u0000" }, // Non-printable character in token
    { type: "nuget_feed", host: "2nuget.pkg.github.com\u0001" }, // Non-printable character in host
    {
      type: "nuget_feed",
      host: "3nuget.pkg.github.com",
      password: "ghi\u0002",
    }, // Non-printable character in password
    { type: "nuget_feed", host: "4nuget.pkg.github.com", password: "ghi\x00" }, // Non-printable character in password
  ];

  for (const invalidCredential of invalidCredentials) {
    const credentialsInput = Buffer.from(
      JSON.stringify([invalidCredential]),
    ).toString("base64");

    t.throws(
      () =>
        startProxyExports.getCredentials(
          getRunnerLogger(true),
          undefined,
          credentialsInput,
          undefined,
        ),
      {
        message:
          "Invalid credentials - fields must contain only printable characters",
      },
    );
  }
});

test("parseLanguage", async (t) => {
  // Exact matches
  t.deepEqual(parseLanguage("csharp"), KnownLanguage.csharp);
  t.deepEqual(parseLanguage("cpp"), KnownLanguage.cpp);
  t.deepEqual(parseLanguage("go"), KnownLanguage.go);
  t.deepEqual(parseLanguage("java"), KnownLanguage.java);
  t.deepEqual(parseLanguage("javascript"), KnownLanguage.javascript);
  t.deepEqual(parseLanguage("python"), KnownLanguage.python);
  t.deepEqual(parseLanguage("rust"), KnownLanguage.rust);

  // Aliases
  t.deepEqual(parseLanguage("c"), KnownLanguage.cpp);
  t.deepEqual(parseLanguage("c++"), KnownLanguage.cpp);
  t.deepEqual(parseLanguage("c#"), KnownLanguage.csharp);
  t.deepEqual(parseLanguage("kotlin"), KnownLanguage.java);
  t.deepEqual(parseLanguage("typescript"), KnownLanguage.javascript);

  // spaces and case-insensitivity
  t.deepEqual(parseLanguage("  \t\nCsHaRp\t\t"), KnownLanguage.csharp);
  t.deepEqual(parseLanguage("  \t\nkOtLin\t\t"), KnownLanguage.java);

  // Not matches
  t.deepEqual(parseLanguage("foo"), undefined);
  t.deepEqual(parseLanguage(" "), undefined);
  t.deepEqual(parseLanguage(""), undefined);
});
