const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/user");
const Pokemon = require("../models/pokemon");
const Trainer = require("../models/trainer");

// This test file uses the same connection lifecycle as e2e.test.js
// It connects in beforeAll and cleans up (without disconnect) in afterAll
// so it can run alongside other suites in runInBand mode.

describe("Additional Coverage Tests", () => {
    let adminToken = "";
    let userToken = "";
    let testPokemonId = "";

    beforeAll(async () => {
        process.env.JWT_SECRET = "trainer_test_secret";

        // Connect only if no connection is open
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect("mongodb://127.0.0.1:27017/pokedex_test");
        }

        // Clean slate for this suite
        await User.deleteMany({ username: { $in: ["trainerAdmin2", "trainerUser2"] } });

        // Register ADMIN user
        const adminRes = await request(app).post("/api/user/register").send({
            username: "trainerAdmin2",
            password: "adminpass2",
            role: "ADMIN",
        });
        adminToken = adminRes.body.token;

        // Register regular USER
        const userRes = await request(app).post("/api/user/register").send({
            username: "trainerUser2",
            password: "userpass2",
        });
        userToken = userRes.body.token;

        // Create a Pokémon
        const pkmnRes = await request(app)
            .post("/api/pkmn")
            .set("Authorization", `Bearer ${adminToken}`)
            .field("name", "TestMonster")
            .field("types", JSON.stringify(["WATER"]))
            .field("imgUrl", "https://example.com/testmonster.png");

        testPokemonId = pkmnRes.body._id;
    });

    afterAll(async () => {
        // Clean up only what we created in this suite
        await User.deleteMany({ username: { $in: ["trainerAdmin2", "trainerUser2"] } });
        if (testPokemonId) {
            await Pokemon.deleteMany({ name: "TestMonster" });
        }
        await Trainer.deleteMany({ username: { $in: ["trainerAdmin2", "trainerUser2"] } });
        // Do NOT disconnect - managed by the last suite's afterAll
    });

    // --- Auth Middleware ---
    describe("Auth Middleware", () => {
        it("should reject request with no token (401)", async () => {
            const res = await request(app).get("/api/user/checkUser");
            expect(res.statusCode).toBe(401);
        });

        it("should reject request with invalid token (401)", async () => {
            const res = await request(app)
                .get("/api/user/checkUser")
                .set("Authorization", "Bearer invalidjwttoken123");
            expect(res.statusCode).toBe(401);
        });

        it("should accept request with valid token", async () => {
            const res = await request(app)
                .get("/api/user/checkUser")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("user");
        });

        it("should reject with wrong token prefix (401)", async () => {
            const res = await request(app)
                .get("/api/user/checkUser")
                .set("Authorization", "Token something");
            expect(res.statusCode).toBe(401);
        });
    });

    // --- Permission Middleware ---
    describe("Permission Middleware (ADMIN vs USER)", () => {
        it("should reject USER trying to create a Pokemon (403)", async () => {
            const res = await request(app)
                .post("/api/pkmn")
                .set("Authorization", `Bearer ${userToken}`)
                .field("name", "ForbiddenMon")
                .field("types", JSON.stringify(["FIRE"]))
                .field("imgUrl", "https://example.com/forbidden.png");

            expect(res.statusCode).toBe(403);
        });

        it("should reject USER trying to delete a Pokemon (403)", async () => {
            const res = await request(app)
                .delete(`/api/pkmn?id=${testPokemonId}`)
                .set("Authorization", `Bearer ${userToken}`);
            expect(res.statusCode).toBe(403);
        });

        it("should reject USER trying to update a Pokemon (403)", async () => {
            const res = await request(app)
                .put(`/api/pkmn?id=${testPokemonId}`)
                .set("Authorization", `Bearer ${userToken}`)
                .field("name", "Forbidden");
            expect(res.statusCode).toBe(403);
        });
    });

    // --- Trainer Routes ---
    describe("Trainer Routes (CRUD)", () => {
        it("should create a trainer for the admin user", async () => {
            const res = await request(app)
                .post("/api/trainer")
                .set("Authorization", `Bearer ${adminToken}`)
                .send();
            expect([200, 201]).toContain(res.statusCode);
        });

        it("should get the trainer for the admin user", async () => {
            const res = await request(app)
                .get("/api/trainer")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
        });

        it("should mark Pokemon as seen", async () => {
            const res = await request(app)
                .post("/api/trainer/mark")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("pkmnID", testPokemonId)
                .field("status", "seen");
            expect([200, 201]).toContain(res.statusCode);
        });

        it("should mark Pokemon as caught", async () => {
            const res = await request(app)
                .post("/api/trainer/mark")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("pkmnID", testPokemonId)
                .field("status", "CATCHED");
            expect([200, 201]).toContain(res.statusCode);
        });

        it("should delete the trainer", async () => {
            const res = await request(app)
                .delete("/api/trainer")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(204);
        });

        it("should return 404 on trainer that was deleted", async () => {
            const res = await request(app)
                .get("/api/trainer")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });
    });

    // --- Pokemon edge cases ---
    describe("Pokemon - Edge Cases", () => {
        it("should fail with invalid id (400)", async () => {
            const res = await request(app)
                .get("/api/pkmn?id=invalid-id")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(400);
        });

        it("should fail with no id/name (400)", async () => {
            const res = await request(app)
                .get("/api/pkmn")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(400);
        });

        it("should find Pokemon by name", async () => {
            const res = await request(app)
                .get("/api/pkmn?name=TestMonster")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("name", "TestMonster");
        });

        it("should fail with duplicate Pokemon (409)", async () => {
            const res = await request(app)
                .post("/api/pkmn")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("name", "TestMonster")
                .field("types", JSON.stringify(["WATER"]))
                .field("imgUrl", "https://example.com/testmonster.png");
            expect(res.statusCode).toBe(409);
        });

        it("should fail addRegion with missing fields (400)", async () => {
            const res = await request(app)
                .post("/api/pkmn/region")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("pkmnID", testPokemonId);
            expect(res.statusCode).toBe(400);
        });

        it("should fail delete with invalid id (400)", async () => {
            const res = await request(app)
                .delete("/api/pkmn?id=invalid-id")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(400);
        });

        it("should fail delete with non-existent ObjectId (404)", async () => {
            const fakeId = new mongoose.Types.ObjectId().toString();
            const res = await request(app)
                .delete(`/api/pkmn?id=${fakeId}`)
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        it("should fail search for non-existent Pokemon by name (404)", async () => {
            const res = await request(app)
                .get("/api/pkmn?name=NonExistentPokemon999")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(404);
        });

        it("should search all Pokemon (200)", async () => {
            const res = await request(app).get("/api/pkmn/search");
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("data");
        });

        it("should fail register with duplicate username (409)", async () => {
            const res = await request(app).post("/api/user/register").send({
                username: "trainerAdmin2",
                password: "duplicate",
            });
            expect(res.statusCode).toBe(409);
        });

        it("should fail update with invalid id (400)", async () => {
            const res = await request(app)
                .put("/api/pkmn?id=invalid-id")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("name", "x");
            expect(res.statusCode).toBe(400);
        });

        it("should fail cry sync with no ID (400)", async () => {
            const res = await request(app)
                .post("/api/pkmn/cry")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({});
            expect(res.statusCode).toBe(400);
        });

        it("should fail removeRegion with bad id (400)", async () => {
            const res = await request(app)
                .delete("/api/pkmn/region?pkmnID=bad-id&regionName=Kanto")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(res.statusCode).toBe(400);
        });

        it("should filter Pokemon by type", async () => {
            const res = await request(app).get("/api/pkmn/search?typeOne=WATER");
            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
});
