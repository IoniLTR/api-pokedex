const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/user");
const Pokemon = require("../models/pokemon");

describe("E2E Tests", () => {
    let adminToken = "";
    let createdPokemonId = "";

    beforeAll(async () => {
        // Setup environment variables for test
        process.env.JWT_SECRET = "super_secret_test_key";

        // Connect to test database
        await mongoose.connect("mongodb://127.0.0.1:27017/pokedex_test");

        // Clear test database collections
        await User.deleteMany({});
        await Pokemon.deleteMany({});
    });

    afterAll(async () => {
        // Clean up
        await User.deleteMany({});
        await Pokemon.deleteMany({});

        // Drop test database & disconnect
        await mongoose.connection.db.dropDatabase();
        await mongoose.disconnect();
    });

    describe("Test End To End 1: User Login/Register Flow", () => {
        it("should register a new ADMIN user", async () => {
            const res = await request(app).post("/api/user/register").send({
                username: "adminUser",
                password: "securepassword",
                role: "ADMIN"
            });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty("token");
            expect(res.body.user).toHaveProperty("username", "adminUser");
            expect(res.body.user).toHaveProperty("role", "ADMIN");
        });

        it("should login with the registered user", async () => {
            const res = await request(app).post("/api/user/login").send({
                username: "adminUser",
                password: "securepassword"
            });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("token");

            // Save token for next tests
            adminToken = res.body.token;
        });

        it("should fail to register without password", async () => {
            const res = await request(app).post("/api/user/register").send({
                username: "incompleteUser"
            });
            expect(res.statusCode).toBe(400);
        });

        it("should fail to login with wrong password", async () => {
            const res = await request(app).post("/api/user/login").send({
                username: "adminUser",
                password: "wrongpassword"
            });
            expect(res.statusCode).toBe(401);
        });

        it("should fail to login non-existent user", async () => {
            const res = await request(app).post("/api/user/login").send({
                username: "ghostUser",
                password: "password"
            });
            expect(res.statusCode).toBe(401);
        });
    });
    describe("Test End To End 2: Pokemon Creation and Search", () => {
        it("should allow ADMIN to create a new Pokemon", async () => {
            const res = await request(app)
                .post("/api/pkmn")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("name", "Pikachu")
                .field("types", JSON.stringify(["ELECTRIC"]))
                .field("imgUrl", "https://example.com/pikachu.png")
                .field("hp", 35)
                .field("attack", 55)
                .field("defense", 40)
                .field("spAttack", 50)
                .field("spDefense", 50)
                .field("speed", 90);

            if (res.statusCode !== 201) console.error(res.body);
            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty("name", "Pikachu");
            expect(res.body._id).toBeDefined();

            createdPokemonId = res.body._id;
        });

        it("should find the created Pokemon via search", async () => {
            const res = await request(app).get("/api/pkmn/search?name=Pika");

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("data");
            expect(Array.isArray(res.body.data)).toBe(true);

            const found = res.body.data.find(p => p.name === "Pikachu");
            expect(found).toBeDefined();
        });

        it("should retrieve a single pokemon by id", async () => {
            const res = await request(app)
                .get(`/api/pkmn?id=${createdPokemonId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("name", "Pikachu");
        });

        it("should update a Pokemon", async () => {
            const res = await request(app)
                .put(`/api/pkmn?id=${createdPokemonId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .field("baseStats", JSON.stringify({ hp: 40 }));

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty("baseStats");
            expect(res.body.baseStats).toHaveProperty("hp", 40);
        });

        it("should add a region to Pokemon", async () => {
            const res = await request(app)
                .post("/api/pkmn/region")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("pkmnID", createdPokemonId)
                .field("regionName", "Kanto")
                .field("regionPokedexNumber", 25);

            expect(res.statusCode).toBe(200);
            expect(res.body.regions.length).toBe(1);
            expect(res.body.regions[0].regionName).toBe("Kanto");
        });

        it("should sync Pokemon cry", async () => {
            const res = await request(app)
                .post("/api/pkmn/cry")
                .set("Authorization", `Bearer ${adminToken}`)
                .field("pkmnID", createdPokemonId);

            expect(res.statusCode).toBe(200);
        });

        it("should remove a region from Pokemon", async () => {
            const res = await request(app)
                .delete(`/api/pkmn/region?pkmnID=${createdPokemonId}&regionName=Kanto`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(204);
        });

        it("should test user favorites (GET/PUT)", async () => {
            const putRes = await request(app)
                .put("/api/user/favorites")
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ favorites: [createdPokemonId] });
            expect(putRes.statusCode).toBe(200);
            expect(putRes.body.favorites).toContain(createdPokemonId);

            const getRes = await request(app)
                .get("/api/user/favorites")
                .set("Authorization", `Bearer ${adminToken}`);
            expect(getRes.statusCode).toBe(200);
            expect(getRes.body.favorites).toContain(createdPokemonId);
        });

        it("should delete a Pokemon", async () => {
            const res = await request(app)
                .delete(`/api/pkmn?id=${createdPokemonId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(204);

            // Verify deleted
            const getRes = await request(app).get(`/api/pkmn?id=${createdPokemonId}`).set("Authorization", `Bearer ${adminToken}`);
            expect(getRes.statusCode).toBe(404);
        });
    });
});
