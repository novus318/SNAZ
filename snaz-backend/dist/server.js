"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./config/database"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Connect to database
(0, database_1.default)();
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'],
    credentials: true
}));
app.use((0, morgan_1.default)('combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Rate limiting (enabled in production unless explicitly disabled)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RATE_LIMIT === 'true') {
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // default 15 minutes
        max: Number(process.env.RATE_LIMIT_MAX || 100), // default 100 requests per window
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/api/', limiter);
}
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const driverRoutes_1 = __importDefault(require("./routes/driverRoutes"));
const foodCategoryRoutes_1 = __importDefault(require("./routes/foodCategoryRoutes"));
const companyRoutes_1 = __importDefault(require("./routes/companyRoutes"));
const customerRoutes_1 = __importDefault(require("./routes/customerRoutes"));
const dailyOrderRoutes_1 = __importDefault(require("./routes/dailyOrderRoutes"));
const analyticsRoutes_1 = __importDefault(require("./routes/analyticsRoutes"));
const billingRoutes_1 = __importDefault(require("./routes/billingRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/drivers', driverRoutes_1.default);
app.use('/api/food-categories', foodCategoryRoutes_1.default);
app.use('/api/companies', companyRoutes_1.default);
app.use('/api/customers', customerRoutes_1.default);
app.use('/api/daily-orders', dailyOrderRoutes_1.default);
app.use('/api/analytics', analyticsRoutes_1.default);
app.use('/api/billing', billingRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=server.js.map