<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

// Database configuration
define('DB_HOST', getenv('DB_HOST'));
define('DB_USER', getenv('DB_USER'));
define('DB_PASS', getenv('DB_PASS'));
define('DB_NAME', getenv('DB_NAME'));


if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
// Create connection
function getDBConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
   
    if ($conn->connect_error) {
    return ['success' => false, 'message' => 'DB Error: ' . $conn->connect_error];
}
    
    return $conn;
}



// Register new user
function registerUser($data) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    // Validate input
    if (empty($data['username']) || empty($data['email']) || empty($data['password']) || 
        empty($data['phone']) || empty($data['fullName'])) {
        $conn->close();
        return ['success' => false, 'message' => 'All fields are required'];
    }
    
    // Validate email format
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $conn->close();
        return ['success' => false, 'message' => 'Invalid email format'];
    }
    
    // Check if username or email already exists
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->bind_param("ss", $data['username'], $data['email']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $stmt->close();
        $conn->close();
        return ['success' => false, 'message' => 'Username or email already exists'];
    }
    $stmt->close();
    
    // Hash password
    $passwordHash = password_hash($data['password'], PASSWORD_BCRYPT);
    
    // Insert new user
    $stmt = $conn->prepare("INSERT INTO users (username, email, phone, full_name, password_hash, balance) VALUES (?, ?, ?, ?, ?, 0)");
    $stmt->bind_param("sssss", 
        $data['username'],
        $data['email'],
        $data['phone'],
        $data['fullName'],
        $passwordHash
    );
    
    if ($stmt->execute()) {
        $userId = $stmt->insert_id;
        $stmt->close();
        $conn->close();
        return ['success' => true, 'message' => 'Registration successful', 'userId' => $userId];
    }
    
    $stmt->close();
    $conn->close();
    return ['success' => false, 'message' => 'Registration failed'];
}

// Login user
function loginUser($data) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    if (empty($data['username']) || empty($data['password'])) {
        $conn->close();
        return ['success' => false, 'message' => 'Username and password are required'];
    }
    
    // Get user by username or email
    $stmt = $conn->prepare("SELECT id, username, email, full_name, phone, password_hash, balance, is_active FROM users WHERE username = ? OR email = ?");
    $stmt->bind_param("ss", $data['username'], $data['username']);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        return ['success' => false, 'message' => 'Invalid username or password'];
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    
    // Check if account is active
    if (!$user['is_active']) {
        $conn->close();
        return ['success' => false, 'message' => 'Account is deactivated'];
    }
    
    // Verify password
    if (!password_verify($data['password'], $user['password_hash'])) {
        $conn->close();
        return ['success' => false, 'message' => 'Invalid username or password'];
    }
    
    // Generate session token
    $sessionToken = bin2hex(random_bytes(32));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));
    
    // Delete old sessions for this user
    $stmt = $conn->prepare("DELETE FROM sessions WHERE user_id = ?");
    $stmt->bind_param("i", $user['id']);
    $stmt->execute();
    $stmt->close();
    
    // Create new session
    $stmt = $conn->prepare("INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)");
    $stmt->bind_param("iss", $user['id'], $sessionToken, $expiresAt);
    $stmt->execute();
    $stmt->close();
    
    // Update last login
    $stmt = $conn->prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->bind_param("i", $user['id']);
    $stmt->execute();
    $stmt->close();
    
    $conn->close();
    
    return [
        'success' => true,
        'message' => 'Login successful',
        'sessionToken' => $sessionToken,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'fullName' => $user['full_name'],
            'phone' => $user['phone'],
            'balance' => $user['balance']
        ]
    ];
}

// Logout user
function logoutUser($sessionToken) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    $stmt = $conn->prepare("DELETE FROM sessions WHERE session_token = ?");
    $stmt->bind_param("s", $sessionToken);
    $stmt->execute();
    $stmt->close();
    $conn->close();
    
    return ['success' => true, 'message' => 'Logout successful'];
}

// Verify session
function verifySession($sessionToken) {
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    $stmt = $conn->prepare("SELECT s.user_id, u.username, u.email, u.full_name, u.phone, u.balance 
                            FROM sessions s 
                            JOIN users u ON s.user_id = u.id 
                            WHERE s.session_token = ? AND s.expires_at > NOW()");
    $stmt->bind_param("s", $sessionToken);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        $stmt->close();
        $conn->close();
        return ['success' => false, 'message' => 'Invalid or expired session'];
    }
    
    $user = $result->fetch_assoc();
    $stmt->close();
    $conn->close();
    
    return [
        'success' => true,
        'user' => [
            'id' => $user['user_id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'fullName' => $user['full_name'],
            'phone' => $user['phone'],
            'balance' => $user['balance']
        ]
    ];
}

// Add transaction
function addTransaction($data, $sessionToken) {
    // Verify session first
    $sessionCheck = verifySession($sessionToken);
    if (!$sessionCheck['success']) {
        return $sessionCheck;
    }
    
    $userId = $sessionCheck['user']['id'];
    
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    // Insert transaction
    $stmt = $conn->prepare("INSERT INTO transactions (user_id, type, category, description, amount) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("isssd", 
        $userId,
        $data['type'],
        $data['category'],
        $data['description'],
        $data['amount']
    );
    
    if ($stmt->execute()) {
        $transactionId = $stmt->insert_id;
        
        // Update user balance
        $amount = $data['amount'];
        if ($data['type'] == 'income') {
            $sql = "UPDATE users SET balance = balance + ? WHERE id = ?";
        } else {
            $sql = "UPDATE users SET balance = balance - ? WHERE id = ?";
        }
        
        $updateStmt = $conn->prepare($sql);
        $updateStmt->bind_param("di", $amount, $userId);
        $updateStmt->execute();
        $updateStmt->close();
        
        $stmt->close();
        $conn->close();
        
        return ['success' => true, 'transactionId' => $transactionId];
    }
    
    $stmt->close();
    $conn->close();
    
    return ['success' => false, 'message' => 'Failed to add transaction'];
}

// Get transactions
function getTransactions($sessionToken) {
    $sessionCheck = verifySession($sessionToken);
    if (!$sessionCheck['success']) {
        return $sessionCheck;
    }
    
    $userId = $sessionCheck['user']['id'];
    
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    $stmt = $conn->prepare("SELECT id, type, category, description, amount, transaction_date as date FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $transactions = [];
    while ($row = $result->fetch_assoc()) {
        $transactions[] = $row;
    }
    
    $stmt->close();
    $conn->close();
    
    return [
        'success' => true, 
        'transactions' => $transactions,
        'balance' => $sessionCheck['user']['balance']
    ];
}

// Delete transaction
function deleteTransaction($transactionId, $sessionToken) {
    $sessionCheck = verifySession($sessionToken);
    if (!$sessionCheck['success']) {
        return $sessionCheck;
    }
    
    $userId = $sessionCheck['user']['id'];
    
    $conn = getDBConnection();
    
    if (!$conn) {
        return ['success' => false, 'message' => 'Database connection failed'];
    }
    
    // Get transaction details
    $stmt = $conn->prepare("SELECT type, amount FROM transactions WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $transactionId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows == 0) {
        $stmt->close();
        $conn->close();
        return ['success' => false, 'message' => 'Transaction not found'];
    }
    
    $transaction = $result->fetch_assoc();
    $stmt->close();
    
    // Delete transaction
    $stmt = $conn->prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $transactionId, $userId);
    
    if ($stmt->execute()) {
        // Update balance
        $amount = $transaction['amount'];
        if ($transaction['type'] == 'income') {
            $sql = "UPDATE users SET balance = balance - ? WHERE id = ?";
        } else {
            $sql = "UPDATE users SET balance = balance + ? WHERE id = ?";
        }
        
        $updateStmt = $conn->prepare($sql);
        $updateStmt->bind_param("di", $amount, $userId);
        $updateStmt->execute();
        $updateStmt->close();
        
        $stmt->close();
        $conn->close();
        
        return ['success' => true, 'message' => 'Transaction deleted'];
    }
    
    $stmt->close();
    $conn->close();
    
    return ['success' => false, 'message' => 'Failed to delete transaction'];
}

// Main request handler
$requestMethod = $_SERVER['REQUEST_METHOD'];

if ($requestMethod == 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['action'])) {
        echo json_encode(['success' => false, 'message' => 'Action not specified']);
        exit;
    }
    
    switch ($input['action']) {      
        case 'register':
            echo json_encode(registerUser($input));
            break;
            
        case 'login':
            echo json_encode(loginUser($input));
            break;
            
        case 'logout':
            echo json_encode(logoutUser($input['sessionToken']));
            break;
            
        case 'addTransaction':
            echo json_encode(addTransaction($input['transaction'], $input['sessionToken']));
            break;
            
        case 'deleteTransaction':
            echo json_encode(deleteTransaction($input['transactionId'], $input['sessionToken']));
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} elseif ($requestMethod == 'GET') {
    if (!isset($_GET['action'])) {
        echo json_encode(['success' => false, 'message' => 'Action not specified']);
        exit;
    }
    
    switch ($_GET['action']) {
        case 'verifySession':
            echo json_encode(verifySession($_GET['sessionToken']));
            break;
            
        case 'getTransactions':
            echo json_encode(getTransactions($_GET['sessionToken']));
            break;
            
        default:
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
} else {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
