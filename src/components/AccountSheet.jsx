"use client";

// ============================================================
// AccountSheet — mobile-only bottom sheet for the Account page
// ============================================================
// On phones the Account page is presented as a sheet that rises
// from the bottom (swipe-down to dismiss, white circular X, a
// one-time breathing nudge) via the shared <BottomSheet>. Desktop
// keeps the full-page account view (App still renders <AccountView>
// for `view === "account"`).
// ============================================================

import React from "react";
import { BottomSheet } from "./BottomSheet.jsx";
import { AccountView } from "./AccountView.jsx";

export function AccountSheet({ open, onClose, ...accountProps }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Account" peekKey="account">
      <AccountView {...accountProps} onBack={onClose} inSheet />
    </BottomSheet>
  );
}
