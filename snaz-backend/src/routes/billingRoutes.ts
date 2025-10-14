import { Router } from 'express';
import { generateMonthlyBills, listBills, getBill, getLedger, generateMonthlyBillForEntity } from '../controllers/billingController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Secure routes if auth in place
router.post('/generate', authenticateToken as any, generateMonthlyBills as any);
router.post('/generate/entity', authenticateToken as any, generateMonthlyBillForEntity as any);
router.get('/', authenticateToken as any, listBills as any);
router.get('/ledger', authenticateToken as any, getLedger as any);
router.get('/:id', authenticateToken as any, getBill as any);

export default router;
