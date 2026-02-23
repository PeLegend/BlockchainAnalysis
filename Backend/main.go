package main

import (
	"context"
	"fmt"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/neo4j/neo4j-go-driver/v6/neo4j"
)

func main() {
	uri := os.Getenv("NEO4J_URI")
	if uri == "" {
		uri = "neo4j://localhost:7687"
	}

	username := os.Getenv("NEO4J_USER")
	if username == "" {
		username = "neo4j"
	}

	password := os.Getenv("NEO4J_PASSWORD")
	if password == "" {
		password = "12345678"
	}

	ctx := context.Background()
	driver, err := neo4j.NewDriver(uri, neo4j.BasicAuth(username, password, ""))
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to Neo4j: %v", err))
	}
	defer driver.Close(ctx)

	app := fiber.New()

	app.Get("/api/blacklist", func(c fiber.Ctx) error {
		result, err := GetBlacklist(c.Context(), driver)

		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(result)
	})
	app.Post("/api/ingest", PostIngest(driver))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if err := app.Listen(":" + port); err != nil {
		panic(err)
	}
}
