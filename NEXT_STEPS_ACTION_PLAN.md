# Next Steps Action Plan - Based on Security Audits

**Date:** December 13, 2024  
**Priority Order:** Critical → High → Medium

---

## 🔴 CRITICAL - Do Immediately (Today)

### 1. Revoke GitHub Token ⚠️ URGENT
**Status:** Must be done first  
**Time:** 5 minutes  
**Guide:** `GITHUB_TOKEN_REVOCATION_GUIDE.md`

**Steps:**
1. Go to https://github.com/settings/tokens
2. Find and revoke the exposed token
3. Verify it's revoked by testing `git fetch`

**Impact:** Prevents unauthorized repository access

---

### 2. Fix Swarm Website API Authentication 🔴 CRITICAL BUG
**Status:** Critical security vulnerability  
**Time:** 30 minutes  
**File:** `~/Aria/websites/Swarm_website/wp-content/themes/swarm-theme/functions.php`

**Current Problem:**
```php
function swarm_check_api_permission() {
    // TODO: Implement proper application password verification
    return true;  // ⚠️ CRITICAL: Always returns true!
}
```

**Fix Required:**
Replace the function in `functions.php` (lines 182-194) with:

```php
function swarm_check_api_permission() {
    // Check for Application Password authentication
    $current_user = wp_get_current_user();
    if ($current_user->ID > 0) {
        return true;
    }
    
    // Verify Application Password
    $headers = getallheaders();
    $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if (empty($auth_header)) {
        return false;
    }
    
    // Parse Basic Auth
    if (preg_match('/Basic\s+(.+)$/i', $auth_header, $matches)) {
        $credentials = base64_decode($matches[1]);
        list($username, $password) = explode(':', $credentials, 2);
        
        // Verify Application Password
        $user = wp_authenticate_application_password(null, $username, $password);
        if (!is_wp_error($user)) {
            return true;
        }
    }
    
    return false;
}
```

**Testing:**
- Test API endpoint without auth (should fail)
- Test with valid Application Password (should work)
- Test with invalid credentials (should fail)

---

## 🟡 HIGH PRIORITY - Do This Week

### 3. Fix SQL Queries (Both Projects)
**Time:** 1 hour  
**Impact:** Best practice, prevents potential SQL injection

#### Swarm Website
**File:** `~/Aria/websites/Swarm_website/wp-content/themes/swarm-theme/swarm-api-enhanced.php`

No SQL queries found in Swarm Website (uses `get_option()`/`update_option()` - safe)

#### FreeRideInvestor
**File:** `~/Aria/websites/FreeRideInvestor/plugins/freeride-investor/includes/class-fri-cron.php`

**Line 64 - Fix:**
```php
// BEFORE:
$alerts = $wpdb->get_results("SELECT * FROM $table_name WHERE active = 1", ARRAY_A);

// AFTER:
$alerts = $wpdb->get_results(
    $wpdb->prepare("SELECT * FROM {$table_name} WHERE active = %d", 1),
    ARRAY_A
);
```

**Testing:**
- Verify alerts still load correctly
- Test cron job execution

---

### 4. Mask API Keys in Logs (FreeRideInvestor)
**Time:** 30 minutes  
**File:** `~/Aria/websites/FreeRideInvestor/plugins/freeride-investor/includes/class-fri-data-fetcher.php`

**Lines to Fix:** 103, 147, 179, 234

**Fix:**
```php
// BEFORE:
$this->logger->log('INFO', "Fetching stock data from Alpha Vantage for $symbol using API key: $api_key");
$this->logger->log('INFO', "Request URL: $url");

// AFTER:
$masked_key = substr($api_key, 0, 4) . '...' . substr($api_key, -4);
$this->logger->log('INFO', "Fetching stock data from Alpha Vantage for $symbol using API key: $masked_key");

// Don't log full URL with API key
$url_without_key = remove_query_arg('apikey', $url);
$this->logger->log('INFO', "Request URL: $url_without_key");
```

**Apply to:**
- `fetch_alpha_vantage()` - line 103
- `fetch_twelve_data()` - line 147
- `fetch_finnhub()` - line 179
- `fetch_stock_news()` - line 234

**Testing:**
- Check log files to verify keys are masked
- Verify API calls still work

---

### 5. Mask API Key in Admin Panel (Swarm Website)
**Time:** 15 minutes  
**File:** `~/Aria/websites/Swarm_website/wp-content/themes/swarm-theme/swarm-api-enhanced.php`

**Line 484 - Fix:**
```php
// BEFORE:
<p><code><?php echo esc_html($api_key); ?></code></p>

// AFTER:
<?php if ($api_key): ?>
    <?php 
    $masked_key = substr($api_key, 0, 4) . '...' . substr($api_key, -4);
    ?>
    <p><code><?php echo esc_html($masked_key); ?></code></p>
    <button onclick="navigator.clipboard.writeText('<?php echo esc_js($api_key); ?>')">Copy Full Key</button>
<?php else: ?>
    <p>No API key generated yet.</p>
<?php endif; ?>
```

**Testing:**
- Verify API key is masked in admin panel
- Test copy button works

---

### 6. Implement Rate Limiting (Both Projects)
**Time:** 2 hours  
**Impact:** Prevents DoS attacks and API abuse

#### Swarm Website - REST API Rate Limiting
**File:** `~/Aria/websites/Swarm_website/wp-content/themes/swarm-theme/swarm-api-enhanced.php`

**Add to `swarm_check_api_permission_enhanced()`:**
```php
function swarm_check_api_permission_enhanced($request) {
    // Rate limiting
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rate_limit_key = 'swarm_api_rate_' . md5($ip);
    $rate_limit = get_transient($rate_limit_key);
    
    if ($rate_limit !== false && $rate_limit >= 100) { // 100 requests per 5 minutes
        return new WP_Error(
            'rate_limit_exceeded',
            'Rate limit exceeded. Please try again later.',
            array('status' => 429)
        );
    }
    
    $current_limit = $rate_limit ? $rate_limit + 1 : 1;
    set_transient($rate_limit_key, $current_limit, 300); // 5 minutes
    
    // ... rest of existing authentication code
}
```

#### FreeRideInvestor - AJAX Rate Limiting
**File:** `~/Aria/websites/FreeRideInvestor/plugins/freeride-investor/includes/class-fri-alerts.php`

**Add to `set_alert()` method (beginning of function):**
```php
public function set_alert() {
    // Rate limiting
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $rate_limit_key = 'fri_alert_rate_' . md5($ip);
    $rate_limit = get_transient($rate_limit_key);
    
    if ($rate_limit !== false && $rate_limit >= 5) { // 5 alerts per 5 minutes
        wp_send_json_error(__('Too many requests. Please try again later.', 'freeride-investor'));
        return;
    }
    
    $current_limit = $rate_limit ? $rate_limit + 1 : 1;
    set_transient($rate_limit_key, $current_limit, 300); // 5 minutes
    
    // ... rest of existing code
}
```

**Testing:**
- Test rapid API calls (should be rate limited)
- Verify normal usage still works
- Test rate limit resets after time period

---

## 🟢 MEDIUM PRIORITY - Do This Month

### 7. Add Input Validation for Stock Symbols (FreeRideInvestor)
**Time:** 1 hour  
**File:** `~/Aria/websites/FreeRideInvestor/plugins/freeride-investor/includes/class-fri-shortcodes.php`

**Add validation in AJAX handler:**
```php
// Validate stock symbols
$symbols = isset($_POST['stock_symbols']) ? sanitize_text_field($_POST['stock_symbols']) : '';
$symbols_array = array_map('trim', explode(',', $symbols));
$symbols_array = array_filter($symbols_array);

foreach ($symbols_array as $symbol) {
    $symbol = strtoupper($symbol);
    if (!preg_match('/^[A-Z]{1,5}$/', $symbol)) {
        wp_send_json_error(__('Invalid stock symbol format: ' . esc_html($symbol), 'freeride-investor'));
        return;
    }
}
```

**Testing:**
- Test with valid symbols (TSLA, AAPL)
- Test with invalid symbols (should fail)
- Test with special characters (should fail)

---

### 8. Add Security Headers
**Time:** 1 hour  
**Files:** Both projects' `functions.php`

**Add to `functions.php`:**
```php
function add_security_headers() {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}
add_action('send_headers', 'add_security_headers');
```

**Testing:**
- Check headers with browser dev tools
- Verify headers are present on all pages

---

### 9. Improve Error Handling
**Time:** 2 hours  
**Impact:** Better user experience, security

**Actions:**
- Replace generic error messages in production
- Log detailed errors server-side only
- Don't expose file paths or system details

---

### 10. Add Monitoring & Logging
**Time:** 3 hours  
**Impact:** Better visibility, security

**Actions:**
- Set up error monitoring (Sentry, LogRocket, etc.)
- Add API usage tracking
- Monitor for suspicious activity
- Set up alerts for security events

---

## 📋 Implementation Checklist

### Critical (Today):
- [ ] Revoke GitHub token
- [ ] Fix Swarm Website API authentication

### High Priority (This Week):
- [ ] Fix SQL queries (FreeRideInvestor)
- [ ] Mask API keys in logs (FreeRideInvestor)
- [ ] Mask API key in admin panel (Swarm Website)
- [ ] Implement rate limiting (Both projects)

### Medium Priority (This Month):
- [ ] Add input validation (FreeRideInvestor)
- [ ] Add security headers (Both projects)
- [ ] Improve error handling (Both projects)
- [ ] Add monitoring & logging (Both projects)

---

## Testing Strategy

### After Each Fix:
1. **Test the fix works:**
   - Verify functionality still works
   - Test edge cases
   - Test error conditions

2. **Test security:**
   - Try to exploit the vulnerability
   - Verify it's now protected
   - Test with invalid inputs

3. **Test performance:**
   - Verify no performance degradation
   - Check for new errors in logs

### Before Production:
1. Run full security scan
2. Test all functionality
3. Review logs for errors
4. Test rate limiting
5. Verify all fixes are in place

---

## Estimated Time

- **Critical:** 35 minutes
- **High Priority:** 4 hours
- **Medium Priority:** 7 hours
- **Total:** ~12 hours of work

---

## Priority Order Summary

1. 🔴 **Revoke GitHub token** (5 min) - URGENT
2. 🔴 **Fix Swarm API auth** (30 min) - CRITICAL BUG
3. 🟡 **Fix SQL queries** (1 hour) - Best practice
4. 🟡 **Mask API keys** (45 min) - Security
5. 🟡 **Rate limiting** (2 hours) - Security
6. 🟢 **Input validation** (1 hour) - Best practice
7. 🟢 **Security headers** (1 hour) - Best practice
8. 🟢 **Error handling** (2 hours) - UX/Security
9. 🟢 **Monitoring** (3 hours) - Operations

---

**Next Step:** Start with #1 (Revoke GitHub token) - it takes 5 minutes and is the most urgent.

*Action plan created: December 13, 2024*

