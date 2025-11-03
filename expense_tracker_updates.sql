-- Add location tracking for transactions
ALTER TABLE transactions
ADD COLUMN location_name VARCHAR(255),
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(10, 8),
ADD COLUMN vendor_name VARCHAR(255);

-- Create table for storing receipt data
CREATE TABLE receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT,
    image_path VARCHAR(255),
    ocr_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

-- Create table for spending predictions
CREATE TABLE spending_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    category VARCHAR(100),
    predicted_amount DECIMAL(10, 2),
    prediction_date DATE,
    confidence_score DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create table for smart recommendations
CREATE TABLE recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    category VARCHAR(100),
    recommendation_type ENUM('savings', 'budget', 'vendor', 'pattern'),
    message TEXT,
    potential_savings DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN DEFAULT FALSE,
    is_implemented BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create table for vendor comparison data
CREATE TABLE vendor_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name VARCHAR(255),
    category VARCHAR(100),
    item_name VARCHAR(255),
    price DECIMAL(10, 2),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(10, 8),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create table for user spending patterns
CREATE TABLE spending_patterns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    category VARCHAR(100),
    pattern_type ENUM('daily', 'weekly', 'monthly'),
    pattern_data JSON,
    analysis_period_start DATE,
    analysis_period_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);