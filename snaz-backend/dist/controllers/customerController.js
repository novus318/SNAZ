"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkUpdateCustomerDailyFood = exports.updateCustomerDailyFood = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.getCustomersByDriver = exports.getCustomerById = exports.getAllCustomers = void 0;
const Customer_1 = __importDefault(require("../models/Customer"));
const express_validator_1 = require("express-validator");
const calculationEngine_1 = require("../utils/calculationEngine");
const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer_1.default.find({ isActive: true })
            .populate('driverId', 'name route')
            .populate('companyId', 'name')
            .populate('packages.categoryId', 'name')
            .sort({ name: 1 });
        res.json({ success: true, data: customers });
    }
    catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getAllCustomers = getAllCustomers;
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer_1.default.findById(req.params.id)
            .populate('driverId', 'name route')
            .populate('companyId', 'name')
            .populate('packages.categoryId', 'name');
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, data: customer });
    }
    catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getCustomerById = getCustomerById;
const getCustomersByDriver = async (req, res) => {
    try {
        const { driverId } = req.params;
        const customers = await Customer_1.default.find({ driverId, isActive: true })
            .populate('driverId', 'name route')
            .populate('packages.categoryId', 'name')
            .sort({ name: 1 });
        res.json({ success: true, data: customers });
    }
    catch (error) {
        console.error('Error fetching customers by driver:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getCustomersByDriver = getCustomersByDriver;
const createCustomer = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { name, address, phone, email, companyId, driverId, packages, dailyFood, startDate, endDate } = req.body;
        const customer = new Customer_1.default({
            name,
            address,
            phone,
            email,
            companyId,
            driverId,
            packages,
            dailyFood,
            startDate,
            endDate
        });
        const savedCustomer = await customer.save();
        await savedCustomer.populate('driverId', 'name route');
        await savedCustomer.populate('packages.categoryId', 'name');
        res.status(201).json({ success: true, data: savedCustomer });
    }
    catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.createCustomer = createCustomer;
const updateCustomer = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { name, address, phone, email, companyId, driverId, packages, dailyFood, startDate, endDate, isActive } = req.body;
        const customer = await Customer_1.default.findByIdAndUpdate(req.params.id, { name, address, phone, email, companyId, driverId, packages, dailyFood, startDate, endDate, isActive }, { new: true, runValidators: true }).populate('driverId', 'name route')
            .populate('packages.categoryId', 'name');
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, data: customer });
    }
    catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateCustomer = updateCustomer;
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer_1.default.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, message: 'Customer deactivated successfully' });
    }
    catch (error) {
        console.error('Error deactivating customer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.deleteCustomer = deleteCustomer;
const updateCustomerDailyFood = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { id } = req.params;
        const { lunch, dinner } = req.body;
        const update = {};
        if (typeof lunch === 'string') {
            const v = calculationEngine_1.CalculationEngine.validateAndParseBagFormat(lunch);
            if (!v.isValid && lunch.trim() !== '') {
                return res.status(400).json({ success: false, message: v.error || 'Invalid lunch format' });
            }
            update['dailyFood.lunch'] = lunch;
        }
        if (typeof dinner === 'string') {
            const v = calculationEngine_1.CalculationEngine.validateAndParseBagFormat(dinner);
            if (!v.isValid && dinner.trim() !== '') {
                return res.status(400).json({ success: false, message: v.error || 'Invalid dinner format' });
            }
            update['dailyFood.dinner'] = dinner;
        }
        const customer = await Customer_1.default.findByIdAndUpdate(id, { $set: update }, { new: true })
            .populate('driverId', 'name route')
            .populate('packages.categoryId', 'name');
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        res.json({ success: true, data: customer });
    }
    catch (error) {
        console.error('Error updating daily food:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.updateCustomerDailyFood = updateCustomerDailyFood;
const bulkUpdateCustomerDailyFood = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { updates } = req.body;
        // Validate each bag format (allow empty to clear)
        for (const u of updates) {
            if (u.bagFormat && u.bagFormat.trim() !== '') {
                const v = calculationEngine_1.CalculationEngine.validateAndParseBagFormat(u.bagFormat);
                if (!v.isValid) {
                    return res.status(400).json({ success: false, message: `Invalid bag format for customer ${u.customerId}` });
                }
            }
        }
        const ops = updates.map(u => {
            const set = {};
            if (u.mealType === 'lunch')
                set['dailyFood.lunch'] = u.bagFormat;
            else
                set['dailyFood.dinner'] = u.bagFormat;
            return {
                updateOne: {
                    filter: { _id: u.customerId },
                    update: { $set: set }
                }
            };
        });
        if (ops.length > 0) {
            await Customer_1.default.bulkWrite(ops);
        }
        const ids = Array.from(new Set(updates.map(u => u.customerId)));
        const updated = await Customer_1.default.find({ _id: { $in: ids } })
            .populate('driverId', 'name route')
            .populate('packages.categoryId', 'name');
        res.json({ success: true, data: updated });
    }
    catch (error) {
        console.error('Error bulk updating daily food:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.bulkUpdateCustomerDailyFood = bulkUpdateCustomerDailyFood;
//# sourceMappingURL=customerController.js.map