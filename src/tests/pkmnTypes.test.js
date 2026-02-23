const request = require("supertest");
const app = require("../app");

describe("GET /api/pkmn/types", () => {
  it("should return list of pokemon types", async () => {
    const res = await request(app).get("/api/pkmn/types");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty("count");
    expect(res.body.count).toBe(res.body.data.length);
    expect(res.body.data).toContain("FIRE");
  });
});