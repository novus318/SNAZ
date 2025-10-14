import { Router } from 'express';
import { recordPayment, listPayments } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken as any, recordPayment as any);
router.get('/', authenticateToken as any, listPayments as any);

export default router;
