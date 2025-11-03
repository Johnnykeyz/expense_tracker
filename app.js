// Data storage
let userData = {
    sessionToken: null,
    user: null,
    balance: 0,
    transactions: [],
    currentView: 'monthly'
};

let pieChart, barChart;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    initEventListeners();
});

// Event Listeners
function initEventListeners() {
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab + 'Form').classList.add('active');
            hideMessages();
        });
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Action buttons
    document.getElementById('addIncomeBtn').addEventListener('click', () => openModal('incomeModal'));
    document.getElementById('addExpenseBtn').addEventListener('click', () => openModal('expenseModal'));

    // Transaction forms
    document.getElementById('incomeForm').addEventListener('submit', handleAddIncome);
    document.getElementById('expenseForm').addEventListener('submit', handleAddExpense);

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            userData.currentView = e.target.dataset.view;
            updateDashboard();
        });
    });

    // Mobile menu toggle
    const menuToggleEl = document.getElementById('menuToggle');
    if (menuToggleEl) {
        menuToggleEl.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('mobile-visible');
        });
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (item.dataset.page === 'logout') {
                handleLogout();
                return;
            }
            document.querySelectorAll('.nav-item').forEach(navItem => navItem.classList.remove('active'));
            item.classList.add('active');
            handleNavigation(item.dataset.page);
            document.getElementById('sidebar').classList.remove('mobile-visible');
        });
    });

    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Check if user has active session
async function checkSession() {
    const sessionToken = localStorage.getItem('sessionToken');
    
    if (!sessionToken) {
        showAuthScreen();
        return;
    }

    try {
        const response = await fetch(`/api/api.php?action=verifySession&sessionToken=${encodeURIComponent(sessionToken)}`);
        const result = await response.json();

        if (result.success) {
            userData.sessionToken = sessionToken;
            userData.user = result.user;
            userData.balance = parseFloat(result.user.balance) || 0;
            showMainApp();
            loadTransactions();
        } else {
            localStorage.removeItem('sessionToken');
            showAuthScreen();
        }
    } catch (error) {
        console.error('Session verification failed:', error);
        localStorage.removeItem('sessionToken');
        showAuthScreen();
    }
}

// Register handler
async function handleRegister(e) {
    e.preventDefault();
    hideMessages();

    const fullName = document.getElementById('registerFullName').value.trim();
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        showError('Passwords do not match!');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters long!');
        return;
    }

    try {
        const response = await fetch('/api/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'register',
                fullName: fullName,
                username: username,
                email: email,
                phone: phone,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Registration successful! Please login.');
            document.getElementById('registerForm').reset();
            // Switch to login tab
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="login"]').click();
                document.getElementById('loginUsername').value = username;
            }, 1500);
        } else {
            showError(result.message || 'Registration failed!');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Registration failed. Please try again.');
    }
}

// Login handler
async function handleLogin(e) {
    e.preventDefault();
    hideMessages();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showError('Please enter username and password!');
        return;
    }

    try {
        const response = await fetch('/api/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'login',
                username: username,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            userData.sessionToken = result.sessionToken;
            userData.user = result.user;
            userData.balance = parseFloat(result.user.balance) || 0;
            
            localStorage.setItem('sessionToken', result.sessionToken);
            
            document.getElementById('loginForm').reset();
            showMainApp();
            loadTransactions();
        } else {
            showError(result.message || 'Login failed!');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed. Please try again.');
    }
}

// Logout handler
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        await fetch('/api/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'logout',
                sessionToken: userData.sessionToken
            })
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    // Clear local data
    localStorage.removeItem('sessionToken');
    userData = {
        sessionToken: null,
        user: null,
        balance: 0,
        transactions: [],
        currentView: 'monthly'
    };

    // Destroy charts
    if (pieChart) pieChart.destroy();
    if (barChart) barChart.destroy();
    pieChart = null;
    barChart = null;

    showAuthScreen();
}

// Show auth screen
function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// Show main application
function showMainApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    // Update user info in sidebar
    if (userData.user) {
        document.getElementById('userInfo').innerHTML = `
            <p class="user-name">${userData.user.fullName}</p>
            <p style="font-size: 0.85rem; opacity: 0.9;">@${userData.user.username}</p>
        `;
    }
    
    initCharts();
    updateDashboard();
}

// Load transactions from backend
async function loadTransactions() {
    try {
        const response = await fetch(`/api/api.php?action=getTransactions&sessionToken=${encodeURIComponent(userData.sessionToken)}`);
        const result = await response.json();

        if (result.success) {
            userData.transactions = result.transactions.map(t => ({
                id: parseInt(t.id),
                type: t.type,
                category: t.category,
                description: t.description,
                amount: parseFloat(t.amount),
                date: new Date(t.date).toISOString()
            }));
            userData.balance = parseFloat(result.balance) || 0;
            updateDashboard();
        } else if (result.message === 'Invalid or expired session') {
            handleLogout();
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Add income
async function handleAddIncome(e) {
    e.preventDefault();
    const source = document.getElementById('incomeSource').value.trim();
    const amount = parseFloat(document.getElementById('incomeAmount').value);

    if (!source || amount <= 0) {
        alert('Please enter valid income details!');
        return;
    }

    const transaction = {
        type: 'income',
        category: source,
        description: source,
        amount: amount
    };

    try {
        const response = await fetch('/api/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'addTransaction',
                transaction: transaction,
                sessionToken: userData.sessionToken
            })
        });

        const result = await response.json();

        if (result.success) {
            closeModal('incomeModal');
            document.getElementById('incomeForm').reset();
            await loadTransactions();
        } else {
            alert(result.message || 'Failed to add income!');
            if (result.message === 'Invalid or expired session') {
                handleLogout();
            }
        }
    } catch (error) {
        console.error('Error adding income:', error);
        alert('Failed to add income. Please try again.');
    }
}

// Add expense
async function handleAddExpense(e) {
    e.preventDefault();
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value);

    if (!category || !description || amount <= 0) {
        alert('Please enter valid expense details!');
        return;
    }

    if (amount > userData.balance) {
        alert('Insufficient balance!');
        return;
    }

    const transaction = {
        type: 'expense',
        category: category,
        description: description,
        amount: amount
    };

    try {
        const response = await fetch('/api/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'addTransaction',
                transaction: transaction,
                sessionToken: userData.sessionToken
            })
        });

        const result = await response.json();

        if (result.success) {
            closeModal('expenseModal');
            document.getElementById('expenseForm').reset();
            await loadTransactions();
        } else {
            alert(result.message || 'Failed to add expense!');
            if (result.message === 'Invalid or expired session') {
                handleLogout();
            }
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Failed to add expense. Please try again.');
    }
}

// Update dashboard
function updateDashboard() {
    // Update balance
    document.getElementById('currentBalance').textContent = formatCurrency(userData.balance);

    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();

    // Calculate totals
    const income = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    const expense = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpense').textContent = formatCurrency(expense);

    // Update labels
    const viewLabel = userData.currentView === 'monthly' ? 'Monthly' : 'Yearly';
    document.getElementById('incomeLabel').textContent = `${viewLabel} Income`;
    document.getElementById('expenseLabel').textContent = `${viewLabel} Expenses`;

    // Update charts
    updateCharts(filteredTransactions);

    // Render transaction list
    renderTransactions(filteredTransactions);
    
    // Render reports
    renderReports();
}

// Render transactions
function renderTransactions(transactions) {
    const listEl = document.getElementById('transactionsList');
    if (!listEl) return;
    
    if (!transactions || transactions.length === 0) {
        listEl.innerHTML = '<p style="color: var(--text-gray);">No transactions yet.</p>';
        return;
    }

    listEl.innerHTML = transactions.map(t => {
        const amtClass = t.type === 'income' ? 'income' : 'expense';
        const date = new Date(t.date).toLocaleString();
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-category">${t.category}</div>
                    <div class="transaction-description">${t.description || ''} • ${date}</div>
                </div>
                <div class="transaction-amount ${amtClass}">${formatCurrency(t.amount)}</div>
            </div>
        `;
    }).join('');
}

// Render reports
function renderReports() {
    const summaryEl = document.getElementById('reportsSummary');
    if (!summaryEl) return;
    
    const transactions = userData.transactions;
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    // Category breakdown
    const categoryTotals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    
    summaryEl.innerHTML = `
        <div style="margin-bottom:1rem;">
            <strong>Total Income:</strong> ${formatCurrency(totalIncome)}<br>
            <strong>Total Expense:</strong> ${formatCurrency(totalExpense)}<br>
            <strong>Current Balance:</strong> ${formatCurrency(userData.balance)}
        </div>
        <div>
            <strong>Expense Breakdown by Category:</strong>
            <ul style="margin-top:0.5rem;">
                ${Object.entries(categoryTotals).map(([cat, amt]) => 
                    `<li>${cat}: ${formatCurrency(amt)}</li>`
                ).join('')}
            </ul>
        </div>
    `;
}

// Handle navigation
function handleNavigation(page) {
    const title = page.charAt(0).toUpperCase() + page.slice(1);
    const mobileHeader = document.querySelector('.mobile-header h2');
    const headerH2 = document.querySelector('.header h2');
    if (mobileHeader) mobileHeader.textContent = title;
    if (headerH2) headerH2.textContent = title;

    document.querySelectorAll('.page-section').forEach(section => {
        section.style.display = section.id === `${page}Section` ? 'block' : 'none';
    });

    if (page === 'dashboard') {
        updateDashboard();
    } else if (page === 'reports') {
        renderReports();
    }
}

// Get filtered transactions based on view
function getFilteredTransactions() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return userData.transactions.filter(t => {
        const date = new Date(t.date);
        if (userData.currentView === 'monthly') {
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        } else {
            return date.getFullYear() === currentYear;
        }
    });
}

// Initialize charts
function initCharts() {
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    const barCtx = document.getElementById('barChart').getContext('2d');

    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: false
                }
            },
            cutout: '70%',
            radius: '90%'
        }
    });

    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Income',
                    data: [],
                    backgroundColor: 'rgba(212, 175, 55, 0.8)',
                    borderRadius: 8
                },
                {
                    label: 'Expenses',
                    data: [],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '₦' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Update charts
function updateCharts(transactions) {
    if (!pieChart || !barChart) {
        initCharts();
    }

    if (!transactions) transactions = getFilteredTransactions();

    const expenses = transactions.filter(t => t.type === 'expense');

    // Group expenses by category
    const categoryData = {};
    expenses.forEach(t => {
        if (!categoryData[t.category]) {
            categoryData[t.category] = 0;
        }
        categoryData[t.category] += t.amount;
    });

    const sortedCategories = Object.entries(categoryData)
        .sort(([,a], [,b]) => b - a)
        .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    const categories = Object.keys(sortedCategories);
    const amounts = Object.values(sortedCategories);

    const colors = [
        '#d4af37', '#ef4444', '#f59e0b', '#3b82f6', 
        '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
    ];

    while (colors.length < categories.length) {
        colors.push(colors[colors.length % 8]);
    }

    // Update pie chart
    pieChart.data.labels = categories;
    pieChart.data.datasets[0].data = amounts;
    pieChart.data.datasets[0].backgroundColor = colors;
    pieChart.options.plugins.tooltip = {
        callbacks: {
            label: function(context) {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
            }
        }
    };
    pieChart.update();

    // Update bar chart with monthly comparison
    const monthlyData = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    months.forEach(month => {
        monthlyData[month] = {
            income: 0,
            expense: 0
        };
    });

    transactions.forEach(t => {
        const date = new Date(t.date);
        const month = months[date.getMonth()];
        if (t.type === 'income') {
            monthlyData[month].income += t.amount;
        } else {
            monthlyData[month].expense += t.amount;
        }
    });

    barChart.data.labels = months;
    barChart.data.datasets = [
        {
            label: 'Income',
            data: months.map(month => monthlyData[month].income),
            backgroundColor: 'rgba(212, 175, 55, 0.8)',
            borderRadius: 8
        },
        {
            label: 'Expenses',
            data: months.map(month => monthlyData[month].expense),
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderRadius: 8
        }
    ];
    barChart.options.plugins.tooltip = {
        callbacks: {
            label: function(context) {
                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
        }
    };
    barChart.update();
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Format currency
function formatCurrency(amount) {
    return '₦' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Show/hide messages
function showError(message) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function showSuccess(message) {
    const successEl = document.getElementById('authSuccess');
    successEl.textContent = message;
    successEl.classList.add('show');
}

function hideMessages() {
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authSuccess').classList.remove('show');
}
