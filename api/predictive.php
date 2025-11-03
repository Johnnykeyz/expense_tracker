<?php
require_once 'api.php';

function analyzeTrends($userId) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }

    // Get last 3 months of transactions
    $query = "SELECT type, category, amount, transaction_date 
              FROM transactions 
              WHERE user_id = ? 
              AND transaction_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
              ORDER BY transaction_date DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $transactions = [];
    while ($row = $result->fetch_assoc()) {
        $transactions[] = $row;
    }
    $stmt->close();

    // Group by category
    $categoryTrends = [];
    foreach ($transactions as $transaction) {
        if ($transaction['type'] === 'expense') {
            $category = $transaction['category'];
            $month = date('Y-m', strtotime($transaction['transaction_date']));
            
            if (!isset($categoryTrends[$category])) {
                $categoryTrends[$category] = [];
            }
            
            if (!isset($categoryTrends[$category][$month])) {
                $categoryTrends[$category][$month] = 0;
            }
            
            $categoryTrends[$category][$month] += $transaction['amount'];
        }
    }

    // Calculate predictions and trends
    $predictions = [];
    $currentMonth = date('Y-m');
    
    foreach ($categoryTrends as $category => $monthlyData) {
        $months = array_keys($monthlyData);
        $amounts = array_values($monthlyData);
        
        if (count($amounts) >= 2) {
            // Simple linear trend calculation
            $lastMonth = $amounts[0];
            $avgChange = 0;
            
            for ($i = 1; $i < count($amounts); $i++) {
                $avgChange += $amounts[$i - 1] - $amounts[$i];
            }
            $avgChange = $avgChange / (count($amounts) - 1);
            
            // Predict next month
            $predictedAmount = $lastMonth + $avgChange;
            $trend = $avgChange > 0 ? 'increasing' : 'decreasing';
            $percentChange = $lastMonth > 0 ? ($avgChange / $lastMonth) * 100 : 0;
            
            $predictions[$category] = [
                'current_amount' => $lastMonth,
                'predicted_amount' => max(0, $predictedAmount),
                'trend' => $trend,
                'percent_change' => round($percentChange, 2),
                'average_monthly' => array_sum($amounts) / count($amounts)
            ];
            
            // Store prediction
            $stmt = $conn->prepare("INSERT INTO spending_predictions (user_id, category, predicted_amount, prediction_date) VALUES (?, ?, ?, DATE_ADD(LAST_DAY(NOW()), INTERVAL 1 DAY))");
            $stmt->bind_param("isd", $userId, $category, $predictedAmount);
            $stmt->execute();
            $stmt->close();
        }
    }

    $conn->close();
    return ['success' => true, 'predictions' => $predictions];
}

function generateRecommendations($userId) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }

    $recommendations = [];
    
    // Get spending patterns
    $patterns = analyzeTrends($userId);
    
    if ($patterns['success']) {
        foreach ($patterns['predictions'] as $category => $data) {
            if ($data['trend'] === 'increasing' && $data['percent_change'] > 20) {
                // Store recommendation for significant increases
                $message = "Your {$category} spending is up {$data['percent_change']}% compared to your average. ";
                $potentialSavings = $data['predicted_amount'] - $data['average_monthly'];
                
                if ($category === 'Transport') {
                    $message .= "Consider using public transportation 2 days a week to save approximately ₦" . number_format($potentialSavings * 0.4, 2);
                    $savingsAmount = $potentialSavings * 0.4;
                } else {
                    $message .= "Setting a budget limit of ₦" . number_format($data['average_monthly'], 2) . " could save you ₦" . number_format($potentialSavings, 2);
                    $savingsAmount = $potentialSavings;
                }
                
                $stmt = $conn->prepare("INSERT INTO recommendations (user_id, category, recommendation_type, message, potential_savings) VALUES (?, ?, 'pattern', ?, ?)");
                $stmt->bind_param("issd", $userId, $category, $message, $savingsAmount);
                $stmt->execute();
                $stmt->close();
                
                $recommendations[] = [
                    'category' => $category,
                    'message' => $message,
                    'potential_savings' => $savingsAmount
                ];
            }
        }
    }
    
    // Analyze spending by day of week
    $query = "SELECT 
                category,
                DAYNAME(transaction_date) as day_of_week,
                AVG(amount) as avg_amount,
                COUNT(*) as frequency
              FROM transactions 
              WHERE user_id = ? 
                AND type = 'expense'
                AND transaction_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)
              GROUP BY category, DAYNAME(transaction_date)
              HAVING frequency >= 4
              ORDER BY avg_amount DESC";
              
    $stmt = $conn->prepare($query);
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        if ($row['avg_amount'] > 0) {
            $message = "You tend to spend more on {$row['category']} on {$row['day_of_week']}s (avg: ₦" . number_format($row['avg_amount'], 2) . "). ";
            $message .= "Consider setting a day-specific budget limit.";
            
            $stmt2 = $conn->prepare("INSERT INTO recommendations (user_id, category, recommendation_type, message, potential_savings) VALUES (?, ?, 'budget', ?, ?)");
            $savingsAmount = $row['avg_amount'] * 0.25; // Assume 25% potential savings
            $stmt2->bind_param("issd", $userId, $row['category'], $message, $savingsAmount);
            $stmt2->execute();
            $stmt2->close();
            
            $recommendations[] = [
                'category' => $row['category'],
                'message' => $message,
                'potential_savings' => $savingsAmount
            ];
        }
    }
    $stmt->close();
    
    $conn->close();
    return ['success' => true, 'recommendations' => $recommendations];
}

function findNearbyVendors($latitude, $longitude, $category) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }

    // Find vendors within 5km radius with better prices
    $query = "SELECT 
                vendor_name,
                price,
                item_name,
                (
                    6371 * acos(
                        cos(radians(?)) * 
                        cos(radians(latitude)) * 
                        cos(radians(longitude) - radians(?)) + 
                        sin(radians(?)) * 
                        sin(radians(latitude))
                    )
                ) AS distance
              FROM vendor_prices
              WHERE category = ?
              HAVING distance < 5
              ORDER BY price ASC, distance ASC
              LIMIT 5";
              
    $stmt = $conn->prepare($query);
    $stmt->bind_param("ddds", $latitude, $longitude, $latitude, $category);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $vendors = [];
    while ($row = $result->fetch_assoc()) {
        $vendors[] = $row;
    }
    
    $stmt->close();
    $conn->close();
    
    return ['success' => true, 'vendors' => $vendors];
}

function handleOCRReceipt($image, $userId) {
    // This is a placeholder for OCR functionality
    // In a real implementation, you would:
    // 1. Use a service like Google Cloud Vision API or Tesseract
    // 2. Process the image to extract text
    // 3. Parse the text to identify items, prices, and vendor
    
    return [
        'success' => true,
        'message' => 'Receipt processed successfully',
        'data' => [
            'vendor' => 'Sample Vendor',
            'items' => [
                ['name' => 'Item 1', 'price' => 100.00],
                ['name' => 'Item 2', 'price' => 200.00]
            ],
            'total' => 300.00,
            'date' => date('Y-m-d H:i:s')
        ]
    ];
}
?>