package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gocql/gocql"
	"github.com/rs/cors"
)

type InventoryMovement struct {
	ProductID string    `json:"product_id"`
	Timestamp time.Time `json:"timestamp"`
	TimeUUID  string    `json:"timeuuid"`
	Action    string    `json:"action"`
	Quantity  int       `json:"quantity"`
}

type StockRequest struct {
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
}

type UpdateTransactionRequest struct {
	ProductID string `json:"product_id"`
	TimeUUID  string `json:"timeuuid"`
	Action    string `json:"action"`
	Quantity  int    `json:"quantity"`
}

type DeleteTransactionRequest struct {
	ProductID string `json:"product_id"`
	TimeUUID  string `json:"timeuuid"`
}

type DeleteProductRequest struct {
	ProductID string `json:"product_id"`
}

type DashboardDataResponse struct {
	Transactions   []InventoryMovement `json:"transactions"`
	ProductSummary []ProductSummary    `json:"product_summary"`
	Analytics      struct {
		TotalIn           int `json:"total_in"`
		TotalOut          int `json:"total_out"`
		CurrentTotalStock int `json:"current_total_stock"`
		TotalProducts     int `json:"total_products"`
	} `json:"analytics"`
}

type StockResponse struct {
	ProductID    string              `json:"product_id"`
	CurrentStock int                 `json:"current_stock"`
	Transactions []InventoryMovement `json:"transactions"`
}

type ProductSummary struct {
	ProductID    string `json:"product_id"`
	CurrentStock int    `json:"current_stock"`
}

var session *gocql.Session

func initCassandra() {
	cluster := gocql.NewCluster("127.0.0.1")
	cluster.Consistency = gocql.Quorum

	// First connect without keyspace to create it if needed
	sess, err := cluster.CreateSession()
	if err != nil {
		log.Fatal("Could not connect to Cassandra: ", err)
	}

	err = sess.Query("CREATE KEYSPACE IF NOT EXISTS focus_app WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}").Exec()
	if err != nil {
		log.Fatal("Could not create keyspace: ", err)
	}
	sess.Close()

	// Now connect to the keyspace
	cluster.Keyspace = "focus_app"
	session, err = cluster.CreateSession()
	if err != nil {
		log.Fatal("Could not create focus_app session: ", err)
	}

	err = session.Query(`
		CREATE TABLE IF NOT EXISTS inventory (
			product_id text,
			timestamp timeuuid,
			action text,
			quantity int,
			PRIMARY KEY (product_id, timestamp)
		) WITH CLUSTERING ORDER BY (timestamp DESC)
	`).Exec()
	if err != nil {
		log.Fatal("Could not create table: ", err)
	}

	fmt.Println("Cassandra connection and schema initialized.")
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func parseAction(action string) (string, bool) {
	val := strings.ToUpper(strings.TrimSpace(action))
	if val != "IN" && val != "OUT" {
		return "", false
	}
	return val, true
}

func parseTimestamp(ts string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339Nano, ts)
	if err == nil {
		return parsed, nil
	}
	return time.Parse(time.RFC3339, ts)
}

func findTransactionUUID(productID string, target time.Time) (gocql.UUID, error) {
	iter := session.Query(
		`SELECT timestamp FROM inventory WHERE product_id = ?`,
		productID,
	).Iter()

	var rowUUID gocql.UUID
	for iter.Scan(&rowUUID) {
		if rowUUID.Time().UTC().Equal(target.UTC()) {
			_ = iter.Close()
			return rowUUID, nil
		}
	}

	if err := iter.Close(); err != nil {
		return gocql.UUID{}, err
	}

	return gocql.UUID{}, gocql.ErrNotFound
}

func getAllTransactionsData() ([]InventoryMovement, error) {
	iter := session.Query(
		`SELECT product_id, timestamp, action, quantity FROM inventory ALLOW FILTERING`,
	).Iter()

	var movements []InventoryMovement
	var productID, action string
	var quantity int
	var timestamp gocql.UUID

	for iter.Scan(&productID, &timestamp, &action, &quantity) {
		movements = append(movements, InventoryMovement{
			ProductID: productID,
			Timestamp: timestamp.Time(),
			TimeUUID:  timestamp.String(),
			Action:    action,
			Quantity:  quantity,
		})
	}

	if err := iter.Close(); err != nil {
		return nil, err
	}

	return movements, nil
}

func addStock(w http.ResponseWriter, r *http.Request) {
	var req StockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProductID == "" || req.Quantity <= 0 {
		http.Error(w, "Invalid product_id or quantity", http.StatusBadRequest)
		return
	}

	err := session.Query(`INSERT INTO inventory (product_id, timestamp, action, quantity) VALUES (?, now(), ?, ?)`,
		req.ProductID, "IN", req.Quantity).Exec()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "success"})
}

func removeStock(w http.ResponseWriter, r *http.Request) {
	var req StockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProductID == "" || req.Quantity <= 0 {
		http.Error(w, "Invalid product_id or quantity", http.StatusBadRequest)
		return
	}

	err := session.Query(`INSERT INTO inventory (product_id, timestamp, action, quantity) VALUES (?, now(), ?, ?)`,
		req.ProductID, "OUT", req.Quantity).Exec()

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "success"})
}

func getStock(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Path[len("/stock/"):]
	if productID == "" {
		http.Error(w, "Missing product_id", http.StatusBadRequest)
		return
	}

	iter := session.Query(`SELECT product_id, timestamp, action, quantity FROM inventory WHERE product_id = ?`, productID).Iter()

	var movements []InventoryMovement
	var action string
	var quantity int
	var timestamp gocql.UUID
	var prodID string

	currentStock := 0
	for iter.Scan(&prodID, &timestamp, &action, &quantity) {
		movements = append(movements, InventoryMovement{
			ProductID: prodID,
			Timestamp: timestamp.Time(),
			TimeUUID:  timestamp.String(),
			Action:    action,
			Quantity:  quantity,
		})

		if action == "IN" {
			currentStock += quantity
		} else if action == "OUT" {
			currentStock -= quantity
		}
	}

	if err := iter.Close(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := StockResponse{
		ProductID:    productID,
		CurrentStock: currentStock,
		Transactions: movements,
	}

	writeJSON(w, http.StatusOK, response)
}

func updateTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	txUUID, err := gocql.ParseUUID(req.TimeUUID)
	if err != nil {
		http.Error(w, "Invalid UUID", http.StatusBadRequest)
		return
	}

	action, ok := parseAction(req.Action)
	if !ok {
		http.Error(w, "Invalid action (must be IN or OUT)", http.StatusBadRequest)
		return
	}

	err = session.Query(
		`UPDATE inventory SET action = ?, quantity = ? WHERE product_id = ? AND timestamp = ?`,
		action, req.Quantity, req.ProductID, txUUID,
	).Exec()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func deleteTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DeleteTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	txUUID, err := gocql.ParseUUID(req.TimeUUID)
	if err != nil {
		http.Error(w, "Invalid UUID", http.StatusBadRequest)
		return
	}

	err = session.Query(
		`DELETE FROM inventory WHERE product_id = ? AND timestamp = ?`,
		req.ProductID, txUUID,
	).Exec()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func deleteProduct(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DeleteProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.ProductID == "" {
		http.Error(w, "Missing product_id", http.StatusBadRequest)
		return
	}

	err := session.Query(`DELETE FROM inventory WHERE product_id = ?`, req.ProductID).Exec()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

func getDashboardData(w http.ResponseWriter, r *http.Request) {
	movements, err := getAllTransactionsData()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	summaryMap := map[string]int{}
	totalIn := 0
	totalOut := 0

	for _, tx := range movements {
		if tx.Action == "IN" {
			summaryMap[tx.ProductID] += tx.Quantity
			totalIn += tx.Quantity
		} else if tx.Action == "OUT" {
			summaryMap[tx.ProductID] -= tx.Quantity
			totalOut += tx.Quantity
		}
	}

	summary := make([]ProductSummary, 0, len(summaryMap))
	currentTotalStock := 0
	for productID, stock := range summaryMap {
		summary = append(summary, ProductSummary{
			ProductID:    productID,
			CurrentStock: stock,
		})
		currentTotalStock += stock
	}

	var response DashboardDataResponse
	response.Transactions = movements
	response.ProductSummary = summary
	response.Analytics.TotalIn = totalIn
	response.Analytics.TotalOut = totalOut
	response.Analytics.CurrentTotalStock = currentTotalStock
	response.Analytics.TotalProducts = len(summaryMap)

	writeJSON(w, http.StatusOK, response)
}

func getTransactions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	movements, err := getAllTransactionsData()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, movements)
}

func getProductsSummary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	movements, err := getAllTransactionsData()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	summaryMap := map[string]int{}
	for _, tx := range movements {
		if tx.Action == "IN" {
			summaryMap[tx.ProductID] += tx.Quantity
		} else if tx.Action == "OUT" {
			summaryMap[tx.ProductID] -= tx.Quantity
		}
	}

	summary := make([]ProductSummary, 0, len(summaryMap))
	for productID, stock := range summaryMap {
		summary = append(summary, ProductSummary{
			ProductID:    productID,
			CurrentStock: stock,
		})
	}

	writeJSON(w, http.StatusOK, summary)
}

func main() {
	initCassandra()
	defer session.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/add-stock", addStock)
	mux.HandleFunc("/remove-stock", removeStock)
	mux.HandleFunc("/stock/", getStock)
	mux.HandleFunc("/update-transaction", updateTransaction)
	mux.HandleFunc("/delete-transaction", deleteTransaction)
	mux.HandleFunc("/delete-product", deleteProduct)
	mux.HandleFunc("/transactions", getTransactions)
	mux.HandleFunc("/products-summary", getProductsSummary)
	mux.HandleFunc("/dashboard-data", getDashboardData)

	handler := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowedHeaders: []string{"*"},
	}).Handler(mux)

	fmt.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}
