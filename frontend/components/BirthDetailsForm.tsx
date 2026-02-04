"use client";

import { useRouter } from "next/navigation";
import React, { FC, useState } from "react";
import { api } from "@/lib/api";
import { geocodePlace, getTimezoneOffset } from "@/lib/geocoding";
import { useStore } from "@/store/useStore";
import { StarBackground } from "./StarBackground";

export const BirthDetailsForm: FC = () => {
  const { user, setUser, wallet } = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    dob: user?.dob || "",
    birthTime: user?.birthTime || "",
    birthPlace: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    setLoading(true);
    setError(null);

    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let tzOffset: number | null = null;

      // Geocode if place provided
      if (formData.birthPlace.trim()) {
        const geocodeResult = await geocodePlace(formData.birthPlace);
        if (geocodeResult) {
          lat = geocodeResult.latitude;
          lng = geocodeResult.longitude;
          // Get timezone offset for this location and birth date
          if (formData.dob) {
            const dateTime = formData.birthTime
              ? `${formData.dob}T${formData.birthTime}`
              : formData.dob;
            tzOffset = getTimezoneOffset(formData.birthPlace, lng);
          }
        }
      }

      await api.updateBirthDetails({
        walletAddress: wallet,
        dob: formData.dob,
        birthTime: formData.birthTime,
        birthPlace: formData.birthPlace,
        latitude: lat,
        longitude: lng,
        timezoneOffset: tzOffset,
      });

      // Update local user state
      if (user) {
        setUser({
          ...user,
          dob: formData.dob,
          birthTime: formData.birthTime,
          birthPlace: formData.birthPlace,
        });
      }

      router.push("/cards");
    } catch (err) {
      console.error("Error updating birth details:", err);
      setError("Failed to save birth details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push("/cards");
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-10">
      <StarBackground />

      <div className="relative z-10 w-full max-w-[520px] screen-fade-in">
        <div className="card-glass">
          {/* Progress dots */}
          <div className="progress-dots">
            <div className="progress-dot" />
            <div className="progress-dot active" />
            <div className="progress-dot" />
          </div>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-2xl md:text-3xl font-semibold mb-3 bg-gradient-to-r from-white to-[#d4a017] bg-clip-text text-transparent">
              When were you born?
            </h1>
            <p className="text-sm text-white/50 leading-relaxed">
              We need your birth details to calculate your personalized horoscope.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Birth Date */}
            <div>
              <label className="form-label">
                Birth Date
                <span className="badge-required">Required</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
                required
              />
            </div>

            {/* Birth Place */}
            <div>
              <label className="form-label">
                Birth Place
                <span className="badge-optional">Optional</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. New York, USA"
                value={formData.birthPlace}
                onChange={(e) =>
                  setFormData({ ...formData, birthPlace: e.target.value })
                }
              />
            </div>

            {/* Birth Time */}
            <div>
              <label className="form-label">
                Birth Time
                <span className="badge-optional">Optional</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={formData.birthTime}
                onChange={(e) =>
                  setFormData({ ...formData, birthTime: e.target.value })
                }
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-3 pt-4">
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading || !formData.dob}
              >
                {loading ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={handleSkip}
              >
                Skip optional details
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};