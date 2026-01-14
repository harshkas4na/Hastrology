"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/store/useStore";

export type OnboardingStep =
    | "wallet"
    | "x-link"
    | "birth-details"
    | "payment"
    | "complete";

export interface OnboardingStatus {
    // Individual status checks
    isWalletConnected: boolean;
    isWalletReady: boolean; // Wallet connected AND unlocked (can sign)
    isXLinked: boolean;
    hasBirthDetails: boolean;

    // Loading state
    isLoading: boolean;

    // Current step in the onboarding journey
    currentStep: OnboardingStep;

    // Where the user should be redirected based on their progress
    getRedirectUrl: () => string | null;

    // Human-readable messages for each step
    getStepMessage: () => string;

    // Check if user can access a specific page
    canAccess: (page: "cards" | "lottery" | "login" | "link-x") => boolean;

    // Check if user can perform payment
    canPay: () => { allowed: boolean; reason: string | null };
}

/**
 * Centralized hook for checking user onboarding status.
 * Use this to enforce the correct user journey flow:
 * 1. Connect Wallet
 * 2. Link X Account
 * 3. Enter Birth Details
 * 4. Pay for Horoscope (on /cards)
 * 5. View Card & Participate in Lottery
 */
export function useOnboardingStatus(): OnboardingStatus {
    const { publicKey, connected, wallet } = useWallet();
    const { user } = useStore();
    const [isLoading, setIsLoading] = useState(true);

    // Check if wallet is connected
    const isWalletConnected = connected && !!publicKey;

    // Check if wallet is ready (connected and likely unlocked)
    // We check if the wallet adapter is properly initialized
    const isWalletReady = isWalletConnected && !!wallet?.adapter?.publicKey;

    // Check if X account is linked
    const isXLinked = !!user?.twitterId;

    // Check if birth details are complete
    const hasBirthDetails = !!(
        user?.dob &&
        user?.birthTime &&
        user?.birthPlace
    );

    // Determine current step
    const getCurrentStep = useCallback((): OnboardingStep => {
        if (!isWalletConnected) return "wallet";
        if (!isXLinked) return "x-link";
        if (!hasBirthDetails) return "birth-details";
        return "complete";
    }, [isWalletConnected, isXLinked, hasBirthDetails]);

    const currentStep = getCurrentStep();

    // Get redirect URL based on current progress
    const getRedirectUrl = useCallback((): string | null => {
        switch (currentStep) {
            case "wallet":
                return "/";
            case "x-link":
                return "/link-x";
            case "birth-details":
                return "/login";
            default:
                return null;
        }
    }, [currentStep]);

    // Get human-readable message for current step
    const getStepMessage = useCallback((): string => {
        switch (currentStep) {
            case "wallet":
                return "Please connect your wallet to continue";
            case "x-link":
                return "Please link your X account to continue";
            case "birth-details":
                return "Please enter your birth details to continue";
            case "complete":
                return "You're all set!";
            default:
                return "";
        }
    }, [currentStep]);

    // Check if user can access a specific page
    const canAccess = useCallback(
        (page: "cards" | "lottery" | "login" | "link-x"): boolean => {
            switch (page) {
                case "link-x":
                    // Need wallet connected
                    return isWalletConnected;
                case "login":
                    // Need wallet connected (birth details form)
                    return isWalletConnected;
                case "cards":
                    // Need wallet + X linked + birth details
                    return isWalletConnected && isXLinked && hasBirthDetails;
                case "lottery":
                    // Need wallet + X linked + birth details
                    return isWalletConnected && isXLinked && hasBirthDetails;
                default:
                    return true;
            }
        },
        [isWalletConnected, isXLinked, hasBirthDetails]
    );

    // Check if user can perform payment
    const canPay = useCallback((): { allowed: boolean; reason: string | null } => {
        if (!isWalletConnected) {
            return {
                allowed: false,
                reason: "Please connect your wallet to make a payment",
            };
        }
        if (!isWalletReady) {
            return {
                allowed: false,
                reason: "Please unlock your wallet to complete the payment",
            };
        }
        if (!isXLinked) {
            return {
                allowed: false,
                reason: "Please link your X account first",
            };
        }
        if (!hasBirthDetails) {
            return {
                allowed: false,
                reason: "Please enter your birth details first",
            };
        }
        return { allowed: true, reason: null };
    }, [isWalletConnected, isWalletReady, isXLinked, hasBirthDetails]);

    // Update loading state once we have user data
    useEffect(() => {
        // If wallet is connected but user data not loaded yet, keep loading
        if (isWalletConnected && user === null) {
            // Give time for user data to load
            const timeout = setTimeout(() => setIsLoading(false), 2000);
            return () => clearTimeout(timeout);
        }
        setIsLoading(false);
    }, [isWalletConnected, user]);

    return {
        isWalletConnected,
        isWalletReady,
        isXLinked,
        hasBirthDetails,
        isLoading,
        currentStep,
        getRedirectUrl,
        getStepMessage,
        canAccess,
        canPay,
    };
}
