package main

import (
	"encoding/json"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/neo4j/neo4j-go-driver/v6/neo4j"
)

type AlchemyTransfer struct {
	BlockNumber string  `json:"blockNum"`
	UniqueId    string  `json:"uniqueId"`
	Hash        string  `json:"hash"`
	From        string  `json:"from"`
	To          string  `json:"to"`
	Value       float64 `json:"value"`
	Asset       string  `json:"asset"`
	Timestamp   uint64  `json:"timestamp"`
	Metadata    struct {
		BlockTimestamp string `json:"blockTimestamp"`
	} `json:"metadata"`
}
type AlchemyResponse struct {
	Result struct {
		Transfers []AlchemyTransfer `json:"transfers"`
	} `json:"result"`
}
type UserRequest struct {
	Address string `json:"address"`
	UseMock bool   `json:"useMock"`
}

func LoadMockData() ([]AlchemyTransfer, error) {
	file, err := os.ReadFile(`D:\Project\Blockchain-analysis\BlockchainAnaly\public\mockalchemy.json`)
	if err != nil {
		return nil, err
	}

	var data AlchemyResponse
	if err := json.Unmarshal(file, &data); err != nil {
		return nil, err
	}

	return data.Result.Transfers, nil
}
func PostIngest(Driver neo4j.Driver) fiber.Handler {
	return func(c fiber.Ctx) error {
		var req UserRequest
		if err := c.Bind().Body(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": err.Error()})
		}
		ctx := c.Context()
		var transfers []AlchemyTransfer
		var err error
		if req.UseMock {
			transfers, err = LoadMockData()
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": err.Error()})
			}
		} else {

			return c.Status(501).JSON(fiber.Map{"error": "Real API fetch not implemented yet"})
		}
		session := Driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
		defer session.Close(c.Context())

		_, err = session.Run(c.Context(), `MATCH (n) DETACH DELETE n`, nil)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		_, err = session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (interface{}, error) {
			for _, t := range transfers {
				if t.From == "" || t.To == "" {
					continue
				}

				cypher := `
					MERGE (sender:Wallet {address: $fromAddr})
					MERGE (receiver:Wallet {address: $toAddr})
					CREATE (t:Transaction {
						hash: $hash, 
						value: $value, 
						asset: $asset, 
						blockTimestamp: $blockTimestamp
					})
					CREATE (sender)-[:SENT {blockTimestamp: $blockTimestamp}]->(t)-[:RECEIVED {blockTimestamp: $blockTimestamp}]->(receiver)`

				params := map[string]interface{}{
					"fromAddr":       t.From,
					"toAddr":         t.To,
					"hash":           t.Hash,
					"value":          t.Value,
					"asset":          t.Asset,
					"blockTimestamp": t.Metadata.BlockTimestamp,
				}

				if _, err := tx.Run(ctx, cypher, params); err != nil {
					return nil, err
				}
			}
			return nil, nil
		})
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{
			"success": true,
			"count":   len(transfers),
			"message": "Data ingested into Neo4j",
		})
	}
}
