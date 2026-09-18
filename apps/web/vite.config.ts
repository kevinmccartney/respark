import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Reachable from the host when Vite runs inside Compose.
    host: true,
    port: 5173,
  },
});
