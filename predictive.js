// Predictive features
async function loadPredictionsAndRecommendations() {
    if (!userData.sessionToken) return;

    try {
        const response = await fetch(`/api/api.php?action=getPredictions&sessionToken=${encodeURIComponent(userData.sessionToken)}`);
        const result = await response.json();

        if (result.success) {
            updatePredictionsUI(result.predictions);
            updateRecommendationsUI(result.recommendations);
        }
    } catch (error) {
        console.error('Error loading predictions:', error);
    }
}

function updatePredictionsUI(predictions) {
    const container = document.getElementById('predictionsContent');
    if (!container) return;

    if (!predictions || Object.keys(predictions).length === 0) {
        container.innerHTML = '<p>Not enough data yet to make predictions. Keep tracking your expenses!</p>';
        return;
    }

    const html = Object.entries(predictions)
        .map(([category, data]) => {
            const trendClass = data.trend === 'increasing' ? 'increasing' : 'decreasing';
            const trendIcon = data.trend === 'increasing' ? '↑' : '↓';
            return `
                <div class="prediction-item">
                    <div class="prediction-header">
                        <div class="prediction-title">${category}</div>
                        <div class="prediction-amount">₦${data.predicted_amount.toFixed(2)}</div>
                    </div>
                    <div class="prediction-trend ${trendClass}">
                        ${trendIcon} ${Math.abs(data.percent_change)}% ${data.trend} vs. 3-month average
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
        container.innerHTML = '<p>No recommendations available yet. Keep using the app!</p>';
        return;
    }

    const html = recommendations
        .map(rec => `
            <div class="recommendation-item">
                <div class="recommendation-header">
                    <div class="recommendation-title">${rec.category}</div>
                    <div class="potential-savings">Save ₦${rec.potential_savings.toFixed(2)}</div>
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
            document.getElementById('nearbyVendorsContent').innerHTML = 
                '<p>Enable location services to see nearby savings opportunities.</p>';
        });
    } else {
        document.getElementById('nearbyVendorsContent').innerHTML = 
            '<p>Your browser doesn\'t support location services.</p>';
    }
}

async function loadNearbyVendors(latitude, longitude) {
    if (!userData.sessionToken) return;

    try {
        const response = await fetch(`/api/api.php?action=getNearbyVendors&sessionToken=${
            encodeURIComponent(userData.sessionToken)}&latitude=${latitude}&longitude=${longitude}`);
        const result = await response.json();

        if (result.success) {
            updateNearbyVendorsUI(result.vendors);
        }
    } catch (error) {
        console.error('Error loading nearby vendors:', error);
    }
}

function updateNearbyVendorsUI(vendors) {
    const container = document.getElementById('nearbyVendorsContent');
    if (!container) return;

    if (!vendors || vendors.length === 0) {
        container.innerHTML = '<p>No nearby savings opportunities found at the moment.</p>';
        return;
    }

    const html = vendors
        .map(vendor => `
            <div class="vendor-item">
                <div class="vendor-header">
                    <div class="vendor-name">${vendor.vendor_name}</div>
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
    if (!expenseForm) return;

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

// Extend existing functions
function showMainApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    if (userData.user) {
        document.getElementById('userInfo').innerHTML = `
            <p class="user-name">${userData.user.fullName}</p>
            <p style="font-size: 0.85rem; opacity: 0.9;">@${userData.user.username}</p>
        `;
    }
    
    initCharts();
    updateDashboard();
    loadPredictionsAndRecommendations();
    initLocationFeatures();
    initReceiptUpload();
}