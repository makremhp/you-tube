import { Router, type IRouter } from "express";
import healthRouter from "./health";
import telegramInvoiceRouter from "./telegram-invoice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(telegramInvoiceRouter);

export default router;
