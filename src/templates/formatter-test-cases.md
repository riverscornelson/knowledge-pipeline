# Formatter Test Cases

## 🧪 Test Scenarios for Each Formatting Issue

### Test Case 1: Breaking Text Walls

**Input:**
```
The analysis reveals significant opportunities for market expansion through digital transformation initiatives that could potentially increase revenue by 45% over the next 18 months while simultaneously reducing operational costs by approximately 30% through automation and process optimization. Furthermore, the implementation of advanced analytics capabilities would enable real-time decision making and predictive insights that could prevent up to 60% of potential issues before they impact customers. The technology stack modernization would also improve system performance by 3x while reducing maintenance overhead.
```

**Expected Output:**
```
# 📊 Market Analysis

## 🎯 Key Finding

> 💡 **Digital transformation could boost revenue by 45% while cutting costs by 30%**

## 📈 Growth Opportunities

### 🚀 Revenue Expansion
Market expansion through digital initiatives shows **45% revenue potential** over 18 months.

### 💰 Cost Reduction  
Automation and process optimization can achieve **30% operational savings**.

### 🧠 Advanced Analytics
- **Real-time decision making** enabled
- **Predictive insights** prevent 60% of issues
- **Proactive customer protection** implemented

## ⚡ Performance Impact

/callout 🔧
**System Improvements**
- 3x performance boost
- Reduced maintenance overhead
- Modern technology stack
/callout
```

### Test Case 2: List Formatting

**Input:**
```
- Implement user authentication system with OAuth2, JWT tokens, multi-factor authentication, session management, and password reset functionality
- Build RESTful API with endpoints for users, products, orders, payments, shipping, and inventory management with full CRUD operations
- Create responsive frontend using React with TypeScript, Redux for state management, Material-UI components, and comprehensive testing
```

**Expected Output:**
```
# 📋 Implementation Tasks

## 1️⃣ **Authentication System**
Comprehensive security implementation with modern standards.

### Core Features:
- 🔐 OAuth2 integration
- 🎫 JWT token management
- 🛡️ Multi-factor authentication
- 📱 Session management
- 🔄 Password reset flow

## 2️⃣ **RESTful API Development**
Full-featured backend with complete CRUD operations.

### API Endpoints:
/toggle Endpoint Details
- **Users**: Registration, profile, preferences
- **Products**: Catalog, search, filtering
- **Orders**: Creation, tracking, history
- **Payments**: Processing, refunds, receipts
- **Shipping**: Rates, tracking, delivery
- **Inventory**: Stock levels, updates, alerts
/toggle

## 3️⃣ **Frontend Application**
Modern responsive interface with enterprise features.

### Tech Stack:
- ⚛️ **Framework**: React + TypeScript
- 📦 **State**: Redux + Redux Toolkit
- 🎨 **UI**: Material-UI components
- 🧪 **Testing**: Jest + React Testing Library
```

### Test Case 3: Data Presentation

**Input:**
```
Performance metrics show response time improved from 450ms to 45ms, uptime increased from 95.5% to 99.9%, error rate decreased from 3.2% to 0.1%, throughput increased from 1000 to 10000 requests per second, and customer satisfaction improved from 3.2 to 4.8 out of 5.
```

**Expected Output:**
```
# 📊 Performance Metrics

## 🎯 System Performance Gains

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| ⚡ Response Time | 450ms | **45ms** | ↗️ 10x faster |
| 🟢 Uptime | 95.5% | **99.9%** | ↗️ +4.4% |
| ❌ Error Rate | 3.2% | **0.1%** | ↘️ -96.9% |
| 📈 Throughput | 1K rps | **10K rps** | ↗️ 10x increase |
| 😊 Satisfaction | 3.2/5 | **4.8/5** | ↗️ +50% |

/callout 🚀
**Key Achievement**: 10x performance improvement across critical metrics
/callout
```

### Test Case 4: Classification Formatting

**Input:**
```
This task is classified as: Priority: High, Complexity: Medium, Cost: Low, Timeline: Q2 2024, Department: Engineering, Impact: Company-wide, Risk: Moderate
```

**Expected Output:**
```
# 🏷️ Task Classification

## 📊 Quick Overview

/columns 4
/column
### 🎯 Priority
🔴 **High**

/column
### 🔧 Complexity
🟡 **Medium**

/column
### 💰 Cost
🟢 **Low**

/column
### ⏱️ Timeline
**Q2 2024**
/columns

## 🏢 Organizational Details

/callout 📋
**Assignment**: Engineering Department  
**Impact Scope**: Company-wide  
**Risk Level**: 🟡 Moderate
/callout
```

### Test Case 5: Technical Content

**Input:**
```
Install dependencies: npm install express cors dotenv jsonwebtoken bcrypt. Create server.js file with basic Express setup. Configure middleware for CORS, JSON parsing, and authentication. Set up route handlers for /api/users, /api/auth, and /api/products. Implement error handling middleware. Configure environment variables for PORT, JWT_SECRET, and DATABASE_URL.
```

**Expected Output:**
```
# 🔧 Express Server Setup

## 📦 Installation

```bash
npm install express cors dotenv jsonwebtoken bcrypt
```

## 🏗️ Implementation Steps

### 1️⃣ **Create Server Foundation**

/toggle server.js
```javascript
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```
/toggle

### 2️⃣ **Configure Middleware**

/toggle Middleware Setup
```javascript
// CORS configuration
app.use(cors());

// JSON parsing
app.use(express.json());

// Authentication middleware
app.use('/api', authenticateToken);
```
/toggle

### 3️⃣ **API Routes**

- 👤 `/api/users` - User management
- 🔐 `/api/auth` - Authentication
- 📦 `/api/products` - Product catalog

### 4️⃣ **Environment Configuration**

/callout ⚙️
**Required Environment Variables**
```env
PORT=3000
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://...
```
/callout
```

### Test Case 6: Mobile Optimization

**Input:**
```
The comprehensive analysis of user behavior patterns across multiple touchpoints reveals that mobile users represent 68% of total traffic with an average session duration of 3.2 minutes compared to desktop users at 5.7 minutes. The conversion rate on mobile devices is 2.3% while desktop achieves 4.1%. Key drop-off points include the checkout process where 45% of mobile users abandon their carts compared to only 22% on desktop.
```

**Expected Output (Mobile View):**
```
# 📱 User Behavior Analysis

> 💡 **68% of users are on mobile**

## 📊 Key Metrics

### Device Usage
- **Mobile**: 68% 📱
- **Desktop**: 32% 💻

### Session Duration
- **Mobile**: 3.2 min
- **Desktop**: 5.7 min

### Conversion Rates
- **Mobile**: 2.3% 🔴
- **Desktop**: 4.1% 🟢

/toggle 🛒 Cart Abandonment
**Critical Issue Found**
- Mobile: 45% abandon
- Desktop: 22% abandon
- Gap: 23% difference

**Action Required**: Optimize mobile checkout
/toggle
```

## 🎯 Validation Criteria

### ✅ Success Metrics

1. **Text Readability**
   - No paragraph > 3 sentences
   - Clear visual breaks between sections
   - Proper heading hierarchy

2. **Visual Elements**
   - At least 1 emoji per section header
   - Tables for 3+ data points
   - Callouts for key information

3. **Mobile Optimization**
   - Single column layout preferred
   - Toggles for detailed content
   - No horizontal scrolling

4. **Information Hierarchy**
   - Main point visible immediately
   - Details in toggles
   - Progressive disclosure

5. **Notion Features**
   - Proper use of /callout
   - Correct /toggle syntax
   - Valid /columns structure

### ❌ Common Failures

1. **Text Walls**
   - Paragraphs > 100 words
   - No visual breaks
   - Missing headers

2. **Poor Data Display**
   - Numbers in sentences
   - No visual indicators
   - Missing context

3. **Mobile Issues**
   - Complex multi-column layouts
   - Wide tables
   - Nested toggles > 2 levels

4. **Formatting Errors**
   - Incorrect Notion syntax
   - Missing closing tags
   - Broken markdown

## 🔄 Test Execution

```javascript
// Test runner example
function testFormatter(input, expectedTemplate) {
  const result = formatContent(input);
  
  // Check structure
  assert(result.includes('# '));
  assert(result.includes('## '));
  
  // Check visual elements
  assert(countEmojis(result) >= 3);
  assert(result.includes('/callout') || result.includes('> '));
  
  // Check readability
  const paragraphs = result.split('\n\n');
  paragraphs.forEach(p => {
    assert(p.split('. ').length <= 3);
  });
  
  // Check mobile optimization
  const columnCount = (result.match(/\/column/g) || []).length;
  assert(columnCount <= 3);
  
  return {
    passed: true,
    score: calculateScore(result, expectedTemplate)
  };
}
```

## 📋 Test Coverage Checklist

- [ ] Executive Summary formatting
- [ ] Key Insights with callouts
- [ ] Strategic Implications layout
- [ ] Technical content with code blocks
- [ ] Action items with checkboxes
- [ ] Classifications with visual indicators
- [ ] Mobile-optimized views
- [ ] Data tables and metrics
- [ ] Toggle functionality
- [ ] Emoji usage appropriateness

Remember: Each test should validate both the visual appeal and functional correctness of the formatted output!