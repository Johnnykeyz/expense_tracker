// Enhanced Predictive features that work with minimal data
async function loadPredictionsAndRecommendations() {
    if (!userData.sessionToken) return;

    try {
        const response = await fetch(`/api/api.php?action=getPredictions&sessionToken=${encodeURIComponent(userData.sessionToken)}`);
        const result = await response.json();

        if (result.success) {
            updatePredictionsUI(result.predictions);
            updateRecommendationsUI(result.recommendations);
        } else {
            // Generate local insights if backend doesn't have enough data
            generateLocalInsights();
        }
    } catch (error) {
        console.error('Error loading predictions:', error);
        // Fallback to local insights
        generateLocalInsights();
    }
}

// Generate insights from local transaction data
function generateLocalInsights() {
    const transactions = userData.transactions || [];
    const expenses = transactions.filter(t => t.type === 'expense');
    
    if (expenses.length === 0) {
        showEmptyStateInsights();
        return;
    }

    // Analyze spending patterns
    const insights = analyzeSpendingPatterns(expenses);
    updatePredictionsUI(insights.predictions);
    updateRecommendationsUI(insights.recommendations);
}

function analyzeSpendingPatterns(expenses) {
    const categoryTotals = {};
    const categoryCount = {};
    const now = new Date();
    
    // Group by category
    expenses.forEach(exp => {
        const cat = exp.category;
        if (!categoryTotals[cat]) {
            categoryTotals[cat] = 0;
            categoryCount[cat] = 0;
        }
        categoryTotals[cat] += exp.amount;
        categoryCount[cat]++;
    });

    // Generate predictions
    const predictions = {};
    Object.entries(categoryTotals).forEach(([category, total]) => {
        const avgPerTransaction = total / categoryCount[category];
        const projectedMonthly = avgPerTransaction * Math.max(categoryCount[category], 4); // Project at least 4 transactions
        
        predictions[category] = {
            predicted_amount: projectedMonthly,
            trend: total > projectedMonthly * 0.8 ? 'increasing' : 'stable',
            percent_change: Math.abs(((total - projectedMonthly) / projectedMonthly) * 100).toFixed(1),
            confidence: categoryCount[category] >= 3 ? 'high' : 'moderate'
        };
    });

    // Generate smart recommendations
    const recommendations = generateSmartRecommendations(categoryTotals, categoryCount, expenses);

    return { predictions, recommendations };
}

function generateSmartRecommendations(categoryTotals, categoryCount, expenses) {
    const recommendations = [];
    const totalSpending = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    // Sort categories by spending
    const sortedCategories = Object.entries(categoryTotals)
        .sort(([,a], [,b]) => b - a);

    // Recommendation 1: Highest spending category
    if (sortedCategories.length > 0) {
        const [topCategory, topAmount] = sortedCategories[0];
        const percentage = ((topAmount / totalSpending) * 100).toFixed(0);
        const potentialSavings = topAmount * 0.15; // Suggest 15% reduction
        
        recommendations.push({
            category: topCategory,
            potential_savings: potentialSavings,
            message: `${topCategory} is ${percentage}% of your spending. Try reducing by 15% to save ₦${potentialSavings.toFixed(2)}/month.`
        });
    }

    // Recommendation 2: Most frequent category
    const mostFrequent = Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)[0];
    
    if (mostFrequent && mostFrequent[0] !== sortedCategories[0]?.[0]) {
        const [freqCategory, count] = mostFrequent;
        const avgAmount = categoryTotals[freqCategory] / count;
        const savings = avgAmount * count * 0.1;
        
        recommendations.push({
            category: freqCategory,
            potential_savings: savings,
            message: `You spend on ${freqCategory} ${count} times. Consider bulk buying or looking for better deals to save 10%.`
        });
    }

    // Recommendation 3: Budget suggestion
    const avgDailySpending = totalSpending / Math.max(expenses.length, 1);
    const suggestedDailyBudget = avgDailySpending * 0.9; // 10% reduction
    const monthlySavings = (avgDailySpending - suggestedDailyBudget) * 30;
    
    recommendations.push({
        category: 'Daily Budget',
        potential_savings: monthlySavings,
        message: `Set a daily budget of ₦${suggestedDailyBudget.toFixed(2)} to save ₦${monthlySavings.toFixed(2)}/month.`
    });

    // Recommendation 4: Category-specific tips
    const categoryTips = {
        'Food': 'Meal prep on weekends to reduce daily food expenses by up to 30%.',
        'Transport': 'Consider carpooling or public transport to cut transport costs by 25%.',
        'Shopping': 'Make a shopping list and stick to it to avoid impulse purchases.',
        'Entertainment': 'Look for free or low-cost entertainment alternatives.',
        'Bills': 'Review subscriptions and cancel unused services.'
    };

    Object.keys(categoryTotals).forEach(cat => {
        if (categoryTips[cat] && recommendations.length < 4) {
            const savings = categoryTotals[cat] * 0.2;
            recommendations.push({
                category: cat,
                potential_savings: savings,
                message: categoryTips[cat]
            });
        }
    });

    return recommendations.slice(0, 4); // Return max 4 recommendations
}

function showEmptyStateInsights() {
    const predictionsContainer = document.getElementById('predictionsContent');
    const recommendationsContainer = document.getElementById('recommendationsContent');
    
    if (predictionsContainer) {
        predictionsContainer.innerHTML = `
            <div class="prediction-item" style="border-left-color: #3b82f6;">
                <div class="prediction-header">
                    <div class="prediction-title">🎯 Getting Started</div>
                </div>
                <div style="margin-top: 0.5rem; color: var(--text-gray);">
                    Add a few transactions to see personalized spending insights and predictions!
                </div>
            </div>
            <div class="prediction-item" style="border-left-color: #8b5cf6;">
                <div class="prediction-header">
                    <div class="prediction-title">💡 Pro Tip</div>
                </div>
                <div style="margin-top: 0.5rem; color: var(--text-gray);">
                    Track at least 5-10 transactions for more accurate AI predictions.
                </div>
            </div>
        `;
    }
    
    if (recommendationsContainer) {
        recommendationsContainer.innerHTML = `
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div class="recommendation-title">📊 Track Everything</div>
                    <div class="potential-savings">Essential</div>
                </div>
                <div class="recommendation-action">
                    Record all your income and expenses to get a complete financial picture.
                </div>
            </div>
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div class="recommendation-title">🎯 Set Goals</div>
                    <div class="potential-savings">Recommended</div>
                </div>
                <div class="recommendation-action">
                    Decide on a monthly savings target to stay motivated.
                </div>
            </div>
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div class="recommendation-title">📅 Daily Habit</div>
                    <div class="potential-savings">Tip</div>
                </div>
                <div class="recommendation-action">
                    Make it a habit to log expenses immediately after spending.
                </div>
            </div>
        `;
    }
}

function updatePredictionsUI(predictions) {
    const container = document.getElementById('predictionsContent');
    if (!container) return;

    if (!predictions || Object.keys(predictions).length === 0) {
        showEmptyStateInsights();
        return;
    }

    const html = Object.entries(predictions)
        .slice(0, 3) // Show top 3 predictions
        .map(([category, data]) => {
            const trendClass = data.trend === 'increasing' ? 'increasing' : 'decreasing';
            const trendIcon = data.trend === 'increasing' ? '📈' : '📊';
            const trendText = data.trend === 'increasing' ? 'trending up' : 'stable';
            const confidenceBadge = data.confidence === 'high' ? '✓ High confidence' : 'ℹ️ Moderate confidence';
            
            return `
                <div class="prediction-item">
                    <div class="prediction-header">
                        <div class="prediction-title">${trendIcon} ${category}</div>
                        <div class="prediction-amount">₦${data.predicted_amount.toFixed(2)}</div>
                    </div>
                    <div class="prediction-trend ${trendClass}">
                        ${trendText} • ${confidenceBadge}
                    </div>
                </div>
            `;
        })
        .join('');

    container.innerHTML = html;
}

function updateRecommendationsUI(recommendations) {
    const container = document.getElementById('recommendationsContent');
    if (!container) return;

    if (!recommendations || recommendations.length === 0) {
        showEmptyStateInsights();
        return;
    }

    const html = recommendations
        .slice(0, 3) // Show top 3 recommendations
        .map(rec => `
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div class="recommendation-title">💰 ${rec.category}</div>
                    <div class="potential-savings">Save ₦${rec.potential_savings.toFixed(0)}</div>
                </div>
                <div class="recommendation-action">${rec.message}</div>
            </div>
        `)
        .join('');

    container.innerHTML = html;
}

// Location-based features
function initLocationFeatures() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            loadNearbyVendors(latitude, longitude);
        }, error => {
            console.error('Location error:', error);
            showLocationDisabledState();
        });
    } else {
        showLocationDisabledState();
    }
}

function showLocationDisabledState() {
    const container = document.getElementById('nearbyVendorsContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="vendor-item" style="border-left-color: #f59e0b;">
            <div class="vendor-header">
                <div class="vendor-name">📍 Location Services</div>
            </div>
            <div class="vendor-distance" style="margin-top: 0.5rem;">
                Enable location to discover nearby deals and savings opportunities in your area.
            </div>
        </div>
        <div class="vendor-item" style="border-left-color: #3b82f6;">
            <div class="vendor-header">
                <div class="vendor-name">🛍️ Smart Shopping Tips</div>
            </div>
            <div class="vendor-distance" style="margin-top: 0.5rem;">
                Compare prices before buying, use discount apps, and shop during sales for maximum savings.
            </div>
        </div>
    `;
}

async function loadNearbyVendors(latitude, longitude) {
    if (!userData.sessionToken) return;

    try {
        const response = await fetch(`/api/api.php?action=getNearbyVendors&sessionToken=${
            encodeURIComponent(userData.sessionToken)}&latitude=${latitude}&longitude=${longitude}`);
        const result = await response.json();

        if (result.success && result.vendors && result.vendors.length > 0) {
            updateNearbyVendorsUI(result.vendors);
        } else {
            showGenericLocationTips();
        }
    } catch (error) {
        console.error('Error loading nearby vendors:', error);
        showGenericLocationTips();
    }
}

function showGenericLocationTips() {
    const container = document.getElementById('nearbyVendorsContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="vendor-item">
            <div class="vendor-header">
                <div class="vendor-name">🏪 Local Markets</div>
                <div class="vendor-price">Up to 30% off</div>
            </div>
            <div class="vendor-distance">Visit local markets for fresh produce at lower prices than supermarkets.</div>
        </div>
        <div class="vendor-item">
            <div class="vendor-header">
                <div class="vendor-name">🚌 Public Transport</div>
                <div class="vendor-price">Save 50%</div>
            </div>
            <div class="vendor-distance">Use public transport instead of private cars to cut transport costs significantly.</div>
        </div>
        <div class="vendor-item">
            <div class="vendor-header">
                <div class="vendor-name">🍽️ Home Cooking</div>
                <div class="vendor-price">Save ₦15,000+</div>
            </div>
            <div class="vendor-distance">Cooking at home instead of eating out can save over ₦15,000 monthly.</div>
        </div>
    `;
}

function updateNearbyVendorsUI(vendors) {
    const container = document.getElementById('nearbyVendorsContent');
    if (!container) return;

    if (!vendors || vendors.length === 0) {
        showGenericLocationTips();
        return;
    }

    const html = vendors
        .slice(0, 3) // Show top 3 vendors
        .map(vendor => `
            <div class="vendor-item">
                <div class="vendor-header">
                    <div class="vendor-name">🏪 ${vendor.vendor_name}</div>
                    <div class="vendor-price">₦${vendor.price.toFixed(2)}</div>
                </div>
                <div class="vendor-distance">${vendor.distance.toFixed(1)}km away • ${vendor.item_name}</div>
            </div>
        `)
        .join('');

    container.innerHTML = html;
}

// Receipt scanning features
function initReceiptUpload() {
    const expenseForm = document.getElementById('expenseForm');
    if (!expenseForm || document.querySelector('.receipt-upload')) return;

    const uploadHtml = `
        <div class="receipt-upload">
            <button type="button" class="receipt-upload-btn" onclick="handleReceiptUpload()">
                <i class="fas fa-receipt"></i> Scan Receipt
            </button>
        </div>
    `;

    expenseForm.insertAdjacentHTML('beforeend', uploadHtml);
}

async function handleReceiptUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('receipt', file);
        formData.append('sessionToken', userData.sessionToken);
        formData.append('action', 'processReceipt');

        try {
            const response = await fetch('/api/api.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // Auto-fill expense form with OCR data
                document.getElementById('expenseAmount').value = result.data.total;
                document.getElementById('expenseDescription').value = result.data.items
                    .map(item => item.name)
                    .join(', ');
            }
        } catch (error) {
            console.error('Receipt processing error:', error);
            alert('Failed to process receipt. Please enter details manually.');
        }
    };

    input.click();
}

// Call this when transactions are updated
function onTransactionsUpdated() {
    generateLocalInsights();
}

// Make sure this runs when the app loads
if (typeof showMainApp !== 'undefined') {
    const originalShowMainApp = showMainApp;
    showMainApp = function() {
        originalShowMainApp();
        loadPredictionsAndRecommendations();
        initLocationFeatures();
        initReceiptUpload();
    };
}
