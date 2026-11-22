"use client";

import { useReducer } from "react";
import type { SubmitResult, Memo, SignedWithdrawalDetails } from "@/lib/sdk";

/** How long before maxTime to stop accepting the code (relay latency buffer). */
export const EXPIRY_MARGIN_MS = 10_000;
/** Resend OTP cooldown in seconds — matches the signup OTP cooldown. */
export const RESEND_COOLDOWN_SECS = 30;

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type WithdrawStep =
  | "form"
  | "review"
  | "signing"
  | "otp"
  | "result";

export type WithdrawState = {
  step: WithdrawStep;

  // form inputs (persisted across step transitions)
  destination: string;
  amount: string;
  memo: string;
  memoType: "text" | "id";
  password: string;
  selectedKey: string;

  // review / signing
  createsAccount: boolean;
  reviewedAmount: string | null;
  signedTxDetails: SignedWithdrawalDetails | null;

  // OTP step
  pendingXdr: string | null;
  code: string;
  expiresAt: number | null;
  networkExpired: boolean;
  resendAvailableAt: number;
  resigning: boolean;

  // result
  result: SubmitResult | null;

  // shared error
  error: string | null;
};

export type WithdrawAction =
  | { type: "SET_DESTINATION"; value: string }
  | { type: "SET_AMOUNT"; value: string }
  | { type: "SET_MEMO"; value: string }
  | { type: "SET_MEMO_TYPE"; value: "text" | "id" }
  | { type: "SET_PASSWORD"; value: string }
  | { type: "SET_SELECTED_KEY"; value: string }
  | { type: "SET_ERROR"; value: string | null }
  | { type: "GO_TO_REVIEW"; createsAccount: boolean; reviewedAmount: string }
  | { type: "BACK_TO_FORM" }
  | {
      type: "OTP_REQUESTED";
      pendingXdr: string;
      expiresAt: number;
      resendAvailableAt: number;
      createsAccount: boolean;
      signedTxDetails: SignedWithdrawalDetails;
    }
  | { type: "SET_CODE"; value: string }
  | { type: "NETWORK_EXPIRED" }
  | { type: "RESEND_AVAILABLE_AT"; value: number }
  | { type: "DISCARD_SIGNED"; resign: boolean }
  | { type: "RESULT"; result: SubmitResult };

export const initialWithdrawState: WithdrawState = {
  step: "form",
  destination: "",
  amount: "",
  memo: "",
  memoType: "text",
  password: "",
  selectedKey: "",
  createsAccount: false,
  reviewedAmount: null,
  signedTxDetails: null,
  pendingXdr: null,
  code: "",
  expiresAt: null,
  networkExpired: false,
  resendAvailableAt: 0,
  resigning: false,
  result: null,
  error: null,
};

export function withdrawReducer(
  state: WithdrawState,
  action: WithdrawAction,
): WithdrawState {
  switch (action.type) {
    case "SET_DESTINATION":
      return { ...state, destination: action.value };
    case "SET_AMOUNT":
      return { ...state, amount: action.value };
    case "SET_MEMO":
      return { ...state, memo: action.value };
    case "SET_MEMO_TYPE":
      return { ...state, memoType: action.value };
    case "SET_PASSWORD":
      return { ...state, password: action.value };
    case "SET_SELECTED_KEY":
      return { ...state, selectedKey: action.value };
    case "SET_ERROR":
      return { ...state, error: action.value };
    case "GO_TO_REVIEW":
      return {
        ...state,
        step: "review",
        createsAccount: action.createsAccount,
        reviewedAmount: action.reviewedAmount,
        error: null,
      };
    case "BACK_TO_FORM":
      return { ...state, step: "form", error: null };
    case "OTP_REQUESTED":
      return {
        ...state,
        step: "otp",
        pendingXdr: action.pendingXdr,
        expiresAt: action.expiresAt,
        resendAvailableAt: action.resendAvailableAt,
        createsAccount: action.createsAccount,
        signedTxDetails: action.signedTxDetails,
        networkExpired: false,
        resigning: false,
        code: "",
        error: null,
      };
    case "SET_CODE":
      return { ...state, code: action.value };
    case "NETWORK_EXPIRED":
      return { ...state, networkExpired: true };
    case "RESEND_AVAILABLE_AT":
      return { ...state, resendAvailableAt: action.value };
    case "DISCARD_SIGNED":
      return {
        ...state,
        step: "form",
        pendingXdr: null,
        expiresAt: null,
        networkExpired: false,
        code: "",
        error: null,
        resigning: action.resign,
        reviewedAmount: null,
        signedTxDetails: null,
      };
    case "RESULT":
      return { ...state, step: "result", result: action.result };
    default:
      return state;
  }
}

export function useWithdrawFlow() {
  return useReducer(withdrawReducer, initialWithdrawState);
}
