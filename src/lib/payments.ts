/**
 * PAGOS (SIMULADO)
 * ----------------
 * No se cobra nada. Para integrar un proveedor real (Mercado Pago, Culqi, Niubiz,
 * Izipay...) reemplaza processPayment() por la llamada al proveedor. Las claves
 * privadas viven aquí en el servidor (variables de entorno), nunca en el frontend.
 */
import type { PAYMENT_METHODS } from '../config/app.ts';

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentResult = {
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  method: PaymentMethod;
  amount: number;
  reference: string;
  transactionId: string;
  processedAt: string;
};

export async function processPayment({ method, amount, reference }: { method: PaymentMethod; amount: number; reference: string }): Promise<PaymentResult> {
  return {
    status: method === 'onsite' ? 'PENDING' : 'APPROVED', // "Pagar en la cancha" queda pendiente hasta que llegue
    method,
    amount,
    reference,
    transactionId: `SIM-${Date.now().toString(36).toUpperCase()}`,
    processedAt: new Date().toISOString(),
  };
}
