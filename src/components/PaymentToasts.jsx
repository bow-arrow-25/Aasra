import { useEffect, useRef } from "react";
import { useGlobalState } from "../context/GlobalState";
import { useToast } from "./Toast";
import { formatRupees, PAYMENT_STATUS } from "../lib/payments";

function fingerprint(payment) {
  return `${payment.status}:${payment.decidedAt || ""}`;
}

export default function PaymentToasts() {
  const { payments, parentName } = useGlobalState();
  const { toast } = useToast();
  const seenRef = useRef(new Map());
  const primedRef = useRef(false);

  useEffect(() => {
    const list = payments || [];
    if (!primedRef.current) {
      list.forEach((payment) => {
        seenRef.current.set(payment.id, fingerprint(payment));
      });
      primedRef.current = true;
      return;
    }

    if (list.length === 0) {
      seenRef.current.clear();
      return;
    }

    for (const payment of list) {
      const next = fingerprint(payment);
      const prev = seenRef.current.get(payment.id);
      if (prev === next) continue;
      seenRef.current.set(payment.id, next);

      const who = payment.decidedBy || "Family";
      const detail = `${payment.payee} · ${formatRupees(payment.amount)}`;

      if (payment.status === PAYMENT_STATUS.APPROVED_SENT && payment.decidedAt) {
        toast({
          level: "INFO",
          title: `${who} approved the payment`,
          body: `${detail} was sent.`,
        });
      } else if (payment.status === PAYMENT_STATUS.REJECTED && payment.decidedAt) {
        toast({
          level: "CRITICAL",
          title: `${who} rejected the payment`,
          body: `${parentName || "Amma"} was told not to send ${detail}.`,
        });
      }
    }
  }, [payments, parentName, toast]);

  return null;
}
