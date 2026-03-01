import { Router } from 'express';
import { identify } from '../controllers/identifyController';
import { validate } from '../middleware/validate';
import { identifySchema } from '../schemas/identifySchema';

const router = Router();

router.post('/identify', validate(identifySchema), identify);

export default router;