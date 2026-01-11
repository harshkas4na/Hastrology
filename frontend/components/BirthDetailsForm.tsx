"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { type FC, useState } from "react";
import { api } from "@/lib/api";
import { geocodePlace, getTimezoneOffset } from "@/lib/geocoding";
import { useStore } from "@/store/useStore";

export const BirthDetailsForm: FC = () => {
  const { publicKey } = useWallet();
  const { setUser, setLoading } = useStore();

  const [formData, setFormData] = useState({
    dob: "",
    birthTime: "",
    birthPlace: "",
    username: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setError(null);
    setIsGeocoding(true);

    try {
      // Step 1: Geocode the birth place
      const geoResult = await geocodePlace(formData.birthPlace);

      if (!geoResult.success) {
        setError(
          geoResult.error ||
          'Could not find location. Please try a more specific place name (e.g., "New Delhi, India")'
        );
        setIsGeocoding(false);
        return;
      }

      setIsGeocoding(false);
      setLoading(true);

      // Step 2: Calculate timezone offset
      const timezoneOffset = getTimezoneOffset(formData.birthPlace, geoResult.longitude);

      // Step 3: Register user with geocoded coordinates
      const result = await api.registerUser({
        walletAddress: publicKey.toBase58(),
        username: formData.username,
        dob: formData.dob,
        birthTime: formData.birthTime,
        birthPlace: formData.birthPlace,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
        timezoneOffset: timezoneOffset,
      });

      setUser(result.user);

      // Scroll to next section
      document.getElementById("horoscope-section")?.scrollIntoView({ behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setIsGeocoding(false);
      setLoading(false);
    }
  };

  const isFormValid = formData.dob && formData.birthTime && formData.birthPlace && formData.username;
  const isSubmitting = isGeocoding;

  return (
    <section
      className="min-h-screen flex items-center justify-center py-20 px-4 relative"
      id="birth-form"
    >
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] -z-10"></div>

      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <div className="glass-panel rounded-3xl p-8 md:p-10 relative overflow-hidden">
          {/* Decorative top border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
            Your Birth Details
          </h2>
          <p className="text-slate-400 text-center mb-10 text-lg">
            Align your energy with the cosmos
          </p>

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Username */}
            <div className="group">
              <label
                className="block text-sm font-medium text-purple-300 mb-2 ml-1 group-focus-within:text-purple-400 transition-colors"
                htmlFor="username"
              >
                Username
              </label>
              <input
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all outline-none hover:bg-slate-900/70"
                id="username"
                onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="e.g., CosmicTraveler"
                required
                type="text"
                value={formData.username}
              />
            </div>

            {/* Date of Birth */}
            <div className="group">
              <label
                className="block text-sm font-medium text-purple-300 mb-2 ml-1 group-focus-within:text-purple-400 transition-colors"
                htmlFor="dob"
              >
                Date of Birth
              </label>
              <input
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all outline-none hover:bg-slate-900/70"
                id="dob"
                onChange={(e) => setFormData((prev) => ({ ...prev, dob: e.target.value }))}
                required
                type="date"
                value={formData.dob}
              />
            </div>

            {/* Birth Time */}
            <div className="group">
              <label
                className="block text-sm font-medium text-purple-300 mb-2 ml-1 group-focus-within:text-purple-400 transition-colors"
                htmlFor="birthTime"
              >
                Time of Birth
              </label>
              <input
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all outline-none hover:bg-slate-900/70"
                id="birthTime"
                onChange={(e) => setFormData((prev) => ({ ...prev, birthTime: e.target.value }))}
                required
                type="time"
                value={formData.birthTime}
              />
            </div>

            {/* Birth Place */}
            <div className="group">
              <label
                className="block text-sm font-medium text-purple-300 mb-2 ml-1 group-focus-within:text-purple-400 transition-colors"
                htmlFor="birthPlace"
              >
                Place of Birth
              </label>
              <input
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all outline-none hover:bg-slate-900/70"
                id="birthPlace"
                onChange={(e) => setFormData((prev) => ({ ...prev, birthPlace: e.target.value }))}
                placeholder="e.g., New Delhi, India"
                required
                type="text"
                value={formData.birthPlace}
              />
              <p className="text-xs text-slate-500 mt-2 ml-1">
                📍 Enter city and country for accurate cosmic alignment
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-center gap-2">
                <span className="text-lg">⚠️</span> {error}
              </div>
            )}

            <button
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all duration-300 shadow-lg shadow-purple-900/20 hover:shadow-purple-600/40 hover:-translate-y-1 active:translate-y-0"
              disabled={!isFormValid || !publicKey || isSubmitting}
              type="submit"
            >
              {isGeocoding ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Locating your stars...
                </span>
              ) : (
                "Continue Journey →"
              )}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-8 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Encrypted & Secure on Solana
          </p>
        </div>
      </motion.div>
    </section>
  );
};
