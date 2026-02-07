
-- STOCKOUT PREDICTION & REORDER TIMING — POSTGRES SCHEMA
-- For: XGBoost daily retraining + simple fallback algo



-- 1. DIMENSION / REFERENCE TABLES


CREATE TABLE restaurants (
    restaurant_id   SERIAL PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    timezone        TEXT DEFAULT 'America/New_York',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ingredients (
    ingredient_id   SERIAL PRIMARY KEY,
    ingredient_name TEXT NOT NULL,
    unit            TEXT NOT NULL,
    unit_cost       NUMERIC(10,4) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Which ingredients each restaurant actually stocks
CREATE TABLE restaurant_ingredients (
    restaurant_id     INT NOT NULL REFERENCES restaurants(restaurant_id),
    ingredient_id     INT NOT NULL REFERENCES ingredients(ingredient_id),
    lead_time_days    SMALLINT NOT NULL DEFAULT 2,
    safety_stock_days SMALLINT NOT NULL DEFAULT 2,
    is_active         BOOLEAN DEFAULT TRUE,
    first_stocked_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- for the 90-day check
    PRIMARY KEY (restaurant_id, ingredient_id)
);

CREATE TABLE menu_items (
    menu_item_id    SERIAL PRIMARY KEY,
    restaurant_id   INT NOT NULL REFERENCES restaurants(restaurant_id),
    item_name       TEXT NOT NULL,
    price           NUMERIC(8,2),
    is_active       BOOLEAN DEFAULT TRUE
);

-- Bill of materials: which ingredients go into which menu items
CREATE TABLE menu_item_ingredients (
    menu_item_id    INT NOT NULL REFERENCES menu_items(menu_item_id),
    ingredient_id   INT NOT NULL REFERENCES ingredients(ingredient_id),
    qty_per_item    NUMERIC(10,4) NOT NULL,
    PRIMARY KEY (menu_item_id, ingredient_id)
);

CREATE TABLE holidays (
    holiday_date    DATE NOT NULL,
    holiday_name    TEXT NOT NULL,
    region          TEXT DEFAULT 'US',
    PRIMARY KEY (holiday_date, region)
);



-- 2. DAILY FACT TABLE (one row per restaurant × ingredient × day)
--    This IS your core training data / feature store.


CREATE TABLE daily_inventory_log (
    id                  BIGSERIAL PRIMARY KEY,
    restaurant_id       INT NOT NULL REFERENCES restaurants(restaurant_id),
    ingredient_id       INT NOT NULL REFERENCES ingredients(ingredient_id),
    log_date            DATE NOT NULL,

    -- Operational snapshot
    covers              INT,
    seasonality_factor  NUMERIC(4,2) DEFAULT 1.0,

    -- Inventory flow
    inventory_start     NUMERIC(12,4) NOT NULL,
    qty_used            NUMERIC(12,4) NOT NULL DEFAULT 0,
    stockout_qty        NUMERIC(12,4) NOT NULL DEFAULT 0,
    inventory_end       NUMERIC(12,4) NOT NULL,
    on_order_qty        NUMERIC(12,4) DEFAULT 0,

    -- Rolling averages (updated by nightly ETL before training)
    avg_daily_usage_7d  NUMERIC(12,4),
    avg_daily_usage_28d NUMERIC(12,4),
    avg_daily_usage_56d NUMERIC(12,4),

    -- Menu-level aggregates for that day
    units_sold_items_using  INT DEFAULT 0,
    revenue_items_using     NUMERIC(12,2) DEFAULT 0,

    UNIQUE (restaurant_id, ingredient_id, log_date)
);

-- Indexes for the two main access patterns
CREATE INDEX idx_inv_rest_ing_date
    ON daily_inventory_log (restaurant_id, ingredient_id, log_date DESC);

CREATE INDEX idx_inv_date
    ON daily_inventory_log (log_date DESC);



-- 3. PREDICTION OUTPUT TABLE


CREATE TABLE predictions (
    id                          BIGSERIAL PRIMARY KEY,
    restaurant_id               INT NOT NULL,
    ingredient_id               INT NOT NULL,
    prediction_date             DATE NOT NULL DEFAULT CURRENT_DATE,
    model_type                  TEXT NOT NULL,  -- 'xgboost' | 'simple_avg'

    -- Prediction outputs
    projected_demand_leadtime   NUMERIC(12,4),
    reorder_point               NUMERIC(12,4),
    target_stock_level          NUMERIC(12,4),
    stockout_probability        NUMERIC(5,4),     -- 0.0–1.0
    days_until_stockout         SMALLINT,

    -- Recommendation
    restock_today               BOOLEAN DEFAULT FALSE,
    suggested_order_qty         NUMERIC(12,4),
    suggested_order_date        DATE,

    created_at                  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (restaurant_id, ingredient_id, prediction_date)
);

CREATE INDEX idx_pred_lookup
    ON predictions (restaurant_id, prediction_date);



-- 4. MODEL METADATA (audit trail for daily retraining)


CREATE TABLE model_runs (
    run_id          SERIAL PRIMARY KEY,
    model_type      TEXT NOT NULL DEFAULT 'xgboost',
    trained_at      TIMESTAMPTZ DEFAULT now(),
    training_rows   INT,
    feature_set     JSONB,
    hyperparams     JSONB,
    metrics         JSONB,          -- {'rmse': ..., 'f1': ..., 'auc': ...}
    model_artifact  TEXT,           -- path to saved model file
    notes           TEXT
);


-- 5. VIEWS — training set split by the 90-day rule

-- active items with 90+ days of history
CREATE VIEW v_xgboost_training_set AS
SELECT
    d.*,
    r.restaurant_name,
    i.ingredient_name,
    i.unit,
    i.unit_cost,
    ri.lead_time_days,
    EXTRACT(YEAR  FROM d.log_date)::INT                                AS year,
    EXTRACT(MONTH FROM d.log_date)::INT                                AS month,
    EXTRACT(DOW   FROM d.log_date)::INT                                AS day_of_week,
    CASE WHEN EXTRACT(DOW FROM d.log_date) IN (0,6) THEN 1 ELSE 0 END AS is_weekend,
    CASE WHEN h.holiday_date IS NOT NULL THEN 1 ELSE 0 END            AS is_holiday,
    h.holiday_name,
    (d.inventory_end + d.on_order_qty)                                 AS inventory_position,
    (SELECT COUNT(*)        FROM menu_item_ingredients mi WHERE mi.ingredient_id = d.ingredient_id) AS num_menu_items_using,
    (SELECT AVG(qty_per_item) FROM menu_item_ingredients mi WHERE mi.ingredient_id = d.ingredient_id) AS avg_qty_per_item
FROM daily_inventory_log d
JOIN restaurants r            ON r.restaurant_id  = d.restaurant_id
JOIN ingredients i            ON i.ingredient_id  = d.ingredient_id
JOIN restaurant_ingredients ri ON ri.restaurant_id = d.restaurant_id
                              AND ri.ingredient_id = d.ingredient_id
LEFT JOIN holidays h          ON h.holiday_date   = d.log_date
WHERE ri.is_active
  AND d.log_date >= ri.first_stocked_date + INTERVAL '90 days'
  AND d.log_date >= CURRENT_DATE - INTERVAL '2 years';   -- cap training window


-- Simple-algo items: active but < 90 days of history
CREATE VIEW v_simple_prediction_items AS
SELECT
    ri.restaurant_id,
    ri.ingredient_id,
    i.ingredient_name,
    ri.lead_time_days,
    (CURRENT_DATE - ri.first_stocked_date) AS days_of_history,
    latest.inventory_end                   AS current_inventory,
    latest.on_order_qty,
    latest.avg_daily_usage_7d              AS avg_daily_usage
FROM restaurant_ingredients ri
JOIN ingredients i ON i.ingredient_id = ri.ingredient_id
LEFT JOIN LATERAL (
    SELECT inventory_end, on_order_qty, avg_daily_usage_7d
    FROM daily_inventory_log d
    WHERE d.restaurant_id = ri.restaurant_id
      AND d.ingredient_id = ri.ingredient_id
    ORDER BY d.log_date DESC
    LIMIT 1
) latest ON TRUE
WHERE ri.is_active
  AND (CURRENT_DATE - ri.first_stocked_date) < 90;


-- ────────────────────────────────────────────────────────────
-- 6. NOTES ON PARTITIONING & SCALE
-- ────────────────────────────────────────────────────────────
--
-- For production with millions of rows, partition daily_inventory_log
-- by month using pg_partman:
--
--   CREATE TABLE daily_inventory_log (...) PARTITION BY RANGE (log_date);
--   CREATE TABLE daily_inventory_log_2025_06
--       PARTITION OF daily_inventory_log
--       FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
--
-- This makes the daily training query much faster since Postgres
-- only scans the partitions within the 2-year window.
