package main

import (
	"context"

	"github.com/neo4j/neo4j-go-driver/v6/neo4j"
)

type BlacklistAddress struct {
	Address string
	AddedAt interface{}
	Note    string
}

type BlacklistResponse struct {
	Blacklist []BlacklistAddress `json:"blacklist"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
type SuccessResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Address string `json:"address,omitempty"`
}
type AddBlacklistRequest struct {
	Address string `json:"address"`
	Note    string `json:"note"`
}

func GetBlacklist(ctx context.Context, driver neo4j.Driver) (*BlacklistResponse, error) {
	var blacklist []BlacklistAddress
	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	result, err := session.Run(ctx, `MATCH (b:Blacklist)
            RETURN b.address AS address, b.addedAt AS addedAt, b.note AS note
            ORDER BY b.addedAt DESC`, nil)
	if err != nil {
		return nil, err
	}
	for result.Next(ctx) {
		record := result.Record()
		addr, _ := record.Get("address")
		addedAt, _ := record.Get("addedAt")
		note, _ := record.Get("note")
		noteStr := ""
		if note != nil {
			noteStr = note.(string)
		}

		blacklist = append(blacklist, BlacklistAddress{
			Address: addr.(string),
			AddedAt: addedAt, // เก็บเป็น interface{} ตามที่คุณประกาศไว้
			Note:    noteStr,
		})
	}
	if err := result.Err(); err != nil {
		return nil, err
	}
	return &BlacklistResponse{Blacklist: blacklist}, nil
}

func PostBlacklist(ctx context.Context, driver neo4j.Driver, req AddBlacklistRequest) (*SuccessResponse, error) {
	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	existingCheck, err := session.Run(ctx, `MATCH (b:Blacklist)
            WHERE b.address = $address
            RETURN count(b) AS count`, map[string]interface{}{
		"address": req.Address,
	})
	if err != nil {
		return nil, err
	}
	if existingCheck.Next(ctx) {
		if existingCheck.Record().Values[0].(int64) > 0 {
			return &SuccessResponse{Success: false, Message: "Address already exists in blacklist"}, nil
		}
	}
	_, err = session.Run(ctx, `CREATE (b:Blacklist {
				address: $address,
				addedAt: datetime(),
				note: $note
			})`, map[string]interface{}{
		"address": req.Address,
		"note":    req.Note,
	})
	if err != nil {
		return nil, err
	}
	return &SuccessResponse{Success: true, Message: "Address added to blacklist", Address: req.Address}, nil
}
func DeleteBlacklist(ctx context.Context, driver neo4j.Driver, address string) (*SuccessResponse, error) {
	session := driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)
	existingCheck, err := session.Run(ctx, `MATCH (b:Blacklist)
            WHERE b.address = $address
            RETURN count(b) AS count`, map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return nil, err
	}
	if existingCheck.Next(ctx) {
		if existingCheck.Record().Values[0].(int64) == 0 {
			return &SuccessResponse{Success: false, Message: "Address not found in blacklist"}, nil
		}
	}
	_, err = session.Run(ctx, `MATCH (b:Blacklist {address: $address})
            DELETE b
            RETURN count(*) AS deleted`, map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return nil, err
	}
	return &SuccessResponse{Success: true, Message: "Address deleted from blacklist", Address: address}, nil
}
