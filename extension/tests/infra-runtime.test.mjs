import assert from "assert";
import { FsuHttpClient } from "../src/fsu/infra/HttpClient.js";
import { FsuJsonStore } from "../src/fsu/infra/JsonStore.js";

export async function runInfraRuntimeTests() {
  const values = new Map([
    ["object", JSON.stringify({ enabled: true })],
    ["array", JSON.stringify([1, 2])],
    ["invalid", "not-json"]
  ]);
  const writes = [];
  const store = new FsuJsonStore(
    (key, fallback) => (values.has(key) ? values.get(key) : fallback),
    (key, value) => writes.push([key, value])
  );

  assert.deepStrictEqual(store.getObject("object"), { enabled: true });
  assert.deepStrictEqual(store.getArray("array"), [1, 2]);
  assert.deepStrictEqual(store.getObject("array", { fallback: true }), { fallback: true });

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.deepStrictEqual(store.getObject("invalid", { fallback: true }), { fallback: true });
  } finally {
    console.warn = originalWarn;
  }

  store.setJson("saved", { id: 1 });
  assert.deepStrictEqual(writes, [["saved", '{"id":1}']]);

  let successfulRequest;
  const client = new FsuHttpClient((details) => {
    successfulRequest = details;
    details.onload({ status: 201, responseText: "created" });
  }, "FSU test agent");

  assert.strictEqual(
    await client.request("POST", "https://example.test/items", '{"id":1}', "application/custom"),
    "created"
  );
  assert.deepStrictEqual(successfulRequest, {
    method: "POST",
    url: "https://example.test/items",
    data: '{"id":1}',
    headers: {
      "User-Agent": "FSU test agent",
      "Content-Type": "application/custom"
    },
    onload: successfulRequest.onload,
    onerror: successfulRequest.onerror
  });

  const rejectedClient = new FsuHttpClient((details) => {
    details.onload({ status: 500, responseText: "server error" });
  }, "FSU test agent");
  await assert.rejects(
    () => rejectedClient.request("GET", "https://example.test/items"),
    (error) => error === 500
  );

  const originalError = console.error;
  console.error = () => {};
  try {
    const unavailableClient = new FsuHttpClient((details) => {
      details.onerror({});
    }, "FSU test agent");
    await assert.rejects(
      () => unavailableClient.request("GET", "https://example.test/items"),
      (error) => error === "Unknown error occurred"
    );
  } finally {
    console.error = originalError;
  }
}
