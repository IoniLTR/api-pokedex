const request = require("supertest");
const app = require("../app");
const jwt = require("jsonwebtoken");

describe("GET /api/pkmn/types", () => {
  let token;

  beforeAll(() => {
    process.env.JWT_SECRET = "testsecret";
    token = jwt.sign({ id: "123", username: "testuser", role: "USER" }, process.env.JWT_SECRET);
  });

  it("should return list of pokemon types", async () => {
    const res = await request(app)
      .get("/api/pkmn/types")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty("count");
    expect(res.body.count).toBe(res.body.data.length);
    expect(res.body.data).toContain("FIRE");
  });
});