"use client";

import { OrderRoutePage } from "@/components/shop/order-view";
import { BackButton } from "@/components/shell/back-button";

export default function OrderPage() {
  return (
    <div>
      <div className="mx-auto max-w-4xl px-4 pt-4">
        <BackButton fallbackHref="/profile/orders" />
      </div>
      <OrderRoutePage />
    </div>
  );
}
